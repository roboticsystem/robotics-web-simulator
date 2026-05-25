export function rayRectIntersect(ox, oy, dx, dy, cx, cy, hw, hh) {
  const minX = cx - hw;
  const maxX = cx + hw;
  const minY = cy - hh;
  const maxY = cy + hh;

  let tMin = -Infinity;
  let tMax = Infinity;

  if (Math.abs(dx) < 1e-12) {
    if (ox < minX || ox > maxX) {
      return null;
    }
  } else {
    const tx1 = (minX - ox) / dx;
    const tx2 = (maxX - ox) / dx;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
  }

  if (Math.abs(dy) < 1e-12) {
    if (oy < minY || oy > maxY) {
      return null;
    }
  } else {
    const ty1 = (minY - oy) / dy;
    const ty2 = (maxY - oy) / dy;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
  }

  if (tMax < tMin) {
    return null;
  }

  const t = tMin >= 0 ? tMin : tMax >= 0 ? tMax : null;
  return t !== null && t >= 0 ? t : null;
}

export function rotateLocal(px, py, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  return {
    x: px * c - py * s,
    y: px * s + py * c
  };
}
