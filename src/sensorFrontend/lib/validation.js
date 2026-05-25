const SENSOR_RULES = {
  ultrasonic: {
    name: { min: 1, max: 40, type: 'string' },
    enabled: { type: 'boolean' },
    mountAngle: { min: -Math.PI * 2, max: Math.PI * 2, type: 'number' },
    rangeCm: { min: 1, max: 1000, type: 'number' },
    beamDeg: { min: 1, max: 180, type: 'number' },
    frequency: { min: 0.5, max: 100, type: 'number' },
    noise: { min: 0, max: 1, type: 'number' },
    sysError: { min: -1, max: 1, type: 'number' },
  },
  infrared: {
    name: { min: 1, max: 40, type: 'string' },
    enabled: { type: 'boolean' },
    rangeCm: { min: 1, max: 1000, type: 'number' },
    frequency: { min: 0.5, max: 100, type: 'number' },
    noise: { min: 0, max: 1, type: 'number' },
    sensitivity: { min: 0, max: 5, type: 'number' },
    outputMode: { type: 'enum', values: new Set(['analog', 'binary']) },
    threshold: { min: 0, max: 1, type: 'number' },
  },
  imu: {
    name: { min: 1, max: 40, type: 'string' },
    enabled: { type: 'boolean' },
    frequency: { min: 0.5, max: 100, type: 'number' },
    noiseGyro: { min: 0, max: 10, type: 'number' },
    noiseAccel: { min: 0, max: 20, type: 'number' },
    driftCoeff: { min: 0, max: 1, type: 'number' },
  },
};

function ok() {
  return { ok: true };
}

function invalid(message) {
  return { ok: false, message };
}

function validateValue(label, value, rule) {
  if (rule.type === 'string') {
    if (typeof value !== 'string') return invalid(`${label} 必须是字符串`);
    const text = value.trim();
    if (text.length < rule.min || text.length > rule.max) {
      return invalid(`${label} 长度必须在 ${rule.min}-${rule.max} 之间`);
    }
    return ok();
  }

  if (rule.type === 'boolean') {
    return typeof value === 'boolean' ? ok() : invalid(`${label} 必须是布尔值`);
  }

  if (rule.type === 'enum') {
    return rule.values.has(value) ? ok() : invalid(`${label} 取值无效`);
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid(`${label} 必须是有限数字`);
  if (value < rule.min || value > rule.max) return invalid(`${label} 超出允许范围 ${rule.min}-${rule.max}`);
  return ok();
}

export function validateSensorPatch(sensor, patch) {
  if (!sensor || !SENSOR_RULES[sensor.sensorType]) return invalid('未知传感器类型');
  const rules = SENSOR_RULES[sensor.sensorType];

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'sensorId') continue;
    const rule = rules[key];
    if (!rule) return invalid(`不支持的参数: ${key}`);
    const result = validateValue(key, value, rule);
    if (!result.ok) return result;
  }
  return ok();
}

export function validateObstaclePatch(patch) {
  const rules = {
    id: { min: 1, max: 60, type: 'string' },
    x: { min: -100, max: 100, type: 'number' },
    y: { min: -100, max: 100, type: 'number' },
    width: { min: 0.2, max: 50, type: 'number' },
    height: { min: 0.2, max: 50, type: 'number' },
    reflectivity: { min: 0, max: 1, type: 'number' },
  };
  for (const [key, value] of Object.entries(patch)) {
    const rule = rules[key];
    if (!rule) return invalid(`不支持的障碍物参数: ${key}`);
    const result = validateValue(key, value, rule);
    if (!result.ok) return result;
  }
  return ok();
}

export function validateScenePatch(patch) {
  if (patch.ambientLight !== undefined) {
    const result = validateValue('ambientLight', patch.ambientLight, { min: 0, max: 1, type: 'number' });
    if (!result.ok) return result;
  }
  if (patch.robot) {
    const robotRules = {
      x: { min: -100, max: 100, type: 'number' },
      y: { min: -100, max: 100, type: 'number' },
      theta: { min: -Infinity, max: Infinity, type: 'number' },
      vx: { min: -50, max: 50, type: 'number' },
      vy: { min: -50, max: 50, type: 'number' },
    };
    for (const [key, value] of Object.entries(patch.robot)) {
      const rule = robotRules[key];
      if (!rule) return invalid(`不支持的机器人参数: ${key}`);
      const result = validateValue(`robot.${key}`, value, rule);
      if (!result.ok) return result;
    }
  }
  return ok();
}

export function validateSpeed(speed) {
  return validateValue('speed', speed, { min: 0.1, max: 5, type: 'number' });
}
