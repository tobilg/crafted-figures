import { createScene } from './scene.mjs';
export function mount({ root, kit, config, tokens, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initial: initialState.compression,
    state: compression => ({ compression }),
    control: { label: 'Compression (mm)', min: 0, max: 14, step: 0.1 },
    poses: { Free: 0, Middle: 7, Compressed: 14 },
  });
}
