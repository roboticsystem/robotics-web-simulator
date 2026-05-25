import { shallowRef } from 'vue'
import { WorldEngine } from '@core/engine/WorldEngine'
import { useSimulationStore } from '@store/simulationStore'
import { useUiStore } from '@store/uiStore'
import { useSceneStore } from '@store/sceneStore'
import { SceneSerializer } from '@core/scene/SceneSerializer'
import EventBus, { EVENTS } from '@core/engine/EventBus'

const SCENE_DRAFT_STORAGE_KEY = 'robot-world-scene-draft-v1'
const _engine = shallowRef(null)
let _lastSceneSnapshot = null
let _eventsBound = false

function disposeEngine() {
  if (!_engine.value) return

  _lastSceneSnapshot = _engine.value.scene.getSnapshot()
  writeSceneDraft(_lastSceneSnapshot)
  _engine.value.destroy()
  _engine.value = null
  _eventsBound = false
}

function readSceneDraft() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(SCENE_DRAFT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[useWorldEngine] 读取场景草稿失败:', error)
    return null
  }
}

function writeSceneDraft(snapshot) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SCENE_DRAFT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch (error) {
    console.warn('[useWorldEngine] 保存场景草稿失败:', error)
  }
}

function syncAndPersistScene(sceneStore) {
  if (!_engine.value?.scene) return

  const snapshot = _engine.value.scene.getSnapshot()
  _lastSceneSnapshot = snapshot
  writeSceneDraft(snapshot)
  sceneStore.syncFromEngine(_engine.value.scene)
}

export function useWorldEngine() {
  const simStore = useSimulationStore()
  const uiStore = useUiStore()
  const sceneStore = useSceneStore()

  function fitCameraToWorld() {
    if (!_engine.value) return

    _engine.value.camera.fitWorld(
      _engine.value.scene.world.width,
      _engine.value.scene.world.height,
      _engine.value.canvas.width,
      _engine.value.canvas.height,
    )
    _engine.value.renderFrame()
  }

  function bindEngineEvents() {
    if (_eventsBound) return
    _eventsBound = true

    EventBus.on(EVENTS.RENDER_FPS, (fps) => {
      simStore.setFps(fps)
    })

    EventBus.on(EVENTS.INPUT_ENTITY_SELECTED, ({ id, type }) => {
      uiStore.selectEntity(id, type)
    })

    EventBus.on(EVENTS.INPUT_ENTITY_DESELECTED, () => {
      uiStore.deselect()
    })

    EventBus.on(EVENTS.INPUT_TOOL_CHANGED, (tool) => {
      uiStore.setTool(tool)
    })

    let frameCount = 0
    EventBus.on(EVENTS.SIM_SENSOR_UPDATE, () => {
      frameCount += 1
      if (frameCount % 10 === 0 && _engine.value) {
        sceneStore.syncFromEngine(_engine.value.scene)
      }
    })

    EventBus.on(EVENTS.SIM_RESET, () => {
      syncAndPersistScene(sceneStore)
      _engine.value?.renderFrame()
    })

    EventBus.on(EVENTS.SCENE_ENTITY_UPDATED, () => {
      syncAndPersistScene(sceneStore)
    })

    EventBus.on(EVENTS.SCENE_CLEARED, () => {
      syncAndPersistScene(sceneStore)
    })

    EventBus.on(EVENTS.SCENE_LOADED, () => {
      syncAndPersistScene(sceneStore)
      fitCameraToWorld()
      _engine.value?.renderFrame()
    })
  }

  async function initEngine(canvas) {
    if (_engine.value) {
      disposeEngine()
    }

    _lastSceneSnapshot = _lastSceneSnapshot ?? readSceneDraft()
    _engine.value = new WorldEngine(canvas, _lastSceneSnapshot)

    bindEngineEvents()
    sceneStore.syncFromEngine(_engine.value.scene)
    writeSceneDraft(_engine.value.scene.getSnapshot())
    fitCameraToWorld()
    _engine.value.renderFrame()
    return _engine.value
  }

  function destroyEngine() {
    uiStore.deselect()
    uiStore.activePanelTab = 'scene'
    disposeEngine()
  }

  function setTool(tool) {
    _engine.value?.input.setTool(tool)
  }

  function saveScene(filename = 'scene.json') {
    if (!_engine.value) return
    const snapshot = _engine.value.scene.getSnapshot()
    writeSceneDraft(snapshot)
    SceneSerializer.download(snapshot, filename)
  }

  async function loadScene() {
    try {
      const snapshot = await SceneSerializer.loadFromFile()
      _engine.value?.scene.loadSnapshot(snapshot)
      _engine.value?.lightSim.markDirty()
      _lastSceneSnapshot = snapshot
      writeSceneDraft(snapshot)
      sceneStore.syncFromEngine(_engine.value.scene)
      fitCameraToWorld()
      _engine.value?.renderFrame()
    } catch (error) {
      console.error('[useWorldEngine] 加载场景失败:', error)
    }
  }

  return {
    engine: _engine,
    initEngine,
    destroyEngine,
    setTool,
    saveScene,
    loadScene,
    fitCameraToWorld,
  }
}
