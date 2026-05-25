import EventBus, { EVENTS } from '../engine/EventBus'
import { MathUtils } from '@utils/MathUtils'

export class SelectionManager {
  constructor(scene) {
    this._scene = scene
    this._selectedId = null
    this._selectedType = null
  }

  get selectedId() { return this._selectedId }
  get selectedType() { return this._selectedType }

  selectAt(worldPoint) {
    this._clearSelectionHighlight()

    let hit = null

    if (!hit) {
      const robot = this._scene.robot
      if (robot?.visible !== false && MathUtils.dist(worldPoint, robot.position) <= robot.radius + 4) {
        hit = { id: robot.id, type: 'robot', entity: robot }
      }
    }

    if (!hit) {
      for (let i = this._scene.obstacles.length - 1; i >= 0; i--) {
        const obs = this._scene.obstacles[i]
        if (this._hitTest(worldPoint, obs)) {
          hit = { id: obs.id, type: obs.type, entity: obs }
          break
        }
      }
    }

    if (hit) {
      this._selectedId = hit.id
      this._selectedType = hit.type
      hit.entity.selected = true
      EventBus.emit(EVENTS.INPUT_ENTITY_SELECTED, { id: hit.id, type: hit.type, entity: hit.entity })
    } else {
      this._selectedId = null
      this._selectedType = null
      EventBus.emit(EVENTS.INPUT_ENTITY_DESELECTED, {})
    }

    return this._selectedId
  }

  deselect() {
    this._clearSelectionHighlight()
    this._selectedId = null
    this._selectedType = null
    EventBus.emit(EVENTS.INPUT_ENTITY_DESELECTED, {})
  }

  getSelected() {
    if (!this._selectedId) return null
    return this._findEntity(this._selectedId)
  }

  _clearSelectionHighlight() {
    for (const obs of this._scene.obstacles) obs.selected = false
    this._scene.robot.selected = false
  }

  _hitTest(point, obs) {
    switch (obs.type) {
      case 'circle':
        return MathUtils.dist(point, obs.position) <= obs.radius
      case 'polygon':
      case 'rect': {
        const verts = obs.getWorldVertices()
        return MathUtils.pointInPolygon(point, verts)
      }
      default:
        return false
    }
  }

  _findEntity(id) {
    if (this._scene.robot.id === id) return this._scene.robot
    return (
      this._scene.obstacles.find(o => o.id === id) ||
      null
    )
  }
}
