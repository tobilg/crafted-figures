import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { zBufferOrder } from '../skill/crafted-figures/kit/order-check.mjs';
import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';
import { checkOutput } from '../skill/crafted-figures/kit/verify.mjs';
import { runBrowserReport } from './report.mjs';

const out = 'out/reports/illustrated';
await mkdir(out, { recursive: true });
const report = { status: 'running', cases: [], errors: [], environment: { node: process.version } };

/** The starter, plus figures written for other presets: a finish must not depend on the figure. */
const figures = [
  ['kitchen-scale', {}],
  ['hinged-arm', { schemaVersion: 2, preset: 'illustrated' }],
  ['lift-valve', { schemaVersion: 2, preset: 'illustrated' }],
  ['control-cabinet', { schemaVersion: 2, preset: 'illustrated' }],
];

/** The shadow keeps its place in the painted order: above receivers, below everything else. */
const shadowPlace = root => {
  const scene = root.querySelector('[data-scene]'),
    children = [...scene.children],
    shadow = scene.querySelector(':scope > [data-ground-shadow]'),
    renderer = root.__craftedController.stage.renderer;
  return {
    index: children.indexOf(shadow),
    expected: renderer.shadowIndex,
    path: shadow.querySelector(':scope > path').getAttribute('d'),
    pointerEvents: getComputedStyle(shadow).pointerEvents,
    fill: getComputedStyle(shadow.querySelector(':scope > path')).fill,
    contour: getComputedStyle(scene.querySelector('.edge')).strokeWidth,
    diagnostics: renderer.diagnostics.length,
  };
};

await runBrowserReport(out, report, async browser => {
  for (const [name, overrides] of figures)
    for (const theme of ['light', 'dark']) {
      const dir = `out/illustrated/${name}-${theme}`;
      await buildFigure({
        entry: `examples/${name}/figure.mjs`,
        config: `examples/${name}/figure.config.json`,
        out: dir,
        overrides: { ...overrides, theme, output: 'both' },
      });
      for (const width of [390, 960]) {
        const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: 'reduce',
          }),
          page = await context.newPage(),
          label = `${name}-${theme}-${width}`,
          errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => m.type() === 'error' && errors.push(m.text()));
        await page.goto(pathToFileURL(path.resolve(dir, 'figure.html')).href);
        await page.locator('[data-ready=true]').waitFor();
        const root = page.locator('[data-figure]');
        const first = await root.evaluate(shadowPlace);
        assert.equal(first.index, first.expected, `${label}: shadow position`);
        assert.equal(first.pointerEvents, 'none', `${label}: shadow must not take input`);
        assert.notEqual(first.fill, 'none');
        assert.equal(first.contour, '2px', `${label}: contour`);

        const order = await root.evaluate(el =>
          el.__craftedController.stage.inspectOrder(el, { tones: true }),
        );
        assert.equal(order.status, 'passed', JSON.stringify(order.findings.slice(0, 3)));
        const depth = await root.evaluate(zBufferOrder);
        assert.notEqual(depth.status, 'failed', JSON.stringify(depth.findings?.slice(0, 3)));

        // Move through the real control. The drawn shadow must change and stay in place.
        const moved = await root
          .evaluate(el => {
            const input = el.querySelector('[data-controls] input[type=range]');
            input.value = input.max;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
          })
          .then(() => root.evaluate(shadowPlace));
        assert.equal(moved.index, moved.expected, `${label}: shadow position after moving`);
        assert.equal(moved.diagnostics, 0, `${label}: painter diagnostics`);
        if (name === 'kitchen-scale')
          assert.notEqual(moved.path, first.path, `${label}: shadow moved`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false, `${label}: horizontal overflow`);

        await page.screenshot({ path: path.join(out, `${label}.png`), fullPage: true });
        assert.deepEqual(errors, [], label);
        report.cases.push({
          label,
          tones: order.toneSamples,
          depth: depth.status,
          shadowChanged: moved.path !== first.path,
        });
        await context.close();
      }
    }

  // The standalone SVG carries everything it needs.
  const svg = await readFile('out/illustrated/kitchen-scale-light/figure.svg', 'utf8');
  assert.ok(!svg.includes('<filter'), 'lines stay antialiased vectors, with no raster filter');
  assert.match(svg, /data-ground-shadow/);
  report.cases.push({ label: 'standalone-svg', bytes: svg.length });

  // A figure with GPU effects keeps them registered under the finish.
  const effectsDir = 'out/illustrated/exploded-assembly';
  await buildFigure({
    entry: 'examples/exploded-assembly/figure.mjs',
    config: 'examples/exploded-assembly/figure.config.json',
    out: effectsDir,
    overrides: { preset: 'illustrated', schemaVersion: 2, motion: { enabled: false } },
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 900 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(effectsDir, 'figure.html')).href);
  await page.locator('[data-ready=true]').waitFor();
  const proportions = await page.locator('[data-figure]').evaluate(el => {
    const svg = el.querySelector('svg.crafted'),
      box = svg.getBoundingClientRect(),
      view = svg.viewBox.baseVal;
    return { box: box.width / box.height, view: view.width / view.height };
  });
  // A canvas aligns to this rectangle, so a capped height must not letterbox the drawing.
  assert.ok(Math.abs(proportions.box - proportions.view) < 0.01, JSON.stringify(proportions));
  await page.close();
  report.cases.push({ label: 'effects-keep-proportions', ...proportions });

  // Callouts: legible at any width, on their anchors as parts move, and in step with the legend.
  for (const width of [390, 960]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(
      pathToFileURL(path.resolve('out/illustrated/kitchen-scale-light/figure.html')).href,
    );
    await page.locator('[data-ready=true]').waitFor();
    const seen = await page.locator('[data-figure]').evaluate(async root => {
      const svg = root.querySelector('svg.crafted'),
        overlay = root.__craftedController.stage.renderer.overlay,
        badge = () =>
          root.querySelector('[data-callout="pan"] .callout-face circle').getBoundingClientRect(),
        leader = () => root.querySelector('[data-callout="pan"] .callout-leader').getAttribute('d'),
        place = () =>
          root.querySelector('[data-callout="pan"] .callout-badge').getAttribute('transform'),
        row = () => root.querySelector('dt[data-callout="pan"]'),
        input = root.querySelector('[data-controls] input[type=range]'),
        set = async value => {
          input.value = String(value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        },
        first = { leader: leader(), place: place(), active: row().hasAttribute('data-active') };
      await set(0);
      return {
        diameter: badge().width,
        last:
          svg === svg.parentElement.querySelector(':scope > svg') &&
          [...svg.querySelector('[data-scene]').children].at(-1).hasAttribute('data-callouts'),
        keys: [...root.querySelectorAll('dt[data-callout] .callout-key')].map(k => k.textContent),
        first,
        moved: { leader: leader(), place: place(), active: row().hasAttribute('data-active') },
        findings: overlay.inspect(svg.getBoundingClientRect().width),
        input: getComputedStyle(root.querySelector('[data-callouts]')).pointerEvents,
      };
    });
    assert.ok(Math.abs(seen.diameter - 22) < 1.5, `badge is ${seen.diameter} px at ${width}`);
    assert.equal(seen.last, true, 'callouts paint above every part');
    assert.deepEqual(seen.keys, ['1', '2', '3']);
    assert.equal(seen.first.active, true);
    assert.equal(seen.moved.active, false, 'an empty pan is not active');
    assert.notEqual(seen.moved.leader, seen.first.leader, 'the leader follows the pan');
    assert.equal(seen.moved.place, seen.first.place, 'the badge stays put');
    assert.deepEqual(seen.findings, []);
    assert.equal(seen.input, 'none', 'callouts do not take pointer input');
    await page.close();
    report.cases.push({ label: `callouts-${width}`, diameter: seen.diameter });
  }

  // Two badges on the same spot fail the check an author runs.
  const clashDir = 'out/illustrated/callout-clash';
  await buildFigure({
    entry: 'tests/fixtures/callout-clash-figure.mjs',
    out: clashDir,
    overrides: { preset: 'illustrated' },
  });
  await assert.rejects(checkOutput(clashDir, `${out}/callout-clash`), /CALLOUT_OVERLAP/);
  report.cases.push({ label: 'callout-overlap-fails-check' });

  // The starter is held to every check the skill tells an author to run.
  const cli = (...args) =>
    execFileSync(process.execPath, ['skill/crafted-figures/scripts/figures.mjs', ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  const starter = 'out/illustrated/kitchen-scale-light';
  await writeFile(
    'out/illustrated/audit.json',
    JSON.stringify({ schemaVersion: 1, poses: ['rest', 'empty', 'full'] }),
  );
  await writeFile(
    'out/illustrated/drive.json',
    JSON.stringify({
      schemaVersion: 1,
      viewport: { width: 960, height: 1050 },
      reducedMotion: true,
      actions: [
        { type: 'lines' },
        { type: 'pose', name: 'empty' },
        { type: 'lines' },
        { type: 'pose', name: 'full' },
        { type: 'lines' },
      ],
    }),
  );
  for (const [label, args] of [
    [
      'starter-audit',
      [
        'audit',
        '--entry',
        'examples/kitchen-scale/figure.mjs',
        '--config',
        'examples/kitchen-scale/figure.config.json',
        '--scenario',
        'out/illustrated/audit.json',
        '--report',
        `${out}/starter-audit`,
      ],
    ],
    ['starter-check', ['check', '--dir', starter, '--report', `${out}/starter-check`]],
    [
      'starter-lines',
      [
        'drive',
        '--dir',
        starter,
        '--actions',
        'out/illustrated/drive.json',
        '--report',
        `${out}/starter-lines`,
      ],
    ],
  ]) {
    cli(...args);
    report.cases.push({ label });
  }

  // Playback over several inputs: page order, help, spoken value, poses, rate, early end, cleanup.
  const clipDir = 'out/illustrated/state-clip';
  await buildFigure({
    entry: 'tests/fixtures/state-clip-figure.mjs',
    out: clipDir,
    overrides: { preset: 'illustrated' },
  });
  const clipPage = await browser.newPage({ viewport: { width: 960, height: 900 } });
  clipPage.on('pageerror', e => report.errors.push(e.message));
  await clipPage.goto(pathToFileURL(path.resolve(clipDir, 'figure.html')).href);
  await clipPage.locator('[data-ready=true]').waitFor();
  const clip = await clipPage.locator('[data-figure]').evaluate(async root => {
    const c = root.__craftedController,
      controls = root.querySelector('[data-controls]'),
      caption = root.querySelector('.figure-caption'),
      input = controls.querySelector('input[type=range]'),
      started = performance.now();
    const seen = {
      controlsFirst: Boolean(
        controls.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      help: document.getElementById(input.getAttribute('aria-describedby'))?.textContent,
      spoken: input.getAttribute('aria-valuetext'),
    };
    controls.querySelector('[data-pose="Heavy"]').click();
    seen.heavy = c.getState().load;
    const button = [...controls.querySelectorAll('button')].find(b => !b.dataset.pose);
    seen.exposedButton = root.dataset.clipButton === button.textContent;
    button.click();
    while (c.getStats().playing && performance.now() - started < 5000)
      await new Promise(requestAnimationFrame);
    seen.elapsed = performance.now() - started;
    seen.stoppedAt = c.getState().time;
    seen.label = button.textContent;
    c.dispose();
    seen.controlsAfter = controls.childElementCount;
    return seen;
  });
  assert.equal(clip.controlsFirst, true, 'controls come before the caption');
  assert.equal(clip.help, 'Scrub through the run.');
  assert.match(clip.spoken, /at load 1/);
  assert.equal(clip.heavy, 4, 'pose button');
  assert.ok(clip.stoppedAt >= 6 && clip.stoppedAt < 10, `until ended at ${clip.stoppedAt}`);
  assert.ok(clip.elapsed < 2500, `rate 8 covers 6 s of model time quickly, took ${clip.elapsed}`);
  assert.equal(clip.exposedButton, true, 'the controller exposes its button');
  assert.equal(clip.label, 'Replay sequence');
  assert.equal(clip.controlsAfter, 0, 'cleanup over a state scene removes the controls');
  await clipPage.close();
  report.cases.push({ label: 'state-scene-playback', ...clip });

  // Solids stay vector in print, including the shadow.
  const dir = 'out/illustrated/print',
    print = await printSheet({
      spec: 'examples/kitchen-scale/sheet.mjs',
      paper: 'a4',
      format: 'available',
      out: dir,
    });
  for (const format of Object.keys(print.manifest.formats)) {
    const file = `${dir}/${format}-a4.pdf`,
      task = getDocument({
        data: new Uint8Array(await readFile(file)),
        useSystemFonts: true,
        isEvalSupported: false,
      }),
      doc = await task.promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const ops = await (await doc.getPage(n)).getOperatorList(),
        images = ops.fnArray.filter(op =>
          [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(op),
        ).length;
      assert.equal(images, 0, `${file} page ${n}: a printed solid must stay vector`);
      report.cases.push({ label: `print-${format}-${n}`, images });
    }
    await task.destroy();
  }
});
