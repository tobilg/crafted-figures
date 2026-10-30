import {measure} from './model.mjs';
import {createDial} from './scene.mjs';
/** @returns {()=>void} Release input listeners, animation and scene resources. */
export function mount({root,kit,config,initialState}) {
  return kit.illustration.mountScalarScene({root,config,stage:createDial({kit,config}),initial:measure(initialState).displacementMm,state:value=>({displacementMm:value}),control:{label:'Stage displacement (mm)',min:0,max:10,step:.1},idleAt:t=>5-5*Math.cos(t/2000)});
}
