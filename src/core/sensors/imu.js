import { gaussian, quantize } from "./noise.js";

export function createImuState() {
  return {
    gyroBias: 0,
    accelBiasX: 0,
    accelBiasY: 0,
    driftAccum: 0
  };
}

export function sampleImu(robot, sensor, previousRobot, dtSec, imuState) {
  const {
    noiseGyro = 0.02,
    noiseAccel = 0.15,
    driftCoeff = 0.002,
    biasGyro = 0,
    biasAccelX = 0,
    biasAccelY = 0,
    resolutionGyro = 0.001,
    resolutionAccel = 0.01
  } = sensor;

  const safeDt = Math.max(dtSec, 1e-6);
  const omega = previousRobot ? (robot.theta - previousRobot.theta) / safeDt : 0;
  const vx = previousRobot ? (robot.x - previousRobot.x) / safeDt : robot.vx ?? 0;
  const vy = previousRobot ? (robot.y - previousRobot.y) / safeDt : robot.vy ?? 0;
  const previousVx = previousRobot?.vx ?? vx;
  const previousVy = previousRobot?.vy ?? vy;
  const ax = (vx - previousVx) / safeDt;
  const ay = (vy - previousVy) / safeDt;

  imuState.driftAccum += driftCoeff * safeDt * gaussian(0, 1);
  imuState.gyroBias += gaussian(0, driftCoeff * 0.1) * safeDt;

  const gyroZ =
    omega + biasGyro + imuState.gyroBias + gaussian(0, noiseGyro) + imuState.driftAccum * 0.1;
  const c = Math.cos(robot.theta);
  const s = Math.sin(robot.theta);
  const accelXBody = ax * c + ay * s;
  const accelYBody = -ax * s + ay * c;
  const accelX = accelXBody + biasAccelX + imuState.accelBiasX + gaussian(0, noiseAccel);
  const accelY = accelYBody + biasAccelY + imuState.accelBiasY + gaussian(0, noiseAccel);

  return {
    gyroZ: quantize(gyroZ, resolutionGyro),
    accelX: quantize(accelX, resolutionAccel),
    accelY: quantize(accelY, resolutionAccel),
    roll: quantize(robot.theta, 0.001),
    pitch: 0,
    unit: "imu",
    status: "normal",
    theoretical: {
      omega,
      ax,
      ay
    }
  };
}
