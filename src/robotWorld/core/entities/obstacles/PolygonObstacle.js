import { BaseObstacle } from './BaseObstacle'
import { MathUtils } from '@utils/MathUtils'

/**
 * PolygonObstacle — 多边形障碍物
 * vertices 存储相对质心的本地坐标
 */
export class PolygonObstacle extends BaseObstacle {
  constructor(config) {
    super({ type: 'polygon', ...config })
    // 本地顶点（相对于 position）
    this._vertices = config.vertices
      ? config.vertices.map(v => ({ x: v.x, y: v.y }))
      : PolygonObstacle._defaultVertices()
  }

  static _defaultVertices() {
    // 默认：正六边形，半径 30
    const r = 30
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2
      return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    })
  }

  get vertices() { return this._vertices }

  /**
   * 获取世界坐标顶点（应用 position + rotation）
   * @returns {{x,y}[]}
   */
  getWorldVertices() {
    return this._vertices.map(v => {
      const rotated = MathUtils.rotatePoint(v, this.rotation)
      return {
        x: rotated.x + this.position.x,
        y: rotated.y + this.position.y,
      }
    })
  }

  /**
   * 获取轮廓线段（用于光线追踪）
   * @returns {[[{x,y},{x,y}]]}
   */
  getSegments() {
    const verts = this.getWorldVertices()
    return verts.map((v, i) => [v, verts[(i + 1) % verts.length]])
  }

  getAABB() {
    const verts = this.getWorldVertices()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const v of verts) {
      if (v.x < minX) minX = v.x
      if (v.y < minY) minY = v.y
      if (v.x > maxX) maxX = v.x
      if (v.y > maxY) maxY = v.y
    }
    return { minX, minY, maxX, maxY }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      vertices: this._vertices.map(v => ({ ...v })),
    }
  }

  fromJSON(data) {
    super.fromJSON(data)
    if (data.vertices) {
      this._vertices = data.vertices.map(v => ({ x: v.x, y: v.y }))
    }
  }
}
