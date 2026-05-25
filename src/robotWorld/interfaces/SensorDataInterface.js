import EventBus, { EVENTS } from '../core/engine/EventBus'

/**
 * SensorDataInterface — 标准化传感器数据输出接口
 * 外部子系统（传感器子系统）通过此接口订阅实时传感器数据
 */
export class SensorDataInterface {
  constructor() {
    this._subscribers = new Set()
    this._latestData = null

    // 监听仿真内部传感器更新事件
    EventBus.on(EVENTS.SIM_SENSOR_UPDATE, (raw) => {
      this._latestData = this._format(raw)
      this._subscribers.forEach(cb => {
        try { cb(this._latestData) } catch (e) { console.error('[SensorDataInterface]', e) }
      })
    })
  }

  /**
   * 订阅传感器数据更新
   * @param {Function} callback - (SensorSnapshot) => void
   * @returns {Function} 取消订阅函数
   */
  subscribe(callback) {
    this._subscribers.add(callback)
    return () => this._subscribers.delete(callback)
  }

  /**
   * 获取当前传感器数据快照
   * @returns {SensorSnapshot|null}
   */
  getSnapshot() {
    return this._latestData
  }

  /**
   * 格式化原始传感器数据为标准格式
   * @param {object} raw
   * @returns {SensorSnapshot}
   */
  _format(raw) {
    return {
      timestamp: Date.now(),
      robotId: raw.robotId || 'robot-0',
      sensors: {
        light: {
          intensity: Math.min(1, Math.max(0, raw.light ?? 0)),
          unit: 'normalized',
        },
        sound: {
          intensity: Math.min(1, Math.max(0, raw.sound ?? 0)),
          unit: 'normalized',
        },
        collision: {
          isColliding: raw.collision?.any ?? false,
          directions: {
            front: raw.collision?.front ?? false,
            back:  raw.collision?.back  ?? false,
            left:  raw.collision?.left  ?? false,
            right: raw.collision?.right ?? false,
          },
        },
        lineDetector: {
          detected:  raw.lineDetected ?? false,
          position:  raw.linePosition ?? null,
        },
      },
    }
  }
}

// 全局单例
export const sensorInterface = new SensorDataInterface()
