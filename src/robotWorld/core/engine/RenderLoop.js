/**
 * RenderLoop — 基于 requestAnimationFrame 的渲染循环
 * 使用固定步长物理更新 + 每帧渲染插值，保证物理稳定性与渲染流畅性
 */
export class RenderLoop {
  /** @type {number|null} */
  _rafId = null
  _lastTime = 0
  _accumulator = 0
  _fixedStep = 1000 / 60  // 物理固定步长 ~16.67ms
  _maxDeltaTime = 100     // 防止标签页切换后的"死亡螺旋"

  _fps = 0
  _frameCount = 0
  _fpsTimer = 0

  /**
   * @param {object} callbacks
   * @param {Function} callbacks.onFixedUpdate - 固定步长物理/仿真更新，参数 dt(秒)
   * @param {Function} callbacks.onRender      - 每帧渲染，参数 alpha(插值系数), deltaMs
   * @param {Function} [callbacks.onStats]     - FPS 统计回调，参数 { fps }
   */
  constructor({ onFixedUpdate, onRender, onStats } = {}) {
    this.onFixedUpdate = onFixedUpdate
    this.onRender = onRender
    this.onStats = onStats
    this._tick = this._tick.bind(this)
  }

  /** 启动循环 */
  start() {
    if (this._rafId !== null) return
    this._lastTime = performance.now()
    this._accumulator = 0
    this._rafId = requestAnimationFrame(this._tick)
  }

  /** 停止循环 */
  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  get isRunning() {
    return this._rafId !== null
  }

  get fps() {
    return this._fps
  }

  _tick(timestamp) {
    this._rafId = requestAnimationFrame(this._tick)

    let deltaTime = timestamp - this._lastTime
    this._lastTime = timestamp

    // 防止超大 delta（标签页切换/断点调试）
    if (deltaTime > this._maxDeltaTime) deltaTime = this._maxDeltaTime

    // 固定步长积累与消费
    this._accumulator += deltaTime
    while (this._accumulator >= this._fixedStep) {
      try {
        this.onFixedUpdate?.(this._fixedStep / 1000)
      } catch (e) {
        console.error('[RenderLoop] onFixedUpdate error:', e)
      }
      this._accumulator -= this._fixedStep
    }

    // 插值系数（0~1），用于平滑位置插值渲染
    const alpha = this._accumulator / this._fixedStep
    try {
      this.onRender?.(alpha, deltaTime)
    } catch (e) {
      console.error('[RenderLoop] onRender error:', e)
    }

    // FPS 统计（每秒更新一次）
    this._fpsTimer += deltaTime
    this._frameCount++
    if (this._fpsTimer >= 1000) {
      this._fps = this._frameCount
      this._frameCount = 0
      this._fpsTimer -= 1000
      this.onStats?.({ fps: this._fps })
    }
  }
}
