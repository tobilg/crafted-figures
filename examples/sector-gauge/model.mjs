export const poses = { rest: { percent: 50 }, min: { percent: 0 }, max: { percent: 100 } };
/** A bounded 240-degree scale; the pointer and readout use this same mapping. */
export function measure({ percent }) {
  if (!Number.isFinite(percent)) throw new Error('percent must be finite');
  percent = Math.max(0, Math.min(100, percent));
  return { percent, angleDeg: -120 + percent * 2.4, reading: `${percent.toFixed(0)}%` };
}
