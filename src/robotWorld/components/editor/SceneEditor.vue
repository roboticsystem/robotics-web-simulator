<template>
  <div class="editor-section">
    <div class="section-title">世界设置</div>

    <div class="field-row">
      <label>宽度</label>
      <input
        type="number"
        min="200"
        max="3000"
        step="10"
        :value="sceneWidth"
        @change="onSizeChange('width', $event)"
        class="field-input"
      />
      <span class="unit">px</span>
    </div>

    <div class="field-row">
      <label>高度</label>
      <input
        type="number"
        min="200"
        max="3000"
        step="10"
        :value="sceneHeight"
        @change="onSizeChange('height', $event)"
        class="field-input"
      />
      <span class="unit">px</span>
    </div>

    <div class="field-row">
      <label>背景色</label>
      <input
        type="color"
        :value="bgColor"
        @input="onBgColor($event)"
        class="field-color"
      />
      <span class="color-hex">{{ bgColor }}</span>
    </div>

    <div class="field-row">
      <label>边界色</label>
      <input
        type="color"
        :value="borderColor"
        @input="onBorderColor($event)"
        class="field-color"
      />
    </div>

    <div class="divider" />
    <div class="section-title">实体统计</div>

    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-num">{{ obstacleCount }}</span>
        <span class="stat-label">障碍物</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSceneStore } from '@store/sceneStore'
import { useSceneEditor } from '@composables/useSceneEditor'
import { useWorldEngine } from '@composables/useWorldEngine'

const sceneStore = useSceneStore()
const { sceneWidth, sceneHeight, obstacleList } = storeToRefs(sceneStore)

const { updateWorldSize } = useSceneEditor()
const { engine } = useWorldEngine()

const bgColor = computed(() => engine.value?.scene.world.backgroundColor ?? '#0d0d1a')
const borderColor = computed(() => engine.value?.scene.world.borderColor ?? '#4fc3f7')

const obstacleCount = computed(() => obstacleList.value.length)

function onSizeChange(dim, event) {
  const value = parseInt(event.target.value, 10)
  if (!value || value < 200) return

  const width = dim === 'width' ? value : sceneWidth.value
  const height = dim === 'height' ? value : sceneHeight.value
  updateWorldSize(width, height)
}

function onBgColor(event) {
  if (engine.value) {
    engine.value.scene.world.backgroundColor = event.target.value
    engine.value.renderFrame?.()
  }
}

function onBorderColor(event) {
  if (engine.value) {
    engine.value.scene.world.borderColor = event.target.value
    engine.value.renderFrame?.()
  }
}
</script>

<style scoped>
.editor-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-top: 6px;
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(15, 116, 144, 0.14), transparent);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-row label:first-child {
  font-size: 12px;
  color: var(--muted);
  width: 48px;
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  min-width: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: rgba(15, 116, 144, 0.34);
  box-shadow: 0 0 0 2px rgba(15, 116, 144, 0.08), inset 0 1px 0 rgba(15, 116, 144, 0.04);
}

.unit {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.field-color {
  width: 34px;
  height: 28px;
  padding: 2px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s;
}

.field-color:hover {
  border-color: rgba(15, 116, 144, 0.3);
}

.color-hex {
  font-size: 11px;
  color: var(--muted);
  font-family: monospace;
}

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(15, 116, 144, 0.12), transparent);
  margin: 6px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.stat-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
  font-family: monospace;
}

.stat-label {
  font-size: 11px;
  color: var(--muted);
}
</style>
