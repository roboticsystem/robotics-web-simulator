import assert from 'assert';
import test from 'node:test';
import { sampleUltrasonic } from '../src/sensors/ultrasonic.js';
import { sampleInfrared } from '../src/sensors/infrared.js';
import { createImuState, sampleImu } from '../src/sensors/imu.js';

test('ultrasonic returns nearest obstacle distance', () => {
  const scene = {
    ambientLight: 0.3,
    obstacles: [{ x: 3, y: 1, width: 1, height: 1, reflectivity: 0.9 }],
  };
  const robot = { x: 1, y: 1, theta: 0 };
  const sensor = {
    mountX: 0,
    mountY: 0,
    mountAngle: 0,
    rangeCm: 400,
    minRangeCm: 2,
    beamDeg: 20,
    noise: 0,
    sysError: 0,
    reflectivityGain: 1,
    resolution: 0.1,
  };

  const result = sampleUltrasonic(scene, robot, sensor);
  assert.strictEqual(result.status, 'normal');
  assert.strictEqual(result.hit, true);
  assert.strictEqual(result.value, 150);
  assert.strictEqual(result.theoretical, 150);
});

test('infrared supports binary output with threshold', () => {
  const scene = {
    ambientLight: 0.2,
    obstacles: [{ x: 2, y: 0, width: 1, height: 1, reflectivity: 1 }],
  };
  const robot = { x: 0, y: 0, theta: 0 };
  const sensor = {
    mountX: 0,
    mountY: 0,
    mountAngle: 0,
    rangeCm: 300,
    noise: 0,
    sensitivity: 1,
    ambientFactor: 1,
    outputMode: 'binary',
    threshold: 0.2,
    reflectivityGain: 1,
    resolution: 0.01,
  };

  const result = sampleInfrared(scene, robot, sensor, () => 0);
  assert.strictEqual(result.hit, true);
  assert.strictEqual(result.unit, 'bool');
  assert.strictEqual(result.value, 1);
});

test('imu outputs deterministic values without noise and drift', () => {
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

  const result = sampleImu(robot, sensor, prev, 1, createImuState());
  assert.strictEqual(result.status, 'normal');
  assert.strictEqual(result.gyroZ, 0.5);
  assert.strictEqual(result.accelX, 0.88);
  assert.strictEqual(result.accelY, -0.48);
});
