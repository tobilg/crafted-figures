import { poses } from './model.mjs';
import { createGauge } from './scene.mjs';
export default {
  id: 'sector-gauge',
  capabilities: { detail: ['compact', 'standard'] },
  initialState: poses.rest,
  poses,
  clientEntry: new URL('./client.mjs', import.meta.url),
  render({ kit, config, state }) {
    const stage = createGauge({ kit, config });
    try {
      const model = stage.update(state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 400],
        body: `<g data-scene="three">${stage.render()}</g><text class="reading" data-part="static-readout" x="30" y="355">${model.reading}</text><text class="caption" x="30" y="381">0–100% · 240° sweep · bounded endpoints</text>`,
        title: 'Sector gauge',
        description:
          'A partial scale maps a percentage onto a 240-degree sweep. The pointer and reading share one model; compact detail keeps the scale endpoints.',
      };
    } finally {
      stage.dispose();
    }
  },
};
