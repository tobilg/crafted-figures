'use client';
import { createElement, useEffect, useRef } from 'react';
import * as kit from '../index.mjs';
import { bindKit } from '../bind.mjs';
/** How long a displayed state can still arrive back as an echo of `onState`. */
const ECHO_WINDOW_MS = 250;
/** @template {Record<string,unknown>} S
 * @typedef {{id:string,figureId:string,html:string,config:import('../contracts.mjs').Configuration,tokens:Record<string,string>,initialState:S,poses:Record<string,S>,mount:(context:{root:HTMLElement,kit:typeof kit,config:import('../contracts.mjs').Configuration,tokens:Record<string,string>,initialState:S})=>Function|import('../contracts.mjs').Controller<S>,state?:S,onState?:(state:S)=>void}} LiveFigureProps */
/** Instance lifecycle. Geometry updates use the controller and do not render React
 * again. `mount` must have stable module identity; changes deliberately remount.
 *
 * `state` and `onState` may be wired together as a controlled component. A state this figure
 * just displayed is an echo, not a command: applying it would redraw, emit again and cancel
 * any easing in progress. Only a state the figure has not shown is applied. */
export function useFigure({ root, mount, config, tokens, initialState, poses, state, onState }) {
  const controller = useRef(null),
    callback = useRef(onState),
    emitted = useRef(new WeakSet()),
    recent = useRef([]);
  callback.current = onState;
  // biome-ignore lint/correctness/useExhaustiveDependencies: root is a stable ref
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const c = kit.registerController(
      el,
      mount({ root: el, kit: bindKit(kit, { config, tokens }), config, tokens, initialState }),
      { poses },
    );
    controller.current = c;
    const event = e => {
      emitted.current.add(e.detail.state);
      recent.current.push([performance.now(), JSON.stringify(e.detail.state)]);
      if (recent.current.length > 64) recent.current.shift();
      callback.current?.(e.detail.state);
    };
    el.addEventListener('crafted:state', event);
    return () => {
      el.removeEventListener('crafted:state', event);
      c.dispose();
      controller.current = null;
    };
  }, [mount, config, tokens, initialState, poses]);
  useEffect(() => {
    const c = controller.current;
    if (!state || !c?.setState || emitted.current.has(state)) return;
    const value = JSON.stringify(state),
      now = performance.now();
    if (recent.current.some(([time, shown]) => shown === value && now - time < ECHO_WINDOW_MS))
      return;
    if (c.getState && JSON.stringify(c.getState()) === value) return;
    c.setState(state, { immediate: true });
  }, [state]);
  return controller;
}
/** Server-rendered `html` is stable during hydration and later model changes.
 * Supply id/figureId matching the server frame. Use the hook directly for custom UI. */
/** @template {Record<string,unknown>} S
 * @param {LiveFigureProps<S>} props */
export function LiveFigure({
  id,
  figureId,
  html,
  config,
  tokens,
  initialState,
  poses,
  mount,
  state,
  onState,
}) {
  const root = useRef(null);
  useFigure({ root, mount, config, tokens, initialState, poses, state, onState });
  return createElement('article', {
    ref: root,
    className: 'crafted',
    'data-instance': id,
    'data-figure': figureId,
    'data-frame': config.frame,
    // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered figure from trusted authoring code
    dangerouslySetInnerHTML: { __html: html },
  });
}
