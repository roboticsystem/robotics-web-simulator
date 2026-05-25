import { ColorUtils } from '@utils/ColorUtils'

/**
 * SoundWaveLayer — 声音波纹动画层
 * 渲染同心圆扩散波纹，并在被障碍物遮挡的角度区间截断弧线
 *
 * Bug fix: occlusionAngles 携带 distance 字段，绘制每条波时按 wave.radius 动态过滤，
 * 保证波纹未到达障碍物时保持完整圆弧。
 * Clip fix: 接受 world 参数并裁剪到世界边界，避免声波扩散到仿真区域外。
 */
export class SoundWaveLayer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {SoundSource[]} soundSources
   * @param {Map} soundDataMap - soundId → { waves:[{radius,opacity}], occlusionAngles:[{start,end,distance}] }
   * @param {{width,height}} [world] - 世界边界，裁剪声波不渲染到边界外
   */
  render(ctx, soundSources, soundDataMap, world) {
    // 裁剪到世界边界，防止声波扩散到仿真区域外
    const clipped = !!world
    if (clipped) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, world.width, world.height)
      ctx.clip()
    }

    for (const source of soundSources) {
      if (!source.enabled || !source.isPlaying) continue
      const data = soundDataMap?.get(source.id)
      if (!data) continue

      const { x, y } = source.position
      const { waves, occlusionAngles } = data
      const rgb = ColorUtils.toRgbString(source.color)

      ctx.save()
      ctx.lineWidth = 2

      for (const wave of waves) {
        if (wave.radius <= 0 || wave.opacity <= 0.01) continue

        ctx.strokeStyle = `rgba(${rgb},${wave.opacity})`

        // 只应用"已被波前到达"的障碍物遮挡（distance <= wave.radius）
        const activeOcclusion = occlusionAngles
          ? occlusionAngles.filter(o => o.distance <= wave.radius)
          : []

        if (activeOcclusion.length === 0) {
          // 无遮挡：完整圆
          ctx.beginPath()
          ctx.arc(x, y, wave.radius, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          // 有遮挡：绘制未被遮挡的弧段
          const arcs = this._computeVisibleArcs(activeOcclusion)
          for (const arc of arcs) {
            ctx.beginPath()
            ctx.arc(x, y, wave.radius, arc.start, arc.end)
            ctx.stroke()
          }
        }
      }

      // 声源标记（小圆点）
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb},0.8)`
      ctx.fill()

      ctx.restore()
    }

    if (clipped) {
      ctx.restore()
    }
  }

  /**
   * 根据遮挡角度区间计算可见弧段
   * @param {{start,end}[]} occluded - 被遮挡的角度区间（弧度，0~2π）
   * @returns {{start,end}[]} 可见弧段
   */
  _computeVisibleArcs(occluded) {
    const merged = this._mergeIntervals(occluded)

    const visible = []
    let cursor = 0

    for (const { start, end } of merged) {
      if (start > cursor) {
        visible.push({ start: cursor, end: start })
      }
      cursor = end
    }
    if (cursor < Math.PI * 2) {
      visible.push({ start: cursor, end: Math.PI * 2 })
    }
    return visible
  }

  _mergeIntervals(intervals) {
    if (!intervals.length) return []
    const sorted = [...intervals].sort((a, b) => a.start - b.start)
    const merged = [{ ...sorted[0] }]
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1]
      if (sorted[i].start <= last.end) {
        last.end = Math.max(last.end, sorted[i].end)
      } else {
        merged.push({ ...sorted[i] })
      }
    }
    return merged
  }
}
