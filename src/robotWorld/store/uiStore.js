import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const currentTool = ref('select')
  const selectedEntityId = ref(null)
  const selectedEntityType = ref(null)

  const activePanelTab = ref('scene')

  const mapGenType = ref('lineTrack')
  const mapGenGridType = ref('sparse')
  const mapGenSeed = ref(12345)
  const mapGenTrackWidth = ref(20)
  const mapGenObstacleRatio = ref(0.25)
  const mapGenGridCols = ref(14)
  const mapGenGridRows = ref(10)
  const mapGenDynamicRatio = ref(0)

  const showProximity = ref(false)
  const showTrail = ref(false)

  function setTool(tool) {
    currentTool.value = tool
  }

  function selectEntity(id, type) {
    selectedEntityId.value = id
    selectedEntityType.value = type

    if (type === 'robot') activePanelTab.value = 'robot'
    else if (id) activePanelTab.value = 'obstacle'
  }

  function deselect() {
    selectedEntityId.value = null
    selectedEntityType.value = null
  }

  return {
    currentTool,
    selectedEntityId,
    selectedEntityType,
    activePanelTab,
    mapGenType,
    mapGenGridType,
    mapGenSeed,
    mapGenTrackWidth,
    mapGenObstacleRatio,
    mapGenGridCols,
    mapGenGridRows,
    mapGenDynamicRatio,
    showProximity,
    showTrail,
    setTool,
    selectEntity,
    deselect,
  }
})
