import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { runtimeIdentity } from '../skill/crafted-figures/kit/provenance.mjs';
import { launchBrowser } from '../skill/crafted-figures/kit/verify.mjs';
import { contactSheet, crop4 } from './images.mjs';
const out = path.resolve('out/reports/owned-renderer');
await mkdir(out, { recursive: true });
const report = {
  status: 'failed',
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  ...(await runtimeIdentity()),
  cases: [],
  errors: [],
  requests: [],
};
let browser;
try {
  report.packageManifestSHA256 = createHash('sha256')
    .update(await readFile('dist/crafted-figures/package-manifest.json'))
    .digest('hex');
  browser = await launchBrowser();
  report.environment.browser = browser.version();
  const screenshots = [];
  for (const preset of ['technical', 'editorial'])
    for (const theme of ['light', 'dark'])
      for (const detail of ['compact', 'standard']) {
        const name = `${preset}-${theme}-${detail}`,
          dir = path.resolve('out/sector-gauge/' + name);
        await buildFigure({
          entry: 'examples/sector-gauge/figure.mjs',
          config: 'examples/sector-gauge/figure.config.json',
          out: dir,
          overrides: { preset, theme, detail, output: 'both' },
        });
        const context = await browser.newContext({
            viewport: { width: detail === 'compact' ? 390 : 960, height: 850 },
            reducedMotion: 'reduce',
            offline: true,
          }),
          page = await context.newPage();
        page.on('pageerror', e => report.errors.push(e.message));
        page.on('console', m => {
          if (m.type() === 'error') report.errors.push(m.text());
        });
        page.on('request', r => {
          if (/^https?:/.test(r.url())) report.requests.push(r.url());
        });
        await page.goto(pathToFileURL(path.join(dir, 'figure.html')).href);
        const input = page.getByRole('slider', { name: 'Percentage' });
        await input.waitFor();
        assert.equal(await page.locator('[data-part=static-readout]').textContent(), '50%');
        for (const [key, reading, angle] of [
          ['Home', '0%', -120],
          ['End', '100%', 120],
          ['ArrowLeft', '99%', 117.6],
        ]) {
          await input.press(key);
          assert.equal(await page.locator('[data-live-readout]').textContent(), reading);
          assert.equal(
            Number(await page.locator('[data-part=needle]').getAttribute('data-angle')),
            angle,
          );
          assert.equal(
            await page.evaluate(() => document.querySelector('article').__motion.stats.pending),
            false,
          );
        }
        await page.getByRole('button', { name: 'Middle', exact: true }).click();
        assert.equal(await input.inputValue(), '50');
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        const file = path.join(out, name + '.png');
        await page.screenshot({ path: file, fullPage: true });
        screenshots.push(file);
        if (detail === 'standard') {
          const rect = await page.locator('[data-object=scale]').boundingBox(),
            scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
          await crop4(file, path.join(out, name + '-4x.png'), {
            x: Math.floor(rect.x + scroll.x),
            y: Math.floor(rect.y + scroll.y),
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
          });
        }
        const cleanup = await page.evaluate(() => {
          const root = document.querySelector('article'),
            stage = root.__stage,
            stats = root.__motion.stats;
          root.__craftedCleanup();
          root.__craftedCleanup();
          return {
            parts: stage.scene.children.length,
            pending: stats.pending,
            controls: root.querySelectorAll('input,button').length,
          };
        });
        assert.deepEqual(cleanup, { parts: 0, pending: false, controls: 0 });
        await context.close();
        report.cases.push({
          name,
          status: 'passed',
          checks: [
            'file/offline',
            'native keyboard endpoints',
            'shared readout/pointer',
            'reduced motion',
            'named pose',
            'responsive',
            'cleanup',
          ],
        });
      }
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true }),
    page = await context.newPage();
  await page.goto(
    pathToFileURL(path.resolve('out/sector-gauge/technical-light-standard/figure.html')).href,
  );
  assert.equal(await page.locator('[data-part=static-readout]').textContent(), '50%');
  assert.equal(await page.locator('input,button').count(), 0);
  assert.equal(await page.locator('[data-object=scale]').count(), 1);
  await context.close();
  report.cases.push({ name: 'no-javascript', status: 'passed' });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.requests, []);
  await contactSheet(screenshots, path.join(out, 'contact-sheet.png'), 4);
  report.status = 'passed';
} catch (e) {
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status}: ${out}`, report.error || '');
}
