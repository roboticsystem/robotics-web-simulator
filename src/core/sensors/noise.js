export function gaussian(mean = 0, std = 1) {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function quantize(value, resolution) {
  if (!resolution || resolution <= 0) {
    return value;
  }

  return Math.round(value / resolution) * resolution;
}
