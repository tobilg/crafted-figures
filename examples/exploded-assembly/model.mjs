/** Model time is deterministic. Commands intentionally reverse before all groups start. */
export const commands = [
  { time: 0.2, value: 1 },
  { time: 0.28, value: 0 },
  { time: 0.65, value: 1 },
  { time: 1.4, value: 0 },
  { time: 2.2, value: 1 },
  { time: 4, value: 0 },
];
let timeline;
function sequence(springTimeline) {
  if (!timeline) {
    timeline = springTimeline(
      { a: 0, b: 0, c: 0 },
      { stagger: 0.12, bounds: { a: [0, 1], b: [0, 1], c: [0, 1] } },
    );
    for (const e of commands) timeline.command(e.time, { a: e.value, b: e.value, c: e.value });
  }
  return timeline;
}
export function measure({ time }, springTimeline) {
  if (!Number.isFinite(time)) throw new Error('time must be finite');
  time = Math.min(7, Math.max(0, time));
  const sample = sequence(springTimeline).sample(time);
  const throttle = Math.sin(Math.PI * Math.min(1, time / 7)) ** 2;
  return {
    time,
    shares: sample.state,
    throttle,
    reading: `${time.toFixed(2)} s · upper clearance ${(sample.state.c * 40).toFixed(1)} mm`,
  };
}
export const poses = {
  rest: { time: 0 },
  reversal: { time: 0.72 },
  apart: { time: 3.7 },
  mid: { time: 3.5 },
  max: { time: 7 },
};
