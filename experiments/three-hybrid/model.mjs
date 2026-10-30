/** Pure prototype state: angle in degrees, one full rotation, no physical calibration. */
export function rotorState({ angleDeg }) {
  if (typeof angleDeg !== 'number' || !Number.isFinite(angleDeg))
    throw new Error('angleDeg must be finite');
  const angle = Math.max(0, Math.min(360, angleDeg));
  return { angleDeg: angle, radians: (angle * Math.PI) / 180, reading: `${angle.toFixed(1)}°` };
}
export const poses = {
  rest: { angleDeg: 243 },
  hidden: { angleDeg: 243 },
  partial: { angleDeg: 234 },
  foreground: { angleDeg: 27 },
};
