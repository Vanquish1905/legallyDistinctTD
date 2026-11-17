import type { EnemyState } from '../EnemyState';
import type { TowerBehavior } from './types';
import { pickTargets } from './common';

const targets: EnemyState[] = [];

/**
 * Laser Prism: a continuous beam on up to `pierce` targets. Damage is dealt every `cooldown`
 * seconds and ramps from ×1 to ×`ramp.max` over `ramp.time` s while the primary target stays
 * the same (it is kept while in range); switching target resets the ramp (`memory.rampT`).
 */
export const beamBehavior: TowerBehavior = {
  update(t, ctx, dt) {
    const keep = t.targetUid >= 0 ? ctx.getEnemy(t.targetUid) : undefined;
    pickTargets(t, ctx, t.x, t.y, t.range, Math.max(1, Math.round(t.stats.pierce)), targets, keep);
    const primary = targets[0];
    if (!primary) {
      t.targetUid = -1;
      t.memory.rampT = 0;
      t.cooldownLeft = 0;
      return;
    }
    if (primary.uid !== t.targetUid) t.memory.rampT = 0;
    t.targetUid = primary.uid;
    t.memory.rampT = (t.memory.rampT ?? 0) + dt;
    t.angle = Math.atan2(primary.y - t.y, primary.x - t.x);
    t.cooldownLeft -= dt;
    if (t.cooldownLeft > 0) return;
    t.cooldownLeft += t.cooldown;
    const ramp = t.stats.ramp;
    const mul = ramp ? 1 + (ramp.max - 1) * Math.min(1, t.memory.rampT / Math.max(ramp.time, 1e-6)) : 1;
    const intensity = ramp ? mul / ramp.max : 1;
    for (const e of targets) {
      ctx.events.push({ type: 'beam', towerUid: t.uid, x1: t.x, y1: t.y, x2: e.x, y2: e.y, intensity });
      ctx.hitEnemy(e, t.stats, t.uid, t.stats.damage * mul);
    }
  },
};
