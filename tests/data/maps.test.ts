import { describe, expect, it } from 'vitest';
import { MAPS, MAP_ORDER, getMap } from '../../src/data/maps';
import { PathFollower } from '../../src/sim/PathFollower';
import { checkPlacement } from '../../src/sim/placement';
import { FIELD_W, GAME_H, TOPBAR_H } from '../../src/config';
import type { Vec2 } from '../../src/sim/types';
import { stubTower } from '../sim/helpers';

const PINNED_IDS = [
  'tutorial', 'green-valley', 'dune-canyon', 'frostbite-lake', 'magma-works',
  'bogwater', 'bio-lab', 'crystal-hollow', 'neon-district',
];

/** Maps whose paths are meant to touch each other (crossing or merging). */
const TOUCHING_PATHS = new Set(['bio-lab', 'crystal-hollow']);

const OFFSCREEN = 40;

function inField(p: Vec2): boolean {
  return p.x >= 0 && p.x <= FIELD_W && p.y >= 0 && p.y <= GAME_H;
}

/** Points every `step` px along a polyline, with their arc-length distance. */
function samples(path: readonly Vec2[], step: number): { p: Vec2; s: number }[] {
  const f = new PathFollower(path);
  const out: { p: Vec2; s: number }[] = [];
  for (let s = 0; s <= f.length; s += step) out.push({ p: f.positionAt(s), s });
  return out;
}

describe('MAPS', () => {
  it('has the pinned ids in order, unique, with the tutorial first', () => {
    expect(MAPS.map((m) => m.id)).toEqual(PINNED_IDS);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(MAPS.length);
    expect(MAP_ORDER).toEqual(PINNED_IDS);
  });

  it('getMap finds maps by id', () => {
    for (const m of MAPS) expect(getMap(m.id)).toBe(m);
    expect(getMap('nowhere')).toBeUndefined();
  });

  it('has names, descriptions, backgrounds and distinct decor seeds', () => {
    for (const m of MAPS) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(10);
      expect(m.background).toBe(`map-${m.id}`);
      expect(Number.isInteger(m.decorSeed)).toBe(true);
    }
    expect(new Set(MAPS.map((m) => m.decorSeed)).size).toBe(MAPS.length);
  });

  it('ramps difficulty from 1 (tutorial) to 5 (last map)', () => {
    const d = MAPS.map((m) => m.difficulty);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1] as number);
    expect(d[0]).toBe(1);
    expect(d[d.length - 1]).toBe(5);
  });

  it('has the required number of paths per map', () => {
    const counts = Object.fromEntries(MAPS.map((m) => [m.id, m.paths.length]));
    expect(counts).toEqual({
      tutorial: 1, 'green-valley': 1, 'dune-canyon': 1, 'frostbite-lake': 1, 'magma-works': 1,
      bogwater: 2, 'bio-lab': 2, 'crystal-hollow': 2, 'neon-district': 3,
    });
  });
});

describe.each(MAPS.map((m) => [m.id, m] as const))('map %s', (_id, map) => {
  const hw = map.pathWidth / 2;

  it('starts and ends at least 40 px outside the field', () => {
    for (const path of map.paths) {
      const start = path[0] as Vec2;
      const end = path[path.length - 1] as Vec2;
      // Entries come from the left, top or bottom; the right edge is the sidebar.
      expect(start.x <= -OFFSCREEN || start.y <= -OFFSCREEN || start.y >= GAME_H + OFFSCREEN).toBe(true);
      expect(end.x <= -OFFSCREEN || end.x >= FIELD_W + OFFSCREEN || end.y <= -OFFSCREEN
        || end.y >= GAME_H + OFFSCREEN).toBe(true);
    }
  });

  it('keeps every waypoint between the ends inside the field, clear of the top bar and edges', () => {
    for (const path of map.paths) {
      for (const p of path.slice(1, -1)) {
        expect(inField(p)).toBe(true);
        expect(p.y - hw).toBeGreaterThanOrEqual(TOPBAR_H);
        expect(p.y + hw).toBeLessThanOrEqual(GAME_H);
        expect(p.x - hw).toBeGreaterThanOrEqual(0);
        expect(p.x + hw).toBeLessThanOrEqual(FIELD_W);
      }
    }
  });

  it('only leaves the field on its first and last segments', () => {
    for (const path of map.paths) {
      for (let i = 1; i < path.length - 2; i++) {
        const a = path[i] as Vec2;
        const b = path[i + 1] as Vec2;
        for (let t = 0; t <= 1; t += 0.05) {
          expect(inField({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })).toBe(true);
        }
      }
      if (path.length > 2) {
        // The off-screen legs cross the edge exactly once: their inner waypoints are in the field.
        expect(inField(path[1] as Vec2)).toBe(true);
        expect(inField(path[path.length - 2] as Vec2)).toBe(true);
      }
    }
  });

  it('has no segments shorter than the path width', () => {
    for (const path of map.paths) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1] as Vec2;
        const b = path[i] as Vec2;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(map.pathWidth);
      }
    }
  });

  it('never runs alongside itself (parallel legs ≥ pathWidth + 40 apart)', () => {
    const gap = map.pathWidth + 40;
    for (const path of map.paths) {
      const pts = samples(path, 8);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]!;
          const b = pts[j]!;
          if (b.s - a.s < 2 * gap) continue;
          expect(Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y)).toBeGreaterThanOrEqual(gap);
        }
      }
    }
  });

  it.skipIf(TOUCHING_PATHS.has(map.id) || map.paths.length < 2)('keeps separate paths apart', () => {
    const gap = map.pathWidth + 40;
    for (let i = 0; i < map.paths.length; i++) {
      for (let j = i + 1; j < map.paths.length; j++) {
        const other = new PathFollower(map.paths[j]!);
        for (const { p } of samples(map.paths[i]!, 8)) {
          expect(other.distanceTo(p.x, p.y)).toBeGreaterThanOrEqual(gap);
        }
      }
    }
  });

  it('keeps blockers inside the field and at least 30 px off the path band', () => {
    const paths = map.paths.map((p) => new PathFollower(p));
    for (const b of map.blockers ?? []) {
      expect(b.r).toBeGreaterThan(0);
      expect(inField(b)).toBe(true);
      for (const p of paths) expect(p.distanceTo(b.x, b.y)).toBeGreaterThanOrEqual(b.r + hw + 30);
    }
  });

  it('leaves at least 35% of the field buildable for a 28 px ground tower', () => {
    const tower = stubTower({ footprint: 28, placement: 'ground' });
    const world = { map, paths: map.paths.map((p) => new PathFollower(p)), towers: [] };
    let ok = 0;
    let total = 0;
    for (let x = 20; x < FIELD_W; x += 40) {
      for (let y = TOPBAR_H + 20; y < GAME_H; y += 40) {
        total++;
        if (checkPlacement(tower, x, y, world).ok) ok++;
      }
    }
    expect(ok / total).toBeGreaterThanOrEqual(0.35);
  });
});

describe('themed blockers', () => {
  it('frostbite-lake has 3–5 ice holes, magma-works 2–4 lava pools, bogwater has ponds', () => {
    const count = (id: string): number => getMap(id)?.blockers?.length ?? 0;
    expect(count('frostbite-lake')).toBeGreaterThanOrEqual(3);
    expect(count('frostbite-lake')).toBeLessThanOrEqual(5);
    expect(count('magma-works')).toBeGreaterThanOrEqual(2);
    expect(count('magma-works')).toBeLessThanOrEqual(4);
    expect(count('bogwater')).toBeGreaterThan(0);
  });
});
