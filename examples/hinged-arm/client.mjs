import { createArm } from './scene.mjs';
export function mount({ root, kit, config, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createArm({ kit, config }),
    initial: initialState.bendDeg,
    state: bendDeg => ({ bendDeg }),
    control: { label: 'Elbow bend (degrees)', min: 0, max: 90, step: 1 },
    poses: { Straight: 0, Half: 45, Right: 90 },
  });
}
