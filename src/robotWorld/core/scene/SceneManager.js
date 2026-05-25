import { MathUtils } from '@utils/MathUtils'
import { Robot } from '../entities/Robot'
import { CircleObstacle } from '../entities/obstacles/CircleObstacle'
import { PolygonObstacle } from '../entities/obstacles/PolygonObstacle'
import { RectObstacle } from '../entities/obstacles/RectObstacle'
import { LightSource } from '../entities/LightSource'
import { SoundSource } from '../entities/SoundSource'
import EventBus, { EVENTS } from '../engine/EventBus'

function cloneSerializableSceneData(data) {
  return data == null ? null : JSON.parse(JSON.stringify(data))
}

/**
 * SceneManager — 场景实体生命周期管理
 * 维护场景状态（SceneState），提供 CRUD 接口
 */
export class SceneManager {
  constructor() {
    this.world = { width: 800, height: 600, backgroundColor: '#1a1a2e', borderColor: '#4a90e2', borderWidth: 2 }
    this.robot = new Robot({ id: 'robot-0', position: { x: 100, y: 100 } })
    this.obstacles = []        // BaseObstacle[]
    this.lightSources = []     // LightSource[]
    this.soundSources = []     // SoundSource[]
    this.lineTrack = null      // 巡线地图数据
    this.mazeExit  = null      // 迷宫出口信息
    this.gridParams = null     // 迷宫格子参数（路径规划用）
  }

  // ─── 障碍物 ──────────────────────────────────────

  addObstacle(config) {
    const obs = this._createObstacle(config)
    this.obstacles.push(obs)
    EventBus.emit(EVENTS.SCENE_ENTITY_ADDED, { entity: obs })
    return obs
  }

  removeObstacle(id) {
    const idx = this.obstacles.findIndex(o => o.id === id)
    if (idx === -1) return false
    const [removed] = this.obstacles.splice(idx, 1)
    EventBus.emit(EVENTS.SCENE_ENTITY_REMOVED, { entity: removed })
    return true
  }

  updateObstacle(id, patch) {
    const obs = this.obstacles.find(o => o.id === id)
    if (!obs) return false
    Object.assign(obs, patch)
    obs.markDirty()
    EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: obs })
    return true
  }

  getObstacleById(id) {
    return this.obstacles.find(o => o.id === id) || null
  }

  // ─── 光源 ──────────────────────────────────────

  addLightSource(config) {
    const light = new LightSource({ id: MathUtils.uuid(), ...config })
    this.lightSources.push(light)
    EventBus.emit(EVENTS.SCENE_ENTITY_ADDED, { entity: light })
    return light
  }

  removeLightSource(id) {
    const idx = this.lightSources.findIndex(l => l.id === id)
    if (idx === -1) return false
    const [removed] = this.lightSources.splice(idx, 1)
    EventBus.emit(EVENTS.SCENE_ENTITY_REMOVED, { entity: removed })
    return true
  }

  updateLightSource(id, patch) {
    const light = this.lightSources.find(l => l.id === id)
    if (!light) return false
    Object.assign(light, patch)
    light.markDirty()
    EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: light })
    return true
  }

  // ─── 声源 ──────────────────────────────────────

  addSoundSource(config) {
    const sound = new SoundSource({ id: MathUtils.uuid(), ...config })
    this.soundSources.push(sound)
    EventBus.emit(EVENTS.SCENE_ENTITY_ADDED, { entity: sound })
    return sound
  }

  removeSoundSource(id) {
    const idx = this.soundSources.findIndex(s => s.id === id)
    if (idx === -1) return false
    const [removed] = this.soundSources.splice(idx, 1)
    EventBus.emit(EVENTS.SCENE_ENTITY_REMOVED, { entity: removed })
    return true
  }

  updateSoundSource(id, patch) {
    const sound = this.soundSources.find(s => s.id === id)
    if (!sound) return false
    Object.assign(sound, patch)
    sound.markDirty()
    EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: sound })
    return true
  }

  // ─── 机器人 ──────────────────────────────────────

  updateRobot(patch) {
    this.robot.fromJSON({
      ...this.robot.toJSON(),
      ...patch,
    })
    this.robot.markDirty()
    EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: this.robot })
  }

  // ─── 场景 ──────────────────────────────────────

  updateWorld(patch) {
    Object.assign(this.world, patch)
    EventBus.emit(EVENTS.SCENE_ENTITY_UPDATED, { entity: { type: 'world', ...this.world } })
  }

  /** 清空场景（保留机器人） */
  clear() {
    this.obstacles = []
    this.lightSources = []
    this.soundSources = []
    this.lineTrack = null
    this.mazeExit  = null
    this.gridParams = null
    EventBus.emit(EVENTS.SCENE_CLEARED, {})
  }

  /** 获取场景快照（用于序列化） */
  getSnapshot() {
    return {
      world: { ...this.world },
      robot: this.robot.toJSON(),
      obstacles: this.obstacles.map(o => o.toJSON()),
      lightSources: this.lightSources.map(l => l.toJSON()),
      soundSources: this.soundSources.map(s => s.toJSON()),
      lineTrack: cloneSerializableSceneData(this.lineTrack),
      mazeExit: cloneSerializableSceneData(this.mazeExit),
      gridParams: cloneSerializableSceneData(this.gridParams),
    }
  }

  /** 从快照恢复场景 */
  loadSnapshot(snapshot) {
    if (snapshot.world) Object.assign(this.world, snapshot.world)
    if (snapshot.robot) this.robot.fromJSON(snapshot.robot)

    this.obstacles = (snapshot.obstacles || []).map(d => {
      const obs = this._createObstacle(d)
      return obs
    })

    this.lightSources = (snapshot.lightSources || []).map(d => {
      const l = new LightSource(d)
      return l
    })

    this.soundSources = (snapshot.soundSources || []).map(d => {
      const s = new SoundSource(d)
      return s
    })

    this.lineTrack = cloneSerializableSceneData(snapshot.lineTrack)
    this.mazeExit = cloneSerializableSceneData(snapshot.mazeExit)
    this.gridParams = cloneSerializableSceneData(snapshot.gridParams)

    EventBus.emit(EVENTS.SCENE_LOADED, { snapshot })
  }

  /** 获取所有可见实体（用于碰撞/渲染） */
  getAllObstacles() { return this.obstacles }

  // ─── 内部工厂 ──────────────────────────────────────

  _createObstacle(config) {
    const id = config.id || MathUtils.uuid()
    switch (config.type) {
      case 'circle':  return new CircleObstacle({ id, ...config })
      case 'rect':    return new RectObstacle({ id, ...config })
      case 'polygon': return new PolygonObstacle({ id, ...config })
      default:        return new RectObstacle({ id, ...config })
    }
  }
}
