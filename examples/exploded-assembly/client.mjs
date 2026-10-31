import { createScene } from './scene.mjs';
export function mount({ root, kit, config, tokens, initialState }) {
  const controller = kit.illustration.mountScalarScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initial: initialState.time,
    state: time => ({ time }),
    control: { label: 'Sequence time (s)', min: 0, max: 7, step: 0.01 },
    poses: { Assembled: 0, Reversal: 0.72, Apart: 3.7, Seated: 7 },
    effects: kit.effects,
    effectTime: state => state.time,
  });
  return kit.illustration.clipControls({
    root,
    controller,
    duration: 7,
    motion: config.motion,
  });
}
