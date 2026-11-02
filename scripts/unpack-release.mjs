// Unpacks the release ZIP where consumers expect it, using only Node, because the no-install CI
// jobs have no dependencies and no unzip command is common to Linux, macOS and Windows.
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const END_OF_DIRECTORY = 0x06054b50,
  DIRECTORY_ENTRY = 0x02014b50,
  LOCAL_HEADER = 0x04034b50;

/** Writes every file in a ZIP under `dest` and returns the names, refusing paths that leave it.
 * @param {Buffer} zip
 * @param {string} dest
 * @returns {string[]}
 */
export function unpackZip(zip, dest) {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== END_OF_DIRECTORY) end--;
  if (end < 0) throw new Error('Not a ZIP file: no end-of-directory record');
  const count = zip.readUInt16LE(end + 10),
    root = path.resolve(dest),
    names = [];
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== DIRECTORY_ENTRY) throw new Error('Corrupt ZIP directory');
    const method = zip.readUInt16LE(at + 10),
      size = zip.readUInt32LE(at + 20),
      nameLength = zip.readUInt16LE(at + 28),
      extraLength = zip.readUInt16LE(at + 30),
      commentLength = zip.readUInt16LE(at + 32),
      mode = zip.readUInt32LE(at + 38) >>> 16,
      offset = zip.readUInt32LE(at + 42),
      name = zip.toString('utf8', at + 46, at + 46 + nameLength),
      file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) throw new Error(`Unsafe ZIP path: ${name}`);
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (zip.readUInt32LE(offset) !== LOCAL_HEADER) throw new Error(`Corrupt ZIP entry: ${name}`);
    const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28),
      data = zip.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Unsupported compression: ${name}`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, method === 8 ? inflateRawSync(data) : data);
    if (mode & 0o111) chmodSync(file, 0o755);
    names.push(name);
  }
  return names;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = path.resolve(process.argv[2] ?? 'dist'),
    zips = readdirSync(dist).filter(name => /^crafted-figures-.+\.zip$/.test(name));
  if (zips.length !== 1) throw new Error(`Expected one release ZIP in ${dist}, found ${zips}`);
  const zip = readFileSync(path.join(dist, zips[0])),
    [expected] = readFileSync(path.join(dist, `${zips[0]}.sha256`), 'utf8').split(/\s/),
    actual = createHash('sha256').update(zip).digest('hex');
  if (actual !== expected) throw new Error(`${zips[0]} does not match its checksum`);
  console.log(`Unpacked ${unpackZip(zip, dist).length} files from ${zips[0]}`);
}
