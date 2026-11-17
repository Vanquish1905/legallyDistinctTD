import type { EnemyState } from '../EnemyState';
import type { Vec2 } from '../types';
import type { TowerBehavior } from './types';
import { cooldownReady, idleReady, stunFromTower } from './common';

const near: EnemyState[] = [];
const hit: number[] = [];

/**
 * Tesla Coil: zaps the target, then jumps `chain.jumps` times to the nearest un-hit enemy within
 * `chain.range` of the last one, damage ×`chain.falloff` per jump. Emits 'chainLightning'.
 */
export const chainBehavior: TowerBehavior = {
  update(t, ctx, dt) {
    if (!cooldownReady(t, dt)) return;
    let cur = ctx.findTarget(t);
    if (!cur) {
      idleReady(t);
      return;
    }
    t.targetUid = cur.uid;
    t.angle = Math.atan2(cur.y - t.y, cur.x - t.x);
    ctx.events.push({ type: 'towerFired', uid: t.uid, towerId: t.def.id, x: t.x, y: t.y, angle: t.angle, targetUid: cur.uid });
    const chain = t.stats.chain ?? { jumps: 0, range: 0, falloff: 1 };
    const points: Vec2[] = [{ x: t.x, y: t.y }];
    hit.length = 0;
    let dmg = t.stats.damage;
    for (let i = 0; cur && i <= chain.jumps; i++) {
      const e: EnemyState = cur;
      hit.push(e.uid);
      points.push({ x: e.x, y: e.y });
      ctx.hitEnemy(e, t.stats, t.uid, dmg);
      stunFromTower(t, e);
      dmg *= chain.falloff;
      cur = null;
      let best = Infinity;
      for (const n of ctx.queryEnemies(e.x, e.y, chain.range, near)) {
        if (hit.includes(n.uid) || !ctx.canHit(n, t.stats)) continue;
        const d = (n.x - e.x) ** 2 + (n.y - e.y) ** 2;
        if (d < best) {
          best = d;
          cur = n;
        }
      }
    }
    ctx.events.push({ type: 'chainLightning', towerUid: t.uid, points });
    t.cooldownLeft += t.cooldown;
  },
};
