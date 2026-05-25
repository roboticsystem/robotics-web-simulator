// IMU 传感器模型
import { gaussian, clamp, quantize } from '../noise.js';

/**
 * 根据机器人运动估计陀螺仪（rad/s）和加速度（m/s²），包含漂移与噪声
 */
export function createImuState() {
  return {
    gyroBias: 0,
    accelBiasX: 0,
    accelBiasY: 0,
    driftAccum: 0,
  };
}

export function sampleImu(robot, sensor, prev, dtSec, imuState) {
  const {
    noiseGyro = 0.02,
    noiseAccel = 0.15,
    driftCoeff = 0.002,
    biasGyro = 0,
    biasAccelX = 0,
    biasAccelY = 0,
    resolutionGyro = 0.001,
    resolutionAccel = 0.01,
  } = sensor;

  const omega = prev ? (robot.theta - prev.theta) / dtSec : 0;
  const vx = prev ? (robot.x - prev.x) / dtSec : robot.vx ?? 0;
  const vy = prev ? (robot.y - prev.y) / dtSec : robot.vy ?? 0;
  const pvx = prev?.vx ?? vx;
  const pvy = prev?.vy ?? vy;
  const ax = (vx - pvx) / Math.max(dtSec, 1e-6);
  const ay = (vy - pvy) / Math.max(dtSec, 1e-6);

  imuState.driftAccum += driftCoeff * dtSec * gaussian(0, 1);
  imuState.gyroBias += gaussian(0, driftCoeff * 0.1) * dtSec;

  const gz = omega + biasGyro + imuState.gyroBias + gaussian(0, noiseGyro) + imuState.driftAccum * 0.1;
  const c = Math.cos(robot.theta);
  const s = Math.sin(robot.theta);
  const axBody = ax * c + ay * s;
  const ayBody = -ax * s + ay * c;

  const axOut = axBody + biasAccelX + imuState.accelBiasX + gaussian(0, noiseAccel);
  const ayOut = ayBody + biasAccelY + imuState.accelBiasY + gaussian(0, noiseAccel);

  const roll = robot.theta;
  const pitch = 0;

  return {
    gyroZ: quantize(gz, resolutionGyro),
    accelX: quantize(axOut, resolutionAccel),
    accelY: quantize(ayOut, resolutionAccel),
    roll: quantize(roll, 0.001),
    pitch: quantize(pitch, 0.001),
    unit: 'imu',
    status: 'normal',
    theoretical: { omega, ax, ay },
  };
}
