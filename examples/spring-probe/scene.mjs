import { measure } from './model.mjs';
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 600,
      height: 400,
      reservedBottom: 50,
      bounds: k.boxBounds([-35, -24, -8], [35, 24, 48]),
      config,
      tokens,
    });
  const add = (o, z) => {
    o.position.z = z;
    s.scene.add(o);
    return o;
  };
  add(k.box('base', { width: 70, depth: 48, height: 8, radius: 4 }), -4);
  add(k.cylinder('seat', { radius: 13, height: 3 }), 1.5);
  const rod = add(k.cylinder('rod', { radius: 3, height: 45 }), 25.5);
  k.material(rod, 'chrome', { role: 'metal' });
  let coil = add(
    k.material(
      k.spring('spring', { radius: 8, wireRadius: 0.65, height: 30, turns: 5, segments: 240 }),
      'steel',
      { role: 'metal' },
    ),
    3.65,
  );
  const plate = add(
    k.splitAnnulus('platen', { radius: 13, innerRadius: 3.3, height: 4, tone: 'accent' }),
    36.3,
  );
  let last = 30;
  function update(state) {
    const m = measure(state);
    if (m.height !== last) {
      coil = k.replacePart(
        coil,
        k.material(
          k.spring('spring', {
            radius: 8,
            wireRadius: 0.65,
            height: m.height,
            turns: 5,
            segments: 240,
          }),
          'steel',
          { role: 'metal' },
        ),
      );
      last = m.height;
    }
    plate.position.z = 6.3 + m.height;
    return m;
  }
  return { ...s, update };
}
