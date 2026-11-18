import type { EnemyState } from '../EnemyState';
import type { SimContext } from '../SimContext';
import type { TowerState, TowerUnit } from '../TowerState';
import type { TowerBehavior } from './types';
import { FIELD_W, GAME_H } from '../../config';
import { clamp } from '../geometry';
import { pickTargets } from './common';
import { fireLoop, type Acquire } from './projectile';

/** Flight stats used when a heli tower has none. */
const DEFAULT_FLIGHT = { speed: 220, turnRate: 3.5, leash: 350 };
/** Hunting: circle the target at this fraction of the gun range... */
const ORBIT_FRACTION = 0.45;
/** ...but never wider than this (px). */
const ORBIT_MAX = 110;
/** Idle: circle the pad / patrol point at this radius (px). */
const IDLE_ORBIT = 48;
/** Steer toward the point this far ahead on the orbit circle (rad), which makes it circle. */
const ORBIT_LEAD = 0.9;
/** Speed share kept while facing directly away from where it wants to go. */
const MIN_SPEED_SHARE = 0.35;

const chase: EnemyState[] = [];
const gunTargets: EnemyState[] = [];
/** Muzzle of the helicopter for `fireLoop` (moved onto the unit before firing). */
const gun = { x: 0, y: 0, angle: 0 };

/** The tower's helicopter, created on its pad when missing. */
function ensureUnit(t: TowerState): TowerUnit {
  if (!t.unit) t.unit = { x: t.x, y: t.y, angle: -Math.PI / 2 };
  return t.unit;
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Turn toward (tx, ty) at most `turnRate * dt` and fly forward; slower while turning hard. */
function steer(u: TowerUnit, tx: number, ty: number, speed: number, turnRate: number, dt: number): void {
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const diff = wrapAngle(Math.atan2(dy, dx) - u.angle);
  const maxTurn = turnRate * dt;
  u.angle = wrapAngle(u.angle + clamp(diff, -maxTurn, maxTurn));
  const share = MIN_SPEED_SHARE + (1 - MIN_SPEED_SHARE) * Math.max(0, Math.cos(diff));
  const step = Math.min(speed * share * dt, d);
  u.x = clamp(u.x + Math.cos(u.angle) * step, 0, FIELD_W);
  u.y = clamp(u.y + Math.sin(u.angle) * step, 0, GAME_H);
}

/** Circle (cx, cy) at radius `r`: steer to a point slightly ahead on that circle. */
function orbit(u: TowerUnit, cx: number, cy: number, r: number, speed: number, turnRate: number, dt: number): void {
  const phi = Math.atan2(u.y - cy, u.x - cx) + ORBIT_LEAD;
  steer(u, cx + Math.cos(phi) * r, cy + Math.sin(phi) * r, speed, turnRate, dt);
}

/** Gun target: the chased enemy if it is within gun range of the helicopter, else the best one. */
const acquireFromUnit: Acquire = (t: TowerState, ctx: SimContext) => {
  const u = ensureUnit(t);
  const keep = ctx.getEnemy(t.memory.chaseUid ?? -1);
  pickTargets(t, ctx, u.x, u.y, t.range, 1, gunTargets, keep);
  return gunTargets[0] ?? null;
};

/**
 * Heli Pad: owns a helicopter (`tower.unit`) that hunts the best target (by target mode) within
 * `flight.leash` of its anchor — the pad, or the player's patrol point (`tower.patrol`) — and
 * circles it while its door guns fire (the projectile loop, from the helicopter, `range` = gun
 * reach). With nothing to hunt it circles the anchor. The chased enemy is `memory.chaseUid`.
 */
export const heliBehavior: TowerBehavior = {
  onPlace(t) {
    ensureUnit(t);
  },
  update(t, ctx, dt) {
    const u = ensureUnit(t);
    const f = t.stats.flight ?? DEFAULT_FLIGHT;
    const anchor = t.patrol ?? t;
    const keep = ctx.getEnemy(t.memory.chaseUid ?? -1);
    pickTargets(t, ctx, anchor.x, anchor.y, f.leash, 1, chase, keep);
    const prey = chase[0];
    t.memory.chaseUid = prey ? prey.uid : -1;
    if (prey) orbit(u, prey.x, prey.y, Math.min(ORBIT_MAX, t.range * ORBIT_FRACTION), f.speed, f.turnRate, dt);
    else orbit(u, anchor.x, anchor.y, IDLE_ORBIT, f.speed, f.turnRate, dt);
    gun.x = u.x;
    gun.y = u.y;
    gun.angle = t.angle;
    if (fireLoop(t, ctx, dt, t.def.projectile?.motion ?? 'straight', acquireFromUnit, gun, t.range)) t.angle = gun.angle;
  },
};
