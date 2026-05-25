import assert from 'assert';
import test from 'node:test';
import { sampleUltrasonic } from '../src/sensors/ultrasonic.js';
import { sampleInfrared } from '../src/sensors/infrared.js';
import { createImuState, sampleImu } from '../src/sensors/imu.js';

function withDeterministicRandom(values, fn) {
  const original = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test('ultrasonic average relative error stays under 10%', () => {
  const values = [0.12, 0.37, 0.58, 0.91, 0.22, 0.74, 0.43, 0.66];
  const scene = {
    ambientLight: 0.2,
    obstacles: [{ x: 3, y: 1, width: 1, height: 1, reflectivity: 0.9 }],
  };
  const robot = { x: 1, y: 1, theta: 0 };
  const sensor = {
    mountX: 0,
    mountY: 0,
    mountAngle: 0,
    rangeCm: 400,
    minRangeCm: 2,
    beamDeg: 25,
    noise: 0.02,
    sysError: 0.01,
    reflectivityGain: 1,
    resolution: 0.1,
  };

  const samples = withDeterministicRandom(values, () =>
    Array.from({ length: 80 }, () => sampleUltrasonic(scene, robot, sensor))
  );
  const errors = samples.map((sample) => Math.abs(sample.value - sample.theoretical) / sample.theoretical);
  assert.ok(average(errors) < 0.1);
});

test('infrared average relative error stays under 10%', () => {
  const values = [0.16, 0.41, 0.67, 0.88, 0.29, 0.54, 0.73, 0.95];
  const scene = {
    ambientLight: 0.15,
    obstacles: [{ x: 2, y: 0, width: 1, height: 1, reflectivity: 0.95 }],
  };
  const robot = { x: 0, y: 0, theta: 0 };
  const sensor = {
    mountX: 0,
    mountY: 0,
    mountAngle: 0,
    rangeCm: 300,
    noise: 0.02,
    sensitivity: 1,
    ambientFactor: 1,
    outputMode: 'analog',
    threshold: 0.3,
    reflectivityGain: 1,
    resolution: 0.01,
  };

  const samples = withDeterministicRandom(values, () =>
    Array.from({ length: 80 }, () => sampleInfrared(scene, robot, sensor, () => 0))
  );
  const errors = samples
    .filter((sample) => sample.theoretical > 0)
    .map((sample) => Math.abs(sample.value - sample.theoretical) / sample.theoretical);
  assert.ok(average(errors) < 0.1);
});

test('imu baseline error stays under 10% with zero noise configuration', () => {
  const prev = { x: 0, y: 0, theta: 0, vx: 0, vy: 0 };
  const robot = { x: 1, y: 0, theta: 0.5, vx: 0, vy: 0 };
  const sensor = {
    noiseGyro: 0,
    noiseAccel: 0,
    driftCoeff: 0,
    biasGyro: 0,
    biasAccelX: 0,
    biasAccelY: 0,
    resolutionGyro: 0.001,
    resolutionAccel: 0.01,
  };

  const sample = sampleImu(robot, sensor, prev, 1, createImuState());
  const gyroError = Math.abs(sample.gyroZ - sample.theoretical.omega) / Math.abs(sample.theoretical.omega);
  const accelXError = Math.abs(sample.accelX - 0.88) / 0.88;
  const accelYError = Math.abs(sample.accelY - -0.48) / 0.48;

  assert.ok(average([gyroError, accelXError, accelYError]) < 0.1);
});
