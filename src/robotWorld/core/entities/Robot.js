import { BaseEntity } from './BaseEntity'
import { MathUtils } from '@utils/MathUtils'

function approach(current, target, accelStep, decelStep) {
  const diff = target - current
  if (Math.abs(diff) < 0.5) return target

  const braking = current !== 0 && current * diff < 0
  const step = braking ? decelStep : accelStep
  return current + Math.sign(diff) * Math.min(step, Math.abs(diff))
}

export class Robot extends BaseEntity {
  constructor(config = {}) {
    super({ type: 'robot', ...config })

    this.radius = config.radius ?? 9
    this.color = config.color ?? '#1e90ff'
    this.dirColor = config.dirColor ?? '#ffffff'
    this.maxSpeed = config.maxSpeed ?? 200

    this.velocity = { x: config.velocity?.x ?? 0, y: config.velocity?.y ?? 0 }
    this.angularVelocity = config.angularVelocity ?? 0

    this.targetVelocity = { x: config.targetVelocity?.x ?? 0, y: config.targetVelocity?.y ?? 0 }
    this.targetAngularVelocity = config.targetAngularVelocity ?? 0

    this.acceleration = config.acceleration ?? 350
    this.deceleration = config.deceleration ?? 700
    this.angularAccel = config.angularAccel ?? 8
    this.directorLength = config.directorLength ?? 24
    this.visible = config.visible ?? false

    this.sensorData = {
      light: 0,
      sound: 0,
      collision: { left: false, right: false, front: false, back: false, any: false },
      proximity: {
        front: Infinity,
        frontLeft: Infinity,
        frontRight: Infinity,
        left: Infinity,
        right: Infinity,
      },
      lineDetected: false,
      linePosition: null,
    }

    this._prevPosition = { ...this.position }
    this._prevRotation = this.rotation
  }

  savePrevState() {
    this._prevPosition = { ...this.position }
    this._prevRotation = this.rotation
  }

  update(dt) {
    this.savePrevState()

    const accelStep = this.acceleration * dt
    const decelStep = this.deceleration * dt
    const angStep = this.angularAccel * dt
    const angDecel = this.angularAccel * 2 * dt

    this.velocity.x = approach(this.velocity.x, this.targetVelocity.x, accelStep, decelStep)
    this.velocity.y = approach(this.velocity.y, this.targetVelocity.y, accelStep, decelStep)
    this.angularVelocity = approach(this.angularVelocity, this.targetAngularVelocity, angStep, angDecel)

    const speed = Math.hypot(this.velocity.x, this.velocity.y)
    if (speed > this.maxSpeed) {
      const ratio = this.maxSpeed / speed
      this.velocity.x *= ratio
      this.velocity.y *= ratio
    }

    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
    this.rotation += this.angularVelocity * dt
    this.rotation = MathUtils.normalizeAngle(this.rotation)

    this.markDirty()
  }

  getInterpolatedPosition(alpha) {
    return {
      x: MathUtils.lerp(this._prevPosition.x, this.position.x, alpha),
      y: MathUtils.lerp(this._prevPosition.y, this.position.y, alpha),
    }
  }

  getAABB() {
    const { x, y } = this.position
    return {
      minX: x - this.radius,
      minY: y - this.radius,
      maxX: x + this.radius,
      maxY: y + this.radius,
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      radius: this.radius,
      color: this.color,
      maxSpeed: this.maxSpeed,
      acceleration: this.acceleration,
      deceleration: this.deceleration,
      angularAccel: this.angularAccel,
      velocity: { ...this.velocity },
      angularVelocity: this.angularVelocity,
      targetVelocity: { ...this.targetVelocity },
      targetAngularVelocity: this.targetAngularVelocity,
      visible: this.visible,
    }
  }

  fromJSON(data) {
    super.fromJSON(data)
    if (data.radius !== undefined) this.radius = data.radius
    if (data.color) this.color = data.color
    if (data.maxSpeed !== undefined) this.maxSpeed = data.maxSpeed
    if (data.acceleration !== undefined) this.acceleration = data.acceleration
    if (data.deceleration !== undefined) this.deceleration = data.deceleration
    if (data.angularAccel !== undefined) this.angularAccel = data.angularAccel
    if (data.velocity) this.velocity = { ...data.velocity }
    if (data.angularVelocity !== undefined) this.angularVelocity = data.angularVelocity
    if (data.targetVelocity) this.targetVelocity = { ...data.targetVelocity }
    if (data.targetAngularVelocity !== undefined) this.targetAngularVelocity = data.targetAngularVelocity
    if (data.visible !== undefined) this.visible = data.visible
  }
}
