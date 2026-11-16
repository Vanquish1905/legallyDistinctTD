import type { MapDef, TowerDef } from './types';
import type { PathFollower } from './PathFollower';
import type { TowerState } from './TowerState';
import { FIELD_W, GAME_H, TOPBAR_H } from '../config';
import { dist } from './geometry';

/** Result of a placement check. */
export interface PlacementResult { ok: boolean; reason?: string }

/** What placement needs to know about the world. */
export interface PlacementWorld {
  map: MapDef;
  paths: readonly PathFollower[];
  towers: readonly TowerState[];
}

/**
 * Geometric placement rules: the footprint must be inside the field and below the top bar;
 * ground towers must stay off the path band (pathWidth/2 + footprint from the centre line);
 * 'path' towers must sit on the path (centre within pathWidth/2); nothing may overlap another
 * tower or a blocker.
 */
export function checkPlacement(def: TowerDef, x: number, y: number, world: PlacementWorld): PlacementResult {
  const fp = def.footprint;
  if (x - fp < 0 || x + fp > FIELD_W || y + fp > GAME_H) return { ok: false, reason: 'Outside the field' };
  if (y - fp < TOPBAR_H) return { ok: false, reason: 'Under the top bar' };
  const halfWidth = world.map.pathWidth / 2;
  if (def.placement === 'path') {
    if (!world.paths.some((p) => p.distanceTo(x, y) <= halfWidth)) {
      return { ok: false, reason: 'Must be placed on the path' };
    }
  } else if (world.paths.some((p) => p.distanceTo(x, y) < halfWidth + fp)) {
    return { ok: false, reason: 'Too close to the path' };
  }
  for (const b of world.map.blockers ?? []) {
    if (dist(x, y, b.x, b.y) < b.r + fp) return { ok: false, reason: 'Blocked by terrain' };
  }
  for (const t of world.towers) {
    if (dist(x, y, t.x, t.y) < t.def.footprint + fp) return { ok: false, reason: 'Overlaps another tower' };
  }
  return { ok: true };
}
