function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const SENSOR_TYPE_LABELS = {
  ultrasonic: '超声波',
  infrared: '红外',
  imu: '惯性单元',
  unknown: '未知类型',
};

const SENSOR_STATUS_LABELS = {
  normal: '正常',
  unstable: '波动',
  out_of_range: '超量程',
  invalid: '无效',
  no_target: '无目标',
};

const LOG_LEVEL_LABELS = {
  info: '信息',
  warning: '警告',
  error: '错误',
};

export function formatTimestamp(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

export function translateSensorType(type) {
  return SENSOR_TYPE_LABELS[type] || type || SENSOR_TYPE_LABELS.unknown;
}

export function translateSensorStatus(status) {
  if (!status || status === '-') return '-';
  return SENSOR_STATUS_LABELS[status] || status;
}

export function translateLogLevel(level) {
  return LOG_LEVEL_LABELS[level] || level || '-';
}

export function summarizeRecords(records) {
  // 汇总采样记录：统计总量、按传感器分组、计算均值/极值
  const summary = {
    totalSamples: records.length,
    firstTimestamp: records[0]?.t ?? null,
    lastTimestamp: records[records.length - 1]?.t ?? null,
    durationSeconds: 0,
    sensorCount: 0,
    sensorIds: [],
    bySensor: [],
    byType: {},
    throughputPerMinute: 0,
  };

  if (!records.length) return summary;

  const grouped = new Map();
  for (const row of records) {
    const id = row.sensorId || 'unknown';
    const list = grouped.get(id) ?? [];
    list.push(row);
    grouped.set(id, list);
    summary.byType[row.sensorType || 'unknown'] = (summary.byType[row.sensorType || 'unknown'] ?? 0) + 1;
  }

  summary.sensorIds = [...grouped.keys()];
  summary.sensorCount = summary.sensorIds.length;

  const spanMs = Math.max(0, (summary.lastTimestamp ?? 0) - (summary.firstTimestamp ?? 0));
  summary.durationSeconds = spanMs / 1000;
  summary.throughputPerMinute = spanMs > 0 ? Number(((records.length / spanMs) * 60000).toFixed(1)) : 0;

  summary.bySensor = summary.sensorIds.map((sensorId) => {
    const rows = grouped.get(sensorId) ?? [];
    const type = rows[0]?.sensorType || 'unknown';
    const scalarValues = rows.map((row) => safeNumber(row.value)).filter((value) => value !== 0 || rows.some((row) => row.value === 0));
    const gyroValues = rows.map((row) => safeNumber(row.gyroZ)).filter((value) => value !== 0 || rows.some((row) => row.gyroZ === 0));
    const accelXValues = rows.map((row) => safeNumber(row.accelX)).filter((value) => value !== 0 || rows.some((row) => row.accelX === 0));
    const accelYValues = rows.map((row) => safeNumber(row.accelY)).filter((value) => value !== 0 || rows.some((row) => row.accelY === 0));

    return {
      sensorId,
      sensorType: type,
      samples: rows.length,
      lastStatus: rows[rows.length - 1]?.status || '-',
      averageValue: scalarValues.length ? Number(average(scalarValues).toFixed(3)) : null,
      minValue: scalarValues.length ? Number(Math.min(...scalarValues).toFixed(3)) : null,
      maxValue: scalarValues.length ? Number(Math.max(...scalarValues).toFixed(3)) : null,
      gyroMean: gyroValues.length ? Number(average(gyroValues).toFixed(4)) : null,
      accelMeanX: accelXValues.length ? Number(average(accelXValues).toFixed(4)) : null,
      accelMeanY: accelYValues.length ? Number(average(accelYValues).toFixed(4)) : null,
    };
  });

  return summary;
}

export function summarizeLogs(logs) {
  // 日志分级统计与近期告警截取
  const counts = { info: 0, warning: 0, error: 0 };
  const recentWarnings = [];

  for (const log of logs) {
    const level = log.payload?.level || 'info';
    counts[level] = (counts[level] ?? 0) + 1;
    if ((level === 'warning' || level === 'error') && recentWarnings.length < 8) {
      recentWarnings.push({
        timestamp: log.timestamp,
        level,
        message: log.payload?.message || '',
        sensorId: log.payload?.sensorId || '',
      });
    }
  }

  return {
    counts,
    total: logs.length,
    recentWarnings,
    errorRate: logs.length ? Number((((counts.error ?? 0) / logs.length) * 100).toFixed(1)) : 0,
  };
}

export function summarizeScene(scene) {
  // 场景概览：障碍物面积、平均反射率、机器人位姿等
  const obstacles = scene?.obstacles || [];
  const footprint = obstacles.reduce((sum, obstacle) => sum + safeNumber(obstacle.width) * safeNumber(obstacle.height), 0);
  const reflectivityValues = obstacles.map((obstacle) => safeNumber(obstacle.reflectivity));
  return {
    sceneId: scene?.sceneId || '-',
    obstacleCount: obstacles.length,
    obstacleFootprint: Number(footprint.toFixed(2)),
    averageReflectivity: reflectivityValues.length ? Number(average(reflectivityValues).toFixed(2)) : 0,
    robotPose: scene?.robot || { x: 0, y: 0, theta: 0 },
    ambientLight: safeNumber(scene?.ambientLight),
  };
}

export function buildSensorHealth(sensors, latestBySensor, recordSummary) {
  // 结合最新值与历史统计，给出简单健康度判断
  return sensors.map((sensor) => {
    const latest = latestBySensor[sensor.sensorId] || null;
    const summary = recordSummary.bySensor.find((item) => item.sensorId === sensor.sensorId) || null;
    let health = '稳定';
    if (!sensor.enabled) health = '已停用';
    else if (!latest) health = '等待数据';
    else if (latest.status && latest.status !== 'normal') health = '需关注';

    return {
      sensorId: sensor.sensorId,
      name: sensor.name || sensor.sensorId,
      sensorType: translateSensorType(sensor.sensorType),
      enabled: !!sensor.enabled,
      health,
      latestStatus: translateSensorStatus(latest?.status || '-'),
      latestValue:
        latest?.value ??
        (latest?.gyroZ !== undefined ? `角速度 ${Number(latest.gyroZ).toFixed(3)}` : '-'),
      samples: summary?.samples ?? 0,
      averageValue: summary?.averageValue ?? summary?.gyroMean ?? null,
    };
  });
}

export function buildRecommendations({ sceneSummary, logSummary, recordSummary, healthRows }) {
  const items = [];

  if (sceneSummary.obstacleCount < 3) {
    items.push('当前障碍物数量偏少，建议适当增加障碍物密度，使导航实验更具代表性。');
  }
  if (recordSummary.totalSamples < 50) {
    items.push('当前采样数量较少，建议延长运行时间后再进行分析与数据导出。');
  }
  if ((logSummary.counts.warning ?? 0) > 10) {
    items.push('告警次数较多，建议重点检查噪声、量程和安装角等参数配置。');
  }
  if (healthRows.some((row) => row.health === '等待数据')) {
    items.push('仍有传感器尚未产生新数据，请确认仿真是否已启动或采样频率是否设置合理。');
  }
  if (!items.length) {
    items.push('当前数据状态整体良好，可以继续进行场景复盘、结果留存和后续对比。');
  }

  return items;
}
