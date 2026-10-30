import {poses} from './model.mjs';
import {createScene} from './scene.mjs';
export const capabilities = {detail: ['compact', 'standard'], camera: {
  default: {azimuth: 315, elevation: 32, padding: 25},
  views: [{azimuth: 315, elevation: 32}]
}};
export default {id: 'hose-inspection', clientEntry: new URL('./client.mjs', import.meta.url),
  capabilities, initialState: poses.rest, poses, createScene,
  render(args) {
    const stage = createScene(args);
    try {
      const model = stage.update(args.state);
      return {renderer: 'three-illustration', viewBox: [0, 0, 760, 460],
        title: 'H-06 · Hose inspection bench',
        description: 'A braided lead links the round fitting to a supported rigid pipe. Turn the assembly to inspect the matching coupling rims and curved seat.',
        caption: 'Illustrated construction, millimetres. The braid is surface engraving; the opaque lead does not expose an internal bore.',
        legend: [{label: 'Ø6 mm terminals', description: 'Equal radii meet the coupling bore at both faces.'}, {label: 'Curved saddle', description: 'A tangent seat supports the short rigid pipe.'}],
        body: `<g data-scene="three">${stage.render()}</g><text class="reading" data-part="static-readout" x="20" y="438">${args.kit.escapeText(model.reading)}</text>`};
    } finally {stage.dispose();}
  }};
