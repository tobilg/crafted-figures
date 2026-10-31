import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { runtimeIdentity } from '../skill/crafted-figures/kit/provenance.mjs';
import { captureCrop, sampleStates } from '../skill/crafted-figures/kit/capture.mjs';
import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';
import { drive } from '../skill/crafted-figures/kit/drive.mjs';
import { inspectEffects } from '../skill/crafted-figures/kit/effect-checks.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const out = 'out/reports/gap-closure';
await mkdir(out, { recursive: true });
const report = {
  schemaVersion: 1,
  ...(await runtimeIdentity()),
  status: 'running',
  cases: [],
  errors: [],
  environment: { node: process.version, platform: process.platform },
};
let browser;
const open = async (page, dir) => {
  await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
  await page.locator('[data-ready=true]').waitFor();
};
try {
  browser = await chromium.launch();
  report.environment.browser = browser.version();
  for (const preset of ['technical', 'editorial'])
    for (const theme of ['light', 'dark'])
      for (const camera of [
        { azimuth: 45, elevation: 30 },
        { azimuth: 35, elevation: 30 },
        { azimuth: 45, elevation: 44 },
      ]) {
        const name = `construction-${preset}-${theme}-${camera.azimuth}-${camera.elevation}`,
          dir = `${out}/${name}`;
        await buildFigure({
          entry: 'examples/construction-details/figure.mjs',
          config: 'examples/construction-details/figure.config.json',
          out: dir,
          overrides: { preset, theme, camera },
        });
        for (const width of [390, 960]) {
          const page = await browser.newPage({
            viewport: { width, height: 1000 },
            reducedMotion: 'reduce',
          });
          page.on('pageerror', e => report.errors.push(e.message));
          await open(page, dir);
          const poses = [];
          for (const turnDeg of [0, 8, 16]) {
            const result = await page.locator('[data-figure]').evaluate((root, turnDeg) => {
              root.__craftedController.setState({ turnDeg }, { immediate: true });
              return root.__stage.inspectOrder(root, { columns: 64, rows: 48, tones: true });
            }, turnDeg);
            assert.equal(
              result.status,
              'passed',
              `${name}/${width}/${turnDeg}: ${JSON.stringify(result.findings.slice(0, 6))}`,
            );
            assert.ok(result.toneSamples > 0);
            poses.push({ turnDeg, ...result });
          }
          await page
            .locator('[data-figure]')
            .evaluate(root =>
              root.__craftedController.setState({ turnDeg: 8 }, { immediate: true }),
            );
          const overflow = await page.locator('[data-part=static-readout]').evaluate(el => {
            const b = el.getBBox(),
              s = el.ownerSVGElement.viewBox.baseVal;
            return b.x < 0 || b.x + b.width > s.width;
          });
          assert.equal(overflow, false, 'Readout must fit its viewBox');
          await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
          if (
            width === 960 &&
            preset === 'technical' &&
            camera.azimuth === 45 &&
            camera.elevation === 30
          )
            await captureCrop(
              page,
              { region: [0.1, 0.15, 0.8, 0.65], scale: 4 },
              `${out}/${name}-4x.png`,
            );
          report.cases.push({ kind: 'construction-matrix', preset, theme, camera, width, poses });
          await page.close();
        }
      }
  const dir = `${out}/faults`;
  await buildFigure({
    entry: 'examples/dial-indicator/figure.mjs',
    out: dir,
    overrides: { motion: { enabled: false } },
  });
  const page = await browser.newPage({
    viewport: { width: 960, height: 1000 },
    reducedMotion: 'reduce',
  });
  await open(page, dir);
  const faults = await page.locator('[data-figure]').evaluate(root => {
    const s = root.__stage,
      group = root.querySelector('[data-scene]'),
      extra = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    extra.dataset.object = 'unsupported-extra';
    extra.innerHTML = '<path fill="red" d="M0 0H100V100H0Z"/>';
    group.append(extra);
    const excess = s.inspectOrder(root);
    extra.remove();
    const faces = [...group.querySelectorAll('path.top,path[class^="side-"]')],
      saved = faces.map(p => p.getAttribute('class'));
    for (const p of faces) p.setAttribute('class', 'side-3');
    const tones = s.inspectOrder(root, { tones: true });
    faces.forEach((p, i) => {
      p.setAttribute('class', saved[i]);
    });
    return { excess, tones };
  });
  assert.ok(faults.excess.findings.some(f => f.code === 'SVG_EXCESS'));
  assert.ok(faults.tones.findings.some(f => f.code === 'SURFACE_TONE'));
  report.cases.push({ kind: 'fidelity-known-faults', ...faults });
  await page.locator('[data-figure]').evaluate(root => {
    const s = root.__stage,
      update = s.update;
    s.update = state => {
      const result = update(state);
      s.scene.getObjectByName('gauge').visible = state.displacementMm < 1;
      return result;
    };
  });
  const visibility = await sampleStates(
    page,
    {
      name: 'known-visibility',
      states: [{ displacementMm: 0 }, { displacementMm: 1 }],
      visibility: true,
    },
    out,
  );
  assert.ok(visibility.findings.some(f => f.code === 'VISIBILITY_POP'));
  report.cases.push({ kind: 'visibility-fault', findings: visibility.findings });
  await page.close();
  for (const paper of ['a4', 'letter']) {
    const base = '../../../examples/dial-indicator/figure.mjs';
    await writeFile(
      `${out}/static.mjs`,
      `import figure from ${JSON.stringify(base)};export default {...figure,clientEntry:undefined};\n`,
    );
    await writeFile(
      `${out}/static-sheet.mjs`,
      `export default ${JSON.stringify({ schemaVersion: 1, figure: 'static.mjs', title: 'Static model poses and crowded pins', maxPages: 2, views: { main: { pose: 'mid', crop: [0, 0, 600, 400] } }, parts: ['base', 'gauge', 'arm'].map(id => ({ id, label: id, description: 'Visible model part', pin: [300, 1] })), steps: [] })};\n`,
    );
    const result = await printSheet({
      spec: `${out}/static-sheet.mjs`,
      paper,
      out: `${out}/print-${paper}`,
      png: true,
    });
    assert.deepEqual(result.manifest.formats.poster.views.main.state, { displacementMm: 5 });
    assert.equal(result.manifest.formats.poster.views.main.readout, '5.00 mm');
    const p = await browser.newPage();
    await p.goto(pathToFileURL(path.resolve(`${out}/print-${paper}/poster-${paper}.html`)).href);
    const pins = await p.locator('[data-print-pin] circle').evaluateAll(els =>
      els.map(e => ({
        x: +e.getAttribute('cx'),
        y: +e.getAttribute('cy'),
        r: +e.getAttribute('r'),
      })),
    );
    assert.equal(pins.length, 3);
    for (let i = 0; i < pins.length; i++)
      for (let j = i + 1; j < pins.length; j++)
        assert.ok(Math.hypot(pins[i].x - pins[j].x, pins[i].y - pins[j].y) > pins[i].r + pins[j].r);
    await p.close();
    report.cases.push({ kind: 'static-print-pins', paper, pins, manifest: result.manifest });
  }
  await browser.close();
  browser = null;
  const fxDir = `${out}/effect-probe`;
  await buildFigure({
    entry: 'tests/fixtures/effect-depth-figure.mjs',
    out: fxDir,
    overrides: { schemaVersion: 2, motion: { enabled: false } },
  });
  const actions = {
    schemaVersion: 1,
    reducedMotion: true,
    actions: [
      { type: 'move', selector: 'svg.crafted', to: [0.5, 0.5] },
      { type: 'time', value: 0 },
      { type: 'effects', landmarks: [{ effect: 'marker', visibility: 'hidden' }] },
      { type: 'time', value: 2 },
      { type: 'effects', boundaries: true, landmarks: [{ effect: 'marker' }] },
      { type: 'playback', name: 'slow', from: 1.8, to: 2, rate: 0.25, fps: 5, maxStep: 40 },
      { type: 'contextLoss', requiredFallbacks: ['marker'] },
      { type: 'time', value: 1 },
      { type: 'wait', state: { time: 1 } },
      { type: 'dispose' },
    ],
  };
  await writeFile(`${out}/effect-actions.json`, JSON.stringify(actions));
  const driven = await drive({
    dir: fxDir,
    actions: `${out}/effect-actions.json`,
    report: `${out}/drive`,
  });
  assert.equal(driven.status, 'passed', JSON.stringify(driven.errors));
  report.cases.push({ kind: 'generic-effects-playback', actions: driven.actions });
  for (const theme of ['light', 'dark'])
    for (const webgl of [true, false]) {
      const dir = `${out}/particles-${theme}`;
      await buildFigure({
        entry: 'examples/turning-mechanism/figure.mjs',
        config: 'examples/turning-mechanism/figure.config.json',
        state: 'mid',
        out: dir,
        overrides: { theme },
      });
      const required = ['lamp', 'light-pool', 'spark-0', 'spark-1', 'spark-2', 'spark-3'],
        actions = {
          schemaVersion: 1,
          webgl,
          reducedMotion: true,
          actions: [
            { type: 'time', value: 2 },
            ...(webgl
              ? [{ type: 'contextLoss', requiredFallbacks: required }]
              : [{ type: 'effects', mode: 'vector', requiredFallbacks: required }]),
            { type: 'capture', name: 'vector-particles' },
            { type: 'time', value: 6 },
            { type: 'wait', state: { time: 6 } },
            { type: 'dispose' },
          ],
        };
      await writeFile(`${out}/particles-actions.json`, JSON.stringify(actions));
      const result = await drive({
        dir,
        actions: `${out}/particles-actions.json`,
        report: `${out}/particles-${theme}-${webgl}`,
      });
      assert.equal(result.status, 'passed', JSON.stringify(result.errors));
      const svg = await readFile(`${dir}/figure.svg`, 'utf8');
      for (const id of required) assert.ok(svg.includes(`data-effect-fallback="${id}"`));
      report.cases.push({ kind: 'particle-fallback', theme, webgl, actions: result.actions });
    }
  browser = await chromium.launch();
  const p = await browser.newPage();
  await open(p, fxDir);
  const _bad = await p.locator('[data-figure]').evaluate(root => {
    root.__craftedController.setTime(2);
    root.__effects.canvases[0].style.transform = 'translateX(3px)';
  });
  const result = await inspectEffects(p, { landmarks: [{ effect: 'marker' }] });
  assert.ok(result.findings.some(f => f.code === 'EFFECT_REGISTRATION'));
  assert.ok(result.findings.some(f => f.code === 'EFFECT_GPU_REGISTRATION'));
  report.cases.push({ kind: 'effect-registration-fault', ...result });
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.cases.length, report.errors);
}
