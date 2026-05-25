<template>
  <div class="editor-section" v-if="entity">
    <div class="entity-header">
      <span class="entity-type-badge">💡 光源</span>
      <span class="entity-id">{{ entity.id?.slice(-6) }}</span>
    </div>

    <div class="section-title">位置</div>
    <div class="field-row">
      <label>X</label>
      <input type="number" step="1" class="field-input"
        :value="Math.round(entity.position?.x ?? 0)"
        @change="patch({ position: { x: +$event.target.value, y: entity.position?.y ?? 0 } })"
      />
    </div>
    <div class="field-row">
      <label>Y</label>
      <input type="number" step="1" class="field-input"
        :value="Math.round(entity.position?.y ?? 0)"
        @change="patch({ position: { x: entity.position?.x ?? 0, y: +$event.target.value } })"
      />
    </div>

    <div class="section-title">光照参数</div>
    <div class="field-row">
      <label>强度</label>
      <input type="range" min="0.1" max="2" step="0.05" class="field-range"
        :value="entity.intensity ?? 1"
        @input="patch({ intensity: +$event.target.value })"
      />
      <span class="range-val">{{ ((entity.intensity ?? 1)).toFixed(2) }}</span>
    </div>

    <div class="field-row">
      <label>范围</label>
      <input type="number" step="10" min="20" max="1200" class="field-input"
        :value="entity.maxRadius ?? 200"
        @change="patch({ maxRadius: +$event.target.value })"
      />
      <span class="unit">px</span>
    </div>

    <div class="field-row">
      <label>颜色</label>
      <input type="color" class="field-color"
        :value="entity.color ?? '#ffffff'"
        @input="patch({ color: $event.target.value })"
      />
      <span class="color-hex">{{ entity.color }}</span>
    </div>

    <div class="field-row">
      <label>投影</label>
      <label class="toggle">
        <input type="checkbox" :checked="entity.castShadows !== false"
          @change="patch({ castShadows: $event.target.checked })"
        />
        <span class="toggle-track" />
      </label>
    </div>

    <div class="field-row">
      <label>启用</label>
      <label class="toggle">
        <input type="checkbox" :checked="entity.enabled !== false"
          @change="patch({ enabled: $event.target.checked })"
        />
        <span class="toggle-track" />
      </label>
    </div>

    <!-- 预览色块 -->
    <div class="light-preview" :style="previewStyle" />

    <div class="divider" />
    <button class="danger-btn" @click="remove">🗑 删除</button>
  </div>

  <div class="empty-hint" v-else>未选中任何光源</div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { useSceneEditor } from '@composables/useSceneEditor'

const props = defineProps({
  entityId: { type: String, default: null },
})

const { getSelectedEntity, updateSelectedEntity, removeSelected } = useSceneEditor()
const entity = ref(null)

watch(() => props.entityId, () => {
  entity.value = getSelectedEntity()
}, { immediate: true })

const previewStyle = computed(() => {
  const color = entity.value?.color ?? '#ffffff'
  const intensity = entity.value?.intensity ?? 1
  return {
    background: `radial-gradient(circle, ${color}${Math.round(Math.min(intensity, 1) * 200 + 55).toString(16).padStart(2,'0')} 0%, transparent 70%)`,
  }
})

function patch(p) {
  updateSelectedEntity(p)
  entity.value = getSelectedEntity()
}

function remove() {
  removeSelected()
  entity.value = null
}
</script>

<style scoped>
.editor-section { display: flex; flex-direction: column; gap: 6px; }

.entity-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }

.entity-type-badge {
  font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(255,220,100,0.2); color: #ffd060;
  letter-spacing: 0.5px;
}

.entity-id { font-size: 9px; color: #446; font-family: monospace; }

.section-title {
  font-size: 10px; font-weight: 600; color: #556;
  text-transform: uppercase; letter-spacing: 0.8px;
  margin-top: 4px; margin-bottom: 2px;
}

.field-row { display: flex; align-items: center; gap: 6px; }
.field-row label:first-child { font-size: 11px; color: #99a; width: 44px; flex-shrink: 0; }

.field-input {
  flex: 1; background: #1a1a36; border: 1px solid #2a2a4a;
  border-radius: 4px; color: #ccd; font-size: 11px;
  padding: 3px 6px; outline: none; min-width: 0;
}
.field-input:focus { border-color: #4fc3f7; }

.unit { font-size: 10px; color: #556; flex-shrink: 0; }

.field-color {
  width: 32px; height: 24px; padding: 1px;
  border: 1px solid #2a2a4a; border-radius: 4px;
  background: transparent; cursor: pointer;
}
.color-hex { font-size: 10px; color: #668; font-family: monospace; }

.field-range { flex: 1; accent-color: #ffd060; }
.range-val { font-size: 10px; color: #668; width: 36px; text-align: right; flex-shrink: 0; }

.toggle { position: relative; cursor: pointer; }
.toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: inline-block; width: 30px; height: 16px;
  background: #2a2a4a; border-radius: 8px;
  position: relative; transition: background 0.2s;
}
.toggle-track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; background: #556;
  border-radius: 50%; transition: transform 0.2s, background 0.2s;
}
.toggle input:checked + .toggle-track { background: rgba(255,208,96,0.3); }
.toggle input:checked + .toggle-track::after { transform: translateX(14px); background: #ffd060; }

.light-preview {
  height: 60px; border-radius: 8px;
  border: 1px solid #2a2a4a; margin-top: 4px;
}

.divider { height: 1px; background: #2a2a4a; margin: 4px 0; }

.danger-btn {
  background: rgba(255,80,80,0.1); border: 1px solid rgba(255,80,80,0.3);
  color: #ff6b6b; border-radius: 6px; padding: 5px 10px;
  font-size: 11px; cursor: pointer; transition: all 0.15s; width: 100%;
}
.danger-btn:hover { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.6); }

.empty-hint { font-size: 11px; color: #446; text-align: center; padding: 20px 0; }
</style>
