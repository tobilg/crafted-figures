import { build, version } from '../runtime/vite/dist/node/chunks/build.mjs';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
export const bundlerVersion = version;
const builtin = id => id.startsWith('node:') || builtinModules.includes(id);
const THREE = fileURLToPath(new URL('../runtime/three.mjs', import.meta.url));
const EXTENSIONS = ['', '.mjs', '.js', '.json', '.jsx', '.ts', '.tsx', '/index.mjs', '/index.js'];
const isFile = file => existsSync(file) && statSync(file).isFile();
const toId = file => file.split(path.sep).join('/');
const probe = file => EXTENSIONS.map(ending => file + ending).find(isFile);
function exportTarget(value, conditions) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  for (const [condition, target] of Object.entries(value))
    if (conditions.includes(condition)) {
      const found = exportTarget(target, conditions);
      if (found) return found;
    }
  return undefined;
}
/** Bare imports through node_modules, honoring package `exports`. */
function resolvePackage(id, fromDir, conditions) {
  const parts = id.split('/'),
    name = id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0],
    subpath = `.${id.slice(name.length)}`;
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const root = path.join(dir, 'node_modules', name),
      manifest = path.join(root, 'package.json');
    if (isFile(manifest)) {
      const info = JSON.parse(readFileSync(manifest, 'utf8'));
      if (info.exports !== undefined) {
        const map =
          typeof info.exports === 'object' &&
          Object.keys(info.exports).some(key => key.startsWith('.'))
            ? info.exports
            : { '.': info.exports };
        const target = exportTarget(map[subpath], conditions);
        if (target) return path.join(root, target);
      } else if (subpath === '.') {
        const main = info.module ?? info.main ?? 'index.js';
        return probe(path.join(root, main));
      } else return probe(path.join(root, subpath));
    }
    if (dir === path.dirname(dir)) return undefined;
  }
}
/** Vite 8 library build. One inline JS chunk; no implicit config, env or assets.
 *
 * Module resolution and loading stay in JavaScript. The portable bundler is a WASM build whose
 * file system is a POSIX view of one root, which cannot express Windows drive paths; nothing
 * here may depend on it reading source files.
 * The toolkit owns its CSS. Reject asset/module side outputs instead of silently
 * generating HTML that needs additional files or a development server. */
/** @param {{entry?:string,source?:string,root?:string,platform?:'browser'|'node',minify?:boolean,graphOnly?:boolean}} options */
export async function bundleModule({
  entry,
  source,
  root = path.dirname(entry),
  platform = 'browser',
  minify = true,
  graphOnly = false,
}) {
  const virtual = path.join(path.resolve(root), '__crafted_figure_client__.mjs'),
    files = new Set(),
    conditions =
      platform === 'node'
        ? ['node', 'import', 'module', 'default']
        : ['browser', 'import', 'module', 'default'];
  const result = await build({
    root: path.resolve(root),
    configFile: false,
    envDir: false,
    publicDir: false,
    logLevel: 'error',
    css: { postcss: { plugins: [] } },
    ssr: { noExternal: true },
    plugins: [
      {
        name: 'crafted-entry-and-sources',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id.startsWith('\0') || id.includes('?') || builtin(id)) return null;
          if (source !== undefined && toId(path.resolve(root, id)) === toId(virtual))
            return '\0crafted-entry';
          if (id === 'three') return toId(THREE);
          const fromDir =
            importer && !importer.startsWith('\0') ? path.dirname(importer) : path.resolve(root);
          const relative = id.startsWith('.') || path.isAbsolute(id);
          const file = relative
            ? probe(path.resolve(fromDir, id))
            : resolvePackage(id, fromDir, conditions);
          return file ? toId(file) : null;
        },
        load(id) {
          if (id === '\0crafted-entry') return source;
          if (!id.startsWith('\0') && !id.includes('?') && isFile(id))
            return readFileSync(id, 'utf8');
          return null;
        },
        moduleParsed(info) {
          if (path.isAbsolute(info.id) && !info.id.includes('\0')) files.add(path.resolve(info.id));
        },
        generateBundle(_options, outputs) {
          for (const item of Object.values(outputs))
            if (item.type !== 'chunk')
              throw new Error(
                'Standalone figure clients support JS/JSON modules only; keep styles in toolkit tokens and artwork in SVG.',
              );
        },
      },
    ],
    build: {
      ssr: platform === 'node',
      write: false,
      target: 'es2022',
      minify: graphOnly ? false : minify,
      cssMinify: false,
      lib: {
        entry: source === undefined ? path.resolve(entry) : virtual,
        name: 'CraftedFigure',
        formats: [platform === 'node' ? 'es' : 'iife'],
      },
      rolldownOptions: {
        external: platform === 'node' ? builtin : undefined,
        treeshake: !graphOnly,
        output: {
          codeSplitting: false,
          entryFileNames: 'figure-client.js',
          comments: { legal: true },
        },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
  if (outputs.length !== 1 || outputs[0].type !== 'chunk')
    throw new Error('Expected one standalone JavaScript bundle');
  return { code: outputs[0].code, files: [...files].sort() };
}
/** @param {string} entry
 * @param {'browser'|'node'} [platform] */
export async function moduleSources(entry, platform = 'node') {
  return (await bundleModule({ entry, platform, graphOnly: true })).files;
}
