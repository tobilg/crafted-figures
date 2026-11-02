import { measure, poses } from './model.mjs';

/** One scene for the static drawing and the live figure. */
export function createScale({ kit, config }) {
  const k = kit.illustration,
    standard = config.detail === 'standard';
  const stage = k.createStage({
    width: 600,
    height: 470,
    bounds: [
      ...k.boxBounds([-96, -76, 0], [96, 76, 8]),
      ...k.boxBounds([-48, -40, 8], [48, 40, 84]),
      ...k.boxBounds([-44, -44, 92], [44, 44, 136]),
    ],
    padding: { top: 16, right: 20, bottom: 44, left: 20 },
    strokeWidth: config.stroke.width,
    ground: 8,
  });
  const add = (part, x, y, z, parent = stage.scene) => {
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  };

  // The shadow lands on the board, because its top is the ground plane above. It also gives the
  // lemon somewhere to wait.
  const board = add(k.box('board', { width: 192, depth: 152, height: 8, radius: 10 }), 0, 0, 4);
  k.material(board, 'wood');
  if (standard)
    for (const y of [-58, -30, 2, 34, 60])
      k.mark(
        board,
        [
          [-88, y, 4.01],
          [-40, y + 3, 4.01],
          [30, y - 2, 4.01],
          [88, y + 2, 4.01],
        ],
        { width: 0.6, reason: 'wood grain' },
      );

  for (const [i, [x, y]] of [
    [-38, -30],
    [38, -30],
    [-38, 30],
    [38, 30],
  ].entries())
    k.material(add(k.cylinder(`foot-${i}`, { radius: 5, height: 4 }), x, y, 10), 'charcoal');

  const body = add(k.box('body', { width: 96, depth: 80, height: 70, radius: 12 }), 0, 0, 47);
  k.material(body, 'mint', { role: 'body' });
  const collar = add(k.cylinder('collar', { radius: 16, height: 4 }), 0, 0, 84);
  k.material(collar, 'chrome');

  // The dial faces +Y. Its local +Z points out of the face and local -Y points up the page.
  const bezel = k.cylinder('bezel', { radius: 30, height: 3 });
  k.along(bezel, [0, 40, 46], [0, 43, 46]);
  k.material(bezel, 'chrome');
  stage.scene.add(bezel);
  const face = k.cylinder('dial', { radius: 26, height: 1 });
  k.along(face, [0, 43, 46], [0, 44, 46]);
  k.material(face, 'cream');
  stage.scene.add(face);
  k.ticks(face, {
    radius: 24,
    z: 0.51,
    count: 60,
    every: 10,
    major: 5,
    minor: 2,
    from: (5 * Math.PI) / 6,
    span: (-5 * Math.PI) / 3,
    compact: !standard,
  });
  k.label(face, 'GRAMS', { at: [8.5, 9, 0.52], u: [-1, 0, 0], v: [0, 1, 0], size: 5 });
  const needle = k.mark(
    face,
    [
      [0, 0, 0.53],
      [0, -20, 0.53],
    ],
    { accent: true, width: 3, part: 'needle', reason: 'needle tip swings free over the scale' },
  );
  const hub = k.cylinder('needle-hub', { radius: 2.4, height: 1 });
  k.along(hub, [0, 44, 46], [0, 45, 46]);
  k.material(hub, 'charcoal');
  stage.scene.add(hub);

  // Printed on the left face, away from the dial.
  k.label(body, 'HOME SCALE', {
    at: [48.02, -26, 2],
    u: [0, 1, 0],
    v: [0, 0, -1],
    normal: [1, 0, 0],
    size: 7,
  });
  if (standard)
    for (const [i, z] of [-20, -24, -28].entries())
      k.mark(
        body,
        [
          [48.02, 24, z],
          [48.02, -24 + i * 4, z],
        ],
        { normal: [1, 0, 0], width: 0.8, reason: 'printed vent line' },
      );

  const tare = k.knob('tare-knob', { radius: 7, height: 5, count: standard ? 24 : 0 });
  k.along(tare, [33, 40, 16], [33, 45, 16]);
  k.material(tare, 'tomato');
  stage.scene.add(tare);

  // The column stretches between the collar and the pan, as the pan rides down over it.
  const column = add(k.cylinder('column', { radius: 7, height: 1 }), 0, 0, 87);
  k.material(column, 'chrome');
  const load = new k.Group();
  load.name = 'load';
  stage.scene.add(load);
  const pan = add(
    k.revolve('pan', {
      profile: [
        [-3, 18],
        [0, 36],
        [2, 40],
      ],
    }),
    0,
    0,
    0,
    load,
  );
  k.material(pan, 'steel');
  const rim = pan.children.at(-1);
  k.mark(rim, k.ringPoints(36, 1.01), { closed: true, width: 0.8 });
  k.mark(rim, k.ringPoints(30, 1.01), { closed: true, width: 0.6 });

  /** Shoulders wider than the base, a flat seat, and a shallow top around the stem. */
  const appleRadius = radius => z => {
    const u = z / radius;
    return radius * Math.max(0, 1 - u * u) ** 0.42 * (1 + 0.1 * u);
  };
  const apple = (i, x, y, radius, turn) => {
    const seat = radius * 0.86,
      group = new k.Group();
    group.name = `apple-${i}`;
    group.position.set(x, y, 2 + seat);
    load.add(group);
    const fruit = k.profile(`apple-${i}-fruit`, {
        radius: appleRadius(radius),
        zMin: -seat,
        zMax: radius * 0.93,
        steps: 14,
        segments: 48,
        tolerance: 0.1,
        raisedLight: true,
      }),
      cap = fruit.children.at(-1),
      [capX, capY, capZ] = cap.userData.illustration.top[0],
      base = [0, 0, radius * 0.93 + 0.2],
      tip = [Math.cos(turn) * 1.4, Math.sin(turn) * 1.4, radius * 0.93 + 6],
      stem = k.cylinder(`apple-${i}-stem`, {
        radius: 0.7,
        topRadius: 1,
        height: Math.hypot(tip[0], tip[1], tip[2] - base[2]),
        segments: 16,
      }),
      leaf = k.prism(`apple-${i}-leaf`, {
        plan: [
          [2, 0],
          [4.5, -2],
          [8, -2.6],
          [11, -1.6],
          [13, 0],
          [11, 1.6],
          [8, 2.6],
          [4.5, 2],
        ],
        height: 0.5,
      }),
      sprig = new k.Group();
    k.mark(cap, k.ringPoints(Math.hypot(capX, capY) * 0.62, capZ + 0.01, 24), {
      closed: true,
      width: 0.7,
    });
    k.along(stem, base, tip);
    sprig.name = `apple-${i}-sprig`;
    sprig.position.set(Math.cos(turn), Math.sin(turn), radius * 0.93 + 3.4);
    sprig.rotation.z = turn + 1.9;
    leaf.rotation.y = -0.42;
    k.material(fruit, 'tomato');
    k.material(stem, 'wood');
    k.material(leaf, 'teal');
    sprig.add(leaf);
    group.add(fruit, stem, sprig);
    return group;
  };
  const apples = [
    apple(0, -17, -11, 12.5, 2.4),
    apple(1, 16, -14, 11.5, 0.5),
    apple(2, 2, 18, 12, 4.1),
  ];

  // The next thing to weigh waits on the board, lying on its side.
  const lemon = k.profile('lemon', {
    radius: z => 10.5 * Math.max(0, 1 - (z / 14) ** 2) ** 0.62,
    zMin: -14,
    zMax: 14,
    steps: 12,
    segments: 32,
    tolerance: 0.1,
    raisedLight: true,
  });
  lemon.position.set(-72, 50, 8 + 10.5);
  lemon.rotation.set(Math.PI / 2, 0, 0.5);
  k.material(lemon, 'mustard');
  stage.scene.add(lemon);

  const PAN_REST = 106;
  function update(state) {
    const m = measure(state),
      panZ = PAN_REST - m.sink;
    load.position.z = panZ;
    column.scale.z = panZ - 3 - 86;
    column.position.z = (panZ - 3 + 86) / 2;
    for (const [i, part] of apples.entries()) part.visible = i < m.onPan;
    const a = (m.needleDeg * Math.PI) / 180,
      start = (5 * Math.PI) / 6,
      angle = start - a;
    needle.points = [
      [-Math.sin(angle) * 4, Math.cos(angle) * 4, 0.53],
      [Math.sin(angle) * 20, -Math.cos(angle) * 20, 0.53],
    ];
    needle.angle = m.needleDeg;
    stage.callouts?.update(m);
    stage.scene.updateMatrixWorld(true);
    return m;
  }
  k.callouts(
    stage,
    [
      {
        id: 'pan',
        label: 'Pan',
        description: 'Carries the load and sinks with it, pressing a spring inside the body.',
        part: pan,
        at: [33, -18, 1],
        active: m => m.onPan > 0,
      },
      {
        id: 'dial',
        label: 'Dial',
        description: 'A rack on the column turns this needle by as much as the pan sinks.',
        part: face,
        at: [12, 12, 0.5],
      },
      {
        id: 'tare',
        label: 'Tare knob',
        description: 'Sets the needle back to zero, so a bowl does not count toward the reading.',
        part: tare,
      },
    ],
    { pose: () => update(poses.rest) },
  );
  return { ...stage, update };
}
