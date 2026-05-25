import EventBus, { EVENTS } from '../core/engine/EventBus'

/**
 * RobotControlInterface — 标准化机器人控制输入接口
 * 外部子系统（控制子系统）通过此接口发送机器人控制指令
 *
 * 支持的指令格式：
 *  { type: 'setVelocity',  linear: 50, angular: 0.1 }  // px/s, rad/s
 *  { type: 'setPosition',  x: 200, y: 300, rotation: 0 }
 *  { type: 'setHeading',   angle: 1.57 }
 *  { type: 'stop' }
 */
export class RobotControlInterface {
  constructor() {
    this._mode = 'manual'    // 'manual' | 'program' | 'external'
    this._commandQueue = []
    this._onCommandCallbacks = new Set()
  }

  /**
   * 发送控制指令
   * @param {RobotCommand} cmd
   */
  sendCommand(cmd) {
    const validated = this._validate(cmd)
    if (!validated) return

    if (this._mode === 'external') {
      EventBus.emit(EVENTS.ROBOT_COMMAND_APPLY, validated)
    } else {
      this._commandQueue.push(validated)
    }

    this._onCommandCallbacks.forEach(cb => cb(validated))
  }

  /**
   * 设置控制模式
   * @param {'manual'|'program'|'external'} mode
   */
  setMode(mode) {
    this._mode = mode
    EventBus.emit(EVENTS.ROBOT_MODE_CHANGED, mode)
  }

  get mode() { return this._mode }

  /**
   * 消费指令队列（由 WorldEngine 在每个固定步长调用）
   * @returns {RobotCommand[]}
   */
  flushQueue() {
    const cmds = [...this._commandQueue]
    this._commandQueue = []
    return cmds
  }

  /**
   * 监听指令（外部调试用）
   */
  onCommand(callback) {
    this._onCommandCallbacks.add(callback)
    return () => this._onCommandCallbacks.delete(callback)
  }

  _validate(cmd) {
    const allowedTypes = ['setVelocity', 'setPosition', 'setHeading', 'stop']
    if (!cmd || !allowedTypes.includes(cmd.type)) {
      console.warn(`[RobotControlInterface] Unknown command type: ${cmd?.type}`)
      return null
    }
    return { ...cmd, timestamp: Date.now() }
  }
}

// 全局单例
export const robotControlInterface = new RobotControlInterface()
