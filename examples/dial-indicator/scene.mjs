import { measure } from './model.mjs';
/** One Three.js scene for the full dial, shared by Node export and browser motion. */
export function createDial({ kit, config }) {
  const k = kit.illustration,
    standard = config.detail === 'standard';
  const stage = k.createStage({
    width: 600,
    height: 400,
    azimuth: -42,
    bounds: [
      [-128, -53, -20],
      [128, -53, -20],
      [-128, 53, -20],
      [128, 53, -20],
      [-110, -28, 118],
      [12, -33, 111],
      [78, 33, 111],
    ],
    padding: { top: 24, right: 32, bottom: 76, left: 32 },
    strokeWidth: config.stroke.width,
  });
  const add = (part, x, y, z) => {
    part.position.set(x, y, z);
    stage.scene.add(part);
    return part;
  };
  const box = (name, x, y, w, d, z, h, r = 2, tone = 'surface') =>
    add(
      k.box(name, { width: w, depth: d, height: h, radius: r, tone }),
      x + w / 2,
      y + d / 2,
      z + h / 2,
    );
  const cyl = (name, x, y, r, z, h, tone = 'surface') =>
    add(k.cylinder(name, { radius: r, height: h, tone }), x, y, z + h / 2);
  for (const [i, [x, y]] of [
    [-110, -35],
    [110, -35],
    [-110, 35],
    [110, 35],
  ].entries())
    cyl('foot-' + i, x, y, 7, -20, 6);
  const base = box('base', -128, -53, 256, 106, -14, 14, 8);
  if (standard) {
    k.mark(
      base,
      base.userData.illustration.top.map(([x, y, z]) => [x * 0.96, y * 0.9, z + 0.01]),
      { closed: true },
    );
    for (const [x, y] of [
      [-116, -41],
      [116, -41],
      [-116, 41],
      [116, 41],
    ])
      k.mark(
        base,
        k.ringPoints(2, 7.01, 24).map(([a, b, z]) => [a + x, b + y, z]),
        { closed: true },
      );
  }
  box('stand-foot', -110, -28, 40, 38, 0, 15, 3);
  cyl('stand-collar', -90, -10, 6, 15, 5);
  // Visible rod segments meet the clamp faces; no hidden intersecting solids.
  cyl('stand-rod', -90, -10, 3.5, 20, 76);
  cyl('stand-top', -90, -10, 3.5, 109, 9);
  box('stand-clamp', -98, -18, 16, 24, 96, 13, 3);
  box('arm', -82, -4, 98, 8, 99, 6, 1);
  if (standard) {
    const knob = k.cylinder('clamp-knob', { radius: 4.5, height: 6 });
    k.along(knob, [-90, 6, 102.5], [-90, 12, 102.5]);
    stage.scene.add(knob);
  }
  box('stage-foot', 15, -20, 60, 40, 0, 6, 2);
  for (const [i, x] of [19, 71].entries()) cyl('guide-' + i, x, -12, 3, 6, 54);
  const carriage = box('carriage', 22, -18, 46, 36, 6, 10, 2, 'accent');
  carriage.userData.illustration.part = 'carriage';
  const tip = cyl('probe-tip', 45, 0, 3.5, 16, 2, 'accent');
  tip.userData.illustration.part = 'probe-tip';
  const probe = cyl('probe', 45, 0, 2, 18, 1, 'accent');
  probe.userData.illustration.part = 'probe';
  cyl('probe-guide', 45, 0, 4.2, 78, 18);
  // The gauge has a flat mounting face at x=16; the internal scale is circular.
  const angle = Math.acos(-29 / 33),
    plan = Array.from({ length: 97 }, (_, i) => {
      const a = -angle + (2 * angle * i) / 96;
      return [33 * Math.cos(a), 33 * Math.sin(a)];
    });
  const gauge = add(k.prism('gauge', { plan, height: 14 }), 45, 0, 103);
  k.mark(gauge, k.ringPoints(28.5, 7.02), { closed: true });
  k.ticks(gauge, { radius: 27.5, z: 7.03, compact: !standard });
  const needle = k.mark(
    gauge,
    [
      [0, 6, 7.04],
      [0, -25, 7.04],
    ],
    { accent: true, width: 2 / config.stroke.width, part: 'needle' },
  );
  cyl('needle-hub', 45, 0, 2.3, 110.05, 1.2);
  if (standard)
    for (const [x, y] of plan)
      k.mark(
        gauge,
        [
          [x, y, -5],
          [x, y, 3],
        ],
        { width: 0.6, normal: [x, y, 0] },
      );
  function update(state) {
    const m = measure(state),
      bottom = 16 + m.lift;
    carriage.position.z = 11 + m.lift;
    tip.position.z = bottom + 1;
    probe.scale.z = 78 - (bottom + 2);
    probe.position.z = (bottom + 2 + 78) / 2;
    const a = (m.angleDeg * Math.PI) / 180;
    needle.points = [
      [-Math.sin(a) * 6, Math.cos(a) * 6, 7.04],
      [Math.sin(a) * 25, -Math.cos(a) * 25, 7.04],
    ];
    needle.angle = m.angleDeg;
    stage.scene.updateMatrixWorld(true);
    return m;
  }
  return { ...stage, update, carriage, probe, tip, gauge };
}
