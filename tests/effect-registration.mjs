import { runBrowserReport } from './report.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir = 'out/reports/effect-registration';
await mkdir(dir, { recursive: true });
const report = { status: 'running', cases: [], errors: [], environment: { node: process.version } };
await runBrowserReport(dir, report, async browser => {
  for (const theme of ['light', 'dark']) {
    await buildFigure({
      entry: 'tests/fixtures/effect-depth-figure.mjs',
      out: `${dir}/${theme}`,
      overrides: { schemaVersion: 2, theme, output: 'both', motion: { enabled: false } },
    });
    for (const width of [390, 960])
      for (const dpr of [1, 2]) {
        const page = await browser.newPage({
          viewport: { width, height: 850 },
          deviceScaleFactor: dpr,
        });
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto(pathToFileURL(path.resolve(dir, theme, 'figure.html')).href);
        await page.locator('[data-ready=true]').waitFor();
        const samples = [];
        for (let i = 0; i <= 24; i++) {
          const value = await page.locator('[data-figure]').evaluate((root, time) => {
            root.__craftedController.setState({ time }, { immediate: true });
            root.__effects.render(time);
            const canvas = root.__effects.canvases[0],
              gl = canvas.getContext('webgl2'),
              w = gl.drawingBufferWidth,
              h = gl.drawingBufferHeight,
              pixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            let total = 0,
              xsum = 0,
              ysum = 0,
              count = 0;
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) {
                const a = pixels[(y * w + x) * 4 + 3];
                if (a > 4) {
                  total += a;
                  xsum += (x + 0.5) * a;
                  ysum += (h - y - 0.5) * a;
                  count++;
                }
              }
            const s = root.__stage,
              point = s.renderer.project(
                s.marker.getWorldPosition(s.marker.position.clone()),
                s.camera,
              ),
              r = canvas.getBoundingClientRect();
            return {
              time,
              count,
              alpha: total,
              expected: [(point[0] * r.width) / s.width, (point[1] * r.height) / s.height],
              actual: total
                ? [((xsum / total) * r.width) / w, ((ysum / total) * r.height) / h]
                : null,
            };
          }, i / 12);
          samples.push(value);
        }
        assert.equal(samples[0].count, 0, 'behind support must have zero effect pixels');
        assert.ok(samples.at(-1).count > 50, 'front marker must render');
        const last = samples.at(-1),
          error = Math.hypot(last.expected[0] - last.actual[0], last.expected[1] - last.actual[1]);
        assert.ok(error <= 0.5, `GPU registration ${error}`);
        assert.ok(
          samples.some(p => p.count > 0 && p.count < last.count * 0.8),
          'crossing boundary samples must be partially visible',
        );
        // Deliberate CSS placement fault: independent canvas placement must detect it.
        const fault = await page.locator('[data-figure]').evaluate(root => {
          const svg = root.querySelector('svg').getBoundingClientRect(),
            c = root.__effects.canvases[0];
          c.style.transform = 'translateX(2px)';
          const r = c.getBoundingClientRect();
          return Math.abs(r.left - svg.left);
        });
        assert.ok(fault > 0.5);
        await page.locator('[data-figure]').evaluate(root => {
          root.__effects.canvases[0].style.transform = '';
          root.__craftedController.setState({ time: 0.75 }, { immediate: true });
        });
        await page.screenshot({ path: `${dir}/${theme}-${width}-${dpr}.png`, fullPage: true });
        report.cases.push({ theme, width, dpr, error, samples, registrationFaultDetected: fault });
        await page.close();
      }
  }
});
