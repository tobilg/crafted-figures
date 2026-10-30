'use client';
import {createElement,useEffect,useRef} from 'react';import * as kit from '../index.mjs';
/** @template {Record<string,unknown>} S
 * @typedef {{id:string,figureId:string,html:string,config:import('../contracts.mjs').Configuration,tokens:Record<string,string>,initialState:S,poses:Record<string,S>,mount:(context:{root:HTMLElement,kit:typeof kit,config:import('../contracts.mjs').Configuration,tokens:Record<string,string>,initialState:S})=>Function|import('../contracts.mjs').Controller<S>,state?:S,onState?:(state:S)=>void}} LiveFigureProps */
/** Instance lifecycle. Geometry updates use the controller and do not render React
 * again. `mount` must have stable module identity; changes deliberately remount. */
export function useFigure({root,mount,config,tokens,initialState,poses,state,onState}){
 const controller=useRef(null),callback=useRef(onState);callback.current=onState;
 useEffect(()=>{const el=root.current;if(!el)return;const c=kit.registerController(el,mount({root:el,kit,config,tokens,initialState}),{poses});controller.current=c;
 const event=e=>callback.current?.(e.detail.state);el.addEventListener('crafted:state',event);
 return ()=>{el.removeEventListener('crafted:state',event);c.dispose();controller.current=null;};},[mount,config,tokens,initialState,poses]);
 useEffect(()=>{if(state)controller.current?.setState?.(state,{immediate:true});},[state]);return controller;
}
/** Server-rendered `html` is stable during hydration and later model changes.
 * Supply id/figureId matching the server frame. Use the hook directly for custom UI. */
/** @template {Record<string,unknown>} S
 * @param {LiveFigureProps<S>} props */
export function LiveFigure({id,figureId,html,config,tokens,initialState,poses,mount,state,onState}){
 const root=useRef(null);useFigure({root,mount,config,tokens,initialState,poses,state,onState});return createElement('article',{ref:root,className:'crafted','data-instance':id,'data-figure':figureId,'data-frame':config.frame,dangerouslySetInnerHTML:{__html:html}});
}
