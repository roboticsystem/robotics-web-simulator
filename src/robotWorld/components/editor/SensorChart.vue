<template>
  <canvas ref="canvasRef" class="sensor-chart" :width="canvasW" :height="60" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import EventBus, { EVENTS } from '@core/engine/EventBus'

const props = defineProps({
  maxSpeed: { type: Number, default: 200 },
})

const canvasRef = ref(null)
const canvasW   = 240   // 固定逻辑宽度，CSS 拉伸

// 环形缓冲：300 个采样点 × 100ms = 30s
const BUF_LEN = 300
const lightBuf  = new Float32Array(BUF_LEN)
const soundBuf  = new Float32Array(BUF_LEN)
const speedBuf  = new Float32Array(BUF_LEN)
let   bufHead   = 0   // 下一个写入位置（最新点）

let _unsub = null
let _rafId = null

onMounted(() => {
  // 订阅传感器更新事件
  _unsub = EventBus.on(EVENTS.SIM_SENSOR_UPDATE, (data) => {
    lightBuf[bufHead] = Math.min(1, Math.max(0, data.light ?? 0))
    soundBuf[bufHead] = Math.min(1, Math.max(0, data.sound ?? 0))
    // speed 需要从外部传入或在此处估算；这里接受 velocity 字段
    const vx = data.velocity?.x ?? 0
    const vy = data.velocity?.y ?? 0
    speedBuf[bufHead] = Math.min(1, Math.hypot(vx, vy) / (props.maxSpeed || 200))
    bufHead = (bufHead + 1) % BUF_LEN
  })

  _draw()
})

onUnmounted(() => {
  _unsub?.()
  if (_rafId) cancelAnimationFrame(_rafId)
})

function _draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  _rafId = requestAnimationFrame(_draw)

  const ctx = canvas.getContext('2d')
  const W = canvasW, H = 60

  // 背景
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(10,18,35,0.75)'
  ctx.fillRect(0, 0, W, H)

  // 网格线（3条水平）
  ctx.strokeStyle = 'rgba(79,195,247,0.07)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    const y = H * i / 4
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // 绘制三条折线
  _drawLine(ctx, lightBuf, '#ffd060', W, H)
  _drawLine(ctx, soundBuf, '#4fc3f7', W, H)
  _drawLine(ctx, speedBuf, '#00e878', W, H)

  // 图例（右下角）
  _legend(ctx, W, H)
}

function _drawLine(ctx, buf, color, W, H) {
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.5
  ctx.globalAlpha = 0.85

  for (let i = 0; i < BUF_LEN; i++) {
    // 从最旧到最新：index = (bufHead + i) % BUF_LEN
    const idx = (bufHead + i) % BUF_LEN
    const x   = (i / (BUF_LEN - 1)) * W
    const y   = H - buf[idx] * (H - 4) - 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

function _legend(ctx, W, H) {
  const items = [
    { color: '#ffd060', label: '光' },
    { color: '#4fc3f7', label: '声' },
    { color: '#00e878', label: '速' },
  ]
  ctx.font = '9px monospace'
  ctx.textBaseline = 'bottom'
  let x = W - 4
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    ctx.fillStyle = item.color
    ctx.globalAlpha = 0.70
    const tw = ctx.measureText(item.label).width
    ctx.fillText(item.label, x - tw, H - 2)
    x -= tw + 8
  }
  ctx.globalAlpha = 1
}
</script>

<style scoped>
.sensor-chart {
  width: 100%;
  height: 60px;
  display: block;
  border-radius: 6px;
  border: 1px solid rgba(79,195,247,0.10);
}
</style>
