import { LineTrackGenerator } from './LineTrackGenerator'
import { GridMapGenerator } from './GridMapGenerator'
import EventBus, { EVENTS } from '../engine/EventBus'

/**
 * MapGenerator — 地图生成入口（策略模式分发）
 */
export class MapGenerator {
  constructor() {
    this._lineTrack = new LineTrackGenerator()
    this._gridMap = new GridMapGenerator()
  }

  /**
   * 生成巡线地图
   * @param {object} opts
   * @returns {object} lineTrack 数据
   */
  generateLineTrack(opts = {}) {
    const data = this._lineTrack.generate(opts)
    EventBus.emit(EVENTS.MAP_GENERATED, { mapType: 'lineTrack', data })
    return data
  }

  /**
   * 生成栅格地图
   * @param {object} opts
   * @returns {object} gridMap 数据（含 obstacles 数组）
   */
  generateGridMap(opts = {}) {
    const data = this._gridMap.generate(opts)
    EventBus.emit(EVENTS.MAP_GENERATED, { mapType: 'gridMap', data })
    return data
  }

  /**
   * 通用接口：按 type 分发
   * @param {'lineTrack'|'gridMap'} type
   * @param {object} opts
   */
  generate(type, opts = {}) {
    if (type === 'lineTrack') return this.generateLineTrack(opts)
    if (type === 'gridMap')  return this.generateGridMap(opts)
    throw new Error(`[MapGenerator] Unknown map type: ${type}`)
  }
}
