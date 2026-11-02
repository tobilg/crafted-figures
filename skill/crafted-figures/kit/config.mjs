import Ajv from '../runtime/ajv.mjs';
import technical from '../assets/presets/technical.json' with { type: 'json' };
import editorial from '../assets/presets/editorial.json' with { type: 'json' };
import illustrated from '../assets/presets/illustrated.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { resolveTokens } from './styles.mjs';
import { builtInMaterials, colorMaterial, materialTokens, rampKeys } from './materials.mjs';
const object = properties => ({ type: 'object', additionalProperties: false, properties });
const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const choice = (...values) => ({ type: 'string', enum: values });
export const defaults = {
  schemaVersion: 1,
  preset: 'technical',
  theme: 'light',
  accent: '#5965e8',
  detail: 'standard',
  frame: 'card',
  typography: { body: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' },
  stroke: { width: 0.6 },
  motion: { enabled: true, idleTour: false, durationMs: 300 },
  output: 'html',
};
export const configSchema = object({
  schemaVersion: { type: 'integer', const: 1 },
  preset: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
  theme: choice('light', 'dark'),
  accent: color,
  detail: choice('compact', 'standard'),
  frame: choice('card', 'minimal'),
  typography: object({
    body: { type: 'string', format: 'font-family' },
    mono: { type: 'string', format: 'font-family' },
  }),
  stroke: object({ width: { type: 'number', minimum: 0.25, maximum: 2 } }),
  motion: object({
    enabled: { type: 'boolean' },
    idleTour: { type: 'boolean' },
    durationMs: { type: 'integer', minimum: 0, maximum: 2000 },
  }),
  output: choice('html', 'svg', 'both'),
});
/** v1 is unchanged. A selected v2 explicitly enables advanced fields. */
export const configSchemaV2 = structuredClone(configSchema);
Object.assign(configSchemaV2.properties, {
  schemaVersion: { type: 'integer', const: 2 },
  detail: choice('compact', 'standard', 'detailed'),
  camera: object({
    azimuth: { type: 'number', minimum: 0, exclusiveMaximum: 360 },
    elevation: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 90 },
    padding: { type: 'number', minimum: 0 },
  }),
  materials: object({
    overrides: {
      type: 'object',
      propertyNames: { pattern: '^[a-zA-Z][a-zA-Z0-9_.:-]*$' },
      additionalProperties: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    },
    /** Name a new enamel material from one color, without a material file. */
    colors: {
      type: 'object',
      propertyNames: { pattern: '^[a-z][a-z0-9-]*$' },
      additionalProperties: color,
    },
  }),
  /** Optional label above the title. No product name is added to a figure by default. */
  eyebrow: { type: 'string', minLength: 1, maxLength: 80 },
  /** BCP 47 language of the authored text, used for the HTML page's lang attribute. */
  language: { type: 'string', pattern: '^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$' },
  rendering: object({
    effects: choice('auto', 'off'),
    pixelRatioCap: { type: 'number', minimum: 1, maximum: 3 },
    quality: choice('draft', 'standard'),
  }),
  /** Drawing finish. `contour` is the outline width in CSS pixels, `groundShadow` casts every part
   * onto the ground (`shadowLength` is its on-screen length per unit of height), and
   * `light:"view"` lights faces from the camera's right instead of a fixed world direction.
   * `shading:"smooth"` shades curves on a finer ramp and gives upright sides a soft falloff. */
  finish: object({
    contour: { type: 'number', minimum: 0.25, maximum: 4 },
    groundShadow: { type: 'boolean' },
    shadowLength: { type: 'number', minimum: 0.1, maximum: 1.5 },
    light: choice('world', 'view'),
    shading: choice('flat', 'smooth'),
  }),
});
const materialTheme = {
  ...object(Object.fromEntries(rampKeys.map(k => [k, color]))),
  required: rampKeys,
};
export const materialSchema = {
  ...object({
    schemaVersion: { const: 1, type: 'integer' },
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    themes: {
      ...object({ light: materialTheme, dark: materialTheme }),
      required: ['light', 'dark'],
    },
  }),
  required: ['schemaVersion', 'id', 'themes'],
};
export const tokenKeys = [
  'page',
  'card',
  'text',
  'muted',
  'surface',
  'top',
  'side0',
  'side1',
  'side2',
  'side3',
  'accent',
  'stroke',
  'halo',
];
const themeSchema = {
  ...object({ ...Object.fromEntries(tokenKeys.map(k => [k, color])), shadow: color }),
  required: tokenKeys,
};
const presetProperties = { ...configSchema.properties };
for (const k of ['schemaVersion', 'preset', 'output']) delete presetProperties[k];
export const presetSchema = {
  ...object({
    id: configSchema.properties.preset,
    defaults: object(presetProperties),
    themes: { ...object({ light: themeSchema, dark: themeSchema }), required: ['light', 'dark'] },
  }),
  required: ['id', 'defaults', 'themes'],
};
const presetV2Properties = { ...configSchemaV2.properties };
for (const k of ['schemaVersion', 'preset', 'output']) delete presetV2Properties[k];
export const presetSchemaV2 = {
  ...presetSchema,
  properties: {
    ...presetSchema.properties,
    schemaVersion: { type: 'integer', const: 2 },
    defaults: object(presetV2Properties),
  },
  required: [...presetSchema.required, 'schemaVersion'],
};
const ajv = new Ajv({ allErrors: true, strict: true });
/** Validate a local font list, preserving commas inside quoted names.
 * Unquoted names use ordinary Unicode identifiers; CSS escapes and declarations
 * are intentionally outside this contract. No functions or remote sources.
 */
function fontFamily(value) {
  if (/[\p{Cc}\u2028\u2029;{}<>\\]/u.test(value)) return false;
  let index = 0;
  while (index < value.length) {
    while (value[index] === ' ') index++;
    if (index >= value.length) return false;
    const quote = value[index];
    if (quote === '"' || quote === "'") {
      const end = value.indexOf(quote, index + 1);
      if (end < 0 || !value.slice(index + 1, end).trim()) return false;
      index = end + 1;
    } else {
      const end = value.indexOf(',', index),
        family = value.slice(index, end < 0 ? value.length : end).trim();
      if (!/^-?[_\p{L}][\p{L}\p{N}\p{M}_-]*(?: +-?[_\p{L}][\p{L}\p{N}\p{M}_-]*)*$/u.test(family))
        return false;
      index = end < 0 ? value.length : end;
    }
    while (value[index] === ' ') index++;
    if (index === value.length) return true;
    if (value[index++] !== ',' || index === value.length) return false;
  }
  return false;
}
ajv.addFormat('font-family', fontFamily);
const partial = ajv.compile(configSchema),
  partialV2 = ajv.compile(configSchemaV2),
  presetCheck = ajv.compile({ anyOf: [presetSchema, presetSchemaV2] }),
  materialCheck = ajv.compile(materialSchema);
function completeSchema(schema) {
  const result = structuredClone(schema);
  if (result.type === 'object') {
    result.required = Object.keys(result.properties);
    for (const key of result.required)
      result.properties[key] = completeSchema(result.properties[key]);
  }
  return result;
}
const complete = ajv.compile(completeSchema(configSchema));
function validate(check, value, label) {
  if (!check(value))
    throw new Error(
      `${label}: ${check.errors.map(e => `${e.instancePath || '/'}${e.params.additionalProperty ? '/' + e.params.additionalProperty : ''} ${e.message}${e.params.allowedValues ? ' (' + e.params.allowedValues.join(', ') + ')' : ''}`).join('; ')}. Use the supported configuration fields/values; advanced camera/material fields require schemaVersion 2.`,
    );
}
export function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b))
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) ? merge(out[k] || {}, v) : structuredClone(v);
  return out;
}
export async function readJSON(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: ${e.message}`);
  }
}
/** Load only explicitly selected files. Built-ins are package-relative. */
export async function loadPresets(files = []) {
  const registry = new Map();
  for (const p of [technical, editorial, illustrated]) {
    validate(presetCheck, p, `built-in ${p.id}`);
    registry.set(p.id, structuredClone(p));
  }
  for (const file of files) {
    const p = await readJSON(file);
    validate(presetCheck, p, String(file));
    if (registry.has(p.id))
      throw new Error(`${file}: duplicate preset id "${p.id}"; choose a unique id`);
    registry.set(p.id, p);
  }
  return registry;
}
export async function loadMaterials(files = []) {
  const registry = new Map(Object.entries(builtInMaterials));
  for (const file of files) {
    const value = await readJSON(file);
    validate(materialCheck, value, String(file));
    if (registry.has(value.id)) throw new Error(`material: duplicate id "${value.id}"`);
    registry.set(value.id, value);
  }
  return registry;
}
/** The last layer stating a schema version selects validation for the unversioned layers and
 * the resolved result. A layer stating its version is still validated against that version. When
 * no layer states one, a selected version-2 preset asks for version 2.
 * @param {{layers?:Array<{label:string,value:Record<string,any>}>,presets?:Map<string,any>,capabilities?:import('./contracts.mjs').Capabilities,materials?:Map<string,any>}} [options]
 * @returns {Promise<{config:Record<string,any>,tokens:Record<string,string>,materials:Map<string,any>}>}
 */
export async function resolveConfig({ layers = [], presets, capabilities, materials } = {}) {
  presets ||= await loadPresets();
  materials ||= await loadMaterials();
  const selected = layers.reduce((p, l) => l.value?.preset ?? p, defaults.preset),
    stated = layers.reduce((v, l) => l.value?.schemaVersion ?? v, undefined),
    version = stated ?? (presets.get(selected)?.schemaVersion === 2 ? 2 : 1);
  if (![1, 2].includes(version))
    throw new Error(
      `${layers.findLast(l => l.value?.schemaVersion)?.label || 'config'}/schemaVersion: supported versions are 1 and 2`,
    );
  for (const { value, label } of layers)
    validate((value?.schemaVersion ?? version) === 2 ? partialV2 : partial, value, label);
  if (!presets.has(selected))
    throw new Error(`preset: unknown "${selected}"; load it with --preset-file`);
  const needsV2 = Object.keys(presets.get(selected).defaults).find(
    key => !Object.hasOwn(configSchema.properties, key),
  );
  if (version === 1 && needsV2)
    throw new Error(
      `preset: "${selected}" sets ${needsV2}, which needs schemaVersion 2; set "schemaVersion": 2 in the figure config`,
    );
  const preset = presets.get(selected),
    base =
      version === 2
        ? {
            ...defaults,
            schemaVersion: 2,
            materials: { overrides: {} },
            rendering: { effects: 'auto', pixelRatioCap: 1.5, quality: 'standard' },
          }
        : defaults;
  const config = layers.reduce((c, l) => merge(c, l.value), merge(base, preset.defaults));
  config.preset = selected;
  validate(version === 2 ? partialV2 : complete, config, 'resolved config');
  if (capabilities && !capabilities.detail.includes(config.detail))
    throw new Error(
      `detail: "${config.detail}" unsupported by figure; supported: ${capabilities.detail.join(', ')}`,
    );
  if (version === 2) {
    if (config.materials.colors) {
      materials = new Map(materials);
      for (const [id, base] of Object.entries(config.materials.colors)) {
        if (materials.has(id)) throw new Error(`materials/colors/${id}: this material id exists`);
        materials.set(id, colorMaterial(id, base));
      }
    }
    const authored = capabilities?.camera;
    if (config.camera && !authored)
      throw new Error(
        'camera: figure does not declare supported cameras; retain its authored view',
      );
    if (authored) {
      config.camera = { ...authored.default, ...config.camera };
      validate(partialV2, { camera: config.camera }, 'authored camera');
      const c = config.camera,
        allowed = authored.views || [];
      if (!allowed.some(v => v.azimuth === c.azimuth && v.elevation === c.elevation))
        throw new Error(
          `camera: ${c.azimuth}/${c.elevation} outside figure envelope; allowed azimuth/elevation: ${allowed.map(v => `${v.azimuth}/${v.elevation}`).join(', ')}`,
        );
    }
    const roles = capabilities?.materials || {};
    for (const [role, id] of Object.entries(config.materials.overrides)) {
      if (!Object.hasOwn(roles, role))
        throw new Error(
          `materials/overrides/${role}: unknown role; declared: ${Object.keys(roles).join(', ') || 'none'}`,
        );
      if (!materials.has(id))
        throw new Error(
          `materials/overrides/${role}: unknown material "${id}"; load it with --material-file`,
        );
    }
    for (const [role, id] of Object.entries(roles))
      if (!materials.has(id))
        throw new Error(`materials/${role}: unknown default material "${id}"`);
  }
  const tokens = resolveTokens(config, { ...preset.themes[config.theme], accent: config.accent });
  if (version === 2) Object.assign(tokens, materialTokens(materials, config.theme));
  return { config, tokens, materials };
}
