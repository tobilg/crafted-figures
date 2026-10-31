import { measure } from './model.mjs';
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 760,
      height: 540,
      reservedBottom: 45,
      bounds: k.boxBounds([-87, -76, -5], [76, 76, 20]),
      config,
      tokens,
    });
  const floor = k.box('backplane', { width: 152, depth: 152, height: 5, radius: 3 });
  floor.position.z = -2.5;
  s.scene.add(floor);
  const moving = [],
    rods = [];
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 10; col++) {
      const x = -67.5 + col * 15,
        y = -67.5 + row * 15,
        id = `module-${row}-${col}`;
      const body = k.box(id, { width: 10, depth: 9, height: 3, radius: 1 });
      body.position.set(x, y, 1.5);
      s.scene.add(body);
      const rod = k.cylinder(`${id}-rod`, { radius: 1.2, height: 1, segments: 16 });
      rod.position.set(x, y, 7);
      s.scene.add(rod);
      rods.push(rod);
      const plunger = k.cylinder(`${id}-cap`, {
        radius: 3,
        height: 2,
        segments: 24,
        tone: 'accent',
      });
      plunger.position.set(x, y, 4);
      s.scene.add(plunger);
      moving.push(plunger);
    }
  for (let i = 0; i < 4; i++) {
    const y = -67.5 + i * 30;
    const route = k.tube('cable-' + i, {
      points: [
        [-72.5, y, 1.5],
        [-80, y, 1.5],
        [-83, y + 7.5, 1.5],
        [-80, y + 15, 1.5],
        [-72.5, y + 15, 1.5],
      ],
      radius: 0.8,
      segments: 20,
      radialSegments: 12,
    });
    s.scene.add(route);
  }
  function update(state) {
    const m = measure(state);
    for (const [i, o] of moving.entries()) {
      const lift = m.stroke * (0.6 + (0.4 * (i % 10)) / 9);
      o.position.z = 4 + lift;
      rods[i].visible = lift > 1e-5;
      rods[i].scale.z = Math.max(lift, 1e-5);
      rods[i].position.z = 3 + lift / 2;
    }
    return m;
  }
  return { ...s, update, moving };
}
