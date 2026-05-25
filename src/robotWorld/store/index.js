import { createPinia } from 'pinia'
export const pinia = createPinia()

export { useSceneStore } from './sceneStore'
export { useSimulationStore } from './simulationStore'
export { useUiStore } from './uiStore'
