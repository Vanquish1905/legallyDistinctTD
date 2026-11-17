import type { EnemyState } from '../EnemyState';
import type { TowerState } from '../TowerState';
import type { SimContext } from '../SimContext';
import type { TowerBehavior } from './types';
import { cooldownReady, idleReady } from './common';

/** The 'blastOnEmpty' explosion deals this many times the stab damage. */
export const TRAP_BLAST_MUL = 8;

const victims: EnemyState[] = [];

/** Keep remaining charges in step with `stats.charges` (upgrades add spikes to a live trap). */
function syncCharges(t: TowerState): void {
  const max = t.stats.charges ?? 0;
  if (t.memory.charges === undefined || t.memory.maxCharges === undefined) {
    t.memory.charges = max;
    t.memory.maxCharges = max;
  } else if (max > t.memory.maxCharges) {
    t.memory.charges += max - t.memory.maxCharges;
    t.memory.maxCharges = max;
  }
}

function deplete(t: TowerState, ctx: SimContext): void {
  if (t.flags.has('blastOnEmpty') && t.stats.splashRadius > 0) {
    ctx.explode(t.x, t.y, t.stats.splashRadius, t.stats, t.uid, true, t.stats.damage * TRAP_BLAST_MUL);
  }
  if (t.flags.has('refill')) return;
  ctx.removeTower(t);
  ctx.events.push({ type: 'towerExpired', uid: t.uid, towerId: t.def.id, x: t.x, y: t.y });
}

/**
 * Spike Trap on the path: every cooldown it stabs each hittable enemy on it (flyers are never
 * hit), one charge per stab. Empty traps vanish ('towerExpired'), or with the 'refill' flag sleep
 * until the next wave clear. Remaining charges live in `memory.charges`.
 */
export const trapBehavior: TowerBehavior = {
  onPlace: syncCharges,
  update(t, ctx, dt) {
    syncCharges(t);
    if ((t.memory.charges ?? 0) <= 0) return;
    if (!cooldownReady(t, dt)) return;
    ctx.queryEnemies(t.x, t.y, t.range, victims);
    let stabbed = 0;
    for (const e of victims) {
      if ((t.memory.charges ?? 0) <= 0) break;
      if (e.flying || !ctx.canHit(e, t.stats)) continue;
      ctx.hitEnemy(e, t.stats, t.uid);
      t.memory.charges = (t.memory.charges ?? 0) - 1;
      stabbed++;
    }
    if (stabbed === 0) {
      idleReady(t);
      return;
    }
    t.cooldownLeft += t.cooldown;
    if ((t.memory.charges ?? 0) <= 0) deplete(t, ctx);
  },
  onWaveCleared(t) {
    syncCharges(t);
    if (t.flags.has('refill')) t.memory.charges = t.stats.charges ?? 0;
  },
};
