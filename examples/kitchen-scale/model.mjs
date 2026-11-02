/** A kitchen spring scale. The load compresses a spring, the pan sinks with it, and a rack on the
 * pan's column turns the needle, so pan travel and the reading come from one number. */
export const APPLE_GRAMS = 150;
export const FULL_SCALE_GRAMS = 600;
const PAN_TRAVEL = 8;
const NEEDLE_SWEEP_DEG = 300;

export function measure({ apples }) {
  if (!Number.isFinite(apples)) throw new Error('apples must be finite');
  const count = Math.max(0, Math.min(3, apples)),
    grams = count * APPLE_GRAMS,
    share = grams / FULL_SCALE_GRAMS;
  return {
    apples: count,
    grams,
    sink: share * PAN_TRAVEL,
    needleDeg: share * NEEDLE_SWEEP_DEG,
    onPan: Math.round(count),
    reading: `${Math.round(grams)} g`,
  };
}

export const poses = {
  rest: { apples: 2 },
  empty: { apples: 0 },
  full: { apples: 3 },
};
