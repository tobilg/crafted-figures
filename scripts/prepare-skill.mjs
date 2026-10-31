import { spawn } from 'node:child_process';
import { access, mkdtemp, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = args =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code =>
      code === 0
        ? resolve()
        : reject(new Error(`Skill preparation failed (${code}): node ${args.join(' ')}`)),
    );
  });
/** Generate all installable assets from pinned development inputs. Never installs. */
export async function prepareSkill() {
  for (const file of [
    'node_modules/typescript/bin/tsc',
    'skill/crafted-figures/node_modules/vite/package.json',
  ]) {
    try {
      await access(path.join(root, file));
    } catch {
      throw new Error(
        'Missing development dependencies. From the repository root run npm ci and npm --prefix skill/crafted-figures ci, then npm run package:skill. Install the built ZIP for dependency-free use.',
      );
    }
  }
  await run(['skill/crafted-figures/scripts/build-runtime.mjs']);
  const stage = await mkdtemp(path.join(root, 'skill/crafted-figures/.types-build-'));
  try {
    await run([
      'node_modules/typescript/bin/tsc',
      '-p',
      'tsconfig.declarations.json',
      '--outDir',
      stage,
    ]);
    await rm(path.join(root, 'skill/crafted-figures/types'), { recursive: true, force: true });
    await rename(stage, path.join(root, 'skill/crafted-figures/types'));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  await run(['scripts/sync-templates.mjs']);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await prepareSkill();
