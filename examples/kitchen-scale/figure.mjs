import { poses } from './model.mjs';
import { createScale } from './scene.mjs';

export default {
  id: 'kitchen-scale',
  capabilities: {
    detail: ['compact', 'standard'],
    materials: { body: 'mint' },
  },
  initialState: poses.rest,
  poses,
  clientEntry: new URL('./client.mjs', import.meta.url),
  createScene: createScale,
  render({ kit, config, state }) {
    const stage = createScale({ kit, config });
    try {
      const m = stage.update(state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 470],
        title: 'A kitchen scale turns weight into a needle',
        description:
          'Each apple adds 150 g. The load presses the pan down against a spring, and a rack on the column turns the needle by the same amount. Illustrative, not a calibrated scale.',
        legend: stage.callouts.legend(),
        body: `<g data-scene="three">${stage.render()}</g><text class="reading" data-part="static-readout" x="24" y="452">${kit.escapeText(m.reading)}</text>`,
      };
    } finally {
      stage.dispose();
    }
  },
};
