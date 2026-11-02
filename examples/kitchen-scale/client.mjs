import { createScale } from './scene.mjs';

/** @returns {()=>void} Release input listeners, animation and scene resources. */
export function mount({ root, kit, config, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createScale({ kit, config }),
    initial: initialState.apples,
    state: apples => ({ apples }),
    control: {
      label: 'Apples on the pan',
      min: 0,
      max: 3,
      step: 1,
      help: 'Drag across the drawing or use the slider. Arrow keys add or remove an apple.',
    },
    poses: { Empty: 0, One: 1, Two: 2, Three: 3 },
  });
}
