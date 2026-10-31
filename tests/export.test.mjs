import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  buildFigure,
  validateFigure,
  safeJSON,
  wrapSVG,
} from '../skill/crafted-figures/kit/build.mjs';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import figure from '../examples/dial-indicator/figure.mjs';
const entry = 'examples/dial-indicator/figure.mjs';
test('A04/A05: real bundles, static vector export, reproducible artifacts and preserved output files', async () => {
  const out = await tempDir('cf-export-');
  const options = { entry, out, state: 'mid', overrides: { output: 'both' } };
  await buildFigure(options);
  const before = Object.fromEntries(
    await Promise.all(
      (await readdir(out)).map(async n => [n, await readFile(path.join(out, n), 'utf8')]),
    ),
  );
  await buildFigure(options);
  for (const [n, s] of Object.entries(before))
    assert.equal(await readFile(path.join(out, n), 'utf8'), s, n);
  assert.match(before['figure.svg'], /5.00 mm/);
  assert.match(before['figure.svg'], /<style>/);
  assert.doesNotMatch(before['figure.svg'], /Copyright \(c\) 2026 Ryan/);
  assert.doesNotMatch(before['figure.svg'], /<(?:image|script|foreignObject)\b/);
  assert.doesNotMatch(before['figure.html'], /<(?:script|link|img)\b[^>]*(?:src|href)=/);
  assert.doesNotMatch(before['figure.html'], /import\s.*from|\/Users\/|Date\.now/);
  const manifest = JSON.parse(before['build-manifest.json']);
  assert.equal(manifest.pose, 'mid');
  assert.equal(manifest.provenance.implementation, 'crafted-figures');
  assert.equal(manifest.provenance.anatomyRuntimeCode, false);
  assert.equal(
    manifest.provenance.designReference.commit,
    '1482e8469b0a9e0d8cc18ea2740a01423d29ae80',
  );
  for (const [key, value] of Object.entries(manifest.tokens))
    assert.ok(
      before['figure.svg'].includes(`--cf-${key}:${value}`),
      `manifest token ${key} matches embedded CSS`,
    );
  assert.ok(
    manifest.tokens.accentLine && manifest.tokens.accentTop && manifest.tokens.accentInk,
    'derived appearance tokens are reproducible manifest inputs',
  );
  await writeFile(path.join(out, 'notes.txt'), 'mine');
  await buildFigure({ ...options, overrides: { output: 'svg' } });
  assert.equal(await readFile(path.join(out, 'notes.txt'), 'utf8'), 'mine');
  assert.ok(!(await readdir(out)).includes('figure.html'));
  // A removed generated file is already clean; changing formats must still work.
  await unlink(path.join(out, 'figure.svg'));
  await buildFigure({ ...options, overrides: { output: 'html' } });
  assert.ok((await readdir(out)).includes('figure.html'));
  assert.ok(!(await readdir(out)).includes('figure.svg'));
  await buildFigure(options);
  await writeFile(path.join(out, 'figure.svg'), 'edited');
  await assert.rejects(buildFigure(options), /edited/);
  const other = await tempDir('cf-conflict-');
  await writeFile(path.join(other, 'figure.html'), 'mine');
  await assert.rejects(buildFigure({ ...options, out: other }), /unrelated/);
  await assert.rejects(buildFigure({ ...options, state: 'invalid' }), /unknown pose/);
});
test('FR-04 and escaping: required contract, complete poses and hostile metadata', async () => {
  for (const id of [undefined, null, 123, ''])
    assert.throws(() => validateFigure({ ...figure, id }), /id/);
  for (const initialState of [5, 'state', [1, 2]])
    assert.throws(
      () => validateFigure({ ...figure, initialState, poses: { rest: initialState } }),
      /state/i,
    );
  for (const f of [
    { ...figure, poses: { rest: { displacementMm: 1 } } },
    { ...figure, poses: { ...figure.poses, bad: {} } },
    { ...figure, initialState: { x: Infinity } },
    { ...figure, clientEntry: 'client.js' },
  ])
    assert.throws(() => validateFigure(f));
  const { config, tokens } = await resolveConfig();
  const svg = wrapSVG(
    {
      viewBox: [0, 0, 20, 20],
      title: '</title><script>alert(1)</script>',
      description: '" & <',
      body: '<path d="M0 0L20 20"/>',
    },
    config,
    tokens,
  );
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(safeJSON({ x: '</script>\u2028' }), /[<\u2028]/);
});
