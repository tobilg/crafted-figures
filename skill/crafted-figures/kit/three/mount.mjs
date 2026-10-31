import { scalarMotion } from '../model-runtime.mjs';
/** Pointer input follows closely; the easing still avoids a visible jump. */
const GESTURE_MS = 80;
function requireElement(root, selector, hint) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`mount: figure has no ${selector}. ${hint}`);
  return element;
}
/** The figure output the live scene needs, with a correction instead of a null error. */
function figureElements(root) {
  const svg = requireElement(root, 'svg', 'Render it with the standard figure wrapper.');
  return {
    svg,
    group: requireElement(svg, '[data-scene]', 'Wrap the stage output in <g data-scene="three">.'),
    controls: requireElement(
      root,
      '[data-controls]',
      'Render it with the standard figure wrapper.',
    ),
    readout: requireElement(
      root,
      '[data-live-readout]',
      'Render it with the standard figure wrapper.',
    ),
    // Optional: a figure may show its reading only through the live readout.
    staticReadout: root.querySelector('[data-part="static-readout"]'),
  };
}
/** Attach the optional effects compositor after the first draw. Effects are passed in, so
 * figures without them do not bundle the WebGL renderer.
 * @param {{mountEffects:Function}|undefined} effects
 */
function attachEffects(root, stage, config, effects, time) {
  if (!effects) return null;
  const fx = effects.mountEffects(root, stage, config);
  fx.render(time);
  return fx;
}
function publish(root, element, staticReadout, input, state, reading) {
  if (staticReadout) staticReadout.textContent = reading;
  element.textContent = reading;
  input?.setAttribute('aria-valuetext', reading);
  root.dispatchEvent(new CustomEvent('crafted:state', { detail: { state, readout: reading } }));
}
/** Shared scalar control for real model-backed scenes. `stage.update(state)` returns
 * a model with a truthful `reading`; the callback maps scalar input to model state.
 * Pass `effects: kit.effects` to composite authored effects from the displayed state, with
 * `effectTime(state)` selecting their clock. `control.drag` maps pointer drags onto the
 * screen projection of a world segment instead of the drawing's width.
 * @param {{root:HTMLElement,config:Object,stage:Object,initial:number,state:(value:number)=>Record<string,unknown>,control:{label:string,min:number,max:number,step:number,help?:string,drag?:{from:number[],to:number[]}},poses?:Record<string,number>,idleAt?:(elapsedMs:number)=>number,effects?:{mountEffects:Function},effectTime?:(state:Record<string,unknown>)=>number}} options
 * @returns {(()=>void)&import('../contracts.mjs').Controller<Record<string,unknown>>} idempotent cleanup, preserving the last static artwork
 */
export function mountScalarScene({
  root,
  config,
  stage,
  initial,
  state,
  control,
  poses = {},
  idleAt,
  effects,
  effectTime = () => 0,
}) {
  const { svg, group, controls, readout, staticReadout } = figureElements(root);
  const label = document.createElement('label'),
    input = document.createElement('input'),
    help = document.createElement('span');
  let n = 1;
  while (document.getElementById(`${root.dataset.figure}-input-${n}`)) n++;
  const id = `${root.dataset.figure}-input-${n}`;
  label.htmlFor = id;
  label.textContent = control.label;
  input.id = id;
  input.type = 'range';
  input.min = String(control.min);
  input.max = String(control.max);
  input.step = String(control.step);
  input.value = String(initial);
  help.textContent =
    control.help ??
    'Drag the drawing or use the slider. Arrow keys adjust; Home / End reach the stops.';
  help.id = id + '-help';
  input.setAttribute('aria-describedby', help.id);
  controls.replaceChildren(label, input, help);
  const abort = new AbortController(),
    opts = { signal: abort.signal };
  stage.update(state(initial));
  const view = stage.mount(group);
  let fx = null;
  const motion = scalarMotion({
    root,
    motion: config.motion,
    initial,
    idleAt,
    draw: value => {
      const displayed = state(value),
        m = stage.update(displayed);
      view.update();
      fx?.render(effectTime(displayed));
      root.dataset.displayed = String(value);
      publish(root, readout, staticReadout, input, displayed, m.reading);
    },
    onError: (_error, value) => {
      input.value = String(value);
    },
  });
  fx = attachEffects(root, stage, config, effects, effectTime(state(initial)));
  root.__motion = motion;
  svg.dataset.interactive = '';
  let sliderHeld = false;
  input.addEventListener(
    'pointerdown',
    () => {
      sliderHeld = true;
    },
    opts,
  );
  for (const type of ['pointerup', 'pointercancel'])
    document.addEventListener(
      type,
      () => {
        sliderHeld = false;
      },
      opts,
    );
  input.addEventListener(
    'input',
    () => motion.set(Number(input.value), true, sliderHeld ? { durationMs: GESTURE_MS } : {}),
    opts,
  );
  if (Object.keys(poses).length) {
    const buttons = document.createElement('div');
    for (const [name, value] of Object.entries(poses)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.dataset.pose = name;
      b.addEventListener(
        'click',
        () => {
          input.value = String(value);
          motion.set(value);
        },
        opts,
      );
      buttons.append(b);
    }
    controls.append(buttons);
  }
  let pointer = null,
    disposed = false;
  function pointerFraction(e) {
    if (control.drag) {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      return stage.pointerOnSegment([p.x, p.y], control.drag.from, control.drag.to);
    }
    const b = svg.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
  }
  const steer = (e, options) => {
    const t = pointerFraction(e),
      v = Math.min(
        control.max,
        Math.max(
          control.min,
          control.min + Math.round((t * (control.max - control.min)) / control.step) * control.step,
        ),
      );
    input.value = String(v);
    motion.set(Number(input.value), true, options);
  };
  svg.addEventListener(
    'pointerdown',
    e => {
      if (e.button !== 0) return;
      pointer = e.pointerId;
      svg.setPointerCapture(pointer);
      steer(e);
    },
    opts,
  );
  svg.addEventListener(
    'pointermove',
    e => {
      if (e.pointerId === pointer) steer(e, { durationMs: GESTURE_MS });
    },
    opts,
  );
  const release = () => {
    if (pointer !== null && svg.hasPointerCapture(pointer)) svg.releasePointerCapture(pointer);
    pointer = null;
  };
  svg.addEventListener('pointerup', release, opts);
  svg.addEventListener('pointercancel', release, opts);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    release();
    abort.abort();
    motion.dispose();
    fx?.dispose();
    view.dispose();
    stage.dispose();
    controls.replaceChildren();
    readout.replaceChildren();
    delete svg.dataset.interactive;
    delete root.__motion;
  };
  cleanup.dispose = cleanup;
  const shape = state(initial),
    key = Object.keys(shape).find(k => shape[k] === initial) ?? Object.keys(shape)[0];
  cleanup.stage = stage;
  cleanup.effects = fx;
  cleanup.getState = () => state(motion.value);
  cleanup.setState = (next, { immediate = false } = {}) => {
    const value = next[key];
    if (!Number.isFinite(value)) throw new Error(`state.${key}: finite input required`);
    const clamped = Math.min(control.max, Math.max(control.min, value)),
      derived = state(clamped);
    for (const name of Object.keys(next))
      if (name !== key && JSON.stringify(next[name]) !== JSON.stringify(derived[name]))
        throw new Error(`state.${name}: this scene is driven by ${key}; it cannot be set directly`);
    input.value = String(clamped);
    if (immediate) motion.jump(clamped);
    else motion.set(clamped);
  };
  cleanup.pause = () => motion.pause();
  cleanup.resume = () => motion.resume();
  cleanup.getStats = () => ({
    ...motion.stats,
    painterDiagnostics: stage.renderer?.diagnostics?.length ?? 0,
  });
  return cleanup;
}
/** Several native controls over one model state, for scenes a single scalar cannot drive.
 * Updates are immediate. `normalize` lets the pure model clamp or derive input before it is
 * displayed, so controls, readout and geometry share exactly one state.
 * @template {Record<string,unknown>} S
 * @param {{root:HTMLElement,config:Object,stage:Object,initialState:S,normalize?:(state:S)=>S,controls:Array<{key:string,label:string,type?:'range'|'text',min?:number,max?:number,step?:number,maxLength?:number}>,effects?:{mountEffects:Function},effectTime?:(state:S)=>number}} options
 * @returns {import('../contracts.mjs').Controller<S>}
 */
export function mountStateScene({
  root,
  config,
  stage,
  initialState,
  normalize = state => state,
  controls: definitions,
  effects,
  effectTime = () => 0,
}) {
  const { group, controls, readout, staticReadout } = figureElements(root);
  const abort = new AbortController(),
    inputs = {};
  let state = normalize(structuredClone(initialState)),
    disposed = false,
    paused = false,
    fx = null;
  stage.update(state);
  const view = stage.mount(group);
  function setState(next) {
    if (disposed) return;
    for (const name of Object.keys(next))
      if (!Object.hasOwn(state, name)) throw new Error(`state.${name}: not part of this model`);
    const normalized = normalize({ ...state, ...next }),
      m = stage.update(normalized);
    state = normalized;
    view.update();
    fx?.render(effectTime(state));
    for (const key of Object.keys(inputs)) inputs[key].value = String(state[key]);
    publish(root, readout, staticReadout, null, state, m.reading);
  }
  for (const { key, label, type = 'range', min, max, step, maxLength } of definitions) {
    if (!Object.hasOwn(state, key)) throw new Error(`controls: ${key} is not part of the model`);
    const wrapper = document.createElement('label'),
      input = document.createElement('input');
    wrapper.textContent = label;
    input.type = type;
    if (type === 'range') Object.assign(input, { min, max, step });
    else if (maxLength !== undefined) input.maxLength = maxLength;
    input.value = String(state[key]);
    wrapper.append(input);
    controls.append(wrapper);
    inputs[key] = input;
    input.addEventListener(
      'input',
      () => setState({ [key]: type === 'range' ? Number(input.value) : input.value }),
      { signal: abort.signal },
    );
  }
  setState(state);
  fx = attachEffects(root, stage, config, effects, effectTime(state));
  return {
    stage,
    effects: fx,
    getState: () => structuredClone(state),
    setState,
    ...(Object.hasOwn(state, 'time') ? { setTime: time => setState({ time }) } : {}),
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    getStats: () => ({
      pending: false,
      disposed,
      paused,
      painterDiagnostics: stage.renderer?.diagnostics?.length ?? 0,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      fx?.dispose();
      view.dispose();
      stage.dispose();
      controls.replaceChildren();
      readout.replaceChildren();
    },
  };
}
