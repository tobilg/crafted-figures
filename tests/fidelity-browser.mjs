import { runBrowserReport } from './report.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { captureCrop } from '../skill/crafted-figures/kit/capture.mjs';
const out = 'out/reports/fidelity';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  cases: [],
  errors: [],
  environment: { node: process.version },
  acceptance:
    'Exact initial static/live SVG geometry, clipping, text and style after canonical cyclic polygon starts/subpath order; only the interaction-state attribute is excluded. Raster differences are recorded and reviewed, not claimed identical.',
};
await runBrowserReport(out, report, async browser => {
  for (const name of [
    'terminal-cabinet',
    'valve-assembly',
    'exploded-assembly',
    'turning-mechanism',
    'merging-surfaces',
    'spring-probe',
    'material-sheet',
  ])
    for (const theme of ['light', 'dark']) {
      const dir = `${out}/${name}-${theme}`;
      await buildFigure({
        entry: `examples/${name}/figure.mjs`,
        config: `examples/${name}/figure.config.json`,
        state: 'mid',
        out: dir,
        overrides: { theme, motion: { enabled: false }, rendering: { effects: 'off' } },
      });
      const live = await browser.newPage({
          viewport: { width: 960, height: 1200 },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        }),
        still = await browser.newPage({
          viewport: { width: 960, height: 1200 },
          deviceScaleFactor: 1,
          javaScriptEnabled: false,
        });
      live.on('pageerror', e => report.errors.push(e.message));
      const url = pathToFileURL(path.resolve(dir, 'figure.html')).href;
      await live.goto(url);
      await still.goto(url);
      await live.locator('[data-ready=true]').waitFor();
      await live.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      await still.evaluate(() => document.fonts.ready);
      const vector = await Promise.all(
        [live, still].map(p =>
          p.locator('svg.crafted').evaluate(svg => {
            const clone = svg.cloneNode(true);
            clone.removeAttribute('data-interactive');
            // A closed polygon has no distinguished first vertex; independent V8 builds can
            // select different equally leftmost hull vertices. Canonicalize only M/L/Z
            // subpaths, preserving every coordinate, winding and all drawing attributes.
            for (const path of clone.querySelectorAll('path[d]')) {
              const d = path.getAttribute('d');
              if (!d || /[A-KN-Y]/i.test(d.replace(/[eE][+-]?\d+/g, ''))) continue;
              const parts = d
                .split(/(?=M)/)
                .filter(Boolean)
                .map(part => {
                  if (!part.endsWith('Z')) return part;
                  const points = part.slice(1, -1).split('L');
                  let first = 0;
                  for (let i = 1; i < points.length; i++) if (points[i] < points[first]) first = i;
                  return 'M' + [...points.slice(first), ...points.slice(0, first)].join('L') + 'Z';
                });
              path.setAttribute('d', parts.sort().join(''));
            }
            return clone.outerHTML;
          }),
        ),
      );
      if (vector[0] !== vector[1]) {
        await writeFile(`${out}/${name}-${theme}-live.svg`, vector[0]);
        await writeFile(`${out}/${name}-${theme}-static.svg`, vector[1]);
      }
      const hashes = vector.map(s => createHash('sha256').update(s).digest('hex'));
      assert.equal(
        hashes[0],
        hashes[1],
        `${name}/${theme}: static/live geometry, text, clipping or style differs`,
      );
      const livePNG = await live.locator('svg.crafted').screenshot(),
        staticPNG = await still.locator('svg.crafted').screenshot();
      const a = PNG.sync.read(livePNG),
        b = PNG.sync.read(staticPNG);
      assert.equal(a.width, b.width);
      assert.equal(a.height, b.height);
      let pixels = 0,
        maxDelta = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        let delta = 0;
        for (let k = 0; k < 4; k++)
          delta = Math.max(delta, Math.abs(a.data[i + k] - b.data[i + k]));
        if (delta > 2) pixels++;
        maxDelta = Math.max(delta, maxDelta);
      }
      if (pixels) {
        await writeFile(`${out}/${name}-${theme}-mismatch-live.png`, livePNG);
        await writeFile(`${out}/${name}-${theme}-mismatch-static.png`, staticPNG);
      } // Exact serialized geometry/style equality is the vector acceptance check.
      // Separate Chromium contexts can rasterize identical SVG edge pixels differently;
      // retain their pixel differences and both images for review, without calling them identical.
      await writeFile(`${out}/${name}-${theme}.png`, livePNG);
      const crop = await captureCrop(
        live,
        { region: [0.25, 0.2, 0.5, 0.5], scale: 4 },
        `${out}/${name}-${theme}-4x.png`,
      );
      report.cases.push({
        name,
        theme,
        comparedPixels: a.width * a.height,
        canonicalVectorIdentical: true,
        vectorSHA256: hashes[0],
        rasterIdentical: pixels === 0,
        differingPixels: pixels,
        maxDelta,
        crop,
      });
      await live.close();
      await still.close();
    }
});
