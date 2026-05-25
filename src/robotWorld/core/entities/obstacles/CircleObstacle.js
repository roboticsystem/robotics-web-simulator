import { BaseObstacle } from './BaseObstacle'

/**
 * CircleObstacle — 圆形障碍物
 */
export class CircleObstacle extends BaseObstacle {
  constructor(config) {
    super({ type: 'circle', ...config })
    this.radius = config.radius ?? 30
  }

  getAABB() {
    const { x, y } = this.position
    return {
      minX: x - this.radius,
      minY: y - this.radius,
      maxX: x + this.radius,
      maxY: y + this.radius,
    }
  }

  /**
   * 获取用于光照遮挡的轮廓线段（圆形近似为正多边形）
   */
  getSegments(segments = 16) {
    const pts = []
    const { x, y } = this.position
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pts.push({ x: x + Math.cos(a) * this.radius, y: y + Math.sin(a) * this.radius })
    }
    const result = []
    for (let i = 0; i < pts.length; i++) {
      result.push([pts[i], pts[(i + 1) % pts.length]])
    }
    return result
  }

  /** 获取近似多边形顶点（用于 SAT 碰撞） */
  getWorldVertices(segments = 12) {
    const pts = []
    const { x, y } = this.position
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pts.push({ x: x + Math.cos(a) * this.radius, y: y + Math.sin(a) * this.radius })
    }
    return pts
  }

  toJSON() {
    return { ...super.toJSON(), radius: this.radius }
  }

  fromJSON(data) {
    super.fromJSON(data)
    if (data.radius !== undefined) this.radius = data.radius
  }
}
