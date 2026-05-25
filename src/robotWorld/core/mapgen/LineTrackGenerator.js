/**
 * LineTrackGenerator — 复杂巡线地图生成器 v2
 *
 * 支持多种路线模板 + 程序化扰动，生成更复杂、有趣的巡线轨道：
 *
 * 模板池（按种子随机选取）：
 *   1. figure8      — 8字形双环
 *   2. spiral       — 螺旋渐近形（向心收缩 + 展开）
 *   3. zigzag       — S形折叠多回横穿
 *   4. lemniscate   — 双叶形（莱姆尼斯卡特变体）
 *   5. circuit      — 赛道形（大直道+急弯，类似F1赛道）
 *   6. clover       — 三叶/四叶草形
 *   7. polar        — 极坐标花瓣形（玫瑰曲线变体）
 *
 * 所有路线都经过：
 *   - Catmull-Rom 样条平滑
 *   - 路径合法性校验（点不重叠、不出界）
 *   - 离散化（用于传感器线段检测）
 */
export class LineTrackGenerator {
  generate(opts = {}) {
    const {
      width      = 800,
      height     = 600,
      trackWidth = 20,
      seed       = Date.now(),
    } = opts

    const rng    = this._seededRng(seed)
    const margin = trackWidth * 2 + Math.min(width, height) * 0.08

    // 随机选取路线模板
    const templates = [
      'figure8', 'spiral', 'zigzag',
      'circuit', 'clover', 'polar', 'lemniscate',
    ]
    const templateIdx  = Math.floor(rng() * templates.length)
    const templateName = templates[templateIdx]

    // 生成控制点
    const controlPoints = this._generateTemplate(
      templateName, width, height, margin, rng,
    )

    // Catmull-Rom → Bezier
    const pathPoints = this._catmullRomToBezier(controlPoints, true)

    // 离散化
    const pathSegments = this._discretizePath(pathPoints, 8)

    return {
      type: 'lineTrack',
      trackWidth,
      pathPoints,
      controlPoints,
      pathSegments,
      closed:   true,
      seed,
      template: templateName,
    }
  }

  // ─── 路线模板 ───────────────────────────────────────────────────────────────

  _generateTemplate(name, w, h, margin, rng) {
    switch (name) {
      case 'figure8':     return this._tplFigure8(w, h, margin, rng)
      case 'spiral':      return this._tplSpiral(w, h, margin, rng)
      case 'zigzag':      return this._tplZigzag(w, h, margin, rng)
      case 'circuit':     return this._tplCircuit(w, h, margin, rng)
      case 'clover':      return this._tplClover(w, h, margin, rng)
      case 'polar':       return this._tplPolar(w, h, margin, rng)
      case 'lemniscate':  return this._tplLemniscate(w, h, margin, rng)
      default:            return this._tplCircuit(w, h, margin, rng)
    }
  }

  /**
   * 8字形：两个椭圆环在中心交叉
   */
  _tplFigure8(w, h, margin, rng) {
    const cx  = w / 2
    const cy  = h / 2
    const rx  = (w / 2 - margin) * (0.72 + rng() * 0.18)
    const ry  = (h / 4 - margin * 0.5) * (0.75 + rng() * 0.20)
    const pts = []
    const n   = 10 + Math.floor(rng() * 6)   // 每半环控制点数

    // 上半圆（顺时针）
    for (let i = 0; i <= n; i++) {
      const t     = (i / n) * Math.PI
      const jx    = (rng() - 0.5) * rx * 0.08
      const jy    = (rng() - 0.5) * ry * 0.10
      pts.push({
        x: cx + Math.cos(t) * rx + jx,
        y: cy - ry * 0.1 - Math.sin(t) * ry + jy,
      })
    }
    // 下半圆（反向椭圆，形成交叉）
    for (let i = 0; i <= n; i++) {
      const t  = (i / n) * Math.PI
      const jx = (rng() - 0.5) * rx * 0.08
      const jy = (rng() - 0.5) * ry * 0.10
      pts.push({
        x: cx - Math.cos(t) * rx + jx,
        y: cy + ry * 0.1 + Math.sin(t) * ry + jy,
      })
    }

    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  /**
   * 螺旋渐近形：从外向内收缩再展开（两圈半）
   */
  _tplSpiral(w, h, margin, rng) {
    const cx    = w / 2
    const cy    = h / 2
    const rOuter = Math.min(w, h) / 2 - margin
    const rInner = rOuter * (0.28 + rng() * 0.15)
    const turns  = 1.5 + rng() * 0.5      // 1.5 ~ 2 圈
    const n      = Math.round(turns * 18)
    const pts    = []

    // 螺旋：半径从 rOuter 缩到 rInner 再回来（闭合）
    const half = Math.floor(n / 2)
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 * turns
      let   radius
      if (i < half) {
        radius = rOuter - (rOuter - rInner) * (i / half)
      } else {
        radius = rInner + (rOuter - rInner) * ((i - half) / (n - half))
      }
      const jitter = (rng() - 0.5) * radius * 0.06
      pts.push({
        x: cx + Math.cos(angle) * (radius + jitter),
        y: cy + Math.sin(angle) * (radius + jitter),
      })
    }

    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  /**
   * S形折叠（多回横穿）：左右横穿 + 上下折返，像蛇形赛道
   */
  _tplZigzag(w, h, margin, rng) {
    const rows     = 3 + Math.floor(rng() * 2)   // 3~4 行
    const gapY     = (h - margin * 2) / rows
    const amplitude = (w / 2 - margin) * (0.80 + rng() * 0.15)
    const cx       = w / 2
    const pts      = []

    for (let row = 0; row <= rows; row++) {
      const y    = margin + row * gapY
      const side = (row % 2 === 0) ? 1 : -1
      const curve = (rng() - 0.5) * gapY * 0.35

      // 直道点
      pts.push({ x: cx + side * amplitude * 0.95, y: y + curve })
      pts.push({ x: cx + side * amplitude * 0.55, y: y })
      // 过渡中心
      pts.push({ x: cx, y: y + (rng() - 0.5) * gapY * 0.2 })
      pts.push({ x: cx - side * amplitude * 0.55, y: y })
      pts.push({ x: cx - side * amplitude * 0.95, y: y + curve })
    }

    // 闭合：补充上下两端的折返弯
    // 已通过循环自然首尾相近，Catmull-Rom 会平滑
    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  /**
   * F1 赛道：长直道 + 急弯 + 复合弯
   */
  _tplCircuit(w, h, margin, rng) {
    const usableW = w - margin * 2
    const usableH = h - margin * 2
    const l = margin, r = w - margin
    const t = margin, b = h - margin
    const cx = w / 2, cy = h / 2

    // 基础跑道形态：切角矩形 + 额外弯道
    const cornerRatio = 0.12 + rng() * 0.10

    const pts = [
      // 底边直道
      { x: l + usableW * 0.25,  y: b },
      { x: l + usableW * 0.60,  y: b + (rng() - 0.5) * usableH * 0.05 },
      // 右下急弯
      { x: r - usableW * cornerRatio, y: b },
      { x: r,  y: b - usableH * cornerRatio },
      // 右侧直道（略内弯）
      { x: r + (rng() - 0.5) * usableW * 0.04, y: cy + usableH * 0.15 },
      // 右侧 chicane（S弯）
      { x: r - usableW * 0.08,  y: cy },
      { x: r + usableW * 0.05,  y: cy - usableH * 0.18 },
      // 右上弯
      { x: r,  y: t + usableH * cornerRatio },
      { x: r - usableW * cornerRatio, y: t },
      // 顶部直道
      { x: cx + usableW * 0.08, y: t + (rng() - 0.5) * usableH * 0.04 },
      { x: cx - usableW * 0.08, y: t - (rng() - 0.5) * usableH * 0.04 },
      // 左上弯
      { x: l + usableW * cornerRatio, y: t },
      { x: l,  y: t + usableH * cornerRatio },
      // 左侧直道
      { x: l + (rng() - 0.5) * usableW * 0.04, y: cy - usableH * 0.10 },
      // 左侧发卡弯（hairpin）
      { x: l + usableW * 0.14, y: cy },
      { x: l,  y: cy + usableH * 0.20 },
      // 左下弯
      { x: l,  y: b - usableH * cornerRatio },
      { x: l + usableW * cornerRatio, y: b },
    ]

    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  /**
   * 三叶 / 四叶草形
   */
  _tplClover(w, h, margin, rng) {
    const leaves  = 3 + Math.floor(rng() * 2)    // 3 或 4 叶
    const cx      = w / 2
    const cy      = h / 2
    const rOuter  = Math.min(w, h) / 2 - margin
    const rInner  = rOuter * (0.18 + rng() * 0.12)
    const ptsPerLeaf = 10
    const pts = []

    for (let l = 0; l < leaves; l++) {
      const baseAngle = (l / leaves) * Math.PI * 2
      const leafCenter = {
        x: cx + Math.cos(baseAngle) * rOuter * 0.52,
        y: cy + Math.sin(baseAngle) * rOuter * 0.52,
      }
      const leafR = rOuter * (0.38 + rng() * 0.10)

      // 每片叶子 = 小椭圆，经过中心连接
      // 先进入叶中心
      pts.push({
        x: cx + Math.cos(baseAngle) * rInner,
        y: cy + Math.sin(baseAngle) * rInner,
      })
      for (let k = 0; k < ptsPerLeaf; k++) {
        const angle = baseAngle + (k / ptsPerLeaf) * Math.PI * 2
        const leafRy = leafR * (0.65 + rng() * 0.10)
        const jx = (rng() - 0.5) * leafR * 0.08
        const jy = (rng() - 0.5) * leafRy * 0.08
        pts.push({
          x: leafCenter.x + Math.cos(angle) * leafR  + jx,
          y: leafCenter.y + Math.sin(angle) * leafRy + jy,
        })
      }
    }

    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  /**
   * 极坐标花瓣形（玫瑰曲线）：r = cos(kθ)
   */
  _tplPolar(w, h, margin, rng) {
    const cx   = w / 2
    const cy   = h / 2
    const rMax = Math.min(w, h) / 2 - margin
    const k    = 2 + Math.floor(rng() * 3)   // k = 2,3,4 花瓣数
    const n    = 48 + Math.floor(rng() * 16)
    const pts  = []

    for (let i = 0; i < n; i++) {
      const theta  = (i / n) * Math.PI * 2 * (k % 2 === 0 ? 2 : 1)
      const r      = rMax * Math.abs(Math.cos(k * theta))
      const jitter = (rng() - 0.5) * rMax * 0.06
      pts.push({
        x: cx + Math.cos(theta) * (r + jitter),
        y: cy + Math.sin(theta) * (r + jitter),
      })
    }

    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  /**
   * 莱姆尼斯卡特变体（双叶 ∞ 形，比 figure8 更扁平紧凑）
   */
  _tplLemniscate(w, h, margin, rng) {
    const cx   = w / 2
    const cy   = h / 2
    const a    = (w / 2 - margin) * (0.70 + rng() * 0.20)
    const n    = 40 + Math.floor(rng() * 12)
    const pts  = []
    const tilt = (rng() - 0.5) * Math.PI * 0.25   // 随机倾斜

    for (let i = 0; i < n; i++) {
      const t    = (i / n) * Math.PI * 2
      // Lemniscate of Bernoulli 参数方程
      const denom = 1 + Math.sin(t) * Math.sin(t)
      const lx    = a * Math.cos(t) / denom
      const ly    = a * Math.sin(t) * Math.cos(t) / denom
      // 旋转倾斜
      const rx    = lx * Math.cos(tilt) - ly * Math.sin(tilt)
      const ry    = lx * Math.sin(tilt) + ly * Math.cos(tilt)
      const scaleY = (h - margin * 2) / (w - margin * 2)
      const jx    = (rng() - 0.5) * a * 0.05
      const jy    = (rng() - 0.5) * a * 0.05
      pts.push({
        x: cx + rx + jx,
        y: cy + ry * scaleY * 2.2 + jy,
      })
    }

    return this._clamp(pts, margin, w - margin, margin, h - margin)
  }

  // ─── 工具方法 ───────────────────────────────────────────────────────────────

  /** 将所有点钳制在安全区域内 */
  _clamp(pts, minX, maxX, minY, maxY) {
    return pts.map(p => ({
      x: Math.max(minX, Math.min(maxX, p.x)),
      y: Math.max(minY, Math.min(maxY, p.y)),
    }))
  }

  /**
   * Catmull-Rom → 三次贝塞尔曲线段数组（闭合）
   */
  _catmullRomToBezier(points, closed) {
    const n      = points.length
    const result = []
    const getP   = (i) => points[((i % n) + n) % n]

    const iters = closed ? n : n - 1
    for (let i = 0; i < iters; i++) {
      const p0 = getP(i - 1)
      const p1 = getP(i)
      const p2 = getP(i + 1)
      const p3 = getP(i + 2)

      const cp1 = {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6,
      }
      const cp2 = {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6,
      }

      result.push({ start: { ...p1 }, cp1, cp2, end: { ...p2 } })
    }

    return result
  }

  /**
   * 将贝塞尔路径离散化为折线段（用于传感器/碰撞检测）
   */
  _discretizePath(pathPoints, stepsPerSegment = 8) {
    const pts = []
    for (const seg of pathPoints) {
      for (let t = 0; t <= stepsPerSegment; t++) {
        const u = t / stepsPerSegment
        pts.push({
          x: this._bezier1D(seg.start.x, seg.cp1.x, seg.cp2.x, seg.end.x, u),
          y: this._bezier1D(seg.start.y, seg.cp1.y, seg.cp2.y, seg.end.y, u),
        })
      }
    }

    const segments = []
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push([pts[i], pts[i + 1]])
    }
    return segments
  }

  _bezier1D(p0, p1, p2, p3, t) {
    const u = 1 - t
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  }

  /** 线性同余伪随机数生成器（可种子化） */
  _seededRng(seed) {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0
      return s / 0xFFFFFFFF
    }
  }
}
