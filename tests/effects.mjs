import { runBrowserReport } from './report.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const out = 'out/reports/production-effects';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  environment: { node: process.version, platform: process.platform },
  cases: [],
  errors: [],
};
await runBrowserReport(out, report, async browser => {
  for (const name of ['exploded-assembly', 'ripple-tank', 'turning-mechanism'])
    for (const theme of ['light', 'dark']) {
      const dir = `out/effects/${name}-${theme}`;
      await buildFigure({
        entry: `examples/${name}/figure.mjs`,
        config: `examples/${name}/figure.config.json`,
        out: dir,
        state: 'mid',
        overrides: { theme },
      });
      for (const width of [390, 960]) {
        const page = await browser.newPage({
          viewport: { width, height: 950 },
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
        });
        page.on('pageerror', e => report.errors.push(`${name}: ${e.message}`));
        page.on('console', m => {
          if (m.type() === 'error') report.errors.push(`${name}: ${m.text()}`);
        });
        page.on('request', r => {
          if (/^https?:/.test(r.url())) report.errors.push(r.url());
        });
        await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
        await page.locator('[data-ready=true]').waitFor();
        const points =
          name === 'exploded-assembly'
            ? [0, 0.28, 0.65, 0.72, 1.4, 2.2, 3.5, 4, 5, 7]
            : name === 'turning-mechanism'
              ? [0, 1.4, 2, 2.99, 3, 3.01, 4, 5, 6]
              : [0, 1, 2, 3, 4, 5, 6];
        for (const time of points) {
          const result = await page.locator('[data-figure]').evaluate((el, time) => {
            el.__craftedController.setTime(time);
            const fx = el.__effects;
            fx.render(time);
            const pixels = fx.canvases.map(canvas => {
              const gl = canvas.getContext('webgl2'),
                w = gl.drawingBufferWidth,
                h = gl.drawingBufferHeight,
                bytes = new Uint8Array(w * h * 4);
              gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
              let alpha = 0;
              for (let i = 3; i < bytes.length; i += 4) alpha += bytes[i];
              return { width: w, height: h, alpha };
            });
            const rect = el.querySelector('svg').getBoundingClientRect();
            return {
              state: el.__craftedController.getState(),
              readout: el.querySelector('[data-live-readout]').textContent,
              stats: { ...fx.stats },
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              pixels,
            };
          }, time);
          assert.equal(result.state.time, time);
          assert.equal(result.stats.mode, 'webgl', JSON.stringify(result.stats));
          assert.equal(result.stats.canvases, 2);
          assert.ok(result.pixels.every(p => Math.abs(p.width / result.rect.width - 1.5) < 0.01));
          report.cases.push({ name, theme, width, time, ...result });
        }
        if (name === 'ripple-tank') {
          const interleaved = await page.locator('[data-figure]').evaluate(el => {
            const svg = el.querySelector('svg.crafted').getBoundingClientRect(),
              passes = [...el.querySelectorAll('[data-effect-layer],[data-vector-layer]')].map(
                p => ({
                  kind: p.tagName,
                  layer: p.dataset.effectLayer ?? p.dataset.vectorLayer,
                  registration: Math.max(
                    Math.abs(p.getBoundingClientRect().left - svg.left),
                    Math.abs(p.getBoundingClientRect().top - svg.top),
                    Math.abs(p.getBoundingClientRect().width - svg.width),
                    Math.abs(p.getBoundingClientRect().height - svg.height),
                  ),
                }),
              );
            return {
              passes,
              order: el.__stage.inspectOrder(el),
              ids: [...el.querySelectorAll('[id]')].map(e => e.id),
            };
          });
          assert.deepEqual(
            interleaved.passes.map(p => [p.kind, p.layer]),
            [
              ['CANVAS', '0'],
              ['svg', '0'],
              ['CANVAS', '1'],
              ['svg', '1'],
            ],
          );
          assert.ok(interleaved.passes.every(p => p.registration <= 0.5));
          assert.equal(interleaved.order.status, 'passed', JSON.stringify(interleaved.order));
          assert.equal(new Set(interleaved.ids).size, interleaved.ids.length);
          report.cases.push({ name, theme, width, interleaved });
        }
        await page.locator('[data-figure]').evaluate(el => el.__craftedController.setTime(3));
        await page.screenshot({ path: `${out}/${name}-${theme}-${width}.png`, fullPage: true });
        // Real context loss must preserve controls and show the static effect symbols.
        await page
          .locator('[data-figure]')
          .evaluate(el =>
            el.__effects.canvases[0]
              .getContext('webgl2')
              .getExtension('WEBGL_lose_context')
              .loseContext(),
          );
        await page.waitForFunction(
          () => document.querySelector('[data-figure]').__effects.stats.mode === 'vector',
        );
        const fallback = await page.locator('[data-figure]').evaluate(el => {
          el.__craftedController.setState({ time: 1 }, { immediate: true });
          return {
            state: el.__craftedController.getState(),
            stats: { ...el.__effects.stats },
            hidden: [...el.querySelectorAll('canvas')].every(c => c.hidden),
          };
        });
        assert.equal(fallback.state.time, 1);
        assert.equal(fallback.hidden, true);
        report.cases.push({ name, theme, width, contextLoss: fallback });
        const cleanup = await page.locator('[data-figure]').evaluate(el => {
          const c = el.__craftedController,
            fx = el.__effects;
          c.dispose();
          return {
            canvases: el.querySelectorAll('canvas').length,
            stats: { ...fx.stats },
            registered: !!el.__craftedController,
          };
        });
        assert.equal(cleanup.canvases, 0);
        assert.equal(cleanup.registered, false);
        await page.close();
      }
      const page = await browser.newPage({ viewport: { width: 390, height: 850 } });
      await page.addInitScript(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type.includes('webgl') ? null : get.call(this, type, ...args);
        };
      });
      await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
      await page.locator('[data-ready=true]').waitFor();
      const fallback = await page.locator('[data-figure]').evaluate(el => {
        el.__craftedController.setState({ time: 2 }, { immediate: true });
        return {
          mode: el.__effects.stats.mode,
          state: el.__craftedController.getState(),
          symbols: el.querySelectorAll('[data-effect-fallback]').length,
        };
      });
      assert.equal(fallback.mode, 'vector');
      assert.equal(fallback.state.time, 2);
      assert.ok(fallback.symbols > 0);
      await page.screenshot({ path: `${out}/${name}-${theme}-no-webgl.png`, fullPage: true });
      report.cases.push({ name, theme, initializationFallback: fallback });
      await page.close();
    }
});
