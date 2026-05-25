import assert from 'assert';
import test from 'node:test';
import {
  validateObstaclePayload,
  validatePresetPayload,
  validateSceneUpdate,
  validateSensorAdd,
  validateSensorPayload,
  validateSpeedPayload,
} from '../src/validation.js';

test('sensor update validation rejects unsupported field', () => {
  const result = validateSensorPayload({ sensorId: 'u1', foo: 1 }, 'ultrasonic');
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /(Unsupported field|涓嶆敮鎸佺殑瀛楁)/);
});

test('sensor add validation rejects invalid infrared mode', () => {
  const result = validateSensorAdd({ sensorType: 'infrared', outputMode: 'pulse' });
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /outputMode/);
});

test('scene update validation rejects ambient light overflow', () => {
  const result = validateSceneUpdate({ ambientLight: 2 });
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /ambientLight/);
});

test('obstacle validation requires positive size', () => {
  const result = validateObstaclePayload({ x: 1, y: 1, width: 0, height: 1 });
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /width/);
});

test('speed validation accepts range within 0.1 to 5', () => {
  assert.strictEqual(validateSpeedPayload({ speed: 1.5 }).ok, true);
  assert.strictEqual(validateSpeedPayload({ speed: 9 }).ok, false);
});

test('preset validation accepts scene and sensor bundle', () => {
  const result = validatePresetPayload({
    name: 'demo bundle',
    scene: {
      sceneId: 'scene_bundle',
      ambientLight: 0.4,
      robot: { x: 1, y: 2, theta: 0 },
      obstacles: [{ id: 'ob_a', x: 3, y: 3, width: 1, height: 1, reflectivity: 0.8 }],
    },
    sensors: [
      { sensorType: 'ultrasonic', sensorId: 'u_01', name: 'U1' },
      { sensorType: 'imu', sensorId: 'imu_01', name: 'IMU Main' },
    ],
  });
  assert.strictEqual(result.ok, true);
});
