export class RobotLayer {
  render(ctx, robot, alpha) {
    if (!robot.visible) return

    const pos = robot.getInterpolatedPosition(alpha)
    const rot = robot.rotation
    const r = robot.radius
    const color = robot.color || '#1e90ff'
    const isColliding = robot.sensorData?.collision?.any ?? false

    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(rot)

    const carL = r * 1.85
    const carW = r * 1.1
    const carR = r * 0.3

    const wheelL = r * 0.5
    const wheelW = r * 0.24
    const wheelR = r * 0.08

    const wheelXFront = r * 1.0
    const wheelXRear = -r * 1.0
    const wheelY = carW + wheelW * 0.28

    const wheels = [
      { x: wheelXFront, y: -wheelY },
      { x: wheelXFront, y: wheelY },
      { x: wheelXRear, y: -wheelY },
      { x: wheelXRear, y: wheelY },
    ]

    const [cr, cg, cb] = _hexToRgb(color)

    for (const w of wheels) {
      ctx.save()
      ctx.translate(w.x, w.y)
      _roundRect(ctx, -wheelL, -wheelW, wheelL * 2, wheelW * 2, wheelR)
      ctx.fillStyle = '#151515'
      ctx.strokeStyle = '#2e2e2e'
      ctx.lineWidth = 0.7
      ctx.fill()
      ctx.stroke()

      _roundRect(ctx, -wheelL * 0.45, -wheelW * 0.45, wheelL * 0.9, wheelW * 0.9, wheelR * 0.5)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fill()
      ctx.restore()
    }

    ctx.shadowBlur = isColliding ? 20 : 16
    ctx.shadowColor = isColliding ? '#ff3333' : color
    _roundRect(ctx, -carL, -carW, carL * 2, carW * 2, carR)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fill()
    ctx.shadowBlur = 0

    const grad = ctx.createLinearGradient(-carL, -carW, carL * 0.6, carW * 0.6)
    grad.addColorStop(0, _lighten(color, 0.42))
    grad.addColorStop(0.38, color)
    grad.addColorStop(1, _darken(color, 0.42))

    _roundRect(ctx, -carL, -carW, carL * 2, carW * 2, carR)
    ctx.fillStyle = grad
    ctx.fill()

    if (isColliding) {
      _roundRect(ctx, -carL, -carW, carL * 2, carW * 2, carR)
      ctx.fillStyle = 'rgba(255,50,50,0.38)'
      ctx.fill()
    }

    ctx.beginPath()
    ctx.moveTo(carL * 0.82, -carW * 0.7)
    ctx.lineTo(carL * 0.28, -carW * 0.87)
    ctx.lineTo(carL * 0.28, carW * 0.87)
    ctx.lineTo(carL * 0.82, carW * 0.7)
    ctx.closePath()
    ctx.fillStyle = 'rgba(160,225,255,0.28)'
    ctx.strokeStyle = 'rgba(200,240,255,0.50)'
    ctx.lineWidth = 0.7
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-carL * 0.28, -carW * 0.62)
    ctx.lineTo(-carL * 0.68, -carW * 0.78)
    ctx.lineTo(-carL * 0.68, carW * 0.78)
    ctx.lineTo(-carL * 0.28, carW * 0.62)
    ctx.closePath()
    ctx.fillStyle = 'rgba(160,225,255,0.18)'
    ctx.strokeStyle = 'rgba(200,240,255,0.35)'
    ctx.lineWidth = 0.7
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.28)`
    ctx.lineWidth = 0.8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(carL * 0.82, 0)
    ctx.lineTo(carL * 0.26, 0)
    ctx.stroke()

    _roundRect(ctx, -carL, -carW, carL * 2, carW * 2, carR)
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.60)`
    ctx.lineWidth = 1.2
    ctx.shadowBlur = 0
    ctx.stroke()

    _renderInstalledSensors(ctx, robot, r, carL, carW)
    ctx.restore()
  }
}

function _renderInstalledSensors(ctx, robot, r, carL, carW) {
  const sensors = Array.isArray(robot.installedSensors) ? robot.installedSensors : []
  if (!sensors.length) return

  for (const sensor of sensors) {
    if (!sensor || sensor.enabled === false) continue

    const mountX = Number(sensor.mountX ?? 0)
    const mountY = Number(sensor.mountY ?? 0)
    const mountAngle = Number(sensor.mountAngle ?? 0)
    if (!Number.isFinite(mountX) || !Number.isFinite(mountY) || !Number.isFinite(mountAngle)) {
      continue
    }

    ctx.save()
    ctx.translate(mountX, mountY)
    ctx.rotate(mountAngle)

    if (sensor.sensorType === 'ultrasonic') {
      _renderUltrasonicSensor(ctx, r, carL, carW)
    } else if (sensor.sensorType === 'infrared') {
      _renderInfraredSensor(ctx, r)
    } else if (sensor.sensorType === 'imu') {
      _renderImuSensor(ctx, r)
    } else {
      _renderGenericSensor(ctx, r)
    }

    ctx.restore()
  }
}

function _renderUltrasonicSensor(ctx, r, carL, carW) {
  const bodyW = r * 0.7
  const bodyH = r * 0.34
  const hornR = r * 0.16
  const faceX = Math.min(carL * 0.86, r * 1.55)
  const bodyX = faceX - bodyW * 0.62

  _roundRect(ctx, bodyX - bodyW / 2, -bodyH / 2, bodyW, bodyH, r * 0.08)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)'
  ctx.lineWidth = 0.9
  ctx.stroke()

  for (const offsetY of [-bodyH * 0.52, bodyH * 0.52]) {
    ctx.beginPath()
    ctx.arc(faceX, offsetY, hornR, 0, Math.PI * 2)
    ctx.fillStyle = '#dbe7f5'
    ctx.shadowBlur = 8
    ctx.shadowColor = 'rgba(161, 196, 253, 0.65)'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(faceX + hornR * 1.2, -bodyH * 1.15)
  ctx.lineTo(faceX + hornR * 3.1, 0)
  ctx.lineTo(faceX + hornR * 1.2, bodyH * 1.15)
  ctx.closePath()
  ctx.fillStyle = 'rgba(125, 211, 252, 0.18)'
  ctx.fill()
}

function _renderInfraredSensor(ctx, r) {
  const bodyW = r * 0.42
  const bodyH = r * 0.28
  const lensR = r * 0.11

  _roundRect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, r * 0.08)
  ctx.fillStyle = 'rgba(51, 65, 85, 0.96)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.72)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(bodyW * 0.15, 0, lensR, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(248, 113, 113, 0.95)'
  ctx.shadowBlur = 10
  ctx.shadowColor = 'rgba(248, 113, 113, 0.85)'
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.beginPath()
  ctx.moveTo(bodyW * 0.42, 0)
  ctx.lineTo(bodyW * 1.25, -bodyH * 0.52)
  ctx.lineTo(bodyW * 1.25, bodyH * 0.52)
  ctx.closePath()
  ctx.fillStyle = 'rgba(248, 113, 113, 0.22)'
  ctx.fill()
}

function _renderImuSensor(ctx, r) {
  const size = r * 0.4
  _roundRect(ctx, -size / 2, -size / 2, size, size, r * 0.08)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)'
  ctx.lineWidth = 0.85
  ctx.stroke()

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.82)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-size * 0.22, 0)
  ctx.lineTo(size * 0.22, 0)
  ctx.moveTo(0, -size * 0.22)
  ctx.lineTo(0, size * 0.22)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(size * 0.28, -size * 0.28)
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)'
  ctx.stroke()
}

function _renderGenericSensor(ctx, r) {
  const size = r * 0.26
  ctx.beginPath()
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(226, 232, 240, 0.88)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.85)'
  ctx.lineWidth = 0.8
  ctx.stroke()
}

function _roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(Math.abs(radius), Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function _lighten(hex, amount) {
  const [r, g, b] = _hexToRgb(hex)
  return _rgbToHex(
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  )
}

function _darken(hex, amount) {
  const [r, g, b] = _hexToRgb(hex)
  return _rgbToHex(
    Math.round(r * (1 - amount)),
    Math.round(g * (1 - amount)),
    Math.round(b * (1 - amount)),
  )
}

function _hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ]
  }

  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function _rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, v))
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
}
