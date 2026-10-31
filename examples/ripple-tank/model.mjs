/** Two periodically excited sources; replayable finite emission history in model seconds. */
export function measure({ time }) {
  if (!Number.isFinite(time)) throw new Error('time must be finite');
  time = Math.max(0, Math.min(6, time));
  const phase = time * 4,
    amplitude = 0.6 + 0.4 * Math.sin((Math.PI * time) / 6) ** 2;
  const history = Array.from({ length: Math.floor(time * 2) + 1 }, (_, i) => ({
    x: i % 2 ? -0.34 : 0.18,
    y: i % 2 ? 0.2 : -0.12,
    age: time - i * 0.5,
    amplitude: 0.8,
  }))
    .filter(e => e.age < 3.5)
    .slice(-8);
  return {
    time,
    phase,
    amplitude,
    history,
    reading: `t = ${time.toFixed(2)} s · phase ${phase.toFixed(2)} rad`,
  };
}
export const poses = { rest: { time: 0 }, mid: { time: 3 }, max: { time: 6 } };
