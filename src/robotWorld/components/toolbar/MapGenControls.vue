<template>
  <div class="mapgen-section">
    <!-- 地图类型 -->
    <div class="section-title">地图类型</div>
    <div class="type-tabs">
      <button
        v-for="t in mapTypes"
        :key="t.id"
        class="type-btn"
        :class="{ active: mapType === t.id }"
        @click="mapType = t.id"
      >{{ t.label }}</button>
    </div>

    <!-- 公共参数：随机种子 -->
    <div class="divider" />
    <div class="section-title">随机种子</div>
    <div class="field-row">
      <input type="number" step="1" min="1" max="99999" class="field-input"
        v-model.number="seed"
      />
      <button class="icon-btn" title="随机种子" @click="doRandomSeed">🎲</button>
    </div>

    <!-- 巡线地图参数 -->
    <template v-if="mapType === 'lineTrack'">
      <div class="divider" />
      <div class="section-title">巡线参数</div>
      <div class="field-row">
        <label>轨道宽</label>
        <input type="range" min="6" max="60" step="2" class="field-range"
          v-model.number="trackWidth"
        />
        <span class="range-val">{{ trackWidth }}px</span>
      </div>
    </template>

    <!-- 栅格地图参数 -->
    <template v-if="mapType === 'gridMap'">
      <div class="divider" />
      <div class="section-title">栅格参数</div>

      <div class="section-title sub">类型</div>
      <div class="type-tabs">
        <button
          v-for="t in gridTypes"
          :key="t.id"
          class="type-btn small"
          :class="{ active: gridType === t.id }"
          @click="gridType = t.id"
        >{{ t.label }}</button>
      </div>

      <div class="field-row">
        <label>列数</label>
        <input type="number" step="1" min="5" max="30" class="field-input"
          v-model.number="gridCols"
        />
      </div>
      <div class="field-row">
        <label>行数</label>
        <input type="number" step="1" min="5" max="30" class="field-input"
          v-model.number="gridRows"
        />
      </div>

      <!-- 迷宫额外提示 -->
      <div v-if="gridType === 'maze'" class="maze-hint">
        {{ gridCols }}×{{ gridRows }} = {{ gridCols * gridRows }} 格 &nbsp;·&nbsp;
        约 {{ Math.round((gridCols - 1) * gridRows * 0.6 + gridCols * (gridRows - 1) * 0.6) }} 段墙
      </div>

      <div class="field-row" v-if="gridType === 'sparse' || gridType === 'clusters'">
        <label>密度</label>
        <input type="range" min="0.05" max="0.8" step="0.05" class="field-range"
          v-model.number="obstacleRatio"
        />
        <span class="range-val">{{ Math.round(obstacleRatio * 100) }}%</span>
      </div>

      <!-- 动态障碍（sparse/clusters 模式） -->
      <div class="field-row" v-if="gridType === 'sparse' || gridType === 'clusters'">
        <label>动态</label>
        <input type="range" min="0" max="0.4" step="0.05" class="field-range"
          v-model.number="dynamicRatio"
        />
        <span class="range-val">{{ Math.round(dynamicRatio * 100) }}%</span>
      </div>
    </template>

    <!-- 生成按钮 -->
    <div class="divider" />
    <button class="generate-btn" @click="doGenerate">
      ⚡ 生成地图
    </button>

    <div v-if="lastGenTime" class="gen-info">
      上次生成：{{ lastGenTime }}ms
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@store/uiStore'
import { useMapGenerator } from '@composables/useMapGenerator'

const uiStore = useUiStore()
const {
  mapGenType, mapGenSeed, mapGenTrackWidth,
  mapGenGridType, mapGenGridCols, mapGenGridRows, mapGenObstacleRatio,
  mapGenDynamicRatio,
} = storeToRefs(uiStore)

const { generateLineTrack, generateGridMap, randomSeed } = useMapGenerator()

// 本地双向绑定（写入到 store）
const mapType = computed({
  get: () => mapGenType.value,
  set: v => { uiStore.mapGenType = v },
})
const seed = computed({
  get: () => mapGenSeed.value,
  set: v => { uiStore.mapGenSeed = v },
})
const trackWidth = computed({
  get: () => mapGenTrackWidth.value,
  set: v => { uiStore.mapGenTrackWidth = v },
})
const gridType = computed({
  get: () => mapGenGridType.value,
  set: v => { uiStore.mapGenGridType = v },
})
const gridCols = computed({
  get: () => mapGenGridCols.value,
  set: v => { uiStore.mapGenGridCols = v },
})
const gridRows = computed({
  get: () => mapGenGridRows.value,
  set: v => { uiStore.mapGenGridRows = v },
})
const obstacleRatio = computed({
  get: () => mapGenObstacleRatio.value,
  set: v => { uiStore.mapGenObstacleRatio = v },
})
const dynamicRatio = computed({
  get: () => mapGenDynamicRatio.value,
  set: v => { uiStore.mapGenDynamicRatio = v },
})

const lastGenTime = ref(null)

const mapTypes = [
  { id: 'lineTrack', label: '巡线地图' },
  { id: 'gridMap',   label: '栅格地图' },
]

const gridTypes = [
  { id: 'sparse',   label: '稀疏' },
  { id: 'maze',     label: '迷宫' },
  { id: 'clusters', label: '簇状' },
]

function doRandomSeed() {
  randomSeed()
}

function doGenerate() {
  const t0 = performance.now()
  if (mapType.value === 'lineTrack') {
    generateLineTrack()
  } else {
    generateGridMap()
  }
  lastGenTime.value = Math.round(performance.now() - t0)
}
</script>

<style scoped>
.mapgen-section { display: flex; flex-direction: column; gap: 6px; }

.section-title {
  font-size: 10px; font-weight: 700; color: var(--accent);
  text-transform: uppercase; letter-spacing: 1.2px;
  margin-top: 6px; margin-bottom: 3px;
  display: flex; align-items: center; gap: 6px;
}
.section-title::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, rgba(15,116,144,0.14), transparent);
}
.section-title.sub { font-size: 10px; margin-top: 2px; }

.type-tabs { display: flex; gap: 4px; }

.type-btn {
  flex: 1; padding: 6px 4px; font-size: 12px;
  background: rgba(255,255,255,0.7); border: 1px solid rgba(148,163,184,0.24);
  border-radius: 7px; color: var(--muted); cursor: pointer;
  transition: all 0.15s; font-weight: 600;
}
.type-btn:hover {
  color: var(--text); border-color: rgba(148,163,184,0.26);
  background: rgba(255,255,255,0.88);
  transform: translateY(-1px);
}
.type-btn.active {
  background: linear-gradient(135deg, rgba(10,143,132,0.14), rgba(255,255,255,0.92));
  border-color: rgba(13,116,109,0.22); color: var(--accent);
  box-shadow: 0 10px 20px rgba(15,23,42,0.08);
  text-shadow: none;
}
.type-btn.small { font-size: 11px; padding: 4px 2px; }

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(15,116,144,0.12), transparent);
  margin: 5px 0;
}

.field-row { display: flex; align-items: center; gap: 6px; }
.field-row label:first-child { font-size: 12px; color: var(--muted); width: 48px; flex-shrink: 0; }

.field-input {
  flex: 1; background: rgba(255,255,255,0.78);
  border: 1px solid rgba(148,163,184,0.28);
  border-radius: 6px; color: var(--text); font-size: 12px;
  padding: 5px 8px; outline: none; min-width: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-input:focus {
  border-color: rgba(15,116,144,0.34);
  box-shadow: 0 0 0 2px rgba(15,116,144,0.08);
}

.icon-btn {
  width: 32px; height: 32px; background: rgba(255,255,255,0.7);
  border: 1px solid rgba(148,163,184,0.24); border-radius: 7px;
  cursor: pointer; font-size: 15px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.icon-btn:hover {
  border-color: rgba(148,163,184,0.28);
  background: rgba(255,255,255,0.88);
  box-shadow: 0 10px 20px rgba(15,23,42,0.08);
  transform: scale(1.1) rotate(15deg);
}

.field-range { flex: 1; accent-color: var(--accent); }
.range-val { font-size: 11px; color: var(--muted); width: 40px; text-align: right; flex-shrink: 0; font-family: monospace; }

.maze-hint {
  font-size: 10px; color: var(--muted); text-align: center;
  padding: 3px 4px;
  background: rgba(15,116,144,0.05);
  border: 1px solid rgba(15,116,144,0.1);
  border-radius: 5px;
  font-family: monospace;
  letter-spacing: 0.3px;
}

.generate-btn {
  background: linear-gradient(135deg,
    rgba(10,143,132,0.14) 0%,
    rgba(255,255,255,0.92) 100%
  );
  border: 1px solid rgba(13,116,109,0.22);
  color: var(--accent); border-radius: 9px; padding: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  transition: all 0.18s; width: 100%;
  letter-spacing: 1px;
  position: relative; overflow: hidden;
  text-shadow: none;
}
.generate-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%; right: 0; bottom: 0;
  background: linear-gradient(90deg,
    transparent, rgba(255,255,255,0.05), transparent
  );
  width: 60%;
  transition: transform 0.4s;
}
.generate-btn:hover {
  background: linear-gradient(135deg,
    rgba(10,143,132,0.18) 0%,
    rgba(255,255,255,0.96) 100%
  );
  border-color: rgba(13,116,109,0.28);
  box-shadow:
    0 12px 24px rgba(15,23,42,0.08),
    inset 0 1px 0 rgba(255,255,255,0.52);
  transform: translateY(-1px);
}
.generate-btn:hover::before {
  transform: translateX(350%);
}
.generate-btn:active {
  transform: translateY(0px);
}

.gen-info {
  font-size: 10px; color: var(--muted); text-align: center;
  font-family: monospace; letter-spacing: 0.5px;
}
</style>
