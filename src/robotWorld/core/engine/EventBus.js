/**
 * EventBus — 轻量级发布订阅总线（纯 JS，无 Vue 依赖）
 * 供 core 层内部使用，解耦各子系统
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map()
  }

  /**
   * 订阅事件
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} 取消订阅函数
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event).add(handler)
    return () => this.off(event, handler)
  }

  /**
   * 订阅一次性事件
   */
  once(event, handler) {
    const wrapper = (data) => {
      handler(data)
      this.off(event, wrapper)
    }
    return this.on(event, wrapper)
  }

  /**
   * 发布事件
   */
  emit(event, data) {
    const handlers = this._listeners.get(event)
    if (handlers) {
      handlers.forEach(h => {
        try { h(data) } catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e) }
      })
    }
  }

  /**
   * 取消订阅
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler)
  }

  /**
   * 清除所有订阅
   */
  clear() {
    this._listeners.clear()
  }
}

// 全局单例
export default new EventBus()

/**
 * 内部事件契约常量
 */
export const EVENTS = {
  // 场景变更
  SCENE_ENTITY_ADDED:    'scene:entity:added',
  SCENE_ENTITY_REMOVED:  'scene:entity:removed',
  SCENE_ENTITY_UPDATED:  'scene:entity:updated',
  SCENE_CLEARED:         'scene:cleared',
  SCENE_LOADED:          'scene:loaded',
  SCENE_SAVED:           'scene:saved',

  // 仿真状态
  SIM_STARTED:           'sim:started',
  SIM_PAUSED:            'sim:paused',
  SIM_RESET:             'sim:reset',
  SIM_COLLISION:         'sim:collision',
  SIM_SENSOR_UPDATE:     'sim:sensor:update',
  SIM_STEP:              'sim:step',

  // 渲染
  RENDER_FPS:            'stats:fps',
  RENDER_RESIZE:         'render:resize',

  // 交互
  INPUT_ENTITY_SELECTED:  'input:entity:selected',
  INPUT_ENTITY_DESELECTED:'input:entity:deselected',
  INPUT_ENTITY_DRAGGED:   'input:entity:dragged',
  INPUT_CANVAS_CLICKED:   'input:canvas:clicked',
  INPUT_TOOL_CHANGED:     'input:tool:changed',

  // 机器人控制（来自外部接口）
  ROBOT_COMMAND_APPLY:   'robot:command:apply',
  ROBOT_MODE_CHANGED:    'robot:mode:changed',

  // 地图生成
  MAP_GENERATED:         'map:generated',
  MAZE_EXIT_REACHED:     'maze:exit:reached',   // 机器人到达迷宫出口

  // WebSocket 联调接口
  WS_STATUS_CHANGED:     'ws:status:changed',  // { connected:bool, url:string }
  WS_ERROR:              'ws:error',            // { error:string }
}
