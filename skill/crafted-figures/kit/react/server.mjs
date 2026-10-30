import * as kit from '../index.mjs';import {resolveConfig,loadPresets,loadMaterials} from '../config.mjs';import {frameHTML} from './frame.mjs';
/** Resolve one explicit request on the server and pass only serializable data to
 * a client wrapper that imports its own browser mount. No React dependency here. */
export async function prepareFigure({id,figure,pose='rest',config={},presets,materials}){
 if(!Object.hasOwn(figure.poses,pose))throw new Error(`Unknown pose ${pose}`);const resolved=await resolveConfig({layers:[{label:'React config',value:config}],presets:presets||await loadPresets(),materials:materials||await loadMaterials(),capabilities:figure.capabilities});
 const initialState=structuredClone(figure.poses[pose]);return {id,figureId:figure.id,...frameHTML({id,figure,...resolved,state:initialState,kit}),config:resolved.config,tokens:resolved.tokens,initialState,poses:figure.poses};
}
