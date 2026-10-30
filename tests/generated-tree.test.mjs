import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { prepareGeneratedTree } from '../scripts/generated-tree.mjs';
import { syncTemplates, recipeNames } from '../scripts/sync-templates.mjs';
const options = { generator: 'crafted-figures-package', manifestName: 'package-manifest.json' };
async function temp(t) {
  const dir = await tempDir('crafted-generated-test-');
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const write = async (dir, files, opts = options) =>
  (await prepareGeneratedTree(dir, files, opts)).commit();

test('generated package updates owned files and removes only unchanged obsolete files', async t => {
  const dir = path.join(await temp(t), 'package');
  await write(dir, { 'SKILL.md': 'one', 'old/file.mjs': 'old' });
  await write(dir, { 'SKILL.md': 'two', 'kit/index.mjs': 'export {};' });
  assert.equal(await readFile(path.join(dir, 'SKILL.md'), 'utf8'), 'two');
  await assert.rejects(readFile(path.join(dir, 'old/file.mjs')), /ENOENT/);
  const manifest = await readFile(path.join(dir, 'package-manifest.json'));
  await write(dir, { 'kit/index.mjs': 'export {};', 'SKILL.md': 'two' });
  assert.deepEqual(await readFile(path.join(dir, 'package-manifest.json')), manifest);
});
test('package conflicts preserve edited and unrelated files without partial replacement', async t => {
  const dir = path.join(await temp(t), 'package');
  await write(dir, { 'SKILL.md': 'original', 'kit.mjs': 'original kit' });
  await writeFile(path.join(dir, 'SKILL.md'), 'user edit');
  const manifest = await readFile(path.join(dir, 'package-manifest.json'));
  await assert.rejects(
    write(dir, { 'SKILL.md': 'new', 'kit.mjs': 'new kit' }),
    /edited or unowned/,
  );
  assert.equal(await readFile(path.join(dir, 'SKILL.md'), 'utf8'), 'user edit');
  assert.equal(await readFile(path.join(dir, 'kit.mjs'), 'utf8'), 'original kit');
  await writeFile(path.join(dir, 'SKILL.md'), 'original');
  await writeFile(path.join(dir, 'local-note.txt'), 'keep me');
  await assert.rejects(write(dir, { 'SKILL.md': 'new' }), /local-note.txt.*edited or unowned/);
  assert.equal(await readFile(path.join(dir, 'local-note.txt'), 'utf8'), 'keep me');
  assert.deepEqual(await readFile(path.join(dir, 'package-manifest.json')), manifest);
});
test('generated trees reject symlinks, unsafe paths and nonidentical unmanifested copies', async t => {
  const root = await temp(t),
    dir = path.join(root, 'recipe');
  await mkdir(dir);
  await writeFile(path.join(dir, 'figure.mjs'), 'original');
  await assert.rejects(
    write(dir, { 'figure.mjs': 'changed' }, { ...options, adoptIdentical: true }),
    /edited or unowned/,
  );
  await write(dir, { 'figure.mjs': 'original' }, { ...options, adoptIdentical: true });
  await assert.rejects(write(dir, { '../outside': 'bad' }), /Invalid generated path/);
  await symlink(path.join(dir, 'figure.mjs'), path.join(dir, 'link'));
  await assert.rejects(write(dir, { 'figure.mjs': 'new' }), /symlink/);
  assert.equal(await readFile(path.join(dir, 'figure.mjs'), 'utf8'), 'original');
});
test('template sync rejects stale files and retired recipes before changing any recipe', async t => {
  const root = await temp(t),
    templates = path.join(root, 'skill/crafted-figures/assets/templates');
  for (const name of recipeNames) {
    const dir = path.join(root, 'examples', name);
    await mkdir(dir, { recursive: true });
    for (const file of [
      'figure.mjs',
      'scene.mjs',
      'client.mjs',
      'model.mjs',
      'figure.config.json',
      'sheet.mjs',
    ])
      await writeFile(path.join(dir, file), name + '/' + file);
  }
  for (const name of ['basic-figure', 'react-next']) {
    await mkdir(path.join(templates, name), { recursive: true });
    await writeFile(path.join(templates, name, 'author.txt'), 'authored scaffold');
  }
  await syncTemplates(root);
  const figure = path.join(templates, 'sector-gauge/figure.mjs'),
    stale = path.join(templates, 'dial-indicator/obsolete-recipe.mjs');
  await writeFile(stale, 'unowned');
  await writeFile(path.join(root, 'examples/sector-gauge/figure.mjs'), 'updated canonical recipe');
  await assert.rejects(syncTemplates(root), /obsolete-recipe.mjs.*edited or unowned/);
  assert.equal(await readFile(figure, 'utf8'), 'sector-gauge/figure.mjs');
  assert.equal(await readFile(stale, 'utf8'), 'unowned');
  await rm(stale);
  await syncTemplates(root);
  assert.equal(await readFile(figure, 'utf8'), 'updated canonical recipe');
  await mkdir(path.join(templates, 'retired-recipe'));
  await assert.rejects(syncTemplates(root), /Unexpected template path.*retired-recipe/);
  for (const name of ['basic-figure', 'react-next'])
    assert.equal(
      await readFile(path.join(templates, name, 'author.txt'), 'utf8'),
      'authored scaffold',
    );
});
