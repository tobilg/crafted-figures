import { createScene } from './callout-clash-scene.mjs';

export function mount({ root, kit, config, tokens, initialState }) {
  return kit.illustration.mountStateScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initialState,
    controls: [{ key: 'turn', label: 'Turn', min: 0, max: 1, step: 1 }],
  });
}
