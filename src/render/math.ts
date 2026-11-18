import type { Vec2 } from '../sim/types';

/** Closest point on one of `paths` to (x, y), written into `out`. Returns the distance (Infinity without segments). */
export function closestPointOnPaths(paths: readonly (readonly Vec2[])[], x: number, y: number, out: Vec2): number {
  let best = Infinity;
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1] as Vec2;
      const b = path[i] as Vec2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (d < best) {
        best = d;
        out.x = px;
        out.y = py;
      }
    }
  }
  return best;
}

/** Shortest signed turn from angle `from` to angle `to` (radians, in [-PI, PI]). */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Turn `current` toward `target` with exponential smoothing at `rate` (1/s) over `dt` seconds.
 * Frame-rate independent.
 */
export function smoothAngle(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt);
  return current + angleDelta(current, target) * k;
}
