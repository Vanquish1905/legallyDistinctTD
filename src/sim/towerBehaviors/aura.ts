import type { EnemyState } from '../EnemyState';
import type { TowerBehavior } from './types';
import { cooldownReady, idleReady, knockBack, stunFromTower } from './common';

const victims: EnemyState[] = [];

/**
 * Pulse Generator: every cooldown, while anything hittable is in range, hits all enemies in
 * range (damage, slow, dot), then knocks survivors back `knockback` px and stuns them.
 */
export const auraBehavior: TowerBehavior = {
  update(t, ctx, dt) {
    if (!cooldownReady(t, dt)) return;
    ctx.queryEnemies(t.x, t.y, t.range, victims);
    let w = 0;
    for (const e of victims) if (ctx.canHit(e, t.stats)) victims[w++] = e;
    victims.length = w;
    if (w === 0) {
      idleReady(t);
      return;
    }
    ctx.events.push({
      type: 'towerFired', uid: t.uid, towerId: t.def.id, x: t.x, y: t.y, angle: t.angle, targetUid: victims[0]!.uid,
    });
    ctx.explode(t.x, t.y, t.range, t.stats, t.uid, false);
    for (const e of victims) {
      if (!e.alive) continue;
      knockBack(ctx, e, t.stats.knockback ?? 0);
      stunFromTower(t, e);
    }
    t.cooldownLeft += t.cooldown;
  },
};
