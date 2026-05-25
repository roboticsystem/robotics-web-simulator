import { useWorldEngine } from './useWorldEngine'
import { useSimulationStore } from '@store/simulationStore'
import EventBus, { EVENTS } from '@core/engine/EventBus'

/**
 * useSimulation — 仿真控制 Composable
 */
export function useSimulation() {
  const { engine } = useWorldEngine()
  const simStore = useSimulationStore()

  function start() {
    engine.value?.start()
    simStore.setRunning(true)
    simStore.setPaused(false)
  }

  function pause() {
    engine.value?.pause()
    simStore.setPaused(true)
  }

  function reset() {
    engine.value?.reset()
    simStore.setRunning(false)
    simStore.setPaused(false)
  }

  function stepOnce() {
    engine.value?.stepFrame()
  }

  return {
    isRunning: () => simStore.isRunning,
    isPaused: () => simStore.isPaused,
    fps: () => simStore.fps,
    start, pause, reset, stepOnce,
  }
}
