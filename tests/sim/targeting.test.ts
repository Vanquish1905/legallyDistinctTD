import { describe, expect, it } from 'vitest';
import { TARGET_MODES, isTargetable, selectTarget } from '../../src/sim/targeting';
import { makeEnemy, stubEnemy } from './helpers';

const open = { canHitStealth: true, canHitFlying: true };

describe('selectTarget', () => {
  const lead = makeEnemy(stubEnemy({ hp: 20 }), 900);
  const tank = makeEnemy(stubEnemy({ hp: 500 }), 500);
  const tail = makeEnemy(stubEnemy({ hp: 40 }), 100);
  const all = [tail, tank, lead];

  it('orders by mode', () => {
    expect(selectTarget(all, 'first', 0, 0, open)).toBe(lead);
    expect(selectTarget(all, 'last', 0, 0, open)).toBe(tail);
    expect(selectTarget(all, 'strong', 0, 0, open)).toBe(tank);
    // tower near x = 450 on the path: tank (x = 400) is closest
    expect(selectTarget(all, 'close', 450, 540, open)).toBe(tank);
  });

  it('breaks strong ties by path progress, then by uid', () => {
    const a = makeEnemy(stubEnemy(), 300);
    const b = makeEnemy(stubEnemy(), 600);
    expect(selectTarget([a, b], 'strong', 0, 0, open)).toBe(b);
    const c = makeEnemy(stubEnemy(), 300);
    expect(selectTarget([c, a], 'first', 0, 0, open)).toBe(a);
  });

  it('returns null when nothing is targetable', () => {
    expect(selectTarget([], 'first', 0, 0, open)).toBeNull();
  });

  it('lists the modes in cycle order', () => {
    expect(TARGET_MODES).toEqual(['first', 'last', 'strong', 'close']);
  });
});

describe('isTargetable', () => {
  it('needs canHitFlying for flying enemies', () => {
    const fly = makeEnemy(stubEnemy({ traits: ['flying'] }), 100);
    expect(isTargetable(fly, { canHitStealth: false, canHitFlying: false })).toBe(false);
    expect(isTargetable(fly, { canHitStealth: false, canHitFlying: true })).toBe(true);
  });

  it('needs canHitStealth for stealth enemies unless revealed', () => {
    const ghost = makeEnemy(stubEnemy({ traits: ['stealth'] }), 100);
    const blind = { canHitStealth: false, canHitFlying: true };
    expect(isTargetable(ghost, blind)).toBe(false);
    expect(isTargetable(ghost, open)).toBe(true);
    ghost.revealed = true;
    expect(isTargetable(ghost, blind)).toBe(true);
    expect(selectTarget([ghost], 'first', 0, 0, blind)).toBe(ghost);
  });

  it('skips dead and burrowed enemies', () => {
    const e = makeEnemy(stubEnemy(), 100);
    e.burrowed = true;
    expect(isTargetable(e, open)).toBe(false);
    e.burrowed = false;
    e.alive = false;
    expect(isTargetable(e, open)).toBe(false);
  });
});
