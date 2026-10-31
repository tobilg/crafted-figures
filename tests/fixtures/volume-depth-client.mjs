import { createScene } from './volume-depth-scene.mjs';
export function mount({ root, kit, config, tokens, initialState }) {
  const s = createScene({ kit, config, tokens });
  let fx,
    time = initialState.time;
  const update = s.update,
    mount = s.mount;
  s.update = state => {
    time = state.time;
    return update(state);
  };
  s.mount = g => {
    const v = mount(g);
    return {
      update() {
        v.update();
        fx?.render(time);
      },
      dispose: () => v.dispose(),
    };
  };
  const c = kit.illustration.mountScalarScene({
    root,
    config,
    stage: s,
    initial: time,
    state: time => ({ time }),
    control: { label: 'Depth crossing', min: 0, max: 2, step: 0.01 },
  });
  fx = kit.effects.mountEffects(root, s, config);
  root.__effects = fx;
  const cleanup = () => {
    fx.dispose();
    delete root.__effects;
    c();
  };
  Object.assign(cleanup, c);
  return cleanup;
}
