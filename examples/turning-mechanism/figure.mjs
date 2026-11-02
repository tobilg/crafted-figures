import { poses } from './model.mjs';
import { createScene } from './scene.mjs';
export default {
  id: 'turning-mechanism',
  capabilities: {
    detail: ['compact', 'standard'],
    camera: {
      default: { azimuth: 45, elevation: 30, padding: 24 },
      views: [
        { azimuth: 45, elevation: 30 },
        { azimuth: 35, elevation: 30 },
        { azimuth: 45, elevation: 44 },
      ],
    },
    materials: { base: 'gunmetal', links: 'steel' },
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
        viewBox: [0, 0, 640, 440],
        title: 'A tool leaves its moving frame',
        description:
          'Two coupled hinges move a luminous tool. At 3 s it detaches without a position jump and follows a prescribed path to its pad. Sparks retain their world-space birth points. This is a deterministic mechanism, not a physics simulation.',
        body: `<g data-scene="three">${s.render()}</g><text class="reading" data-part="static-readout" x="24" y="416">${m.reading}</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
