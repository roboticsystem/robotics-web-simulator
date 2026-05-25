import { RenderLoop } from './RenderLoop'
import { SceneManager } from '../scene/SceneManager'
import { CanvasRenderer } from '../renderer/CanvasRenderer'
import { Camera } from '../renderer/Camera'
import { CollisionDetector } from '../physics/CollisionDetector'
import { LightSimulator } from '../simulation/LightSimulator'
import { SoundSimulator } from '../simulation/SoundSimulator'
import { SelectionManager } from '../interaction/SelectionManager'
import { DragController } from '../interaction/DragController'
import { ResizeController } from '../interaction/ResizeController'
import { InputHandler } from '../interaction/InputHandler'
import { MapGenerator } from '../mapgen/MapGenerator'
import { MathUtils } from '@utils/MathUtils'
import { LightRayTracer } from '../simulation/LightRayTracer'
import EventBus, { EVENTS } from './EventBus'
import { sensorInterface } from '../../interfaces/SensorDataInterface'
import { robotControlInterface } from '../../interfaces/RobotControlInterface'
import { webSocketBridge } from '../../interfaces/WebSocketBridge'

/**
 * WorldEngine — 世界引擎主类
 * 协调所有子系统，驱动渲染循环
 */
export class WorldEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [initialScene] - 可选的初始场景快照
   */
  constructor(canvas, initialScene = null) {
    this.canvas = canvas

    // ─── 子系统初始化 ──────────────────────────────────────
    this.scene = new SceneManager()
    this.camera = new Camera()
    this.renderer = new CanvasRenderer(canvas)
    this.collision = new CollisionDetector()
    this.lightSim = new LightSimulator()
    this.soundSim = new SoundSimulator()
    this.mapGen = new MapGenerator()

    // ─── WebSocket 联调桥接 ──────────────────────────────────────
    this.wsBridge = webSocketBridge

    // ─── 自动驾驶控制器 ──────────────────────────────────────────
    // ─── 车灯光锥追踪器 ──────────────────────────────────────────
    this._headlightTracer = new LightRayTracer()
    this._headlightData   = null   // { left: [{x,y}], right: [{x,y}] }

    this.selection = new SelectionManager(this.scene)
    this.drag = new DragController(this.scene, this.selection, this.lightSim)
    this.resize = new ResizeController(this.scene, this.lightSim)
    this.input = new InputHandler(
      canvas,
      this.scene,
      this.selection,
      this.drag,
      this.camera,
      this.resize,
    )

    // ─── UI 状态（供渲染层使用）──────────────────────────────────────
    this._uiState = {
      tool: 'select',
      preview: null,
      headlightEnabled: false,
      showProximity:   false,
      showTrail:       false,
    }

    // ─── 轨迹缓冲（环形数组，最近200帧位置）────────────────────────
    this._trailBuffer  = []          // [{x,y}]，索引0=最新
    this._trailMaxLen  = 200

    // ─── 动态障碍物运动数据 ───────────────────────────────────────
    this._dynamicObstacles = []   // [{ id, axis, origin, range, speed, phase }]
    this._dynTime = 0             // 动态障碍全局时间累计

    // ─── 统计数据 ────────────────────────────────────────────────────
    this._stats = { elapsed: 0, distance: 0, collisions: 0 }
    this._prevCollisionAny = false   // 用于边沿检测

    // ─── 渲染循环 ──────────────────────────────────────
    this.loop = new RenderLoop({
      onFixedUpdate: (dt) => this._fixedUpdate(dt),
      onRender: (alpha, dt) => this._render(alpha, dt),
      onStats: ({ fps }) => EventBus.emit(EVENTS.RENDER_FPS, fps),
    })

    // ─── 事件监听 ──────────────────────────────────────
    this._setupEventListeners()

    // ─── 初始化场景 ──────────────────────────────────────
    if (initialScene) {
      this.scene.loadSnapshot(initialScene)
    }

    // 适配相机视口
    this.camera.fitWorld(
      this.scene.world.width,
      this.scene.world.height,
      canvas.width,
      canvas.height,
    )
  }

  /** 启动仿真 */
  start() {
    this.loop.start()
    EventBus.emit(EVENTS.SIM_STARTED, {})
  }

  /** 暂停仿真 */
  pause() {
    this.loop.stop()
    EventBus.emit(EVENTS.SIM_PAUSED, {})
  }

  /** 重置仿真（保留场景，重置机器人状态） */
  reset() {
    this.loop.stop()
    const start = this.scene.gridParams?.start
      ? {
          x: Number(this.scene.gridParams.start.x ?? 100),
          y: Number(this.scene.gridParams.start.y ?? 100),
        }
      : { x: 100, y: 100 }
    this.scene.robot.position = start
    this.scene.robot.rotation = 0
    this.scene.robot.velocity = { x: 0, y: 0 }
    this.scene.robot.angularVelocity = 0
    this.scene.robot.targetVelocity = { x: 0, y: 0 }
    this.scene.robot.targetAngularVelocity = 0
    this.scene.robot.sensorData = {
      light: 0, sound: 0,
      collision: { left: false, right: false, front: false, back: false, any: false },
      proximity: { front: Infinity, frontLeft: Infinity, frontRight: Infinity, left: Infinity, right: Infinity },
      lineDetected: false, linePosition: null,
    }
    this.lightSim.markDirty()
    EventBus.emit(EVENTS.SIM_RESET, {})
  }

  /** 单帧步进（调试用） */
  stepFrame() {
    this._fixedUpdate(1 / 60)
    this._render(1, 16.67)
  }

  /** 仅重绘当前场景，不推进仿真 */
  renderFrame() {
    this._render(1, 0)
  }

  /** 销毁引擎 */
  destroy() {
    this.loop.stop()
    EventBus.clear()
  }

  on(event, handler) {
    return EventBus.on(event, handler)
  }

  // ─── 私有方法 ──────────────────────────────────────

  /**
   * 固定步长更新（物理/仿真）
   * @param {number} dt - 秒
   */
  _fixedUpdate(dt) {
    // 1. 处理外部控制指令
    const cmds = robotControlInterface.flushQueue()
    for (const cmd of cmds) {
      this._applyCommand(cmd)
    }

    const robot = this.scene.robot

    // 2. 驾驶输入（仅在机器人可见时有效）
    // 3. 机器人运动更新
    this.scene.robot.update(dt)

    // 3.5 动态障碍物运动
    if (this._dynamicObstacles.length > 0) {
      this._updateDynamicObstacles(dt)
    }

    // 4. 碰撞检测与响应
    this.collision.detectAll(this.scene)

    // 5. 声音仿真更新
    this.soundSim.update(dt, this.scene)

    // 5. 光照仿真（脏标记驱动，场景静止时不重算）
    if (this.lightSim.isDirty) {
      this.lightSim.compute(this.scene)
    }

    // 6. 更新传感器数据
    this._updateSensorData()

    // 7. 迷宫出口检测
    this._checkMazeExit()

    // 8. 统计更新
    if (robot.visible) {
      this._stats.elapsed += dt
      const spd = Math.hypot(robot.velocity.x, robot.velocity.y)
      this._stats.distance += spd * dt
      const curCol = robot.sensorData.collision.any
      if (curCol && !this._prevCollisionAny) this._stats.collisions++
      this._prevCollisionAny = curCol
    }

    // 9. 轨迹缓冲
    if (robot.visible && this._uiState.showTrail) {
      this._trailBuffer.unshift({ x: robot.position.x, y: robot.position.y })
      if (this._trailBuffer.length > this._trailMaxLen) {
        this._trailBuffer.length = this._trailMaxLen
      }
    }

    // 10. 发布传感器数据到外部接口
    EventBus.emit(EVENTS.SIM_SENSOR_UPDATE, {
      robotId: this.scene.robot.id,
      ...this.scene.robot.sensorData,
      velocity: { ...this.scene.robot.velocity },
    })
  }

  /**
   * 每帧渲染
   * @param {number} alpha - 插值系数
   */
  _render(alpha) {
    // 计算车灯光锥可见多边形（仅在机器人可见且车灯开启时）
    const robot = this.scene.robot
    this._headlightData = null

    this.renderer.render(
      this.scene,
      {
        lightDataMap:    this.lightSim.getLightDataMap(),
        soundDataMap:    this.soundSim.getSoundDataMap(),
        headlightData:   this._headlightData,
        trailBuffer:     this._uiState.showTrail ? this._trailBuffer : null,
        trailColor:      this.scene.robot.color,
        showProximity:   this._uiState.showProximity,
        alpha,
        timestamp:       performance.now(),
      },
      this._uiState,
      this.camera,
    )
  }

  /**
   * 计算左右两个前大灯的可见光锥多边形
   * 使用 LightRayTracer 的角度扫描，限定在前方扇形角度范围内
   * @param {Robot} robot
   * @returns {{ left: {x,y}[], right: {x,y}[] }}
   */
  _computeHeadlights(robot) {
    const carL    = robot.radius * 1.85
    const carW    = robot.radius * 1.10
    const headX   = carL * 0.94
    const headY   = carW * 0.66
    const rot     = robot.rotation
    const cosR    = Math.cos(rot)
    const sinR    = Math.sin(rot)

    // 灯体世界坐标（两侧）
    const lights = [
      {
        x: robot.position.x + cosR * headX - sinR * (-headY),
        y: robot.position.y + sinR * headX + cosR * (-headY),
      },
      {
        x: robot.position.x + cosR * headX - sinR * headY,
        y: robot.position.y + sinR * headX + cosR * headY,
      },
    ]

    const CONE_RANGE  = Math.PI * 0.18   // 光锥半角 ~32°（紧凑前向光束）
    const CONE_REACH  = robot.radius * 5.5  // 光照射程（适度）
    const RAY_COUNT   = 24               // 锥内射线数

    // 获取障碍物线段 + 世界边界
    const allSegments = this._getHeadlightSegments(robot)

    const result = []
    for (const lpos of lights) {
      // 扇形起始 / 结束角度（用于端点角度过滤的参考，世界坐标）
      const centerAngle = rot

      // 收集扇形范围内障碍物端点对应的角度（存储为相对 centerAngle 的偏移量）
      const extraAngles = []
      for (const [a, b] of allSegments) {
        for (const pt of [a, b]) {
          const ang = Math.atan2(pt.y - lpos.y, pt.x - lpos.x)
          // 偏移量归一化到 [-π, π]
          const norm = _normalizeAngle(ang - centerAngle)
          if (Math.abs(norm) <= CONE_RANGE + 0.04) {
            // 存储偏移量（而非绝对角度），确保在任何朝向下排序都正确
            extraAngles.push(norm - 0.0005)
            extraAngles.push(norm)
            extraAngles.push(norm + 0.0005)
          }
        }
      }

      // 均匀角度步进（使用偏移量 [-CONE_RANGE, +CONE_RANGE]）
      const stepAngles = []
      for (let i = 0; i <= RAY_COUNT; i++) {
        stepAngles.push(-CONE_RANGE + (2 * CONE_RANGE) * (i / RAY_COUNT))
      }

      // 关键修复：将所有角度转换为相对于 centerAngle 的偏移量（归一化到 [-π, π]），
      // 按偏移量排序后再转换回世界角度，避免 ±π 跨越导致的排序错误
      const angleSet = new Set()
      for (const a of [...stepAngles, ...extraAngles]) {
        // a 此时已经是偏移量（步进角直接是偏移量，额外角也是偏移量）
        if (Math.abs(a) <= CONE_RANGE + 0.001) {
          angleSet.add(a)
        }
      }

      const angles = [...angleSet]
        .sort((a, b) => a - b)
        .map(offset => centerAngle + offset)

      // 构建可见多边形：灯体 → 射线终点列表
      const poly = [{ x: lpos.x, y: lpos.y }]
      for (const angle of angles) {
        const dir = { x: Math.cos(angle), y: Math.sin(angle) }
        const hit = this._castHeadlightRay(lpos, dir, allSegments, CONE_REACH)
        poly.push(hit)
      }

      result.push(poly)
    }

    return result   // [leftPoly, rightPoly]
  }

  /**
   * 投射单条车灯光线，返回最近障碍物交点或最远处
   */
  _castHeadlightRay(origin, dir, segments, maxDist) {
    let minT = maxDist
    for (const [a, b] of segments) {
      const t = MathUtils.raySegmentIntersect(origin, dir, a, b)
      if (t !== null && t > 1e-5 && t < minT) minT = t
    }
    return { x: origin.x + dir.x * minT, y: origin.y + dir.y * minT }
  }

  /**
   * 收集车灯光锥可见性检测用的所有线段：障碍物 + 世界边界
   */
  _getHeadlightSegments(robot) {
    const segs = []
    // 障碍物线段
    for (const obs of this.scene.obstacles) {
      const s = obs.getSegments?.()
      if (s) segs.push(...s)
    }
    // 世界边界四条边
    const { width: W, height: H } = this.scene.world
    segs.push(
      [{ x: 0, y: 0 },     { x: W, y: 0 }],
      [{ x: W, y: 0 },     { x: W, y: H }],
      [{ x: W, y: H },     { x: 0, y: H }],
      [{ x: 0, y: H },     { x: 0, y: 0 }],
    )
    return segs
  }

  /** 更新机器人传感器数据 */
  _updateSensorData() {
    const robot = this.scene.robot
    const pos = robot.position

    // 光照强度
    robot.sensorData.light = this.lightSim.getIntensityAt(pos, this.scene)

    // 声音强度
    robot.sensorData.sound = this.soundSim.getIntensityAt(pos, this.scene)

    // 近距传感器（栅格地图有障碍时才计算）
    if (this.scene.obstacles.length > 0 && robot.visible) {
      this._updateProximitySensors(robot)
    } else {
      const prox = robot.sensorData.proximity
      prox.front = prox.frontLeft = prox.frontRight = prox.left = prox.right = Infinity
    }

    // 巡线检测（检测机器人前方 1 个半径处）
    if (this.scene.lineTrack) {
      const cos = Math.cos(robot.rotation)
      const sin = Math.sin(robot.rotation)
      const checkPt = {
        x: pos.x + cos * robot.radius * 1.2,
        y: pos.y + sin * robot.radius * 1.2,
      }
      const { detected, position } = this._detectLine(checkPt, this.scene.lineTrack)
      robot.sensorData.lineDetected = detected
      robot.sensorData.linePosition = position
    } else {
      robot.sensorData.lineDetected = false
      robot.sensorData.linePosition = null
    }
  }

  /**
   * 5 方向近距射线传感器
   * 从机器人表面发出射线，检测最近障碍物/边界距离（px）
   * 射线方向（机器人本地坐标系，+X = 前方）：
   *   front      0°
   *   frontLeft  +30°
   *   frontRight -30°
   *   left       +90°
   *   right      -90°
   */
  _updateProximitySensors(robot) {
    const RAY_ANGLES = {
      front:      0,
      frontLeft:  Math.PI / 6,    // 30°
      frontRight: -Math.PI / 6,   // -30°
      left:       Math.PI / 2,    // 90°
      right:      -Math.PI / 2,   // -90°
    }
    const MAX_DIST = 200   // 最大探测距离（px）

    const prox = robot.sensorData.proximity
    const { x: ox, y: oy } = robot.position
    const rot = robot.rotation
    const r = robot.radius
    const world = this.scene.world

    for (const [key, localAngle] of Object.entries(RAY_ANGLES)) {
      const worldAngle = rot + localAngle
      const dx = Math.cos(worldAngle)
      const dy = Math.sin(worldAngle)

      // 射线起点在机器人表面（向外偏移 r）
      const origin = { x: ox + dx * r, y: oy + dy * r }
      const dir    = { x: dx, y: dy }

      let minDist = MAX_DIST

      // 1. 与世界边界的距离
      minDist = Math.min(minDist,
        this._rayVsWorld(origin, dir, world, MAX_DIST))

      // 2. 与每个障碍物的距离
      for (const obs of this.scene.obstacles) {
        const d = this._rayVsObstacle(origin, dir, obs, MAX_DIST)
        if (d < minDist) minDist = d
      }

      prox[key] = minDist
    }
  }

  /**
   * 射线 vs 世界边界，返回最小 t（距离）
   */
  _rayVsWorld(origin, dir, world, maxDist) {
    let min = maxDist
    // 四条边界线段
    const segs = [
      [{ x: 0, y: 0 }, { x: world.width, y: 0 }],
      [{ x: world.width, y: 0 }, { x: world.width, y: world.height }],
      [{ x: world.width, y: world.height }, { x: 0, y: world.height }],
      [{ x: 0, y: world.height }, { x: 0, y: 0 }],
    ]
    for (const [a, b] of segs) {
      const t = this._raySegment(origin, dir, a, b)
      if (t !== null && t > 0.1 && t < min) min = t
    }
    return min
  }

  /**
   * 射线 vs 障碍物（rect/circle/polygon），返回最小 t
   */
  _rayVsObstacle(origin, dir, obs, maxDist) {
    // 粗筛：圆形包围盒剔除
    const aabb = obs.getAABB?.()
    if (aabb) {
      // 粗略估算：中心距 + 半径是否小于 maxDist
      const cx = (aabb.minX + aabb.maxX) / 2
      const cy = (aabb.minY + aabb.maxY) / 2
      const hw = (aabb.maxX - aabb.minX) / 2
      const hh = (aabb.maxY - aabb.minY) / 2
      const bsRadius = Math.sqrt(hw * hw + hh * hh)
      const cdx = cx - origin.x, cdy = cy - origin.y
      const proj = cdx * dir.x + cdy * dir.y
      if (proj < -bsRadius || proj > maxDist + bsRadius) return maxDist
    }

    let min = maxDist

    if (obs.type === 'circle') {
      const t = this._rayVsCircle(origin, dir, obs.position, obs.radius)
      if (t !== null && t > 0.1 && t < min) min = t
    } else {
      // rect 和 polygon 都用世界顶点线段测试
      const verts = obs.getWorldVertices?.()
      if (verts && verts.length >= 2) {
        for (let i = 0; i < verts.length; i++) {
          const a = verts[i]
          const b = verts[(i + 1) % verts.length]
          const t = this._raySegment(origin, dir, a, b)
          if (t !== null && t > 0.1 && t < min) min = t
        }
      }
    }
    return min
  }

  /**
   * 射线 vs 圆形（解析法）
   * @returns {number|null} t 值
   */
  _rayVsCircle(origin, dir, center, radius) {
    const fx = origin.x - center.x
    const fy = origin.y - center.y
    const a = dir.x * dir.x + dir.y * dir.y
    const b = 2 * (fx * dir.x + fy * dir.y)
    const c = fx * fx + fy * fy - radius * radius
    const disc = b * b - 4 * a * c
    if (disc < 0) return null
    const sqrtDisc = Math.sqrt(disc)
    const t1 = (-b - sqrtDisc) / (2 * a)
    const t2 = (-b + sqrtDisc) / (2 * a)
    if (t1 > 0.1) return t1
    if (t2 > 0.1) return t2
    return null
  }

  /**
   * 射线 vs 线段（MathUtils 版）
   */
  _raySegment(origin, dir, a, b) {
    return MathUtils.raySegmentIntersect(origin, dir, a, b)
  }

  /** 检测点是否在巡线上 */
  _detectLine(point, lineTrack) {
    if (!lineTrack || !lineTrack.pathSegments) return { detected: false, position: null }

    const threshold = lineTrack.trackWidth / 2 + 2
    for (const [a, b] of lineTrack.pathSegments) {
      const dx = b.x - a.x, dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 < 0.01) continue
      const t = Math.max(0, Math.min(1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2
      ))
      const closestX = a.x + t * dx
      const closestY = a.y + t * dy
      const distSq = (point.x - closestX) ** 2 + (point.y - closestY) ** 2
      if (distSq <= threshold * threshold) {
        return {
          detected: true,
          position: { x: point.x - closestX, y: point.y - closestY },
        }
      }
    }
    return { detected: false, position: null }
  }

  /** 键盘手动驾驶（在 _fixedUpdate 中轮询调用） */
  /** 自动驾驶（在 _fixedUpdate 中调用） */
  /**
   * 动态障碍物匀速往返（正弦插值）
   * motion: { id, axis, origin:{x,y}, range, speed, phase }
   */
  _updateDynamicObstacles(dt) {
    this._dynTime += dt
    for (const motion of this._dynamicObstacles) {
      const obs = this.scene.getObstacleById(motion.id)
      if (!obs) continue
      // 用正弦函数产生平滑往返：position = origin ± range/2 * sin(...)
      const t = this._dynTime * (motion.speed / motion.range) + motion.phase
      const offset = (motion.range / 2) * Math.sin(t)
      if (motion.axis === 'x') {
        obs.position.x = motion.origin.x + offset
      } else {
        obs.position.y = motion.origin.y + offset
      }
      obs.markDirty()
    }
    this.lightSim.markDirty()
  }

  /**
   * 迷宫出口检测：机器人进入出口格范围时触发地图重生
   */
  _checkMazeExit() {
    const exit = this.scene.mazeExit
    if (!exit || exit.triggered) return

    const robot = this.scene.robot
    if (!robot.visible) return

    const dx = robot.position.x - exit.pos.x
    const dy = robot.position.y - exit.pos.y
    const triggerRadius = Math.min(exit.cellW, exit.cellH) * 0.42

    if (dx * dx + dy * dy <= triggerRadius * triggerRadius) {
      exit.triggered = true
      EventBus.emit(EVENTS.MAZE_EXIT_REACHED, { exitCell: exit.cell })
    }
  }

  /** 应用来自外部控制接口的指令 */
  _applyCommand(cmd) {
    if (!cmd) return
    if (cmd.type === 'setDriveMode') {
      this.scene.robot.driveMode = 'manual'
    } else if (cmd.type === 'setVelocity') {
      this.scene.robot.targetVelocity = cmd.velocity
      this.scene.robot.targetAngularVelocity = cmd.angularVelocity ?? 0
    }
  }

  /** 注册引擎内部事件监听 */
  _setupEventListeners() {
    // 工具放置事件
    EventBus.on('tool:place:circle', ({ position, radius }) => {
      this.scene.addObstacle({ type: 'circle', position, radius })
    })

    EventBus.on('tool:place:rect', ({ position, width, height }) => {
      this.scene.addObstacle({ type: 'rect', position, width, height })
    })

    EventBus.on('tool:place:polygon', ({ position, vertices }) => {
      this.scene.addObstacle({ type: 'polygon', position, vertices })
    })

    EventBus.on('tool:place:light', ({ position }) => {
      this.scene.addLightSource({ position })
    })

    EventBus.on('tool:place:sound', ({ position }) => {
      this.scene.addSoundSource({ position })
    })

    // 渲染预览
    EventBus.on('render:preview', (preview) => {
      this._uiState.preview = preview
    })

    // 工具变更
    EventBus.on(EVENTS.INPUT_TOOL_CHANGED, (tool) => {
      this._uiState.tool = tool
    })

    // 车灯开关
    EventBus.on('ui:headlight', (enabled) => {
      this._uiState.headlightEnabled = enabled
    })

    // 传感器射线
    EventBus.on('ui:proximity', (enabled) => {
      this._uiState.showProximity = enabled
    })

    // 路径高亮
    // 运动轨迹
    EventBus.on('ui:trail', (enabled) => {
      this._uiState.showTrail = enabled
      if (!enabled) this._trailBuffer = []
    })

    // 地图重置时清空统计和轨迹
    EventBus.on('maze:regenerate', () => {
      this._stats = { elapsed: 0, distance: 0, collisions: 0 }
      this._trailBuffer = []
    })

    // 来自外部接口的机器人控制指令
    EventBus.on(EVENTS.ROBOT_COMMAND_APPLY, (cmd) => {
      this._applyCommand(cmd)
    })

    // 迷宫出口到达 → 延迟 0.6s 重新生成迷宫（给出口动画时间）
    EventBus.on(EVENTS.MAZE_EXIT_REACHED, () => {
      setTimeout(() => {
        EventBus.emit('maze:regenerate', {})
      }, 600)
    })
  }
}

// ─── 模块内辅助 ──────────────────────────────────────────────────────────────
function _normalizeAngle(a) {
  while (a >  Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}
