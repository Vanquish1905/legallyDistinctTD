import type { ProjectileMotion } from '../types';
import type { TowerState } from '../TowerState';
import type { EnemyState } from '../EnemyState';
import type { SimContext } from '../SimContext';
import type { TowerBehavior } from './types';
import { MIN_LOB_TIME } from '../ProjectileState';
import { pickTargets } from './common';

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

/** Where a shot leaves from: the tower itself, or a unit it owns (the helicopter). */
export interface ShotOrigin {
  readonly x: number;
  readonly y: number;
  /** Set to the firing direction. */
  angle: number;
}

/**
 * Fire one shot from `tower` at `target` using the tower's current stats. Projectile speed 0
 * means hitscan (instant hit, splash centred on the target). `origin` (default: the tower) is
 * where the shot starts and whose `angle` is turned toward the aim point.
 */
export function fireAt(
  tower: TowerState, target: EnemyState, ctx: SimContext, motion: ProjectileMotion, origin: ShotOrigin = tower,
): void {
  const s = tower.stats;
  const p = leadPoint(ctx, target, origin.x, origin.y, s.projectileSpeed, aim, motion === 'lob' ? MIN_LOB_TIME : 0);
  const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
  origin.angle = angle;
  ctx.events.push({
    type: 'towerFired', uid: tower.uid, towerId: tower.def.id, x: origin.x, y: origin.y,
    angle, targetUid: target.uid,
  });
  if (s.projectileSpeed <= 0) {
    if (s.splashRadius > 0) ctx.explode(target.x, target.y, s.splashRadius, s, tower.uid, false);
    else ctx.hitEnemy(target, s, tower.uid);
    return;
  }
  const muzzle = origin === tower ? tower.def.footprint * 0.8 : 0;
  ctx.spawnProjectile({
    towerUid: tower.uid,
    kind: tower.def.projectile?.kind ?? 'bullet',
    motion,
    x: origin.x + Math.cos(angle) * muzzle,
    y: origin.y + Math.sin(angle) * muzzle,
    targetX: p.x,
    targetY: p.y,
    targetUid: target.uid,
    speed: s.projectileSpeed,
    spec: s,
    damage: s.damage,
    pierce: Math.max(1, Math.round(s.pierce)),
    splashRadius: s.splashRadius,
    maxDistance: tower.range * (motion === 'boomerang' ? 2 : SHOT_RANGE_FACTOR),
    homingRadius: tower.def.projectile?.homingRadius,
  });
}

/** Upper bound on shots one tower fires in a single tick (very fast towers). */
const MAX_SHOTS_PER_TICK = 8;

const volley: EnemyState[] = [];

/**
 * Fire one volley: at `primary`, plus (with `stats.shots` > 1) at up to `shots - 1` further
 * distinct targets within `range` of the origin, picked by the tower's target mode.
 */
function fireVolley(
  tower: TowerState, primary: EnemyState, ctx: SimContext, motion: ProjectileMotion,
  origin: ShotOrigin = tower, range = tower.range,
): void {
  const n = Math.max(1, Math.round(tower.stats.shots ?? 1));
  if (n === 1) {
    fireAt(tower, primary, ctx, motion, origin);
    return;
  }
  pickTargets(tower, ctx, origin.x, origin.y, range, n, volley, primary);
  if (volley[0] !== primary) volley.unshift(primary);
  // fire the primary last so the turret ends up facing it
  for (let i = Math.min(volley.length, n) - 1; i >= 0; i--) fireAt(tower, volley[i] as EnemyState, ctx, motion, origin);
}

/** Finds what a firing loop shoots at (called again after each kill within a tick). */
export type Acquire = (tower: TowerState, ctx: SimContext) => EnemyState | null;

const acquireInRange: Acquire = (tower, ctx) => ctx.findTarget(tower);

/**
 * The generic firing loop: count the cooldown down, and when ready and `acquire` finds a target,
 * fire volleys from `origin` and restart the cooldown (keeping the sub-tick remainder so fire
 * rates stay exact). Cooldowns shorter than a tick fire several volleys per tick; leftover debt
 * is capped at one cooldown (and one tick) so a tower never bursts to catch up later. Returns
 * whether anything was fired.
 */
export function fireLoop(
  tower: TowerState, ctx: SimContext, dt: number, motion: ProjectileMotion,
  acquire: Acquire = acquireInRange, origin: ShotOrigin = tower, range = tower.range,
): boolean {
  tower.cooldownLeft -= dt;
  if (tower.cooldownLeft > 0) return false;
  const target = acquire(tower, ctx);
  if (!target) {
    tower.targetUid = -1;
    tower.cooldownLeft = 0;
    return false;
  }
  const cooldown = Math.max(tower.cooldown, 1e-6);
  let current: EnemyState | null = target;
  for (let shots = 0; current && tower.cooldownLeft <= 0 && shots < MAX_SHOTS_PER_TICK; shots++) {
    tower.targetUid = current.uid;
    fireVolley(tower, current, ctx, motion, origin, range);
    tower.cooldownLeft += cooldown;
    if (!current.alive) current = acquire(tower, ctx);
  }
  // Normal sub-tick remainders are > -dt; anything beyond is lag debt and is dropped.
  tower.cooldownLeft = Math.max(tower.cooldownLeft, current ? -Math.min(cooldown, dt) : 0);
  return true;
}

/**
 * The default shooter: `fireLoop` from the tower at the best target in range.
 * `motion` forces a projectile motion; by default it comes from `TowerDef.projectile`.
 */
export function createProjectileBehavior(motion?: ProjectileMotion): TowerBehavior {
  return {
    update(tower, ctx, dt) {
      fireLoop(tower, ctx, dt, motion ?? tower.def.projectile?.motion ?? 'straight');
    },
  };
}
