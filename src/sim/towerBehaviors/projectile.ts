import type { ProjectileMotion } from '../types';
import type { TowerState } from '../TowerState';
import type { EnemyState } from '../EnemyState';
import type { SimContext } from '../SimContext';
import type { TowerBehavior } from './types';
import { MIN_LOB_TIME } from '../ProjectileState';

/** Straight/homing shots may fly this many times the tower range before expiring. */
const SHOT_RANGE_FACTOR = 1.5;

/**
 * Where `target` will be after a shot travelling at `speed` from (x, y) reaches it
 * (one-step lead along its path; flight time at least `minTime`). Writes into `out`.
 */
export function leadPoint(
  ctx: SimContext, target: EnemyState, x: number, y: number, speed: number, out: { x: number; y: number }, minTime = 0,
): { x: number; y: number } {
  if (speed <= 0 || target.currentSpeed <= 0) {
    out.x = target.x;
    out.y = target.y;
    return out;
  }
  const t = Math.max(minTime, Math.hypot(target.x - x, target.y - y) / speed);
  const path = ctx.pathAt(target.pathIndex);
  const dx = target.x - path.positionAt(target.distance, out).x;
  const dy = target.y - out.y;
  path.positionAt(target.distance + target.currentSpeed * t, out);
  out.x += dx;
  out.y += dy;
  return out;
}

const aim = { x: 0, y: 0 };

/**
 * Fire one shot from `tower` at `target` using the tower's current stats. Projectile speed 0
 * means hitscan (instant hit, splash centred on the target).
 */
export function fireAt(tower: TowerState, target: EnemyState, ctx: SimContext, motion: ProjectileMotion): void {
  const s = tower.stats;
  const p = leadPoint(ctx, target, tower.x, tower.y, s.projectileSpeed, aim, motion === 'lob' ? MIN_LOB_TIME : 0);
  tower.angle = Math.atan2(p.y - tower.y, p.x - tower.x);
  ctx.events.push({
    type: 'towerFired', uid: tower.uid, towerId: tower.def.id, x: tower.x, y: tower.y,
    angle: tower.angle, targetUid: target.uid,
  });
  if (s.projectileSpeed <= 0) {
    if (s.splashRadius > 0) ctx.explode(target.x, target.y, s.splashRadius, s, tower.uid, false);
    else ctx.hitEnemy(target, s, tower.uid);
    return;
  }
  const muzzle = tower.def.footprint * 0.8;
  ctx.spawnProjectile({
    towerUid: tower.uid,
    kind: tower.def.projectile?.kind ?? 'bullet',
    motion,
    x: tower.x + Math.cos(tower.angle) * muzzle,
    y: tower.y + Math.sin(tower.angle) * muzzle,
    targetX: p.x,
    targetY: p.y,
    targetUid: target.uid,
    speed: s.projectileSpeed,
    spec: s,
    damage: s.damage,
    pierce: Math.max(1, Math.round(s.pierce)),
    splashRadius: s.splashRadius,
    maxDistance: tower.range * SHOT_RANGE_FACTOR,
    homingRadius: tower.def.projectile?.homingRadius,
  });
}

/**
 * The generic firing loop: count the cooldown down, and when ready and a target is in range,
 * fire and restart the cooldown (keeping the sub-tick remainder so fire rates stay exact).
 * `motion` forces a projectile motion; by default it comes from `TowerDef.projectile`.
 */
export function createProjectileBehavior(motion?: ProjectileMotion): TowerBehavior {
  return {
    update(tower, ctx, dt) {
      tower.cooldownLeft -= dt;
      if (tower.cooldownLeft > 0) return;
      const target = ctx.findTarget(tower);
      if (!target) {
        tower.targetUid = -1;
        tower.cooldownLeft = 0;
        return;
      }
      tower.targetUid = target.uid;
      fireAt(tower, target, ctx, motion ?? tower.def.projectile?.motion ?? 'straight');
      tower.cooldownLeft += tower.cooldown;
    },
  };
}
