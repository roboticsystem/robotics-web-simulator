// 场景默认配置与障碍物生成
import { randomUUID } from 'crypto';

export function createDefaultScene() {
  return {
    sceneId: 'scene_001',
    ambientLight: 0.35,
    scale: 1,
    robot: {
      x: 2,
      y: 3,
      theta: 0,
      vx: 0,
      vy: 0,
    },
    obstacles: [
      {
        id: 'ob_1',
        x: 5,
        y: 4,
        width: 1.2,
        height: 1.2,
        material: 'wood',
        reflectivity: 0.75,
      },
      {
        id: 'ob_2',
        x: 3,
        y: 6,
        width: 0.8,
        height: 2,
        material: 'plastic',
        reflectivity: 0.5,
      },
    ],
  };
}

export function createObstacle(partial = {}) {
  return {
    id: partial.id || `ob_${randomUUID().slice(0, 8)}`,
    type: partial.type ?? 'rect',
    x: partial.x ?? 4,
    y: partial.y ?? 4,
    width: partial.width ?? 1,
    height: partial.height ?? 1,
    radius: partial.radius,
    vertices: Array.isArray(partial.vertices)
      ? partial.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }))
      : undefined,
    material: partial.material ?? 'default',
    reflectivity: partial.reflectivity ?? 0.8,
  };
}
