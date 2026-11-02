export function measure({ temperatureC, text, time }) {
  if (
    !Number.isFinite(temperatureC) ||
    !Number.isFinite(time) ||
    typeof text !== 'string' ||
    text.length > 64
  )
    throw new Error('temperatureC/time must be finite and text at most 64 characters');
  temperatureC = Math.max(10, Math.min(50, temperatureC));
  time = Math.max(0, Math.min(2, time));
  const thresholds = [20, 30, 40],
    closed = thresholds.map((t, i) => temperatureC >= t && time >= (i + 1) * 0.3);
  return {
    temperatureC,
    text,
    time,
    closed,
    reading: `${temperatureC.toFixed(1)} °C · ${closed.filter(Boolean).length} / 3 relays`,
  };
}
export const poses = {
  rest: { temperatureC: 10, text: 'READY', time: 0 },
  mid: { temperatureC: 30, text: 'CHECK', time: 1 },
  max: { temperatureC: 50, text: 'RUN', time: 2 },
};
