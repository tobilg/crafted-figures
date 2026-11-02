/** Illustrative lift-to-opening relationship; not a fluid-flow calibration. */
export function measure({ liftMm }) {
  if (!Number.isFinite(liftMm)) throw new Error('liftMm must be finite');
  const value = Math.max(0, Math.min(12, liftMm));
  return {
    liftMm: value,
    opening: value / 12,
    reading: `${value.toFixed(1)} mm lift · ${Math.round((value / 12) * 100)}% opening`,
  };
}
export const poses = { rest: { liftMm: 0 }, mid: { liftMm: 6 }, max: { liftMm: 12 } };
