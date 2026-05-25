import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSimulationStore = defineStore('simulation', () => {
  const isRunning = ref(false)
  const isPaused = ref(false)
  const fps = ref(0)
  const showGrid = ref(true)
  const showSensorData = ref(true)

  function setRunning(value) {
    isRunning.value = value
  }

  function setPaused(value) {
    isPaused.value = value
  }

  function setFps(value) {
    fps.value = value
  }

  return {
    isRunning,
    isPaused,
    fps,
    showGrid,
    showSensorData,
    setRunning,
    setPaused,
    setFps,
  }
})
