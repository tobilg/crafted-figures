import { runBrowserReport } from './report.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { captureCrop } from '../skill/crafted-figures/kit/capture.mjs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = 'out/reports/spring-refinement';
await mkdir(out, { recursive: true });
const report = { status: 'running', environment: { node: process.version }, cases: [], errors: [] };
await runBrowserReport(out, report, async browser => {
  for (const theme of ['light', 'dark'])
    for (const elevation of [30, 44]) {
      const dir = path.resolve(out, `${theme}-${elevation}`);
      await buildFigure({
        entry: 'examples/spring-probe/figure.mjs',
        config: 'examples/spring-probe/figure.config.json',
        out: dir,
        overrides: { theme, camera: { elevation }, motion: { enabled: false } },
      });
      for (const width of [390, 960]) {
        const page = await browser.newPage({
          viewport: { width, height: 1000 },
          reducedMotion: 'reduce',
        });
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto(pathToFileURL(path.join(dir, 'figure.html')).href);
        await page.locator('[data-ready=true]').waitFor();
        for (const compression of [0, 7, 14]) {
          const result = await page.locator('[data-figure]').evaluate((root, compression) => {
            root.__craftedController.setState({ compression }, { immediate: true });
            return {
              state: root.__craftedController.getState(),
              readout: root.querySelector('[data-live-readout]').textContent,
              order: root.__stage.inspectOrder(root),
              pending: root.__motion.stats.pending,
            };
          }, compression);
          assert.equal(result.order.status, 'passed', JSON.stringify(result.order.findings));
          assert.equal(result.pending, false);
          assert.equal(
            result.readout,
            `${compression.toFixed(1)} mm compression · ${(compression * 2).toFixed(1)} N`,
          );
          report.cases.push({ theme, elevation, width, compression, ...result });
          if (width === 960)
            await captureCrop(
              page,
              { region: [0.35, 0.25, 0.3, 0.5], scale: 4 },
              path.join(out, `${theme}-${elevation}-${compression}-4x.png`),
            );
        }
        await page.screenshot({
          path: path.join(out, `${theme}-${elevation}-${width}.png`),
          fullPage: true,
        });
        await page.close();
      }
    }
});
