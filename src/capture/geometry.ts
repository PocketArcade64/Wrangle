export interface Vec2 {
  x: number;
  y: number;
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Proper intersection of segments (a1,a2) and (b1,b2).
 * Returns the intersection point, or null if they don't cross.
 */
export function segmentIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-9) return null; // parallel or degenerate
  const qpx = b1.x - a1.x;
  const qpy = b1.y - a1.y;
  const t = (qpx * sy - qpy * sx) / cross;
  const u = (qpx * ry - qpy * rx) / cross;
  const eps = 1e-6;
  if (t < eps || t > 1 - eps || u < eps || u > 1 - eps) return null;
  return { x: a1.x + t * rx, y: a1.y + t * ry };
}

/** Ray-cast point-in-polygon test. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    if (pi.y > p.y !== pj.y > p.y && p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Shortest distance from point p to segment (a,b). */
export function distPointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-9) return dist(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = clamp(t, 0, 1);
  return dist(p, { x: a.x + t * abx, y: a.y + t * aby });
}
