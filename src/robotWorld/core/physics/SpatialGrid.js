/**
 * SpatialGrid — 空间哈希网格（宽相位优化）
 * 将场景分割为固定尺寸格子，快速筛选可能碰撞的实体对
 */
export class SpatialGrid {
  /**
   * @param {number} cellSize - 格子大小（应略大于最大实体半径）
   */
  constructor(cellSize = 80) {
    this.cellSize = cellSize
    /** @type {Map<string, Set>} */
    this._grid = new Map()
  }

  clear() {
    this._grid.clear()
  }

  /**
   * 将实体插入所有覆盖的格子
   */
  insert(entity) {
    for (const key of this._getCellKeys(entity)) {
      if (!this._grid.has(key)) this._grid.set(key, new Set())
      this._grid.get(key).add(entity)
    }
  }

  /**
   * 查询与 entity 可能碰撞的候选实体集合
   * @returns {Set}
   */
  queryNear(entity) {
    const candidates = new Set()
    for (const key of this._getCellKeys(entity)) {
      const cell = this._grid.get(key)
      if (cell) {
        for (const other of cell) {
          if (other !== entity) candidates.add(other)
        }
      }
    }
    return candidates
  }

  _getCellKeys(entity) {
    const aabb = entity.getAABB()
    const keys = []
    const x0 = Math.floor(aabb.minX / this.cellSize)
    const x1 = Math.floor(aabb.maxX / this.cellSize)
    const y0 = Math.floor(aabb.minY / this.cellSize)
    const y1 = Math.floor(aabb.maxY / this.cellSize)
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        keys.push(`${x},${y}`)
      }
    }
    return keys
  }
}
