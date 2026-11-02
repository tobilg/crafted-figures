import { createScene } from './effect-depth-scene.mjs';
const poses = { rest: { time: 0 }, mid: { time: 1 }, max: { time: 2 } };
export default {
  id: 'effect-depth',
  initialState: poses.rest,
  poses,
  capabilities: {
    detail: ['standard'],
    camera: {
      default: { azimuth: 45, elevation: 30, padding: 20 },
      views: [{ azimuth: 45, elevation: 30 }],
    },
  },
  clientEntry: new URL('./effect-depth-client.mjs', import.meta.url),
  render(args) {
    const s = createScene(args);
    try {
      s.update(args.state);
      return {
        viewBox: [0, 0, 600, 400],
        title: 'Production depth regression',
        description: 'Known hidden, boundary and front marker states.',
        body: `<g data-scene="three">${s.render()}</g><text data-part="static-readout" x="20" y="380">Depth regression</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
