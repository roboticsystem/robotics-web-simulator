/**
 * UIOverlayLayer — 交互 UI 叠加层
 * 渲染正在绘制的形状预览、光源/声源图标等
 */
export class UIOverlayLayer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} uiState
   * @param {LightSource[]} lightSources
   * @param {SoundSource[]} soundSources
   */
  render(ctx, uiState, lightSources, soundSources, mazeExit = null, timestamp = 0) {
    // 迷宫出口信标
    if (mazeExit) {
      this._renderMazeExit(ctx, mazeExit, timestamp)
    }

    for (const light of lightSources) {
      if (!light.enabled) continue
      this._renderLightIcon(ctx, light)
    }

    for (const sound of soundSources) {
      if (!sound.enabled) continue
      this._renderSoundIcon(ctx, sound)
    }

    if (uiState?.preview) {
      this._renderPreview(ctx, uiState.preview)
    }
  }

  // ─── 迷宫出口信标 ────────────────────────────────────────────────────────
  _renderMazeExit(ctx, mazeExit, timestamp) {
    const { x, y } = mazeExit.pos
    const t = timestamp / 1000   // 转换为秒

    ctx.save()

    if (mazeExit.triggered) {
      // 已触发：强烈爆闪白光
      const flash = 0.5 + 0.5 * Math.sin(t * 20)
      ctx.globalAlpha = 0.85 * flash
      ctx.beginPath()
      ctx.arc(x, y, 40, 0, Math.PI * 2)
      const burst = ctx.createRadialGradient(x, y, 0, x, y, 40)
      burst.addColorStop(0,   'rgba(255,255,200,0.95)')
      burst.addColorStop(0.4, 'rgba(80,255,120,0.60)')
      burst.addColorStop(1,   'rgba(80,255,120,0.00)')
      ctx.fillStyle = burst
      ctx.fill()
      ctx.restore()
      return
    }

    // 脉动外环（三层同心圆）
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.8)
    const outerR = 22 + pulse * 8

    // 最外层扩散光晕
    const halo = ctx.createRadialGradient(x, y, outerR * 0.5, x, y, outerR * 1.6)
    halo.addColorStop(0,   `rgba(80,255,120,${0.14 * pulse})`)
    halo.addColorStop(1,   'rgba(80,255,120,0.00)')
    ctx.beginPath()
    ctx.arc(x, y, outerR * 1.6, 0, Math.PI * 2)
    ctx.fillStyle = halo
    ctx.fill()

    // 脉动圆环
    ctx.beginPath()
    ctx.arc(x, y, outerR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(80,255,120,${0.50 + 0.35 * pulse})`
    ctx.lineWidth = 2
    ctx.stroke()

    // 内圆填充
    ctx.beginPath()
    ctx.arc(x, y, 14, 0, Math.PI * 2)
    const inner = ctx.createRadialGradient(x, y, 2, x, y, 14)
    inner.addColorStop(0,   'rgba(200,255,210,0.90)')
    inner.addColorStop(0.5, 'rgba(40,220,90,0.80)')
    inner.addColorStop(1,   'rgba(20,160,60,0.50)')
    ctx.fillStyle = inner
    ctx.shadowBlur  = 16
    ctx.shadowColor = 'rgba(80,255,120,0.90)'
    ctx.fill()
    ctx.shadowBlur = 0

    // 中心出口图标（✓ 箭头）
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth   = 2.2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    // 向右箭头
    ctx.beginPath()
    ctx.moveTo(x - 5, y)
    ctx.lineTo(x + 4, y)
    ctx.moveTo(x + 1, y - 4)
    ctx.lineTo(x + 5, y)
    ctx.lineTo(x + 1, y + 4)
    ctx.stroke()

    // "EXIT" 文字
    ctx.font         = 'bold 9px monospace'
    ctx.fillStyle    = 'rgba(80,255,120,0.90)'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'
    ctx.shadowBlur   = 4
    ctx.shadowColor  = 'rgba(0,255,80,0.7)'
    ctx.fillText('EXIT', x, y + 18)
    ctx.shadowBlur = 0

    ctx.restore()
  }

  // ─── 光源图标 ────────────────────────────────────────────────────────
  _renderLightIcon(ctx, light) {
    const { x, y } = light.position
    const color = light.color || '#ffe066'
    const [cr, cg, cb] = _hexToRgb(color)

    ctx.save()

    // 外发光晕
    ctx.beginPath()
    ctx.arc(x, y, 14, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 14)
    glow.addColorStop(0,   `rgba(${cr},${cg},${cb},0.30)`)
    glow.addColorStop(1,   `rgba(${cr},${cg},${cb},0.00)`)
    ctx.fillStyle = glow
    ctx.fill()

    // 辐射射线（8 条短线）
    ctx.lineWidth = 1.3
    ctx.lineCap = 'round'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const r1 = 7, r2 = 12
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1)
      ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2)
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.55)`
      ctx.stroke()
    }

    // 中心圆（填充）
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    const cGrad = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5)
    cGrad.addColorStop(0, `rgba(255,255,255,0.95)`)
    cGrad.addColorStop(0.5, color)
    cGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0.85)`)
    ctx.fillStyle = cGrad
    ctx.shadowBlur = 8
    ctx.shadowColor = color
    ctx.fill()
    ctx.shadowBlur = 0

    // 选中高亮
    if (light.selected) {
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.75
      ctx.stroke()
    }

    ctx.restore()
  }

  // ─── 声源图标 ────────────────────────────────────────────────────────
  _renderSoundIcon(ctx, sound) {
    const { x, y } = sound.position
    const color = sound.color || '#4fc3f7'
    const [cr, cg, cb] = _hexToRgb(color)

    ctx.save()

    // 外发光晕
    const glow = ctx.createRadialGradient(x, y, 3, x, y, 16)
    glow.addColorStop(0,   `rgba(${cr},${cg},${cb},0.20)`)
    glow.addColorStop(1,   `rgba(${cr},${cg},${cb},0.00)`)
    ctx.beginPath()
    ctx.arc(x, y, 16, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // 喇叭主体（小三角形 + 矩形）
    ctx.beginPath()
    // 矩形部分（喇叭口）
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.85)`
    ctx.shadowBlur = 6
    ctx.shadowColor = color
    // 用路径画喇叭：矩形 + 右侧三角展开
    ctx.save()
    ctx.translate(x, y)
    // 喇叭体
    ctx.beginPath()
    ctx.moveTo(-4, -2.5)
    ctx.lineTo(-4,  2.5)
    ctx.lineTo( 0,  5)
    ctx.lineTo( 0, -5)
    ctx.closePath()
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.90)`
    ctx.fill()
    // 矩形手柄
    ctx.beginPath()
    ctx.rect(-6.5, -2.5, 2.5, 5)
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.90)`
    ctx.fill()
    ctx.shadowBlur = 0

    // 声波弧线（2 条）
    const arcAngles = [-0.55, 0.55]
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath()
      ctx.arc(0, 0, 4 + i * 4, arcAngles[0], arcAngles[1])
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.65 - i * 0.18})`
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    ctx.restore()

    // 选中高亮
    if (sound.selected) {
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.75
      ctx.stroke()
    }

    ctx.restore()
  }

  // ─── 形状绘制预览 ─────────────────────────────────────────────────────
  _renderPreview(ctx, preview) {
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1.8
    ctx.shadowBlur = 6
    ctx.shadowColor = 'rgba(0,212,255,0.5)'

    switch (preview.type) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(preview.x, preview.y, preview.radius || 1, 0, Math.PI * 2)
        ctx.stroke()
        // 中心十字
        ctx.setLineDash([])
        ctx.globalAlpha = 0.3
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(preview.x - 5, preview.y)
        ctx.lineTo(preview.x + 5, preview.y)
        ctx.moveTo(preview.x, preview.y - 5)
        ctx.lineTo(preview.x, preview.y + 5)
        ctx.stroke()
        break

      case 'rect':
      case 'polygon':
        if (preview.points && preview.points.length >= 2) {
          ctx.beginPath()
          ctx.moveTo(preview.points[0].x, preview.points[0].y)
          for (let i = 1; i < preview.points.length; i++) {
            ctx.lineTo(preview.points[i].x, preview.points[i].y)
          }
          if (preview.closed) ctx.closePath()
          ctx.stroke()

          // 顶点小圆点
          ctx.setLineDash([])
          ctx.globalAlpha = 0.6
          ctx.fillStyle = '#00d4ff'
          ctx.shadowBlur = 0
          for (const pt of preview.points) {
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        break
    }

    ctx.setLineDash([])
    ctx.restore()
  }
}

// ─── 颜色辅助 ────────────────────────────────────────────────────────────────
function _hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)]
  }
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
