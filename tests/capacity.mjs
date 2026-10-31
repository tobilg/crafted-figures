import { performance } from 'node:perf_hooks';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { resolveConfig, readJSON } from '../skill/crafted-figures/kit/config.mjs';
import { auditScene } from '../skill/crafted-figures/kit/audit/geometry.mjs';
import * as kit from '../skill/crafted-figures/kit/index.mjs';
import { chromium } from 'playwright';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const out = 'out/reports/capacity';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  timingBudget: { enforced: false, reason: 'User deferred diagnostic budget' },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    cpuThrottling: 1,
  },
  workloads: [],
  errors: [],
};
let browser;
try {
  browser = await chromium.launch();
  report.environment.browser = browser.version();
  for (const [name, key, max] of [
    ['dial-indicator', 'displacementMm', 10],
    ['dense-cutaway', null, 0],
    ['dense-rack', 'time', 3],
  ]) {
    const dir = `out/capacity/${name}`,
      timings = [];
    for (let i = 0; i < 2; i++) {
      const start = performance.now();
      await buildFigure({
        entry: `examples/${name}/figure.mjs`,
        config: `examples/${name}/figure.config.json`,
        state: key ? 'mid' : 'rest',
        out: dir,
        overrides: { output: 'both', motion: { enabled: false } },
      });
      timings.push(performance.now() - start);
    }
    const figure = (await import(pathToFileURL(path.resolve(`examples/${name}/figure.mjs`)).href))
        .default,
      { config, tokens } = await resolveConfig({
        layers: [
          { label: 'fixture', value: await readJSON(`examples/${name}/figure.config.json`) },
        ],
        capabilities: figure.capabilities,
      });
    const create =
      figure.createScene || (await import('../examples/dial-indicator/scene.mjs')).createDial;
    const stage = create({ kit, config, tokens });
    stage.update(figure.poses[key ? 'mid' : 'rest']);
    let solids = 0,
      triangles = 0,
      routes = 0,
      routePieces = 0;
    const transforms = new Map();
    stage.scene.traverseVisible(o => {
      if (o.userData.route) routes++;
      if (o.isMesh && !o.userData.craftedEffect) {
        solids++;
        triangles += (o.geometry.index?.count || o.geometry.getAttribute('position').count) / 3;
        if (o.parent?.userData.route) routePieces++;
        transforms.set(o.name, o.matrixWorld.clone());
      }
    });
    stage.scene.updateMatrixWorld(true);
    transforms.clear();
    stage.scene.traverseVisible(o => {
      if (o.isMesh || o.isGroup) transforms.set(o.name, o.matrixWorld.clone());
    });
    stage.update(figure.poses.rest);
    stage.scene.updateMatrixWorld(true);
    let movingParts = 0,
      movingGroups = 0;
    stage.scene.traverse(o => {
      if (transforms.has(o.name) && !o.matrixWorld.equals(transforms.get(o.name))) {
        if (o.isMesh) movingParts++;
        if (o.isGroup) movingGroups++;
      }
    });
    // Full actual-mesh coverage and route quality; focused clearance pair for the
    // benchmark (functional collision envelopes belong to the geometry suites).
    const names = [];
    stage.scene.traverse(o => {
      if (o.isMesh) names.push(o.name);
    });
    const auditStart = performance.now(),
      audit = auditScene(stage, {
        clearanceScope: 'declared',
        clearances: [{ a: names[0], b: names[1] }],
      });
    const auditMs = performance.now() - auditStart;
    assert.equal(audit.status, 'passed', JSON.stringify(audit.findings));
    stage.dispose();
    const page = await browser.newPage({
      viewport: { width: 960, height: 850 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
    if (key) await page.locator('[data-ready=true]').waitFor();
    const result = await page.locator('[data-figure]').evaluate(
      async (root, { key, max }) => {
        const c = root.__craftedController,
          stats = () => ({
            nodes: root.querySelectorAll('svg *').length,
            canvases: root.querySelectorAll('canvas').length,
            heap: performance.memory?.usedJSHeapSize,
            scheduled: c?.getStats?.(),
          });
        const before = stats(),
          latency = [],
          frames = [];
        let writes = 0;
        const observer = new MutationObserver(records => (writes += records.length));
        observer.observe(root, {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        });
        for (let i = 0; i < 64; i++) {
          const start = performance.now();
          if (c) {
            const input = root.querySelector('input[type=range]');
            input.value = String(max * (0.5 + 0.45 * Math.sin(i * 0.2)));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (Math.abs(c.getState()[key] - Number(input.value)) > 1e-8)
              throw new Error('Input and displayed state differ');
          }
          latency.push(performance.now() - start);
          await new Promise(requestAnimationFrame);
          frames.push(performance.now() - start);
        }
        await Promise.resolve();
        observer.disconnect();
        const after = stats(),
          sort = x => [...x].sort((a, b) => a - b),
          lat = sort(latency),
          fr = sort(frames);
        const probe = document.createElement('canvas'),
          gl = probe.getContext('webgl2'),
          ext = gl?.getExtension('WEBGL_debug_renderer_info'),
          gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        const settledFrames = c?.getStats?.();
        c?.dispose();
        return {
          before,
          after,
          writes,
          latency: { median: lat[32], p95: lat[60] },
          frameTime: {
            median: fr[32],
            p95: fr[60],
            definition: 'synchronous state update plus wait to next animation frame',
          },
          gpu,
          settledFrames,
          cleanup: {
            registered: !!root.__craftedController,
            canvases: root.querySelectorAll('canvas').length,
            pending: root.__motion?.stats.pending || false,
          },
          samples: 64,
          latencyDefinition:
            'Native range input event dispatch through immediate displayed state and SVG update',
        };
      },
      { key, max },
    );
    assert.equal(result.cleanup.registered, false);
    assert.equal(result.cleanup.canvases, 0);
    assert.equal(result.cleanup.pending, false);
    if (key) assert.equal(result.after.scheduled.pending, false);
    assert.ok(Number.isFinite(result.latency.p95));
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    report.workloads.push({
      name,
      viewport: { width: 960, height: 850 },
      dpr: 2,
      solids,
      triangles,
      routes,
      routePieces,
      movingParts,
      movingGroups,
      effectPasses: 0,
      audit: {
        ms: auditMs,
        status: audit.status,
        coverage: audit.coverage,
        findings: audit.findings,
        scope: 'All drawing/route checks; focused clearance pair, not full collision acceptance',
      },
      buildMs: { cold: timings[0], warm: timings[1] },
      htmlBytes: (await stat(path.join(dir, 'figure.html'))).size,
      svgBytes: (await stat(path.join(dir, 'figure.svg'))).size,
      ...result,
    });
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.errors);
}
