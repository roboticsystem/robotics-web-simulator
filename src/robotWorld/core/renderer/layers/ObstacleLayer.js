import { MathUtils } from '@utils/MathUtils'

/**
 * ObstacleLayer — 渲染障碍物（圆形、多边形、矩形）
 */
export class ObstacleLayer {
  render(ctx, obstacles) {
    for (const obs of obstacles) {
      ctx.save()
      ctx.globalAlpha = obs.opacity ?? 1

      switch (obs.type) {
        case 'circle':
          this._renderCircle(ctx, obs)
          break
        case 'polygon':
        case 'rect':
          this._renderPolygon(ctx, obs)
          break
      }

      // 选中高亮 + resize handles
      if (obs.selected) {
        this._renderSelectionHighlight(ctx, obs)
        this._renderResizeHandles(ctx, obs)
      }

      ctx.restore()
    }
  }

  _renderCircle(ctx, obs) {
    ctx.beginPath()
    ctx.arc(obs.position.x, obs.position.y, obs.radius, 0, Math.PI * 2)
    ctx.fillStyle = obs.color || '#8e44ad'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  _renderPolygon(ctx, obs) {
    const verts = obs.getWorldVertices()
    if (!verts || verts.length < 3) return

    ctx.beginPath()
    ctx.moveTo(verts[0].x, verts[0].y)
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y)
    }
    ctx.closePath()
    ctx.fillStyle = obs.color || '#8e44ad'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  _renderSelectionHighlight(ctx, obs) {
    const aabb = obs.getAABB()
    const pad = 5
    ctx.save()
    ctx.globalAlpha = 1

    // 微弱填充
    ctx.fillStyle = 'rgba(0,212,255,0.04)'
    ctx.fillRect(
      aabb.minX - pad, aabb.minY - pad,
      (aabb.maxX - aabb.minX) + pad * 2,
      (aabb.maxY - aabb.minY) + pad * 2,
    )

    // 虚线边框
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.strokeRect(
      aabb.minX - pad, aabb.minY - pad,
      (aabb.maxX - aabb.minX) + pad * 2,
      (aabb.maxY - aabb.minY) + pad * 2,
    )
    ctx.setLineDash([])
    ctx.restore()
  }

  _renderResizeHandles(ctx, obs) {
    const handles = this._getHandlesForObs(obs)
    ctx.save()
    ctx.globalAlpha = 1
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#00d4ff'

    for (const h of handles) {
      if (obs.type === 'circle') {
        // 圆形障碍物：圆形 handle
        ctx.beginPath()
        ctx.arc(h.x, h.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.stroke()
      } else {
        // 矩形 / 多边形：方块 handle
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(h.x - 4, h.y - 4, 8, 8)
        ctx.strokeRect(h.x - 4, h.y - 4, 8, 8)
      }
    }
    ctx.restore()
  }

  /**
   * 内联 handle 坐标计算（与 ResizeController.getHandles 保持一致）
   */
  _getHandlesForObs(obs) {
    switch (obs.type) {
      case 'circle':
        return [{ x: obs.position.x + obs.radius, y: obs.position.y }]
      case 'rect':
        return obs.getWorldVertices().map((v, i) => ({ x: v.x, y: v.y, idx: i }))
      case 'polygon':
        return obs.getWorldVertices().map((v, i) => ({ x: v.x, y: v.y, idx: i }))
      default:
        return []
    }
  }
}
