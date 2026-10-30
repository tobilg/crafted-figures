import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const out = 'out/reports/materials';
await mkdir(out, { recursive: true });
const report = { status: 'running', cases: [], errors: [], environment: { node: process.version } };
let browser;
try {
  browser = await chromium.launch();
  report.environment.browser = browser.version();
  for (const preset of ['technical', 'editorial'])
    for (const theme of ['light', 'dark'])
      for (const [azimuth, elevation] of [
        [45, 30],
        [35, 30],
        [45, 44],
      ]) {
        const name = `${preset}-${theme}-${azimuth}-${elevation}`,
          dir = `out/materials/${name}`;
        await buildFigure({
          entry: 'examples/material-sheet/figure.mjs',
          config: 'examples/material-sheet/figure.config.json',
          out: dir,
          overrides: {
            schemaVersion: 2,
            preset,
            theme,
            camera: { azimuth, elevation },
            motion: { enabled: false },
          },
        });
        for (const width of [390, 960]) {
          const page = await browser.newPage({
            viewport: { width, height: 1100 },
            reducedMotion: 'reduce',
          });
          page.on('pageerror', e => report.errors.push(e.message));
          await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
          await page.locator('[data-ready=true]').waitFor();
          const angles = [];
          for (const turnDeg of [-30, 0, 30]) {
            const r = await page.locator('[data-figure]').evaluate((root, turnDeg) => {
              root.__craftedController.setState({ turnDeg }, { immediate: true });
              return {
                state: root.__craftedController.getState(),
                order: root.__stage.inspectOrder(root),
                ramp: new Set(
                  [...root.querySelectorAll('[data-object]')].map(e =>
                    getComputedStyle(e).getPropertyValue('--cf-top'),
                  ),
                ).size,
              };
            }, turnDeg);
            assert.equal(r.state.turnDeg, turnDeg);
            assert.equal(r.order.status, 'passed', JSON.stringify(r.order.findings.slice(0, 3)));
            assert.equal(r.ramp, 8);
            angles.push(r);
          }
          await page
            .locator('[data-figure]')
            .evaluate(root =>
              root.__craftedController.setState({ turnDeg: 0 }, { immediate: true }),
            );
          await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
          report.cases.push({ preset, theme, azimuth, elevation, width, angles });
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
