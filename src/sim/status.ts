import type { DamageType } from './types';

/** Maximum stacks a single damage-over-time source can build on one enemy. */
export const MAX_DOT_STACKS = 5;

/**
 * Control resistance (bosses): slows keep this share of their strength, so a 0.5 slow becomes
 * 1 - 0.5 * 0.4 = 0.8.
 */
export const RESIST_SLOW_STRENGTH = 0.4;
/** Control resistance: a slow can never push speed below this multiplier. */
export const RESIST_SLOW_FLOOR = 0.6;
/** Control resistance: stun durations are scaled by this. */
export const RESIST_STUN_FACTOR = 0.25;
/** Control resistance: after a stun lands, further stuns are ignored for this long (s). */
export const RESIST_STUN_COOLDOWN = 2.5;

/** One damage-over-time entry, keyed by its source (tower uid). */
export interface DotEffect {
  source: number;
  /** Damage per second per stack. */
  dps: number;
  type: DamageType;
  remaining: number;
  stacks: number;
}

/** Status effects on one enemy. */
export interface StatusState {
  /** Speed multiplier of the active slow (1 = none). */
  slowFactor: number;
  slowRemaining: number;
  stunRemaining: number;
  /** Seconds until a control-resistant enemy can be stunned again. */
  stunCooldown: number;
  dots: DotEffect[];
}

/** Fresh, effect-free status state. */
export function makeStatus(): StatusState {
  return { slowFactor: 1, slowRemaining: 0, stunRemaining: 0, stunCooldown: 0, dots: [] };
}

/**
 * Apply a slow. Slows do not stack: the strongest (lowest factor) wins. An equal slow refreshes
 * the duration; a weaker one is ignored while a stronger one is active.
 */
export function applySlow(s: StatusState, factor: number, duration: number): void {
  if (duration <= 0 || factor >= 1) return;
  const f = Math.max(0, factor);
  if (s.slowRemaining <= 0 || f < s.slowFactor) {
    s.slowFactor = f;
    s.slowRemaining = duration;
  } else if (f === s.slowFactor) {
    s.slowRemaining = Math.max(s.slowRemaining, duration);
  }
}

/** Slow factor a control-resistant enemy actually gets from a slow of `factor`. */
export function resistedSlowFactor(factor: number): number {
  return Math.max(RESIST_SLOW_FLOOR, 1 - (1 - factor) * RESIST_SLOW_STRENGTH);
}

/**
 * Stun for at least `duration` seconds (does not add up). Control-resistant enemies (`resist`)
 * take a quarter of the duration and then ignore stuns for `RESIST_STUN_COOLDOWN` s, so many
 * stunning towers cannot chain-lock them.
 */
export function applyStun(s: StatusState, duration: number, resist = false): void {
  if (duration <= 0) return;
  if (resist) {
    if (s.stunCooldown > 0) return;
    duration *= RESIST_STUN_FACTOR;
    s.stunCooldown = RESIST_STUN_COOLDOWN;
  }
  if (duration > s.stunRemaining) s.stunRemaining = duration;
}

/**
 * Apply damage over time. Each source stacks up to `MAX_DOT_STACKS` times on the same enemy;
 * reapplying adds a stack, refreshes the duration and takes the latest dps.
 */
export function applyDot(s: StatusState, source: number, dps: number, duration: number, type: DamageType): void {
  if (dps <= 0 || duration <= 0) return;
  for (const dot of s.dots) {
    if (dot.source === source && dot.type === type) {
      dot.stacks = Math.min(MAX_DOT_STACKS, dot.stacks + 1);
      dot.remaining = Math.max(dot.remaining, duration);
      dot.dps = dps;
      return;
    }
  }
  s.dots.push({ source, dps, type, remaining: duration, stacks: 1 });
}

/** Movement multiplier from statuses: 0 while stunned, else the slow factor. */
export function statusSpeedFactor(s: StatusState): number {
  if (s.stunRemaining > 0) return 0;
  return s.slowRemaining > 0 ? s.slowFactor : 1;
}

/** Receives the damage each dot deals during a tick. */
export type DotSink = (dot: DotEffect, amount: number) => void;

/**
 * Advance timers by `dt`. Each dot reports its damage for this tick to `sink`; expired effects
 * are removed.
 */
export function tickStatus(s: StatusState, dt: number, sink: DotSink): void {
  if (s.slowRemaining > 0) {
    s.slowRemaining -= dt;
    if (s.slowRemaining <= 0) {
      s.slowRemaining = 0;
      s.slowFactor = 1;
    }
  }
  if (s.stunRemaining > 0) s.stunRemaining = Math.max(0, s.stunRemaining - dt);
  if (s.stunCooldown > 0) s.stunCooldown = Math.max(0, s.stunCooldown - dt);
  if (s.dots.length === 0) return;
  let write = 0;
  for (let i = 0; i < s.dots.length; i++) {
    const dot = s.dots[i] as DotEffect;
    const active = Math.min(dt, dot.remaining);
    dot.remaining -= dt;
    if (active > 0) sink(dot, dot.dps * dot.stacks * active);
    if (dot.remaining > 0) s.dots[write++] = dot;
  }
  s.dots.length = write;
}
