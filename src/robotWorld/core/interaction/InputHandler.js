import EventBus, { EVENTS } from '../engine/EventBus'
import { MathUtils } from '@utils/MathUtils'

/**
 * InputHandler — 鼠标/触摸事件统一处理器
 * 将底层 DOM 事件翻译为高级语义操作（选中、拖拽、绘制）
 */
export class InputHandler {
  constructor(canvas, scene, selectionManager, dragController, camera, resizeController = null) {
    this._canvas = canvas
    this._scene = scene
    this._selection = selectionManager
    this._drag = dragController
    this._camera = camera
    this._resize = resizeController

    this._currentTool = 'select'   // 'select' | 'circle' | 'rect' | 'polygon'
    this._mouseDown = false
    this._mousePos = { x: 0, y: 0 }

    // 多边形绘制状态
    this._polyPoints = []
    this._isDrawingPoly = false

    // 圆形绘制状态
    this._circleStart = null

    // 相机拖拽（右键/中键）
    this._cameraDrag = false
    this._cameraDragStart = { x: 0, y: 0 }
    this._cameraStartOffset = { x: 0, y: 0 }

    this._bindEvents()
  }

  setTool(tool) {
    this._currentTool = tool
    // 取消进行中的绘制
    this._polyPoints = []
    this._isDrawingPoly = false
    this._circleStart = null
    EventBus.emit(EVENTS.INPUT_TOOL_CHANGED, tool)
  }

  get currentTool() { return this._currentTool }
  get polyPoints() { return this._polyPoints }
  get isDrawingPoly() { return this._isDrawingPoly }

  /**
   * 供外部（Vue 组件）调用的鼠标事件处理方法
   */
  onMouseDown(e) {
    e.preventDefault()
    this._mouseDown = true
    const world = this._getWorldPos(e)

    if (e.button === 1 || e.button === 2) {
      // 中键/右键：相机平移
      this._cameraDrag = true
      this._cameraDragStart = { x: e.clientX, y: e.clientY }
      this._cameraStartOffset = { x: this._camera.x, y: this._camera.y }
      return
    }

    switch (this._currentTool) {
      case 'select':
        // 优先检测 resize handle（只针对已选中障碍物）
        if (this._resize?.startResize(world)) break
        this._selection.selectAt(world)
        if (this._drag.startDrag(world)) {
          // 开始拖拽
        }
        break

      case 'circle':
        this._circleStart = { ...world }
        break

      case 'rect':
        this._circleStart = { ...world }
        break

      case 'polygon':
        if (!this._isDrawingPoly) {
          this._isDrawingPoly = true
          this._polyPoints = [{ ...world }]
        } else {
          this._polyPoints.push({ ...world })
        }
        break
    }
  }

  onMouseMove(e) {
    const world = this._getWorldPos(e)
    this._mousePos = world

    if (this._cameraDrag) {
      const dx = e.clientX - this._cameraDragStart.x
      const dy = e.clientY - this._cameraDragStart.y
      if (this._camera) {
        this._camera.x = this._cameraStartOffset.x + dx
        this._camera.y = this._cameraStartOffset.y + dy
      }
      return
    }

    if (this._mouseDown) {
      if (this._resize?.isResizing) {
        this._resize.resize(world)
      } else {
        this._drag.drag(world)
      }
    }

    // 发布预览数据（供 UIOverlayLayer 绘制）
    this._emitPreview(world)
  }

  onMouseUp(e) {
    this._mouseDown = false
    this._cameraDrag = false
    const world = this._getWorldPos(e)

    if (this._currentTool === 'circle' && this._circleStart) {
      const radius = MathUtils.dist(this._circleStart, world)
      if (radius > 5) {
        EventBus.emit('tool:place:circle', { position: { ...this._circleStart }, radius })
      }
      this._circleStart = null
    }

    if (this._currentTool === 'rect' && this._circleStart) {
      const w = Math.abs(world.x - this._circleStart.x)
      const h = Math.abs(world.y - this._circleStart.y)
      if (w > 5 && h > 5) {
        const cx = (this._circleStart.x + world.x) / 2
        const cy = (this._circleStart.y + world.y) / 2
        EventBus.emit('tool:place:rect', { position: { x: cx, y: cy }, width: w, height: h })
      }
      this._circleStart = null
    }

    this._resize?.endResize()
    this._drag.endDrag()
  }

  onWheel(e) {
    e.preventDefault()
    if (this._camera) {
      const rect = this._canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      this._camera.zoomAt(e.deltaY < 0 ? 1 : -1, cx, cy)
    }
  }

  onContextMenu(e) {
    e.preventDefault()

    if (this._isDrawingPoly && this._polyPoints.length >= 3) {
      // 右键完成多边形绘制
      this._finishPolygon()
    } else {
      // 右键取消绘制
      this._polyPoints = []
      this._isDrawingPoly = false
    }
  }

  onDblClick(e) {
    if (this._isDrawingPoly && this._polyPoints.length >= 3) {
      this._finishPolygon()
    }
  }

  _finishPolygon() {
    // 将屏幕坐标多边形转换为相对质心的本地顶点
    const pts = this._polyPoints
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const vertices = pts.map(p => ({ x: p.x - cx, y: p.y - cy }))

    EventBus.emit('tool:place:polygon', {
      position: { x: cx, y: cy },
      vertices,
    })

    this._polyPoints = []
    this._isDrawingPoly = false
  }

  _emitPreview(world) {
    let preview = null

    if (this._currentTool === 'circle' && this._circleStart) {
      preview = {
        type: 'circle',
        x: this._circleStart.x,
        y: this._circleStart.y,
        radius: MathUtils.dist(this._circleStart, world),
      }
    } else if (this._currentTool === 'rect' && this._circleStart) {
      preview = {
        type: 'rect',
        points: [
          this._circleStart,
          { x: world.x, y: this._circleStart.y },
          world,
          { x: this._circleStart.x, y: world.y },
        ],
        closed: true,
      }
    } else if (this._isDrawingPoly && this._polyPoints.length > 0) {
      preview = {
        type: 'polygon',
        points: [...this._polyPoints, world],
        closed: false,
      }
    }

    EventBus.emit('render:preview', preview)
  }

  _getWorldPos(e) {
    const rect = this._canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    return this._camera
      ? this._camera.screenToWorld(sx, sy)
      : { x: sx, y: sy }
  }

  _bindEvents() {
    // 双击完成多边形
    this._canvas.addEventListener('dblclick', (e) => this.onDblClick(e))
  }
}
