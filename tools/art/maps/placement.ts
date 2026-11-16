/** Deterministic decor placement that keeps clear of the path band and blockers. */
import type { Rng } from '../lib/rng';
import type { Pt } from '../lib/shapes';
import type { DecorKind } from './decor/common';
import { MAP_H, MAP_W, type MapArtInput } from './types';

/** Extra gap between the path band / blockers and any decor (plan ruling). */
export const DECOR_CLEARANCE = 20;

export interface Placed {
  kind: DecorKind;
  x: number;
  y: number;
  s: number;
}

/** Shortest distance from p to a polyline. */
export function distToPath(p: Pt, path: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Pt;
    const b = path[i + 1] as Pt;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

/** True when a circle of radius r at p stays clear of every path band and blocker. */
export function isClear(map: MapArtInput, p: Pt, r: number): boolean {
  const band = map.pathWidth / 2 + DECOR_CLEARANCE + r;
  for (const path of map.paths) if (distToPath(p, path) < band) return false;
  for (const b of map.blockers ?? []) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 13 + DECOR_CLEARANCE + r) return false;
  return true;
}

function weighted(rng: Rng, kinds: DecorKind[]): DecorKind {
  const total = kinds.reduce((s, k) => s + k.weight, 0);
  let roll = rng.range(0, total);
  for (const k of kinds) {
    roll -= k.weight;
    if (roll <= 0) return k;
  }
  return kinds[kinds.length - 1] as DecorKind;
}

/**
 * Places up to `count` items. Most candidates gather around a few cluster centres so decor reads
 * as groves/outcrops and leaves open building ground; `avoid` items are never overlapped.
 */
export function place(rng: Rng, map: MapArtInput, kinds: DecorKind[], count: number, avoid: Placed[], spacing: number): Placed[] {
  const placed: Placed[] = [];
  const clusters: Pt[] = [];
  for (let i = 0; i < 7; i++) clusters.push({ x: rng.range(0, MAP_W), y: rng.range(0, MAP_H) });
  for (let attempt = 0; attempt < count * 30 && placed.length < count; attempt++) {
    const kind = weighted(rng, kinds);
    const [lo, hi] = kind.scale ?? [0.9, 1.1];
    const s = rng.range(lo, hi);
    const r = kind.r * s;
    let p: Pt;
    if (rng.next() < 0.65) {
      const c = rng.pick(clusters);
      const a = rng.range(0, Math.PI * 2);
      const d = Math.abs(rng.range(-1, 1) * rng.range(0, 1)) * 260;
      p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
    } else {
      p = { x: rng.range(-10, MAP_W + 10), y: rng.range(-10, MAP_H + 10) };
    }
    if (p.x < -r * 0.5 || p.x > MAP_W + r * 0.5 || p.y < -r * 0.5 || p.y > MAP_H + r * 0.5) continue;
    if (!isClear(map, p, r)) continue;
    const others = [...avoid, ...placed];
    if (others.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < (o.kind.r * o.s + r) * spacing)) continue;
    placed.push({ kind, x: p.x, y: p.y, s });
  }
  return placed;
}
