import { ColorUtils } from '@utils/ColorUtils'

/**
 * LightHeatmapLayer — 光照热图渲染层
 * 每个光源使用独立离屏 Canvas，通过 'screen' 合成模式叠加
 * 此文件仅负责渲染，计算由 LightSimulator 负责
 */
export class LightHeatmapLayer {
  constructor() {
    this._offscreens = new Map()  // lightId → OffscreenCanvas
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../../scene/SceneManager').SceneManager} scene
   * @param {Map} lightDataMap - lightId → { visibilityPolygon }
   * @param {number} canvasW
   * @param {number} canvasH
   */
  render(ctx, scene, lightDataMap, canvasW, canvasH) {
    const prevOp = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.88

    for (const light of scene.lightSources) {
      if (!light.enabled) continue

      const offscreen = this._getOffscreen(light.id, canvasW, canvasH)
      const data = lightDataMap?.get(light.id)
      if (!data) continue

      this._renderToOffscreen(offscreen, light, data.visibilityPolygon)
      ctx.drawImage(offscreen, 0, 0)
    }

    ctx.globalCompositeOperation = prevOp
    ctx.globalAlpha = 1.0
  }

  _getOffscreen(id, w, h) {
    if (!this._offscreens.has(id) ||
        this._offscreens.get(id).width !== w ||
        this._offscreens.get(id).height !== h) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      this._offscreens.set(id, canvas)
    }
    return this._offscreens.get(id)
  }

  _renderToOffscreen(offscreen, light, visibilityPolygon) {
    const ctx = offscreen.getContext('2d')
    const { x, y } = light.position
    const { intensity, maxRadius, color } = light

    ctx.clearRect(0, 0, offscreen.width, offscreen.height)

    if (!visibilityPolygon || visibilityPolygon.length < 3) return

    ctx.save()

    // 裁剪到可见区域多边形
    ctx.beginPath()
    ctx.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y)
    for (let i = 1; i < visibilityPolygon.length; i++) {
      ctx.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y)
    }
    ctx.closePath()
    ctx.clip()

    // 径向渐变（模拟 1/r² 衰减）
    const rgb = ColorUtils.toRgbString(color)
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, maxRadius)
    gradient.addColorStop(0,    `rgba(${rgb},${intensity})`)
    gradient.addColorStop(0.15, `rgba(${rgb},${intensity * 0.7})`)
    gradient.addColorStop(0.4,  `rgba(${rgb},${intensity * 0.25})`)
    gradient.addColorStop(0.7,  `rgba(${rgb},${intensity * 0.06})`)
    gradient.addColorStop(1.0,  `rgba(${rgb},0)`)

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)

    ctx.restore()
  }

  /** 清理不再存在的光源对应的离屏 Canvas */
  cleanup(activeLightIds) {
    for (const id of this._offscreens.keys()) {
      if (!activeLightIds.includes(id)) {
        this._offscreens.delete(id)
      }
    }
  }
}
