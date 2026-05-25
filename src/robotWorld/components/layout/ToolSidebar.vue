<template>
  <div class="tool-sidebar">
    <div class="tool-group">
      <div class="group-label">工具</div>

      <button class="tool-btn" :class="{ active: currentTool === 'select' }" title="选择 / 移动" @click="setTool('select')">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 2L4 14L7.5 10.5L10 16L12 15L9.5 9.5H14L4 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>

      <button class="tool-btn" :class="{ active: currentTool === 'circle' }" title="绘制圆形障碍物" @click="setTool('circle')">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.6"/>
        </svg>
      </button>

      <button class="tool-btn" :class="{ active: currentTool === 'rect' }" title="绘制矩形障碍物" @click="setTool('rect')">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        </svg>
      </button>

      <button class="tool-btn" :class="{ active: currentTool === 'polygon' }" title="绘制多边形障碍物" @click="setTool('polygon')">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="10,3 17,7.5 17,13.5 10,17 3,13.5 3,7.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <div class="divider" />

    <div class="tool-group">
      <div class="group-label">场景</div>

      <button class="tool-btn" title="删除选中" @click="doDelete">
        <svg viewBox="0 0 20 20" fill="none">
          <polyline points="3,5.5 17,5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M8 5.5V3.5H12V5.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          <path d="M5 5.5L5.8 16.5H14.2L15 5.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          <line x1="8.5" y1="9" x2="8.5" y2="13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="11.5" y1="9" x2="11.5" y2="13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>

      <button class="tool-btn" title="保存场景" @click="doSave">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M4 3H13.5L17 6.5V17H4V3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          <rect x="7" y="3" width="6" height="5" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/>
          <rect x="5.5" y="11" width="9" height="5.5" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/>
          <line x1="10" y1="3.8" x2="10" y2="6.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>

      <button class="tool-btn" title="加载场景" @click="doLoad">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M3 6.5V16.5H17V6.5H10.5L8.5 4H3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          <line x1="10" y1="9" x2="10" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <polyline points="7.5,11.5 10,14 12.5,11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>

      <button class="tool-btn tool-btn-danger" title="清空场景" @click="doClear">
        <svg viewBox="0 0 20 20" fill="none">
          <line x1="3.5" y1="3.5" x2="16.5" y2="16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="16.5" y1="3.5" x2="3.5" y2="16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@store/uiStore'
import { useWorldEngine } from '@composables/useWorldEngine'
import { useSceneEditor } from '@composables/useSceneEditor'

const uiStore = useUiStore()
const { currentTool } = storeToRefs(uiStore)

const { setTool: engineSetTool, saveScene, loadScene } = useWorldEngine()
const { removeSelected, clearScene } = useSceneEditor()

function setTool(tool) {
  uiStore.setTool(tool)
  engineSetTool(tool)
}

function doDelete() {
  removeSelected()
}

function doSave() {
  saveScene('scene.json')
}

async function doLoad() {
  await loadScene()
}

function doClear() {
  if (confirm('确定要清空场景吗？')) {
    clearScene()
  }
}
</script>

<style scoped>
.tool-sidebar {
  width: 68px;
  background: var(--panel);
  border-right: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0 8px;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.tool-sidebar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(15, 116, 144, 0.1) 30%,
    rgba(37, 99, 235, 0.06) 70%,
    transparent 100%
  );
  pointer-events: none;
}

.tool-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  padding: 0 8px;
}

.group-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin: 8px 0 4px;
  user-select: none;
}

.tool-btn {
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #47607c;
  padding: 0;
  position: relative;
  overflow: hidden;
}

.tool-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.62) 0%, transparent 100%);
  border-radius: 12px 12px 0 0;
  pointer-events: none;
}

.tool-btn svg {
  width: 22px;
  height: 22px;
  display: block;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(148, 163, 184, 0.28);
  color: var(--text);
  transform: translateY(-1px);
  box-shadow:
    0 10px 22px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255,255,255,0.52);
}

.tool-btn:active {
  transform: translateY(0);
}

.tool-btn.active {
  background: linear-gradient(
    135deg,
    rgba(15, 116, 144, 0.14) 0%,
    rgba(37, 99, 235, 0.12) 100%
  );
  border-color: rgba(37, 99, 235, 0.22);
  color: #fff;
  box-shadow:
    0 12px 26px rgba(37, 99, 235, 0.18),
    inset 0 1px 0 rgba(255,255,255,0.14);
}

.tool-btn-danger:hover {
  background: rgba(194, 65, 12, 0.08);
  border-color: rgba(194, 65, 12, 0.22);
  color: var(--danger);
  box-shadow:
    0 8px 14px rgba(194, 65, 12, 0.08),
    inset 0 1px 0 rgba(255,255,255,0.42);
}

.divider {
  width: 36px;
  height: 1px;
  margin: 10px 0 8px;
  background: linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.3) 50%, transparent 100%);
  flex-shrink: 0;
}
</style>
