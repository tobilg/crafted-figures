/** Authored rigid turn, in degrees; construction dimensions remain invariant. */
export function measure({ turnDeg }) {
  if (!Number.isFinite(turnDeg)) throw new Error('turnDeg must be finite');
  turnDeg = Math.max(0, Math.min(16, turnDeg));
  return {
    turnDeg,
    radians: (turnDeg * Math.PI) / 180,
    reading: `${turnDeg.toFixed(0)}° assembly turn`,
  };
}
export const poses = { rest: { turnDeg: 0 }, mid: { turnDeg: 8 }, max: { turnDeg: 16 } };
