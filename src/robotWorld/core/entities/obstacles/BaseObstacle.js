import { BaseEntity } from '../BaseEntity'

/**
 * BaseObstacle — 障碍物基类
 */
export class BaseObstacle extends BaseEntity {
  constructor(config) {
    super(config)
    this.color = config.color ?? '#8e44ad'
    this.opacity = config.opacity ?? 1.0
    this.isStatic = config.isStatic !== false  // 默认静态
    this.selected = false
  }

  toJSON() {
    return {
      ...super.toJSON(),
      color: this.color,
      opacity: this.opacity,
      isStatic: this.isStatic,
    }
  }

  fromJSON(data) {
    super.fromJSON(data)
    if (data.color) this.color = data.color
    if (data.opacity !== undefined) this.opacity = data.opacity
  }
}
