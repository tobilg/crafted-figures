import { createScene } from './scene.mjs';
export default {
  id: 'dense-cutaway',
  initialState: {},
  poses: { rest: {} },
  capabilities: {
    detail: ['standard'],
    camera: {
      default: { azimuth: 45, elevation: 44, padding: 20 },
      views: [{ azimuth: 45, elevation: 44 }],
    },
  },
  createScene,
  render(args) {
    const s = createScene(args);
    try {
      return {
        viewBox: [0, 0, 760, 540],
        title: 'A dense wired cutaway',
        description: s.update().reading,
        body: `<g data-scene="three">${s.render()}</g>`,
      };
    } finally {
      s.dispose();
    }
  },
};
