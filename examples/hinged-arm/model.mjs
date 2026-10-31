/** Planar two-link arm: fixed 84 mm first link, rotating 54 mm tool offset. */
export function measure({ bendDeg }) {
  if (!Number.isFinite(bendDeg)) throw new Error('bendDeg must be finite');
  const value = Math.max(0, Math.min(90, bendDeg)),
    radians = (value * Math.PI) / 180,
    reachX = 84 + 54 * Math.cos(radians),
    reachY = 54 * Math.sin(radians);
  return {
    bendDeg: value,
    radians,
    reachX,
    reachY,
    reading: `${value.toFixed(1)}° bend · X reach ${reachX.toFixed(1)} mm`,
  };
}
export const poses = { rest: { bendDeg: 0 }, mid: { bendDeg: 45 }, max: { bendDeg: 90 } };
