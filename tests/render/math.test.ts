import { describe, expect, it } from 'vitest';
import { angleDelta, closestPointOnPaths, smoothAngle } from '../../src/render/math';

describe('closestPointOnPaths', () => {
  const paths = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], [{ x: 0, y: 300 }, { x: 200, y: 300 }]];

  it('projects onto the nearest segment of the nearest path', () => {
    const out = { x: 0, y: 0 };
    expect(closestPointOnPaths(paths, 50, 20, out)).toBeCloseTo(20);
    expect(out).toEqual({ x: 50, y: 0 });
    expect(closestPointOnPaths(paths, 130, 60, out)).toBeCloseTo(30);
    expect(out).toEqual({ x: 100, y: 60 });
    closestPointOnPaths(paths, 150, 290, out);
    expect(out).toEqual({ x: 150, y: 300 });
  });

  it('clamps to segment ends', () => {
    const out = { x: 0, y: 0 };
    expect(closestPointOnPaths(paths, -30, -40, out)).toBeCloseTo(50);
    expect(out).toEqual({ x: 0, y: 0 });
  });
});

describe('angles', () => {
  it('angleDelta takes the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it('smoothAngle converges and never overshoots', () => {
    let a = 0;
    for (let i = 0; i < 120; i++) {
      a = smoothAngle(a, 1, 10, 1 / 60);
      expect(a).toBeLessThanOrEqual(1);
    }
    expect(a).toBeCloseTo(1, 3);
  });
});
