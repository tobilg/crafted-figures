import { measure } from './model.mjs';
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 640,
      height: 420,
      reservedBottom: 45,
      bounds: k.boxBounds([-60, -45, -8], [60, 45, 22]),
      config,
      tokens,
    });
  const add = (o, x = 0, y = 0, z = 0) => {
    o.position.set(x, y, z);
    s.scene.add(o);
    return o;
  };
  const floor = add(
    k.box('receiving-plane', { width: 120, depth: 90, height: 6, radius: 3 }),
    0,
    0,
    -3,
  );
  k.material(floor, 'paper', { role: 'tank' });
  for (const [name, width, depth, x, y] of [
    ['back', 120, 4, 0, -43],
    ['front', 120, 4, 0, 43],
    ['left', 4, 82, -58, 0],
    ['right', 4, 82, 58, 0],
  ])
    kit.effects.svgPass(
      k.material(
        add(k.box('rim-' + name, { width, depth, height: 4, radius: 1 }), x, y, 3),
        'steel',
      ),
      { afterLayer: 1 },
    );
  // Water is an explicitly bounded transparent surface, not an opaque depth proxy.
  const water = add(
    kit.effects.effect('water', {
      kind: 'water',
      size: [110, 78, 1],
      layer: 1,
      theme: config.theme,
    }),
    0,
    0,
    3,
  );
  const caustics = add(
    kit.effects.effect('caustics', {
      kind: 'caustics',
      size: [110, 78, 1],
      layer: 0,
      theme: config.theme,
    }),
    0,
    0,
    0.05,
  );
  const obstacle = kit.effects.svgPass(
    add(k.sphere('float', { radius: 6, steps: 20, segments: 48, tone: 'accent' }), 13, -10, 9),
    { afterLayer: 1 },
  );
  const scale = kit.effects.svgPass(
    k.box('submerged-scale', { width: 48, depth: 3, height: 0.2 }),
    { afterLayer: 0 },
  );
  scale.position.set(0, 28, 0.2);
  k.ruler(scale, { from: [-22, -1, 0.1], length: 44, count: 11 });
  s.scene.add(scale);
  const shadow = add(
    kit.effects.effect('float-shadow', {
      kind: 'shadow',
      size: [18, 14, 1],
      layer: 0,
      theme: config.theme,
      intensity: 0.45,
    }),
    19,
    -4,
    0.08,
  );
  const vectors = kit.effects.fallback(new k.Group(), 'water');
  vectors.name = 'wave-symbols';
  // Symbolic static fallback: actual wavefronts on the receiving face.
  for (let i = 0; i < 3; i++) {
    const p = k.annulus('wave-' + i, {
      radius: 8 + i * 5,
      innerRadius: 7.6 + i * 5,
      height: 0.12,
      segments: 48,
      tone: 'accent',
    });
    p.position.set(-20, 5, 0.2 + i * 0.02);
    vectors.add(p);
  }
  kit.effects.fallback(vectors, 'water');
  s.scene.add(vectors);
  function update(state) {
    const m = measure(state);
    kit.effects.surfaceHistory(water, m.history);
    kit.effects.surfaceHistory(caustics, m.history);
    water.material.uniforms.uIntensity.value = m.amplitude;
    caustics.material.uniforms.uIntensity.value = m.amplitude * 0.8;
    obstacle.position.z = 9 + Math.sin(m.phase) * 0.5;
    shadow.position.set(
      13 + (obstacle.position.z - 6) * 0.35,
      -10 + (obstacle.position.z - 6) * 0.35,
      0.08,
    );
    return m;
  }
  return { ...s, update };
}
