import { MathUtils } from '@utils/MathUtils'

/**
 * LightRayTracer — 光线追踪器
 * 使用角度扫描（Visibility Polygon）算法计算光源可见区域
 */
export class LightRayTracer {
  /**
   * 计算光源可见区域多边形（O(N log N)，N = 障碍物顶点数）
   * @param {{x,y}} lightPos - 光源位置（世界坐标）
   * @param {BaseObstacle[]} obstacles - 障碍物列表
   * @param {number} maxRadius - 最大光照半径
   * @returns {{x,y}[]} 可见多边形顶点（逆时针排列）
   */
  computeVisibilityPolygon(lightPos, obstacles, maxRadius) {
    const { x: ox, y: oy } = lightPos

    // 收集所有障碍物端点 + 边界四角
    const endpoints = this._collectEndpoints(lightPos, obstacles, maxRadius)

    // 对每个端点生成 3 个角度（±ε 确保穿过顶点缝隙）
    const angles = new Set()
    for (const pt of endpoints) {
      const angle = Math.atan2(pt.y - oy, pt.x - ox)
      angles.add(angle - 0.0001)
      angles.add(angle)
      angles.add(angle + 0.0001)
    }
    // 补充 8 个方向确保完整覆盖
    for (let i = 0; i < 8; i++) {
      angles.add((i / 8) * Math.PI * 2 - Math.PI)
    }

    const sortedAngles = Array.from(angles).sort((a, b) => a - b)

    // 收集所有障碍物线段
    const allSegments = this._getAllSegments(obstacles)

    // 对每个角度投射光线，找最近交点
    const visibilityPoints = []
    for (const angle of sortedAngles) {
      const dir = { x: Math.cos(angle), y: Math.sin(angle) }
      const hit = this._castRay(lightPos, dir, allSegments, maxRadius)
      visibilityPoints.push(hit)
    }

    return visibilityPoints
  }

  /**
   * 投射单条光线，返回与最近障碍物的交点（或最大半径处）
   */
  _castRay(origin, dir, segments, maxRadius) {
    let minT = maxRadius

    for (const [a, b] of segments) {
      const t = MathUtils.raySegmentIntersect(origin, dir, a, b)
      if (t !== null && t > 1e-6 && t < minT) {
        minT = t
      }
    }

    return {
      x: origin.x + dir.x * minT,
      y: origin.y + dir.y * minT,
    }
  }

  /**
   * 收集所有障碍物的端点（用于角度扫描）
   */
  _collectEndpoints(lightPos, obstacles, maxRadius) {
    const pts = []
    const { x: ox, y: oy } = lightPos

    // 世界边界的四个角
    pts.push({ x: ox - maxRadius, y: oy - maxRadius })
    pts.push({ x: ox + maxRadius, y: oy - maxRadius })
    pts.push({ x: ox + maxRadius, y: oy + maxRadius })
    pts.push({ x: ox - maxRadius, y: oy + maxRadius })

    for (const obs of obstacles) {
      const segments = obs.getSegments?.()
      if (!segments) continue
      for (const [a, b] of segments) {
        pts.push(a, b)
      }
    }

    return pts
  }

  /**
   * 获取所有障碍物线段 + 光照范围边界框
   */
  _getAllSegments(obstacles) {
    const segs = []
    for (const obs of obstacles) {
      const obsSegs = obs.getSegments?.()
      if (obsSegs) segs.push(...obsSegs)
    }
    return segs
  }
}
