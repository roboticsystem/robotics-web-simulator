/**
 * ProximityLayer — 近距传感器射线可视化
 * 渲染5条射线（front / frontLeft / frontRight / left / right）
 * 颜色热色映射：近 → 红，远 → 绿
 */
export class ProximityLayer {
  render(ctx, robot) {
    if (!robot?.visible) return

    const prox = robot.sensorData?.proximity
    if (!prox) return

    // 5条射线的本地角度（相对机器人朝向）
    const RAY_ANGLES = {
      front:      0,
      frontLeft:  Math.PI / 6,    //  30°
      frontRight: -Math.PI / 6,   // -30°
      left:       Math.PI / 2,    //  90°
      right:      -Math.PI / 2,   // -90°
    }
    const MAX_DIST = 200
    const { x: ox, y: oy } = robot.position
    const rot = robot.rotation
    const r   = robot.radius

    ctx.save()

    for (const [key, localAngle] of Object.entries(RAY_ANGLES)) {
      const worldAngle = rot + localAngle
      const dx = Math.cos(worldAngle)
      const dy = Math.sin(worldAngle)

      const rawDist = prox[key] ?? Infinity
      const dist    = Math.min(rawDist, MAX_DIST)

      // 射线起点（机器人表面）
      const sx = ox + dx * r
      const sy = oy + dy * r
      // 射线终点
      const ex = ox + dx * (r + dist)
      const ey = oy + dy * (r + dist)

      // 热色映射：t=0(无障碍，绿) ~ t=1(最近，红)
      const t     = 1 - Math.min(dist, MAX_DIST) / MAX_DIST
      const hue   = 120 * (1 - t)          // 120°绿 → 0°红
      const color = `hsl(${hue.toFixed(0)},85%,55%)`

      // 射线主体（虚线）
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.setLineDash([6, 4])
      ctx.lineWidth   = 1.5
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.75
      ctx.stroke()

      // 端点圆点
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(ex, ey, 2, 0, Math.PI * 2)
      ctx.fillStyle   = color
      ctx.globalAlpha = rawDist <= MAX_DIST ? 0.90 : 0.40
      ctx.fill()
    }

    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.restore()
  }
}
