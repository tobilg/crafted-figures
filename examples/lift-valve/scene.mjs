import { measure } from './model.mjs';
export function createValve({ kit, config, tokens, rotation = 0 }) {
  const k = kit.illustration,
    stage = k.createStage({
      config,
      tokens,
      reservedBottom: config.schemaVersion === 2 ? 45 : 0,
      width: 600,
      height: 400,
      azimuth: -48,
      bounds: [
        ...k.boxBounds([-110, -50, -8], [110, 50, 0]),
        ...k.boxBounds([-42, -24, 16], [42, 24, 60]),
        ...k.boxBounds([-14, -14, 102], [14, 24, 120]),
      ].map(([x, y, z]) =>
        rotation
          ? [
              x * Math.cos(rotation) - y * Math.sin(rotation),
              x * Math.sin(rotation) + y * Math.cos(rotation),
              z,
            ]
          : [x, y, z],
      ),
      padding: { top: 22, right: 24, bottom: 70, left: 24 },
      strokeWidth: config.stroke.width,
    });
  stage.scene.rotation.z = rotation;
  const add = (o, x, y, z) => {
    o.position.set(x, y, z);
    stage.scene.add(o);
    return o;
  };
  const box = (name, w, d, h, x, y, z, r = 2) =>
    add(k.box(name, { width: w, depth: d, height: h, radius: r }), x, y, z);
  box('bench', 220, 100, 8, 0, 0, -4, 6);
  for (const [i, x] of [-34, 34].entries()) box('leg-' + i, 10, 30, 16, x, 4, 8, 1);
  box('chamber-floor', 84, 48, 8, 0, 0, 20, 3);
  box('chamber-back', 84, 6, 36, 0, 21, 42, 1);
  for (const [i, x] of [-39, 39].entries()) box('chamber-end-' + i, 6, 42, 36, x, -3, 42, 1);
  const seat = add(k.annulus('seat', { radius: 17, innerRadius: 9, height: 10 }), 0, 0, 29);
  const poppet = add(k.cylinder('poppet', { radius: 16, height: 4, tone: 'accent' }), 0, 0, 36);
  const stem = add(k.cylinder('stem', { radius: 2.2, height: 1 }), 0, 0, 56);
  // The back bracket supports the bonnet while the front remains cut away.
  box('bonnet-post', 14, 8, 24, 0, 20, 72, 2);
  box('bonnet-arm', 14, 32, 6, 0, 8, 87, 2);
  const _bonnet = add(
    k.revolve('bonnet', {
      profile: [
        [0, 7],
        [4, 9],
        [8, 7],
        [12, 4],
      ],
    }),
    0,
    0,
    90,
  );
  const handle = add(k.cylinder('handle', { radius: 14, height: 4, tone: 'accent' }), 0, 0, 106);
  const exposed = add(k.cylinder('exposed-stem', { radius: 2.2, height: 1 }), 0, 0, 103);
  for (const [name, sign] of [
    ['inlet', -1],
    ['outlet', 1],
  ]) {
    const points = [
      [sign * 47, 0, 42],
      [sign * 60, 0, 42],
      [sign * 82, 0, 35],
      [sign * 96, 0, 14],
      [sign * 96, 0, 0],
    ];
    stage.scene.add(k.tube(name, { points, radius: 4, segments: 64, radialSegments: 48 }));
    const port = k.cylinder(name + '-collar', { radius: 6, height: 5 });
    k.along(port, [sign * 42, 0, 42], [sign * 47, 0, 42]);
    stage.scene.add(port);
  }
  if (config.detail === 'standard') {
    k.mark(handle, k.ringPoints(10, 2.01), { closed: true });
    for (const x of [-30, 30])
      for (const y of [-15, 15]) {
        const screw = add(k.cylinder(`bolt-${x}-${y}`, { radius: 1.8, height: 1 }), x, y, 24.5);
        k.mark(screw, [
          [-1.2, 0, 0.51],
          [1.2, 0, 0.51],
        ]);
      }
  }
  function update(state) {
    const m = measure(state);
    poppet.position.z = 36 + m.liftMm;
    stem.scale.z = 84 - (38 + m.liftMm);
    stem.position.z = (38 + m.liftMm + 84) / 2;
    handle.position.z = 106 + m.liftMm;
    exposed.scale.z = 2 + m.liftMm;
    exposed.position.z = 102 + (2 + m.liftMm) / 2;
    return m;
  }
  return { ...stage, update, poppet, seat };
}
