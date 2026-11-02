import {createScene} from './scene.mjs';
/** Two named poses share the displayed state with the readout. */
export function mount({root, kit, config, tokens, initialState}) {
  return kit.illustration.mountScalarScene({root, config, stage: createScene({kit, config, tokens}),
    initial: initialState.turnDeg, state: turnDeg => ({turnDeg}),
    control: {label: 'Inspection turn (degrees)', min: 0, max: 8, step: 1},
    poses: {Rest: 0, Inspection: 8}});
}
