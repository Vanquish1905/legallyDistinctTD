import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { PathFollower } from '../../src/sim/PathFollower';
import { SpatialHash, type Circle } from '../../src/sim/SpatialHash';
import { distToPolyline, distToSegment } from '../../src/sim/geometry';

describe('Rng', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const c = new Rng(8);
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa);
  });

  it('stays in range and resumes from a saved state', () => {
    const r = new Rng(123);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(2, 4);
      expect(n === 2 || n === 3 || n === 4).toBe(true);
    }
    const saved = r.state;
    const next = [r.next(), r.next()];
    const resumed = new Rng(0);
    resumed.state = saved;
    expect([resumed.next(), resumed.next()]).toEqual(next);
    expect(r.pick(['x'])).toBe('x');
    expect(() => r.pick([])).toThrow();
  });
});

describe('geometry', () => {
  it('measures point-to-segment and polyline distance', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(1, 1, 0, 0, 0, 0)).toBeCloseTo(Math.SQRT2);
    expect(distToPolyline(10, 5, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(0);
    expect(distToPolyline(3, 4, [{ x: 0, y: 0 }])).toBe(5);
  });
});

describe('PathFollower', () => {
  const path = new PathFollower([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);

  it('precomputes total length', () => {
    expect(path.length).toBe(250);
  });

  it('maps distance to position, clamped to the ends', () => {
    expect(path.positionAt(0)).toEqual({ x: 0, y: 0 });
    expect(path.positionAt(50)).toEqual({ x: 50, y: 0 });
    expect(path.positionAt(100)).toEqual({ x: 100, y: 0 });
    expect(path.positionAt(125)).toEqual({ x: 100, y: 25 });
    expect(path.positionAt(200)).toEqual({ x: 50, y: 50 });
    expect(path.positionAt(-10)).toEqual({ x: 0, y: 0 });
    expect(path.positionAt(9999)).toEqual({ x: 0, y: 50 });
  });

  it('writes into a given out-vector', () => {
    const out = { x: 0, y: 0 };
    expect(path.positionAt(75, out)).toBe(out);
    expect(out).toEqual({ x: 75, y: 0 });
  });

  it('reports heading per segment, skipping zero-length ones', () => {
    expect(path.angleAt(10)).toBeCloseTo(0);
    expect(path.angleAt(120)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(path.angleAt(170))).toBeCloseTo(Math.PI);
  });

  it('measures distance to the centre line', () => {
    expect(path.distanceTo(50, 20)).toBe(20);
    expect(path.distanceTo(120, 25)).toBe(20);
  });

  it('rejects degenerate paths', () => {
    expect(() => new PathFollower([{ x: 0, y: 0 }])).toThrow();
  });
});

describe('SpatialHash', () => {
  it('matches brute force and reuses storage across clears', () => {
    const rng = new Rng(99);
    const hash = new SpatialHash<Circle & { id: number }>(128);
    const out: (Circle & { id: number })[] = [];
    for (let round = 0; round < 3; round++) {
      hash.clear();
      const items = Array.from({ length: 300 }, (_, id) => ({
        id, x: rng.range(-200, 1700), y: rng.range(-100, 1100), radius: rng.range(5, 40),
      }));
      items.forEach((i) => hash.insert(i));
      for (let q = 0; q < 40; q++) {
        const x = rng.range(0, 1540);
        const y = rng.range(0, 1080);
        const r = rng.range(10, 400);
        const expected = items.filter((i) => Math.hypot(i.x - x, i.y - y) <= r + i.radius).map((i) => i.id).sort((a, b) => a - b);
        const got = hash.query(x, y, r, out).map((i) => i.id).sort((a, b) => a - b);
        expect(got).toEqual(expected);
      }
    }
  });
});
