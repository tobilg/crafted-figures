import {build,version} from '../runtime/vite/dist/node/chunks/build.mjs';
import {builtinModules} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const bundlerVersion=version;
const builtin=id=>id.startsWith('node:')||builtinModules.includes(id);
/** Vite 8 library build. One inline JS chunk; no implicit config, env or assets.
 * The toolkit owns its CSS. Reject asset/module side outputs instead of silently
 * generating HTML that needs additional files or a development server. */
export async function bundleModule({entry,source,root=path.dirname(entry),platform='browser',minify=true,graphOnly=false}){
 const virtual=path.join(path.resolve(root),'__crafted_figure_client__.mjs'),files=new Set();
 const result=await build({root:path.resolve(root),configFile:false,envDir:false,publicDir:false,logLevel:'error',
  resolve:{alias:[{find:/^three$/,replacement:fileURLToPath(new URL('../runtime/three.mjs',import.meta.url))}]},
  css:{postcss:{plugins:[]}},ssr:{noExternal:true},
  plugins:[{name:'crafted-entry-and-sources',enforce:'pre',resolveId(id){if(source!==undefined&&id===virtual)return '\0crafted-entry';},load(id){if(id==='\0crafted-entry')return source;},moduleParsed(info){if(path.isAbsolute(info.id)&&!info.id.includes('\0'))files.add(info.id);},generateBundle(_options,outputs){for(const item of Object.values(outputs))if(item.type!=='chunk')throw new Error('Standalone figure clients support JS/JSON modules only; keep styles in toolkit tokens and artwork in SVG.');}}],
  build:{ssr:platform==='node',write:false,target:'es2022',minify:graphOnly?false:minify,cssMinify:false,
   lib:{entry:source===undefined?entry:virtual,name:'CraftedFigure',formats:[platform==='node'?'es':'iife']},
   rolldownOptions:{external:platform==='node'?builtin:undefined,treeshake:!graphOnly,
    output:{codeSplitting:false,entryFileNames:'figure-client.js',comments:{legal:true}}}}});
 const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output);
 if(outputs.length!==1||outputs[0].type!=='chunk')throw new Error('Expected one standalone JavaScript bundle');
 return {code:outputs[0].code,files:[...files].sort()};
}
export async function moduleSources(entry,platform='node'){
 return (await bundleModule({entry,platform,graphOnly:true})).files;
}
