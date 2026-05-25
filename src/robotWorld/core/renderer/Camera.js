/**
 * Camera — 视口控制（平移 + 缩放）
 * 支持鼠标拖拽平移和滚轮缩放
 */
export class Camera {
  constructor() {
    this.x = 0          // 平移偏移
    this.y = 0
    this.zoom = 1.0     // 缩放比例
    this.minZoom = 0.2
    this.maxZoom = 5.0
  }

  /** 将画布坐标转换为世界坐标 */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.x) / this.zoom,
      y: (sy - this.y) / this.zoom,
    }
  }

  /** 将世界坐标转换为画布坐标 */
  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.x,
      y: wy * this.zoom + this.y,
    }
  }

  /** 以屏幕中心点为锚点缩放 */
  zoomAt(delta, cx, cy) {
    const factor = delta > 0 ? 1.1 : 0.9
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor))
    const ratio = newZoom / this.zoom
    this.x = cx - ratio * (cx - this.x)
    this.y = cy - ratio * (cy - this.y)
    this.zoom = newZoom
  }

  /** 应用 Camera 变换到 Canvas 上下文 */
  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.x, this.y)
  }

  /** 重置变换 */
  resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** 将相机中心对准世界坐标点 */
  centerOn(wx, wy, canvasW, canvasH) {
    this.x = canvasW / 2 - wx * this.zoom
    this.y = canvasH / 2 - wy * this.zoom
  }

  /** 自适应显示整个世界 */
  fitWorld(worldW, worldH, canvasW, canvasH, padding = 40) {
    const zx = (canvasW - padding * 2) / worldW
    const zy = (canvasH - padding * 2) / worldH
    this.zoom = Math.min(zx, zy, this.maxZoom)
    this.x = (canvasW - worldW * this.zoom) / 2
    this.y = (canvasH - worldH * this.zoom) / 2
  }
}
