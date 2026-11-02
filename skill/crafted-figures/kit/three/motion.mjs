/** Deterministic damped spring timeline. Retargets retain current position/velocity;
 * delayed commands replace pending targets rather than restarting an old tour.
 */
export function springTimeline(
  initial,
  { stiffness = 64, damping = 14.2, stagger = 0.035, step = 1 / 240, bounds = {} } = {},
) {
  const keys = Object.keys(initial);
  if (
    !keys.length ||
    Object.values(initial).some(v => !Number.isFinite(v)) ||
    ![stiffness, damping, step].every(v => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(stagger) ||
    stagger < 0
  )
    throw new Error('springTimeline: finite scalar state and positive spring settings required');
  const events = [];
  // Sampling is a pure function of time, so a sample replays from the latest state known to lie
  // on the path to it. Without this, cost grows with how long a timeline has been running.
  let checkpoints = [];
  function command(time, target) {
    if (
      !Number.isFinite(time) ||
      time < 0 ||
      keys.some(k => !Number.isFinite(target[k])) ||
      Object.keys(target).length !== keys.length
    )
      throw new Error('spring command: nonnegative time and complete finite target state required');
    events.push({ time, target: { ...target }, sequence: events.length });
    events.sort((a, b) => a.time - b.time || a.sequence - b.sequence);
    checkpoints = checkpoints.filter(c => c.now < time - 1e-12);
  }
  function latestCheckpoint(time) {
    let low = 0,
      high = checkpoints.length - 1,
      found = null;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (checkpoints[middle].now <= time) {
        found = checkpoints[middle];
        low = middle + 1;
      } else high = middle - 1;
    }
    return found;
  }
  function sample(time) {
    if (!Number.isFinite(time) || time < 0)
      throw new Error('spring sample: nonnegative time required');
    const resume = latestCheckpoint(time),
      x = { ...(resume?.x ?? initial) },
      velocity = resume ? { ...resume.velocity } : Object.fromEntries(keys.map(k => [k, 0])),
      target = { ...(resume?.target ?? initial) },
      pending = resume ? structuredClone(resume.pending) : {};
    let now = resume?.now ?? 0,
      index = resume?.index ?? 0;
    while (now < time - 1e-12) {
      if (now >= (checkpoints.at(-1)?.now ?? -1) + 1)
        checkpoints.push({
          now,
          index,
          x: { ...x },
          velocity: { ...velocity },
          target: { ...target },
          pending: structuredClone(pending),
        });
      while (index < events.length && events[index].time <= now + 1e-12) {
        const event = events[index++];
        keys.forEach((k, i) => {
          pending[k] = { time: event.time + i * stagger, value: event.target[k] };
        });
      }
      for (const k of keys)
        if (pending[k] && pending[k].time <= now + 1e-12) {
          target[k] = pending[k].value;
          delete pending[k];
        }
      let dt = Math.min(step, time - now);
      if (index < events.length && events[index].time > now)
        dt = Math.min(dt, events[index].time - now);
      for (const p of Object.values(pending)) if (p.time > now) dt = Math.min(dt, p.time - now);
      for (const k of keys) {
        const acceleration = stiffness * (target[k] - x[k]) - damping * velocity[k];
        velocity[k] += acceleration * dt;
        x[k] += velocity[k] * dt;
        if (bounds[k]) {
          const [min, max] = bounds[k];
          if (!Number.isFinite(min) || !Number.isFinite(max) || max < min)
            throw new Error(`spring bounds.${k}: increasing finite pair required`);
          if (x[k] < min || x[k] > max) {
            x[k] = Math.min(max, Math.max(min, x[k]));
            velocity[k] = 0;
          }
        }
      }
      now += dt;
    }
    return {
      state: x,
      velocity,
      time,
      settled:
        keys.every(k => Math.abs(target[k] - x[k]) < 1e-4 && Math.abs(velocity[k]) < 1e-4) &&
        Object.keys(pending).length === 0,
    };
  }
  return { command, sample, events };
}
/** Swap only the changing object; old GPU geometry/materials are disposed. */
export function replacePart(old, next) {
  if (old.name !== next.name) throw new Error('replacePart: preserve semantic identity');
  const parent = old.parent;
  if (!parent) throw new Error('replacePart: old object needs a parent');
  next.position.copy(old.position);
  next.quaternion.copy(old.quaternion);
  next.scale.copy(old.scale);
  parent.remove(old);
  parent.add(next);
  old.traverse(o => {
    o.geometry?.dispose();
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
  return next;
}
/** Native Three.attach preserves the world pose during detach/reattach. */
export function reparentKeepingWorld(object, parent) {
  object.updateWorldMatrix(true, true);
  parent.updateWorldMatrix(true, false);
  parent.attach(object);
  return object;
}
