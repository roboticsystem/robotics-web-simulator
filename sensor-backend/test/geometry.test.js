import assert from 'assert';
import test from 'node:test';
import { rayCircleIntersect, rayPolygonIntersect, rayRectIntersect } from '../src/geometry.js';

test('ray hits rectangle center', () => {
  const t = rayRectIntersect(0, 0, 1, 0, 5, 0, 1, 1);
  assert.ok(t !== null && t >= 4 && t <= 6);
});

test('ray misses behind', () => {
  const t = rayRectIntersect(0, 0, -1, 0, 5, 0, 1, 1);
  assert.strictEqual(t, null);
});

test('ray hits circle boundary', () => {
  const t = rayCircleIntersect(0, 0, 1, 0, 5, 0, 1);
  assert.strictEqual(t, 4);
});

test('ray hits polygon edge', () => {
  const t = rayPolygonIntersect(0, 0, 1, 0, [
    { x: 4, y: -1 },
    { x: 6, y: -1 },
    { x: 6, y: 1 },
    { x: 4, y: 1 },
  ]);
  assert.strictEqual(t, 4);
});
