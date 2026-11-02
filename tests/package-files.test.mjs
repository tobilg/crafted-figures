import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectSkillFiles } from '../skill/crafted-figures/kit/package-files.mjs';
test('release and source-bundle file boundary excludes local state and verifies runtime bytes', async () => {
  const root = await tempDir('cf-package-files-');
  const put = async (name, data) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), data);
  };
  try {
    for (const name of [
      'SKILL.md',
      'LICENSE',
      'package.json',
      'package-lock.json',
      'THIRD_PARTY_NOTICES.md',
      'agents/openai.yaml',
      'licenses/MIT',
      'references/usage.md',
      'assets/templates/basic/figure.mjs',
      'scripts/figures.mjs',
      'kit/index.mjs',
      'types/index.d.mts',
    ])
      await put(name, 'fixture');
    const runtime = 'export const fixture=1;';
    await put('runtime/vite/dist/build.mjs', runtime);
    await put(
      'runtime/manifest.json',
      JSON.stringify({
        generator: 'crafted-figures-runtime',
        files: { 'vite/dist/build.mjs': createHash('sha256').update(runtime).digest('hex') },
      }),
    );
    for (const name of [
      'kit/.env',
      'assets/.env.local',
      'assets/.npmrc',
      'assets/playwright/.auth/state.json',
      'assets/private.pem',
      'assets/cache.log',
      'assets/node_modules/private/index.mjs',
      'scripts/.DS_Store',
      'runtime/unlisted.mjs',
    ])
      await put(name, 'local only');
    await put('assets/.env.example', 'EXAMPLE=value');
    const files = await collectSkillFiles(root);
    assert.ok(files['assets/.env.example']);
    assert.ok(files['runtime/vite/dist/build.mjs']);
    assert.ok(!Object.values(files).some(bytes => bytes.toString() === 'local only'));
    await put('runtime/vite/dist/build.mjs', 'modified');
    await assert.rejects(collectSkillFiles(root), /Runtime file changed/);
    await put('runtime/vite/dist/build.mjs', runtime);
    await symlink(path.join(root, 'SKILL.md'), path.join(root, 'kit/link.mjs'));
    await assert.rejects(collectSkillFiles(root), /symlink/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('the skill package carries the repository license unchanged', async () => {
  assert.equal(
    await readFile('skill/crafted-figures/LICENSE', 'utf8'),
    await readFile('LICENSE', 'utf8'),
  );
  for (const file of ['package.json', 'skill/crafted-figures/package.json'])
    assert.equal(JSON.parse(await readFile(file, 'utf8')).license, 'MIT', file);
});
