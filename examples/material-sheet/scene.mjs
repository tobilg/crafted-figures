const materials = ['paper', 'steel', 'chrome', 'gunmetal', 'gold', 'brass', 'copper', 'rubber'];
export const capabilities = {
  detail: ['compact', 'standard', 'detailed'],
  camera: {
    default: { azimuth: 45, elevation: 30, padding: 28 },
    views: [
      { azimuth: 45, elevation: 30 },
      { azimuth: 35, elevation: 30 },
      { azimuth: 45, elevation: 44 },
    ],
  },
  materials: Object.fromEntries(materials.map(x => [x, x])),
};
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    s = k.createStage({
      width: 800,
      height: 620,
      bounds: k.boxBounds([-125, -65, -4], [125, 65, 28]),
      config,
      tokens,
      strokeWidth: config.stroke.width,
      reservedBottom: 45,
    });
  const moving = [];
  materials.forEach((id, i) => {
    const group = new k.Group();
    group.name = id;
    k.material(group, id, { role: id });
    group.position.set(((i % 4) - 1.5) * 62, (Math.floor(i / 4) - 0.5) * 66, 0);
    s.scene.add(group);
    const plate = k.box(`${id}-plate`, { width: 56, depth: 56, height: 4, radius: 3 });
    group.add(plate);
    k.label(plate, id, { at: [23, -19, 2], u: [-1, 0, 0], v: [0, 1, 0], size: 5 });
    const ball = k.sphere(`${id}-round`, { radius: 9, zMin: -7, steps: 24, segments: 64 });
    ball.position.set(-10, 5, 9);
    group.add(ball);
    const block = k.box(`${id}-flat`, { width: 15, depth: 19, height: 15, radius: 1 });
    block.position.set(13, 7, 9.5);
    group.add(block);
    moving.push(block);
    if (config.detail !== 'compact') {
      const knob = k.knob(`${id}-knob`, { radius: 5, height: 4, count: 24 });
      knob.position.set(13, -10, 4);
      group.add(knob);
    }
    if (config.detail === 'detailed') {
      k.ruler(plate, { from: [-23, 23, 2], length: 46, count: 20 });
      const bolt = k.bolt(`${id}-fastener`, { radius: 2 });
      bolt.position.set(-22, -10, 3);
      group.add(bolt);
    }
  });
  return {
    ...s,
    update: ({ turnDeg }) => {
      if (!Number.isFinite(turnDeg)) throw new Error('turnDeg must be finite');
      turnDeg = Math.max(-30, Math.min(30, turnDeg));
      for (const o of moving) o.rotation.z = (turnDeg * Math.PI) / 180;
      return { reading: `Eight materials · facing ${turnDeg.toFixed(1)}°` };
    },
  };
}
