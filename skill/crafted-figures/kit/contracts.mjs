/** Public contracts are maintained here as JSDoc and emitted by TypeScript.
 * Runtime validation remains authoritative for numeric ranges and capabilities.
 * @typedef {'compact'|'standard'|'detailed'} Detail
 * @typedef {'light'|'dark'} Theme
 * @typedef {{enabled?:boolean,idleTour?:boolean,durationMs?:number}} Motion
 * @typedef {{preset?:string,theme?:Theme,accent?:string,detail?:Detail,frame?:'card'|'minimal',typography?:{body?:string,mono?:string},stroke?:{width?:number},motion?:Motion,output?:'html'|'svg'|'both'}} Appearance
 * @typedef {Appearance & ({schemaVersion?:1,eyebrow?:never,language?:never,camera?:never,materials?:never,rendering?:never}|{schemaVersion:2,eyebrow?:string,language?:string,camera?:{azimuth?:number,elevation?:number,padding?:number},materials?:{overrides?:Record<string,string>},rendering?:{effects?:'auto'|'off',pixelRatioCap?:number,quality?:'draft'|'standard'}})} Configuration
 * @typedef {{viewBox:[number,number,number,number],body:string,title:string,description:string,eyebrow?:string,figureNumber?:string,caption?:string,legend?:Array<{label:string,description:string}>,renderer?:'three-illustration'}} RenderResult
 * @typedef {{detail:Detail[],camera?:{default:{azimuth:number,elevation:number,padding:number},views:Array<{azimuth:number,elevation:number}>},materials?:Record<string,string>}} Capabilities
 */
/** @template {Record<string,unknown>} S
 * @typedef {{id:string,capabilities:Capabilities,initialState:S,poses:Record<string,S>,render:(args:{kit:typeof import('./index.mjs'),config:Configuration,tokens:Record<string,string>,state:S})=>RenderResult,clientEntry?:URL,createScene?:(args:{kit:typeof import('./index.mjs'),config:Configuration,tokens:Record<string,string>})=>any,auditPolicy?:{schemaVersion?:1,tolerance?:number,exceptions?:Array<{code:string,parts:string[],reason:string,detail?:string}>}}} Figure
 */
/** @template {Record<string,unknown>} S
 * @typedef {{dispose:()=>void,stage?:any,effects?:any,poseNames?:string[],getState?:()=>S,setState?:(state:S,options?:{immediate?:boolean})=>void,setTime?:(time:number)=>void,pause?:()=>void,resume?:()=>void,getStats?:()=>Record<string,unknown>}} Controller
 */
export {};
