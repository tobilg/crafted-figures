import { createScene } from './scene.mjs';
export function mount({ root, kit, config, tokens, initialState }) {
  const controller = kit.illustration.mountScalarScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initial: initialState.time,
    state: time => ({ time }),
    control: { label: 'Sequence time (s)', min: 0, max: 6, step: 0.01 },
    poses: { Start: 0, Mid: 3, End: 6 },
    effects: kit.effects,
    effectTime: state => state.time,
  });
  return kit.illustration.clipControls({
    root,
    controller,
    duration: 6,
    motion: config.motion,
  });
}
