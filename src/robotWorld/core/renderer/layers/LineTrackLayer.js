/**
 * LineTrackLayer — 巡线地图渲染层
 * 渲染由 LineTrackGenerator 生成的贝塞尔曲线路径
 */
export class LineTrackLayer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object|null} lineTrack - SceneManager.lineTrack
   */
  render(ctx, lineTrack) {
    if (!lineTrack || !lineTrack.pathPoints || lineTrack.pathPoints.length === 0) return

    const { pathPoints, trackWidth, closed } = lineTrack

    ctx.save()

    // 外部白色描边（路径宽度 + 边缘）
    ctx.lineWidth = trackWidth + 6
    ctx.strokeStyle = 'rgba(200,200,200,0.15)'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    this._drawPath(ctx, pathPoints, closed)
    ctx.stroke()

    // 主轨道（黑色/深色背景色模拟黑线）
    ctx.lineWidth = trackWidth
    ctx.strokeStyle = '#1a1a1a'
    this._drawPath(ctx, pathPoints, closed)
    ctx.stroke()

    // 中心线（白色，宽度更细）
    ctx.lineWidth = Math.max(1, trackWidth * 0.15)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.setLineDash([10, 15])
    this._drawPath(ctx, pathPoints, closed)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.restore()
  }

  _drawPath(ctx, pathPoints, closed) {
    ctx.beginPath()
    const first = pathPoints[0]
    ctx.moveTo(first.start.x, first.start.y)

    for (const seg of pathPoints) {
      ctx.bezierCurveTo(
        seg.cp1.x, seg.cp1.y,
        seg.cp2.x, seg.cp2.y,
        seg.end.x, seg.end.y,
      )
    }

    if (closed) ctx.closePath()
  }
}
