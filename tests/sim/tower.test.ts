import { describe, expect, it } from 'vitest';
import { TowerState, canUpgradePath, computeStats } from '../../src/sim/TowerState';
import { stubTower } from './helpers';

describe('canUpgradePath', () => {
  it('allows up to tier 3 on one path and tier 2 on the other', () => {
    expect(canUpgradePath([0, 0], 0)).toBe(true);
    expect(canUpgradePath([2, 2], 0)).toBe(true);
    expect(canUpgradePath([3, 2], 1)).toBe(false);
    expect(canUpgradePath([3, 1], 1)).toBe(true);
    expect(canUpgradePath([3, 0], 0)).toBe(false);
    expect(canUpgradePath([2, 3], 0)).toBe(false);
  });
});

describe('computeStats', () => {
  it('applies adds, then multipliers, then sets, collecting flags', () => {
    const def = stubTower();
    expect(computeStats(def, [0, 0]).stats.damage).toBe(10);
    expect(computeStats(def, [1, 0]).stats.damage).toBe(15);
    const t3 = computeStats(def, [3, 0]);
    expect(t3.stats.damage).toBe(30);
    expect([...t3.flags]).toEqual(['big']);
  });

  it('does not depend on which path was bought first', () => {
    const def = stubTower({
      paths: [
        { name: 'A', tiers: [
          { name: '', description: '', cost: 1, icon: '', mods: { mul: { range: 2 } } },
          { name: '', description: '', cost: 1, icon: '', mods: { set: { slow: { factor: 0.5, duration: 1 } } } },
          { name: '', description: '', cost: 1, icon: '', mods: {} },
        ] },
        { name: 'B', tiers: [
          { name: '', description: '', cost: 1, icon: '', mods: { add: { range: 50, income: 20 } } },
          { name: '', description: '', cost: 1, icon: '', mods: {} },
          { name: '', description: '', cost: 1, icon: '', mods: {} },
        ] },
      ],
    });
    const s = computeStats(def, [2, 1]).stats;
    expect(s.range).toBe(500);
    expect(s.income).toBe(20);
    expect(s.slow).toEqual({ factor: 0.5, duration: 1 });
    // base definition untouched
    expect(def.stats.range).toBe(200);
    expect(def.stats.slow).toBeUndefined();
  });

  it('recomputes on upgrade and tracks spend', () => {
    const t = new TowerState({ uid: 1, def: stubTower(), x: 0, y: 0, spent: 100, placedBuildWave: 0 });
    const before = t.stats;
    t.applyUpgrade(0, 10);
    expect(t.tiers).toEqual([1, 0]);
    expect(t.spent).toBe(110);
    expect(t.stats.damage).toBe(15);
    expect(before.damage).toBe(10);
    expect(t.behavior).toBe('projectile');
  });
});
