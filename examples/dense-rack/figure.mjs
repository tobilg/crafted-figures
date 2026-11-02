import { poses } from './model.mjs';
import { createScene } from './scene.mjs';
export default {
  id: 'dense-rack',
  initialState: poses.rest,
  poses,
  capabilities: {
    detail: ['standard'],
    camera: {
      default: { azimuth: 45, elevation: 44, padding: 20 },
      views: [{ azimuth: 45, elevation: 44 }],
    },
  },
  createScene,
  clientEntry: new URL('./client.mjs', import.meta.url),
  render(args) {
    const s = createScene(args);
    try {
      const m = s.update(args.state);
      return {
        viewBox: [0, 0, 760, 540],
        title: 'Dense plunger backplane',
        description:
          'A capacity fixture: 100 coupled plungers and four routed cables. It measures the cost of actual geometry, not decorative part labels.',
        body: `<g data-scene="three">${s.render()}</g><text class="reading" data-part="static-readout" x="24" y="516">${m.reading}</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
