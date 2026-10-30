import {createScene} from './scene.mjs';
export function mount({root,kit,config,tokens,initialState}){return kit.illustration.mountScalarScene({root,config,stage:createScene({kit,config,tokens}),initial:initialState.turnDeg,state:turnDeg=>({turnDeg}),control:{label:'Assembly turn (degrees)',min:0,max:16,step:1},poses:{Rest:0,Middle:8,Turned:16}});}
