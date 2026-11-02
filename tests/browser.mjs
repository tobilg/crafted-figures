import { runReport, openBrowser } from './report.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { checkOutput } from '../skill/crafted-figures/kit/verify.mjs';
import { crop4 } from './images.mjs';
const root = path.resolve('out/reports/browser');
await mkdir(root, { recursive: true });
const report = {
  status: 'failed',
  environment: { node: process.version, platform: os.platform(), arch: os.arch() },
  checks: [],
  errors: [],
};
let browser;
const entry = 'examples/dial-indicator/figure.mjs';
async function built(name, overrides = {}, state = 'rest') {
  const out = path.resolve('out/browser/' + name);
  await buildFigure({ entry, out, state, overrides: { output: 'both', ...overrides } });
  return pathToFileURL(path.join(out, 'figure.html')).href;
}
await runReport(
  root,
  report,
  async () => {
    browser = await openBrowser(report);
    const matrix = [];
    for (const preset of ['technical', 'editorial'])
      for (const theme of ['light', 'dark']) {
        const url = await built(`${preset}-${theme}`, {
          preset,
          theme,
          motion: { enabled: false },
        });
        for (const width of [390, 960]) {
          const context = await browser.newContext({
              viewport: { width, height: 850 },
              deviceScaleFactor: 1,
            }),
            page = await context.newPage();
          page.on('pageerror', e => report.errors.push(e.message));
          page.on('console', m => {
            if (m.type() === 'error') report.errors.push(m.text());
          });
          await page.goto(url);
          await page.locator('input').waitFor();
          const name = `${preset}-${theme}-${width}`,
            file = path.join(root, name + '.png');
          await page.screenshot({ path: file, fullPage: true });
          matrix.push(file);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
          );
          const input = page.getByLabel('Stage displacement (mm)');
          await input.focus();
          assert.equal(await input.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
          for (const [key, value] of [
            ['End', 10],
            ['Home', 0],
            ['ArrowRight', 0.1],
          ]) {
            await input.press(key);
            const state = await page.evaluate(() => ({
              displayed: Number(document.querySelector('article').dataset.displayed),
              angle: Number(document.querySelector('[data-part=needle]').dataset.angle),
              reading: document.querySelector('[data-live-readout]').textContent,
            }));
            assert.equal(state.displayed, value);
            assert.equal(state.angle, value * 30);
            assert.equal(state.reading, value.toFixed(2) + ' mm');
          }
          const box = await page.locator('svg').boundingBox();
          await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.7);
          assert.equal(await input.inputValue(), '5');
          assert.equal(await page.locator('[data-part=static-readout]').textContent(), '5.00 mm');
          await page.screenshot({ path: path.join(root, name + '-mid.png'), fullPage: true });
          if (width === 960) {
            const stageFile = path.join(root, name + '-stage.png');
            await page.locator('svg').screenshot({ path: stageFile });
            const w = Math.round(box.width),
              h = Math.round(box.height);
            for (const [part, x, y, ww, hh] of [
              ['dial', 0.47, 0.1, 0.24, 0.27],
              ['contact', 0.5, 0.4, 0.14, 0.25],
              ['supports', 0.18, 0.12, 0.34, 0.44],
            ])
              await crop4(stageFile, path.join(root, `${name}-${part}-4x.png`), {
                x: Math.round(w * x),
                y: Math.round(h * y),
                width: Math.round(w * ww),
                height: Math.round(h * hh),
              });
          }
          report.checks.push({ id: 'A06/A07/A10', name, status: 'passed' });
          await context.close();
        }
      }
    for (const state of ['rest', 'mid', 'max']) {
      const url = await built('pose-' + state, { motion: { enabled: false } }, state),
        page = await browser.newPage();
      await page.goto(url);
      assert.equal(
        await page.locator('[data-part=static-readout]').textContent(),
        { rest: '0.00', mid: '5.00', max: '10.00' }[state] + ' mm',
      );
      await page.close();
    }
    report.checks.push({ id: 'A07', name: 'exported poses survive mount', status: 'passed' });
    const url = await built('motion', { motion: { enabled: true, durationMs: 300 } }),
      context = await browser.newContext(),
      page = await context.newPage();
    await page.goto(url);
    await page.locator('input').waitFor();
    await page.locator('input').fill('10');
    await page.waitForTimeout(100);
    const intermediate = await page.evaluate(() => ({
      value: +document.querySelector('article').dataset.displayed,
      angle: +document.querySelector('[data-part=needle]').dataset.angle,
      reading: document.querySelector('[data-live-readout]').textContent,
    }));
    assert.ok(intermediate.value > 0 && intermediate.value < 10);
    assert.equal(intermediate.angle, intermediate.value * 30);
    assert.equal(intermediate.reading, intermediate.value.toFixed(2) + ' mm');
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(() => document.querySelector('article').__motion.stats.pending),
      false,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('input').fill('2');
    assert.equal(await page.locator('[data-part=static-readout]').textContent(), '2.00 mm');
    assert.equal(
      await page.evaluate(() => document.querySelector('article').__motion.stats.pending),
      false,
    );
    await context.close();
    const tour = await built('tour', { motion: { idleTour: true } }),
      p = await browser.newPage();
    await p.goto(tour);
    await p.waitForTimeout(150);
    assert.equal(
      await p.evaluate(() => document.querySelector('article').__motion.stats.pending),
      true,
    );
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(
      await p.evaluate(() => document.querySelector('article').__motion.stats.pending),
      false,
    );
    await p.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
      document.body.style.paddingTop = '2000px';
    });
    await p.waitForTimeout(150);
    assert.equal(
      await p.evaluate(() => document.querySelector('article').__motion.stats.pending),
      false,
    );
    await p.evaluate(() => {
      document.body.style.paddingTop = '0';
    });
    await p.waitForTimeout(150);
    await p.locator('input').fill('4');
    await p.waitForTimeout(500);
    assert.equal(
      await p.evaluate(() => document.querySelector('article').__motion.stats.pending),
      false,
    );
    const cleanup = await p.evaluate(() => {
      const root = document.querySelector('article'),
        stats = root.__motion.stats;
      root.__craftedCleanup();
      root.__craftedCleanup();
      return {
        disposed: stats.disposed,
        pending: stats.pending,
        controls: root.querySelectorAll('input').length,
      };
    });
    assert.deepEqual(cleanup, { disposed: true, pending: false, controls: 0 });
    await p.close();
    report.checks.push({
      id: 'A08',
      name: 'transition agreement, settled/reduced/hidden/offscreen/tour/cleanup',
      status: 'passed',
    });
    const nojs = await browser.newContext({ javaScriptEnabled: false }),
      n = await nojs.newPage();
    await n.goto(await built('no-js', {}, 'mid'));
    assert.equal(await n.locator('input,button').count(), 0);
    assert.equal(await n.locator('[data-part=static-readout]').textContent(), '5.00 mm');
    assert.ok((await n.locator('p').textContent()).includes('probe'));
    await n.screenshot({ path: path.join(root, 'no-js.png') });
    await nojs.close();
    report.checks.push({ id: 'A09', status: 'passed' });
    await built('portable', {}, 'rest');
    await checkOutput('out/browser/portable', path.join(root, 'portable'));
    // The public renderer returns SVG children, not a mandatory path vocabulary.
    await buildFigure({
      entry: 'tests/fixtures/primitive-figure.mjs',
      out: 'out/browser/primitives',
      overrides: { output: 'svg' },
    });
    const primitives = await checkOutput(
      'out/browser/primitives',
      path.join(root, 'primitives-portable'),
    );
    assert.equal(primitives.interaction, 'not applicable: static SVG only');
    assert.equal(primitives.checks.length, 4);
    report.checks.push({
      id: 'A04',
      name: 'standalone polygon/ellipse/line artwork without paths',
      status: 'passed',
    });
    // Branding font declarations must survive both HTML and XML SVG parsing.
    const branded = await built('typography', {
      typography: {
        body: '"AT&T, Serif", "源ノ角ゴシック", Georgia, serif',
        mono: '"Local, Mono", ui-monospace, monospace',
      },
      motion: { enabled: false },
    });
    for (const extension of ['html', 'svg']) {
      const page = await browser.newPage({ viewport: { width: 960, height: 850 } });
      await page.goto(branded.replace(/figure\.html$/, 'figure.' + extension));
      const fonts = await page.evaluate(() => ({
        body: getComputedStyle(document.querySelector('svg')).fontFamily,
        mono: getComputedStyle(document.querySelector('.reading')).fontFamily,
      }));
      assert.ok(fonts.body.includes('AT&T, Serif') && fonts.body.includes('源ノ角ゴシック'));
      assert.ok(fonts.mono.includes('Local, Mono'));
      assert.doesNotMatch(JSON.stringify(fonts), /&(?:amp|quot|#39);/);
      await page.screenshot({
        path: path.join(root, `typography-${extension}.png`),
        ...(extension === 'svg'
          ? { clip: await page.locator('svg').boundingBox() }
          : { fullPage: true }),
      });
      report.checks.push({
        id: 'A01/A04',
        name: `quoted and Unicode fonts in ${extension}`,
        fonts,
        status: 'passed',
      });
      await page.close();
    }
    await checkOutput('out/browser/typography', path.join(root, 'typography-portable'));
  },
  {
    cleanup: async () => {
      await browser?.close();
    },
  },
);
