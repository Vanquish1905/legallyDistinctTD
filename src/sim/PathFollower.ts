import type { Vec2 } from './types';
import { clamp, distToPolyline } from './geometry';

/**
 * Arc-length parameterised polyline. Cumulative segment lengths are precomputed so
 * `positionAt(distance)` is a binary search plus one lerp.
 */
export class PathFollower {
  readonly points: readonly Vec2[];
  /** cumulative[i] = path length from point 0 to point i. */
  private readonly cumulative: Float64Array;
  readonly length: number;

  constructor(points: readonly Vec2[]) {
    if (points.length < 2) throw new Error('PathFollower needs at least 2 points');
    this.points = points.map((p) => ({ x: p.x, y: p.y }));
    this.cumulative = new Float64Array(points.length);
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1] as Vec2;
      const b = this.points[i] as Vec2;
      total += Math.hypot(b.x - a.x, b.y - a.y);
      this.cumulative[i] = total;
    }
    this.length = total;
  }

  /** Index i of the segment (points i → i+1) that contains `distance`. */
  private segmentAt(distance: number): number {
    let lo = 0;
    let hi = this.points.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.cumulative[mid] as number) <= distance) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /**
   * Point at `distance` along the path (clamped to [0, length]). Writes into `out` when given,
   * to avoid allocations in hot loops.
   */
  positionAt(distance: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    const d = clamp(distance, 0, this.length);
    const i = this.segmentAt(d);
    const a = this.points[i] as Vec2;
    const b = this.points[i + 1] as Vec2;
    const start = this.cumulative[i] as number;
    const segLen = (this.cumulative[i + 1] as number) - start;
    const t = segLen === 0 ? 0 : (d - start) / segLen;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  }

  /** Direction of travel (radians) at `distance`. */
  angleAt(distance: number): number {
    const i = this.segmentAt(clamp(distance, 0, this.length));
    const a = this.points[i] as Vec2;
    const b = this.points[i + 1] as Vec2;
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /** Shortest distance from a point to the path centre line. */
  distanceTo(x: number, y: number): number {
    return distToPolyline(x, y, this.points);
  }
}
