import { measure } from './model.mjs';
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 700,
      height: 560,
      reservedBottom: 50,
      bounds: k.boxBounds([-75, -45, -55], [75, 45, 225]),
      config,
      tokens,
      padding: 38,
      strokeWidth: config.stroke.width,
    });
  const add = (o, x = 0, y = 0, z = 0) => {
    o.position.set(x, y, z);
    s.scene.add(o);
    return o;
  };
  k.material(
    add(k.box('base', { width: 150, depth: 90, height: 8, radius: 6 }), 0, 0, -51),
    'gunmetal',
    { role: 'stand' },
  );
  for (const x of [-60, 60]) {
    k.material(add(k.cylinder('post-' + x, { radius: 5, height: 130 }), x, 0, 18), 'steel');
    add(k.box('bridge-' + x, { width: 36, depth: 12, height: 8, radius: 2 }), x / 1.5, 0, 87);
  }
  for (const sign of [-1, 1])
    k.material(
      add(k.box('chamber-rail-' + sign, { width: 37, depth: 8, height: 6 }), sign * 36.5, 0, 58),
      'steel',
    );
  const nozzle = k.profile('nozzle', {
    zMin: 0,
    zMax: 40,
    steps: 32,
    segments: 64,
    radius: z => 7 + 11 * (z / 40 - 0.55) ** 2 * 3,
  });
  add(nozzle, 0, 0, 6);
  k.material(nozzle, 'chrome', { role: 'engine' });
  const body = add(k.cylinder('chamber', { radius: 18, height: 24 }), 0, 0, 58);
  k.material(body, 'copper', { role: 'engine' });
  const groups = ['a', 'b', 'c'].map((key, i) => {
    const g = new k.Group();
    g.name = 'assembly-' + key;
    g.position.z = 72 + i * 6;
    g.add(
      k.annulus('flange-' + key, { radius: 21, innerRadius: 8, height: 4 }),
      k.boltCircle('fasteners-' + key, { radius: 15, z: 2, count: 6, boltRadius: 1.3 }),
    );
    s.scene.add(g);
    k.material(g, i === 1 ? 'brass' : 'steel', { role: 'engine' });
    return g;
  });
  // Four separated service circuits connect the fixed chamber to the stand.
  // Distinct radial departures and vertical terminal approaches avoid false joints.
  for (const [i, degrees] of [-160, -135, -110, -85].entries()) {
    const a = (degrees * Math.PI) / 180,
      z = 52 + i * 4,
      x = [-42, -20, 10, 38][i],
      y = [-20, -28, -36, -40][i];
    const route = k.tube('service-line-' + i, {
      points: [
        [18 * Math.cos(a), 18 * Math.sin(a), z],
        [28 * Math.cos(a), 28 * Math.sin(a), z],
        [x, y, 24],
        [x, y, -35],
        [x, y, -47],
      ],
      radius: 1.4,
      segments: 64,
      radialSegments: 48,
    });
    k.material(route, 'rubber', { role: 'hoses' });
    k.routeRings(route, { every: 4 });
    s.scene.add(route);
  }
  const fire = add(
    kit.effects.effect('exhaust', {
      kind: 'fire',
      size: [34, 34, 56],
      theme: config.theme,
      quality: config.rendering?.quality,
    }),
    0,
    0,
    -22,
  );
  fire.rotation.x = Math.PI;
  const steam = add(
    kit.effects.effect('steam', {
      kind: 'steam',
      size: [36, 30, 48],
      theme: config.theme,
      layer: 1,
    }),
    38,
    0,
    100,
  );
  const fireFallback = add(
    kit.effects.fallback(
      k.cylinder('exhaust-vector', { radius: 2, topRadius: 12, height: 40, tone: 'accent' }),
      'exhaust',
    ),
    0,
    0,
    -14,
  );
  const steamFallback = add(
    kit.effects.fallback(k.sphere('steam-vector', { radius: 5, steps: 12, segments: 32 }), 'steam'),
    38,
    0,
    100,
  );
  function update(state) {
    const m = measure(state, k.springTimeline);
    groups.forEach((g, i) => {
      g.position.z =
        72 +
        i * 6 +
        40 * ['a', 'b', 'c'].slice(0, i + 1).reduce((sum, key) => sum + m.shares[key], 0);
    });
    fire.material.uniforms.uIntensity.value = m.throttle;
    steam.material.uniforms.uIntensity.value = m.throttle * 0.6;
    fireFallback.visible = steamFallback.visible = m.throttle > 0.01;
    return m;
  }
  return { ...s, update };
}
