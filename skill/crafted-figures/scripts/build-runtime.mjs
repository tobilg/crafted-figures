// Development only: generate the installation-free release runtime with Vite 8.
import {build} from 'vite';
import {builtinModules,createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,cp,rename,rm,mkdtemp,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const dest=path.join(root,'runtime'),stage=await mkdtemp(path.join(root,'.runtime-build-'));
const external=id=>id.startsWith('node:')||builtinModules.includes(id);
const digest=value=>createHash('sha256').update(value).digest('hex');
const packageDir=name=>path.join(root,'node_modules',name);
// These two pinned upstream loaders use createRequire, which bundlers correctly
// leave dynamic. Adapt only their literal package loads into static imports.
// This is dependency wiring; Vite/Rolldown still parse and bundle real modules.
function portableLoaders(){return {name:'crafted-portable-loaders',transform(code,id){
 if(id.endsWith('/vite/dist/node/chunks/node.js'))for(const name of ['picomatch']){
  const call=`__require(${JSON.stringify(name)})`;
  if(!code.includes(call))throw new Error(`Review Vite loader adapter: missing ${call}`);
  code=`import __crafted_${name} from '${name}';\n`+code.replaceAll(call,`__crafted_${name}`);
 }
 if(id.endsWith('/@rolldown/binding-wasm32-wasi/wasi-worker.mjs')){
  const call="require('@napi-rs/wasm-runtime')";
  if(!code.includes(call))throw new Error('Review Rolldown WASI worker adapter');
  code="import * as __craftedWasmRuntime from '@napi-rs/wasm-runtime';\n"+code.replaceAll(call,'__craftedWasmRuntime');
 }
 return code;
}};}
async function bundle(entry,file,{format='es',node=true,define={},banner=''}={}){
 await build({root,configFile:false,envDir:false,publicDir:false,logLevel:'warn',
  plugins:[portableLoaders()],define,ssr:{noExternal:true},css:{postcss:{plugins:[]}},
  build:{ssr:node,write:true,emptyOutDir:false,outDir:stage,minify:false,cssMinify:false,target:'es2022',
   lib:{entry,formats:[format],fileName:()=>file},
   rolldownOptions:{cwd:root,external:id=>external(id)||['lightningcss','fsevents'].includes(id),output:{entryFileNames:file,codeSplitting:false,banner}}}});
}
try{
 await bundle(path.join(packageDir('three'),'build/three.module.js'),'three.mjs',{node:false});
 await bundle(require.resolve('ajv'),'ajv.mjs');
 const viteEntry=path.join(root,'scripts/runtime-entries/vite.mjs');
 await bundle(viteEntry,'vite/dist/node/chunks/build.mjs',{
  define:{'process.env.NAPI_RS_NATIVE_LIBRARY_PATH':'__craftedFileURLToPath(new URL("./binding.cjs", import.meta.url))','process.env.NAPI_RS_FORCE_WASI':'"false"'},
  banner:'import {fileURLToPath as __craftedFileURLToPath} from "node:url";'});
 const wasi=packageDir('@rolldown/binding-wasm32-wasi');
 await bundle(path.join(wasi,'rolldown-binding.wasi.cjs'),'vite/dist/node/chunks/binding.cjs',{format:'cjs'});
 await bundle(path.join(wasi,'wasi-worker.mjs'),'vite/dist/node/chunks/wasi-worker.mjs');
 await cp(path.join(wasi,'rolldown-binding.wasm32-wasi.wasm'),path.join(stage,'vite/dist/node/chunks/rolldown-binding.wasm32-wasi.wasm'));
 // Vite resolves its client resources relative to dist/node/chunks, even during
 // a library build. Preserve that layout; no dev server is exposed by the CLI.
 await cp(path.join(packageDir('vite'),'dist/client'),path.join(stage,'vite/dist/client'),{recursive:true});
 // Keep browser automation, installer data and notices. Our CLI does not expose
 // Playwright's recorder, report/dashboard/trace UIs or its separate agent skills.
 const excludedPlaywright=['lib/vite','lib/tools/skills'];
 await cp(packageDir('playwright-core'),path.join(stage,'playwright-core'),{recursive:true,filter:source=>{
  const relative=path.relative(packageDir('playwright-core'),source).split(path.sep).join('/');
  return !source.endsWith('.d.ts')&&!source.endsWith('.map')&&!excludedPlaywright.some(p=>relative===p||relative.startsWith(p+'/'));
 }});
 await writeFile(path.join(stage,'three.d.mts'),"export * from 'three';\n");
 await writeFile(path.join(stage,'ajv.d.mts'),"export {default} from 'ajv';\n");
 // Carry notices for the complete locked development dependency closure used
 // to produce these bundles, including the WASM binary's MIT license.
 const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8')),dependencies={};
 for(const [location,info] of Object.entries(lock.packages).sort()){
  if(!location||info.peer||info.os&&!info.os.includes(process.platform))continue;
  const directory=path.join(root,location);try{await access(directory);}catch{continue;}
  const metadata=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
  // Native binaries are used only to build this distribution, not shipped.
  if(metadata.os||metadata.cpu)continue;
  dependencies[metadata.name]=metadata.version;
  const notices=(await readdir(directory)).filter(name=>/^(license|licence|copying|notice)(\.|$)/i.test(name));
  for(const name of notices){const target=path.join(stage,'licenses',metadata.name.replaceAll('/','__'),name);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(directory,name),target,{recursive:true});}
 }
 async function collect(dir){const files={};for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:1)){const file=path.join(dir,e.name);if(e.isDirectory())Object.assign(files,await collect(file));else files[path.relative(stage,file).split(path.sep).join('/')]=digest(await readFile(file));}return files;}
 const inputs={};for(const name of ['package-lock.json','scripts/build-runtime.mjs','scripts/runtime-entries/vite.mjs'])inputs[name]=digest(await readFile(path.join(root,name)));
 const manifest={generator:'crafted-figures-runtime',toolkitVersion:pkg.version,bundler:{name:'vite',version:pkg.devDependencies.vite,compiler:'rolldown',versionCompiler:pkg.devDependencies.rolldown,binding:'wasm32-wasi'},excludedPlaywright,inputs,dependencies,files:await collect(stage)};
 await writeFile(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 try{const old=JSON.parse(await readFile(path.join(dest,'manifest.json'),'utf8'));if(old.generator!==manifest.generator)throw new Error('Refusing to replace an unowned runtime directory');await rm(dest,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 await rename(stage,dest);
 console.log(`Bundled runtime with Vite ${pkg.devDependencies.vite}; ${Object.keys(manifest.files).length} files. No consumer npm install required.`);
}finally{await rm(stage,{recursive:true,force:true});}
