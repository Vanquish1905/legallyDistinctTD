import type { DamageType } from './types';

/** Armor can never reduce a hit below this fraction of its raw damage. */
export const MIN_DAMAGE_FRACTION = 0.1;

/** What damage math needs to know about a target. */
export interface DamageTarget {
  hp: number;
  shield: number;
  armor: number;
  readonly resist: Partial<Record<DamageType, number>> | undefined;
}

/** Outcome of one `applyDamage` call (reused out-object to avoid allocations). */
export interface DamageResult {
  /** HP actually removed (capped at the HP the target had). */
  dealt: number;
  /** Damage soaked by the shield. */
  absorbed: number;
  killed: boolean;
}

/** Whether armor applies to this damage type. */
function isArmorAffected(type: DamageType): boolean {
  return type === 'physical' || type === 'explosive';
}

/**
 * Damage after mitigation: armor first (flat, physical/explosive only, never below 10% of raw),
 * then the resist multiplier for the type (0 = immune).
 */
export function mitigate(
  raw: number,
  type: DamageType,
  armor: number,
  resist: Partial<Record<DamageType, number>> | undefined,
  ignoreArmor = false,
): number {
  if (raw <= 0) return 0;
  let d = raw;
  if (!ignoreArmor && armor > 0 && isArmorAffected(type)) {
    d = Math.max(raw - armor, raw * MIN_DAMAGE_FRACTION);
  }
  return d * (resist?.[type] ?? 1);
}

/** Make a fresh result object for `applyDamage`. */
export function makeDamageResult(): DamageResult {
  return { dealt: 0, absorbed: 0, killed: false };
}

/**
 * Mitigate `raw` and apply it to the target: the shield absorbs first, the rest goes to HP.
 * Mutates the target and writes the outcome into `out`.
 */
export function applyDamage(
  target: DamageTarget,
  raw: number,
  type: DamageType,
  out: DamageResult,
  ignoreArmor = false,
): DamageResult {
  out.dealt = 0;
  out.absorbed = 0;
  out.killed = false;
  if (target.hp <= 0) return out;
  let d = mitigate(raw, type, target.armor, target.resist, ignoreArmor);
  if (target.shield > 0 && d > 0) {
    const absorbed = Math.min(target.shield, d);
    target.shield -= absorbed;
    out.absorbed = absorbed;
    d -= absorbed;
  }
  if (d > 0) {
    const dealt = Math.min(target.hp, d);
    target.hp -= d;
    out.dealt = dealt;
    if (target.hp <= 0) {
      target.hp = 0;
      out.killed = true;
    }
  }
  return out;
}
