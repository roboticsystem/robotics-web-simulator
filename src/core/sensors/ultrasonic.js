import { rayRectIntersect, rotateLocal } from "./geometry.js";
import { clamp, gaussian, quantize } from "./noise.js";

function normalizeAngle(theta) {
  const twoPi = Math.PI * 2;
  let value = theta % twoPi;
  if (value < 0) {
    value += twoPi;
  }
  return value;
}

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
    resolution = 0.1
  } = sensor;

  const theta = normalizeAngle(robot.theta + mountAngle);
  const local = rotateLocal(mountX, mountY, normalizeAngle(robot.theta));
  const ox = robot.x + local.x;
  const oy = robot.y + local.y;

  const rays = Math.max(5, Math.min(25, Math.ceil(beamDeg / 6)));
  const halfBeam = ((beamDeg * Math.PI) / 180) / 2;
  let bestDistanceCm = Infinity;
  let hitReflectivity = 0.8;

  for (let index = 0; index < rays; index += 1) {
    const offset = -halfBeam + (2 * halfBeam * index) / Math.max(1, rays - 1);
    const dir = theta + offset;
    const dx = Math.cos(dir);
    const dy = Math.sin(dir);

    for (const obstacle of scene.obstacles) {
      const distance = rayRectIntersect(
        ox,
        oy,
        dx,
        dy,
        obstacle.x,
        obstacle.y,
        obstacle.width / 2,
        obstacle.height / 2
      );

      if (distance !== null && distance > 0.01) {
        const distanceCm = distance * 100;
        if (distanceCm < bestDistanceCm) {
          bestDistanceCm = distanceCm;
          hitReflectivity = obstacle.reflectivity ?? 0.85;
        }
      }
    }
  }

  if (bestDistanceCm === Infinity || bestDistanceCm > rangeCm) {
    const raw = rangeCm + 1 + gaussian(0, noise * rangeCm * 0.5);
    return {
      value: quantize(clamp(raw, rangeCm * 0.5, rangeCm * 1.5), resolution),
      unit: "cm",
      status: "out_of_range",
      theoretical: rangeCm,
      hit: false
    };
  }

  const reflectivity = clamp(hitReflectivity * reflectivityGain, 0, 1);
  const unstable = reflectivity < 0.25;

  if (unstable && rng() < 0.35) {
    return {
      value: quantize(rangeCm + gaussian(0, noise * rangeCm), resolution),
      unit: "cm",
      status: "invalid",
      theoretical: bestDistanceCm,
      hit: false
    };
  }

  let value = bestDistanceCm + gaussian(0, noise * bestDistanceCm) + sysError * bestDistanceCm;
  value = quantize(clamp(value, minRangeCm, rangeCm), resolution);

  return {
    value,
    unit: "cm",
    status: unstable ? "unstable" : "normal",
    theoretical: bestDistanceCm,
    hit: true
  };
}
