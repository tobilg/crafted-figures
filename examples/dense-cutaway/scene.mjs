export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 760,
      height: 540,
      bounds: k.boxBounds([-78, -78, -5], [78, 78, 20]),
      config,
      tokens,
    });
  const floor = k.box('backplane', { width: 156, depth: 156, height: 5, radius: 3 });
  floor.position.z = -2.5;
  s.scene.add(floor);
  const wall = k.box('cutaway-wall', { width: 156, depth: 3, height: 20 });
  wall.position.set(0, -76.5, 10);
  s.scene.add(wall);
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 10; col++) {
      const body = k.box(`terminal-${row}-${col}`, { width: 10, depth: 9, height: 5, radius: 1 });
      body.position.set(-67.5 + col * 15, -67.5 + row * 15, 2.5);
      k.material(body, 'steel');
      s.scene.add(body);
    }
  for (let row = 0; row < 10; row++)
    for (let pair = 0; pair < 5; pair++) {
      const x = -67.5 + pair * 30,
        y = -67.5 + row * 15;
      const route = k.tube(`jumper-${row}-${pair}`, {
        points: [
          [x, y, 5],
          [x, y, 7.5],
          [x + 5, y, 10],
          [x + 10, y, 10],
          [x + 15, y, 7.5],
          [x + 15, y, 5],
        ],
        radius: 0.55,
        segments: 12,
        radialSegments: 12,
      });
      k.material(route, 'copper');
      s.scene.add(route);
    }
  return {
    ...s,
    update: () => ({ reading: '100 terminals · 50 seated jumpers · static cutaway' }),
  };
}
