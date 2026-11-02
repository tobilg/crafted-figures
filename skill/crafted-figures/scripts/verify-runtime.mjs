import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url),
  digest = b => createHash('sha256').update(b).digest('hex');
/** Check generated compiler inputs and shipped bytes without npm dependencies. */
export async function verifyRuntime() {
  const manifest = JSON.parse(await readFile(new URL('runtime/manifest.json', root), 'utf8'));
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  if (
    manifest.generator !== 'crafted-figures-runtime' ||
    manifest.toolkitVersion !== pkg.version ||
    manifest.bundler.version !== pkg.devDependencies.vite
  )
    throw new Error('Bundled runtime is stale; run npm run runtime:build');
  for (const [name, hash] of Object.entries(manifest.inputs))
    if (digest(await readFile(new URL(name, root))) !== hash)
      throw new Error(`Bundled runtime input changed: ${name}; run npm run runtime:build`);
  for (const [name, hash] of Object.entries(manifest.files))
    if (digest(await readFile(new URL('runtime/' + name, root))) !== hash)
      throw new Error(`Bundled runtime file changed: ${name}; run npm run runtime:build`);
  return manifest;
}
