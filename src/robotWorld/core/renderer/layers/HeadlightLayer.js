/**
 * HeadlightLayer — 车灯光锥渲染层
 *
 * 接收由 WorldEngine._computeHeadlights() 计算好的可见多边形数组，
 * 每个多边形是一个扇形（已被障碍物遮挡裁剪），用径向渐变填充，
 * 呈现从灯体向前扩散、被墙/障碍物截断的真实车灯效果。
 *
 * 渲染管线：
 *   ctx.clip(世界边界)
 *   → 对每个光锥多边形 ctx.clip(polygon)
 *   → fillRect 铺径向渐变
 *   → restore
 */
export class HeadlightLayer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x,y}[][]} headlightData  - 光锥多边形数组（左/右各一个）
   * @param {{width,height}} world     - 世界边界（用于裁剪）
   */
  render(ctx, headlightData, world) {
    if (!headlightData || headlightData.length === 0) return

    ctx.save()

    // 裁剪到世界边界
    ctx.beginPath()
    ctx.rect(0, 0, world.width, world.height)
    ctx.clip()

    for (const poly of headlightData) {
      if (!poly || poly.length < 3) continue

      const origin = poly[0]   // 第一个点是灯体位置（射线原点）

      ctx.save()

      // 用多边形裁剪光锥区域
      ctx.beginPath()
      ctx.moveTo(poly[0].x, poly[0].y)
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y)
      }
      ctx.closePath()
      ctx.clip()

      // 确定径向渐变范围（估算最大射线距离）
      let maxDist = 0
      for (let i = 1; i < poly.length; i++) {
        const dx = poly[i].x - origin.x
        const dy = poly[i].y - origin.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > maxDist) maxDist = d
      }
      if (maxDist < 1) { ctx.restore(); continue }

      // 径向渐变：灯体中心 → 最远点
      const grad = ctx.createRadialGradient(
        origin.x, origin.y, 0,
        origin.x, origin.y, maxDist,
      )
      grad.addColorStop(0,    'rgba(255, 252, 200, 0.72)')   // 中心：暖白强光
      grad.addColorStop(0.08, 'rgba(255, 248, 180, 0.55)')
      grad.addColorStop(0.25, 'rgba(255, 240, 140, 0.30)')
      grad.addColorStop(0.55, 'rgba(255, 230, 100, 0.10)')
      grad.addColorStop(1,    'rgba(255, 220,  80, 0.00)')   // 边缘：完全透明

      ctx.fillStyle = grad

      // 填充整个裁剪区域（用覆盖世界的矩形触发渐变）
      ctx.fillRect(0, 0, world.width, world.height)

      ctx.restore()
    }

    ctx.restore()
  }
}
