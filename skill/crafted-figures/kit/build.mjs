import {runtimeIdentity} from './provenance.mjs';
import {resolveAuditPolicy} from './audit/policy.mjs';
import {frameContent} from './frame-content.mjs';
import {readFile,writeFile,mkdir,unlink,lstat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {bundleModule,moduleSources,bundlerVersion} from './bundler.mjs';
import * as kit from './index.mjs';
import {loadPresets,loadMaterials,readJSON,resolveConfig} from './config.mjs';
import {styleSheet} from './styles.mjs';
export const hash=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
export const safeJSON=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
const runtimeInfo=JSON.parse(await readFile(new URL('../runtime/manifest.json',import.meta.url),'utf8'));
const packageInfo=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const threeNotice=await readFile(new URL('../licenses/three-MIT.txt',import.meta.url),'utf8');
const provenance={implementation:'crafted-figures',anatomyRuntimeCode:false,designReference:{source:'https://github.com/wheresryan22/anatomy',commit:'1482e8469b0a9e0d8cc18ea2740a01423d29ae80'}};
function assertJSON(v,where){
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
  if(Array.isArray(v)){v.forEach((n,i)=>assertJSON(n,`${where}/${i}`));return;}
  if(v&&Object.getPrototypeOf(v)===Object.prototype){for(const [k,n] of Object.entries(v))assertJSON(n,`${where}/${k}`);return;}
  throw new Error(`${where}: state must be finite JSON data`);
}
function shape(a,b){if(a===null||b===null)return a===b;if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>shape(v,b[i]));if(typeof a==='object')return typeof b==='object'&&!Array.isArray(b)&&isDeepStrictEqual(Object.keys(a).sort(),Object.keys(b).sort())&&Object.keys(a).every(k=>shape(a[k],b[k]));return typeof a===typeof b;}
/** Validate the PRD's small public module boundary, without creating a scene DSL. */
export function validateFigure(f){
  if(!f||typeof f.id!=='string'||!/^[-a-z0-9]+$/.test(f.id)||typeof f.render!=='function'||!Array.isArray(f.capabilities?.detail)||!f.capabilities.detail.length||f.capabilities.detail.some(d=>!['compact','standard','detailed'].includes(d)))throw new Error('figure: require a nonempty string id, render and capabilities.detail (compact/standard)');
  const record=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
  if(!record(f.initialState)||!record(f.poses)||!Object.hasOwn(f.poses,'rest'))throw new Error('figure: require initialState and poses as plain state objects, including poses.rest');
  assertJSON(f.initialState,'initialState');assertJSON(f.poses,'poses');
  if(!isDeepStrictEqual(f.poses.rest,f.initialState))throw new Error('poses.rest must equal initialState');
  for(const [key,value] of Object.entries(f.poses))if(!shape(f.initialState,value))throw new Error(`poses.${key}: require a complete state with the initialState shape`);
  if(f.clientEntry!==undefined&&(!(f.clientEntry instanceof URL)||f.clientEntry.protocol!=='file:'))throw new Error('clientEntry must be a local file URL');
}
export function wrapSVG(result,config,tokens){
  if(!Array.isArray(result.viewBox)||result.viewBox.length!==4||!result.viewBox.every(Number.isFinite)||result.viewBox[2]<=0||result.viewBox[3]<=0||['body','title','description'].some(k=>typeof result[k]!=='string'||!result[k]))throw new Error('render: require finite [x,y,width,height] viewBox and nonempty body/title/description');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="crafted" role="img" aria-labelledby="figure-title figure-description" viewBox="${result.viewBox.join(' ')}"><title id="figure-title">${kit.escapeText(result.title)}</title><desc id="figure-description">${kit.escapeText(result.description)}</desc><style>${kit.escapeText(styleSheet(config,tokens))}</style>${result.body}</svg>`;
}
const generated=['figure.html','figure.svg','resolved-config.json','build-manifest.json'];
async function exists(p){try{return await lstat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
/** Only replace outputs recorded by our prior manifest, and never edited outputs. */
export async function verifyOwnership(out){
  const mp=path.join(out,'build-manifest.json');let old=null;
  if(await exists(mp)){old=await readJSON(mp);if(old.generator!=='crafted-figures'||!old.outputHashes)throw new Error(`${mp}: unrelated manifest; choose another --out directory`);}
  for(const name of generated){const p=path.join(out,name),s=await exists(p);if(!s)continue;if(!s.isFile()||s.isSymbolicLink())throw new Error(`${p}: generated output must be a regular file`);if(name==='build-manifest.json')continue;if(!old?.outputHashes[name]||hash(await readFile(p))!==old.outputHashes[name])throw new Error(`${p}: unrelated or edited file; choose another --out directory or preserve it elsewhere`);}
  return old;
}
export async function buildFigure(options){
  const entry=path.resolve(options.entry),out=path.resolve(options.out);
  const figure=(await import(pathToFileURL(entry).href)).default;validateFigure(figure);
  const layers=[];for(const [key,label] of [['projectConfig','project config'],['config','figure config']])if(options[key])layers.push({label:`${label} ${options[key]}`,value:await readJSON(options[key])});
  layers.push({label:'CLI overrides',value:options.overrides||{}});
  const {config,tokens}=await resolveConfig({layers,presets:await loadPresets(options.presetFiles),capabilities:figure.capabilities,materials:await loadMaterials(options.materialFiles)});
  if(config.schemaVersion===1&&options.materialFiles?.length)throw new Error('--material-file requires explicit schemaVersion 2');
  const pose=options.state||'rest';if(!Object.hasOwn(figure.poses,pose))throw new Error(`state: unknown pose "${pose}"; use ${Object.keys(figure.poses).join(', ')}`);
  // Print treatment is scoped to this pure render invocation, including static
  // figures with no browser controller. The public injected kit stays intact.
  const renderKit=options.printMode?{...kit,illustration:{...kit.illustration,createStage:args=>{const stage=kit.illustration.createStage(args);stage.renderer.printMode=true;return stage;}}}:kit;
  const state=structuredClone(options.stateValue??figure.poses[pose]);assertJSON(state,'stateValue');if(!shape(figure.initialState,state))throw new Error('stateValue: require the complete model state shape');const result=figure.render({kit:renderKit,config,tokens,state});const svg=wrapSVG(result,config,tokens),framing=frameContent(result);
  const files={'resolved-config.json':json(config)};
  if(config.output!=='html')files['figure.svg']=svg+'\n';
  if(config.output!=='svg'){
    let script='';
    if(figure.clientEntry){
      const source=`import * as kit from ${JSON.stringify(fileURLToPath(new URL('./index.mjs',import.meta.url)))};import {mount} from ${JSON.stringify(fileURLToPath(figure.clientEntry))};const root=document.querySelector('[data-figure]');const cleanup=mount({root,kit,tokens:${safeJSON(tokens)},config:${safeJSON(config)},initialState:${safeJSON(state)}});const controller=kit.registerController(root,cleanup,{poses:${safeJSON(figure.poses)}});let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;controller.dispose();removeEventListener('pagehide',dispose);};root.__craftedCleanup=dispose;addEventListener('pagehide',dispose);`;
      const bundled=await bundleModule({source,root:path.dirname(entry)});
      script=`/* ${threeNotice} */\n`+bundled.code.replace(/<\/script/gi,'<\\/script');
    }
    files['figure.html']=`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${kit.escapeText(result.title)}</title><style>${styleSheet(config,tokens)}</style></head><body><article class="crafted" data-figure="${figure.id}" data-frame="${config.frame}"><div class="eyebrow">Crafted figures · ${kit.escapeText(config.preset)}</div><h1>${framing.number}${kit.escapeText(result.title)}</h1><p>${kit.escapeText(result.description)}</p>${svg}${framing.footer}<div data-controls></div><output data-live-readout aria-live="off"></output></article>${script?`<script>${script}</script>`:''}</body></html>\n`;
  }
  // Vite's actual module graph records transitive source dependencies.
  const inputs=new Set(await moduleSources(entry));
  if(figure.clientEntry)for(const file of await moduleSources(fileURLToPath(figure.clientEntry),'browser'))inputs.add(file);
  const sourceHashes={};for(const p of [...inputs].sort())sourceHashes[path.relative(path.dirname(entry),p).split(path.sep).join('/')]=hash(await readFile(p));
  const manifest={generator:'crafted-figures',...(await runtimeIdentity()),auditPolicy:resolveAuditPolicy(figure.auditPolicy),toolkitVersion:packageInfo.version,configurationSchemaVersion:config.schemaVersion,preset:config.preset,tokens,entryHash:hash(await readFile(entry)),contentHash:hash(json(Object.fromEntries(Object.entries(sourceHashes).sort()))),sourceHashes:Object.fromEntries(Object.entries(sourceHashes).sort()),pose:options.stateValue===undefined?pose:null,modelState:state,...(config.schemaVersion===2?{modelState:state,apiVersion:2,camera:config.camera||null,materials:{...config.materials,resolvedRoles:{...figure.capabilities.materials,...config.materials.overrides}},renderingPolicy:config.rendering}:{}),dependencies:runtimeInfo.dependencies,bundler:{name:'vite',version:bundlerVersion,binding:'wasm32-wasi'},provenance,rendering:{purpose:options.printMode?'print':'screen',adapter:result.renderer||'authored-svg',...(result.renderer==='three-illustration'?{sceneLibrary:'three',version:runtimeInfo.dependencies.three}:{})},outputHashes:Object.fromEntries(Object.entries(files).map(([name,value])=>[name,hash(value)]))};
  files['build-manifest.json']=json(manifest);
  const old=await verifyOwnership(out);await mkdir(out,{recursive:true});
  for(const [name,value] of Object.entries(files))await writeFile(path.join(out,name),value);
  for(const name of ['figure.html','figure.svg'])if(old?.outputHashes[name]&&!files[name])await unlink(path.join(out,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
  return {out,files:Object.keys(files),manifest};
}
