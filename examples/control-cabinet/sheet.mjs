export default {
  schemaVersion: 1,
  figure: 'figure.mjs',
  config: 'figure.config.json',
  title: 'Three threshold contacts',
  description:
    'Three illustrative normally-open relays close at 20, 30 and 40 °C. The shared temperature model positions the contact bridges and supplies the readout.',
  maxPages: 3,
  views: {
    main: { pose: 'mid' },
    start: { pose: 'rest' },
    end: { pose: 'max' },
    detail: {
      pose: 'mid',
      focus: ['relay-1', 'bridge-1', 'pusher-1'],
      around: ['relay-1', 'bridge-1', 'pusher-1'],
      hide: ['left-wall'],
    },
  },
  parts: [
    { id: 'relay-0', label: 'First relay', description: 'Closes at 20 °C.' },
    { id: 'relay-1', label: 'Second relay', description: 'Closes at 30 °C.' },
    { id: 'relay-2', label: 'Third relay', description: 'Closes at 40 °C.' },
  ],
  steps: [
    {
      view: 'start',
      title: 'All open',
      text: 'At 10 °C, none of the thresholds has been reached.',
    },
    { view: 'main', title: 'Two closed', text: 'At 30 °C, the first two contacts close.' },
    { view: 'end', title: 'All closed', text: 'At 50 °C, all three contacts close.' },
  ],
  assemblies: [
    {
      view: 'detail',
      title: 'A threshold module',
      text: 'The contact bridge moves onto both real terminals when its threshold is reached.',
    },
  ],
};
