const defaultLabels = {
  play: 'Play sequence',
  pause: 'Pause sequence',
  resume: 'Resume sequence',
  replay: 'Replay sequence',
};
/** Add explicit playback to a time-controlled figure. Never starts on mount, and yields to
 * the user: touching any other control or the drawing pauses playback. `rate` is model time per
 * real second, and `until(state)` can end playback before `duration`. The returned controller
 * exposes its `button`.
 * @param {{root:HTMLElement,controller:any,duration:number,key?:string,motion:{enabled:boolean},labels?:Partial<typeof defaultLabels>,rate?:number,until?:(state:any)=>boolean}} options
 */
export function clipControls({
  root,
  controller,
  duration,
  key = 'time',
  motion,
  labels = {},
  rate = 1,
  until,
}) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('clipControls: rate must be positive');
  const text = { ...defaultLabels, ...labels };
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text.play;
  root.querySelector('[data-controls]').append(button);
  const abort = new AbortController(),
    media = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0,
    playing = false,
    last = null,
    visible = true,
    disposed = false;
  // A scalar scene's controller is itself the cleanup; a state scene's has a dispose method.
  const baseDispose = typeof controller === 'function' ? controller : () => controller.dispose(),
    baseStats = controller.getStats || (() => ({}));
  const cancel = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = null;
  };
  const schedule = () => {
    if (
      playing &&
      visible &&
      !document.hidden &&
      !disposed &&
      !frame &&
      !media.matches &&
      motion.enabled
    )
      frame = requestAnimationFrame(tick);
  };
  function tick(now) {
    frame = 0;
    const old = controller.getState(),
      next = Math.min(
        duration,
        old[key] + (last === null ? 0 : Math.min(0.064, (now - last) / 1000) * rate),
      );
    last = now;
    controller.setState({ ...old, [key]: next }, { immediate: true });
    if (next >= duration || until?.(controller.getState())) {
      playing = false;
      button.textContent = text.replay;
    }
    schedule();
  }
  const play = () => {
    if (media.matches || !motion.enabled) {
      controller.setState({ ...controller.getState(), [key]: duration }, { immediate: true });
      return;
    }
    const current = controller.getState();
    if (current[key] >= duration || until?.(current))
      controller.setState({ ...controller.getState(), [key]: 0 }, { immediate: true });
    playing = true;
    button.textContent = text.pause;
    schedule();
  };
  const halt = () => {
    playing = false;
    cancel();
    button.textContent = text.resume;
  };
  button.addEventListener(
    'click',
    () => {
      if (playing) halt();
      else play();
    },
    { signal: abort.signal },
  );
  const yieldToUser = event => {
    if (playing && event.target !== button) halt();
  };
  for (const type of ['pointerdown', 'input', 'click'])
    root.addEventListener(type, yieldToUser, { capture: true, signal: abort.signal });
  const sync = () => {
    cancel();
    schedule();
  };
  document.addEventListener('visibilitychange', sync, { signal: abort.signal });
  media.addEventListener('change', sync, { signal: abort.signal });
  const observer = new IntersectionObserver(e => {
    visible = e.at(-1).isIntersecting;
    sync();
  });
  observer.observe(root);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    playing = false;
    cancel();
    abort.abort();
    observer.disconnect();
    button.remove();
    baseDispose();
  };
  Object.assign(cleanup, controller);
  cleanup.dispose = cleanup;
  cleanup.button = button;
  cleanup.setTime = t => {
    if (!Number.isFinite(t) || t < 0 || t > duration)
      throw new Error(`time must be 0..${duration}`);
    playing = false;
    cancel();
    controller.setState({ ...controller.getState(), [key]: t }, { immediate: true });
  };
  cleanup.pause = () => {
    playing = false;
    cancel();
    controller.pause?.();
  };
  cleanup.resume = play;
  cleanup.getStats = () => ({
    ...baseStats(),
    pending: Boolean(frame) || baseStats().pending,
    playing,
  });
  return cleanup;
}
