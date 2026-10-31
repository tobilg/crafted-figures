import { tempDir } from './temp.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChromium, waitForFigure } from '../skill/crafted-figures/kit/browser.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { drive } from '../skill/crafted-figures/kit/drive.mjs';
import { zBufferOrder } from '../skill/crafted-figures/kit/order-check.mjs';
import { checkOutput } from '../skill/crafted-figures/kit/verify.mjs';
const out = path.resolve('out/reports/zbuffer');
await mkdir(out, { recursive: true });
const temp = await tempDir('crafted-zbuffer-'),
  report = {
    status: 'failed',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    cases: [],
    errors: [],
  };
async function test(name, run) {
  const result = { name, status: 'failed' };
  report.cases.push(result);
  Object.assign(result, (await run()) || {});
  result.status = 'passed';
}
/** A figure of one ring and one box, with an optional change to the live renderer. */
async function ringFigure(name, { rim = 0.6, height = 2, size = 34, client = '' } = {}) {
  const dir = path.join(temp, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'scene.mjs'),
    `export function createScene({ kit, config }) {
  const k = kit.illustration,
    s = k.createStage({ width: 600, height: 400, azimuth: 45, elevation: 30, bounds: k.boxBounds([-60, -60, -12], [60, 60, 20]), strokeWidth: config.stroke.width });
  const ring = k.annulus('z-ring', { radius: 40, innerRadius: ${40 - rim}, height: ${height} }),
    box = k.box('a-box', { width: ${size}, depth: ${size}, height: 4, tone: 'accent' });
  s.scene.add(ring, box);
  s.update = state => {
    box.position.set(state.x, state.y, 8);
    return { reading: 'x ' + state.x };
  };
  return s;
}
`,
  );
  await writeFile(
    path.join(dir, 'figure.mjs'),
    `import { createScene } from './scene.mjs';
export default { id: ${JSON.stringify(name)}, capabilities: { detail: ['standard'] }, initialState: { x: 40, y: 0 }, poses: { rest: { x: 40, y: 0 } },
  clientEntry: new URL('./client.mjs', import.meta.url),
  render({ kit, config, state }) { const s = createScene({ kit, config }); try { s.update(state); return { renderer: 'three-illustration', viewBox: [0, 0, 600, 400], body: \`<g data-scene="three">\${s.render()}</g>\`, title: 'Ring', description: 'A box over a thin ring.' }; } finally { s.dispose(); } } };
`,
  );
  await writeFile(
    path.join(dir, 'client.mjs'),
    `import { createScene } from './scene.mjs';
export function mount({ root, kit, config, initialState }) {
  const stage = createScene({ kit, config });
  ${client}
  return kit.illustration.mountStateScene({ root, config, stage, initialState, controls: [{ key: 'x', label: 'X', min: -60, max: 60, step: 0.5 }, { key: 'y', label: 'Y', min: -60, max: 60, step: 0.5 }] });
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
let browser;
async function open(dir) {
  const page = await browser.newPage({
      viewport: { width: 960, height: 1000 },
      reducedMotion: 'reduce',
    }),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(dir, 'figure.html')).href);
  await waitForFigure(page, errors);
  return page;
}
try {
  browser = await launchChromium();
  report.environment.browser = browser.version();
  report.environment.browserSource = browser.craftedSource;
  const dial = path.join(temp, 'dial');
  await buildFigure({
    entry: 'examples/dial-indicator/figure.mjs',
    config: 'examples/dial-indicator/figure.config.json',
    overrides: { output: 'both' },
    out: dial,
  });
  await test('a correct figure passes and the reversed control disagrees', async () => {
    const page = await open(dial),
      result = await page.locator('[data-figure]').evaluate(zBufferOrder, { control: true });
    assert.equal(result.status, 'passed', JSON.stringify(result.findings));
    assert.ok(result.control.pixels > 1000, `control saw only ${result.control.pixels} pixels`);
    assert.ok(result.compared > 10000);
    await page.close();
    return { control: result.control.pixels, compared: result.compared };
  });
  for (const [name, code, tamper] of [
    [
      'a part moved behind everything',
      'ZBUFFER_ORDER',
      el => el.querySelector('[data-scene]').prepend(el.querySelector('[data-object=carriage]')),
    ],
    [
      'artwork with no mesh behind it',
      'ZBUFFER_EXCESS',
      el => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'top');
        path.setAttribute('d', 'M500 20L580 20L580 80L500 80Z');
        el.querySelector('[data-object=carriage]').append(path);
      },
    ],
    [
      'a surface with no artwork',
      'ZBUFFER_MISSING',
      el => {
        for (const object of el.querySelectorAll('[data-object]')) {
          if (object.dataset.object !== 'base') continue;
          for (const path of object.querySelectorAll(':scope > path')) path.remove();
        }
      },
    ],
  ])
    await test(`fault injection: ${name}`, async () => {
      const page = await open(dial),
        root = page.locator('[data-figure]');
      await root.evaluate(tamper);
      const result = await root.evaluate(zBufferOrder);
      assert.equal(result.status, 'failed');
      assert.ok(
        result.findings.some(f => f.code === code),
        JSON.stringify(result.findings.slice(0, 3)),
      );
      await page.close();
    });
  await test('a hairline rim cannot slip between the order samples', async () => {
    const page = await open(await ringFigure('hairline', { rim: 0.15, height: 0.3, size: 70 })),
      root = page.locator('[data-figure]');
    let states = 0,
      ringOverBox = 0;
    for (let i = 0; i < 18; i++)
      for (const offset of [-30, -16, -6, 0, 6, 16, 30]) {
        const angle = (i * 20 * Math.PI) / 180,
          state = { x: (40 + offset) * Math.cos(angle), y: (40 + offset) * Math.sin(angle) };
        await root.evaluate((el, s) => el.__craftedController.setState(s), state);
        const result = await root.evaluate(zBufferOrder, { scale: 4 });
        assert.equal(
          result.status,
          'passed',
          `${JSON.stringify(state)} ${JSON.stringify(result.findings)}`,
        );
        states++;
        if (
          (await root.evaluate(el => el.querySelector('[data-object]').dataset.object)) === 'a-box'
        )
          ringOverBox++;
      }
    await page.close();
    return { states, ringOverBox };
  });
  await test('check fails a figure whose live order is wrong', async () => {
    const built = await ringFigure('reversed', {
      client:
        'const render = stage.renderer.render.bind(stage.renderer);\n  stage.renderer.render = (...args) => render(...args).reverse();',
    });
    await assert.rejects(
      checkOutput(built, path.join(temp, 'reversed-report')),
      /sweep: ZBUFFER_ORDER/,
    );
    const saved = JSON.parse(
      await readFile(path.join(temp, 'reversed-report/report.json'), 'utf8'),
    );
    assert.equal(saved.sweep.zbuffer.status, 'failed');
    assert.ok(saved.sweep.zbuffer.faults[0].pixels > 100);
  });
  await test('a browser without WebGL blocks the check rather than passing it', async () => {
    const built = await ringFigure('no-webgl', {
      client:
        "const context = HTMLCanvasElement.prototype.getContext;\n  HTMLCanvasElement.prototype.getContext = function (type, ...args) {\n    return String(type).includes('webgl') ? null : context.call(this, type, ...args);\n  };",
    });
    await assert.rejects(
      checkOutput(built, path.join(temp, 'no-webgl-report')),
      /sweep: ZBUFFER_UNAVAILABLE at initial state: WebGL2 is unavailable/,
    );
    const saved = JSON.parse(
      await readFile(path.join(temp, 'no-webgl-report/report.json'), 'utf8'),
    );
    assert.equal(saved.sweep.zbuffer.status, 'blocked');
  });
  await test('drive runs the check by action and across sampled states', async () => {
    const dir = path.join(temp, 'valve');
    await buildFigure({
      entry: 'examples/valve-assembly/figure.mjs',
      config: 'examples/valve-assembly/figure.config.json',
      out: dir,
    });
    const actions = path.join(temp, 'actions.json');
    await writeFile(
      actions,
      JSON.stringify({
        schemaVersion: 1,
        reducedMotion: true,
        actions: [
          { type: 'zbuffer', control: true },
          {
            type: 'samples',
            name: 'lift',
            zbuffer: true,
            states: [{ liftMm: 0 }, { liftMm: 4 }, { liftMm: 8 }, { liftMm: 12 }],
          },
        ],
      }),
    );
    const result = await drive({ dir, actions, report: path.join(temp, 'valve-drive') });
    assert.equal(result.status, 'passed', result.errors.join('\n'));
    const [direct, sampled] = result.actions;
    assert.equal(direct.zbuffer.status, 'passed');
    assert.ok(direct.zbuffer.control.pixels > 1000);
    assert.ok(sampled.sampling.frames.every(frame => frame.zbuffer.status === 'passed'));
  });
  await test('check sweeps every example through the depth comparison', async () => {
    const results = {};
    for (const name of (await readdir('examples')).sort()) {
      const dir = path.join(temp, 'examples', name);
      await buildFigure({
        entry: `examples/${name}/figure.mjs`,
        config: `examples/${name}/figure.config.json`,
        overrides: { output: 'both' },
        out: dir,
      });
      const saved = await checkOutput(dir, path.join(temp, 'examples-report', name));
      if (saved.sweep.status !== 'not applicable') {
        assert.equal(saved.sweep.zbuffer.status, 'passed', name);
        assert.ok(saved.sweep.zbuffer.control.pixels > 0, `${name}: the control saw no overlap`);
      }
      results[name] = saved.sweep.zbuffer?.states ?? 0;
    }
    return { states: results };
  });
  await test('without the pinned build, check finds a browser already installed', async () => {
    const cli = path.resolve('skill/crafted-figures/scripts/figures.mjs'),
      env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(temp, 'no-browsers') };
    delete env.CRAFTED_CHROMIUM_EXECUTABLE;
    const found = spawnSync(
      process.execPath,
      [cli, 'check', '--dir', dial, '--report', path.join(temp, 'found')],
      { env, encoding: 'utf8' },
    );
    if (found.status !== 0 && /could not launch/.test(found.stderr))
      return { skipped: 'no browser is installed on this machine' };
    assert.equal(found.status, 0, found.stderr);
    const saved = JSON.parse(await readFile(path.join(temp, 'found/report.json'), 'utf8'));
    assert.equal(saved.environment.browserSource, 'installed');
    const wrong = spawnSync(
      process.execPath,
      [cli, 'check', '--dir', dial, '--report', path.join(temp, 'wrong')],
      {
        env: { ...env, CRAFTED_CHROMIUM_EXECUTABLE: path.join(temp, 'no-such-browser') },
        encoding: 'utf8',
      },
    );
    assert.notEqual(wrong.status, 0, 'a mistaken explicit path must not fall back');
    assert.match(wrong.stderr, /no-such-browser/);
    return { source: saved.environment.browserSource, browser: saved.environment.browser };
  });
  report.status = 'passed';
} catch (e) {
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    report.status,
    report.cases.length,
    report.errors.map(e => e.slice(0, 700)),
  );
}
