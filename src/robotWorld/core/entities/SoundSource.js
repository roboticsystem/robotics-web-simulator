import { BaseEntity } from './BaseEntity'

/**
 * SoundSource — 声源实体
 */
export class SoundSource extends BaseEntity {
  constructor(config = {}) {
    super({ type: 'sound', ...config })
    this.intensity = config.intensity ?? 1.0
    this.maxRadius = config.maxRadius ?? 300       // px
    this.frequency = config.frequency ?? 440       // Hz（影响衰减特性，预留）
    this.enabled = config.enabled !== false
    this.isPlaying = config.isPlaying !== false
    this.waveSpeed = config.waveSpeed ?? 60        // px/s
    this.waveInterval = config.waveInterval ?? 1.0 // 发射间隔（秒）
    this.color = config.color ?? '#4fc3f7'

    // 运行时状态（不序列化）
    this._waveTimer = 0
    this._waves = []   // [{ radius, opacity }]
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
      frequency: this.frequency,
      enabled: this.enabled,
      isPlaying: this.isPlaying,
      waveSpeed: this.waveSpeed,
      waveInterval: this.waveInterval,
      color: this.color,
    }
  }

  fromJSON(data) {
    super.fromJSON(data)
    if (data.intensity !== undefined) this.intensity = data.intensity
    if (data.maxRadius !== undefined) this.maxRadius = data.maxRadius
    if (data.enabled !== undefined) this.enabled = data.enabled
    if (data.isPlaying !== undefined) this.isPlaying = data.isPlaying
    if (data.waveSpeed !== undefined) this.waveSpeed = data.waveSpeed
    if (data.waveInterval !== undefined) this.waveInterval = data.waveInterval
    if (data.color) this.color = data.color
  }
}
