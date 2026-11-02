import { createScene } from './callout-clash-scene.mjs';

const initialState = { turn: 0 };

export default {
  id: 'callout-clash',
  capabilities: { detail: ['standard'] },
  initialState,
  poses: { rest: initialState },
  clientEntry: new URL('./callout-clash-client.mjs', import.meta.url),
  render({ kit, config, tokens, state }) {
    const stage = createScene({ kit, config, tokens });
    try {
      stage.update(state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 400],
        title: 'Two badges on one spot',
        description: 'A regression fixture that the check must reject.',
        legend: stage.callouts.legend(),
        body: `<g data-scene="three">${stage.render()}</g>`,
      };
    } finally {
      stage.dispose();
    }
  },
};
