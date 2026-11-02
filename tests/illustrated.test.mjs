import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindKit } from '../skill/crafted-figures/kit/bind.mjs';
import { wrapSVG } from '../skill/crafted-figures/kit/build.mjs';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import * as kit from '../skill/crafted-figures/kit/index.mjs';
import { builtInMaterials, materialIds } from '../skill/crafted-figures/kit/materials.mjs';
import { styleSheet } from '../skill/crafted-figures/kit/styles.mjs';

const layer = value => [{ label: 'test', value }];
const resolve = value => resolveConfig({ layers: layer(value) });

async function stageWith(value, options = {}) {
  const { config, tokens } = await resolve(value),
    k = kit.illustration,
    stage = k.createStage({
      config,
      tokens,
      bounds: k.boxBounds([-60, -60, 0], [60, 60, 40]),
      ...options,
    }),
    board = k.box('board', { width: 120, depth: 120, height: 4 }),
    block = k.box('block', { width: 30, depth: 30, height: 30 });
  board.position.z = 2;
  block.position.z = 19;
  stage.scene.add(board, block);
  stage.scene.updateMatrixWorld(true);
  return { stage, block };
}

test('selecting the illustrated preset selects schema 2 and its finish', async () => {
  const { config, tokens } = await resolve({ preset: 'illustrated' });
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.frame, 'minimal');
  assert.deepEqual(config.finish, {
    contour: 2,
    groundShadow: true,
    light: 'view',
    shading: 'smooth',
  });
  assert.equal(tokens.shadow, '#2f4ea3');
  const dark = await resolve({ preset: 'illustrated', theme: 'dark' });
  assert.notEqual(dark.tokens.shadow, tokens.shadow);
});

test('an explicit schema 1 cannot select a preset that needs schema 2, and says why', async () => {
  await assert.rejects(resolve({ schemaVersion: 1, preset: 'illustrated' }), /schemaVersion 2/);
});

test('one finish field can be overridden and the others stay', async () => {
  const { config } = await resolve({ preset: 'illustrated', finish: { groundShadow: false } });
  assert.equal(config.finish.groundShadow, false);
  assert.equal(config.finish.contour, 2);
  await assert.rejects(resolve({ schemaVersion: 2, finish: { contour: 9 } }), /finish/);
  await assert.rejects(resolve({ schemaVersion: 1, finish: { contour: 2 } }), /finish/);
});

test('a figure without a finish carries none of its markup', async () => {
  for (const value of [{}, { schemaVersion: 2 }, { schemaVersion: 2, preset: 'editorial' }]) {
    const { config, tokens } = await resolve(value),
      css = styleSheet(config, tokens),
      svg = wrapSVG(
        { viewBox: [0, 0, 10, 10], body: '<g/>', title: 't', description: 'd' },
        config,
        tokens,
      );
    for (const text of ['ground-shadow', '--cf-line', '--cf-contour', '.m-'])
      assert.ok(!css.includes(text), text);
    assert.ok(!svg.includes('--cf-line'));
  }
  const { stage } = await stageWith({ schemaVersion: 2 });
  assert.ok(!stage.render().includes('data-ground-shadow'));
  stage.dispose();
});

test('a shadow lands on the ground plane and paints above what receives it', async () => {
  const { stage } = await stageWith({ preset: 'illustrated' }, { ground: 4 }),
    drawing = stage.render(),
    board = drawing.indexOf('data-object="board"'),
    shadow = drawing.indexOf('data-ground-shadow'),
    block = drawing.indexOf('data-object="block"');
  assert.ok(board >= 0 && board < shadow && shadow < block, 'board, then shadow, then block');
  assert.equal(stage.renderer.shadowIndex, 1);
  // The board receives the shadow, so only the block casts one, and it stops at the board's edge.
  assert.equal(stage.renderer.shadowPath.match(/M/g).length, 1);
  assert.equal(stage.renderer.shadowSurface.match(/M/g).length, 1);
  assert.match(drawing, /<clipPath id="ground-surface">/);
  assert.match(drawing, /clip-path="url\(#ground-surface\)"/);
  stage.dispose();
});

test('with no receiver the shadow paints first and every part casts', async () => {
  const { stage } = await stageWith({ preset: 'illustrated' }),
    drawing = stage.render();
  assert.ok(drawing.indexOf('data-ground-shadow') < drawing.indexOf('data-object='));
  assert.equal(stage.renderer.shadowIndex, 0);
  assert.equal(stage.renderer.shadowPath.match(/M/g).length, 2);
  assert.ok(!drawing.includes('ground-surface'), 'on bare ground the shadow runs free');
  stage.dispose();
});

test('the shadow follows a part as it rises and is byte-stable for one state', async () => {
  const { stage, block } = await stageWith({ preset: 'illustrated' }, { ground: 4 }),
    first = stage.render(),
    resting = stage.renderer.shadowPath;
  assert.equal(stage.render(), first);
  block.position.z = 60;
  stage.scene.updateMatrixWorld(true);
  stage.render();
  assert.notEqual(stage.renderer.shadowPath, resting);
  stage.dispose();
});

test('the camera frames the shadow as well as the bounds', async () => {
  const plain = await stageWith({ schemaVersion: 2 }),
    shaded = await stageWith({ preset: 'illustrated' }),
    span = stage => stage.camera.right - stage.camera.left;
  assert.ok(span(shaded.stage) > span(plain.stage));
  const { stage } = shaded;
  stage.render();
  for (const [x, y] of stage.renderer.shadowPath
    .matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)
    .map(m => [Number(m[1]), Number(m[2])])) {
    assert.ok(x >= 0 && x <= stage.width, `x ${x}`);
    assert.ok(y >= 0 && y <= stage.height, `y ${y}`);
  }
  plain.stage.dispose();
  stage.dispose();
});

test('view light makes the two visible sides differ at any azimuth', async () => {
  for (const azimuth of [42, -42, 135]) {
    const { stage } = await stageWith({ preset: 'illustrated' }, { azimuth }),
      block = stage.render().match(/data-object="block"[\s\S]*?<\/g>/)[0],
      sides = new Set(block.match(/side-\d/g));
    assert.deepEqual([...sides].sort(), ['side-0', 'side-3'], `azimuth ${azimuth}`);
    stage.dispose();
  }
  // The fixed world light leaves both sides dark at this azimuth, which is why it is optional.
  const { stage } = await stageWith({ schemaVersion: 2 }, { azimuth: -42 }),
    block = stage.render().match(/data-object="block"[\s\S]*?<\/g>/)[0];
  assert.deepEqual([...new Set(block.match(/side-\d/g))], ['side-0']);
  stage.dispose();
});

test('enamels are complete in both themes and resolve through a material', async () => {
  for (const id of ['cream', 'tomato', 'mint', 'teal', 'mustard', 'sky', 'wood', 'charcoal']) {
    assert.ok(materialIds.includes(id));
    for (const theme of ['light', 'dark']) {
      const ramp = builtInMaterials[id].themes[theme];
      assert.equal(ramp.stroke, '#1d1915');
      assert.notEqual(ramp.side0, ramp.side3);
    }
  }
  const { stage, block } = await stageWith({ preset: 'illustrated' });
  kit.illustration.material(block, 'tomato');
  assert.match(stage.render(), /class="solid m-tomato"/);
  const { config, tokens } = await resolve({ preset: 'illustrated' });
  assert.match(
    styleSheet(config, tokens),
    /\.m-tomato\{--cf-surface:var\(--cf-material-tomato-surface\)/,
  );
  stage.dispose();
});

test('a shadow length setting changes the cast, within its limits', async () => {
  const shadowOf = async finish => {
    const { stage } = await stageWith({ preset: 'illustrated', finish }),
      span = stage.camera.right - stage.camera.left;
    stage.render();
    const path = stage.renderer.shadowPath;
    stage.dispose();
    return { path, span };
  };
  const short = await shadowOf({ shadowLength: 0.2 }),
    long = await shadowOf({ shadowLength: 1.2 });
  assert.notEqual(short.path, long.path);
  assert.ok(long.span > short.span);
  await assert.rejects(shadowOf({ shadowLength: 3 }), /finish/);
});

test('a color names a new enamel material, and cannot replace an existing one', async () => {
  const { materials, tokens } = await resolve({
    preset: 'illustrated',
    materials: { colors: { water: '#4aa3d8' } },
  });
  assert.ok(materials.has('water'));
  assert.equal(tokens['material-water-surface'], '#4aa3d8');
  await assert.rejects(
    resolve({ preset: 'illustrated', materials: { colors: { tomato: '#000000' } } }),
    /exists/,
  );
});

test('a build reports every clash in a pose at once, with where and how to fix it', async () => {
  const { config, tokens } = await resolve({ schemaVersion: 2 }),
    k = kit.illustration,
    stage = k.createStage({ config, tokens, bounds: k.boxBounds([-60, -60, 0], [60, 60, 60]) });
  // A rod through a ring is interleaved: near and far rays disagree about which is in front.
  for (const [name, x] of [
    ['a', -30],
    ['b', 30],
  ]) {
    const ring = k.annulus(`ring-${name}`, { radius: 14, innerRadius: 8, height: 4 }),
      rod = k.cylinder(`rod-${name}`, { radius: 3, height: 40 });
    ring.position.set(x, 0, 20);
    rod.position.set(x, 0, 20);
    stage.scene.add(ring, rod);
  }
  stage.scene.updateMatrixWorld(true);
  assert.throws(
    () => stage.renderer.render(stage.scene, stage.camera),
    error => {
      assert.equal(error.message.match(/interleaved primitives/g).length, 2);
      assert.match(error.message, /overlap [\d.]+x[\d.]+ px at [\d.]+,[\d.]+/);
      assert.match(error.message, /split the physical geometry/);
      return true;
    },
  );
  stage.dispose();
});

test('a tick mark records why its ends are free, so the line check accepts it', () => {
  const k = kit.illustration,
    face = k.cylinder('face', { radius: 10, height: 1 });
  k.ticks(face, { radius: 9, z: 0.51, count: 4, every: 1 });
  assert.ok(face.userData.illustration.details.every(d => d.reason === 'printed graduation'));
});

test('smooth shading adds tints without changing which tone a surface is', async () => {
  const k = kit.illustration,
    render = async value => {
      const { config, tokens } = await resolve(value),
        stage = k.createStage({ config, tokens, bounds: k.boxBounds([-60, -60, 0], [60, 60, 60]) }),
        ball = k.sphere('ball', { radius: 20, steps: 8, segments: 32 }),
        tall = k.box('tall', { width: 20, depth: 20, height: 50, radius: 4 });
      ball.position.set(-30, 0, 20);
      tall.position.set(30, 0, 25);
      stage.scene.add(ball, tall);
      stage.scene.updateMatrixWorld(true);
      const drawing = stage.render();
      stage.dispose();
      return drawing;
    },
    smooth = await render({ preset: 'illustrated' }),
    flat = await render({ preset: 'illustrated', finish: { shading: 'flat' } });
  assert.ok(new Set(smooth.match(/\bk\d+\b/g)).size >= 8, 'a curve crosses many tints');
  assert.match(smooth, /class="side-\d k\d+"/);
  assert.match(smooth, /class="top u\d"/);
  assert.match(smooth, /<path class="falloff" fill="url\(#falloff\)"/);
  assert.match(smooth, /<linearGradient id="falloff"/);
  for (const text of ['falloff', 'color-mix']) assert.ok(!flat.includes(text), text);
  assert.ok(!/\bk\d+\b/.test(flat));
  const { config, tokens } = await resolve({ preset: 'illustrated' }),
    css = styleSheet(config, tokens);
  for (const rule of ['.solid .k0', '.solid .k24', '.solid .u3', '.falloff{pointer-events:none}'])
    assert.ok(css.includes(rule), rule);
});

test('a rounded corner gets more facets as it grows, only under smooth shading', async () => {
  const facets = async (value, radius) => {
    const { config, tokens } = await resolve(value),
      k = bindKit(kit, { config, tokens }).illustration,
      part = k.box('part', { width: 60, depth: 60, height: 10, radius });
    return part.userData.illustration.top.length;
  };
  assert.equal(await facets({ schemaVersion: 2 }, 12), 36, 'other figures keep their geometry');
  assert.equal(await facets({}, 12), 36);
  assert.equal(await facets({ preset: 'illustrated' }, 2), 36, 'a small corner stays cheap');
  assert.equal(await facets({ preset: 'illustrated' }, 12), 4 * 31);
  assert.equal(await facets({ preset: 'illustrated' }, 28), 4 * 33, 'the count has a ceiling');
  const { config, tokens } = await resolve({ preset: 'illustrated' }),
    k = bindKit(kit, { config, tokens }).illustration;
  assert.equal(
    k.box('own', { width: 60, depth: 60, height: 10, radius: 12, cornerSegments: 4 }).userData
      .illustration.top.length,
    20,
    'an author can choose',
  );
  assert.throws(
    () => k.box('bad', { width: 9, depth: 9, height: 9, cornerSegments: 0 }),
    /cornerSegments/,
  );
});

test('a painter cycle names only the parts in the cycle', () => {
  const k = kit.illustration,
    stage = k.createStage({
      azimuth: 45,
      elevation: 35.264,
      bounds: k.boxBounds([-40, -40, -40], [40, 40, 70]),
    }),
    rod = (name, size, position) => {
      const part = k.box(name, { width: size[0], depth: size[1], height: size[2] });
      part.position.set(...position);
      stage.scene.add(part);
    };
  // Seen along the diagonal, each rod passes in front of the next and behind the one before.
  rod('rod-x', [60, 3, 3], [0, 0, 10]);
  rod('rod-y', [3, 60, 3], [10, 0, 0]);
  rod('rod-z', [3, 3, 60], [0, 10, 0]);
  // This one is in front of all three, so it cannot be placed either, but it is not the problem.
  rod('front', [50, 50, 3], [0, 0, 60]);
  stage.scene.updateMatrixWorld(true);
  assert.throws(
    () => stage.renderer.render(stage.scene, stage.camera),
    error => {
      assert.match(
        error.message,
        /cyclic SVG painter order: rod-\w -> rod-\w -> rod-\w -> rod-\w,/,
      );
      assert.ok(!error.message.includes('front'), error.message);
      return true;
    },
  );
  stage.dispose();
});

test('a flat top receives the shadows of what stands above it', async () => {
  const k = kit.illustration,
    { config, tokens } = await resolve({ preset: 'illustrated' }),
    stage = k.createStage({ config, tokens, bounds: k.boxBounds([-60, -60, 0], [60, 60, 50]) }),
    table = k.box('table', { width: 80, depth: 80, height: 4 }),
    ball = k.sphere('ball', { radius: 8, steps: 8, segments: 32, tolerance: 0.1 }),
    speck = k.box('speck', { width: 3, depth: 3, height: 2 });
  table.position.z = 20;
  ball.position.z = 30;
  speck.position.set(0, 0, 45);
  stage.scene.add(table, ball, speck);
  stage.scene.updateMatrixWorld(true);
  const first = stage.render(),
    onTable = first.match(
      /data-object="table"[\s\S]*?<\/g><\/g>|data-object="table"[\s\S]*?part-shadow/,
    )[0];
  assert.match(onTable, /part-shadow/);
  assert.match(first, /<clipPath id="top-table">/);
  assert.ok(!first.includes('top-speck'), 'too small a top to show a shadow');
  assert.equal(stage.render(), first, 'stable for one state');
  ball.position.z = 35;
  stage.scene.updateMatrixWorld(true);
  assert.notEqual(stage.render(), first, 'the shadow follows the part');
  stage.dispose();
});
