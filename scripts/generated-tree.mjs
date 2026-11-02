import { readFile, writeFile, mkdir, readdir, lstat, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safeName = name =>
  typeof name === 'string' &&
  !path.isAbsolute(name) &&
  !name.includes('\\') &&
  name.split('/').every(p => p && p !== '.' && p !== '..');

/** Validate all existing contents before replacing a generated directory.
 * Identical, pre-manifest recipe copies can be adopted once; edits never can.
 * @param {string} destination
 * @param {Record<string, Buffer|string>} files
 * @param {{generator:string, manifestName:string, adoptIdentical?:boolean}} options
 */
export async function prepareGeneratedTree(
  destination,
  files,
  { generator, manifestName, adoptIdentical = false },
) {
  const dest = path.resolve(destination);
  if (!safeName(manifestName) || manifestName.includes('/'))
    throw new Error('Invalid generated manifest name');
  for (const name of Object.keys(files))
    if (!safeName(name) || name === manifestName)
      throw new Error(`Invalid generated path: ${name}`);
  const current = new Map(),
    directories = [];
  async function walk(dir, relative = '') {
    const stat = await lstat(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error(`Generated directory must not be a symlink or file: ${dir}`);
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = relative + entry.name,
        file = path.join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Unowned symlink in generated directory: ${file}`);
      if (entry.isDirectory()) {
        directories.push(name + '/');
        await walk(file, name + '/');
      } else if (entry.isFile()) current.set(name, await readFile(file));
      else throw new Error(`Unsupported generated-directory entry: ${file}`);
    }
  }
  let exists = true;
  try {
    await lstat(dest);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    exists = false;
  }
  if (exists) await walk(dest);
  let previous;
  if (current.has(manifestName)) {
    previous = JSON.parse(current.get(manifestName).toString());
    if (
      previous.generator !== generator ||
      !previous.files ||
      typeof previous.files !== 'object' ||
      Array.isArray(previous.files)
    )
      throw new Error(`Unowned manifest: ${dest}/${manifestName}`);
    for (const [name, digest] of Object.entries(previous.files))
      if (!safeName(name) || name === manifestName || !/^[a-f0-9]{64}$/.test(digest))
        throw new Error(`Invalid generated manifest entry: ${name}`);
  }
  for (const [name, bytes] of current) {
    if (name === manifestName) continue;
    const expected = previous?.files[name];
    if (
      expected
        ? hash(bytes) !== expected
        : !(
            adoptIdentical &&
            !previous &&
            Object.hasOwn(files, name) &&
            hash(bytes) === hash(files[name])
          )
    ) {
      throw new Error(
        `Generated output conflict: ${path.join(dest, name)} is edited or unowned. Preserve it outside the generated directory, then retry.`,
      );
    }
  }
  if (exists && !previous && !adoptIdentical && current.size)
    throw new Error(`Unowned generated directory: ${dest}`);
  for (const dir of directories)
    if (
      ![...Object.keys(previous?.files || {}), ...Object.keys(files)].some(name =>
        name.startsWith(dir),
      )
    )
      throw new Error(`Unowned generated subdirectory: ${path.join(dest, dir)}`);
  const manifest = {
    generator,
    files: Object.fromEntries(
      Object.entries(files)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, bytes]) => [name, hash(bytes)]),
    ),
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  return {
    manifest,
    manifestBytes,
    async commit() {
      const parent = path.dirname(dest);
      await mkdir(parent, { recursive: true });
      const staging = await mkdtemp(path.join(parent, '.crafted-generated-'));
      const next = path.join(staging, 'next'),
        previousDir = path.join(staging, 'previous');
      await mkdir(next);
      let preserveBackup = false;
      try {
        for (const [name, bytes] of Object.entries({ ...files, [manifestName]: manifestBytes })) {
          const file = path.join(next, name);
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, bytes);
        }
        if (exists) await rename(dest, previousDir);
        try {
          await rename(next, dest);
        } catch (error) {
          if (exists)
            try {
              await rename(previousDir, dest);
            } catch (rollbackError) {
              preserveBackup = true;
              throw new AggregateError(
                [error, rollbackError],
                `Replacement failed; preserved original output at ${previousDir}`,
              );
            }
          throw error;
        }
      } finally {
        if (!preserveBackup) await rm(staging, { recursive: true, force: true });
      }
    },
  };
}
