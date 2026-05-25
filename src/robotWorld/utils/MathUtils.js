/**
 * MathUtils — 2D 向量与几何数学工具集
 */
export const MathUtils = {
  /**
   * 生成 UUID v4
   */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  },

  /** 角度转弧度 */
  toRad(deg) { return deg * Math.PI / 180 },

  /** 弧度转角度 */
  toDeg(rad) { return rad * 180 / Math.PI },

  /** 将角度归一化到 [-π, π] */
  normalizeAngle(angle) {
    while (angle > Math.PI)  angle -= 2 * Math.PI
    while (angle < -Math.PI) angle += 2 * Math.PI
    return angle
  },

  /** 向量长度 */
  vecLen(v) { return Math.sqrt(v.x * v.x + v.y * v.y) },

  /** 向量归一化，零向量返回 {x:0,y:0} */
  vecNorm(v) {
    const len = MathUtils.vecLen(v)
    if (len < 1e-10) return { x: 0, y: 0 }
    return { x: v.x / len, y: v.y / len }
  },

  /** 向量加法 */
  vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y } },

  /** 向量减法 */
  vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y } },

  /** 向量标量乘 */
  vecScale(v, s) { return { x: v.x * s, y: v.y * s } },

  /** 点积 */
  vecDot(a, b) { return a.x * b.x + a.y * b.y },

  /** 叉积（2D 标量） */
  vecCross(a, b) { return a.x * b.y - a.y * b.x },

  /** 两点距离 */
  dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  },

  /** 两点距离平方（避免开方，用于比较） */
  distSq(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y
    return dx * dx + dy * dy
  },

  /** 旋转点（绕原点） */
  rotatePoint(p, angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle)
    return {
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos,
    }
  },

  /** 线性插值 */
  lerp(a, b, t) { return a + (b - a) * t },

  /** 值域钳制 */
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)) },

  /**
   * 线段与线段求交（参数化）
   * 光线 P = o + t*d (t>=0)
   * 线段 Q = a + u*(b-a) (0<=u<=1)
   * @returns {number|null} t 值，null 表示不相交
   */
  raySegmentIntersect(origin, dir, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const denom = dir.x * dy - dir.y * dx
    if (Math.abs(denom) < 1e-10) return null // 平行

    const t = ((a.x - origin.x) * dy - (a.y - origin.y) * dx) / denom
    const u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom

    if (t >= 0 && u >= 0 && u <= 1) return t
    return null
  },

  /**
   * 点是否在多边形内（射线法）
   * @param {{x,y}} point
   * @param {{x,y}[]} vertices - 多边形顶点（世界坐标）
   */
  pointInPolygon(point, vertices) {
    let inside = false
    const n = vertices.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y
      const xj = vertices[j].x, yj = vertices[j].y
      const intersect =
        (yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  },

  /**
   * 点到线段的最近距离平方
   */
  pointToSegmentDistSq(p, a, b) {
    const ab = MathUtils.vecSub(b, a)
    const ap = MathUtils.vecSub(p, a)
    const len2 = MathUtils.vecDot(ab, ab)
    if (len2 < 1e-10) return MathUtils.distSq(p, a)
    const t = MathUtils.clamp(MathUtils.vecDot(ap, ab) / len2, 0, 1)
    const closest = MathUtils.vecAdd(a, MathUtils.vecScale(ab, t))
    return MathUtils.distSq(p, closest)
  },
}
