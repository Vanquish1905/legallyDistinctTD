import type { EnemyState } from '../EnemyState';
import type { SimContext } from '../SimContext';
import type { TowerState } from '../TowerState';
import { applyStun } from '../status';
import { selectTarget } from '../targeting';

/** Bosses only take this fraction of stun durations. */
export const BOSS_STUN_FACTOR = 0.5;

const candidates: EnemyState[] = [];

/**
 * Up to `count` distinct targets for `tower` within `range` of (x, y), best first by the tower's
 * target mode. `keep`, when still targetable and in range, is put first (sticky targeting).
 * Results are written into `out` (cleared first).
 */
export function pickTargets(
  tower: TowerState, ctx: SimContext, x: number, y: number, range: number, count: number,
  out: EnemyState[], keep?: EnemyState,
): EnemyState[] {
  out.length = 0;
  ctx.queryEnemies(x, y, range, candidates);
  if (keep) {
    const i = candidates.indexOf(keep);
    if (i >= 0 && ctx.canHit(keep, tower.stats)) {
      out.push(keep);
      candidates.splice(i, 1);
    }
  }
  while (out.length < count) {
    const best = selectTarget(candidates, tower.targetMode, x, y, tower.stats);
    if (!best) break;
    out.push(best);
    candidates.splice(candidates.indexOf(best), 1);
  }
  return out;
}

/** Stun an enemy for the tower's `stats.stun` seconds (halved on bosses). No-op without stun. */
export function stunFromTower(tower: TowerState, e: EnemyState): void {
  const s = tower.stats.stun ?? 0;
  if (s <= 0 || !e.alive) return;
  applyStun(e.status, e.isBoss ? s * BOSS_STUN_FACTOR : s);
}

/** Push an enemy `px` back along its path (bosses are immune). */
export function knockBack(ctx: SimContext, e: EnemyState, px: number): void {
  if (px <= 0 || !e.alive || e.isBoss) return;
  e.distance = Math.max(0, e.distance - px);
  e.place(ctx.pathAt(e.pathIndex));
}

/** Count the cooldown down; true when the tower may act this tick. */
export function cooldownReady(tower: TowerState, dt: number): boolean {
  tower.cooldownLeft -= dt;
  return tower.cooldownLeft <= 0;
}

/** Nothing to shoot: stay ready (no stored-up shots) and drop the target. */
export function idleReady(tower: TowerState): void {
  tower.cooldownLeft = 0;
  tower.targetUid = -1;
}
