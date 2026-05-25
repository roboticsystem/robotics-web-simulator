// 参数校验（基础版）
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
    range: { type: 'number', min: 1, max: 1000, alias: 'rangeCm' },
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
    if (typeof value !== 'string') return invalid(`${key} 必须是字符串`);
    const text = value.trim();
    if (text.length < rule.min || text.length > rule.max) {
      return invalid(`${key} 长度必须在 ${rule.min}-${rule.max} 之间`);
    }
    return { ok: true };
  }

  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') return invalid(`${key} 必须是布尔值`);
    return { ok: true };
  }

  if (rule.type === 'enum') {
    if (!rule.values.has(value)) return invalid(`${key} 取值无效`);
    return { ok: true };
  }

  if (!isFiniteNumber(value)) return invalid(`${key} 必须是有限数字`);
  if (value < rule.min || value > rule.max) {
    return invalid(`${key} 超出允许范围 ${rule.min}-${rule.max}`);
  }
  return { ok: true };
}

function validateAgainstRules(payload, rules) {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const rule = rules[key];
    if (!rule) return invalid(`不支持的字段: ${key}`);
    const result = validateByRule(key, value, rule);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function validateVertices(vertices) {
  if (!Array.isArray(vertices)) return invalid('vertices 必须是数组');
  if (vertices.length < 3 || vertices.length > 64) return invalid('vertices 数量必须在 3-64 之间');
  for (const vertex of vertices) {
    if (!vertex || typeof vertex !== 'object') return invalid('vertex 无效');
    const result = validateAgainstRules(vertex, {
      x: { type: 'number', min: -100, max: 100 },
      y: { type: 'number', min: -100, max: 100 },
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function validateSensorPayload(payload, sensorType) {
  if (!payload || typeof payload !== 'object') return invalid('payload 无效', 4004);
  if (payload.sensorId !== undefined && typeof payload.sensorId !== 'string') {
    return invalid('sensorId 非法');
  }
  if (!sensorType || !SENSOR_TYPES.has(sensorType)) return invalid('sensorType 无效');

  const allowed = {
    ...SENSOR_RULES.common,
    ...SENSOR_RULES[sensorType],
  };
  const normalized = { ...payload };
  delete normalized.sensorId;
  delete normalized.sensorType;
  return validateAgainstRules(normalized, allowed);
}

export function validateSensorAdd(body) {
  if (!body || typeof body !== 'object') return invalid('payload 无效', 4004);
  if (!body.sensorType || !SENSOR_TYPES.has(body.sensorType)) return invalid('sensorType 无效');
  if (body.sensorId !== undefined && typeof body.sensorId !== 'string') return invalid('sensorId 非法');
  return validateSensorPayload(body, body.sensorType);
}

function validateRobotPatch(robot) {
  if (!robot || typeof robot !== 'object') return invalid('robot 无效', 4004);
  const rules = {
    x: { type: 'number', min: -100, max: 100 },
    y: { type: 'number', min: -100, max: 100 },
    theta: { type: 'number', min: -Infinity, max: Infinity },
    vx: { type: 'number', min: -50, max: 50 },
    vy: { type: 'number', min: -50, max: 50 },
  };
  return validateAgainstRules(robot, rules);
}

export function validateSceneUpdate(scene) {
  if (!scene || typeof scene !== 'object') return invalid('payload 无效', 4004);
  if (scene.sceneId !== undefined && typeof scene.sceneId !== 'string') return invalid('sceneId 非法');
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
    if (!Array.isArray(scene.obstacles)) return invalid('obstacles 必须是数组');
    for (const obstacle of scene.obstacles) {
      const result = validateObstaclePayload(obstacle);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

export function validateObstaclePayload(payload, options = {}) {
  const { partial = false } = options;
  if (!payload || typeof payload !== 'object') return invalid('payload 无效', 4004);
  if (!partial && payload.id !== undefined && typeof payload.id !== 'string') return invalid('id 非法');
  if (partial && payload.id !== undefined && typeof payload.id !== 'string') return invalid('id 非法');

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
      if (payload[key] === undefined) return invalid(`缺少字段: ${key}`, 4004);
    }
  }
  return { ok: true };
}

export function validateSpeedPayload(payload) {
  if (!payload || typeof payload !== 'object') return invalid('payload 无效', 4004);
  return validateByRule('speed', payload.speed ?? 1, { type: 'number', min: 0.1, max: 5 });
}

export function validatePresetPayload(payload) {
  if (!payload || typeof payload !== 'object') return invalid('payload 鏃犳晥', 4004);
  if (payload.name !== undefined && typeof payload.name !== 'string') return invalid('name 闈炴硶');
  if (payload.scene !== undefined) {
    const result = validateSceneUpdate(payload.scene);
    if (!result.ok) return result;
  }
  if (payload.sensors !== undefined) {
    if (!Array.isArray(payload.sensors)) return invalid('sensors 蹇呴』鏄暟缁?);
    for (const sensor of payload.sensors) {
      const result = validateSensorAdd(sensor);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

export { SENSOR_TYPES };
