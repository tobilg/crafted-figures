import {moduleSources} from './bundler.mjs';import {readFile,readdir,lstat,mkdtemp,rm,realpath} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildFigure} from './build.mjs';import {printSheet} from './print/index.mjs';import {writeOwnedSet,digest} from './owned-output.mjs';
import {collectSkillFiles} from './package-files.mjs';
const packageRoot=fileURLToPath(new URL('..',import.meta.url));
async function filesBelow(dir){const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw new Error(`Source bundles do not follow symlink ${p}`);if(e.isDirectory())files.push(...await filesBelow(p));else files.push(p);}return files;}
function commonRoot(files){let root=path.dirname(files[0]);for(const file of files)while(path.relative(root,file).startsWith('..'+path.sep)||path.isAbsolute(path.relative(root,file)))root=path.dirname(root);return root;}
/** Explicit local delivery. Sources are copied, never rewritten or published.
 * The Vite module graph discovers local module/JSON dependencies; non-imported assets
 * must be declared with --asset. The packaged toolkit supplies runtime libraries. */
export async function bundleFigure(options){
 const aliases=new Map();async function canonical(file){const absolute=path.resolve(file);if((await lstat(absolute)).isSymbolicLink())throw new Error(`Bundle source must not be a symlink: ${file}`);const result=await realpath(absolute);aliases.set(absolute,result);return result;}
 const entry=await canonical(options.entry),figure=(await import(pathToFileURL(entry).href)).default,inputs=new Set([entry]);
 for(const source of [entry,figure.clientEntry&&fileURLToPath(figure.clientEntry),options.sheet&&path.resolve(options.sheet)].filter(Boolean)){
 const sources=await moduleSources(source);for(const p of sources){const file=await canonical(p);if(!file.split(path.sep).includes('node_modules'))inputs.add(file);}}
 for(const p of [options.config,options.projectConfig,...options.presetFiles||[],...options.materialFiles||[],...options.assets||[]].filter(Boolean))inputs.add(await canonical(p));
 for(const file of inputs){const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error(`Bundle source must be a regular declared file: ${file}`);if(file.includes(`${path.sep}reference${path.sep}anatomy${path.sep}`))throw new Error('Bundle cannot depend on the reference checkout; migrate the source first');}
 const root=commonRoot([...inputs]);if(root===path.parse(root).root)throw new Error('Declared sources span the filesystem root; collect them under one project directory');
 const portable=file=>'sources/'+path.relative(root,aliases.get(path.resolve(file))||path.resolve(file)).split(path.sep).join('/'),files={};for(const file of [...inputs].sort())files[portable(file)]=await readFile(file);
 for(const [name,bytes] of Object.entries(await collectSkillFiles(packageRoot)))files['toolkit/'+name]=bytes;
 // Retain pinned development inputs and public package exports for optional
 // framework consumers. Standalone rebuilds use the included runtime bundles.
 const pkg=JSON.parse(await readFile(path.join(packageRoot,'package.json'),'utf8')),lock=JSON.parse(await readFile(path.join(packageRoot,'package-lock.json'),'utf8'));pkg.bin={'crafted-figures':'toolkit/scripts/figures.mjs'};pkg.types='./toolkit/types/index.d.mts';for(const paths of Object.values(pkg.exports))for(const key of Object.keys(paths))paths[key]=paths[key].replace('./','./toolkit/');lock.packages[''].bin=pkg.bin;files['package.json']=JSON.stringify(pkg,null,2)+'\n';files['package-lock.json']=JSON.stringify(lock,null,2)+'\n';
 const request={entry:portable(entry),out:'artifacts',state:options.state||'rest',overrides:{...options.overrides},...(options.config?{config:portable(options.config)}:{}),...(options.projectConfig?{projectConfig:portable(options.projectConfig)}:{}),presetFiles:(options.presetFiles||[]).map(portable),materialFiles:(options.materialFiles||[]).map(portable)};
 files['rebuild.mjs']=`import {buildFigure} from './toolkit/kit/build.mjs';\n${options.sheet?"import {printSheet} from './toolkit/kit/print/index.mjs';\n":''}await buildFigure(${JSON.stringify(request,null,2)});\n${options.sheet?`await printSheet({spec:${JSON.stringify(portable(options.sheet))},paper:'a4',format:'all',png:true,out:'print'});\n`:''}`;
 files['REBUILD.md']=`# Local figure bundle\n\nUse Node 22.13+ or Node 24+. Run \`node rebuild.mjs\` (no npm installation) from this directory.${options.sheet?' Printing requires Chrome/Chromium: set CRAFTED_CHROMIUM_EXECUTABLE or explicitly run `node toolkit/runtime/playwright-core/cli.js install chromium`.':''}\n\nOpen artifacts/figure.html or artifacts/figure.svg directly to view offline. Sources are in sources/; the toolkit and MIT notices are in toolkit/. No account, reference checkout or publication service is used.\n`;
 const tmp=await mkdtemp(path.join(os.tmpdir(),'crafted-share-'));try{
 await buildFigure({...options,out:path.join(tmp,'artifacts'),overrides:{...options.overrides}});if(options.sheet)await printSheet({spec:options.sheet,paper:'a4',format:'all',png:true,out:path.join(tmp,'print')});for(const file of await filesBelow(tmp))files[path.relative(tmp,file).split(path.sep).join('/')]=await readFile(file);
 }finally{await rm(tmp,{recursive:true,force:true});}
 return writeOwnedSet(path.resolve(options.out),files,{generator:'crafted-figures-bundle',manifestName:'bundle-manifest.json',metadata:{schemaVersion:1,entry:request.entry,request,declaredAssets:(options.assets||[]).map(portable),sourceHashes:Object.fromEntries([...inputs].sort().map(file=>[portable(file),digest(files[portable(file)])]))}});
}
