const smooth = t => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
/** Analytic, reversible service clip. The released tool interpolates from the
 * exact end-effector transform at release to its landing pad, then remains seated. */
export function measure({ time }) {
  if (!Number.isFinite(time)) throw new Error('time must be finite');
  time = Math.max(0, Math.min(6, time));
  const move = smooth(time / 2),
    turn = (-move * Math.PI) / 6,
    bend = (move * Math.PI) / 3;
  const release = 3,
    travel = smooth((time - release) / 2),
    atRelease = { turn: -Math.PI / 6, bend: Math.PI / 3 };
  return {
    time,
    turn,
    bend,
    release,
    travel,
    atRelease,
    reading: `${time.toFixed(2)} s · ${time < release ? 'attached' : travel < 1 ? 'released' : 'seated'} tool`,
  };
}
export function releasedSpark(time, index, origin) {
  const birth = 1.4 + index * 0.18,
    age = time - birth,
    life = 1.2;
  if (age < 0 || age > life) return null;
  return {
    position: [
      origin[0] + age * (8 + index),
      origin[1] + age * (index - 2) * 3,
      origin[2] + age * 18 - age * age * 14,
    ],
    intensity: (1 - age / life) ** 2,
  };
}
export const poses = {
  rest: { time: 0 },
  mid: { time: 2 },
  release: { time: 3 },
  max: { time: 6 },
};
