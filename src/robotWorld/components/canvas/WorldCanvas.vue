<template>
  <div class="world-canvas-wrapper" ref="containerRef">
    <canvas
      ref="mainCanvas"
      class="main-canvas"
      :style="canvasStyle"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @wheel.prevent="onWheel"
      @contextmenu.prevent="onContextMenu"
    />

    <!-- FPS 和坐标显示 -->
    <div class="canvas-hud">
      <span class="fps-badge">{{ fps }} FPS</span>
      <span class="coord-badge">{{ coordText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorldEngine } from '@composables/useWorldEngine'
import { useSimulationStore } from '@store/simulationStore'
import { useUiStore } from '@store/uiStore'

const containerRef = ref(null)
const mainCanvas = ref(null)
const mouseWorldPos = ref({ x: 0, y: 0 })
let fpsRafId = 0
let fpsFrameCount = 0
let fpsLastSampleAt = 0

const simStore = useSimulationStore()
const uiStore = useUiStore()
const { fps } = storeToRefs(simStore)
const { currentTool } = storeToRefs(uiStore)

const { engine, initEngine, destroyEngine } = useWorldEngine()

const coordText = computed(() => {
  const p = mouseWorldPos.value
  return `${Math.round(p.x)}, ${Math.round(p.y)}`
})

const canvasStyle = computed(() => {
  const cursors = {
    select: 'grab',
    circle: 'crosshair',
    rect: 'crosshair',
    polygon: 'crosshair',
  }
  return { cursor: cursors[currentTool.value] || 'default' }
})

function startFpsMonitor() {
  const tick = (timestamp) => {
    if (!fpsLastSampleAt) {
      fpsLastSampleAt = timestamp
    }

    fpsFrameCount += 1
    const elapsed = timestamp - fpsLastSampleAt
    if (elapsed >= 1000) {
      simStore.setFps(Math.round((fpsFrameCount * 1000) / elapsed))
      fpsFrameCount = 0
      fpsLastSampleAt = timestamp
    }

    fpsRafId = window.requestAnimationFrame(tick)
  }

  fpsRafId = window.requestAnimationFrame(tick)
}

function stopFpsMonitor() {
  if (fpsRafId) {
    window.cancelAnimationFrame(fpsRafId)
    fpsRafId = 0
  }
  fpsFrameCount = 0
  fpsLastSampleAt = 0
  simStore.setFps(0)
}

onMounted(async () => {
  const canvas = mainCanvas.value
  const container = containerRef.value

  // 根据容器尺寸设置 canvas 大小
  const resizeCanvas = () => {
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
  }
  resizeCanvas()

  await initEngine(canvas)
  engine.value?.renderFrame()
  startFpsMonitor()

  // 监听鼠标移动更新坐标显示

  // ── 键盘状态管理（供 WorldEngine._applyKeyboard 轮询） ──────
  // ResizeObserver 响应容器尺寸变化
  const ro = new ResizeObserver(() => {
    resizeCanvas()
    if (engine.value) {
      engine.value.camera.fitWorld(
        engine.value.scene.world.width,
        engine.value.scene.world.height,
        canvas.width,
        canvas.height,
      )
      engine.value.renderFrame()
    }
  })
  ro.observe(container)
  onUnmounted(() => ro.disconnect())
})

onUnmounted(() => {
  stopFpsMonitor()
  destroyEngine()
})

function onMouseDown(e) {
  engine.value?.input.onMouseDown(e)
  engine.value?.renderFrame()
}

function onMouseMove(e) {
  engine.value?.input.onMouseMove(e)
  if (engine.value) {
    const rect = mainCanvas.value.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    mouseWorldPos.value = engine.value.camera.screenToWorld(sx, sy)
    engine.value.renderFrame()
  }
}

function onMouseUp(e) {
  engine.value?.input.onMouseUp(e)
  engine.value?.renderFrame()
}

function onWheel(e) {
  engine.value?.input.onWheel(e)
  engine.value?.renderFrame()
}

function onContextMenu(e) {
  engine.value?.input.onContextMenu(e)
  engine.value?.renderFrame()
}
</script>

<style scoped>
.world-canvas-wrapper {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  flex: 1;
  overflow: hidden;
  background: linear-gradient(180deg, #0f1728 0%, #152033 100%);
  min-width: 0;
}

.main-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.canvas-hud {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 8px;
  pointer-events: none;
}

.fps-badge,
.coord-badge {
  background: rgba(244, 249, 255, 0.9);
  color: var(--accent);
  font-size: 11px;
  font-family: monospace;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid rgba(122, 149, 184, 0.18);
}
</style>
