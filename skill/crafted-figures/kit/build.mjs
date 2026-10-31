import { runtimeIdentity } from './provenance.mjs';
import { resolveAuditPolicy } from './audit/policy.mjs';
import { frameContent } from './frame-content.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { bundleModule, moduleSources, bundlerVersion } from './bundler.mjs';
import * as kit from './index.mjs';
import { bindKit } from './bind.mjs';
import { digest } from './hash.mjs';
import { writeOwnedSet } from './owned-output.mjs';
import { namespaceSVG } from './svg-ids.mjs';
import { loadPresets, loadMaterials, readJSON, resolveConfig } from './config.mjs';
import { figureStyleSheet, styleSheet } from './styles.mjs';
export const hash = digest;
const json = value => JSON.stringify(value, null, 2) + '\n';
export const safeJSON = value =>
  JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
const runtimeInfo = JSON.parse(
  await readFile(new URL('../runtime/manifest.json', import.meta.url), 'utf8'),
);
const packageInfo = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const threeNotice = await readFile(new URL('../licenses/three-MIT.txt', import.meta.url), 'utf8');
const provenance = {
  implementation: 'crafted-figures',
  anatomyRuntimeCode: false,
  designReference: {
    source: 'https://github.com/wheresryan22/anatomy',
    commit: '1482e8469b0a9e0d8cc18ea2740a01423d29ae80',
  },
};
function assertJSON(v, where) {
  if (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'boolean' ||
    (typeof v === 'number' && Number.isFinite(v))
  )
    return;
  if (Array.isArray(v)) {
    for (const [i, n] of v.entries()) assertJSON(n, `${where}/${i}`);
    return;
  }
  if (v && Object.getPrototypeOf(v) === Object.prototype) {
    for (const [k, n] of Object.entries(v)) assertJSON(n, `${where}/${k}`);
    return;
  }
  throw new Error(`${where}: state must be finite JSON data`);
}
function shape(a, b) {
  if (a === null || b === null) return a === b;
  if (Array.isArray(a))
    return Array.isArray(b) && a.length === b.length && a.every((v, i) => shape(v, b[i]));
  if (typeof a === 'object')
    return (
      typeof b === 'object' &&
      !Array.isArray(b) &&
      isDeepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort()) &&
      Object.keys(a).every(k => shape(a[k], b[k]))
    );
  return typeof a === typeof b;
}
/** Validate the PRD's small public module boundary, without creating a scene DSL. */
export function validateFigure(f) {
  if (
    !f ||
    typeof f.id !== 'string' ||
    !/^[-a-z0-9]+$/.test(f.id) ||
    typeof f.render !== 'function' ||
    !Array.isArray(f.capabilities?.detail) ||
    !f.capabilities.detail.length ||
    f.capabilities.detail.some(d => !['compact', 'standard', 'detailed'].includes(d))
  )
    throw new Error(
      'figure: require a nonempty string id, render and capabilities.detail (compact/standard/detailed)',
    );
  const record = value =>
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype;
  if (!record(f.initialState) || !record(f.poses) || !Object.hasOwn(f.poses, 'rest'))
    throw new Error(
      'figure: require initialState and poses as plain state objects, including poses.rest',
    );
  assertJSON(f.initialState, 'initialState');
  assertJSON(f.poses, 'poses');
  if (!isDeepStrictEqual(f.poses.rest, f.initialState))
    throw new Error('poses.rest must equal initialState');
  for (const [key, value] of Object.entries(f.poses))
    if (!shape(f.initialState, value))
      throw new Error(`poses.${key}: require a complete state with the initialState shape`);
  if (
    f.clientEntry !== undefined &&
    (!(f.clientEntry instanceof URL) || f.clientEntry.protocol !== 'file:')
  )
    throw new Error('clientEntry must be a local file URL');
}
/** A deterministic scope for one figure's styles and IDs, so that SVGs inlined in the same
 * page cannot restyle each other or collide. */
const figureScope = (id, config, tokens) =>
  `${id}-${digest(JSON.stringify([tokens, config.typography, config.stroke, config.theme])).slice(0, 10)}`;
export function wrapSVG(result, config, tokens, scope = figureScope('figure', config, tokens)) {
  if (
    !Array.isArray(result.viewBox) ||
    result.viewBox.length !== 4 ||
    !result.viewBox.every(Number.isFinite) ||
    result.viewBox[2] <= 0 ||
    result.viewBox[3] <= 0 ||
    ['body', 'title', 'description'].some(k => typeof result[k] !== 'string' || !result[k])
  )
    throw new Error(
      'render: require finite [x,y,width,height] viewBox and nonempty body/title/description',
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" class="crafted" data-cf="${scope}" data-id-prefix="${scope}-" role="img" aria-labelledby="${scope}-title ${scope}-description" viewBox="${result.viewBox.join(' ')}"><title id="${scope}-title">${kit.escapeText(result.title)}</title><desc id="${scope}-description">${kit.escapeText(result.description)}</desc><style>${kit.escapeText(figureStyleSheet(config, tokens, scope))}</style>${namespaceSVG(result.body, scope)}</svg>`;
}
/** Figures that never mention effects do not need to bundle the WebGL renderer. */
async function clientKitSource(clientEntry) {
  const kitFile = name => JSON.stringify(fileURLToPath(new URL(name, import.meta.url)));
  const sources = await moduleSources(fileURLToPath(clientEntry), 'browser');
  const sourceText = await Promise.all(sources.map(file => readFile(file, 'utf8')));
  if (sourceText.some(code => /\beffects\b/.test(code)))
    return `import * as base from ${kitFile('./index.mjs')};`;
  return `import * as illustration from ${kitFile('./three/index.mjs')};import {scalarMotion} from ${kitFile('./model-runtime.mjs')};import {escapeText} from ${kitFile('./text.mjs')};import {registerController} from ${kitFile('./controller.mjs')};const base={illustration,scalarMotion,escapeText,registerController};`;
}
export async function buildFigure(options) {
  const entry = path.resolve(options.entry),
    out = path.resolve(options.out);
  const figure = (await import(pathToFileURL(entry).href)).default;
  validateFigure(figure);
  const layers = [];
  for (const [key, label] of [
    ['projectConfig', 'project config'],
    ['config', 'figure config'],
  ])
    if (options[key])
      layers.push({ label: `${label} ${options[key]}`, value: await readJSON(options[key]) });
  layers.push({ label: 'CLI overrides', value: options.overrides || {} });
  const { config, tokens } = await resolveConfig({
    layers,
    presets: await loadPresets(options.presetFiles),
    capabilities: figure.capabilities,
    materials: await loadMaterials(options.materialFiles),
  });
  if (config.schemaVersion === 1 && options.materialFiles?.length)
    throw new Error('--material-file requires explicit schemaVersion 2');
  const pose = options.state || 'rest';
  if (!Object.hasOwn(figure.poses, pose))
    throw new Error(`state: unknown pose "${pose}"; use ${Object.keys(figure.poses).join(', ')}`);
  // Print treatment is scoped to this pure render invocation, including static
  // figures with no browser controller. The public injected kit stays intact.
  const stages = [],
    renderKit = bindKit(kit, {
      config,
      tokens,
      onStage: stage => {
        stages.push(stage);
        if (options.printMode) stage.renderer.printMode = true;
      },
    });
  const state = structuredClone(options.stateValue ?? figure.poses[pose]);
  assertJSON(state, 'stateValue');
  if (!shape(figure.initialState, state))
    throw new Error('stateValue: require the complete model state shape');
  const result = figure.render({ kit: renderKit, config, tokens, state });
  if (
    config.camera &&
    !stages.some(
      ({ view }) =>
        view.azimuth === config.camera.azimuth && view.elevation === config.camera.elevation,
    )
  )
    throw new Error(
      `camera: ${config.camera.azimuth}/${config.camera.elevation} is declared by ${figure.id} but no rendered stage uses it; build the scene with kit.illustration.createStage or remove capabilities.camera`,
    );
  // Schema 1 predates materials, so such a figure still builds, visibly without them.
  const warnings = [
    ...new Set(stages.flatMap(({ ignoredMaterials }) => [...ignoredMaterials])),
  ].map(material => `material ${material} is ignored: materials require schemaVersion 2`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  const scope = figureScope(figure.id, config, tokens),
    svg = wrapSVG(result, config, tokens, scope),
    framing = frameContent(result),
    eyebrow = result.eyebrow ?? config.eyebrow;
  const files = { 'resolved-config.json': json(config) };
  if (config.output !== 'html') files['figure.svg'] = svg + '\n';
  if (config.output !== 'svg') {
    let script = '';
    if (figure.clientEntry) {
      const source = `${await clientKitSource(figure.clientEntry)}import {bindKit} from ${JSON.stringify(fileURLToPath(new URL('./bind.mjs', import.meta.url)))};import {mount} from ${JSON.stringify(fileURLToPath(figure.clientEntry))};const root=document.querySelector('[data-figure]');const tokens=${safeJSON(tokens)};const config=${safeJSON(config)};const cleanup=mount({root,kit:bindKit(base,{config,tokens}),tokens,config,initialState:${safeJSON(state)}});const controller=base.registerController(root,cleanup,{poses:${safeJSON(figure.poses)}});let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;controller.dispose();removeEventListener('pagehide',dispose);};root.__craftedCleanup=dispose;addEventListener('pagehide',dispose);`;
      const bundled = await bundleModule({ source, root: path.dirname(entry) });
      script = `/* ${threeNotice} */\n` + bundled.code.replace(/<\/script/gi, '<\\/script');
    }
    files['figure.html'] =
      `<!doctype html>\n<html lang="${kit.escapeText(config.language ?? 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${kit.escapeText(result.title)}</title><style>${styleSheet(config, tokens)}</style></head><body><article class="crafted" data-figure="${figure.id}" data-frame="${config.frame}">${eyebrow ? `<div class="eyebrow">${kit.escapeText(eyebrow)}</div>` : ''}<h1>${framing.number}${kit.escapeText(result.title)}</h1><p>${kit.escapeText(result.description)}</p>${svg}${framing.footer}<div data-controls></div><output data-live-readout aria-live="off"></output></article>${script ? `<script>${script}</script>` : ''}</body></html>\n`;
  }
  // Vite's actual module graph records transitive source dependencies.
  const inputs = new Set(await moduleSources(entry));
  if (figure.clientEntry)
    for (const file of await moduleSources(fileURLToPath(figure.clientEntry), 'browser'))
      inputs.add(file);
  const sourceHashes = {};
  for (const p of [...inputs].sort())
    sourceHashes[path.relative(path.dirname(entry), p).split(path.sep).join('/')] = digest(
      await readFile(p),
    );
  const sortedSources = Object.fromEntries(Object.entries(sourceHashes).sort());
  const manifest = await writeOwnedSet(out, files, {
    generator: 'crafted-figures',
    manifestName: 'build-manifest.json',
    destinationLabel: '--out directory',
    metadata: {
      ...(await runtimeIdentity()),
      auditPolicy: resolveAuditPolicy(figure.auditPolicy),
      toolkitVersion: packageInfo.version,
      configurationSchemaVersion: config.schemaVersion,
      preset: config.preset,
      ...(warnings.length ? { warnings } : {}),
      tokens,
      entryHash: digest(await readFile(entry)),
      contentHash: digest(json(sortedSources)),
      sourceHashes: sortedSources,
      pose: options.stateValue === undefined ? pose : null,
      modelState: state,
      ...(config.schemaVersion === 2
        ? {
            apiVersion: 2,
            camera: config.camera || null,
            materials: {
              ...config.materials,
              resolvedRoles: { ...figure.capabilities.materials, ...config.materials.overrides },
            },
            renderingPolicy: config.rendering,
          }
        : {}),
      dependencies: runtimeInfo.dependencies,
      bundler: { name: 'vite', version: bundlerVersion, binding: 'wasm32-wasi' },
      provenance,
      rendering: {
        purpose: options.printMode ? 'print' : 'screen',
        adapter: result.renderer || 'authored-svg',
        ...(result.renderer === 'three-illustration'
          ? { sceneLibrary: 'three', version: runtimeInfo.dependencies.three }
          : {}),
      },
    },
  });
  return { out, files: Object.keys(files), manifest };
}
