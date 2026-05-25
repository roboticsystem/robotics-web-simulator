// WebSocket 主入口，负责消息分发与仿真控制
import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import { SimulationEngine } from './simulation.js';
import {
  validateObstaclePayload,
  validateSceneUpdate,
  validateSensorPayload,
  validateSensorAdd,
  validateSpeedPayload,
} from './validation-safe.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;

const app = createApp();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const MAX_LOGS = 500;
let logs = [];

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

function emitLog(level, message, sensorId) {
  const entry = {
    type: 'simulation_log',
    timestamp: Date.now(),
    payload: { level, message, sensorId: sensorId ?? undefined },
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
  broadcast(entry);
}

function emit(type, body) {
  broadcast({
    type,
    timestamp: body.timestamp ?? Date.now(),
    payload: body.payload !== undefined ? body.payload : body,
  });
}

let engine = new SimulationEngine(emitLog, emit);

function sendError(ws, code, message) {
  ws.send(
    JSON.stringify({
      type: 'error',
      timestamp: Date.now(),
      payload: { code, message },
    })
  );
}

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendError(ws, 4004, '消息格式错误');
    return;
  }

  const { type, payload = {} } = msg;

  try {
    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now(), payload: {} }));
        break;

      case 'get_state':
        ws.send(
          JSON.stringify({
            type: 'state_sync',
            timestamp: Date.now(),
            payload: { ...engine.getState(), logs: logs.slice(-200) },
          })
        );
        break;

      case 'simulation_start': {
        const v = validateSpeedPayload(payload);
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        const r = engine.start(payload);
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'simulation_status',
            timestamp: Date.now(),
            payload: { running: true, paused: false, speed: engine.speed },
          });
        break;
      }

      case 'simulation_pause': {
        const r = engine.pause();
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'simulation_status',
            timestamp: Date.now(),
            payload: { running: true, paused: true },
          });
        break;
      }

      case 'simulation_resume': {
        const r = engine.resume();
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'simulation_status',
            timestamp: Date.now(),
            payload: { running: true, paused: false },
          });
        break;
      }

      case 'simulation_stop':
        engine.stop();
        broadcast({
          type: 'simulation_status',
          timestamp: Date.now(),
          payload: { running: false, paused: false },
        });
        break;

      case 'simulation_set_speed': {
        const v = validateSpeedPayload(payload);
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        const sp = Math.max(0.1, Math.min(5, payload.speed ?? 1));
        engine.speed = sp;
        broadcast({
          type: 'simulation_status',
          timestamp: Date.now(),
          payload: { speed: engine.speed },
        });
        break;
      }

      case 'sensor_update': {
        const id = payload.sensorId;
        if (!id) {
          sendError(ws, 4004, '缺少 sensorId');
          break;
        }
        const sensor = engine.sensors.find((item) => item.sensorId === id);
        if (!sensor) {
          sendError(ws, 4002, '传感器不存在');
          break;
        }
        const v = validateSensorPayload(payload, sensor.sensorType);
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        const { sensorId, ...patch } = payload;
        if (patch.range !== undefined) {
          patch.rangeCm = patch.range;
          delete patch.range;
        }
        const r = engine.updateSensor(sensorId, patch);
        if (!r.ok) sendError(ws, r.code, r.message);
        else {
          broadcast({
            type: 'sensor_list',
            timestamp: Date.now(),
            payload: { sensors: engine.sensors },
          });
        }
        break;
      }

      case 'sensor_add': {
        const v = validateSensorAdd(payload);
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        const r = engine.addSensor(payload);
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'sensor_list',
            timestamp: Date.now(),
            payload: { sensors: engine.sensors },
          });
        break;
      }

      case 'sensor_remove': {
        const r = engine.removeSensor(payload.sensorId);
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'sensor_list',
            timestamp: Date.now(),
            payload: { sensors: engine.sensors },
          });
        break;
      }

      case 'sensor_reset_defaults': {
        if (!payload.sensorId) {
          sendError(ws, 4004, '缺少 sensorId');
          break;
        }
        const r = engine.resetSensorDefaults(payload.sensorId);
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'sensor_list',
            timestamp: Date.now(),
            payload: { sensors: engine.sensors },
          });
        break;
      }

      case 'scene_update': {
        const v = validateSceneUpdate(payload);
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        engine.setScene(payload);
        broadcast({
          type: 'scene_sync',
          timestamp: Date.now(),
          payload: engine.scene,
        });
        break;
      }

      case 'obstacle_add': {
        const v = validateObstaclePayload(payload);
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        engine.addObstacle(payload);
        broadcast({
          type: 'scene_sync',
          timestamp: Date.now(),
          payload: engine.scene,
        });
        break;
      }

      case 'obstacle_remove': {
        const r = engine.removeObstacle(payload.id);
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'scene_sync',
            timestamp: Date.now(),
            payload: engine.scene,
          });
        break;
      }

      case 'obstacle_update': {
        const { id, ...rest } = payload;
        if (!id) {
          sendError(ws, 4004, '缺少 id');
          break;
        }
        const v = validateObstaclePayload(payload, { partial: true });
        if (!v.ok) {
          sendError(ws, v.code, v.message);
          break;
        }
        const r = engine.updateObstacle(id, rest);
        if (!r.ok) sendError(ws, r.code, r.message);
        else
          broadcast({
            type: 'scene_sync',
            timestamp: Date.now(),
            payload: engine.scene,
          });
        break;
      }

      case 'reset_sensors':
        engine.resetSensors();
        break;

      case 'reset_scene': {
        engine.stop();
        logs = [];
        engine = new SimulationEngine(emitLog, emit);
        broadcast({
          type: 'state_sync',
          timestamp: Date.now(),
          payload: { ...engine.getState(), logs: [] },
        });
        emitLog('info', '场景与仿真已重置', null);
        break;
      }

      default:
        sendError(ws, 4004, `未知消息类型: ${type}`);
    }
  } catch (e) {
    console.error(e);
    sendError(ws, 5001, e.message || '服务器内部错误');
  }
}

wss.on('connection', (ws) => {
  emitLog('info', 'WebSocket 客户端已连接', null);
  ws.send(
    JSON.stringify({
      type: 'state_sync',
      timestamp: Date.now(),
      payload: { ...engine.getState(), logs: logs.slice(-200) },
    })
  );

  ws.on('message', (data) => handleMessage(ws, data.toString()));

  ws.on('close', () => {
    emitLog('info', 'WebSocket 客户端断开', null);
  });
});

server.listen(PORT, () => {
  console.log(`Sensor simulation server listening on http://localhost:${PORT}`);
});
