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

export function sampleInfrared(scene, robot, sensor, rng = Math.random) {
  const {
    mountX = 0,
    mountY = 0,
    mountAngle = 0,
    rangeCm = 80,
    noise = 0.05,
    sensitivity = 1,
    ambientFactor = 1,
    outputMode = "analog",
    threshold = 0.5,
    reflectivityGain = 1,
    resolution = 0.01
  } = sensor;

  const theta = normalizeAngle(robot.theta + mountAngle);
  const local = rotateLocal(mountX, mountY, normalizeAngle(robot.theta));
  const ox = robot.x + local.x;
  const oy = robot.y + local.y;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);

  let bestDistanceCm = Infinity;
  let hitReflectivity = 0.9;

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

    if (distance !== null && distance > 0.005) {
      const distanceCm = distance * 100;
      if (distanceCm < bestDistanceCm) {
        bestDistanceCm = distanceCm;
        hitReflectivity = obstacle.reflectivity ?? 0.85;
      }
    }
  }

  const ambient = scene.ambientLight ?? 0.4;
  const snrPenalty = 1 / (1 + ambient * ambientFactor * 2);

  if (bestDistanceCm === Infinity || bestDistanceCm > rangeCm) {
    const analog = quantize(clamp(0.05 * snrPenalty + gaussian(0, noise * 0.2), 0, 1), resolution);
    return {
      value: outputMode === "binary" ? (analog > threshold ? 1 : 0) : analog,
      unit: outputMode === "binary" ? "bool" : "norm",
      status: "no_target",
      theoretical: 0,
      hit: false
    };
  }

  const distanceRatio = bestDistanceCm / rangeCm;
  const falloff = 1 / (1 + 8 * distanceRatio * distanceRatio);
  const rawIntensity = hitReflectivity * reflectivityGain * sensitivity * falloff;
  const glare = ambient * (1 - hitReflectivity) * 0.4;
  let intensity = clamp(rawIntensity - glare + gaussian(0, noise * snrPenalty), 0, 1);
  intensity = quantize(intensity, resolution);

  const falsePositive = ambient > 0.75 && rng() < (ambient - 0.5) * 0.15 * (1 - snrPenalty);
  if (falsePositive) {
    intensity = clamp(intensity + 0.35, 0, 1);
  }

  return {
    value: outputMode === "binary" ? (intensity > threshold ? 1 : 0) : intensity,
    unit: outputMode === "binary" ? "bool" : "norm",
    status: "normal",
    theoretical: rawIntensity,
    hit: true
  };
}
