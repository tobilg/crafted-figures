import { createGauge } from './scene.mjs';
import { measure } from './model.mjs';
export function mount({ root, kit, config, initialState }) {
  return kit.illustration.mountScalarScene({
    root,
    config,
    stage: createGauge({ kit, config }),
    initial: measure(initialState).percent,
    state: percent => ({ percent }),
    control: { label: 'Percentage', min: 0, max: 100, step: 1 },
    poses: { Minimum: 0, Middle: 50, Maximum: 100 },
  });
}
