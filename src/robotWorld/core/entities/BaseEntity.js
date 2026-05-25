import { MathUtils } from '@utils/MathUtils'

/**
 * BaseEntity — 所有场景实体的基类
 */
export class BaseEntity {
  /**
   * @param {object} config
   * @param {string} [config.id]
   * @param {string} config.type
   * @param {{x:number,y:number}} config.position
   * @param {number} [config.rotation=0]
   */
  constructor(config) {
    this.id = config.id || MathUtils.uuid()
    this.type = config.type
    this.position = { x: config.position?.x ?? 0, y: config.position?.y ?? 0 }
    this.rotation = config.rotation ?? 0
    this.label = config.label || ''
    this._dirty = true   // 脏标记，触发仿真重算
  }

  /** 标记为需要更新 */
  markDirty() { this._dirty = true }

  /** 消费脏标记 */
  consumeDirty() {
    const d = this._dirty
    this._dirty = false
    return d
  }

  /**
   * 获取轴对齐包围盒 AABB（子类实现）
   * @returns {{ minX, minY, maxX, maxY }}
   */
  getAABB() {
    throw new Error(`${this.constructor.name}.getAABB() not implemented`)
  }

  /**
   * 序列化为 JSON 对象（子类可扩展）
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      rotation: this.rotation,
      label: this.label,
    }
  }

  /**
   * 从 JSON 数据更新属性
   */
  fromJSON(data) {
    if (data.position) this.position = { ...data.position }
    if (data.rotation !== undefined) this.rotation = data.rotation
    if (data.label !== undefined) this.label = data.label
    this.markDirty()
  }
}
