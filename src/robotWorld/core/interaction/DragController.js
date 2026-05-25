import EventBus, { EVENTS } from '../engine/EventBus'

/**
 * DragController — 实体拖拽控制器
 * 支持障碍物、光源、声源的拖拽移动
 */
export class DragController {
  constructor(scene, selectionManager, lightSim) {
    this._scene = scene
    this._selection = selectionManager
    this._lightSim = lightSim
    this._isDragging = false
    this._dragOffset = { x: 0, y: 0 }
    this._dragEntity = null
  }

  /**
   * 开始拖拽
   * @param {{x,y}} worldPoint
   */
  startDrag(worldPoint) {
    const entity = this._selection.getSelected()
    if (!entity) return false

    this._isDragging = true
    this._dragEntity = entity
    this._dragOffset = {
      x: entity.position.x - worldPoint.x,
      y: entity.position.y - worldPoint.y,
    }
    return true
  }

  /**
   * 拖拽移动
   * @param {{x,y}} worldPoint
   */
  drag(worldPoint) {
    if (!this._isDragging || !this._dragEntity) return

    const entity = this._dragEntity
    const nextX = worldPoint.x + this._dragOffset.x
    const nextY = worldPoint.y + this._dragOffset.y
    const radius = entity.radius ?? 0
    const world = this._scene?.world ?? { width: Infinity, height: Infinity }

    entity.position.x = Math.min(Math.max(nextX, radius), world.width - radius)
    entity.position.y = Math.min(Math.max(nextY, radius), world.height - radius)

    if (entity.type === 'robot') {
      entity.velocity = { x: 0, y: 0 }
      entity.targetVelocity = { x: 0, y: 0 }
      entity.angularVelocity = 0
      entity.targetAngularVelocity = 0
      entity.savePrevState?.()
    }
    entity.markDirty?.()

    EventBus.emit(EVENTS.INPUT_ENTITY_DRAGGED, {
      id: entity.id,
      type: entity.type,
      position: { ...entity.position },
    })
  }

  /**
   * 结束拖拽
   */
  endDrag() {
    if (this._isDragging) {
      this._isDragging = false
      // 通知仿真重算
      if (this._lightSim) this._lightSim.markDirty()
      EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: this._dragEntity })
      this._dragEntity = null
    }
  }

  get isDragging() { return this._isDragging }
}
