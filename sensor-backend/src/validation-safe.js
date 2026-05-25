// 参数校验（更严格版，服务端兜底）
const SENSOR_TYPES = new Set(['ultrasonic', 'infrared', 'imu']);
const OUTPUT_MODES = new Set(['analog', 'binary']);
const OBSTACLE_TYPES = new Set(['rect', 'circle', 'polygon']);

const SENSOR_RULES = {
  common: {
    name: { type: 'string', min: 1, max: 40 },
    enabled: { type: 'boolean' },
    mountX: { type: 'number', min: -5, max: 5 },
    mountY: { type: 'number', min: -5, max: 5 },
    mountAngle: { type: 'number', min: -Math.PI * 2, max: Math.PI * 2 },
    frequency: { type: 'number', min: 0.5, max: 100 },
  },
  ultrasonic: {
    range: { type: 'number', min: 1, max: 1000 },
    rangeCm: { type: 'number', min: 1, max: 1000 },
    minRangeCm: { type: 'number', min: 0, max: 200 },
    beamDeg: { type: 'number', min: 1, max: 180 },
    noise: { type: 'number', min: 0, max: 1 },
    sysError: { type: 'number', min: -1, max: 1 },
    reflectivityGain: { type: 'number', min: 0, max: 2 },
    resolution: { type: 'number', min: 0, max: 10 },
  },
  infrared: {
    rangeCm: { type: 'number', min: 1, max: 1000 },
    noise: { type: 'number', min: 0, max: 1 },
    sensitivity: { type: 'number', min: 0, max: 5 },
    ambientFactor: { type: 'number', min: 0, max: 5 },
    outputMode: { type: 'enum', values: OUTPUT_MODES },
    threshold: { type: 'number', min: 0, max: 1 },
    reflectivityGain: { type: 'number', min: 0, max: 2 },
    resolution: { type: 'number', min: 0, max: 1 },
  },
  imu: {
    noiseGyro: { type: 'number', min: 0, max: 10 },
    noiseAccel: { type: 'number', min: 0, max: 20 },
    driftCoeff: { type: 'number', min: 0, max: 1 },
    biasGyro: { type: 'number', min: -10, max: 10 },
    biasAccelX: { type: 'number', min: -20, max: 20 },
    biasAccelY: { type: 'number', min: -20, max: 20 },
    resolutionGyro: { type: 'number', min: 0, max: 1 },
    resolutionAccel: { type: 'number', min: 0, max: 5 },
  },
};

function invalid(message, code = 4001) {
  return { ok: false, code, message };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateByRule(key, value, rule) {
  if (rule.type === 'string') {
    if (typeof value !== 'string') return invalid(`${key} must be a string`);
    const text = value.trim();
    if (text.length < rule.min || text.length > rule.max) {
      return invalid(`${key} length must be between ${rule.min} and ${rule.max}`);
    }
    return { ok: true };
  }

  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') return invalid(`${key} must be a boolean`);
    return { ok: true };
  }

  if (rule.type === 'enum') {
    if (!rule.values.has(value)) return invalid(`${key} has an invalid value`);
    return { ok: true };
  }

  if (!isFiniteNumber(value)) return invalid(`${key} must be a finite number`);
  if (value < rule.min || value > rule.max) {
    return invalid(`${key} is out of range ${rule.min}-${rule.max}`);
  }
  return { ok: true };
}

function validateAgainstRules(payload, rules) {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const rule = rules[key];
    if (!rule) return invalid(`Unsupported field: ${key}`);
    const result = validateByRule(key, value, rule);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function validateVertices(vertices) {
  if (!Array.isArray(vertices)) return invalid('vertices must be an array');
  if (vertices.length < 3 || vertices.length > 64) return invalid('vertices length must be between 3 and 64');
  for (const vertex of vertices) {
    if (!vertex || typeof vertex !== 'object') return invalid('vertex is invalid');
    const result = validateAgainstRules(vertex, {
      x: { type: 'number', min: -100, max: 100 },
      y: { type: 'number', min: -100, max: 100 },
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

function validateRobotPatch(robot) {
  if (!robot || typeof robot !== 'object') return invalid('robot is invalid', 4004);
  const rules = {
    x: { type: 'number', min: -100, max: 100 },
    y: { type: 'number', min: -100, max: 100 },
    theta: { type: 'number', min: -Infinity, max: Infinity },
    vx: { type: 'number', min: -50, max: 50 },
    vy: { type: 'number', min: -50, max: 50 },
  };
  return validateAgainstRules(robot, rules);
}

export function validateSensorPayload(payload, sensorType) {
  if (!payload || typeof payload !== 'object') return invalid('payload is invalid', 4004);
  if (payload.sensorId !== undefined && typeof payload.sensorId !== 'string') return invalid('sensorId is invalid');
  if (!sensorType || !SENSOR_TYPES.has(sensorType)) return invalid('sensorType is invalid');

  const allowed = {
    ...SENSOR_RULES.common,
    ...SENSOR_RULES[sensorType],
  };
  const normalized = { ...payload };
  delete normalized.sensorId;
  delete normalized.sensorType;
  return validateAgainstRules(normalized, allowed);
}

export function validateSensorAdd(payload) {
  if (!payload || typeof payload !== 'object') return invalid('payload is invalid', 4004);
  if (!payload.sensorType || !SENSOR_TYPES.has(payload.sensorType)) return invalid('sensorType is invalid');
  if (payload.sensorId !== undefined && typeof payload.sensorId !== 'string') return invalid('sensorId is invalid');
  return validateSensorPayload(payload, payload.sensorType);
}

export function validateSceneUpdate(scene) {
  if (!scene || typeof scene !== 'object') return invalid('payload is invalid', 4004);
  if (scene.sceneId !== undefined && typeof scene.sceneId !== 'string') return invalid('sceneId is invalid');
  if (scene.ambientLight !== undefined) {
    const result = validateByRule('ambientLight', scene.ambientLight, { type: 'number', min: 0, max: 1 });
    if (!result.ok) return result;
  }
  if (scene.scale !== undefined) {
    const result = validateByRule('scale', scene.scale, { type: 'number', min: 0.1, max: 10 });
    if (!result.ok) return result;
  }
  if (scene.robot !== undefined) {
    const result = validateRobotPatch(scene.robot);
    if (!result.ok) return result;
  }
  if (scene.obstacles !== undefined) {
    if (!Array.isArray(scene.obstacles)) return invalid('obstacles must be an array');
    for (const obstacle of scene.obstacles) {
      const result = validateObstaclePayload(obstacle);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

export function validateObstaclePayload(payload, options = {}) {
  const { partial = false } = options;
  if (!payload || typeof payload !== 'object') return invalid('payload is invalid', 4004);
  if (payload.id !== undefined && typeof payload.id !== 'string') return invalid('id is invalid');

  const allowed = {
    id: { type: 'string', min: 1, max: 60 },
    type: { type: 'enum', values: OBSTACLE_TYPES },
    x: { type: 'number', min: -100, max: 100 },
    y: { type: 'number', min: -100, max: 100 },
    width: { type: 'number', min: 0.01, max: 50 },
    height: { type: 'number', min: 0.01, max: 50 },
    radius: { type: 'number', min: 0.01, max: 25 },
    material: { type: 'string', min: 1, max: 30 },
    reflectivity: { type: 'number', min: 0, max: 1 },
  };

  const normalized = { ...payload };
  const vertices = normalized.vertices;
  delete normalized.vertices;

  const result = validateAgainstRules(normalized, allowed);
  if (!result.ok) return result;

  if (vertices !== undefined) {
    const verticesResult = validateVertices(vertices);
    if (!verticesResult.ok) return verticesResult;
  }

  if (!partial) {
    for (const key of ['x', 'y', 'width', 'height']) {
      if (payload[key] === undefined) return invalid(`Missing field: ${key}`, 4004);
    }
  }
  return { ok: true };
}

export function validateSpeedPayload(payload) {
  if (!payload || typeof payload !== 'object') return invalid('payload is invalid', 4004);
  return validateByRule('speed', payload.speed ?? 1, { type: 'number', min: 0.1, max: 5 });
}

export function validatePresetPayload(payload) {
  if (!payload || typeof payload !== 'object') return invalid('payload is invalid', 4004);
  if (payload.name !== undefined && typeof payload.name !== 'string') return invalid('name is invalid');
  if (payload.scene !== undefined) {
    const result = validateSceneUpdate(payload.scene);
    if (!result.ok) return result;
  }
  if (payload.sensors !== undefined) {
    if (!Array.isArray(payload.sensors)) return invalid('sensors must be an array');
    for (const sensor of payload.sensors) {
      const result = validateSensorAdd(sensor);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

export { SENSOR_TYPES };
