import EventBus, { EVENTS } from '../core/engine/EventBus'
import { robotControlInterface } from './RobotControlInterface'

/**
 * WebSocketBridge — 双向 WebSocket 联调接口
 *
 * 浏览器端只能作 WebSocket Client。本模块连接到外部 WS Server
 * （用户自行启动的中继/控制程序，如 Python asyncio websockets）。
 *
 * ─── 消息协议 ─────────────────────────────────────────────────────
 *
 * 【入站】外部 → 仿真（JSON）：
 *   { "type": "setVelocity",  "linear": 80,  "angular": 0.5 }
 *   { "type": "setPosition",  "x": 200, "y": 300, "rotation": 0 }
 *   { "type": "setHeading",   "angle": 1.57 }
 *   { "type": "stop" }
 *
 * 【出站】仿真 → 外部（每 50ms 推送）：
 *   {
 *     "type": "sensorUpdate",
 *     "robotId": "robot-0",
 *     "light": 0.0,
 *     "sound": 0.0,
 *     "collision": { "front": false, "back": false, "left": false, "right": false, "any": false },
 *     "lineDetected": false,
 *     "linePosition": null
 *   }
 *
 * 【握手包】连接建立时立即发送：
 *   { "type": "hello", "version": "1.0" }
 *
 * ─── 示例：Python 测试服务端 ──────────────────────────────────────
 *   pip install websockets
 *
 *   import asyncio, websockets, json
 *
 *   async def handler(ws):
 *     async for msg in ws:
 *       data = json.loads(msg)
 *       if data.get('type') == 'sensorUpdate':
 *           print(data)
 *       # 发送控制指令示例：
 *       # await ws.send(json.dumps({"type":"setVelocity","linear":80,"angular":0}))
 *
 *   async def main():
 *     async with websockets.serve(handler, "localhost", 8765):
 *       await asyncio.Future()
 *
 *   asyncio.run(main())
 */
export class WebSocketBridge {
  constructor() {
    this._ws             = null
    this._url            = null
    this._connected      = false
    this._reconnecting   = false
    this._reconnectTimer = null
    this._sendTimer      = null
    this._sendInterval   = 50      // ms，传感器推送间隔（≈20Hz）
    this._lastSensorData = null
    this._autoReconnect  = true
    this._reconnectDelay = 5000    // ms

    // 缓存最新传感器数据（由 EventBus 驱动）
    EventBus.on(EVENTS.SIM_SENSOR_UPDATE, (data) => {
      this._lastSensorData = data
    })
  }

  /** 是否已连接 */
  get connected() { return this._connected }

  /** 是否正在重连等待中 */
  get reconnecting() { return this._reconnecting }

  /** 当前连接 URL */
  get url() { return this._url }

  /**
   * 建立 WebSocket 连接
   * @param {string} url - 如 'ws://localhost:8765'
   */
  connect(url) {
    this.disconnect()
    this._url = url
    this._autoReconnect = true
    this._doConnect()
  }

  /**
   * 断开连接（取消重连）
   */
  disconnect() {
    this._autoReconnect = false
    this._reconnecting  = false
    clearTimeout(this._reconnectTimer)
    clearInterval(this._sendTimer)
    if (this._ws) {
      try { this._ws.close() } catch (_) {}
      this._ws = null
    }
    if (this._connected) {
      this._connected = false
      EventBus.emit(EVENTS.WS_STATUS_CHANGED, { connected: false, url: this._url, reconnecting: false })
    }
  }

  // ─── 私有 ────────────────────────────────────────────────

  _doConnect() {
    if (!this._url) return
    try {
      this._ws = new WebSocket(this._url)

      this._ws.onopen = () => {
        this._connected    = true
        this._reconnecting = false
        clearTimeout(this._reconnectTimer)

        EventBus.emit(EVENTS.WS_STATUS_CHANGED, { connected: true, url: this._url, reconnecting: false })

        // 握手包
        this._send({ type: 'hello', version: '1.0' })

        // 开始周期性推送传感器数据
        clearInterval(this._sendTimer)
        this._sendTimer = setInterval(() => this._pushSensor(), this._sendInterval)
      }

      this._ws.onclose = () => {
        this._connected = false
        clearInterval(this._sendTimer)

        if (this._autoReconnect) {
          this._reconnecting = true
          EventBus.emit(EVENTS.WS_STATUS_CHANGED, { connected: false, url: this._url, reconnecting: true })
          this._reconnectTimer = setTimeout(() => {
            if (this._autoReconnect) this._doConnect()
          }, this._reconnectDelay)
        } else {
          EventBus.emit(EVENTS.WS_STATUS_CHANGED, { connected: false, url: this._url, reconnecting: false })
        }
      }

      this._ws.onerror = () => {
        // error 事件后紧跟 close，不重复处理，只上报
        EventBus.emit(EVENTS.WS_ERROR, { error: `无法连接到 ${this._url}` })
      }

      this._ws.onmessage = (e) => {
        try {
          const cmd = JSON.parse(e.data)
          robotControlInterface.sendCommand(cmd)
        } catch (err) {
          console.warn('[WebSocketBridge] 无效消息:', e.data)
        }
      }
    } catch (err) {
      console.error('[WebSocketBridge] connect 异常:', err)
      EventBus.emit(EVENTS.WS_ERROR, { error: String(err) })
    }
  }

  _pushSensor() {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return
    if (!this._lastSensorData) return
    const d = this._lastSensorData
    this._send({
      type:         'sensorUpdate',
      robotId:      d.robotId ?? 'robot-0',
      light:        d.light   ?? 0,
      sound:        d.sound   ?? 0,
      collision:    d.collision ?? { front: false, back: false, left: false, right: false, any: false },
      lineDetected: d.lineDetected ?? false,
      linePosition: d.linePosition ?? null,
    })
  }

  _send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      try { this._ws.send(JSON.stringify(obj)) } catch (_) {}
    }
  }
}

/** 全局单例 */
export const webSocketBridge = new WebSocketBridge()
