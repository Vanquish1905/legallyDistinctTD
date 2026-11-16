import type { Vec2 } from './types';

/** Squared distance between two points. */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Distance between two points. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** Clamp `v` to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Distance from point p to segment a–b. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

/** Shortest distance from point p to a polyline (Infinity for fewer than one point). */
export function distToPolyline(px: number, py: number, points: readonly Vec2[]): number {
  if (points.length === 1) {
    const only = points[0] as Vec2;
    return dist(px, py, only.x, only.y);
  }
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vec2;
    const b = points[i] as Vec2;
    const d = distToSegment(px, py, a.x, a.y, b.x, b.y);
    if (d < best) best = d;
  }
  return best;
}
