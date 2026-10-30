import {scalarMotion} from '../model-runtime.mjs';
/** Shared scalar control for real model-backed scenes. `stage.update(state)` returns
 * a model with a truthful `reading`; the callback maps scalar input to model state.
 * @param {{root:HTMLElement,config:Object,stage:Object,initial:number,state:Function,control:{label:string,min:number,max:number,step:number},poses?:Record<string,number>,idleAt?:Function}} options
 * @returns {()=>void} idempotent cleanup, preserving the last static artwork
 */
export function mountScalarScene({root,config,stage,initial,state,control,poses={},idleAt}){
  const svg=root.querySelector('svg'),controls=root.querySelector('[data-controls]'),readout=root.querySelector('[data-live-readout]');
  const label=document.createElement('label'),input=document.createElement('input'),help=document.createElement('span');
  let n=1;while(document.getElementById(`${root.dataset.figure}-input-${n}`))n++;const id=`${root.dataset.figure}-input-${n}`;label.htmlFor=id;label.textContent=control.label;input.id=id;input.type='range';input.min=String(control.min);input.max=String(control.max);input.step=String(control.step);input.value=String(initial);help.textContent='Drag the drawing or use the slider. Arrow keys adjust; Home / End reach the stops.';
  help.id=id+'-help';input.setAttribute('aria-describedby',help.id);
  controls.replaceChildren(label,input,help);const abort=new AbortController(),opts={signal:abort.signal};
  stage.update(state(initial));const view=stage.mount(svg.querySelector('[data-scene]'));root.__stage=stage;
  const motion=scalarMotion({root,motion:config.motion,initial,idleAt,draw:value=>{const m=stage.update(state(value));view.update();root.dataset.displayed=String(value);root.querySelector('[data-part="static-readout"]').textContent=m.reading;readout.textContent=m.reading;input.setAttribute('aria-valuetext',m.reading);root.dispatchEvent(new CustomEvent('crafted:state',{detail:{state:state(value),readout:m.reading}}));}});
  root.__motion=motion;svg.dataset.interactive='';input.addEventListener('input',()=>motion.set(Number(input.value)),opts);
  if(Object.keys(poses).length){const buttons=document.createElement('div');for(const [name,value] of Object.entries(poses)){const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.pose=name;b.addEventListener('click',()=>{input.value=String(value);motion.set(value);},opts);buttons.append(b);}controls.append(buttons);}
  let pointer=null,disposed=false;
  const steer=e=>{const b=svg.getBoundingClientRect(),t=Math.min(1,Math.max(0,(e.clientX-b.left)/b.width)),v=Math.min(control.max,Math.max(control.min,control.min+Math.round(t*(control.max-control.min)/control.step)*control.step));input.value=String(v);motion.set(Number(input.value));};
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;svg.setPointerCapture(pointer);steer(e);},opts);svg.addEventListener('pointermove',e=>{if(e.pointerId===pointer)steer(e);},opts);
  const release=()=>{if(pointer!==null&&svg.hasPointerCapture(pointer))svg.releasePointerCapture(pointer);pointer=null;};svg.addEventListener('pointerup',release,opts);svg.addEventListener('pointercancel',release,opts);
  const cleanup=()=>{if(disposed)return;disposed=true;release();abort.abort();motion.dispose();view.dispose();stage.dispose();controls.replaceChildren();readout.replaceChildren();delete svg.dataset.interactive;delete root.__motion;delete root.__stage;};
  const key=Object.keys(state(initial))[0];
  cleanup.getState=()=>state(motion.value);
  cleanup.setState=(next,{immediate=false}={})=>{const value=next[key];if(!Number.isFinite(value))throw new Error(`state.${key}: finite input required`);const clamped=Math.min(control.max,Math.max(control.min,value));input.value=String(clamped);if(immediate)motion.jump(clamped);else motion.set(clamped);};
  cleanup.pause=()=>motion.pause();cleanup.resume=()=>motion.resume();cleanup.getStats=()=>({...motion.stats});
  return cleanup;
}
