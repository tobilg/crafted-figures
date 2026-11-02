/** A block lifted by a time and a load, so a state scene and clip playback have something to drive. */
export function createScene({ kit, config, tokens }) {
  const k = kit.illustration,
    stage = k.createStage({
      config,
      tokens,
      bounds: k.boxBounds([-40, -40, 0], [40, 40, 60]),
      strokeWidth: config.stroke.width,
    }),
    block = k.box('block', { width: 30, depth: 30, height: 20 });
  block.position.z = 10;
  stage.scene.add(block);
  const update = ({ time, load }) => {
    block.position.z = 10 + time * 3;
    stage.scene.updateMatrixWorld(true);
    return { reading: `${time.toFixed(1)} s at load ${load}` };
  };
  return { ...stage, update };
}
