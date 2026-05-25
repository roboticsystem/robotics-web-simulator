// 仿真引擎主循环与采样调度
import { randomUUID } from 'crypto';
import { sampleUltrasonic } from './sensors/ultrasonic.js';
import { sampleInfrared } from './sensors/infrared.js';
import { sampleImu, createImuState } from './sensors/imu.js';
import { createDefaultScene, createObstacle } from './scene.js';

function translateSensorType(type) {
  const labels = {
    ultrasonic: '超声波',
    infrared: '红外',
    imu: '惯性单元',
  };
  return labels[type] || type;
}

function translateStatus(status) {
  const labels = {
    normal: '正常',
    unstable: '波动',
    out_of_range: '超量程',
    invalid: '无效',
    no_target: '无目标',
  };
  return labels[status] || status;
}

const DEFAULT_SENSOR = {
  ultrasonic: {
    sensorType: 'ultrasonic',
    mountX: 0.14,
    mountY: 0,
    mountAngle: 0,
    rangeCm: 300,
    minRangeCm: 2,
    beamDeg: 55,
    frequency: 10,
    noise: 0.02,
    sysError: 0.01,
    reflectivityGain: 1,
    resolution: 0.1,
    enabled: true,
  },
  infrared: {
    sensorType: 'infrared',
    mountX: 0.12,
    mountY: 0.05,
    mountAngle: 0,
    rangeCm: 60,
    frequency: 20,
    noise: 0.06,
    sensitivity: 1,
    ambientFactor: 1,
    outputMode: 'analog',
    threshold: 0.45,
    reflectivityGain: 1,
    resolution: 0.01,
    enabled: true,
  },
  imu: {
    sensorType: 'imu',
    mountX: 0,
    mountY: 0,
    mountAngle: 0,
    frequency: 50,
    noiseGyro: 0.02,
    noiseAccel: 0.12,
    driftCoeff: 0.003,
    biasGyro: 0,
    biasAccelX: 0,
    biasAccelY: 0,
    resolutionGyro: 0.001,
    resolutionAccel: 0.01,
    enabled: true,
  },
};

export class SimulationEngine {
  constructor(emitLog, emit) {
    this.emitLog = emitLog;
    this.emit = emit;
    this.scene = createDefaultScene();
    this.sensors = [];
    this.imuStates = new Map();
    this.running = false;
    this.paused = false;
    this.speed = 1;
    this.interval = null;
    this.tickMs = 20;
    this.lastTick = Date.now();
    this.robotPrev = null;
    this.lastSampleAt = new Map();
    this.sensorCursor = 0;
    this.tickAvgMs = 0;
    this.tickBudgetMs = 18;
    this.sampleLimit = 4;
    this.lastPerfLogAt = 0;
    this.initDefaultSensors();
  }

  initDefaultSensors() {
    this.addSensor({ ...DEFAULT_SENSOR.ultrasonic, sensorId: 'ultrasonic_01', name: '超声波-1' });
    this.addSensor({ ...DEFAULT_SENSOR.infrared, sensorId: 'infrared_01', name: '红外-1' });
    this.addSensor({ ...DEFAULT_SENSOR.imu, sensorId: 'imu_01', name: 'IMU-1' });
  }

  addSensor(cfg) {
    const id = cfg.sensorId || `${cfg.sensorType}_${randomUUID().slice(0, 8)}`;
    if (this.sensors.some((s) => s.sensorId === id)) {
      return { ok: false, code: 4001, message: '传感器 ID 重复' };
    }
    const base = DEFAULT_SENSOR[cfg.sensorType] || {};
    const merged = { ...base, ...cfg, sensorId: id };
    this.sensors.push(merged);
    if (cfg.sensorType === 'imu') this.imuStates.set(id, createImuState());
    this.emitLog('info', `已添加传感器 ${id}（${translateSensorType(cfg.sensorType)}）`, id);
    return { ok: true, sensorId: id };
  }

  removeSensor(sensorId) {
    const i = this.sensors.findIndex((s) => s.sensorId === sensorId);
    if (i < 0) return { ok: false, code: 4002, message: '传感器不存在' };
    this.sensors.splice(i, 1);
    this.imuStates.delete(sensorId);
    this.lastSampleAt.delete(sensorId);
    this.emitLog('info', `已删除传感器 ${sensorId}`, sensorId);
    return { ok: true };
  }

  updateSensor(sensorId, patch) {
    const s = this.sensors.find((x) => x.sensorId === sensorId);
    if (!s) return { ok: false, code: 4002, message: '传感器不存在' };
    Object.assign(s, patch);
    this.emitLog('info', `参数已更新 ${sensorId}`, sensorId);
    return { ok: true };
  }

  /** 恢复该传感器类型的内置默认参数，保留 sensorId / name / sensorType */
  resetSensorDefaults(sensorId) {
    const s = this.sensors.find((x) => x.sensorId === sensorId);
    if (!s) return { ok: false, code: 4002, message: '传感器不存在' };
    const base = DEFAULT_SENSOR[s.sensorType];
    if (!base) return { ok: false, code: 4001, message: '传感器类型无效' };
    Object.assign(s, { ...base, sensorId: s.sensorId, name: s.name, sensorType: s.sensorType });
    if (s.sensorType === 'imu') this.imuStates.set(sensorId, createImuState());
    this.emitLog('info', `传感器 ${sensorId} 已恢复默认参数`, sensorId);
    return { ok: true };
  }

  setScene(scene) {
    if (scene.ambientLight !== undefined) this.scene.ambientLight = scene.ambientLight;
    if (scene.robot) Object.assign(this.scene.robot, scene.robot);
    if (scene.obstacles) this.scene.obstacles = scene.obstacles.map((item) => createObstacle(item));
    if (scene.scale !== undefined) this.scene.scale = scene.scale;
    if (scene.sceneId) this.scene.sceneId = scene.sceneId;
  }

  applyPreset(preset = {}) {
    this.stop();
    this.scene = createDefaultScene();
    this.sensors = [];
    this.imuStates.clear();
    this.lastSampleAt.clear();

    if (preset.scene) {
      this.setScene({
        ...preset.scene,
        obstacles: Array.isArray(preset.scene.obstacles) ? preset.scene.obstacles : this.scene.obstacles,
      });
    }

    if (Array.isArray(preset.sensors) && preset.sensors.length > 0) {
      for (const sensor of preset.sensors) {
        this.addSensor(sensor);
      }
    } else {
      this.initDefaultSensors();
    }
    this.sensorCursor = 0;

    const label = preset.name || preset.scene?.sceneId || '自定义预设';
    this.emitLog('info', `已应用预设 ${label}`, null);
    return { ok: true };
  }

  addObstacle(p) {
    const o = createObstacle(p);
    this.scene.obstacles.push(o);
    this.emitLog('info', `添加障碍物 ${o.id}`, null);
    return o;
  }

  removeObstacle(id) {
    const n = this.scene.obstacles.length;
    this.scene.obstacles = this.scene.obstacles.filter((o) => o.id !== id);
    if (this.scene.obstacles.length === n) return { ok: false, code: 4002, message: '障碍物不存在' };
    this.emitLog('info', `删除障碍物 ${id}`, null);
    return { ok: true };
  }

  updateObstacle(id, patch) {
    const o = this.scene.obstacles.find((x) => x.id === id);
    if (!o) return { ok: false, code: 4002, message: '障碍物不存在' };
    Object.assign(o, patch);
    return { ok: true };
  }

  start(payload = {}) {
    if (this.sensors.filter((s) => s.enabled).length === 0) {
      this.emitLog('warning', '未启用任何传感器，仍启动仿真', null);
    }
    this.speed = payload.speed ?? 1;
    this.running = true;
    this.paused = false;
    this.lastTick = Date.now();
    this.robotPrev = { ...this.scene.robot, theta: this.scene.robot.theta };
    this.emitLog('info', '仿真开始', null);
    this.ensureLoop();
    return { ok: true };
  }

  pause() {
    if (!this.running) return { ok: false, code: 4003, message: '仿真未启动' };
    this.paused = true;
    this.emitLog('info', '仿真已暂停', null);
    return { ok: true };
  }

  resume() {
    if (!this.running) return { ok: false, code: 4003, message: '仿真未启动' };
    this.paused = false;
    this.lastTick = Date.now();
    this.emitLog('info', '仿真继续', null);
    return { ok: true };
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.emitLog('info', '仿真停止', null);
    return { ok: true };
  }

  resetSensors() {
    this.imuStates.clear();
    for (const s of this.sensors) {
      if (s.sensorType === 'imu') this.imuStates.set(s.sensorId, createImuState());
    }
    this.lastSampleAt.clear();
    this.emitLog('info', '传感器状态已重置', null);
    return { ok: true };
  }

  ensureLoop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), this.tickMs);
  }

  tick() {
    if (!this.running || this.paused) return;
    const tickStart = Date.now();
    const now = Date.now();
    const dt = ((now - this.lastTick) / 1000) * this.speed;
    this.lastTick = now;
    const robot = this.scene.robot;
    const prev = this.robotPrev;
    this.robotPrev = { x: robot.x, y: robot.y, theta: robot.theta, vx: robot.vx, vy: robot.vy };

    const enabledSensors = this.sensors.filter((s) => s.enabled);
    if (enabledSensors.length === 0) return;
    const samplesPerTick = Math.min(enabledSensors.length, this.sampleLimit);
    for (let i = 0; i < samplesPerTick; i += 1) {
      const sensor = enabledSensors[(this.sensorCursor + i) % enabledSensors.length];
      if (!sensor.enabled) continue;
      const freq = sensor.frequency || 10;
      const periodMs = 1000 / freq;
      const last = this.lastSampleAt.get(sensor.sensorId) || 0;
      if (now - last < periodMs * 0.95) continue;
      this.lastSampleAt.set(sensor.sensorId, now);

      let payload;
      if (sensor.sensorType === 'ultrasonic') {
        const r = sampleUltrasonic(this.scene, robot, sensor);
        payload = {
          sensorId: sensor.sensorId,
          sensorType: 'ultrasonic',
          value: r.value,
          unit: r.unit,
          status: r.status,
          theoretical: r.theoretical,
          hit: r.hit,
        };
        if (r.status === 'out_of_range' || r.status === 'invalid') {
          this.emitLog('warning', `超声波 ${sensor.sensorId}：${translateStatus(r.status)}`, sensor.sensorId);
        }
      } else if (sensor.sensorType === 'infrared') {
        const r = sampleInfrared(this.scene, robot, sensor);
        payload = {
          sensorId: sensor.sensorId,
          sensorType: 'infrared',
          value: r.value,
          unit: r.unit,
          status: r.status,
          theoretical: r.theoretical,
          hit: r.hit,
        };
      } else if (sensor.sensorType === 'imu') {
        const st = this.imuStates.get(sensor.sensorId) || createImuState();
        this.imuStates.set(sensor.sensorId, st);
        const r = sampleImu(robot, sensor, prev, Math.max(dt, 1 / 120), st);
        payload = {
          sensorId: sensor.sensorId,
          sensorType: 'imu',
          gyroZ: r.gyroZ,
          accelX: r.accelX,
          accelY: r.accelY,
          roll: r.roll,
          pitch: r.pitch,
          unit: 'imu',
          status: r.status,
          theoretical: r.theoretical,
        };
      } else continue;

      this.emit('sensor_data', {
        timestamp: now,
        payload,
      });
    }
    this.sensorCursor = (this.sensorCursor + samplesPerTick) % enabledSensors.length;

    // 采样压力监控：根据 tick 耗时动态调节每帧采样量
    const tickCost = Date.now() - tickStart;
    this.tickAvgMs = this.tickAvgMs === 0 ? tickCost : this.tickAvgMs * 0.9 + tickCost * 0.1;
    if (this.tickAvgMs > this.tickBudgetMs && this.sampleLimit > 1) {
      this.sampleLimit -= 1;
    } else if (this.tickAvgMs < this.tickBudgetMs * 0.6 && this.sampleLimit < 8) {
      this.sampleLimit += 1;
    }
    if (this.tickAvgMs > this.tickBudgetMs * 1.8 && Date.now() - this.lastPerfLogAt > 4000) {
      this.emitLog('warning', `采样压力偏高，已降低每帧采样数至 ${this.sampleLimit}`, null);
      this.lastPerfLogAt = Date.now();
    }
  }

  getState() {
    return {
      scene: JSON.parse(JSON.stringify(this.scene)),
      sensors: JSON.parse(JSON.stringify(this.sensors)),
      running: this.running,
      paused: this.paused,
      speed: this.speed,
    };
  }
}

export { DEFAULT_SENSOR };
