import { poses } from './model.mjs';
import { createScene } from './scene.mjs';
export const capabilities = {
  detail: ['compact', 'standard', 'detailed'],
  camera: {
    default: { azimuth: 45, elevation: 30, padding: 28 },
    views: [
      { azimuth: 45, elevation: 30 },
      { azimuth: 35, elevation: 30 },
      { azimuth: 45, elevation: 44 },
    ],
  },
};
export default {
  clientEntry: new URL('./client.mjs', import.meta.url),
  id: 'construction-details',
  capabilities,
  initialState: poses.rest,
  poses,
  createScene,
  render(args) {
    const s = createScene(args);
    try {
      const m = s.update(args.state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 800, 560],
        title: 'Construction follows the surface',
        description:
          'A physical bevel, open ventilation slots, a grooved housing, continuous braided and striped routes, a bored coupling and a curved saddle. Every detail uses its host geometry.',
        legend: [
          {
            label: 'Coupling',
            description: 'The two visible tube ends meet matching 2-unit bore rims.',
          },
          { label: 'Saddle', description: 'A concave seat supports the 5-unit-radius pipe.' },
        ],
        body: `<g data-scene="three">${s.render()}</g><text data-part="static-readout" class="reading" x="20" y="540">${m.reading}</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
