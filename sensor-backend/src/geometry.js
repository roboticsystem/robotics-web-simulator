/**
 * 射线与轴对齐矩形求交。返回最小的 t（t >= 0），否则返回 null。
 * 射线：起点 (ox,oy)，方向 (dx,dy)（已归一化）
 * 矩形：中心 (cx,cy)，半宽 hw，半高 hh
 */
export function rayRectIntersect(ox, oy, dx, dy, cx, cy, hw, hh) {
  const minX = cx - hw;
  const maxX = cx + hw;
  const minY = cy - hh;
  const maxY = cy + hh;

  // slab 法：求射线在 x/y 两个区间的重叠部分
  let tMin = -Infinity;
  let tMax = Infinity;

  if (Math.abs(dx) < 1e-12) {
    // 射线近似竖直，必须落在 x 区间内
    if (ox < minX || ox > maxX) return null;
  } else {
    const tx1 = (minX - ox) / dx;
    const tx2 = (maxX - ox) / dx;
    const t1 = Math.min(tx1, tx2);
    const t2 = Math.max(tx1, tx2);
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }

  if (Math.abs(dy) < 1e-12) {
    // 射线近似水平，必须落在 y 区间内
    if (oy < minY || oy > maxY) return null;
  } else {
    const ty1 = (minY - oy) / dy;
    const ty2 = (maxY - oy) / dy;
    const t1 = Math.min(ty1, ty2);
    const t2 = Math.max(ty1, ty2);
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }

  if (tMax < tMin) return null; // 无重叠，未命中
  const t = tMin >= 0 ? tMin : tMax >= 0 ? tMax : null;
  if (t === null || t < 0) return null; // 交点都在射线起点后方
  return t;
}

export function rayCircleIntersect(ox, oy, dx, dy, cx, cy, radius) {
  const fx = ox - cx;
  const fy = oy - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;

  if (disc < 0 || Math.abs(a) < 1e-12) return null;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  const t = t1 >= 0 ? t1 : t2 >= 0 ? t2 : null;
  return t === null || t < 0 ? null : t;
}

export function raySegmentIntersect(ox, oy, dx, dy, ax, ay, bx, by) {
  const sx = bx - ax;
  const sy = by - ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-12) return null;

  const qpx = ax - ox;
  const qpy = ay - oy;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * dy - qpy * dx) / denom;

  if (t < 0 || u < 0 || u > 1) return null;
  return t;
}

export function rayPolygonIntersect(ox, oy, dx, dy, vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return null;

  let best = Infinity;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const t = raySegmentIntersect(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
    if (t !== null && t < best) {
      best = t;
    }
  }

  return best === Infinity ? null : best;
}

export function rayObstacleIntersect(ox, oy, dx, dy, obstacle) {
  if (Array.isArray(obstacle.vertices) && obstacle.vertices.length >= 3) {
    return rayPolygonIntersect(ox, oy, dx, dy, obstacle.vertices);
  }

  if (obstacle.type === 'circle' && Number.isFinite(obstacle.radius)) {
    return rayCircleIntersect(ox, oy, dx, dy, obstacle.x, obstacle.y, obstacle.radius);
  }

  const hw = obstacle.width / 2;
  const hh = obstacle.height / 2;
  return rayRectIntersect(ox, oy, dx, dy, obstacle.x, obstacle.y, hw, hh);
}

export function rotateLocal(px, py, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // 局部坐标绕原点旋转到世界坐标
  return { x: px * c - py * s, y: px * s + py * c };
}
