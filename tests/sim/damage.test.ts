import { describe, expect, it } from 'vitest';
import { applyDamage, makeDamageResult, mitigate, type DamageTarget } from '../../src/sim/damage';

function target(over: Partial<DamageTarget> = {}): DamageTarget {
  return { hp: 100, shield: 0, armor: 0, resist: undefined, ...over };
}

describe('mitigate', () => {
  it('subtracts armor from physical and explosive hits only', () => {
    expect(mitigate(20, 'physical', 5, undefined)).toBe(15);
    expect(mitigate(20, 'explosive', 5, undefined)).toBe(15);
    expect(mitigate(20, 'fire', 5, undefined)).toBe(20);
    expect(mitigate(20, 'poison', 50, undefined)).toBe(20);
  });

  it('never lets armor go below 10% of the raw damage', () => {
    expect(mitigate(10, 'physical', 50, undefined)).toBeCloseTo(1);
    expect(mitigate(10, 'physical', 9.5, undefined)).toBeCloseTo(1);
    expect(mitigate(10, 'physical', 8, undefined)).toBeCloseTo(2);
  });

  it('applies resist multipliers after armor, 0 meaning immune', () => {
    expect(mitigate(20, 'physical', 5, { physical: 0.5 })).toBe(7.5);
    expect(mitigate(20, 'ice', 0, { ice: 0 })).toBe(0);
    expect(mitigate(20, 'fire', 0, { fire: 1.5 })).toBe(30);
    expect(mitigate(100, 'physical', 500, { physical: 0 })).toBe(0);
  });

  it('can ignore armor', () => {
    expect(mitigate(20, 'physical', 15, undefined, true)).toBe(20);
  });

  it('ignores non-positive damage', () => {
    expect(mitigate(0, 'fire', 0, undefined)).toBe(0);
    expect(mitigate(-5, 'fire', 0, undefined)).toBe(0);
  });
});

describe('applyDamage', () => {
  it('lets the shield absorb first, then hp', () => {
    const t = target({ shield: 15 });
    const r = applyDamage(t, 20, 'energy', makeDamageResult());
    expect(r).toEqual({ dealt: 5, absorbed: 15, killed: false });
    expect(t).toMatchObject({ hp: 95, shield: 0 });
  });

  it('absorbs fully when the shield is big enough', () => {
    const t = target({ shield: 50 });
    applyDamage(t, 20, 'energy', makeDamageResult());
    expect(t).toMatchObject({ hp: 100, shield: 30 });
  });

  it('mitigates before the shield sees the damage', () => {
    const t = target({ shield: 10, armor: 6 });
    const r = applyDamage(t, 20, 'physical', makeDamageResult());
    expect(r.absorbed).toBe(10);
    expect(t.hp).toBe(96);
  });

  it('kills at 0 hp, caps dealt at remaining hp and ignores dead targets', () => {
    const t = target({ hp: 8 });
    const out = makeDamageResult();
    expect(applyDamage(t, 20, 'fire', out)).toEqual({ dealt: 8, absorbed: 0, killed: true });
    expect(t.hp).toBe(0);
    expect(applyDamage(t, 20, 'fire', out)).toEqual({ dealt: 0, absorbed: 0, killed: false });
  });
});
