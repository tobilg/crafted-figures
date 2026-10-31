import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
for (const name of [
  'sector-gauge',
  'construction-details',
  'dial-indicator',
  'lift-valve',
  'control-cabinet',
  'hinged-arm',
  'terminal-cabinet',
  'valve-assembly',
  'exploded-assembly',
  'ripple-tank',
  'turning-mechanism',
  'merging-surfaces',
  'spring-probe',
  'material-sheet',
])
  for (const theme of ['light', 'dark']) {
    await buildFigure({
      entry: `examples/${name}/figure.mjs`,
      config: `examples/${name}/figure.config.json`,
      state: name === 'sector-gauge' ? 'rest' : 'mid',
      overrides: { theme, output: 'both' },
      out: `out/examples/${name}-${theme}`,
    });
    console.log(`Built ${name} / ${theme}`);
  }
