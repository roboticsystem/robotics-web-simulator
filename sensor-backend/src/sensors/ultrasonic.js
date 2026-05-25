// 超声波传感器模型
import { rayObstacleIntersect, rotateLocal } from '../geometry.js';

function normalizeAngle(theta) {
  const twoPi = Math.PI * 2;
  let t = theta % twoPi;
  if (t < 0) t += twoPi;
  return t;
}
import { gaussian, clamp, quantize } from '../noise.js';

/**
 * 超声波：扇形多射线取最近距离（cm），反射率会影响有效性
 */
export function sampleUltrasonic(scene, robot, sensor, rng = Math.random) {
  const {
    mountX = 0,
    mountY = 0,
    mountAngle = 0,
    rangeCm = 400,
    minRangeCm = 2,
    beamDeg = 60,
    noise = 0.02,
    sysError = 0,
    reflectivityGain = 1,
    resolution = 0.1,
  } = sensor;

  const theta = normalizeAngle(robot.theta + mountAngle);
  const local = rotateLocal(mountX, mountY, normalizeAngle(robot.theta));
  const ox = robot.x + local.x;
  const oy = robot.y + local.y;

  const rays = Math.max(5, Math.min(25, Math.ceil(beamDeg / 6)));
  const halfBeam = ((beamDeg * Math.PI) / 180) / 2;
  let bestT = Infinity;
  let hitReflectivity = 0.8;

  for (let i = 0; i < rays; i++) {
    const a = -halfBeam + (2 * halfBeam * i) / Math.max(1, rays - 1);
    const dir = theta + a;
    const dx = Math.cos(dir);
    const dy = Math.sin(dir);

    for (const ob of scene.obstacles) {
      const t = rayObstacleIntersect(ox, oy, dx, dy, ob);
      if (t !== null && t > 0.01) {
        const distCm = t * 100;
        if (distCm < bestT) {
          bestT = distCm;
          hitReflectivity = ob.reflectivity ?? 0.85;
        }
      }
    }
  }

  if (bestT === Infinity || bestT > rangeCm) {
    const noiseVal = gaussian(0, noise * rangeCm * 0.5);
    const raw = rangeCm + 1;
    return {
      value: quantize(clamp(raw + noiseVal, rangeCm * 0.5, rangeCm * 1.5), resolution),
      unit: 'cm',
      status: 'out_of_range',
      theoretical: rangeCm,
      hit: false,
    };
  }

  const effectiveReflect = clamp(hitReflectivity * reflectivityGain, 0, 1);
  const unstable = effectiveReflect < 0.25;
  if (unstable && rng() < 0.35) {
    return {
      value: quantize(rangeCm + gaussian(0, noise * rangeCm), resolution),
      unit: 'cm',
      status: 'invalid',
      theoretical: bestT,
      hit: false,
    };
  }

  const n = gaussian(0, noise * bestT);
  const sys = sysError * bestT;
  let v = bestT + n + sys;
  v = clamp(v, minRangeCm, rangeCm);
  v = quantize(v, resolution);

  return {
    value: v,
    unit: 'cm',
    status: unstable ? 'unstable' : 'normal',
    theoretical: bestT,
    hit: true,
  };
}
