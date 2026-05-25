import { useWorldEngine } from './useWorldEngine'
import EventBus, { EVENTS } from '@core/engine/EventBus'

/**
 * useSceneEditor — 场景编辑操作 Composable
 */
export function useSceneEditor() {
  const { engine } = useWorldEngine()

  function addObstacle(config) {
    return engine.value?.scene.addObstacle(config)
  }

function removeObstacle(id) {
    // 如果选中的是此障碍物，先取消选中
    engine.value?.selection.deselect()
    engine.value?.scene.removeObstacle(id)
    engine.value?.lightSim?.markDirty()
    engine.value?.renderFrame()
  }

  function removeSelected() {
    const id = engine.value?.selection.selectedId
    const type = engine.value?.selection.selectedType
    if (!id) return

    engine.value?.selection.deselect()

    if (type === 'circle' || type === 'rect' || type === 'polygon') {
      engine.value?.scene.removeObstacle(id)
      engine.value?.lightSim?.markDirty()
    }
    engine.value?.renderFrame()
  }

  function clearScene() {
    engine.value?.selection.deselect()
    engine.value?.scene.clear()
    engine.value?.lightSim?.markDirty()
    engine.value?.renderFrame()
  }

  function updateWorldSize(width, height) {
    engine.value?.scene.updateWorld({ width, height })
    engine.value?.camera.fitWorld(
      width, height,
      engine.value.canvas.width,
      engine.value.canvas.height,
    )
    engine.value?.lightSim?.markDirty()
    engine.value?.renderFrame()
  }

  /** 更新选中实体的属性 */
  function updateSelectedEntity(patch) {
    const id = engine.value?.selection.selectedId
    const type = engine.value?.selection.selectedType
    if (!id || !type) return

    const scene = engine.value.scene
    if (type === 'circle' || type === 'rect' || type === 'polygon') {
      scene.updateObstacle(id, patch)
      engine.value.lightSim?.markDirty()
    } else if (type === 'robot') {
      scene.updateRobot(patch)
    }
    engine.value?.renderFrame()
  }

  /** 获取选中实体对象 */
  function getSelectedEntity() {
    return engine.value?.selection.getSelected() ?? null
  }

  return {
    addObstacle, removeObstacle, removeSelected,
    clearScene, updateWorldSize,
    updateSelectedEntity, getSelectedEntity,
  }
}
