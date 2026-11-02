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
/** Saturated painted finishes for the illustrated preset. */
const enamels = {
  cream: '#f1e4c8',
  tomato: '#e3563a',
  mint: '#8ed2b4',
  teal: '#2f8d80',
  mustard: '#e8b33f',
  sky: '#6eb4da',
  wood: '#c48a54',
  charcoal: '#3b3a42',
};
export const materialIds = Object.freeze([...Object.keys(bases), ...Object.keys(enamels)]);
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
/** Shaded sides lean cool instead of grey, and every enamel shares one dark ink, so neighbouring
 * parts read as a single drawing. */
function enamel(base, dark) {
  const body = dark ? mix(base, '#000000', 0.12) : base,
    shade = '#14142a',
    top = mix(body, '#ffffff', dark ? 0.16 : 0.3);
  return {
    surface: body,
    top,
    side0: mix(body, shade, 0.58),
    side1: mix(body, shade, 0.38),
    side2: mix(body, shade, 0.16),
    side3: body,
    stroke: '#1d1915',
    ink: contrastText(top),
  };
}
/** An enamel ramp from one color, for a material named in a figure's configuration.
 * @param {string} id
 * @param {string} base six-digit hex */
export const colorMaterial = (id, base) => ({
  schemaVersion: 1,
  id,
  themes: { light: enamel(base, false), dark: enamel(base, true) },
});
export const builtInMaterials = Object.fromEntries([
  ...Object.entries(bases).map(([id, [light, dark]]) => [
    id,
    { schemaVersion: 1, id, themes: { light: ramp(light, false), dark: ramp(dark, true) } },
  ]),
  ...Object.entries(enamels).map(([id, base]) => [id, colorMaterial(id, base)]),
]);
export function materialTokens(registry, theme) {
  return Object.fromEntries(
    [...registry.values()].flatMap(m =>
      Object.entries(m.themes[theme]).map(([key, value]) => [`material-${m.id}-${key}`, value]),
    ),
  );
}
