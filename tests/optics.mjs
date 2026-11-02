import { runBrowserReport } from './report.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { captureCrop } from '../skill/crafted-figures/kit/capture.mjs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = 'out/reports/optics';
await mkdir(out, { recursive: true });
const report = { status: 'running', cases: [], errors: [], environment: { node: process.version } };
await runBrowserReport(out, report, async browser => {
  for (const theme of ['light', 'dark'])
    for (const [azimuth, elevation] of [
      [45, 30],
      [35, 30],
      [45, 44],
    ]) {
      const name = `${theme}-${azimuth}-${elevation}`,
        dir = `${out}/${name}`;
      await buildFigure({
        entry: 'examples/ripple-tank/figure.mjs',
        config: 'examples/ripple-tank/figure.config.json',
        out: dir,
        state: 'mid',
        overrides: { camera: { azimuth, elevation }, theme },
      });
      const page = await browser.newPage({
        viewport: { width: 960, height: 1000 },
        reducedMotion: 'reduce',
      });
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('console', m => {
        if (m.type() === 'error') report.errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
      await page.locator('[data-ready=true]').waitFor();
      const sample = async time =>
        page.locator('[data-figure]').evaluate((root, time) => {
          root.__craftedController.setTime(time);
          root.__effects.render(time);
          const s = root.__stage,
            water = s.scene.getObjectByName('water'),
            caustics = s.scene.getObjectByName('caustics'),
            hashes = root.__effects.canvases.map(canvas => {
              const gl = canvas.getContext('webgl2'),
                w = gl.drawingBufferWidth,
                h = gl.drawingBufferHeight,
                p = new Uint8Array(w * h * 4);
              gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, p);
              let hash = 2166136261,
                alpha = 0,
                colored = 0;
              for (let i = 0; i < p.length; i++) {
                hash = Math.imul(hash ^ p[i], 16777619);
                if (i % 4 === 3) {
                  alpha += p[i];
                  if (p[i] > 4) colored++;
                }
              }
              return { hash: hash >>> 0, alpha, colored };
            });
          const rect = root.querySelector('svg').getBoundingClientRect();
          return {
            time,
            state: root.__craftedController.getState(),
            history: water.material.uniforms.uHistory.value
              .slice(0, water.material.uniforms.uHistoryCount.value)
              .map(v => v.toArray()),
            causticHistory: caustics.material.uniforms.uHistory.value
              .slice(0, caustics.material.uniforms.uHistoryCount.value)
              .map(v => v.toArray()),
            view: water.material.uniforms.uViewLocal.value.toArray(),
            hashes,
            order: s.inspectOrder(root),
            registration: root.__effects.canvases.map(c =>
              Math.max(
                Math.abs(c.getBoundingClientRect().left - rect.left),
                Math.abs(c.getBoundingClientRect().top - rect.top),
              ),
            ),
          };
        }, time);
      const samples = [];
      for (const time of [0, 0.5, 1, 2, 3, 3.4999, 3.5, 4, 6]) {
        const r = await sample(time);
        assert.equal(r.state.time, time);
        assert.deepEqual(r.history, r.causticHistory);
        assert.ok(r.history.length <= 8);
        assert.ok(r.hashes[1].colored > 1000);
        assert.equal(r.order.status, 'passed', JSON.stringify(r.order.findings));
        assert.ok(r.registration.every(n => n <= 0.5));
        samples.push(r);
      }
      const repeat = await sample(3);
      assert.deepEqual(
        repeat.hashes,
        samples[4].hashes,
        'same pure model time must replay the same GPU pixels',
      );
      assert.notEqual(
        samples[2].hashes[1].hash,
        samples[4].hashes[1].hash,
        'water normals/refraction must change with wave history',
      );
      assert.ok(
        samples[4].hashes[0].colored > 1000,
        'receiving-plane light and shadow must render',
      );
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
      const crop = await captureCrop(
        page,
        { selector: '[data-figure] svg.crafted', region: [0.1, 0.22, 0.8, 0.6], scale: 4 },
        `${out}/${name}-4x.png`,
      );
      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-figure]'),
          s = root.querySelector('svg').getBoundingClientRect();
        return root.__effects.canvases.every(c => {
          const r = c.getBoundingClientRect();
          return (
            Math.abs(r.left - s.left) <= 0.5 &&
            Math.abs(r.top - s.top) <= 0.5 &&
            Math.abs(r.width - s.width) <= 0.5
          );
        });
      });
      const resized = await sample(3);
      assert.ok(resized.registration.every(n => n <= 0.5));
      await page.screenshot({ path: `${out}/${name}-390.png`, fullPage: true });
      report.cases.push({ theme, azimuth, elevation, samples, resized, crop });
      await page.close();
    }
});
