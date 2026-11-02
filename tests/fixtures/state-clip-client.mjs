import { createScene } from './state-clip-scene.mjs';

export function mount({ root, kit, config, tokens, initialState }) {
  const scene = kit.illustration.mountStateScene({
    root,
    config,
    stage: createScene({ kit, config, tokens }),
    initialState,
    controls: [
      { key: 'time', label: 'Time', min: 0, max: 10, step: 0.1, help: 'Scrub through the run.' },
      { key: 'load', label: 'Load', min: 0, max: 4, step: 1 },
    ],
    poses: { Heavy: { load: 4 } },
  });
  const clip = kit.illustration.clipControls({
    root,
    controller: scene,
    duration: 10,
    motion: config.motion,
    rate: 8,
    until: state => state.time >= 6,
  });
  root.dataset.clipButton = clip.button.textContent;
  return clip;
}
