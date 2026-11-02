import { measure } from './model.mjs';
import { springTimeline } from '../../skill/crafted-figures/kit/three/motion.mjs';
const apart = measure({ time: 3.5 }, springTimeline);
export default {
  schemaVersion: 1,
  figure: 'figure.mjs',
  config: 'figure.config.json',
  title: 'A reversible service assembly',
  description:
    'Staggered spring motion opens three flange groups. Every clearance is calculated from the displayed state; the exhaust and steam are explicit raster effect layers over vector solids.',
  maxPages: 3,
  views: {
    apart: { pose: 'mid', effects: true },
    assembled: { pose: 'rest' },
    reversal: { actions: [{ type: 'time', value: 0.72 }], effects: true },
    seated: { actions: [{ type: 'time', value: 7 }] },
    detail: {
      pose: 'mid',
      around: ['chamber', 'nozzle'],
      focus: ['chamber', 'nozzle'],
      effects: true,
    },
  },
  parts: [
    { id: 'chamber', label: 'Chamber', description: 'Fixed copper body below the moving flanges.' },
    {
      id: 'assembly-a',
      label: 'Lower flange',
      description: 'The first spring contribution lifts all three groups.',
    },
    {
      id: 'assembly-b',
      label: 'Middle flange',
      description: 'Adds a second independent clearance.',
    },
    {
      id: 'assembly-c',
      label: 'Upper flange',
      description: `At 3.5 s its local clearance is ${(apart.shares.c * 40).toFixed(1)} mm.`,
    },
  ],
  details: [
    {
      view: 'detail',
      title: 'Chamber and nozzle',
      text: 'The fixed chamber feeds the smoothly waisted exhaust nozzle.',
    },
  ],
  steps: [
    {
      view: 'assembled',
      title: 'Start seated',
      text: 'The three gaps are closed. The model starts with no spring velocity.',
    },
    {
      view: 'reversal',
      title: 'Reverse before settling',
      text: 'Targets change while groups are still moving. Position and velocity remain continuous.',
    },
    {
      view: 'apart',
      title: 'Inspect the assembly',
      text: 'Cumulative positive clearances keep the stack ordered.',
    },
    {
      view: 'seated',
      title: 'Return to the seats',
      text: 'The explicit time control freezes the reassembled state.',
    },
  ],
};
