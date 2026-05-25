// 红外传感器模型
import { rayObstacleIntersect, rotateLocal } from '../geometry.js';
import { gaussian, clamp, quantize } from '../noise.js';

function normalizeAngle(theta) {
  const twoPi = Math.PI * 2;
  let t = theta % twoPi;
  if (t < 0) t += twoPi;
  return t;
}

/**
 * 红外：单束前向探测，输出模拟量或二值；环境光会降低信噪比
 */
export function sampleInfrared(scene, robot, sensor, rng = Math.random) {
  const {
    mountX = 0,
    mountY = 0,
    mountAngle = 0,
    rangeCm = 80,
    noise = 0.05,
    sensitivity = 1,
    ambientFactor = 1,
    outputMode = 'analog',
    threshold = 0.5,
    reflectivityGain = 1,
    resolution = 0.01,
  } = sensor;

  const theta = normalizeAngle(robot.theta + mountAngle);
  const local = rotateLocal(mountX, mountY, normalizeAngle(robot.theta));
  const ox = robot.x + local.x;
  const oy = robot.y + local.y;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);

  let bestT = Infinity;
  let hitReflectivity = 0.9;

  for (const ob of scene.obstacles) {
    const t = rayObstacleIntersect(ox, oy, dx, dy, ob);
    if (t !== null && t > 0.005) {
      const cm = t * 100;
      if (cm < bestT) {
        bestT = cm;
        hitReflectivity = ob.reflectivity ?? 0.85;
      }
    }
  }

  const ambient = scene.ambientLight ?? 0.4;
  const snrPenalty = 1 / (1 + ambient * ambientFactor * 2);

  if (bestT === Infinity || bestT > rangeCm) {
    const base = 0.05 * snrPenalty;
    const v = clamp(base + gaussian(0, noise * 0.2), 0, 1);
    const analog = quantize(v, resolution);
    return {
      value: outputMode === 'binary' ? (analog > threshold ? 1 : 0) : analog,
      unit: outputMode === 'binary' ? 'bool' : 'norm',
      status: 'no_target',
      theoretical: 0,
      hit: false,
    };
  }

  const distNorm = bestT / rangeCm;
  // 更敏感的衰减：近距离变化更明显，远距离快速衰减
  const falloff = 1 / (1 + 8 * distNorm * distNorm);
  const rawIntensity = hitReflectivity * reflectivityGain * sensitivity * falloff;
  const glare = ambient * (1 - hitReflectivity) * 0.4;
  let intensity = clamp(rawIntensity - glare + gaussian(0, noise * snrPenalty), 0, 1);
  intensity = quantize(intensity, resolution);

  const falsePositive = ambient > 0.75 && rng() < (ambient - 0.5) * 0.15 * (1 - snrPenalty);
  if (falsePositive) intensity = clamp(intensity + 0.35, 0, 1);

  const binary = intensity > threshold ? 1 : 0;

  return {
    value: outputMode === 'binary' ? binary : intensity,
    unit: outputMode === 'binary' ? 'bool' : 'norm',
    status: 'normal',
    theoretical: rawIntensity,
    hit: true,
  };
}
