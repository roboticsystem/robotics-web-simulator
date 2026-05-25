/**
 * BackgroundLayer — 渲染背景、网格线、世界边界
 */
export class BackgroundLayer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} world - { width, height, backgroundColor, borderColor, borderWidth }
   */
  render(ctx, world) {
    const { width, height, backgroundColor, borderColor, borderWidth } = world

    // 背景填充
    ctx.fillStyle = backgroundColor || '#1a1a2e'
    ctx.fillRect(0, 0, width, height)

    // 网格线（轻量，仅在一定缩放级别显示）
    this._renderGrid(ctx, width, height)

    // 世界边界矩形
    ctx.strokeStyle = borderColor || '#4a90e2'
    ctx.lineWidth = borderWidth || 2
    ctx.strokeRect(0, 0, width, height)
  }

  _renderGrid(ctx, width, height) {
    const step = 50
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.beginPath()

    for (let x = step; x < width; x += step) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    for (let y = step; y < height; y += step) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
  }
}
