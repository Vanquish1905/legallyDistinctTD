import type { ProjectileMotion } from './types';
import type { EnemyState } from './EnemyState';
import type { HitSpec, SimContext } from './SimContext';
import { FIELD_W, GAME_H } from '../config';
import { distToSegment, lerp } from './geometry';

/** Default collision radius of a projectile (px). */
const PROJECTILE_RADIUS = 8;
/** Default homing retarget radius (px). */
const DEFAULT_HOMING_RADIUS = 150;
/** Shortest flight time of a lobbed shell (s). */
export const MIN_LOB_TIME = 0.35;
/** Impact radius of a lobbed shell without splash (px). */
const MIN_LOB_IMPACT = 24;
/** Projectiles further than this outside the field are dropped (px). */
const BOUNDS_MARGIN = 120;

/** Parameters for launching a projectile. */
export interface ProjectileInit {
  towerUid: number;
  /** Texture kind (`proj-<kind>`). */
  kind: string;
  motion: ProjectileMotion;
  x: number;
  y: number;
  /** Aim point: direction for straight/homing shots, landing point for lobbed ones. */
  targetX: number;
  targetY: number;
  /** Enemy to home onto (-1 = none). */
  targetUid: number;
  speed: number;
  spec: HitSpec;
  damage: number;
  /** Number of enemies the shot can hit before it is spent. */
  pierce: number;
  splashRadius: number;
  /** Max travel distance for straight/homing shots. */
  maxDistance: number;
  homingRadius?: number;
  radius?: number;
}

/** A pooled projectile. `active` is false once it has expired. */
export class ProjectileState {
  uid = 0;
  active = false;
  towerUid = -1;
  kind = 'bullet';
  motion: ProjectileMotion = 'straight';
  x = 0;
  y = 0;
  /** Height above the ground (lobbed shells only), for rendering. */
  z = 0;
  vx = 0;
  vy = 0;
  angle = 0;
  speed = 0;
  radius = PROJECTILE_RADIUS;
  spec: HitSpec = {
    damage: 0, damageType: 'physical', canHitFlying: true, canHitStealth: false,
  };
  damage = 0;
  pierce = 1;
  splashRadius = 0;
  targetUid = -1;
  homingRadius = DEFAULT_HOMING_RADIUS;
  traveled = 0;
  maxDistance = 0;
  startX = 0;
  startY = 0;
  endX = 0;
  endY = 0;
  flightTime = 0;
  elapsed = 0;
  arcHeight = 0;
  /** Uids of enemies already hit (each enemy is hit at most once per projectile). */
  readonly hits: number[] = [];

  /** Reset this instance for a new shot. */
  launch(uid: number, o: ProjectileInit): void {
    this.uid = uid;
    this.active = true;
    this.towerUid = o.towerUid;
    this.kind = o.kind;
    this.motion = o.motion;
    this.x = this.startX = o.x;
    this.y = this.startY = o.y;
    this.z = 0;
    this.endX = o.targetX;
    this.endY = o.targetY;
    this.targetUid = o.targetUid;
    this.speed = o.speed;
    this.spec = o.spec;
    this.damage = o.damage;
    this.pierce = o.pierce;
    this.splashRadius = o.splashRadius;
    this.maxDistance = o.maxDistance;
    this.homingRadius = o.homingRadius ?? DEFAULT_HOMING_RADIUS;
    this.radius = o.radius ?? PROJECTILE_RADIUS;
    this.traveled = 0;
    this.elapsed = 0;
    this.hits.length = 0;
    const dx = o.targetX - o.x;
    const dy = o.targetY - o.y;
    const d = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);
    this.vx = d > 0 ? (dx / d) * o.speed : o.speed;
    this.vy = d > 0 ? (dy / d) * o.speed : 0;
    this.flightTime = o.speed > 0 ? Math.max(MIN_LOB_TIME, d / o.speed) : MIN_LOB_TIME;
    this.arcHeight = Math.max(40, d * 0.3);
  }
}

/** Free-list of projectile instances, so firing does not allocate in steady state. */
export class ProjectilePool {
  private readonly free: ProjectileState[] = [];

  /** Take an instance (new or recycled). */
  acquire(): ProjectileState {
    return this.free.pop() ?? new ProjectileState();
  }

  /** Give an expired instance back. */
  release(p: ProjectileState): void {
    p.active = false;
    this.free.push(p);
  }
}

const scratch: EnemyState[] = [];

function steerHoming(p: ProjectileState, ctx: SimContext): void {
  let target = p.targetUid >= 0 ? ctx.getEnemy(p.targetUid) : undefined;
  if (target && !ctx.canHit(target, p.spec)) target = undefined;
  if (!target) {
    p.targetUid = -1;
    let best = Infinity;
    for (const e of ctx.queryEnemies(p.x, p.y, p.homingRadius, scratch)) {
      if (!ctx.canHit(e, p.spec) || p.hits.includes(e.uid)) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < best) {
        best = d;
        target = e;
      }
    }
    if (target) p.targetUid = target.uid;
  }
  if (!target) return;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return;
  p.vx = (dx / d) * p.speed;
  p.vy = (dy / d) * p.speed;
  p.angle = Math.atan2(dy, dx);
}

function hitAlongSegment(p: ProjectileState, ctx: SimContext, x0: number, y0: number): void {
  const midX = (x0 + p.x) / 2;
  const midY = (y0 + p.y) / 2;
  const half = Math.hypot(p.x - x0, p.y - y0) / 2;
  const candidates = ctx.queryEnemies(midX, midY, half + p.radius, scratch);
  for (const e of candidates) {
    if (p.pierce <= 0) break;
    if (!ctx.canHit(e, p.spec) || p.hits.includes(e.uid)) continue;
    if (distToSegment(e.x, e.y, x0, y0, p.x, p.y) > e.radius + p.radius) continue;
    p.hits.push(e.uid);
    p.pierce -= 1;
    if (p.splashRadius > 0) {
      ctx.explode(e.x, e.y, p.splashRadius, p.spec, p.towerUid, false, p.damage);
    } else {
      ctx.hitEnemy(e, p.spec, p.towerUid, p.damage);
    }
  }
  if (p.pierce <= 0) p.active = false;
}

function updateLob(p: ProjectileState, ctx: SimContext, dt: number): void {
  p.elapsed += dt;
  const t = Math.min(1, p.elapsed / p.flightTime);
  p.x = lerp(p.startX, p.endX, t);
  p.y = lerp(p.startY, p.endY, t);
  p.z = 4 * p.arcHeight * t * (1 - t);
  if (t < 1) return;
  const radius = Math.max(p.splashRadius, MIN_LOB_IMPACT);
  ctx.explode(p.x, p.y, radius, p.spec, p.towerUid, true, p.damage);
  p.active = false;
}

/**
 * Advance one projectile by `dt`: straight shots fly on, homing shots re-aim every tick (and pick a
 * new target within `homingRadius` if theirs is gone), lobbed shells follow a parabola and burst on
 * the ground (never hitting flying enemies). Sets `active = false` when spent.
 */
export function updateProjectile(p: ProjectileState, ctx: SimContext, dt: number): void {
  if (!p.active) return;
  if (p.motion === 'lob') {
    updateLob(p, ctx, dt);
    return;
  }
  if (p.motion === 'homing') steerHoming(p, ctx);
  const x0 = p.x;
  const y0 = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.traveled += p.speed * dt;
  hitAlongSegment(p, ctx, x0, y0);
  if (
    p.traveled >= p.maxDistance
    || p.x < -BOUNDS_MARGIN || p.x > FIELD_W + BOUNDS_MARGIN
    || p.y < -BOUNDS_MARGIN || p.y > GAME_H + BOUNDS_MARGIN
  ) {
    p.active = false;
  }
}
