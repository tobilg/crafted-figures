import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {bundleModule} from '../../skill/crafted-figures/kit/bundler.mjs';
import {resolveConfig} from '../../skill/crafted-figures/kit/config.mjs';
import {styleSheet} from '../../skill/crafted-figures/kit/styles.mjs';
import {safeJSON} from '../../skill/crafted-figures/kit/build.mjs';
const out='out/three-hybrid';await mkdir(out,{recursive:true});
const bundle=await bundleModule({source:`import {mountPrototype} from './client.mjs';const config=window.__config,tokens=window.__tokens;let app;function mount(){app?.dispose();app=mountPrototype(document.querySelector('article'),config,tokens);window.__prototype=app;}window.__remount=mount;mount();addEventListener('pagehide',()=>app.dispose());`,root:new URL('.',import.meta.url).pathname});
const license=await readFile('node_modules/three/LICENSE','utf8');
for(const theme of ['light','dark']){
 const {config,tokens}=await resolveConfig({layers:[{label:'prototype',value:{theme}}]});
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Three.js hybrid dial experiment</title><style>${styleSheet(config,tokens)}[data-stage]{position:relative;width:100%;aspect-ratio:1.5;touch-action:pan-y;background:var(--cf-card)}[data-stage]>svg,[data-stage]>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}[data-stage]>canvas{pointer-events:none}[data-stage]>svg{overflow:hidden}button{margin:4px}output{display:block;margin:12px 0;font-family:var(--cf-mono)}[data-status]{font-size:13px}</style></head><body><article class="crafted"><div class="eyebrow">Bounded Three.js experiment</div><h1>One dial. Two render paths.</h1><p>The marker travels around the dial, behind and in front of the tall support. Drag or use the angle control. Fixed camera; 0–360°.</p><div data-stage></div><label for="angle">Rotor angle (degrees)</label><input id="angle" type="range" min="0" max="360" step="1"><div><button data-pose="hidden">Behind</button><button data-pose="partial">Crossing</button><button data-pose="foreground">In front</button></div><output aria-live="off">243.0°</output><p data-status></p></article><!--${license}--><script>window.__config=${safeJSON(config)};window.__tokens=${safeJSON(tokens)};${bundle.code.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
 await writeFile(`${out}/${theme}.html`,html);
}
await writeFile(`${out}/build-info.json`,JSON.stringify({experiment:'three-hybrid',three:JSON.parse(await readFile('node_modules/three/package.json','utf8')).version,scope:['box','cylinder','disc'],camera:'fixed orthographic; Z up',range:[0,360]},null,2)+'\n');console.log(`Built ${out}/light.html and dark.html`);
