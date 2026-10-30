import { createValve } from './scene.mjs';
export function mount({ root, kit, config, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createValve({ kit, config }),
    initial: initialState.liftMm,
    state: liftMm => ({ liftMm }),
    control: { label: 'Valve lift (mm)', min: 0, max: 12, step: 0.1 },
    poses: { Closed: 0, Half: 6, Open: 12 },
  });
}
