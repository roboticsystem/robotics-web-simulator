import { LightRayTracer } from './LightRayTracer'
import { MathUtils } from '@utils/MathUtils'
import EventBus, { EVENTS } from '../engine/EventBus'

/**
 * LightSimulator — 光照仿真主类
 * 脏标记驱动：只有场景发生变化时才重新计算可见多边形
 * 结果通过 getLightDataMap() 提供给 LightHeatmapLayer 渲染
 */
export class LightSimulator {
  constructor() {
    this._tracer = new LightRayTracer()
    this._isDirty = true

    /** @type {Map<string, { visibilityPolygon, lightIntensityAtPoint }>} */
    this._lightDataMap = new Map()

    // 监听场景变化事件，自动标记脏
    EventBus.on(EVENTS.SCENE_ENTITY_ADDED,   () => this.markDirty())
    EventBus.on(EVENTS.SCENE_ENTITY_REMOVED, () => this.markDirty())
    EventBus.on(EVENTS.SCENE_ENTITY_UPDATED, () => this.markDirty())
    EventBus.on(EVENTS.SCENE_LOADED,         () => this.markDirty())
  }

  markDirty() {
    this._isDirty = true
  }

  get isDirty() { return this._isDirty }

  /**
   * 重新计算所有光源的可见多边形
   * @param {SceneManager} scene
   */
  compute(scene) {
    this._isDirty = false
    this._lightDataMap.clear()

    for (const light of scene.lightSources) {
      if (!light.enabled) continue

      let visibilityPolygon
      if (light.castShadows) {
        visibilityPolygon = this._tracer.computeVisibilityPolygon(
          light.position,
          scene.obstacles,
          light.maxRadius,
        )
      } else {
        // 无阴影：简单圆形区域
        const steps = 64
        visibilityPolygon = Array.from({ length: steps }, (_, i) => {
          const a = (i / steps) * Math.PI * 2
          return {
            x: light.position.x + Math.cos(a) * light.maxRadius,
            y: light.position.y + Math.sin(a) * light.maxRadius,
          }
        })
      }

      this._lightDataMap.set(light.id, { visibilityPolygon })
    }
  }

  /**
   * 获取光照数据 Map（供渲染层使用）
   */
  getLightDataMap() {
    return this._lightDataMap
  }

  /**
   * 计算场景中某点的光照强度（0-1）
   * 供传感器接口使用
   * @param {{x,y}} point
   * @param {SceneManager} scene
   * @returns {number} 0-1 光照强度
   */
  getIntensityAt(point, scene) {
    let totalIntensity = 0

    for (const light of scene.lightSources) {
      if (!light.enabled) continue

      const dist = MathUtils.dist(point, light.position)
      if (dist >= light.maxRadius) continue

      // 检查光线是否被遮挡
      if (light.castShadows && this._isOccluded(point, light.position, scene.obstacles)) {
        continue
      }

      // 距离衰减（反平方近似）
      const ratio = 1 - dist / light.maxRadius
      totalIntensity += light.intensity * ratio * ratio
    }

    return Math.min(1, totalIntensity)
  }

  /**
   * 判断从 from 到 to 之间是否有障碍物遮挡
   */
  _isOccluded(from, to, obstacles) {
    const dir = MathUtils.vecSub(to, from)
    const maxT = MathUtils.vecLen(dir)
    const normDir = MathUtils.vecNorm(dir)

    for (const obs of obstacles) {
      const segs = obs.getSegments?.()
      if (!segs) continue
      for (const [a, b] of segs) {
        const t = MathUtils.raySegmentIntersect(from, normDir, a, b)
        if (t !== null && t > 0.1 && t < maxT - 0.1) return true
      }
    }
    return false
  }
}
