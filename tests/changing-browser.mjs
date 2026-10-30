import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const out = 'out/reports/changing-geometry';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  environment: { node: process.version, platform: process.platform },
  cases: [],
  errors: [],
};
let browser;
try {
  browser = await chromium.launch();
  report.environment.browser = browser.version();
  for (const [dir, key, values] of [
    ['spring', 'compression', [0, 3.5, 7, 10.5, 14, 7, 0]],
    ['merging', 'separation', [50, 40, 32, 30, 25, 15, 0, 30, 50]],
    ['assembly', 'time', [0, 0.2, 0.28, 0.65, 0.72, 1.4, 2.2, 3.5, 4, 5, 7]],
  ]) {
    const example = {
        spring: 'spring-probe',
        merging: 'merging-surfaces',
        assembly: 'exploded-assembly',
      }[dir],
      artifact = path.join(out, 'artifacts', dir);
    await buildFigure({
      entry: `examples/${example}/figure.mjs`,
      config: `examples/${example}/figure.config.json`,
      out: artifact,
    });
    const page = await browser.newPage({
      viewport: { width: 960, height: 950 },
      reducedMotion: 'reduce',
    });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(artifact, 'figure.html')).href);
    await page.locator('[data-ready=true]').waitFor();
    for (const value of values) {
      const actual = await page.locator('[data-figure]').evaluate(
        (el, { key, value }) => {
          el.__craftedController.setState({ [key]: value }, { immediate: true });
          const c = el.__craftedController;
          return {
            state: c.getState(),
            readout: el.querySelector('[data-live-readout]').textContent,
            stats: c.getStats(),
            effects: el.__effects?.stats,
            objects: el.querySelectorAll('[data-object]').length,
          };
        },
        { key, value },
      );
      assert.equal(actual.state[key], value);
      assert.equal(actual.stats.pending, false);
      assert.ok(actual.readout);
      if (actual.effects) assert.equal(actual.effects.mode, 'webgl');
      report.cases.push({ dir, value, ...actual });
    }
    await page.screenshot({ path: `${out}/${dir}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 850 });
    await page
      .locator('[data-figure]')
      .evaluate(
        (el, { key, value }) =>
          el.__craftedController.setState({ [key]: value }, { immediate: true }),
        { key, value: values[Math.floor(values.length / 2)] },
      );
    await page.screenshot({ path: `${out}/${dir}-mobile.png`, fullPage: true });
    const cleanup = await page.locator('[data-figure]').evaluate(el => {
      const fx = el.__effects,
        c = el.__craftedController;
      c.dispose();
      return {
        canvases: el.querySelectorAll('canvas').length,
        controls: el.querySelector('[data-controls]').children.length,
        registered: !!el.__craftedController,
        effects: fx?.stats,
      };
    });
    assert.equal(cleanup.canvases, 0);
    assert.equal(cleanup.controls, 0);
    assert.equal(cleanup.registered, false);
    report.cases.push({ dir, cleanup });
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
  console.log(report.status, report.cases.length, report.errors);
}
