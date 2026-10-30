import { mix, contrastText } from './styles.mjs';
/** Stylized, deterministic illustration ramps; these are not PBR materials. */
const bases = {
  paper: ['#dce3eb', '#506177'],
  steel: ['#9baab9', '#73879b'],
  chrome: ['#c6d4dd', '#839bad'],
  gunmetal: ['#586575', '#425265'],
  gold: ['#d6af47', '#b99235'],
  brass: ['#b59a59', '#9c854b'],
  copper: ['#c2825e', '#ad7455'],
  rubber: ['#414850', '#323940'],
};
export const materialIds = Object.freeze(Object.keys(bases));
export const rampKeys = ['surface', 'top', 'side0', 'side1', 'side2', 'side3', 'stroke', 'ink'];
export function ramp(base, dark) {
  return {
    surface: base,
    top: mix(base, '#ffffff', dark ? 0.25 : 0.65),
    side0: mix(base, '#000000', 0.48),
    side1: mix(base, '#000000', 0.3),
    side2: base,
    side3: mix(base, '#ffffff', 0.25),
    stroke: mix(base, dark ? '#ffffff' : '#000000', 0.35),
    ink: contrastText(mix(base, '#ffffff', dark ? 0.25 : 0.65)),
  };
}
export const builtInMaterials = Object.fromEntries(
  Object.entries(bases).map(([id, [light, dark]]) => [
    id,
    { schemaVersion: 1, id, themes: { light: ramp(light, false), dark: ramp(dark, true) } },
  ]),
);
export function materialTokens(registry, theme) {
  return Object.fromEntries(
    [...registry.values()].flatMap(m =>
      Object.entries(m.themes[theme]).map(([key, value]) => [`material-${m.id}-${key}`, value]),
    ),
  );
}
