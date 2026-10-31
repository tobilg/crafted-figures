import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveConfig, loadPresets } from '../skill/crafted-figures/kit/config.mjs';
const layers = (...values) => values.map((value, i) => ({ value, label: `input-${i}.json` }));
test('A01: select highest preset first, then deep merge explicit layers', async () => {
  const { config: c } = await resolveConfig({
    layers: layers(
      { preset: 'technical', motion: { durationMs: 500 }, typography: { body: 'Georgia, serif' } },
      { preset: 'editorial', motion: { enabled: false } },
      { theme: 'dark', motion: { idleTour: true } },
    ),
  });
  assert.equal(c.preset, 'editorial');
  assert.equal(c.frame, 'minimal');
  assert.equal(c.detail, 'compact');
  assert.deepEqual(c.motion, { durationMs: 500, enabled: false, idleTour: true });
  assert.equal(c.typography.mono, 'ui-monospace, monospace');
  assert.equal(c.theme, 'dark');
  const d = (await resolveConfig()).config;
  assert.equal(d.motion.idleTour, false);
});
test('A01: reject unsupported fields, invalid types, declarations and ranges with paths', async () => {
  for (const value of [
    { camera: {} },
    { theme: 'auto' },
    { accent: '#abc' },
    { accent: 'red' },
    { schemaVersion: 3 },
    { stroke: { width: 3 } },
    { motion: { durationMs: -1 } },
    { motion: { enabled: 'false' } },
    { motion: null },
    { typography: { body: 'system-ui; color:red' } },
    { typography: { mono: 'url(https://x)' } },
    { typography: { body: 'A\nB' } },
    { typography: { body: '<style>' } },
    { typography: { body: '"unterminated' } },
    { foo: 1 },
  ])
    await assert.rejects(resolveConfig({ layers: layers(value) }), /input-0.json/);
  await assert.rejects(resolveConfig({ capabilities: { detail: ['compact'] } }), /unsupported/);
  await assert.rejects(resolveConfig({ layers: layers({ preset: 'unknown' }) }), /preset-file/);
  await resolveConfig({
    layers: layers({
      typography: { body: '"A Font", Georgia, serif', mono: "'Local Mono', monospace" },
    }),
  });
});
test('A02: data-only third preset, duplicate ids and complete theme validation', async () => {
  const p = JSON.parse(
      await readFile('skill/crafted-figures/assets/presets/editorial.json', 'utf8'),
    ),
    dir = await tempDir('cf-preset-'),
    file = path.join(dir, 'third.json');
  p.id = 'laboratory';
  p.defaults.accent = '#008870';
  await writeFile(file, JSON.stringify(p));
  const presets = await loadPresets([file]),
    { config, tokens } = await resolveConfig({ presets, layers: layers({ preset: 'laboratory' }) });
  assert.equal(config.accent, '#008870');
  assert.equal(tokens.accent, '#008870');
  await assert.rejects(loadPresets([file, file]), /duplicate/);
  p.id = 'technical';
  await writeFile(file, JSON.stringify(p));
  await assert.rejects(loadPresets([file]), /duplicate/);
  p.id = 'third';
  delete p.themes.dark.halo;
  await writeFile(file, JSON.stringify(p));
  await assert.rejects(loadPresets([file]), /halo/);
  p.themes.dark.halo = '#000000';
  p.themes.dark.unknown = '#ffffff';
  await writeFile(file, JSON.stringify(p));
  await assert.rejects(loadPresets([file]), /unknown/);
});
test('A01: local font families accept quoted commas and Unicode without accepting CSS expressions', async () => {
  for (const body of [
    '"AT&T, Serif", Georgia, serif',
    '"源ノ角ゴシック", sans-serif',
    'Noto Sans 日本語, sans-serif',
    "'Local Font 2.0', ui-monospace",
    '  "A Font" , system-ui  ',
  ]) {
    const { config } = await resolveConfig({ layers: layers({ typography: { body } }) });
    assert.equal(config.typography.body, body);
  }
  for (const body of [
    'serif,',
    'serif,,sans-serif',
    '"", serif',
    '"A Font" sans-serif',
    '123Font, serif',
    'A /* comment */, serif',
    'var(--font), serif',
    'url(https://x), serif',
    '"A;B", serif',
    '"A\u0085B", serif',
    '"A<B", serif',
  ])
    await assert.rejects(
      resolveConfig({ layers: layers({ typography: { body } }) }),
      /typography\/body/,
    );
});

test('v2 custom preset and material files preserve models and reject unknown/unsafe data', async () => {
  const { loadMaterials } = await import('../skill/crafted-figures/kit/config.mjs'),
    { builtInMaterials } = await import('../skill/crafted-figures/kit/materials.mjs');
  const dir = await tempDir('cf-v2-config-'),
    preset = JSON.parse(
      await readFile('skill/crafted-figures/assets/presets/editorial.json', 'utf8'),
    ),
    material = structuredClone(builtInMaterials.copper);
  preset.schemaVersion = 2;
  preset.id = 'laboratory-v2';
  preset.defaults = {
    ...preset.defaults,
    detail: 'detailed',
    materials: { overrides: { subject: 'oxidized' } },
  };
  material.id = 'oxidized';
  material.themes.light.top = '#aaccbb';
  const p = path.join(dir, 'preset.json'),
    m = path.join(dir, 'material.json');
  await writeFile(p, JSON.stringify(preset));
  await writeFile(m, JSON.stringify(material));
  const presets = await loadPresets([p]),
    materials = await loadMaterials([m]),
    capabilities = { detail: ['detailed'], materials: { subject: 'steel' } };
  const { config, tokens } = await resolveConfig({
    presets,
    materials,
    capabilities,
    layers: layers({ schemaVersion: 2, preset: 'laboratory-v2' }),
  });
  assert.equal(config.materials.overrides.subject, 'oxidized');
  assert.equal(tokens['material-oxidized-top'], '#aaccbb');
  await assert.rejects(loadMaterials([m, m]), /duplicate/);
  material.themes.light.top = 'url(https://invalid)';
  await writeFile(m, JSON.stringify(material));
  await assert.rejects(loadMaterials([m]), /top/);
  await assert.rejects(
    resolveConfig({
      presets,
      materials,
      capabilities,
      layers: layers({ schemaVersion: 1, preset: 'laboratory-v2' }),
    }),
    /schemaVersion|additional|detail|materials/,
  );
});
