import type { TargetMode } from './types';
import type { EnemyState } from './EnemyState';
import type { HitFilter } from './SimContext';

/**
 * Whether an attack may touch this enemy: it must be alive and surfaced, flying enemies need
 * `canHitFlying`, stealth enemies need `canHitStealth` unless a support revealed them this tick.
 */
export function isTargetable(e: EnemyState, filter: HitFilter): boolean {
  if (!e.alive || e.burrowed) return false;
  if (e.flying && !filter.canHitFlying) return false;
  if (e.stealth && !filter.canHitStealth && !e.revealed) return false;
  return true;
}

/** Positive when `a` is a better pick than `b` for the mode. */
function compare(a: EnemyState, b: EnemyState, mode: TargetMode, x: number, y: number): number {
  switch (mode) {
    case 'first':
      return b.remaining - a.remaining;
    case 'last':
      return a.remaining - b.remaining;
    case 'strong':
      return a.hp + a.shield - (b.hp + b.shield) || b.remaining - a.remaining;
    case 'close': {
      const da = (a.x - x) ** 2 + (a.y - y) ** 2;
      const db = (b.x - x) ** 2 + (b.y - y) ** 2;
      return db - da || b.remaining - a.remaining;
    }
  }
}

/**
 * Pick the best targetable enemy among `candidates` (already range-filtered):
 * first = closest to its exit, last = furthest from it, strong = most HP + shield,
 * close = nearest to (x, y). Ties fall back to path progress, then lower uid.
 */
export function selectTarget(
  candidates: readonly EnemyState[],
  mode: TargetMode,
  x: number,
  y: number,
  filter: HitFilter,
): EnemyState | null {
  let best: EnemyState | null = null;
  for (const e of candidates) {
    if (!isTargetable(e, filter)) continue;
    if (!best) {
      best = e;
      continue;
    }
    const c = compare(e, best, mode, x, y);
    if (c > 0 || (c === 0 && e.uid < best.uid)) best = e;
  }
  return best;
}

/** Cycle order for the target mode button / Tab hotkey. */
export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'close'];
