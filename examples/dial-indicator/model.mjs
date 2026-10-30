/** Pure illustrative displacement model. Millimetres, 0..10; 30 degrees/mm.
 * Geometry uses 4 drawing units/mm. This is an explanatory mapping, not calibration.
 * @param {{displacementMm:number}} state
 */
export function measure(state) {
  if (!state || typeof state.displacementMm !== 'number' || !Number.isFinite(state.displacementMm))
    throw new Error('displacementMm must be a finite number');
  const displacementMm = Math.max(0, Math.min(10, state.displacementMm));
  return {
    displacementMm,
    lift: displacementMm * 4,
    angleDeg: displacementMm * 30,
    reading: `${displacementMm.toFixed(2)} mm`,
  };
}
export const poses = {
  rest: { displacementMm: 0 },
  mid: { displacementMm: 5 },
  max: { displacementMm: 10 },
};
