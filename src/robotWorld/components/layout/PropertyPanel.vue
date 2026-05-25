<template>
  <div class="property-panel">
    <div class="panel-tabs">
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="panel-content">
      <template v-if="activeTab === 'scene'">
        <SceneEditor />
      </template>

      <template v-else-if="activeTab === 'obstacle'">
        <ObstacleEditor :entity-id="selectedId" />
      </template>

      <template v-else-if="activeTab === 'robot'">
        <RobotEditor />
      </template>

      <template v-else-if="activeTab === 'mapgen'">
        <MapGenControls />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@store/uiStore'
import SceneEditor from '@components/editor/SceneEditor.vue'
import ObstacleEditor from '@components/editor/ObstacleEditor.vue'
import RobotEditor from '@components/editor/RobotEditor.vue'
import MapGenControls from '@components/toolbar/MapGenControls.vue'

const uiStore = useUiStore()
const {
  activePanelTab,
  selectedEntityId: selectedId,
  selectedEntityType
} = storeToRefs(uiStore)

const activeTab = ref('scene')

const allTabs = [
  { id: 'scene', label: '场景' },
  { id: 'obstacle', label: '障碍物', requireType: ['circle', 'rect', 'polygon'] },
  { id: 'robot', label: '机器人', requireType: ['robot'] },
  { id: 'mapgen', label: '地图生成' }
]

const visibleTabs = computed(() =>
  allTabs.filter((tab) => {
    if (!tab.requireType) {
      return true
    }
    return tab.requireType.includes(selectedEntityType.value)
  })
)

watch(
  activePanelTab,
  (value) => {
    activeTab.value = value || 'scene'
  },
  { immediate: true }
)

watch(
  visibleTabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.id === activeTab.value)) {
      activeTab.value = tabs[0]?.id || 'scene'
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.property-panel {
  width: 300px;
  background: var(--panel);
  border-left: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.property-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(37, 99, 235, 0.06) 30%,
    rgba(15, 116, 144, 0.1) 70%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

.panel-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px 8px 0;
  background: rgba(255, 255, 255, 0.46);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  position: relative;
}

.panel-tabs::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(148, 163, 184, 0.16) 50%,
    transparent 100%
  );
}

.tab-btn {
  padding: 5px 12px;
  font-size: 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  color: var(--muted);
  transition: all 0.15s ease;
  font-weight: 600;
  letter-spacing: 0.3px;
  position: relative;
}

.tab-btn:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.54);
  border-color: rgba(148, 163, 184, 0.18);
}

.tab-btn.active {
  color: var(--accent);
  border-color: rgba(13, 116, 109, 0.22);
  border-bottom-color: var(--panel);
  background: linear-gradient(
    180deg,
    rgba(10, 143, 132, 0.16) 0%,
    rgba(255, 255, 255, 0.92) 100%
  );
  text-shadow: none;
}

.tab-btn.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: linear-gradient(90deg, #0f7490, #2563eb);
  border-radius: 0 0 2px 2px;
  box-shadow: 0 0 6px rgba(15, 116, 144, 0.18);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #0f7490, #2563eb);
  border-radius: 2px;
  opacity: 0.4;
}
</style>
