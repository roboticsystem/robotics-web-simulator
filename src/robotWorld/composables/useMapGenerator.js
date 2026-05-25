import { useWorldEngine } from './useWorldEngine'
import { useSimulationStore } from '@store/simulationStore'
import { useUiStore } from '@store/uiStore'
import { useSceneStore } from '@store/sceneStore'
import EventBus from '@core/engine/EventBus'

let _mazeRegenerateRegistered = false

export function useMapGenerator() {
  const { engine, fitCameraToWorld } = useWorldEngine()
  const uiStore = useUiStore()
  const simStore = useSimulationStore()
  const sceneStore = useSceneStore()

  if (!_mazeRegenerateRegistered) {
    _mazeRegenerateRegistered = true
    EventBus.on('maze:regenerate', () => {
      const newSeed = Math.floor(Math.random() * 99999) + 1
      uiStore.mapGenSeed = newSeed
      generateGridMap({ seed: newSeed })
    })
  }

  function generateLineTrack(opts = {}) {
    if (!engine.value) return
    const scene = engine.value.scene
    const world = scene.world

    const data = engine.value.mapGen.generateLineTrack({
      width: world.width,
      height: world.height,
      trackWidth: opts.trackWidth ?? uiStore.mapGenTrackWidth,
      seed: opts.seed ?? uiStore.mapGenSeed,
      ...opts,
    })

    scene.clear()
    scene.lineTrack = data
    scene.mazeExit = null
    scene.gridParams = null
    engine.value.lightSim.markDirty()

    _resetRobotToStart(scene, data.controlPoints?.[0])
    sceneStore.syncFromEngine(scene)
    fitCameraToWorld()
    _ensureRunning()
  }

  function generateGridMap(opts = {}) {
    if (!engine.value) return
    const scene = engine.value.scene
    const world = scene.world
    const gridCols = opts.gridCols ?? uiStore.mapGenGridCols
    const gridRows = opts.gridRows ?? uiStore.mapGenGridRows
    const cellW = world.width / gridCols
    const cellH = world.height / gridRows
    const robotStartCell = opts.robotStartCell ?? { col: 0, row: 0 }
    const currentRobotStart = {
      x: (robotStartCell.col + 0.5) * cellW,
      y: (robotStartCell.row + 0.5) * cellH,
    }

    const data = engine.value.mapGen.generateGridMap({
      width: world.width,
      height: world.height,
      gridCols,
      gridRows,
      type: opts.mapType ?? uiStore.mapGenGridType,
      obstacleRatio: opts.obstacleRatio ?? uiStore.mapGenObstacleRatio,
      dynamicRatio: opts.dynamicRatio ?? uiStore.mapGenDynamicRatio,
      seed: opts.seed ?? uiStore.mapGenSeed,
      robotStartCell,
      ...opts,
    })

    scene.clear()
    for (const obsConfig of data.obstacles) {
      scene.addObstacle(obsConfig)
    }

    engine.value._dynamicObstacles = data.dynamicMotions ?? []
    scene.lineTrack = null
    scene.mazeExit = (data.exitPos && data.exitCell)
      ? {
          pos: data.exitPos,
          cell: data.exitCell,
          cellW: data.cellW,
          cellH: data.cellH,
          triggered: false,
        }
      : null

    scene.gridParams = {
      kind: 'gridMap',
      mapType: data.mapType ?? (opts.mapType ?? uiStore.mapGenGridType),
      cols: data.gridCols,
      rows: data.gridRows,
      cellW: data.cellW,
      cellH: data.cellH,
      start: { ...currentRobotStart },
      startCell: { ...robotStartCell },
      seed: data.seed ?? null,
      gridGraph: data.gridGraph ?? null,
    }

    _resetRobotToStart(scene, currentRobotStart)
    sceneStore.syncFromEngine(scene)
    fitCameraToWorld()
    _ensureRunning()
  }

  function randomSeed() {
    uiStore.mapGenSeed = Math.floor(Math.random() * 99999) + 1
  }

  function _resetRobotToStart(scene, startPos) {
    const robot = scene.robot
    robot.visible = true
    robot.position = startPos ? { ...startPos } : { x: 100, y: 100 }
    robot.rotation = 0
    robot.velocity = { x: 0, y: 0 }
    robot.angularVelocity = 0
    robot.targetVelocity = { x: 0, y: 0 }
    robot.targetAngularVelocity = 0
  }

  function _ensureRunning() {
    if (!simStore.isRunning) {
      engine.value?.start()
      simStore.setRunning(true)
      simStore.setPaused(false)
    }
  }

  return {
    generateLineTrack,
    generateGridMap,
    randomSeed,
  }
}
