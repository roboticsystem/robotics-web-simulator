/** 使用 Box-Muller 生成高斯噪声 */
export function gaussian(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function quantize(value, resolution) {
  if (resolution <= 0) return value;
  const step = resolution;
  return Math.round(value / step) * step;
}
