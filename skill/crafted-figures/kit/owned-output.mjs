import { readFile, writeFile, mkdir, lstat, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { digest } from './hash.mjs';
export { digest };
async function readManifest(file, generator, label) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`${file}: unreadable manifest; choose another destination (${e.message})`);
  }
  if (manifest.generator !== generator || !manifest.outputHashes)
    throw new Error(`${file}: unrelated manifest; choose another ${label}`);
  return manifest;
}
/** The one owned-output writer. Preflight never overwrites unrelated or locally edited files.
 *
 * Bytes are staged beside their destination, and the next manifest is recorded first as
 * `<manifest>.pending`. A run interrupted at any point (Ctrl-C, full disk) leaves files that
 * belong to the old or the pending manifest, both accepted on the next run, so an interrupted
 * write can always be retried.
 * @param {string} out
 * @param {Record<string,string|Uint8Array>} files
 * @param {{generator:string,manifestName:string,metadata?:Record<string,unknown>,destinationLabel?:string}} options
 * @returns {Promise<Record<string,any>>} the manifest written
 */
export async function writeOwnedSet(
  out,
  files,
  { generator, manifestName, metadata = {}, destinationLabel = 'destination' },
) {
  const manifestPath = path.join(out, manifestName),
    pendingPath = `${manifestPath}.pending`,
    prior = await readManifest(manifestPath, generator, destinationLabel),
    pending = await readManifest(pendingPath, generator, destinationLabel),
    known = name => [prior?.outputHashes?.[name], pending?.outputHashes?.[name]],
    obsolete = [
      ...new Set([
        ...Object.keys(prior?.outputHashes || {}),
        ...Object.keys(pending?.outputHashes || {}),
      ]),
    ].filter(name => !Object.hasOwn(files, name));
  for (const name of new Set([...Object.keys(files), ...obsolete])) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
      throw new Error(`Invalid output name ${name}`);
    const file = path.join(out, name);
    let stat;
    try {
      stat = await lstat(file);
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      throw e;
    }
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !known(name).includes(digest(await readFile(file)))
    )
      throw new Error(
        `${file}: unrelated or edited output; choose another ${destinationLabel} or preserve it elsewhere`,
      );
  }
  const manifest = {
      generator,
      ...metadata,
      outputHashes: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, digest(v)])),
    },
    manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  await mkdir(out, { recursive: true });
  await writeFile(pendingPath, manifestBytes);
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(out, name),
      staged = `${file}.crafted-staged`;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(staged, value);
    await rename(staged, file);
  }
  for (const name of obsolete)
    await unlink(path.join(out, name)).catch(e => {
      if (e.code !== 'ENOENT') throw e;
    });
  await rename(pendingPath, manifestPath);
  return manifest;
}
