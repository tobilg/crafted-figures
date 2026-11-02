import { createScene } from './scene.mjs';
import { measure } from './model.mjs';
/** Three independent inputs over one model state. The pure model normalizes every change. */
export function mount({ root, kit, config, tokens, initialState }) {
  return kit.illustration.mountStateScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initialState,
    normalize: state => {
      const { temperatureC, text, time } = measure(state);
      return { temperatureC, text, time };
    },
    controls: [
      { key: 'temperatureC', label: 'Temperature (°C)', min: 10, max: 50, step: 0.1 },
      { key: 'time', label: 'Sequence time (s)', min: 0, max: 2, step: 0.01 },
      { key: 'text', label: 'Display message', type: 'text', maxLength: 64 },
    ],
  });
}
