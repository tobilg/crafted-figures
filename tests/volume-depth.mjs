import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = 'out/reports/volume-depth';
await mkdir(out, { recursive: true });
const report = { status: 'running', cases: [], errors: [], environment: { node: process.version } };
let browser;
try {
  browser = await chromium.launch();
  report.environment.browser = browser.version();
  for (const theme of ['light', 'dark']) {
    const dir = `${out}/${theme}`;
    await buildFigure({
      entry: 'tests/fixtures/volume-depth-figure.mjs',
      out: dir,
      overrides: { schemaVersion: 2, theme, motion: { enabled: false } },
    });
    for (const width of [390, 960]) {
      const page = await browser.newPage({
        viewport: { width, height: 850 },
        deviceScaleFactor: 2,
      });
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
      await page.locator('[data-ready=true]').waitFor();
      const samples = [];
      for (let i = 0; i <= 32; i++) {
        const value = await page.locator('[data-figure]').evaluate((root, time) => {
          root.__craftedController.setState({ time }, { immediate: true });
          root.__effects.render(0);
          const canvas = root.__effects.canvases[0],
            gl = canvas.getContext('webgl2'),
            w = gl.drawingBufferWidth,
            h = gl.drawingBufferHeight,
            pixels = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let alpha = 0,
            count = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            alpha += pixels[i];
            if (pixels[i] > 0) count++;
          }
          return { time, alpha, count, mode: root.__effects.stats.mode };
        }, i / 16);
        samples.push(value);
      }
      assert.equal(samples[0].alpha, 0);
      assert.ok(samples.at(-1).alpha > 1000);
      assert.ok(
        samples.some(s => s.alpha > 0 && s.alpha < samples.at(-1).alpha * 0.8),
        'depth integration must retain a partially exposed volume',
      );
      assert.ok(samples.every(s => s.mode === 'webgl'));
      await page.screenshot({ path: `${out}/${theme}-${width}.png`, fullPage: true });
      report.cases.push({
        theme,
        kind: theme === 'light' ? 'fire' : 'steam',
        width,
        dpr: 2,
        samples,
      });
      await page.close();
    }
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
