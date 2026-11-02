import { createScene, capabilities } from './scene.mjs';
export { createScene, capabilities };
const poses = {
  rest: { turnDeg: 0 },
  mid: { turnDeg: 15 },
  max: { turnDeg: 30 },
  min: { turnDeg: -30 },
};
export default {
  id: 'material-sheet',
  capabilities,
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
        viewBox: [0, 0, 800, 620],
        title: 'Materials on flat and curved surfaces',
        description:
          'Eight stylized illustration materials. Change theme, material assignment or qualified camera without changing the model; rotate the flat samples to inspect facing.',
        body: `<g data-scene="three">${s.render()}</g><text class="reading" data-part="static-readout" x="24" y="596">${m.reading}</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
