import { measure } from './model.mjs';
export function createArm({ kit, config }) {
  const k = kit.illustration,
    stage = k.createStage({
      width: 600,
      height: 400,
      azimuth: -42,
      bounds: [
        ...k.boxBounds([-105, -40, -8], [105, 80, 0]),
        ...k.boxBounds([-77, -17, 0], [-43, 17, 50]),
        ...k.boxBounds([18, -6, 50], [90, 66, 64]),
      ],
      padding: { top: 24, right: 30, bottom: 74, left: 30 },
      strokeWidth: config.stroke.width,
    });
  const add = (o, x, y, z) => {
    o.position.set(x, y, z);
    stage.scene.add(o);
    return o;
  };
  const base = add(k.box('base', { width: 210, depth: 120, height: 8, radius: 8 }), 0, 20, -4);
  add(
    k.revolve('pedestal', {
      profile: [
        [0, 17],
        [6, 17],
        [10, 10],
        [34, 10],
        [38, 12],
      ],
    }),
    -60,
    0,
    0,
  );
  add(k.cylinder('shoulder', { radius: 12, height: 6 }), -60, 0, 41);
  const first = add(
    k.box('first-link', { width: 90, depth: 12, height: 6, radius: 3 }),
    -15,
    0,
    47,
  );
  k.label(first, '84 mm', { at: [-20, -4, 3.02], size: 6 });
  add(k.cylinder('elbow', { radius: 8, height: 4 }), 24, 0, 52);
  const elbow = new k.Group();
  elbow.name = 'elbow-transform';
  elbow.position.set(24, 0, 54);
  stage.scene.add(elbow);
  const second = k.box('second-link', {
    width: 60,
    depth: 10,
    height: 6,
    radius: 3,
    tone: 'accent',
  });
  second.position.set(30, 0, 3);
  elbow.add(second);
  const tool = k.cylinder('tool', { radius: 4, height: 4 });
  tool.position.set(54, 0, 8);
  elbow.add(tool);
  if (config.detail === 'standard') {
    k.label(second, '54 mm', { at: [-20, -3.5, 3.02], size: 5 });
    const arc = Array.from({ length: 49 }, (_, i) => {
      const a = (i * Math.PI) / 96;
      return [24 + 54 * Math.cos(a), 54 * Math.sin(a) - 20, 4.01];
    });
    k.mark(base, arc, { accent: true });
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 12;
      k.mark(base, [
        [24 + 51 * Math.cos(a), 51 * Math.sin(a) - 20, 4.02],
        [24 + 57 * Math.cos(a), 57 * Math.sin(a) - 20, 4.02],
      ]);
    }
  }
  function update(state) {
    const m = measure(state);
    elbow.rotation.z = m.radians;
    stage.scene.updateMatrixWorld(true);
    return m;
  }
  return { ...stage, update, elbow, tool };
}
