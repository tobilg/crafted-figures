import { runReport, openBrowser } from './report.mjs';
import { tempDir } from './temp.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { bundleModule } from '../skill/crafted-figures/kit/bundler.mjs';
import { bundleFigure } from '../skill/crafted-figures/kit/bundle.mjs';
import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';
import { prepareFigure } from '../skill/crafted-figures/kit/react/server.mjs';
import { checkOutput } from '../skill/crafted-figures/kit/verify.mjs';
const out = path.resolve('out/reports/interaction');
await mkdir(out, { recursive: true });
const temp = await tempDir('crafted-interaction-'),
  report = {
    status: 'failed',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    cases: [],
    errors: [],
  };
const kitPath = name => path.resolve('skill/crafted-figures/kit', name);
/** A one-input figure written to disk, so these checks exercise the real build and mount. */
async function scalarFigure(name, { scene, control = 'min: -40, max: 40, step: 1', rest = -40 }) {
  const dir = path.join(temp, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'scene.mjs'), scene);
  await writeFile(
    path.join(dir, 'figure.mjs'),
    `import { createScene } from './scene.mjs';
export default {
  id: ${JSON.stringify(name)},
  capabilities: { detail: ['standard'] },
  initialState: { x: ${rest} },
  poses: { rest: { x: ${rest} } },
  clientEntry: new URL('./client.mjs', import.meta.url),
  render({ kit, config, state }) {
    const s = createScene({ kit, config });
    try {
      const m = s.update(state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 400],
        body: \`<g data-scene="three">\${s.render()}</g><text class="reading" data-part="static-readout" x="20" y="380">\${m.reading}</text>\`,
        title: ${JSON.stringify(name)},
        description: 'A regression figure.',
      };
    } finally {
      s.dispose();
    }
  },
};
`,
  );
  await writeFile(
    path.join(dir, 'client.mjs'),
    `import { createScene } from './scene.mjs';
export function mount({ root, kit, config, initialState }) {
  return kit.illustration.mountScalarScene({
    root, config, stage: createScene({ kit, config }),
    initial: initialState.x, state: x => ({ x }),
    control: { label: 'X', ${control} },
  });
}
`,
  );
  const built = path.join(dir, 'out');
  await buildFigure({
    entry: path.join(dir, 'figure.mjs'),
    overrides: { output: 'both' },
    out: built,
  });
  return built;
}
const movingScene = body => `export function createScene({ kit, config }) {
  const k = kit.illustration,
    s = k.createStage({ width: 600, height: 400, bounds: k.boxBounds([-70, -40, -30], [70, 40, 40]), strokeWidth: config.stroke.width });
  const wall = k.box('wall', { width: 6, depth: 60, height: 40 }),
    rod = k.box('rod', { width: 30, depth: 6, height: 6, tone: 'accent' });
  rod.position.z = 2;
  s.scene.add(wall, rod);
  s.update = state => {
    ${body}
    rod.position.x = state.x;
    return { reading: 'x = ' + state.x.toFixed(1) };
  };
  return s;
}
`;
let browser;
const pages = [];
async function open(file, { initScript, ...options } = {}) {
  const context = await browser.newContext({ viewport: { width: 960, height: 1000 }, ...options }),
    page = await context.newPage();
  if (initScript) await page.addInitScript(initScript);
  page.errorsSeen = [];
  page.on('pageerror', e => page.errorsSeen.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') page.errorsSeen.push(m.text());
  });
  pages.push(context);
  await page.goto(pathToFileURL(file).href);
  return page;
}
const ready = page => page.locator('[data-ready=true]').first().waitFor();
const displayed = page =>
  page.evaluate(() => ({
    value: Number(document.querySelector('[data-figure]').dataset.displayed),
    target: Number(document.querySelector('input').value),
    live: document.querySelector('[data-live-readout]').textContent,
    drawn: document.querySelector('[data-part="static-readout"]')?.textContent,
  }));
const setSlider = (page, value) =>
  page.evaluate(v => {
    const input = document.querySelector('input');
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
async function test(name, run) {
  const result = { name, status: 'failed' };
  report.cases.push(result);
  Object.assign(result, (await run()) || {});
  result.status = 'passed';
}
await runReport(
  out,
  report,
  async () => {
    browser = await openBrowser(report);
    const dial = path.join(temp, 'dial');
    await buildFigure({
      entry: 'examples/dial-indicator/figure.mjs',
      config: 'examples/dial-indicator/figure.config.json',
      overrides: { output: 'both' },
      out: dial,
    });
    await test('a drag updates the figure while the pointer is moving', async () => {
      const page = await open(path.join(dial, 'figure.html'));
      await ready(page);
      const trace = await page.evaluate(async () => {
        const root = document.querySelector('[data-figure]'),
          svg = root.querySelector('svg.crafted'),
          r = svg.getBoundingClientRect(),
          input = root.querySelector('input');
        svg.setPointerCapture = () => {};
        svg.hasPointerCapture = () => false;
        const fire = (type, x) =>
          svg.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              clientX: x,
              clientY: r.top + r.height / 2,
              pointerId: 1,
              button: 0,
              buttons: 1,
            }),
          );
        fire('pointerdown', r.left);
        const samples = [],
          start = performance.now();
        await new Promise(done => {
          const step = now => {
            const t = (now - start) / 1000;
            if (t >= 1) return done();
            fire('pointermove', r.left + r.width * t);
            samples.push({
              target: Number(input.value),
              value: Number(root.dataset.displayed),
              live: root.querySelector('[data-live-readout]').textContent,
            });
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        fire('pointerup', r.right);
        return samples;
      });
      const late = trace.slice(Math.floor(trace.length / 2));
      assert.ok(trace.length > 20, `expected a continuous drag, saw ${trace.length} frames`);
      for (const s of late)
        assert.ok(s.target - s.value < 2.5, `figure lags the pointer: ${JSON.stringify(s)}`);
      for (let i = 1; i < trace.length; i++)
        assert.ok(trace[i].value >= trace[i - 1].value - 1e-9, 'a forward drag must not move back');
      await page.waitForTimeout(400);
      const settled = await displayed(page);
      assert.equal(settled.value, settled.target);
      assert.equal(settled.live, settled.drawn);
      return { frames: trace.length, maxLag: Math.max(...late.map(s => s.target - s.value)) };
    });
    await test('held arrow keys keep up, and reversal never leaves the range', async () => {
      const page = await open(path.join(dial, 'figure.html'));
      await ready(page);
      await page.locator('input').focus();
      let worst = 0;
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(33);
        const s = await displayed(page);
        worst = Math.max(worst, s.target - s.value);
      }
      assert.ok(worst < 1.6, `held key lag grew to ${worst}`);
      await setSlider(page, 10);
      await page.waitForTimeout(120);
      await setSlider(page, 0);
      let low = Infinity,
        high = -Infinity;
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(30);
        const { value } = await displayed(page);
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
      assert.ok(low >= 0 && high <= 10, `overshoot: ${low}..${high}`);
      return { worstLag: worst };
    });
    const interleave = await scalarFigure('interleave', { scene: movingScene('') });
    await test('a pose the renderer cannot order does not stop the figure', async () => {
      const page = await open(path.join(interleave, 'figure.html'));
      await ready(page);
      for (const value of [-20, 0, 40]) {
        await setSlider(page, value);
        await page.waitForTimeout(450);
      }
      const s = await displayed(page);
      assert.equal(s.value, 40, 'the figure must reach the input past the bad range');
      assert.equal(s.live, 'x = 40.0');
      assert.equal(s.drawn, 'x = 40.0');
      assert.deepEqual(
        await page.evaluate(() =>
          document.querySelector('[data-figure]').__craftedController.getState(),
        ),
        { x: 40 },
      );
      return { errors: page.errorsSeen.length };
    });
    await test('check finds that pose, even though the figure loads', async () => {
      await assert.rejects(
        checkOutput(interleave, path.join(temp, 'interleave-report')),
        /sweep: PAINTER_INTERLEAVE: .*wall|rod/,
      );
      const saved = JSON.parse(
        await readFile(path.join(temp, 'interleave-report/report.json'), 'utf8'),
      );
      assert.equal(saved.sweep.status, 'failed');
    });
    const modelError = await scalarFigure('model-error', {
      scene: movingScene("if (state.x > 10 && state.x < 20) throw new Error('model rejected x');"),
    });
    await test('a failing update leaves the readout truthful and recovers', async () => {
      const page = await open(path.join(modelError, 'figure.html'), { reducedMotion: 'reduce' });
      await ready(page);
      await setSlider(page, 5);
      await setSlider(page, 15);
      const failed = await displayed(page);
      assert.equal(failed.value, 5);
      assert.equal(failed.live, 'x = 5.0');
      assert.equal(failed.target, 5, 'the control must return to the displayed value');
      assert.ok(page.errorsSeen.some(e => e.includes('model rejected x')));
      await setSlider(page, 30);
      assert.equal((await displayed(page)).live, 'x = 30.0');
    });
    const crash = await scalarFigure('crash', {
      scene: movingScene(''),
      control: "min: -40, max: 40, step: 1, get label() { throw new Error('authoring mistake'); }",
    });
    await test('check reports why a figure failed to mount, without waiting for a timeout', async () => {
      const started = performance.now();
      await assert.rejects(
        checkOutput(crash, path.join(temp, 'crash-report')),
        /authoring mistake/,
      );
      const elapsed = performance.now() - started;
      assert.ok(elapsed < 15000, `took ${elapsed} ms`);
      return { elapsedMs: Math.round(elapsed) };
    });
    const noReadout = path.join(temp, 'no-readout');
    await mkdir(noReadout, { recursive: true });
    await writeFile(path.join(noReadout, 'scene.mjs'), movingScene(''));
    await writeFile(
      path.join(noReadout, 'figure.mjs'),
      `import { createScene } from './scene.mjs';
  export default { id: 'no-readout', capabilities: { detail: ['standard'] }, initialState: { x: -40 }, poses: { rest: { x: -40 } },
    clientEntry: new URL('./client.mjs', import.meta.url),
    render({ kit, config, state }) { const s = createScene({ kit, config }); try { s.update(state); return { renderer: 'three-illustration', viewBox: [0, 0, 600, 400], body: \`<g data-scene="three">\${s.render()}</g>\`, title: 'No readout', description: 'Only the live readout.' }; } finally { s.dispose(); } } };
  `,
    );
    await writeFile(
      path.join(noReadout, 'client.mjs'),
      `import { createScene } from './scene.mjs';
  export function mount({ root, kit, config, initialState }) {
    return kit.illustration.mountScalarScene({ root, config, stage: createScene({ kit, config }), initial: initialState.x, state: x => ({ x }), control: { label: 'X', min: -40, max: -20, step: 1 } });
  }
  `,
    );
    await buildFigure({
      entry: path.join(noReadout, 'figure.mjs'),
      out: path.join(noReadout, 'out'),
    });
    await test('a figure without a drawn readout still mounts and reads out', async () => {
      const page = await open(path.join(noReadout, 'out/figure.html'), { reducedMotion: 'reduce' });
      await ready(page);
      await setSlider(page, -25);
      assert.equal((await displayed(page)).live, 'x = -25.0');
      assert.deepEqual(page.errorsSeen, []);
    });
    const axis = await scalarFigure('drag-axis', {
      scene: movingScene(''),
      control: 'min: -40, max: -10, step: 1, drag: { from: [-40, 0, 20], to: [-10, 0, 20] }',
    });
    await test('control.drag maps the pointer along a world axis through the camera', async () => {
      const page = await open(path.join(axis, 'figure.html'), { reducedMotion: 'reduce' });
      await ready(page);
      const point = world =>
        page.evaluate(w => {
          const root = document.querySelector('[data-figure]'),
            svg = root.querySelector('svg.crafted'),
            [x, y] = root.__craftedController.stage.project(w),
            p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
          return { x: p.x, y: p.y };
        }, world);
      const target = await point([-10, 0, 20]);
      await page.mouse.move(target.x, target.y);
      await page.mouse.down();
      const middle = await point([-25, 0, 20]);
      await page.mouse.move(middle.x, middle.y);
      assert.equal((await displayed(page)).value, -25);
      await page.mouse.up();
      const ground = await page.evaluate(() => {
        const stage = document.querySelector('[data-figure]').__craftedController.stage,
          [x, y] = stage.project([10, 5, 0]),
          hit = stage.pointerToPlane([x, y], { at: [0, 0, 0], normal: [0, 0, 1] });
        return [hit.x, hit.y, hit.z];
      });
      for (const [got, want] of ground.map((v, i) => [v, [10, 5, 0][i]]))
        assert.ok(Math.abs(got - want) < 1e-6, `pointerToPlane ${ground}`);
    });
    await test('playback yields to the user', async () => {
      const dir = path.join(temp, 'clip');
      await buildFigure({
        entry: 'examples/exploded-assembly/figure.mjs',
        config: 'examples/exploded-assembly/figure.config.json',
        out: dir,
      });
      const page = await open(path.join(dir, 'figure.html'));
      await ready(page);
      await page.getByRole('button', { name: 'Play sequence' }).click();
      await page.waitForTimeout(200);
      await setSlider(page, 6);
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({
        time: document.querySelector('[data-figure]').__craftedController.getState().time,
        slider: Number(document.querySelector('input').value),
        playing: document.querySelector('[data-figure]').__craftedController.getStats().playing,
      }));
      assert.equal(state.playing, false);
      assert.equal(state.slider, 6);
      assert.ok(Math.abs(state.time - 6) < 1e-6, `time ${state.time}`);
      assert.ok(await page.getByRole('button', { name: 'Resume sequence' }).count());
    });
    await test('a controlled React figure settles and follows input and external state', async () => {
      const figure = (
          await import(pathToFileURL(path.resolve('examples/dial-indicator/figure.mjs')).href)
        ).default,
        prepared = await prepareFigure({ id: 'd1', figure }),
        root = path.join(path.resolve('tests/fixtures/next'), '.interaction');
      await mkdir(root, { recursive: true });
      try {
        const { code } = await bundleModule({
          root,
          source: `
  import { createElement as h, useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { LiveFigure } from ${JSON.stringify(kitPath('react/client.mjs'))};
  import { mount } from ${JSON.stringify(path.resolve('examples/dial-indicator/client.mjs'))};
  const prepared = window.__prepared;
  function App({ copy }) {
    const [state, setState] = useState(prepared.initialState);
    window.__renders = (window.__renders || 0) + 1;
    window.__reset = () => setState({ displacementMm: 2 });
    return h(LiveFigure, { ...prepared, mount, state, onState: s => setState(copy ? { ...s } : s) });
  }
  createRoot(document.getElementById('app')).render(h(App, { copy: location.hash === '#copy' }));
  `,
        });
        const page = path.join(temp, 'react.html');
        await writeFile(
          page,
          `<!doctype html><meta charset="utf-8"><div id="app"></div><script>window.process={env:{NODE_ENV:'production'}};window.__prepared=${JSON.stringify(prepared).replace(/</g, '\\u003c')}</script><script>${code.replace(/<\/script/gi, '<\\/script')}</script>`,
        );
        const rates = {};
        for (const hash of ['', '#copy']) {
          const context = await browser.newContext({ viewport: { width: 960, height: 1000 } }),
            tab = await context.newPage();
          pages.push(context);
          await tab.goto(pathToFileURL(page).href + hash);
          await tab.locator('[data-ready=true]').waitFor();
          await tab.waitForTimeout(300);
          const before = await tab.evaluate(() => window.__renders);
          await tab.waitForTimeout(500);
          const idle = (await tab.evaluate(() => window.__renders)) - before;
          assert.equal(idle, 0, `an idle controlled figure rendered ${idle} times`);
          await setSlider(tab, 8);
          await tab.waitForTimeout(700);
          let s = await displayed(tab);
          assert.equal(s.value, 8, 'easing must reach the target in controlled mode');
          assert.equal(s.target, 8);
          await tab.waitForTimeout(400);
          await tab.evaluate(() => window.__reset());
          await tab.waitForTimeout(100);
          s = await displayed(tab);
          assert.equal(s.value, 2, 'an external state is applied');
          assert.equal(s.target, 2);
          rates[hash || 'identity'] = idle;
        }
        return { idleRenders: rates };
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
    await test('a page of effect figures keeps WebGL where the reader is looking', async () => {
      const figure = (
        await import(pathToFileURL(path.resolve('examples/ripple-tank/figure.mjs')).href)
      ).default;
      let html = '';
      const boot = [];
      for (let i = 0; i < 12; i++) {
        const prepared = await prepareFigure({ id: `t${i}`, figure, config: { schemaVersion: 2 } });
        html += `<article class="crafted" data-instance="t${i}" data-figure="ripple-tank" style="margin-bottom:1400px">${prepared.html}</article>`;
        boot.push({
          id: `t${i}`,
          config: prepared.config,
          tokens: prepared.tokens,
          initialState: prepared.initialState,
        });
      }
      const root = path.join(path.resolve('tests/fixtures/next'), '.interaction');
      await mkdir(root, { recursive: true });
      try {
        const { code } = await bundleModule({
          root,
          source: `
  import * as kit from ${JSON.stringify(kitPath('index.mjs'))};
  import { bindKit } from ${JSON.stringify(kitPath('bind.mjs'))};
  import { mount } from ${JSON.stringify(path.resolve('examples/ripple-tank/client.mjs'))};
  window.__figures = window.__boot.map(b => {
    const root = document.querySelector('[data-instance=' + b.id + ']');
    return { id: b.id, root, c: kit.registerController(root, mount({ root, kit: bindKit(kit, { config: b.config, tokens: b.tokens }), config: b.config, tokens: b.tokens, initialState: b.initialState })) };
  });
  `,
        });
        const file = path.join(temp, 'many.html');
        await writeFile(
          file,
          `<!doctype html><meta charset="utf-8"><body style="width:640px">${html}<script>window.__boot=${JSON.stringify(boot).replace(/</g, '\\u003c')}</script><script>${code.replace(/<\/script/gi, '<\\/script')}</script>`,
        );
        const page = await open(file);
        await page.waitForFunction(() => window.__figures);
        await page.waitForTimeout(400);
        const modes = () =>
          page.evaluate(() =>
            window.__figures.map(f => ({
              id: f.id,
              mode: f.c.effects.stats.mode,
              error: f.c.effects.stats.error,
              contexts: f.c.effects.canvases.length,
            })),
          );
        const scrollTo = async i => {
          await page.evaluate(n => window.__figures[n].root.scrollIntoView(), i);
          await page.waitForTimeout(400);
        };
        for (const i of [0, 11, 5, 0]) {
          await scrollTo(i);
          const state = await modes();
          assert.equal(
            state[i].mode,
            'webgl',
            `figure ${i} is on screen: ${JSON.stringify(state[i])}`,
          );
          assert.ok(
            state.every(f => !f.error),
            JSON.stringify(state),
          );
          const held = state.reduce((n, f) => n + f.contexts, 0);
          assert.ok(held <= 16, `${held} contexts exceeds the browser limit`);
        }
        assert.ok(!page.errorsSeen.some(e => /context/i.test(e)), page.errorsSeen.join('\n'));
        return { contextsAtTop: (await modes()).reduce((n, f) => n + f.contexts, 0) };
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
    await test('a viewport that collapses for one frame is not the reader leaving', async () => {
      const dir = path.join(temp, 'collapse');
      await buildFigure({
        entry: 'examples/ripple-tank/figure.mjs',
        config: 'examples/ripple-tank/figure.config.json',
        out: dir,
      });
      const page = await open(path.join(dir, 'figure.html'), {
        initScript: () => {
          const Native = window.IntersectionObserver;
          window.IntersectionObserver = class extends Native {
            constructor(callback, options) {
              super(callback, options);
              if (options?.rootMargin === '100%') window.__nearViewport = callback;
            }
          };
        },
      });
      await ready(page);
      const observe = (isIntersecting, height) =>
        page.evaluate(
          ([isIntersecting, height]) => {
            window.__nearViewport([
              { isIntersecting, rootBounds: { width: innerWidth * 3, height } },
            ]);
            return document.querySelector('[data-figure]').__craftedController.effects.stats.mode;
          },
          [isIntersecting, height],
        );
      const full = 3000,
        collapsed = 3;
      assert.equal(await observe(false, collapsed), 'webgl', 'a live figure keeps its contexts');
      assert.equal(await observe(true, full), 'webgl');
      await page.evaluate(() => {
        const fx = document.querySelector('[data-figure]').__craftedController.effects;
        fx.canvases[0].getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
      });
      await page.waitForFunction(
        () =>
          document.querySelector('[data-figure]').__craftedController.effects.stats.mode ===
          'vector',
      );
      assert.equal(await observe(false, collapsed), 'vector', 'the collapse is not an absence');
      assert.equal(await observe(true, full), 'vector', 'a lost context stays in the fallback');
      assert.equal(await observe(false, full), 'suspended', 'really leaving releases the figure');
      assert.equal(await observe(true, full), 'webgl', 'returning to the figure retries');
    });
    await test('standalone SVGs can be inlined without restyling the page or each other', async () => {
      const light = path.join(temp, 'inline-light'),
        dark = path.join(temp, 'inline-dark');
      for (const [dir, theme] of [
        [light, 'light'],
        [dark, 'dark'],
      ])
        await buildFigure({
          entry: 'examples/dial-indicator/figure.mjs',
          overrides: { output: 'svg', theme },
          out: dir,
        });
      const a = await readFile(path.join(light, 'figure.svg'), 'utf8'),
        b = await readFile(path.join(dark, 'figure.svg'), 'utf8'),
        file = path.join(temp, 'host.html');
      await writeFile(
        file,
        `<!doctype html><html><head><style>body{margin:7px;background:rgb(1,2,3)}h1{font-size:40px}button{color:rgb(9,9,9)}</style></head><body><h1>Host</h1><button>Host</button><div style="width:400px">${a}</div><div style="width:400px">${b}</div></body></html>`,
      );
      const page = await open(file);
      const seen = await page.evaluate(() => {
        const svgs = [...document.querySelectorAll('svg.crafted')],
          ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        return {
          margin: getComputedStyle(document.body).margin,
          background: getComputedStyle(document.body).backgroundColor,
          h1: getComputedStyle(document.querySelector('h1')).fontSize,
          button: getComputedStyle(document.querySelector('button')).color,
          fills: svgs.map(s => getComputedStyle(s.querySelector('path.top')).fill),
          duplicateIds: ids.length - new Set(ids).size,
        };
      });
      assert.equal(seen.margin, '7px');
      assert.equal(seen.background, 'rgb(1, 2, 3)');
      assert.equal(seen.h1, '40px');
      assert.equal(seen.button, 'rgb(9, 9, 9)');
      assert.notEqual(seen.fills[0], seen.fills[1], 'each figure keeps its own theme');
      assert.equal(seen.duplicateIds, 0);
      return { fills: seen.fills };
    });
    await test('no product name appears on deliverables unless configured', async () => {
      const dir = path.join(temp, 'brand'),
        plain = await readFile(path.join(dial, 'figure.html'), 'utf8');
      assert.doesNotMatch(plain, /Crafted figures/i);
      await writeFile(
        path.join(temp, 'brand.json'),
        JSON.stringify({ schemaVersion: 2, eyebrow: 'Acme Labs', language: 'de' }),
      );
      await buildFigure({
        entry: 'examples/dial-indicator/figure.mjs',
        config: path.join(temp, 'brand.json'),
        out: dir,
      });
      const branded = await readFile(path.join(dir, 'figure.html'), 'utf8');
      assert.match(branded, /<div class="eyebrow">Acme Labs<\/div>/);
      assert.match(branded, /<html lang="de">/);
    });
    const sheetDir = path.join(temp, 'sheets');
    await mkdir(sheetDir, { recursive: true });
    await cp('examples/dial-indicator', sheetDir, { recursive: true });
    const preset = JSON.parse(
      await readFile('skill/crafted-figures/assets/presets/technical.json', 'utf8'),
    );
    await writeFile(path.join(sheetDir, 'brand.json'), JSON.stringify({ ...preset, id: 'brand' }));
    await writeFile(
      path.join(sheetDir, 'brand.config.json'),
      JSON.stringify({ schemaVersion: 1, preset: 'brand' }),
    );
    await writeFile(
      path.join(sheetDir, 'poster.mjs'),
      "export default { schemaVersion: 1, figure: './figure.mjs', config: './brand.config.json', title: 'Poster only', views: { main: { pose: 'rest' } }, parts: [], steps: [], maxPages: 1, paper: 'letter', format: 'poster' };\n",
    );
    await test('a custom-preset figure prints, and its header carries no product name', async () => {
      const printed = path.join(temp, 'printed'),
        { report: result } = await printSheet({
          spec: path.join(sheetDir, 'poster.mjs'),
          presetFiles: [path.join(sheetDir, 'brand.json')],
          out: printed,
        });
      assert.deepEqual(
        result.formats.map(f => [f.layout, f.paper]),
        [['poster', 'letter']],
      );
      assert.doesNotMatch(
        await readFile(path.join(printed, 'poster-letter.html'), 'utf8'),
        /CRAFTED FIGURES/,
      );
    });
    await test('a poster-only sheet bundles and its rebuild keeps the paper it declared', async () => {
      const share = path.join(temp, 'share');
      const manifest = await bundleFigure({
        entry: path.join(sheetDir, 'figure.mjs'),
        config: path.join(sheetDir, 'brand.config.json'),
        presetFiles: [path.join(sheetDir, 'brand.json')],
        sheet: path.join(sheetDir, 'poster.mjs'),
        out: share,
      });
      assert.ok(
        manifest.outputHashes['print/poster-letter.pdf'],
        'sheet paper and layout are honored',
      );
      assert.ok(!manifest.outputHashes['print/poster-a4.pdf']);
      const rebuild = await readFile(path.join(share, 'rebuild.mjs'), 'utf8');
      assert.doesNotMatch(rebuild, /"paper": "a4"|"format": "all"/);
      assert.match(rebuild, /presetFiles/);
    });
  },
  {
    cleanup: async () => {
      for (const context of pages) await context.close().catch(() => {});
      await browser?.close();
      await rm(temp, { recursive: true, force: true });
    },
  },
);
