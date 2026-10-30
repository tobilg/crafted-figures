import { measure } from './model.mjs';
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 600,
      height: 380,
      reservedBottom: 45,
      bounds: k.boxBounds([-50, -22, -5], [50, 22, 38]),
      config,
      tokens,
    });
  const base = k.box('plate', { width: 100, depth: 44, height: 5, radius: 4 });
  base.position.z = -2.5;
  s.scene.add(base);
  let forms = new k.Group();
  forms.name = 'field';
  s.scene.add(forms);
  let last;
  function update(state) {
    const m = measure(state);
    if (m.separation !== last) {
      const next = new k.Group();
      next.name = 'field';
      for (const [i, [a, b]] of m.intervals.entries()) {
        const part = k.profile('drop-' + i, {
          radius: m.radius,
          zMin: a,
          zMax: b,
          steps: 48,
          segments: 64,
          tone: 'accent',
        });
        part.rotation.y = Math.PI / 2;
        part.position.z = 20;
        next.add(part);
      }
      forms = k.replacePart(forms, next);
      last = m.separation;
    }
    return m;
  }
  return { ...s, update };
}
