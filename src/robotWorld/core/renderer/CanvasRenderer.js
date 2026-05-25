import { BackgroundLayer } from './layers/BackgroundLayer'
import { ObstacleLayer } from './layers/ObstacleLayer'
import { RobotLayer } from './layers/RobotLayer'
import { LightHeatmapLayer } from './layers/LightHeatmapLayer'
import { SoundWaveLayer } from './layers/SoundWaveLayer'
import { UIOverlayLayer } from './layers/UIOverlayLayer'
import { LineTrackLayer } from './layers/LineTrackLayer'
import { HeadlightLayer } from './layers/HeadlightLayer'
import { ProximityLayer } from './layers/ProximityLayer'
import { TrailLayer } from './layers/TrailLayer'

/**
 * CanvasRenderer — 主渲染器，按层次顺序调度各 Layer 渲染
 * 渲染顺序：背景 → 巡线地图 → 光照热图 → 障碍物 → 车灯光锥 → 声波 → 机器人 → UI叠加
 */
export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this._background   = new BackgroundLayer()
    this._lineTrack    = new LineTrackLayer()
    this._lightHeatmap = new LightHeatmapLayer()
    this._obstacle     = new ObstacleLayer()
    this._headlight    = new HeadlightLayer()
    this._soundWave    = new SoundWaveLayer()
    this._trail        = new TrailLayer()
    this._robot        = new RobotLayer()
    this._proximity    = new ProximityLayer()
    this._uiOverlay    = new UIOverlayLayer()
  }

  /**
   * 完整渲染一帧
   * @param {SceneManager} scene
   * @param {object} simData - 仿真数据
   * @param {Map} simData.lightDataMap
   * @param {Map} simData.soundDataMap
   * @param {Array} simData.headlightData - 车灯光锥多边形数组
   * @param {number} simData.alpha - 渲染插值系数
   * @param {object} uiState
   * @param {Camera} camera
   */
  render(scene, simData = {}, uiState = {}, camera = null) {
    const ctx = this.ctx
    const { width, height } = this.canvas

    // 清空画布
    ctx.clearRect(0, 0, width, height)

    // 应用摄像机变换
    if (camera) {
      camera.applyTransform(ctx)
    }

    // Layer 1: 背景
    this._background.render(ctx, scene.world)

    // Layer 2: 巡线地图
    if (scene.lineTrack) {
      this._lineTrack.render(ctx, scene.lineTrack)
    }

    // Layer 3: 光照热图（在障碍物下方，营造体积感）
    if (simData.lightDataMap) {
      this._lightHeatmap.render(
        ctx, scene, simData.lightDataMap,
        scene.world.width, scene.world.height
      )
    }

    // Layer 4: 障碍物
    this._obstacle.render(ctx, scene.obstacles)

    // Layer 4.5: 规划路径格高亮（障碍物上方，车灯下方）
    // Layer 5: 车灯光锥（在障碍物上方，机器人下方）
    if (simData.headlightData && scene.robot?.visible) {
      this._headlight.render(ctx, simData.headlightData, scene.world)
    }

    // Layer 6: 声波动画（裁剪到世界边界内）
    if (simData.soundDataMap) {
      this._soundWave.render(ctx, scene.soundSources, simData.soundDataMap, scene.world)
    }

    // Layer 6.5: 轨迹拖尾（声波上方、机器人下方）
    if (simData.trailBuffer) {
      this._trail.render(ctx, simData.trailBuffer, simData.trailColor)
    }

    // Layer 7: 机器人
    const alpha = simData.alpha ?? 1
    this._robot.render(ctx, scene.robot, alpha)

    // Layer 7.5: 传感器射线（机器人上方、UI下方）
    if (simData.showProximity && scene.robot?.visible) {
      this._proximity.render(ctx, scene.robot)
    }

    // Layer 8: UI 叠加（图标、预览、选中框、迷宫出口）
    this._uiOverlay.render(ctx, uiState, scene.lightSources, scene.soundSources, scene.mazeExit, simData.timestamp)

    // 恢复默认变换
    if (camera) {
      camera.resetTransform(ctx)
    }
  }

  /** 调整 Canvas 尺寸 */
  resize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
  }

  /** 清空画布 */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
