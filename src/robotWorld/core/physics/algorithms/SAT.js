/**
 * SAT — 分离轴定理碰撞检测算法
 * 支持：多边形/多边形、圆形/多边形、圆形/圆形
 */
export class SAT {
  /**
   * 多边形 vs 多边形
   * @param {PolygonObstacle|Robot} polyA
   * @param {PolygonObstacle} polyB
   * @returns {{ colliding, normal, penetrationDepth }|null}
   */
  static polyVsPoly(polyA, polyB) {
    const vertsA = polyA.getWorldVertices()
    const vertsB = polyB.getWorldVertices()

    let minOverlap = Infinity
    let smallestAxis = null

    const axes = [
      ...SAT._getAxes(vertsA),
      ...SAT._getAxes(vertsB),
    ]

    for (const axis of axes) {
      const projA = SAT._project(vertsA, axis)
      const projB = SAT._project(vertsB, axis)
      const overlap = SAT._getOverlap(projA, projB)

      if (overlap <= 0) return null  // 找到分离轴，无碰撞

      if (overlap < minOverlap) {
        minOverlap = overlap
        smallestAxis = axis
      }
    }

    // 确保法向量从 A 指向 B
    const dx = polyB.position.x - polyA.position.x
    const dy = polyB.position.y - polyA.position.y
    if (dx * smallestAxis.x + dy * smallestAxis.y < 0) {
      smallestAxis = { x: -smallestAxis.x, y: -smallestAxis.y }
    }

    return {
      colliding: true,
      normal: smallestAxis,
      penetrationDepth: minOverlap,
    }
  }

  /**
   * 圆形 vs 多边形
   * @param {{ position:{x,y}, radius:number, getWorldVertices?:Function }} circle
   * @param {{ getWorldVertices:Function, position:{x,y} }} poly
   * @returns {{ colliding, normal, penetrationDepth }|null}
   */
  static circleVsPoly(circle, poly) {
    const verts = poly.getWorldVertices?.() || []
    if (!verts.length) return null
    const { x: cx, y: cy } = circle.position
    const r = circle.radius

    let minOverlap = Infinity
    let smallestAxis = null

    const axes = SAT._getAxes(verts)

    // 添加从圆心到最近顶点的轴
    let minDistSq = Infinity
    let closestVert = null
    for (const v of verts) {
      const dx = cx - v.x, dy = cy - v.y
      const dSq = dx * dx + dy * dy
      if (dSq < minDistSq) { minDistSq = dSq; closestVert = v }
    }
    if (closestVert) {
      const dx = cx - closestVert.x, dy = cy - closestVert.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) axes.push({ x: dx / len, y: dy / len })
    }

    for (const axis of axes) {
      const centerProj = cx * axis.x + cy * axis.y
      const projCircle = { min: centerProj - r, max: centerProj + r }
      const projPoly = SAT._project(verts, axis)
      const overlap = SAT._getOverlap(projCircle, projPoly)

      if (overlap <= 0) return null

      if (overlap < minOverlap) {
        minOverlap = overlap
        smallestAxis = axis
      }
    }

    // 确保法向量从多边形指向圆心
    const polyCenter = SAT._centroid(verts)
    const dx = cx - polyCenter.x
    const dy = cy - polyCenter.y
    if (dx * smallestAxis.x + dy * smallestAxis.y < 0) {
      smallestAxis = { x: -smallestAxis.x, y: -smallestAxis.y }
    }

    return {
      colliding: true,
      normal: smallestAxis,
      penetrationDepth: minOverlap,
    }
  }

  /**
   * 圆形 vs 圆形
   */
  static circleVsCircle(circleA, circleB) {
    const dx = circleB.position.x - circleA.position.x
    const dy = circleB.position.y - circleA.position.y
    const distSq = dx * dx + dy * dy
    const sumR = circleA.radius + circleB.radius

    if (distSq >= sumR * sumR) return null

    const dist = Math.sqrt(distSq) || 0.001
    return {
      colliding: true,
      normal: { x: dx / dist, y: dy / dist },
      penetrationDepth: sumR - dist,
    }
  }

  // ─── 内部工具 ──────────────────────────────────────

  static _getAxes(vertices) {
    return vertices.map((v, i) => {
      const next = vertices[(i + 1) % vertices.length]
      const edgeX = next.x - v.x
      const edgeY = next.y - v.y
      const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY) || 1
      return { x: -edgeY / len, y: edgeX / len }
    })
  }

  static _project(vertices, axis) {
    let min = Infinity, max = -Infinity
    for (const v of vertices) {
      const proj = v.x * axis.x + v.y * axis.y
      if (proj < min) min = proj
      if (proj > max) max = proj
    }
    return { min, max }
  }

  static _getOverlap(projA, projB) {
    return Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min)
  }

  static _centroid(vertices) {
    const sum = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 })
    return { x: sum.x / vertices.length, y: sum.y / vertices.length }
  }
}
