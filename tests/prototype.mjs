import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crop4, contactSheet } from './images.mjs';
import { poses } from '../experiments/three-hybrid/model.mjs';
const out = path.resolve('out/three-hybrid'),
  evidence = path.join(out, 'evidence');
await mkdir(evidence, { recursive: true });
const report = {
  status: 'failed',
  environment: {
    node: process.version,
    os: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    launchArgs: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
  targets: [],
  errors: [],
  warnings: [],
};
let browser;
// User explicitly deferred the diagnostic budget. Keep measuring P07 without
// treating a device-dependent timing result as a rendering-correctness failure.
report.performanceBudget = {
  status: 'deferred',
  referenceMs: 33,
  enforced: false,
  reason: 'User requested: skip the diagnostic budget for now and continue',
};
const record = (id, name, value, passed = true) =>
  report.targets.push({ id, name, status: passed ? 'passed' : 'failed', value });
async function open(theme, options = {}) {
  const context = await browser.newContext({ viewport: { width: 960, height: 1000 }, ...options });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') report.errors.push(m.text());
    else if (m.type() === 'warning') report.warnings.push(m.text());
  });
  await page.goto(pathToFileURL(path.join(out, theme + '.html')).href);
  await page.waitForFunction(() => !!window.__prototype);
  return { page, context };
}
// These views have a fixed viewport and explicitly settled poses. Capture their
// rectangle directly rather than adding locator actionability/RAF stability waits.
async function captureStage(page, file) {
  const clip = await page.locator('[data-stage]').boundingBox();
  assert.ok(clip && clip.width > 0 && clip.height > 0);
  await page.screenshot({ path: file, clip });
}
try {
  report.artifacts = Object.fromEntries(
    await Promise.all(
      ['light.html', 'dark.html'].map(async name => [
        name,
        createHash('sha256')
          .update(await readFile(path.join(out, name)))
          .digest('hex'),
      ]),
    ),
  );
  browser = await chromium.launch({ headless: true, args: report.environment.launchArgs });
  report.environment.browser = browser.version();
  for (const width of [390, 960])
    for (const dpr of [1, 2]) {
      const { page, context } = await open('light', {
        viewport: { width, height: 1000 },
        deviceScaleFactor: dpr,
      });
      assert.equal(
        await page.evaluate(() => window.__prototype.stats.webgl),
        true,
        'real WebGL required',
      );
      const points = await page.evaluate(() => window.__prototype.fiducials());
      const stats = await page.evaluate(() => window.__prototype.stats);
      await captureStage(page, path.join(evidence, `fiducials-${width}-dpr${dpr}.png`));
      record(
        'P01',
        `${width}px DPR${dpr}`,
        { points, stats },
        points.every(p => p.pixels > 0 && p.error <= 0.5),
      );
      await context.close();
    }
  for (const theme of ['light', 'dark']) {
    const { page, context } = await open(theme);
    report.environment.gpu = await page.evaluate(() => window.__prototype.gpuInfo());
    for (const [name, state] of Object.entries(poses).filter(([n]) => n !== 'rest')) {
      await page.evaluate(a => window.__prototype.pose(a), state.angleDeg);
      const measured = await page.evaluate(() => window.__prototype.occlusion());
      const correct =
        name === 'hidden'
          ? measured.visiblePixels === 0
          : name === 'partial'
            ? measured.visibleFraction > 0 && measured.visibleFraction < 1
            : measured.visibleFraction > 0.98;
      record('P02', `${theme}-${name}`, measured, correct && measured.opaqueLeaks === 0);
      const file = path.join(evidence, `${theme}-${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const stage = path.join(evidence, `${theme}-${name}-stage.png`);
      await captureStage(page, stage);
      const b = await page.locator('[data-stage]').boundingBox();
      await crop4(stage, path.join(evidence, `${theme}-${name}-occlusion-4x.png`), {
        x: Math.round(b.width * 0.28),
        y: Math.round(b.height * 0.1),
        width: Math.round(b.width * 0.32),
        height: Math.round(b.height * 0.6),
      });
    }
    const samples = [],
      files = [];
    for (const angle of [
      ...Array.from({ length: 24 }, (_, i) => i * 15),
      225,
      231,
      234,
      237,
      240,
      243,
      246,
      249,
      252,
      255,
    ]) {
      await page.evaluate(a => window.__prototype.pose(a), angle);
      const value = await page.evaluate(() => window.__prototype.occlusion());
      samples.push(value);
      const file = path.join(evidence, `${theme}-sample-${angle}.png`);
      await captureStage(page, file);
      files.push(file);
    }
    await contactSheet(files, path.join(evidence, `${theme}-contact-sheet.png`), 4);
    record(
      'P03',
      `${theme}: 24 evenly spaced + 10 boundary samples`,
      samples,
      samples.every(s => s.opaqueLeaks === 0),
    );
    await page.evaluate(() => window.__prototype.pose(90));
    const comparison = await page.evaluate(() => window.__prototype.stock());
    await writeFile(path.join(out, `stock-${theme}.svg`), comparison.svg);
    const fallback = await page.evaluate(() => window.__prototype.fallbackSVG());
    await writeFile(path.join(out, `fallback-${theme}.svg`), fallback);
    const custom = await page.evaluate(() => window.__prototype.snapshot());
    await writeFile(path.join(out, `custom-${theme}.svg`), custom);
    // Compare SVG solids only, at the same precision, background and rectangle.
    await page.evaluate(() => {
      document.querySelector('[data-stage] canvas').style.visibility = 'hidden';
    });
    await captureStage(page, path.join(evidence, `${theme}-custom.png`));
    await page.evaluate(svg => {
      document.querySelector('[data-stage]').innerHTML = svg;
    }, comparison.svg);
    await captureStage(page, path.join(evidence, `${theme}-stock.png`));
    record('P08', `${theme} comparison`, {
      stockNodes: comparison.nodes,
      stockFaces: comparison.faces,
      customBytes: Buffer.byteLength(custom),
      stockBytes: Buffer.byteLength(comparison.svg),
    });
    await context.close();
  }
  // Distinct disabled-WebGL and reduced-motion checks.
  const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 850 } });
  await fallbackContext.addInitScript(() => (window.__disableWebGL = true));
  const f = await fallbackContext.newPage();
  f.on('pageerror', e => report.errors.push(e.message));
  await f.goto(pathToFileURL(path.join(out, 'light.html')).href);
  await f.waitForFunction(() => !!window.__prototype);
  await f.locator('input').press('End');
  await f.waitForTimeout(500);
  const fallbackStats = await f.evaluate(() => window.__prototype.stats);
  await f.screenshot({ path: path.join(evidence, 'fallback-mobile.png'), fullPage: true });
  record(
    'P05',
    'WebGL disabled',
    { stats: fallbackStats, readout: await f.locator('output').textContent() },
    !fallbackStats.webgl &&
      fallbackStats.canvases === 0 &&
      (await f.locator('output').textContent()) === '360.0°',
  );
  await fallbackContext.close();
  const { page: reduced, context: reducedContext } = await open('dark', {
    reducedMotion: 'reduce',
  });
  await reduced.locator('input').press('Home');
  const reducedResult = await reduced.evaluate(() => ({
    reading: document.querySelector('output').textContent,
    stats: window.__prototype.stats,
  }));
  assert.equal(reducedResult.reading, '0.0°');
  assert.equal(reducedResult.stats.motion.pending, false);
  record('P05', 'Reduced motion', reducedResult);
  await reducedContext.close();
  // Exercise the actual controls at both widths, not only diagnostic pose setters.
  for (const width of [390, 960]) {
    const { page: controls, context: controlsContext } = await open('dark', {
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    const range = controls.getByLabel('Rotor angle (degrees)');
    for (const [key, angle] of [
      ['Home', 0],
      ['ArrowRight', 1],
      ['End', 360],
      ['ArrowLeft', 359],
    ]) {
      await range.press(key);
      assert.equal(await controls.locator('output').textContent(), `${angle.toFixed(1)}°`);
      assert.equal(await controls.evaluate(() => window.__prototype.state.angleDeg), angle);
    }
    for (const [name, state] of Object.entries(poses).filter(([name]) => name !== 'rest')) {
      await controls.locator(`[data-pose="${name}"]`).click();
      assert.equal(await controls.locator('output').textContent(), `${state.angleDeg.toFixed(1)}°`);
    }
    const rect = await controls.locator('[data-stage]').boundingBox();
    await controls.mouse.move(rect.x + rect.width * 0.25, rect.y + rect.height * 0.5);
    await controls.mouse.down();
    await controls.mouse.move(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5, { steps: 4 });
    await controls.mouse.up();
    const dragged = await controls.evaluate(() => ({
      angle: window.__prototype.state.angleDeg,
      reading: document.querySelector('output').textContent,
      pending: window.__prototype.stats.motion.pending,
    }));
    assert.ok(Math.abs(dragged.angle - 270) < 1);
    assert.equal(dragged.reading, `${dragged.angle.toFixed(1)}°`);
    assert.equal(dragged.pending, false);
    record('P05', `${width}px pointer, keyboard and named controls`, dragged);
    await controlsContext.close();
  }
  const { page: lost, context: lostContext } = await open('light');
  await lost.evaluate(() => {
    const extension = document
      .querySelector('canvas')
      .getContext('webgl2')
      .getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context loss test requires WEBGL_lose_context');
    extension.loseContext();
  });
  await lost.waitForFunction(() => window.__prototype.stats.webgl === false);
  await lost.locator('input').press('End');
  await lost.waitForFunction(() => document.querySelector('output').textContent === '360.0°');
  const lostStats = await lost.evaluate(() => window.__prototype.stats);
  assert.equal(lostStats.canvases, 0);
  assert.equal(lostStats.fallbackReason, 'WebGL context lost');
  await lost.screenshot({ path: path.join(evidence, 'context-loss-fallback.png'), fullPage: true });
  record('P05', 'Actual WebGL context loss retains working vector controls', lostStats);
  await lostContext.close();
  const { page, context } = await open('light');
  const cycles = [];
  for (let i = 0; i < 5; i++) {
    for (const width of [390, 960, 640, 960]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(60);
      const points = await page.evaluate(() => window.__prototype.fiducials());
      assert.ok(points.every(p => p.error <= 0.5));
      await page.evaluate(() => window.__prototype.restore());
    }
    await page.evaluate(() => window.__prototype.play());
    await page.waitForTimeout(80);
    const stats = await page.evaluate(() => {
      window.__prototype.dispose();
      return window.__prototype.stats;
    });
    cycles.push(stats);
    assert.equal(stats.motion.pending, false);
    assert.equal(stats.canvases, 0);
    assert.equal(stats.sceneChildren, 0);
    assert.equal(stats.gpuMemory.geometries, 0);
    assert.equal(stats.gpuMemory.textures, 0);
    await page.evaluate(() => {
      const input = document.querySelector('input');
      input.value = '99';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-pose]').click();
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(40);
    const after = await page.evaluate(() => window.__prototype.stats);
    assert.equal(after.renderCount, stats.renderCount);
    assert.equal(after.motion.pending, false);
    await page.evaluate(() => window.__remount());
  }
  record('P06', '20 resizes and 5 mount/dispose cycles', cycles);
  const unsupported = await page.evaluate(() => window.__prototype.unsupported());
  assert.match(unsupported, /Unsupported geometry/);
  record('P08', 'Unsupported mesh diagnostic', unsupported);
  await page.evaluate(() => window.__prototype.play());
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => window.__prototype.stats.motion.pending), false);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    document.body.style.paddingTop = '3000px';
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__prototype.stats.motion.pending), false);
  await page.evaluate(() => {
    document.body.style.paddingTop = '32px';
    window.__prototype.stop();
  });
  record('P06', 'hidden/offscreen scheduler stops', true);
  const perf = await page.evaluate(async () => {
    window.__prototype.play();
    const frames = [];
    await new Promise(resolve => {
      let start, last;
      function sample(t) {
        start ??= t;
        if (last !== undefined && t - start > 1000) frames.push(t - last);
        last = t;
        if (t - start < 11000) requestAnimationFrame(sample);
        else resolve();
      }
      requestAnimationFrame(sample);
    });
    window.__prototype.stop();
    frames.sort((a, b) => a - b);
    return {
      durationMs: 10000,
      warmupMs: 1000,
      samples: frames.length,
      medianMs: frames[Math.floor(frames.length * 0.5)],
      p95Ms: frames[Math.floor(frames.length * 0.95)],
      stats: window.__prototype.stats,
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
    };
  });
  perf.outputBytes = (await readFile(path.join(out, 'light.html'))).length;
  assert.ok(
    perf.samples > 0 && Number.isFinite(perf.medianMs) && Number.isFinite(perf.p95Ms),
    'P07 must still produce real measurements',
  );
  report.targets.push({
    id: 'P07',
    name: '10 seconds after warmup',
    status: 'measured',
    value: perf,
    budget: report.performanceBudget,
  });
  await context.close();
  // Visual inspection remains a separate recorded review, never an automatic baseline pass.
  record('P04', 'Full views and 4x crops generated', {
    review: 'See docs/three-prototype-report.md; screenshots require actual inspection.',
  });
  report.status =
    report.errors.length || report.targets.some(t => t.status === 'failed')
      ? 'targets-failed'
      : 'passed';
} catch (e) {
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (report.status !== 'passed') process.exitCode = 1;
  await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status}: ${evidence}/report.json`);
  if (report.errors.length) console.error(report.errors.join('\n'));
}
