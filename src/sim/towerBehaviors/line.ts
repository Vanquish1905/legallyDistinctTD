import type { EnemyState } from '../EnemyState';
import type { SimContext } from '../SimContext';
import type { TowerState } from '../TowerState';
import type { TowerBehavior } from './types';
import { FIELD_W, GAME_H } from '../../config';
import { idleReady, stunFromTower } from './common';

/** Half width of the rail line (px): enemies whose circle comes this close are hit. */
export const RAIL_HALF_WIDTH = 6;

const hits: EnemyState[] = [];
const along: number[] = [];

/** Distance from (x, y) along unit direction (dx, dy) to the edge of the field (0 if outside). */
function toFieldEdge(x: number, y: number, dx: number, dy: number): number {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (FIELD_W - x) / dx);
  else if (dx < -1e-9) t = Math.min(t, -x / dx);
  if (dy > 1e-9) t = Math.min(t, (GAME_H - y) / dy);
  else if (dy < -1e-9) t = Math.min(t, -y / dy);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

/**
 * Fire one rail shot from `t` toward `target`: an instant line from the muzzle to the field edge
 * that hits every hittable enemy whose circle touches it, nearest first, at most `pierce` of
 * them, each once. Emits 'towerFired' and 'railShot' (the line ends at the last enemy hit when
 * the pierce ran out). Returns the number of enemies hit.
 */
export function fireRail(t: TowerState, ctx: SimContext, target: EnemyState): number {
  const angle = Math.atan2(target.y - t.y, target.x - t.x);
  t.angle = angle;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const muzzle = t.def.footprint * 0.8;
  const x1 = t.x + dx * muzzle;
  const y1 = t.y + dy * muzzle;
  const len = toFieldEdge(x1, y1, dx, dy);
  hits.length = 0;
  along.length = 0;
  for (const e of ctx.enemies) {
    if (!ctx.canHit(e, t.stats)) continue;
    const s = (e.x - x1) * dx + (e.y - y1) * dy;
    const reach = e.radius + RAIL_HALF_WIDTH;
    if (s < -reach || s > len + reach) continue;
    if (Math.abs((e.x - x1) * dy - (e.y - y1) * dx) > reach) continue;
    let i = hits.length;
    hits.push(e);
    along.push(s);
    while (i > 0 && (along[i - 1] as number) > s) {
      hits[i] = hits[i - 1] as EnemyState;
      along[i] = along[i - 1] as number;
      i--;
    }
    hits[i] = e;
    along[i] = s;
  }
  const pierce = Math.max(1, Math.round(t.stats.pierce));
  const count = Math.min(pierce, hits.length);
  const end = count < hits.length ? Math.max(0, along[count - 1] as number) : len;
  ctx.events.push({
    type: 'towerFired', uid: t.uid, towerId: t.def.id, x: t.x, y: t.y, angle, targetUid: target.uid,
  });
  ctx.events.push({
    type: 'railShot', towerUid: t.uid, x1, y1, x2: x1 + dx * end, y2: y1 + dy * end, hits: count,
  });
  for (let i = 0; i < count; i++) {
    const e = hits[i] as EnemyState;
    ctx.hitEnemy(e, t.stats, t.uid);
    stunFromTower(t, e);
  }
  hits.length = 0;
  return count;
}

/**
 * Railgun: charges for `cooldown` s, then fires an instant piercing line (`fireRail`) through
 * the best target in range and everything behind it, all the way to the field edge.
 */
export const lineBehavior: TowerBehavior = {
  update(t, ctx, dt) {
    t.cooldownLeft -= dt;
    if (t.cooldownLeft > 0) return;
    const target = ctx.findTarget(t);
    if (!target) {
      idleReady(t);
      return;
    }
    t.targetUid = target.uid;
    fireRail(t, ctx, target);
    t.cooldownLeft = Math.max(t.cooldownLeft, -dt) + t.cooldown;
  },
};
