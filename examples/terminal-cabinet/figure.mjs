import { poses } from './model.mjs';
import { createScene } from './scene.mjs';
export default {
  id: 'terminal-cabinet',
  capabilities: { detail: ['compact', 'standard'] },
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
        viewBox: [0, 0, 600, 420],
        title: 'A control cabinet executes a sequence',
        description:
          'Temperature enables three thresholds. The sequence closes enabled relays after 0.3, 0.6 and 0.9 seconds. Text is printed in the tilted display plane and clipped inside its bezel.',
        body: `<g data-scene="three">${s.render()}</g><text class="reading" data-part="static-readout" x="24" y="396">${kitEscape(m.reading)}</text>`,
      };
    } finally {
      s.dispose();
    }
  },
};
function kitEscape(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
