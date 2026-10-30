import {createCabinet} from './scene.mjs';
export function mount({root,kit,config,initialState}){return kit.illustration.mountScalarScene({root,config,stage:createCabinet({kit,config}),initial:initialState.temperatureC,state:temperatureC=>({temperatureC}),control:{label:'Control temperature (°C)',min:10,max:50,step:1},poses:{Cold:10,Two:30,All:50}});}
