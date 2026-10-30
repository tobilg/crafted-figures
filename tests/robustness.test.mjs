import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as kit from '../skill/crafted-figures/kit/index.mjs';
import { bindKit } from '../skill/crafted-figures/kit/bind.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { bundleFigure } from '../skill/crafted-figures/kit/bundle.mjs';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import { auditScene } from '../skill/crafted-figures/kit/audit/geometry.mjs';
import { writeOwnedSet } from '../skill/crafted-figures/kit/owned-output.mjs';
import { namespaceSVG } from '../skill/crafted-figures/kit/svg-ids.mjs';
import { figureStyleSheet } from '../skill/crafted-figures/kit/styles.mjs';
import { firstFrontHit } from '../skill/crafted-figures/kit/three/raycast.mjs';
import { Raycaster } from '../skill/crafted-figures/runtime/three.mjs';
const k = kit.illustration;
async function withTemp(run) {
  const dir = await tempDir('crafted-robustness-');
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const stageOf = () =>
  k.createStage({
    width: 600,
    height: 400,
    azimuth: 45,
    elevation: 30,
    bounds: k.boxBounds([-60, -60, -40], [60, 60, 40]),
  });
test('the fast ray test agrees with native Three.js rays on every primitive family', () => {
  const stage = stageOf(),
    rays = new Raycaster(),
    tube = k.tube('hose', {
      points: [
        [-30, -30, -10],
        [0, 0, 20],
        [30, -20, 0],
      ],
      radius: 4,
      segments: 8,
    });
  const solids = [
    k.box('box', { width: 40, depth: 20, height: 30, radius: 3 }),
    k.cylinder('cyl', { radius: 18, topRadius: 9, height: 30 }),
    k.annulus('ring', { radius: 20, innerRadius: 12, height: 10 }),
    ...tube.children.slice(2, 5),
  ];
  solids[1].position.set(12, -4, 3);
  solids[1].rotation.set(0.4, 0.2, 0.9);
  solids[1].scale.setScalar(1.3);
  solids[2].position.set(-14, 10, -6);
  for (const solid of solids) {
    if (!solid.parent) stage.scene.add(solid);
    else stage.scene.add(tube);
  }
  stage.scene.updateMatrixWorld(true);
  stage.camera.updateMatrixWorld(true);
  let hits = 0;
  for (const solid of solids) {
    const inverse = solid.matrixWorld.clone().invert().elements;
    for (let x = -0.9; x < 1; x += 0.03)
      for (let y = -0.9; y < 1; y += 0.03) {
        rays.setFromCamera({ x, y }, stage.camera);
        const native = rays.intersectObject(solid, false)[0]?.distance ?? null,
          fast = firstFrontHit(solid, inverse, rays.ray);
        if (native === null) assert.equal(fast, null, `${solid.name} ${x} ${y}`);
        else {
          hits++;
          assert.ok(Math.abs(native - fast) < 1e-4, `${solid.name} ${native} != ${fast}`);
        }
      }
  }
  assert.ok(hits > 200, `only ${hits} rays hit anything`);
  stage.dispose();
});
test('cached incremental rendering matches a fresh render at every sampled state', async () => {
  for (const name of await readdir('examples')) {
    const dir = path.resolve('examples', name),
      figure = (await import(pathToFileURL(path.join(dir, 'figure.mjs')).href)).default,
      scene = await import(pathToFileURL(path.join(dir, 'scene.mjs')).href),
      create =
        figure.createScene ||
        scene.createScene ||
        Object.values(scene).find(v => typeof v === 'function'),
      value = JSON.parse(await readFile(path.join(dir, 'figure.config.json'), 'utf8')),
      { config, tokens } = await resolveConfig({
        layers: [{ label: name, value }],
        capabilities: figure.capabilities,
      }),
      injected = bindKit(kit, { config, tokens }),
      shared = create({ kit: injected, config, tokens }),
      rest = figure.poses.rest,
      far = figure.poses.max ?? Object.values(figure.poses).at(-1),
      states = [...Object.values(figure.poses)];
    for (const t of [0.15, 0.4, 0.85]) {
      const between = { ...rest };
      for (const key of Object.keys(rest))
        if (typeof rest[key] === 'number') between[key] = rest[key] + (far[key] - rest[key]) * t;
      states.push(between);
    }
    states.push(rest);
    for (const state of states) {
      shared.update(state);
      const incremental = shared.render(),
        fresh = create({ kit: injected, config, tokens });
      fresh.update(state);
      assert.equal(incremental, fresh.render(), `${name} ${JSON.stringify(state)}`);
      fresh.dispose();
    }
    shared.dispose();
  }
});
test('live drawing records an interleaved pose instead of throwing; builds still reject it', () => {
  const stage = stageOf(),
    errors = [],
    original = console.error;
  stage.scene.add(
    k.box('a', { width: 40, depth: 4, height: 4 }),
    k.box('b', { width: 4, depth: 40, height: 4 }),
  );
  assert.throws(() => stage.renderer.render(stage.scene, stage.camera), /interleaved/);
  console.error = message => errors.push(message);
  try {
    const parts = stage.renderer.render(stage.scene, stage.camera, { strict: false });
    assert.equal(parts.length, 2);
    assert.equal(stage.renderer.diagnostics[0].code, 'PAINTER_INTERLEAVE');
    stage.renderer.render(stage.scene, stage.camera, { strict: false });
    assert.equal(errors.length, 1, 'a repeated problem is reported once');
  } finally {
    console.error = original;
    stage.dispose();
  }
});
test('the kit binding applies configuration an author did not pass along', async () => {
  const { config, tokens } = await resolveConfig({
    layers: [
      {
        label: 'x',
        value: {
          schemaVersion: 2,
          camera: { azimuth: 35, elevation: 30 },
          rendering: { quality: 'draft' },
        },
      },
    ],
    capabilities: {
      detail: ['standard'],
      camera: {
        default: { azimuth: 45, elevation: 30, padding: 20 },
        views: [{ azimuth: 35, elevation: 30 }],
      },
    },
  });
  const bound = bindKit(kit, { config, tokens }),
    stage = bound.illustration.createStage({
      azimuth: 42,
      bounds: k.boxBounds([-9, -9, -9], [9, 9, 9]),
    });
  assert.equal(stage.view.azimuth, 35);
  stage.dispose();
  const volume = bound.effects.effect('flame', { kind: 'fire' });
  assert.equal(volume.material.uniforms.uSteps.value, 24, 'rendering.quality reaches the effect');
  assert.equal(volume.material.uniforms.uDark.value, 0);
});
test('a build refuses a false camera claim and reports materials schema 1 cannot apply', () =>
  withTemp(async dir => {
    const body = `viewBox: [0, 0, 100, 50], body: '<text x="4" y="30">x</text>', title: 'T', description: 'D'`;
    await writeFile(
      path.join(dir, 'camera.mjs'),
      `export default { id: 'camera', capabilities: { detail: ['standard'], camera: { default: { azimuth: 45, elevation: 30, padding: 0 }, views: [{ azimuth: 45, elevation: 30 }] } }, initialState: {}, poses: { rest: {} }, render() { return { ${body} }; } };`,
    );
    await assert.rejects(
      buildFigure({
        entry: path.join(dir, 'camera.mjs'),
        overrides: { schemaVersion: 2 },
        out: path.join(dir, 'a'),
      }),
      /no rendered stage uses it/,
    );
    await writeFile(
      path.join(dir, 'material.mjs'),
      `export default { id: 'material', capabilities: { detail: ['standard'] }, initialState: {}, poses: { rest: {} }, render({ kit }) { const k = kit.illustration, s = k.createStage({ bounds: k.boxBounds([-9, -9, -9], [9, 9, 9]) }); const b = k.box('b', { width: 6, depth: 6, height: 6 }); k.material(b, 'brass'); s.scene.add(b); return { viewBox: [0, 0, 600, 400], body: '<g data-scene="three">' + s.render() + '</g>', title: 'T', description: 'D' }; } };`,
    );
    const warned = [],
      warn = console.warn;
    console.warn = message => warned.push(message);
    try {
      const { manifest } = await buildFigure({
        entry: path.join(dir, 'material.mjs'),
        out: path.join(dir, 'b'),
      });
      assert.match(manifest.warnings[0], /material brass on b is ignored/);
      assert.match(warned[0], /requires? schemaVersion 2/);
    } finally {
      console.warn = warn;
    }
  }));
test('SVG IDs are namespaced with their references, and nothing else', () => {
  const rewritten = namespaceSVG(
    `<clipPath id='c'/><use href='#c'/><g clip-path="url('#c')" data-id="keep" style="fill:url(&quot;#c&quot;)"/><title id="t">url(#c) id="c"</title><g aria-labelledby="t"/>`,
    'a',
  );
  assert.match(rewritten, /<clipPath id='a-c'\/>/);
  assert.match(rewritten, /<use href='#a-c'\/>/);
  assert.match(rewritten, /clip-path="url\('#a-c'\)"/);
  assert.match(rewritten, /data-id="keep"/);
  assert.match(rewritten, /url\(&quot;#a-c&quot;\)/);
  assert.match(rewritten, /aria-labelledby="a-t"/);
  assert.match(rewritten, />url\(#c\) id="c"<\/title>/, 'text content is not markup');
  assert.throws(() => namespaceSVG('<use href="#missing"/>', 'a'), /SVG_UNRESOLVED_REFERENCE/);
  assert.equal(
    namespaceSVG('<g data-scene><path d="M0 0" class="a b"/></g>', 'a'),
    '<g data-scene=""><path d="M0 0" class="a b"/></g>',
    'a standalone SVG must stay well-formed XML',
  );
});
test('an SVG carries only rules scoped to itself', async () => {
  const { config, tokens } = await resolveConfig({ layers: [] }),
    css = figureStyleSheet(config, tokens, 'dial-1');
  for (const selector of [
    /(^|[}\s])body\{/,
    /(^|[}\s])h1\{/,
    /(^|[}\s])button/,
    /:root/,
    /(^|\})\*\{/,
  ])
    assert.doesNotMatch(css, selector);
  for (const rule of css.split('}').filter(r => r.includes('{') && !r.startsWith('@media')))
    assert.match(rule.replace(/^@media[^{]*\{/, ''), /^\s*\[data-cf="dial-1"\]/, rule);
});
test('an interrupted owned write can be retried; an edited file is still protected', () =>
  withTemp(async dir => {
    const options = { generator: 'test', manifestName: 'm.json' };
    await writeOwnedSet(dir, { 'a.txt': 'one' }, options);
    // Interrupted after the pending manifest and one new file reached the disk.
    await writeFile(
      path.join(dir, 'm.json.pending'),
      JSON.stringify({
        generator: 'test',
        outputHashes: {
          'a.txt': (await import('../skill/crafted-figures/kit/hash.mjs')).digest('two'),
        },
      }),
    );
    await writeFile(path.join(dir, 'a.txt'), 'two');
    await writeOwnedSet(dir, { 'a.txt': 'three' }, options);
    assert.equal(await readFile(path.join(dir, 'a.txt'), 'utf8'), 'three');
    assert.ok(!(await readdir(dir)).some(name => name.endsWith('.pending')));
    await writeFile(path.join(dir, 'a.txt'), 'edited by hand');
    await assert.rejects(writeOwnedSet(dir, { 'a.txt': 'four' }, options), /unrelated or edited/);
    assert.equal(await readFile(path.join(dir, 'a.txt'), 'utf8'), 'edited by hand');
  }));
test('a standalone HTML bundle only includes WebGL when the figure uses effects', () =>
  withTemp(async dir => {
    for (const [name, expected] of [
      ['dial-indicator', false],
      ['ripple-tank', true],
    ]) {
      const out = path.join(dir, name);
      await buildFigure({
        entry: `examples/${name}/figure.mjs`,
        config: `examples/${name}/figure.config.json`,
        out,
      });
      const html = await readFile(path.join(out, 'figure.html'), 'utf8');
      assert.equal(html.includes('WebGLRenderer'), expected, name);
    }
  }));
test('a bundle carries npm dependencies, with their notices, and rebuilds elsewhere', () =>
  withTemp(async dir => {
    const project = path.join(dir, 'project'),
      dependency = path.join(project, 'node_modules/fake-scale');
    await mkdir(dependency, { recursive: true });
    await writeFile(
      path.join(dependency, 'package.json'),
      JSON.stringify({
        name: 'fake-scale',
        version: '1.0.0',
        type: 'module',
        exports: './index.mjs',
      }),
    );
    await writeFile(path.join(dependency, 'index.mjs'), 'export const scale = v => v * 2;\n');
    await writeFile(path.join(dependency, 'LICENSE'), 'MIT test notice\n');
    await writeFile(
      path.join(project, 'figure.mjs'),
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source text for the written figure
      "import { scale } from 'fake-scale';\nexport default { id: 'dep', capabilities: { detail: ['standard'] }, initialState: { v: 2 }, poses: { rest: { v: 2 } }, render({ state }) { return { viewBox: [0, 0, 100, 50], body: `<text class=\"reading\" x=\"4\" y=\"30\">${scale(state.v)}</text>`, title: 'Dep', description: 'npm import' }; } };\n",
    );
    const share = path.join(dir, 'share');
    await bundleFigure({ entry: path.join(project, 'figure.mjs'), out: share });
    const moved = path.join(dir, 'elsewhere');
    await cp(share, moved, { recursive: true });
    const notice = (await readdir(path.join(moved, 'sources/node_modules/fake-scale'))).includes(
      'LICENSE',
    );
    assert.ok(notice, 'the dependency notice travels with it');
    execFileSync(process.execPath, ['rebuild.mjs'], { cwd: moved, stdio: 'pipe' });
    assert.match(
      await readFile(path.join(moved, 'artifacts/resolved-config.json'), 'utf8'),
      /preset/,
    );
  }));
test('declared clearance uses the real gap, and an edge crossing is a clearance finding', () => {
  const audit = (z, options) => {
    const stage = stageOf(),
      a = k.box('a', { width: 100, depth: 4, height: 4 }),
      b = k.box('b', { width: 4, depth: 100, height: 4 });
    b.position.z = z;
    stage.scene.add(a, b);
    const result = auditScene(stage, options);
    stage.dispose();
    return result.findings.filter(f => f.code === 'SOLID_CLEARANCE');
  };
  assert.equal(audit(4.1, { clearances: [{ a: 'a', b: 'b', min: 2 }] }).length, 1);
  assert.ok(
    Math.abs(audit(4.1, { clearances: [{ a: 'a', b: 'b', min: 2 }] })[0].measured - 0.1) < 1e-6,
  );
  assert.equal(audit(10, { clearances: [{ a: 'a', b: 'b', min: 2 }] }).length, 0);
  assert.ok(audit(2.5, {})[0].measured < -1, 'crossing bars have no vertex inside each other');
  assert.equal(audit(4.1, { clearanceScope: 'declared', clearances: [] }).length, 0);
});
test('a sphere is a sphere: curved tone bands and no dot at its pole', () => {
  const stage = stageOf();
  stage.scene.add(k.sphere('ball', { radius: 30, steps: 12, segments: 32 }));
  const markup = stage.render();
  assert.doesNotMatch(
    markup,
    /d="(M([\d.-]+) ([\d.-]+)(L\2 \3)+Z)"/,
    'a zero-radius ring draws nothing',
  );
  stage.dispose();
});
