<template>
  <div class="editor-section" v-if="entity">
    <div class="entity-header">
      <span class="entity-type-badge">🔊 声源</span>
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

    <div class="section-title">声音参数</div>

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
        :value="entity.maxRadius ?? 300"
        @change="patch({ maxRadius: +$event.target.value })"
      />
      <span class="unit">px</span>
    </div>

    <div class="field-row">
      <label>波速</label>
      <input type="number" step="5" min="10" max="500" class="field-input"
        :value="entity.waveSpeed ?? 80"
        @change="patch({ waveSpeed: +$event.target.value })"
      />
      <span class="unit">px/s</span>
    </div>

    <div class="field-row">
      <label>间隔</label>
      <input type="number" step="0.1" min="0.1" max="5" class="field-input"
        :value="entity.waveInterval ?? 1"
        @change="patch({ waveInterval: +$event.target.value })"
      />
      <span class="unit">s</span>
    </div>

    <div class="field-row">
      <label>播放</label>
      <label class="toggle">
        <input type="checkbox" :checked="entity.isPlaying !== false"
          @change="patch({ isPlaying: $event.target.checked })"
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

    <div class="divider" />
    <button class="danger-btn" @click="remove">🗑 删除</button>
  </div>

  <div class="empty-hint" v-else>未选中任何声源</div>
</template>

<script setup>
import { watch, ref } from 'vue'
import { useSceneEditor } from '@composables/useSceneEditor'

const props = defineProps({
  entityId: { type: String, default: null },
})

const { getSelectedEntity, updateSelectedEntity, removeSelected } = useSceneEditor()
const entity = ref(null)

watch(() => props.entityId, () => {
  entity.value = getSelectedEntity()
}, { immediate: true })

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
  background: rgba(100,220,255,0.2); color: #60dcf7;
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

.field-range { flex: 1; accent-color: #60dcf7; }
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
.toggle input:checked + .toggle-track { background: rgba(96,220,247,0.3); }
.toggle input:checked + .toggle-track::after { transform: translateX(14px); background: #60dcf7; }

.divider { height: 1px; background: #2a2a4a; margin: 4px 0; }

.danger-btn {
  background: rgba(255,80,80,0.1); border: 1px solid rgba(255,80,80,0.3);
  color: #ff6b6b; border-radius: 6px; padding: 5px 10px;
  font-size: 11px; cursor: pointer; transition: all 0.15s; width: 100%;
}
.danger-btn:hover { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.6); }

.empty-hint { font-size: 11px; color: #446; text-align: center; padding: 20px 0; }
</style>
