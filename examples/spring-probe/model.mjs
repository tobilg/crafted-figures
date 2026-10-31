export function measure({ compression }) {
  if (!Number.isFinite(compression)) throw new Error('compression must be finite');
  compression = Math.max(0, Math.min(14, compression));
  return {
    compression,
    height: 30 - compression,
    forceN: compression * 2,
    reading: `${compression.toFixed(1)} mm compression · ${(compression * 2).toFixed(1)} N`,
  };
}
export const poses = {
  rest: { compression: 0 },
  mid: { compression: 7 },
  max: { compression: 14 },
};
