/** One scalar animation clock shared by example clients. No scheduling while settled,
 * hidden, offscreen, disabled or reduced. A user update permanently stops the tour.
 *
 * A retarget continues from the displayed value and velocity rather than restarting the
 * easing, so input arriving every frame still moves the figure. The eased segment is a
 * monotone cubic, so it never overshoots its target or leaves the range of its inputs.
 * A draw failure reverts to the last painted value: the readout never disagrees with the
 * artwork, and the next input can retry.
 * @param {{root:Element,motion:{enabled:boolean,idleTour:boolean,durationMs:number},initial:number,draw:(value:number)=>void,idleAt?:(elapsedMs:number)=>number,onError?:(error:Error,value:number)=>void}} options
 */
export function scalarMotion({ root, motion, initial, draw, idleAt, onError }) {
  let value = initial,
    painted = initial,
    target = initial,
    from = initial,
    velocity = 0,
    tangent = 0,
    span = motion.durationMs,
    segment = 0,
    frame = 0,
    visible = true,
    disposed = false,
    touring = Boolean(motion.idleTour && idleAt),
    elapsed = 0,
    last = null,
    paused = false;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const canEase = () => motion.enabled && !media.matches && motion.durationMs > 0;
  const active = () => visible && !document.hidden && !disposed && !paused;
  const stats = { frames: 0, pending: false, disposed: false, error: null };
  function paint() {
    try {
      draw(value);
      painted = value;
      stats.error = null;
      return true;
    } catch (error) {
      value = target = from = painted;
      velocity = tangent = 0;
      stats.error = error.message;
      console.error(error);
      root.dispatchEvent(new CustomEvent('crafted:error', { detail: { error, value } }));
      onError?.(error, value);
      return false;
    }
  }
  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    stats.pending = false;
  }
  function cancel() {
    stopFrame();
    last = null;
    segment = 0;
    from = value;
    velocity = tangent = 0;
  }
  function run() {
    if (!frame && active() && canEase() && (touring || value !== target)) {
      frame = requestAnimationFrame(tick);
      stats.pending = true;
    }
  }
  function ease(dt) {
    segment += dt;
    const t = Math.min(1, segment / span);
    if (t === 1) {
      value = target;
      velocity = 0;
      return;
    }
    const delta = target - from;
    value = from + delta * (t * t * (3 - 2 * t)) + tangent * (t * t * t - 2 * t * t + t);
    velocity = (delta * (6 * t - 6 * t * t) + tangent * (3 * t * t - 4 * t + 1)) / span;
  }
  function tick(now) {
    frame = 0;
    stats.pending = false;
    if (!active() || !canEase()) return;
    stats.frames++;
    if (touring) {
      elapsed += last === null ? 0 : Math.min(64, now - last);
      target = idleAt(elapsed);
      value = target;
    } else ease(last === null ? 1000 / 60 : now - last);
    last = now;
    if (!paint()) return;
    if (value === target && !touring) last = null;
    run();
  }
  /** @param {number} next
   * @param {boolean} [user] false keeps an idle tour running
   * @param {{durationMs?:number}} [options] shorter duration for continuous gestures */
  function set(next, user = true, { durationMs = motion.durationMs } = {}) {
    if (disposed) return;
    if (user) touring = false;
    stopFrame();
    if (!canEase() || !active()) {
      cancel();
      target = next;
      value = target;
      paint();
      return;
    }
    const delta = next - value;
    span = Math.max(1, Math.min(durationMs, motion.durationMs));
    // Fritsch-Carlson limit: an opposing or excessive tangent would overshoot.
    const carried = velocity * span;
    tangent =
      delta * carried > 0 ? Math.sign(delta) * Math.min(Math.abs(carried), 3 * Math.abs(delta)) : 0;
    from = value;
    target = next;
    segment = 0;
    run();
  }
  function sync() {
    cancel();
    if (!canEase()) {
      value = target;
      paint();
    } else run();
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries.at(-1).isIntersecting;
    sync();
  });
  observer.observe(root);
  document.addEventListener('visibilitychange', sync);
  media.addEventListener('change', sync);
  draw(value);
  run();
  return {
    set,
    stats,
    jump(next) {
      if (disposed) return;
      if (next === value && next === target && !touring) return;
      cancel();
      touring = false;
      target = value = next;
      paint();
    },
    pause() {
      paused = true;
      cancel();
    },
    resume() {
      paused = false;
      run();
    },
    get value() {
      return value;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stats.disposed = true;
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      media.removeEventListener('change', sync);
    },
  };
}
