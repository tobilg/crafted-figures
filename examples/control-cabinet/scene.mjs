import { measure } from './model.mjs';
export function createCabinet({ kit, config }) {
  const k = kit.illustration,
    stage = k.createStage({
      width: 600,
      height: 420,
      azimuth: -48,
      bounds: k.boxBounds([-78, -36, 0], [78, 34, 108]),
      padding: { top: 24, right: 36, bottom: 80, left: 36 },
      strokeWidth: config.stroke.width,
    });
  const add = (o, x, y, z) => {
    o.position.set(x, y, z);
    stage.scene.add(o);
    return o;
  };
  const box = (name, w, d, h, x, y, z, r = 0) =>
    add(k.box(name, { width: w, depth: d, height: h, radius: r }), x, y, z);
  box('floor', 156, 70, 6, 0, -1, 3, 3);
  box('left-wall', 6, 66, 102, -75, 1, 57);
  box('back-wall', 144, 6, 102, 0, 31, 57);
  box('right-cut-wall', 6, 66, 28, 75, 1, 20);
  const bus = box('supply-bus', 132, 6, 6, 0, 23, 95, 1);
  k.label(bus, 'CONTROL BUS', { at: [-46, -2.5, 3.01], size: 5 });
  const bridges = [],
    pushers = [];
  for (const [i, x] of [-48, 0, 48].entries()) {
    const module = box('relay-' + i, 36, 30, 54, x, 0, 33, 2);
    k.label(module, `${20 + i * 10} °C`, {
      at: [-13, -15.02, 10],
      u: [1, 0, 0],
      v: [0, 0, -1],
      normal: [0, -1, 0],
      size: 6,
    });
    for (const [j, offset] of [-8, 8].entries())
      add(k.cylinder(`terminal-${i}-${j}`, { radius: 2.6, height: 4 }), x + offset, -9, 62);
    const bridge = add(
      k.box('bridge-' + i, { width: 20, depth: 3, height: 1.5, radius: 0.6, tone: 'accent' }),
      x,
      -9,
      70.75,
    );
    bridge.userData.illustration.part = 'contact-' + i;
    bridges.push(bridge);
    pushers.push(add(k.cylinder('pusher-' + i, { radius: 1.3, height: 1 }), x, -9, 65));
    add(k.cylinder('wire-port-' + i, { radius: 3, height: 4 }), x, 10, 62);
    stage.scene.add(
      k.tube('wire-' + i, {
        points: [
          [x, 10, 64],
          [x, 10, 70],
          [x + 10, 15, 80],
          [x + 10, 23, 82],
          [x, 23, 86],
          [x, 23, 92],
        ],
        radius: 1.8,
        segments: 64,
        radialSegments: 48,
        tone: 'accent',
      }),
    );
    if (config.detail === 'standard')
      for (let j = 0; j < 3; j++)
        k.mark(
          module,
          [
            [-12, -15.01, -14 + j * 7],
            [12, -15.01, -14 + j * 7],
          ],
          { normal: [0, -1, 0] },
        );
  }
  function update(state) {
    const m = measure(state);
    m.closed.forEach((closed, i) => {
      const lift = closed ? 0 : 6;
      bridges[i].position.z = 64.75 + lift;
      bridges[i].userData.illustration.tone = closed ? 'accent' : 'surface';
      pushers[i].scale.z = 4 + lift;
      pushers[i].position.z = 60 + (4 + lift) / 2;
    });
    return m;
  }
  return { ...stage, update, bridges };
}
