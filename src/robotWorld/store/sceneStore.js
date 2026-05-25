import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useSceneStore = defineStore('scene', () => {
  const sceneWidth = ref(800)
  const sceneHeight = ref(600)
  const backgroundColor = ref('#1a1a2e')

  const obstacleList = ref([])

  const robotInfo = reactive({
    position: { x: 100, y: 100 },
    rotation: 0,
    radius: 9,
    color: '#1e90ff',
    maxSpeed: 200,
    acceleration: 400,
    deceleration: 600,
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
    targetVelocity: { x: 0, y: 0 },
    targetAngularVelocity: 0,
    visible: false,
    sensorData: {
      collision: { left: false, right: false, front: false, back: false, any: false },
      lineDetected: false,
      linePosition: null,
    },
  })

  function setWorldSize(width, height) {
    sceneWidth.value = width
    sceneHeight.value = height
  }

  function syncFromEngine(scene) {
    sceneWidth.value = scene.world.width
    sceneHeight.value = scene.world.height
    backgroundColor.value = scene.world.backgroundColor

    obstacleList.value = scene.obstacles.map((obstacle) => ({
      id: obstacle.id,
      type: obstacle.type,
      label: obstacle.label,
      color: obstacle.color,
    }))

    const robot = scene.robot
    Object.assign(robotInfo.position, robot.position)
    robotInfo.rotation = robot.rotation
    robotInfo.radius = robot.radius
    robotInfo.color = robot.color
    robotInfo.maxSpeed = robot.maxSpeed
    robotInfo.acceleration = robot.acceleration
    robotInfo.deceleration = robot.deceleration
    robotInfo.velocity = { ...robot.velocity }
    robotInfo.angularVelocity = robot.angularVelocity
    robotInfo.targetVelocity = { ...robot.targetVelocity }
    robotInfo.targetAngularVelocity = robot.targetAngularVelocity
    robotInfo.visible = robot.visible
    Object.assign(robotInfo.sensorData, robot.sensorData)
    robotInfo.sensorData.collision = { ...robot.sensorData.collision }
  }

  return {
    sceneWidth,
    sceneHeight,
    backgroundColor,
    obstacleList,
    robotInfo,
    setWorldSize,
    syncFromEngine,
  }
})
