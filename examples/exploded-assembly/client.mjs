import {createScene} from './scene.mjs';
export function mount({root,kit,config,tokens,initialState}){
 const s=createScene({kit,config,tokens}),mount=s.mount;let fx,time=initialState.time;const update=s.update;s.update=state=>{time=state.time;return update(state);};s.mount=g=>{const view=mount(g);return {update(){view.update();fx?.render(time);},dispose:()=>view.dispose()};};
 const scalar=kit.illustration.mountScalarScene({root,config,stage:s,initial:initialState.time,state:time=>({time}),control:{label:'Sequence time (s)',min:0,max:7,step:.01},poses:{Assembled:0,Reversal:.72,Apart:3.7,Seated:7}});
 fx=kit.effects.mountEffects(root,s,config);fx.render(time);root.__effects=fx;
 const cleanup=()=>{fx.dispose();delete root.__effects;scalar();};Object.assign(cleanup,scalar);
 return kit.illustration.clipControls({root,controller:cleanup,duration:7,motion:config.motion});
}
