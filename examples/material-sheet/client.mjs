import { createScene } from './scene.mjs';
export function mount({ root, kit, config, tokens, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initial: initialState.turnDeg,
    state: turnDeg => ({ turnDeg }),
    control: { label: 'Sample facing (degrees)', min: -30, max: 30, step: 1 },
    poses: { Left: -30, Front: 0, Right: 30 },
  });
}
