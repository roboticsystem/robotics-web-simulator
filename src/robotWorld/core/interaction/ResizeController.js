import { MathUtils } from '@utils/MathUtils'
import EventBus, { EVENTS } from '../engine/EventBus'

/**
 * ResizeController — 障碍物尺寸调整控制器
 *
 * 支持：
 *  - 圆形：拖拽右侧 handle 改变 radius
 *  - 矩形：拖拽四角 handle 改变 width / height（旋转安全）
 *  - 多边形：拖拽顶点 handle 改变单个顶点位置
 */

const HIT_R = 7   // 命中半径（世界坐标 px）
const MIN_SIZE = 8 // 最小尺寸

export class ResizeController {
  constructor(scene, lightSim) {
    this._scene = scene
    this._lightSim = lightSim

    this._isResizing = false
    this._resizeObs = null
    this._handleType = null  // 'radius' | 'corner' | 'vertex'
    this._handleIdx = null   // corner: 0-3, vertex: 0-N
  }

  get isResizing() { return this._isResizing }

  /**
   * 检测 worldPoint 是否命中当前选中障碍物的某个 handle
   * @param {{x,y}} worldPoint
   * @returns {boolean} 是否命中
   */
  startResize(worldPoint) {
    // 找当前选中的障碍物
    const obs = this._getSelectedObstacle()
    if (!obs) return false

    const handles = this.getHandles(obs)
    for (const h of handles) {
      if (MathUtils.dist(worldPoint, h) <= HIT_R) {
        this._isResizing = true
        this._resizeObs = obs
        this._handleType = h.type
        this._handleIdx = h.idx
        return true
      }
    }
    return false
  }

  /**
   * 更新障碍物尺寸（mousemove 时调用）
   * @param {{x,y}} worldPoint
   */
  resize(worldPoint) {
    if (!this._isResizing || !this._resizeObs) return
    const obs = this._resizeObs

    switch (this._handleType) {
      case 'radius':
        this._resizeCircle(obs, worldPoint)
        break
      case 'corner':
        this._resizeRect(obs, worldPoint, this._handleIdx)
        break
      case 'vertex':
        this._resizePolygon(obs, worldPoint, this._handleIdx)
        break
    }
  }

  /**
   * 结束缩放，通知仿真
   */
  endResize() {
    if (!this._isResizing) return
    this._lightSim?.markDirty()
    if (this._resizeObs) {
      EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: this._resizeObs })
    }
    this._isResizing = false
    this._resizeObs = null
    this._handleType = null
    this._handleIdx = null
  }

  /**
   * 返回障碍物的所有 handle 坐标（世界坐标）
   * @param {BaseObstacle} obs
   * @returns {{x,y,type,idx}[]}
   */
  getHandles(obs) {
    switch (obs.type) {
      case 'circle':
        return this._circleHandles(obs)
      case 'rect':
        return this._rectHandles(obs)
      case 'polygon':
        return this._polygonHandles(obs)
      default:
        return []
    }
  }

  // ─── 私有：各类型 handle 坐标 ──────────────────────────────

  _circleHandles(obs) {
    return [{
      x: obs.position.x + obs.radius,
      y: obs.position.y,
      type: 'radius',
      idx: 0,
    }]
  }

  _rectHandles(obs) {
    // 取 getWorldVertices 四个角（含旋转）
    const verts = obs.getWorldVertices()
    return verts.map((v, i) => ({ x: v.x, y: v.y, type: 'corner', idx: i }))
  }

  _polygonHandles(obs) {
    return obs.getWorldVertices().map((v, i) => ({
      x: v.x, y: v.y, type: 'vertex', idx: i,
    }))
  }

  // ─── 私有：各类型 resize 逻辑 ──────────────────────────────

  _resizeCircle(obs, mouse) {
    const r = MathUtils.dist(mouse, obs.position)
    obs.radius = Math.max(MIN_SIZE, r)
    obs.markDirty?.()
  }

  _resizeRect(obs, mouse, cornerIdx) {
    // 将鼠标映射到矩形局部坐标系（取消旋转）
    const dx = mouse.x - obs.position.x
    const dy = mouse.y - obs.position.y
    const local = MathUtils.rotatePoint({ x: dx, y: dy }, -obs.rotation)

    // cornerIdx 0=NW(-x,-y), 1=NE(+x,-y), 2=SE(+x,+y), 3=SW(-x,+y)
    // 拖拽某角时，该角的局部坐标即为 ±halfW / ±halfH
    const absX = Math.max(MIN_SIZE / 2, Math.abs(local.x))
    const absY = Math.max(MIN_SIZE / 2, Math.abs(local.y))

    const newW = absX * 2
    const newH = absY * 2

    // 锁定对角（世界坐标）
    const diagIdx = (cornerIdx + 2) % 4
    const verts = obs.getWorldVertices()
    const anchor = { x: verts[diagIdx].x, y: verts[diagIdx].y }

    // 新中心 = anchor + 旋转后的 (±halfW, ±halfH) 偏移
    // 对角相对新中心的局部坐标与当前角符号相反
    const diagLocal = MathUtils.rotatePoint({ x: verts[diagIdx].x - obs.position.x, y: verts[diagIdx].y - obs.position.y }, -obs.rotation)
    const signX = diagLocal.x > 0 ? 1 : -1
    const signY = diagLocal.y > 0 ? 1 : -1
    const newCenterLocal = { x: signX * absX, y: signY * absY }
    // 新中心局部坐标 = diagLocal方向 * halfSize, 新中心世界坐标 = anchor - rotated(newCenterLocal)
    // 实际上：新中心 = anchor - rotated(diagLocal符号 * halfNew)
    const centerOffset = MathUtils.rotatePoint(newCenterLocal, obs.rotation)
    obs.position.x = anchor.x - centerOffset.x
    obs.position.y = anchor.y - centerOffset.y
    obs.width = newW
    obs.height = newH
    obs.markDirty?.()
  }

  _resizePolygon(obs, mouse, vertIdx) {
    // 将鼠标世界坐标反变换为局部坐标
    const dx = mouse.x - obs.position.x
    const dy = mouse.y - obs.position.y
    const local = MathUtils.rotatePoint({ x: dx, y: dy }, -obs.rotation)
    obs._vertices[vertIdx] = local
    obs.markDirty?.()
  }

  // ─── 获取当前选中的障碍物 ──────────────────────────────────

  _getSelectedObstacle() {
    for (const obs of this._scene.obstacles) {
      if (obs.selected) return obs
    }
    return null
  }
}
