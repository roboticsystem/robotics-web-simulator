/**
 * GridMapGenerator — 栅格障碍物地图生成器 v2
 *
 * 支持三种模式：
 *  - sparse   : 随机概率分布（混合形状障碍物）
 *  - maze     : 真正的墙壁迷宫（每条墙是薄矩形，通道清晰可行走）
 *              算法：递归 DFS 打通隔墙 + Sidewinder 变体混合，
 *              保证：① 每个格子可达（完美迷宫）② 有足够宽的通道供小车通过
 *  - clusters : 簇状分布（混合形状）
 *
 * 迷宫优化要点：
 *  - 障碍物是"墙段"而非"填满格"：每条墙只占格子边缘的薄矩形
 *  - 通道宽度 = 格子尺寸 - 2×wallThickness，小车可安全通过
 *  - 额外随机移除 15~25% 的墙，增加路径多样性（非完美迷宫变体）
 *  - 迷宫外围保留完整边界墙（由世界边界充当，不额外生成）
 *  - 生成起点在角落附近，保留 1 格安全区
 */
export class GridMapGenerator {
  generate(opts = {}) {
    const {
      width          = 800,
      height         = 600,
      gridCols       = 10,
      gridRows       = 8,
      type           = 'sparse',
      obstacleRatio  = 0.25,
      dynamicRatio   = 0,
      obstacleSize   = null,
      robotStartCell = { col: 0, row: 0 },
      seed           = Date.now(),
    } = opts

    const rng   = this._seededRng(seed)
    const cellW = width  / gridCols
    const cellH = height / gridRows
    const obsSize = obstacleSize || Math.min(cellW, cellH) * 0.7

    let obstacles = []

    switch (type) {
      case 'maze':
        obstacles = this._generateMaze(
          gridCols, gridRows, cellW, cellH, width, height, robotStartCell, rng,
        )
        break
      case 'clusters':
        obstacles = this._generateClusters(
          gridCols, gridRows, cellW, cellH, obstacleRatio, obsSize, rng, robotStartCell,
        )
        break
      default:
        obstacles = this._generateSparse(
          gridCols, gridRows, cellW, cellH, obstacleRatio, obsSize, robotStartCell, rng,
        )
    }

    // 为 sparse/clusters 模式中部分矩形障碍物添加动态运动参数
    const dynamicMotions = []
    if (type !== 'maze' && dynamicRatio > 0) {
      const rects = obstacles.filter(o => o.type === 'rect')
      for (const obs of rects) {
        if (rng() < dynamicRatio) {
          const axis  = rng() < 0.5 ? 'x' : 'y'
          const range = (axis === 'x' ? cellW : cellH) * (0.8 + rng() * 0.8)
          const speed = 30 + rng() * 50   // px/s
          dynamicMotions.push({
            id:     obs.id,
            axis,
            origin: { x: obs.position.x, y: obs.position.y },
            range,
            speed,
            phase:  rng() * Math.PI * 2,  // 随机初相，各障碍不同步
          })
        }
      }
    }

    return {
      type: 'gridMap',
      mapType: type,
      gridCols,
      gridRows,
      cellW,
      cellH,
      obstacles,
      robotStart: {
        x: (robotStartCell.col + 0.5) * cellW,
        y: (robotStartCell.row + 0.5) * cellH,
      },
      // exitCell 仅迷宫模式下有值，其余模式为 null
      exitCell:  obstacles._exitCell  ?? null,
      exitPos:   obstacles._exitPos   ?? null,
      gridGraph: obstacles._gridGraph ?? null,   // 仅 maze 类型有值
      dynamicMotions,
      seed,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 迷宫生成（真正的墙壁式）
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 生成墙壁式迷宫
   *
   * 数据结构：
   *   hWalls[r][c] = true → 格子 (c,r) 与 (c, r+1) 之间有一条水平墙（下边）
   *   vWalls[r][c] = true → 格子 (c,r) 与 (c+1, r) 之间有一条垂直墙（右边）
   *
   * 算法：随机 DFS（递归回溯），访问每格时拆除隔墙 → 完美迷宫
   * 之后随机拆除额外 20% 的墙，使迷宫有多条路径，更适合小车游走。
   */
  _generateMaze(cols, rows, cellW, cellH, worldW, worldH, startCell, rng) {
    // 1. 初始化：所有内部墙都存在
    //    hWalls[r][c]: 行 r 与 行 r+1 之间，列 c 的水平墙（共 rows-1 行 × cols 列）
    //    vWalls[r][c]: 列 c 与 列 c+1 之间，行 r 的垂直墙（共 rows 行 × cols-1 列）
    const hWalls = Array.from({ length: rows - 1 }, () => new Array(cols).fill(true))
    const vWalls = Array.from({ length: rows },     () => new Array(cols - 1).fill(true))

    // 2. DFS 打通隔墙
    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false))
    const dfs = (c, r) => {
      visited[r][c] = true
      const dirs = this._shuffle([[0, -1], [0, 1], [-1, 0], [1, 0]], rng)
      for (const [dc, dr] of dirs) {
        const nc = c + dc, nr = r + dr
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
        if (visited[nr][nc]) continue
        // 拆除两格之间的墙
        if (dr === 1)  hWalls[r][c]    = false   // 下墙
        if (dr === -1) hWalls[r - 1][c] = false   // 上墙（即 r-1 行的下墙）
        if (dc === 1)  vWalls[r][c]    = false   // 右墙
        if (dc === -1) vWalls[r][c - 1] = false   // 左墙
        dfs(nc, nr)
      }
    }
    dfs(startCell.col, startCell.row)

    // 3. 随机额外拆墙（20%），增加回路
    const extraRemove = 0.20
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        if (hWalls[r][c] && rng() < extraRemove) hWalls[r][c] = false
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        if (vWalls[r][c] && rng() < extraRemove) vWalls[r][c] = false
      }
    }

    // 4. 将保留的墙转换为矩形障碍物
    //    墙厚度：格子尺寸的 10%（保证通道够宽）
    const wallT = Math.min(cellW, cellH) * 0.10
    const wallColor = this._mazeWallColor(rng)
    const obstacles = []
    let idx = 0

    // 水平墙（位于两行之间）：宽 = cellW，高 = wallT
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        if (!hWalls[r][c]) continue
        const wx = c * cellW + cellW / 2
        const wy = (r + 1) * cellH          // 位于行 r 底部 / 行 r+1 顶部
        obstacles.push(this._makeWall(
          `mh-${idx++}`, wx, wy, cellW - wallT * 0.5, wallT, 0, wallColor,
        ))
      }
    }

    // 垂直墙（位于两列之间）：宽 = wallT，高 = cellH
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        if (!vWalls[r][c]) continue
        const wx = (c + 1) * cellW           // 位于列 c 右侧 / 列 c+1 左侧
        const wy = r * cellH + cellH / 2
        obstacles.push(this._makeWall(
          `mv-${idx++}`, wx, wy, wallT, cellH - wallT * 0.5, 0, wallColor,
        ))
      }
    }

    // 5. 选定出口格：尽量选离起点最远的角落格
    const corners = [
      { col: 0,        row: 0 },
      { col: cols - 1, row: 0 },
      { col: 0,        row: rows - 1 },
      { col: cols - 1, row: rows - 1 },
    ]
    // 排除起点所在角落，选距离最远的角落
    const exitCell = corners
      .filter(p => !(p.col === startCell.col && p.row === startCell.row))
      .sort((a, b) => {
        const da = (a.col - startCell.col) ** 2 + (a.row - startCell.row) ** 2
        const db = (b.col - startCell.col) ** 2 + (b.row - startCell.row) ** 2
        return db - da
      })[0]
    const exitPos = {
      x: (exitCell.col + 0.5) * cellW,
      y: (exitCell.row + 0.5) * cellH,
    }

    // 将出口信息附到返回数组（JS 数组可携带属性）
    obstacles._exitCell = exitCell
    obstacles._exitPos  = exitPos

    // 暴露墙壁图（供路径规划算法使用）
    obstacles._gridGraph = {
      cols,
      rows,
      hWalls: hWalls.map(row => [...row]),   // 深拷贝
      vWalls: vWalls.map(row => [...row]),
    }

    return obstacles
  }

  /**
   * 迷宫墙色：科技感深色系，带随机变体
   */
  _mazeWallColor(rng) {
    const palettes = [
      // 蓝紫科技
      ['#1a2a4a', '#1e3a5f', '#162035', '#0d1a35'],
      // 深绿矩阵
      ['#0a2a1a', '#0d3520', '#112a18', '#0a2010'],
      // 深红战场
      ['#2a0a0a', '#351010', '#280808', '#200505'],
      // 灰蓝工业
      ['#1a1a2e', '#16213e', '#0f3460', '#1a1a3a'],
    ]
    const palette = palettes[Math.floor(rng() * palettes.length)]
    return palette[Math.floor(rng() * palette.length)]
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 稀疏 / 簇状（保留原逻辑）
  // ─────────────────────────────────────────────────────────────────────────

  _generateSparse(cols, rows, cellW, cellH, ratio, obsSize, startCell, rng) {
    const obstacles = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.abs(col - startCell.col) <= 1 && Math.abs(row - startCell.row) <= 1) continue
        if (rng() < ratio) {
          const cx   = col * cellW + cellW / 2 + (rng() - 0.5) * (cellW - obsSize) * 0.4
          const cy   = row * cellH + cellH / 2 + (rng() - 0.5) * (cellH - obsSize) * 0.4
          const size = obsSize * (0.6 + rng() * 0.5)
          obstacles.push(this._makeObstacle(`sparse-${col}-${row}`, cx, cy, size, rng))
        }
      }
    }
    return obstacles
  }

  _generateClusters(cols, rows, cellW, cellH, ratio, obsSize, rng, startCell) {
    const obstacles    = []
    const clusterCount = Math.floor(cols * rows * ratio / 3)

    for (let i = 0; i < clusterCount; i++) {
      const col = Math.floor(rng() * cols)
      const row = Math.floor(rng() * rows)
      if (Math.abs(col - startCell.col) <= 1 && Math.abs(row - startCell.row) <= 1) continue

      const clusterSize = 2 + Math.floor(rng() * 3)
      for (let j = 0; j < clusterSize; j++) {
        const dc  = Math.floor(rng() * 3) - 1
        const dr  = Math.floor(rng() * 3) - 1
        const nc  = Math.max(0, Math.min(cols - 1, col + dc))
        const nr  = Math.max(0, Math.min(rows - 1, row + dr))
        const cx  = nc * cellW + cellW / 2
        const cy  = nr * cellH + cellH / 2
        const size = obsSize * (0.7 + rng() * 0.4)
        obstacles.push(this._makeObstacle(`cluster-${i}-${j}`, cx, cy, size, rng))
      }
    }
    return obstacles
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 障碍物工厂
  // ─────────────────────────────────────────────────────────────────────────

  /** 迷宫专用薄墙矩形 */
  _makeWall(id, cx, cy, w, h, rotation, color) {
    return {
      id,
      type:     'rect',
      position: { x: cx, y: cy },
      width:    w,
      height:   h,
      rotation,
      color,
      opacity:  1.0,
      isStatic: true,
    }
  }

  /** 混合形状障碍物（sparse / cluster 用） */
  _makeObstacle(id, cx, cy, size, rng) {
    const roll = rng()
    if (roll < 0.4) {
      const w = size * (0.8 + rng() * 0.4)
      const h = size * (0.8 + rng() * 0.4)
      return this._makeRect(id, cx, cy, w, h, rng() * Math.PI * 0.5, rng)
    } else if (roll < 0.7) {
      return this._makeCircle(id, cx, cy, size * 0.5 * (0.7 + rng() * 0.5), rng)
    } else {
      const sides = 3 + Math.floor(rng() * 4)
      return this._makePoly(id, cx, cy, size * 0.55, sides, rng() * Math.PI * 2, rng)
    }
  }

  _makeRect(id, cx, cy, w, h, rotation, rng) {
    const COLORS = ['#2c3e50','#8e44ad','#c0392b','#16a085','#d35400','#2980b9','#34495e']
    return {
      id, type: 'rect',
      position: { x: cx, y: cy },
      width: w, height: h, rotation,
      color:    COLORS[Math.floor(rng() * COLORS.length)],
      opacity:  1.0, isStatic: true,
    }
  }

  _makeCircle(id, cx, cy, radius, rng) {
    const COLORS = ['#8e44ad','#c0392b','#e67e22','#16a085','#2980b9','#7f8c8d']
    return {
      id, type: 'circle',
      position: { x: cx, y: cy },
      radius,
      color:   COLORS[Math.floor(rng() * COLORS.length)],
      opacity: 1.0, isStatic: true,
    }
  }

  _makePoly(id, cx, cy, radius, sides, rotation, rng) {
    const COLORS = ['#8e44ad','#c0392b','#27ae60','#e67e22','#2980b9','#f39c12']
    const vertices = []
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2
      vertices.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius })
    }
    return {
      id, type: 'polygon',
      position: { x: cx, y: cy },
      rotation, vertices,
      color:   COLORS[Math.floor(rng() * COLORS.length)],
      opacity: 1.0, isStatic: true,
    }
  }

  _shuffle(arr, rng) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  _seededRng(seed) {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0
      return s / 0xFFFFFFFF
    }
  }
}
