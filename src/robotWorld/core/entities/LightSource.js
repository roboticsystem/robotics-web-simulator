import { BaseEntity } from './BaseEntity'
import { MathUtils } from '@utils/MathUtils'

/**
 * LightSource — 点光源实体
 */
export class LightSource extends BaseEntity {
  constructor(config = {}) {
    super({ type: 'light', ...config })
    this.intensity = config.intensity ?? 1.0       // 0–1
    this.maxRadius = config.maxRadius ?? 250       // px
    this.color = config.color ?? '#ffe066'
    this.enabled = config.enabled !== false
    this.castShadows = config.castShadows !== false
    this._dirty = true
  }

  getAABB() {
    const { x, y } = this.position
    return {
      minX: x - this.maxRadius,
      minY: y - this.maxRadius,
      maxX: x + this.maxRadius,
      maxY: y + this.maxRadius,
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      intensity: this.intensity,
      maxRadius: this.maxRadius,
      color: this.color,
      enabled: this.enabled,
      castShadows: this.castShadows,
    }
  }

  fromJSON(data) {
    super.fromJSON(data)
    if (data.intensity !== undefined) this.intensity = data.intensity
    if (data.maxRadius !== undefined) this.maxRadius = data.maxRadius
    if (data.color) this.color = data.color
    if (data.enabled !== undefined) this.enabled = data.enabled
    if (data.castShadows !== undefined) this.castShadows = data.castShadows
  }
}
