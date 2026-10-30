import {createScene} from './scene.mjs';
export function mount({root,kit,config,tokens,initialState}){return kit.illustration.mountScalarScene({root,config,stage:createScene({kit,config,tokens}),initial:initialState.liftMm,state:liftMm=>({liftMm}),control:{label:'Valve lift (mm)',min:0,max:12,step:.1},poses:{Closed:0,Half:6,Open:12}});}
