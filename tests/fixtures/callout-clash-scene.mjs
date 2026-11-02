/** Two callouts placed on one spot, so the check has something to fail. */
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    stage = k.createStage({
      config,
      tokens,
      bounds: k.boxBounds([-40, -40, 0], [40, 40, 40]),
      strokeWidth: config.stroke.width,
    }),
    block = k.box('block', { width: 40, depth: 40, height: 30, radius: 4 });
  block.position.z = 15;
  stage.scene.add(block);
  k.callouts(
    stage,
    [
      { id: 'one', label: 'One', description: 'The first.', part: block, badge: [100, 80] },
      { id: 'two', label: 'Two', description: 'The second.', part: block, badge: [104, 82] },
    ],
    { pose() {} },
  );
  return {
    ...stage,
    update: () => {
      stage.scene.updateMatrixWorld(true);
      return { reading: 'still' };
    },
  };
}
