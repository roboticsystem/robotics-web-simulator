import { SAT } from './algorithms/SAT'
import { SpatialGrid } from './SpatialGrid'
import EventBus, { EVENTS } from '../engine/EventBus'
import { MathUtils } from '@utils/MathUtils'

/**
 * CollisionDetector — 碰撞检测调度器
 * 宽相位：SpatialGrid 空间哈希
 * 窄相位：SAT（分离轴定理）
 */
export class CollisionDetector {
  constructor() {
    this._grid = new SpatialGrid(80)
  }

  /**
   * 检测场景中所有碰撞
   * @param {SceneManager} scene
   * @returns {CollisionInfo[]}
   */
  detectAll(scene) {
    const results = []
    const robot = scene.robot
    const obstacles = scene.obstacles

    // 重建空间哈希
    this._grid.clear()
    this._grid.insert(robot)
    for (const obs of obstacles) {
      this._grid.insert(obs)
    }

    // 机器人与世界边界碰撞
    const boundaryHit = this._checkBoundary(robot, scene.world)
    if (boundaryHit) results.push(boundaryHit)

    // 机器人与障碍物（宽相位 → 窄相位）
    const candidates = this._grid.queryNear(robot)
    for (const obs of candidates) {
      const info = this._dispatch(robot, obs)
      if (info) {
        results.push({
          ...info,
          entityA: robot.id,
          entityB: obs.id,
          entityARef: robot,
          entityBRef: obs,
        })
      }
    }

    // 更新机器人碰撞状态
    this._updateRobotCollisionState(robot, results)

    // 发布碰撞事件
    if (results.length > 0) {
      EventBus.emit(EVENTS.SIM_COLLISION, results)
    }

    return results
  }

  /**
   * 窄相位分发：根据形状类型选择算法
   */
  _dispatch(entityA, entityB) {
    const ta = entityA.type
    const tb = entityB.type

    if (ta === 'circle' && tb === 'circle') {
      return SAT.circleVsCircle(entityA, entityB)
    }
    if (ta === 'robot') {
      if (tb === 'circle') {
        return SAT.circleVsCircle(entityA, entityB)
      }
      return SAT.circleVsPoly(entityA, entityB)
    }
    if (tb === 'circle') {
      return SAT.circleVsPoly(entityB, entityA)
    }
    return SAT.polyVsPoly(entityA, entityB)
  }

  /**
   * 机器人与世界边界碰撞检测
   */
  _checkBoundary(robot, world) {
    const { x, y } = robot.position
    const r = robot.radius
    const hits = {
      left:   x - r < 0,
      right:  x + r > world.width,
      top:    y - r < 0,
      bottom: y + r > world.height,
    }
    const any = Object.values(hits).some(Boolean)
    if (!any) return null

    // 计算边界推回法向量
    let nx = 0, ny = 0
    if (hits.left)   { nx += 1;  robot.position.x = r }
    if (hits.right)  { nx -= 1;  robot.position.x = world.width - r }
    if (hits.top)    { ny += 1;  robot.position.y = r }
    if (hits.bottom) { ny -= 1;  robot.position.y = world.height - r }

    const len = Math.sqrt(nx * nx + ny * ny) || 1

    return {
      colliding: true,
      entityA: robot.id,
      entityB: 'world-boundary',
      normal: { x: nx / len, y: ny / len },
      penetrationDepth: 0,
      boundaryHits: hits,
    }
  }

  /**
   * 根据碰撞结果更新机器人碰撞方向状态
   * 改进：沿碰撞法线方向消除速度，保留切向分量（墙面滑行）
   */
  _updateRobotCollisionState(robot, results) {
    const col = {
      left: false, right: false, front: false, back: false, any: false,
    }

    if (results.length > 0) {
      col.any = true

      for (const result of results) {
        if (!result.normal) continue

        const n = result.normal

        // ── 碰撞方向判断（世界→本地坐标） ────────────────────────
        const cos = Math.cos(robot.rotation)
        const sin = Math.sin(robot.rotation)
        const localX = n.x * cos + n.y * sin
        const localY = -n.x * sin + n.y * cos

        if (localX > 0.5)  col.front = true
        if (localX < -0.5) col.back  = true
        if (localY > 0.5)  col.right = true
        if (localY < -0.5) col.left  = true

        // ── 消除法向速度分量（保留切向，墙面滑行）────────────────
        const vDotN = robot.velocity.x * n.x + robot.velocity.y * n.y
        if (vDotN < 0) {
          robot.velocity.x -= vDotN * n.x
          robot.velocity.y -= vDotN * n.y
        }

        // ── 同步限制目标速度（防止命令持续向墙加速）─────────────
        if (robot.targetVelocity) {
          const tDotN = robot.targetVelocity.x * n.x + robot.targetVelocity.y * n.y
          if (tDotN < 0) {
            robot.targetVelocity.x -= tDotN * n.x
            robot.targetVelocity.y -= tDotN * n.y
          }
        }
      }
    }

    robot.sensorData.collision = col
  }
}
