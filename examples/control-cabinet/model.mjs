/** Three illustrative normally-open contacts close at 20, 30 and 40 °C. */
export function measure({ temperatureC }) {
  if (!Number.isFinite(temperatureC)) throw new Error('temperatureC must be finite');
  const value = Math.max(10, Math.min(50, temperatureC)),
    closed = [20, 30, 40].map(t => value >= t);
  return {
    temperatureC: value,
    closed,
    reading: `${value.toFixed(1)} °C · ${closed.filter(Boolean).length} / 3 contacts closed`,
  };
}
export const poses = {
  rest: { temperatureC: 10 },
  mid: { temperatureC: 30 },
  max: { temperatureC: 50 },
};
