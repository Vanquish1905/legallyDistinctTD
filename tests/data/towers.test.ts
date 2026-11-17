import { describe, expect, it } from 'vitest';
import { TOWERS, TOWER_ORDER } from '../../src/data/towers';
import { TOWER_BEHAVIORS } from '../../src/sim/towerBehaviors';
import { canUpgrade, towerStatsAt, upgradeCost } from '../../src/sim/upgrades';
import type { NestedStatGroup, TowerDef } from '../../src/sim/types';

const PINNED = ['blaster', 'gatling', 'sniper', 'frost', 'flamethrower', 'rocket', 'seeker', 'spikes',
  'heli', 'tesla', 'laser', 'mortar', 'toxin', 'saw', 'pulse', 'railgun', 'radar', 'coinfactory'];
const CATEGORIES: Record<TowerDef['category'], string[]> = {
  basic: ['blaster', 'gatling', 'sniper', 'spikes', 'saw'],
  magic: ['frost', 'tesla', 'laser', 'toxin', 'pulse'],
  heavy: ['flamethrower', 'rocket', 'seeker', 'mortar', 'railgun', 'heli'],
  support: ['radar', 'coinfactory'],
};
const all = Object.values(TOWERS);

describe('tower data integrity', () => {
  it('has the 18 pinned towers in order with matching ids', () => {
    expect([...TOWER_ORDER]).toEqual(PINNED);
    expect(Object.keys(TOWERS).sort()).toEqual([...PINNED].sort());
    for (const [id, def] of Object.entries(TOWERS)) expect(def.id).toBe(id);
    expect(new Set(all.map((d) => d.name)).size).toBe(all.length);
  });

  it('uses the pinned categories, sprite keys and known behaviours', () => {
    for (const [cat, ids] of Object.entries(CATEGORIES)) {
      for (const id of ids) expect(TOWERS[id as keyof typeof TOWERS].category).toBe(cat);
    }
    for (const d of all) {
      expect(d.sprite.base).toBe(`tower-${d.id}-base`);
      if (d.sprite.turret) expect(d.sprite.turret).toBe(`tower-${d.id}-turret`);
      expect(TOWER_BEHAVIORS[d.behavior ?? 'projectile']).toBeDefined();
      expect(d.cost).toBeGreaterThan(0);
      expect(d.footprint).toBeGreaterThan(0);
    }
    expect(TOWERS.spikes.placement).toBe('path');
    expect(TOWERS.mortar.stats.canHitFlying).toBe(false);
    expect(TOWERS.blaster.cost).toBe(200);
  });

  it('has 2 paths x 3 named, priced, non-empty tiers per tower', () => {
    for (const d of all) {
      expect(d.paths).toHaveLength(2);
      for (const p of d.paths) {
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.tiers).toHaveLength(3);
        for (const t of p.tiers) {
          expect(t.cost, `${d.id} ${t.name}`).toBeGreaterThan(0);
          expect(t.name.length).toBeGreaterThan(0);
          expect(t.description.length).toBeGreaterThan(5);
          expect(t.icon).toMatch(/^icon-/);
          const m = t.mods;
          const count = Object.keys(m.add ?? {}).length + Object.keys(m.mul ?? {}).length
            + Object.keys(m.set ?? {}).length + (m.flags?.length ?? 0);
          expect(count, `${d.id} ${t.name} has no effect`).toBeGreaterThan(0);
        }
        expect(p.tiers[2].cost).toBeGreaterThan(p.tiers[0].cost);
      }
    }
  });

  it('only uses dotted mods on sub-objects that exist and are never replaced by a set', () => {
    for (const d of all) {
      const tiers = d.paths.flatMap((p) => p.tiers);
      const setGroups = new Set(tiers.flatMap((t) => Object.keys(t.mods.set ?? {})));
      for (const t of tiers) {
        for (const k of [...Object.keys(t.mods.add ?? {}), ...Object.keys(t.mods.mul ?? {})]) {
          if (!k.includes('.')) continue;
          const g = k.split('.')[0] as NestedStatGroup;
          expect(d.stats[g], `${d.id}: ${k}`).toBeDefined();
          expect(setGroups.has(g), `${d.id}: ${k} vs set`).toBe(false);
        }
      }
    }
  });

  it('computes sensible stats at every legal build', () => {
    for (const d of all) {
      for (let a = 0; a <= 3; a++) {
        for (let b = 0; b <= 3; b++) {
          if (a > 2 && b > 2) continue;
          const s = towerStatsAt(d, [a, b]);
          expect(s.cooldown, d.id).toBeGreaterThan(0);
          expect(Number.isFinite(s.damage)).toBe(true);
          if (s.slow) expect(s.slow.factor).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(towerStatsAt(TOWERS.frost, [1, 0]).slow?.factor).toBeCloseTo(0.44);
    expect(towerStatsAt(TOWERS.tesla, [0, 3]).chain?.falloff).toBeCloseTo(0.95);
    expect(towerStatsAt(TOWERS.coinfactory, [3, 0]).income).toBe(400);
  });
});

describe('upgrade helpers', () => {
  it('prices tiers and reports why an upgrade is blocked', () => {
    const def = TOWERS.blaster;
    expect(upgradeCost(def, 0, 1)).toBe(80);
    expect(upgradeCost(def, 1, 3, 1.5)).toBe(975);
    expect(upgradeCost(def, 0, 4)).toBeNull();
    expect(canUpgrade({ def, tiers: [0, 0] }, 0, 1000)).toEqual({ ok: true, cost: 80 });
    expect(canUpgrade({ def, tiers: [0, 0] }, 0, 10)).toEqual({ ok: false, reason: 'money', cost: 80 });
    expect(canUpgrade({ def, tiers: [3, 0] }, 0)).toMatchObject({ ok: false, reason: 'maxed' });
    expect(canUpgrade({ def, tiers: [3, 2] }, 1)).toMatchObject({ ok: false, reason: 'locked' });
    expect(canUpgrade({ def, tiers: [2, 2] }, 1).ok).toBe(true);
  });
});

describe('GameSim.canUpgrade', () => {
  it('uses the sim wallet', async () => {
    const { makeSim } = await import('../sim/helpers');
    const sim = makeSim({ towers: TOWERS });
    const t = sim.placeTower('blaster', 600, 300)!;
    expect(sim.canUpgrade(t.uid, 0)).toEqual({ ok: true, cost: 80 });
    expect(sim.canUpgrade(9999, 0)).toBeNull();
  });
});
