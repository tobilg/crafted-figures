import { poses } from './model.mjs';
import { createScene } from './scene.mjs';
export default {
  id: 'merging-surfaces',
  capabilities: {
    detail: ['compact', 'standard'],
    camera: {
      default: { azimuth: 45, elevation: 30, padding: 30 },
      views: [
        { azimuth: 45, elevation: 30 },
        { azimuth: 45, elevation: 44 },
      ],
    },
  },
  initialState: poses.rest,
  poses,
  createScene,
  clientEntry: new URL('./client.mjs', import.meta.url),
  render(args) {
    const s = createScene(args);
    try {
      const m = s.update(args.state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 380],
        title: 'Two fields become one surface',
        description:
          'Decrease the separation of two Gaussian fields at a fixed iso-value. Their surface connects at a neck. This demonstrates field blending; it does not conserve fluid volume.',
        body: `<g data-scene="three">${s.render()}</g><text class="reading" data-part="static-readout" x="24" y="356">${m.reading}</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
