import { createScene } from './state-clip-scene.mjs';

const initialState = { time: 0, load: 1 };

export default {
  id: 'state-clip',
  capabilities: { detail: ['standard'] },
  initialState,
  poses: { rest: initialState },
  clientEntry: new URL('./state-clip-client.mjs', import.meta.url),
  render({ kit, config, tokens, state }) {
    const stage = createScene({ kit, config, tokens });
    try {
      const m = stage.update(state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 400],
        title: 'A state scene with playback',
        description: 'A regression fixture for clip controls over several inputs.',
        caption: 'The caption comes after the controls.',
        body: `<g data-scene="three">${stage.render()}</g><text class="reading" data-part="static-readout" x="24" y="380">${kit.escapeText(m.reading)}</text>`,
      };
    } finally {
      stage.dispose();
    }
  },
};
