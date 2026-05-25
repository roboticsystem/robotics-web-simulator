import { PolygonObstacle } from './PolygonObstacle'

/**
 * RectObstacle — 矩形/正方形障碍物
 * 继承 PolygonObstacle，提供便捷的 width/height 构造
 */
export class RectObstacle extends PolygonObstacle {
  constructor(config) {
    const w = (config.width ?? 60) / 2
    const h = (config.height ?? 60) / 2
    const vertices = [
      { x: -w, y: -h },
      { x:  w, y: -h },
      { x:  w, y:  h },
      { x: -w, y:  h },
    ]
    super({ type: 'rect', vertices, ...config })
    this._width = config.width ?? 60
    this._height = config.height ?? 60
  }

  get width() { return this._width }
  set width(v) {
    this._width = v
    this._updateVertices()
    this.markDirty()
  }

  get height() { return this._height }
  set height(v) {
    this._height = v
    this._updateVertices()
    this.markDirty()
  }

  _updateVertices() {
    const w = this._width / 2
    const h = this._height / 2
    this._vertices = [
      { x: -w, y: -h },
      { x:  w, y: -h },
      { x:  w, y:  h },
      { x: -w, y:  h },
    ]
  }

  toJSON() {
    return {
      ...super.toJSON(),
      width: this._width,
      height: this._height,
    }
  }

  fromJSON(data) {
    if (data.width !== undefined) this._width = data.width
    if (data.height !== undefined) this._height = data.height
    this._updateVertices()
    super.fromJSON({ ...data, vertices: this._vertices })
  }
}
