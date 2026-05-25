/**
 * TrailLayer — 机器人运动轨迹拖尾
 * trailBuffer: [{x, y}]  索引0=最新，199=最旧
 * trailColor: 机器人颜色字符串（如 '#1e90ff'）
 */
export class TrailLayer {
  render(ctx, trailBuffer, trailColor) {
    if (!trailBuffer || trailBuffer.length < 2) return

    ctx.save()
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'

    // 将 hex/rgb 颜色解析为 r,g,b
    const [cr, cg, cb] = _parseColor(trailColor)

    // 每段10个点，分段绘制（从最旧到最新，覆盖最新在上）
    const SEGMENT = 10
    const total   = trailBuffer.length

    for (let start = total - SEGMENT; start >= 0; start -= SEGMENT) {
      const end  = Math.min(start + SEGMENT, total - 1)
      // age = 0(最新) ~ 1(最旧)
      const age  = start / total
      const alpha = (1 - age) * 0.55
      const lw    = 2.5 * (1 - age) + 0.5

      ctx.beginPath()
      ctx.moveTo(trailBuffer[end].x, trailBuffer[end].y)
      for (let i = end - 1; i >= start; i--) {
        ctx.lineTo(trailBuffer[i].x, trailBuffer[i].y)
      }
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`
      ctx.lineWidth   = lw
      ctx.stroke()
    }

    ctx.restore()
  }
}

function _parseColor(color) {
  if (!color) return [79, 195, 247]
  // hex #rrggbb 或 #rgb
  const hex = color.replace('#', '')
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ]
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  return [79, 195, 247]
}
