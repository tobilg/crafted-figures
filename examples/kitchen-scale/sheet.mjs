export default {
  schemaVersion: 1,
  figure: 'figure.mjs',
  config: 'figure.config.json',
  title: 'A kitchen scale turns weight into a needle',
  description:
    'Each apple adds 150 g. The load presses the pan against a spring, and a rack on the column turns the needle. Illustrative, not a calibrated scale.',
  maxPages: 2,
  views: {
    main: { pose: 'rest' },
    start: { pose: 'empty' },
    end: { pose: 'full' },
  },
  parts: [
    { id: 'pan', label: 'Pan', description: 'Carries the load and sinks with it.' },
    { id: 'dial', label: 'Dial', description: 'Shows the load in grams.' },
    { id: 'tare-knob', label: 'Tare knob', description: 'Sets the needle to zero.' },
  ],
  details: [],
  steps: [
    { view: 'start', title: 'Empty pan', text: 'With no load the needle rests at zero.' },
    { view: 'main', title: 'Two apples', text: 'The displayed 300 g is half of full scale.' },
    { view: 'end', title: 'Three apples', text: 'The displayed 450 g sinks the pan further.' },
  ],
};
