/** Pure inspection-view adjustment; the coupling and supports remain rigid. */
export function measure({turnDeg}) {
  if (!Number.isFinite(turnDeg)) throw new Error('turnDeg must be finite');
  const angle = Math.max(0, Math.min(8, turnDeg));
  return {turnDeg: angle, radians: angle * Math.PI / 180,
    reading: `${angle.toFixed(0)}° inspection turn · Ø6 mm matching terminals`};
}
export const poses = {rest: {turnDeg: 0}, inspection: {turnDeg: 8}};
