export * as illustration from './three/index.mjs';
export {scalarMotion} from './model-runtime.mjs';
/**
 * @typedef {{viewBox:[number,number,number,number],body:string,title:string,description:string,renderer?:'three-illustration'}} RenderResult
 * @typedef {Object} Figure
 * @property {string} id Stable lowercase identifier.
 * @property {{detail:Array<'compact'|'standard'|'detailed'>}} capabilities Supported detail modes.
 * @property {Object} initialState Finite JSON model inputs.
 * @property {Record<string,Object>} poses Complete named states; rest equals initialState.
 * @property {(args:{kit:Object,config:Object,tokens:Object,state:Object})=>RenderResult} render Pure SVG construction.
 * @property {{schemaVersion?:1,tolerance?:number,exceptions?:Array<{code:string,parts:string[],reason:string,detail?:string}>}} [auditPolicy] Authored diagnostic policy; not executed evidence.
 * @property {URL} [clientEntry] Local module exporting mount({root,config,initialState}) => cleanup.
 */
/** Escape text or quoted attribute content. Author-provided SVG body is trusted code. */
export const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export {registerController} from './controller.mjs';
export * as effects from './effects/index.mjs';
