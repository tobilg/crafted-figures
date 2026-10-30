import { createScene } from './scene.mjs';
export function mount({ root, kit, config, tokens, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initial: initialState.separation,
    state: separation => ({ separation }),
    control: { label: 'Field separation', min: 0, max: 50, step: 0.5 },
    poses: { Separate: 50, Neck: 30, Merged: 0 },
  });
}
