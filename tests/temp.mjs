import { rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const created = [];
/** A temporary directory removed when the process exits, whether the test passed or not.
 * @param {string} prefix
 */
export async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}
process.on('exit', () => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});
