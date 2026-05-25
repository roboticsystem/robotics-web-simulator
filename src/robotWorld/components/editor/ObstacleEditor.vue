<template>
  <div class="editor-section" v-if="entity">
    <div class="entity-header">
      <span class="entity-type-badge" :class="entity.type">{{ typeLabel }}</span>
      <span class="entity-id">{{ entity.id?.slice(-6) }}</span>
    </div>

    <!-- 位置 -->
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

    <!-- 旋转（矩形/多边形） -->
    <template v-if="entity.type !== 'circle'">
      <div class="field-row">
        <label>旋转</label>
        <input type="number" step="1" min="-180" max="180" class="field-input"
          :value="Math.round((entity.rotation ?? 0) * 180 / Math.PI)"
          @change="patch({ rotation: +$event.target.value * Math.PI / 180 })"
        />
        <span class="unit">°</span>
      </div>
    </template>

    <!-- 圆形特有 -->
    <template v-if="entity.type === 'circle'">
      <div class="section-title">形状</div>
      <div class="field-row">
        <label>半径</label>
        <input type="number" step="1" min="5" max="500" class="field-input"
          :value="entity.radius ?? 30"
          @change="patch({ radius: +$event.target.value })"
        />
        <span class="unit">px</span>
      </div>
    </template>

    <!-- 矩形特有 -->
    <template v-if="entity.type === 'rect'">
      <div class="section-title">形状</div>
      <div class="field-row">
        <label>宽度</label>
        <input type="number" step="1" min="5" max="800" class="field-input"
          :value="entity.width ?? 60"
          @change="patch({ width: +$event.target.value })"
        />
        <span class="unit">px</span>
      </div>
      <div class="field-row">
        <label>高度</label>
        <input type="number" step="1" min="5" max="800" class="field-input"
          :value="entity.height ?? 40"
          @change="patch({ height: +$event.target.value })"
        />
        <span class="unit">px</span>
      </div>
    </template>

    <!-- 多边形顶点数 (只读显示) -->
    <template v-if="entity.type === 'polygon'">
      <div class="section-title">形状</div>
      <div class="field-row">
        <label>顶点</label>
        <span class="field-readonly">{{ entity.vertices?.length ?? 0 }} 个</span>
      </div>
    </template>

    <!-- 外观 -->
    <div class="section-title">外观</div>
    <div class="field-row">
      <label>颜色</label>
      <input type="color" class="field-color"
        :value="entity.color ?? '#6699cc'"
        @input="patch({ color: $event.target.value })"
      />
      <span class="color-hex">{{ entity.color }}</span>
    </div>
    <div class="field-row">
      <label>透明度</label>
      <input type="range" min="0.1" max="1" step="0.05" class="field-range"
        :value="entity.opacity ?? 1"
        @input="patch({ opacity: +$event.target.value })"
      />
      <span class="range-val">{{ Math.round((entity.opacity ?? 1) * 100) }}%</span>
    </div>

    <!-- 静态 -->
    <div class="field-row">
      <label>静态</label>
      <label class="toggle">
        <input type="checkbox" :checked="entity.isStatic !== false"
          @change="patch({ isStatic: $event.target.checked })"
        />
        <span class="toggle-track" />
      </label>
    </div>

    <div class="divider" />
    <button class="danger-btn" @click="remove">🗑 删除</button>
  </div>

  <div class="empty-hint" v-else>
    未选中任何障碍物
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { useSceneEditor } from '@composables/useSceneEditor'

const props = defineProps({
  entityId: { type: String, default: null },
})

const { getSelectedEntity, updateSelectedEntity, removeSelected } = useSceneEditor()

// 本地缓存，每次 entityId 变化时重新获取
const entity = ref(null)

watch(() => props.entityId, () => {
  entity.value = getSelectedEntity()
}, { immediate: true })

const typeLabel = computed(() => {
  const map = { circle: '圆形', rect: '矩形', polygon: '多边形' }
  return map[entity.value?.type] ?? entity.value?.type ?? '未知'
})

function patch(p) {
  updateSelectedEntity(p)
  // 刷新本地副本
  entity.value = getSelectedEntity()
}

function remove() {
  removeSelected()
  entity.value = null
}
</script>

<style scoped>
.editor-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.entity-type-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  letter-spacing: 0.5px;
}

.entity-type-badge.circle  { background: rgba(15,116,144,0.12); color: var(--accent); }
.entity-type-badge.rect    { background: rgba(37,99,235,0.1); color: #2563eb; }
.entity-type-badge.polygon { background: rgba(14,165,233,0.1); color: #0284c7; }

.entity-id {
  font-size: 9px;
  color: var(--muted);
  font-family: monospace;
}

.section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-top: 4px;
  margin-bottom: 2px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-row label:first-child {
  font-size: 11px;
  color: var(--muted);
  width: 44px;
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 4px;
  color: var(--text);
  font-size: 11px;
  padding: 3px 6px;
  outline: none;
  min-width: 0;
}
.field-input:focus { border-color: rgba(15, 116, 144, 0.34); }

.field-readonly {
  font-size: 11px;
  color: var(--muted);
}

.unit {
  font-size: 10px;
  color: var(--muted);
  flex-shrink: 0;
}

.field-color {
  width: 32px;
  height: 24px;
  padding: 1px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.color-hex {
  font-size: 10px;
  color: var(--muted);
  font-family: monospace;
}

.field-range {
  flex: 1;
  accent-color: var(--accent);
}

.range-val {
  font-size: 10px;
  color: var(--muted);
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.toggle {
  position: relative;
  cursor: pointer;
}
.toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: inline-block;
  width: 30px;
  height: 16px;
  background: rgba(122, 149, 184, 0.24);
  border-radius: 8px;
  position: relative;
  transition: background 0.2s;
}
.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: var(--muted);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}
.toggle input:checked + .toggle-track { background: rgba(15,116,144,0.24); }
.toggle input:checked + .toggle-track::after { transform: translateX(14px); background: var(--accent); }

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(122, 149, 184, 0.34), transparent);
  margin: 4px 0;
}

.danger-btn {
  background: rgba(194,65,12,0.08);
  border: 1px solid rgba(194,65,12,0.22);
  color: var(--danger);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
}
.danger-btn:hover {
  background: rgba(194,65,12,0.12);
  border-color: rgba(194,65,12,0.34);
}

.empty-hint {
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  padding: 20px 0;
}
</style>
