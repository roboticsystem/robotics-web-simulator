import { MathUtils } from '@utils/MathUtils'
import EventBus, { EVENTS } from '../engine/EventBus'

/**
 * SoundSimulator — 声音传播仿真主类
 * 功能：
 *  - 同心圆波纹动画（半径随时间扩展，opacity 衰减）
 *  - 距离衰减计算（供传感器使用）
 *  - 障碍物遮挡角度区间计算（携带距离信息，供 SoundWaveLayer 按波半径动态过滤）
 */
export class SoundSimulator {
  constructor() {
    /** @type {Map<string, { waves, occlusionAngles }>} */
    this._soundDataMap = new Map()
    this._isDirty = false

    // 监听场景变化（障碍物变化影响遮挡）
    EventBus.on(EVENTS.SCENE_ENTITY_ADDED,   () => { this._isDirty = true })
    EventBus.on(EVENTS.SCENE_ENTITY_REMOVED, () => { this._isDirty = true })
    EventBus.on(EVENTS.SCENE_ENTITY_UPDATED, () => { this._isDirty = true })
    EventBus.on(EVENTS.SCENE_LOADED,         () => {
      this._soundDataMap.clear()
      this._isDirty = true
    })
  }

  /**
   * 每帧更新（由 RenderLoop.onFixedUpdate 调用）
   * @param {number} dt - 秒
   * @param {SceneManager} scene
   */
  update(dt, scene) {
    for (const source of scene.soundSources) {
      if (!source.enabled || !source.isPlaying) continue

      // 初始化数据
      if (!this._soundDataMap.has(source.id)) {
        this._soundDataMap.set(source.id, { waves: [], occlusionAngles: [] })
      }
      const data = this._soundDataMap.get(source.id)

      // 推进波纹计时器
      source._waveTimer = (source._waveTimer || 0) + dt
      if (source._waveTimer >= source.waveInterval) {
        source._waveTimer -= source.waveInterval
        // 发射新波纹
        data.waves.push({ radius: 0, opacity: 0.8 })
      }

      // 更新波纹（扩展半径，衰减不透明度）
      for (const wave of data.waves) {
        wave.radius += source.waveSpeed * dt
        // opacity 与半径成反比衰减
        wave.opacity = 0.8 * Math.pow(1 - wave.radius / source.maxRadius, 1.5)
      }

      // 清除超出范围的波纹
      data.waves = data.waves.filter(w => w.radius < source.maxRadius && w.opacity > 0.01)

      // 更新遮挡角度（仅在场景变化时重算，或每 10 帧刷新一次）
      if (this._isDirty || !source._occlusionFrame || source._occlusionFrame % 10 === 0) {
        data.occlusionAngles = this._computeOcclusionAngles(source, scene.obstacles)
      }
      source._occlusionFrame = (source._occlusionFrame || 0) + 1
    }

    if (this._isDirty) this._isDirty = false
  }

  /**
   * 获取声音数据 Map（供 SoundWaveLayer 使用）
   */
  getSoundDataMap() {
    return this._soundDataMap
  }

  /**
   * 计算声源在某点的声音强度（0-1），考虑距离衰减和遮挡
   * @param {{x,y}} point
   * @param {SceneManager} scene
   * @returns {number}
   */
  getIntensityAt(point, scene) {
    let maxIntensity = 0

    for (const source of scene.soundSources) {
      if (!source.enabled || !source.isPlaying) continue

      const dist = MathUtils.dist(point, source.position)
      if (dist >= source.maxRadius) continue

      // 遮挡检测
      if (this._isOccluded(point, source.position, scene.obstacles)) continue

      const ratio = 1 - dist / source.maxRadius
      const intensity = source.intensity * ratio * ratio
      if (intensity > maxIntensity) maxIntensity = intensity
    }

    return Math.min(1, maxIntensity)
  }

  /**
   * 计算某点到声源之间是否有障碍物遮挡
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

  /**
   * 计算障碍物对声源的遮挡角度区间
   * 每个区间携带 distance 字段（障碍物最近点到声源的距离）
   * SoundWaveLayer 据此按当前波半径动态决定是否应用该遮挡
   *
   * @returns {{start,end,distance}[]} 角度区间数组（0 ~ 2π）
   */
  _computeOcclusionAngles(source, obstacles) {
    const occluded = []
    const { x: sx, y: sy } = source.position

    for (const obs of obstacles) {
      const verts = obs.getWorldVertices?.()
      if (!verts || verts.length < 2) continue

      // ── 计算障碍物最近点到声源的距离 ──────────────────────
      let nearestDist = Infinity
      if (obs.type === 'circle') {
        // 圆形：圆心距 - 半径（取 0 的最大值防负数）
        const centerDist = MathUtils.dist(source.position, obs.position)
        nearestDist = Math.max(0, centerDist - (obs.radius || 0))
      } else {
        // 多边形/矩形：取所有顶点中距声源最近的距离
        for (const v of verts) {
          const d = MathUtils.dist(source.position, v)
          if (d < nearestDist) nearestDist = d
        }
        // 更精确：检查各边的垂足距离
        for (let i = 0; i < verts.length; i++) {
          const a = verts[i]
          const b = verts[(i + 1) % verts.length]
          const d = Math.sqrt(MathUtils.pointToSegmentDistSq(source.position, a, b))
          if (d < nearestDist) nearestDist = d
        }
      }

      // ── 计算角度范围 ──────────────────────────────────────
      const angles = verts.map(v => {
        let a = Math.atan2(v.y - sy, v.x - sx)
        if (a < 0) a += Math.PI * 2
        return a
      })

      if (angles.length < 2) continue

      let minA = Math.min(...angles)
      let maxA = Math.max(...angles)

      // 处理跨越 0/2π 的情况（angular span > π 时跳过，避免误判）
      const span = maxA - minA
      if (span > Math.PI) continue

      occluded.push({ start: minA, end: maxA, distance: nearestDist })
    }

    return occluded
  }
}
