import { poses } from './model.mjs';
import { createDial } from './scene.mjs';
export default {
  id: 'dial-indicator',
  capabilities: { detail: ['compact', 'standard'] },
  initialState: poses.rest,
  poses,
  clientEntry: new URL('./client.mjs', import.meta.url),
  render({ kit, config, state }) {
    const stage = createDial({ kit, config });
    try {
      const m = stage.update(state);
      return {
        renderer: 'three-illustration',
        viewBox: [0, 0, 600, 400],
        body: `<g data-scene="three">${stage.render()}</g><text class="reading" data-part="static-readout" x="30" y="360">${m.reading}</text><text class="caption" x="30" y="384">Displacement · 0–10 mm · 30° per mm</text>`,
        title: 'Dial indicator',
        description:
          'Raise the measuring stage. The probe follows its surface and the needle turns 30 degrees per millimetre. Illustrative mapping, not a calibrated instrument.',
      };
    } finally {
      stage.dispose();
    }
  },
};
