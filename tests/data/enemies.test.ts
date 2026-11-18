import { describe, expect, it } from 'vitest';
import { BOSS_IDS, ENEMIES, ENEMY_IDS, isBoss } from '../../src/data/enemies';
import { BOSSES } from '../../src/data/bosses';
import { DIFFICULTIES } from '../../src/data/difficulty';
import type { EnemyAbilityDef, EnemyDef, EnemyTrait } from '../../src/sim/types';

const PINNED_ENEMIES = ['larva', 'mite', 'tick', 'leech', 'spore', 'sporelet', 'phantom', 'beetle', 'swarmling',
  'jelly', 'shieldbug', 'medic', 'burrower', 'gnat'];
const PINNED_BOSSES = ['queen', 'irontick', 'hivemind', 'colossus', 'omega'];

const all: [string, EnemyDef][] = Object.entries(ENEMIES);
const regulars = all.filter(([id]) => !isBoss(id));
const bosses = all.filter(([id]) => isBoss(id));

/** The ability and every ability nested in its phases and combos. */
function flatten(a: EnemyAbilityDef | undefined): EnemyAbilityDef[] {
  if (!a) return [];
  if (a.kind === 'bossPhases') return [a, ...a.phases.flatMap((p) => flatten(p.ability))];
  if (a.kind === 'combo') return [a, ...a.abilities.flatMap(flatten)];
  return [a];
}

const TRAIT_FOR: Partial<Record<EnemyAbilityDef['kind'], EnemyTrait>> = {
  shieldAura: 'shielder', healAura: 'healer', burrow: 'burrower', spawn: 'spawner',
};

describe('enemy registry', () => {
  it('has exactly the pinned ids, keyed by their own id', () => {
    expect([...ENEMY_IDS]).toEqual(PINNED_ENEMIES);
    expect([...BOSS_IDS]).toEqual(PINNED_BOSSES);
    expect(Object.keys(ENEMIES).sort()).toEqual([...PINNED_ENEMIES, ...PINNED_BOSSES].sort());
    for (const [id, def] of all) expect(def.id).toBe(id);
  });

  it('merges every boss in unchanged', () => {
    for (const id of BOSS_IDS) expect(ENEMIES[id]).toBe(BOSSES[id]);
  });

  it('isBoss matches the boss list and the boss trait', () => {
    for (const [id, def] of all) expect(isBoss(id)).toBe(def.traits.includes('boss'));
    expect(isBoss('larva')).toBe(false);
    expect(isBoss('nope')).toBe(false);
  });

  it('uses the pinned sprite keys', () => {
    for (const [id, def] of regulars) expect(def.sprite).toBe(`enemy-${id}`);
    for (const [id, def] of bosses) expect(def.sprite).toBe(`boss-${id}`);
  });

  it('has a name and a short description for every entry', () => {
    for (const [, def] of all) {
      expect(def.name.trim()).not.toBe('');
      expect(def.description.trim().length).toBeGreaterThan(20);
      expect(def.description.length).toBeLessThanOrEqual(140);
    }
  });

  it('has sane numbers', () => {
    for (const [, def] of all) {
      expect(def.hp).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.armor).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(def.reward) && def.reward > 0).toBe(true);
      expect(Number.isInteger(def.leakDamage) && def.leakDamage >= 1).toBe(true);
      expect(def.radius).toBeGreaterThan(0);
      for (const m of Object.values(def.resist ?? {})) {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps regulars and bosses in their stat bands', () => {
    expect(ENEMIES.larva).toMatchObject({ hp: 20, speed: 70, reward: 3, leakDamage: 1 });
    expect(ENEMIES.mite.speed).toBe(140);
    expect(ENEMIES.beetle).toMatchObject({ hp: 900, armor: 8 });
    for (const [, def] of regulars) {
      expect(def.hp).toBeLessThanOrEqual(2000);
      expect(def.leakDamage).toBeLessThanOrEqual(5);
    }
    // a leaking boss hurts a lot but never ends an Easy/Normal run on its own...
    for (const [, def] of bosses) {
      expect(def.leakDamage).toBeGreaterThanOrEqual(20);
      expect(def.leakDamage).toBeLessThan(DIFFICULTIES.normal.lives);
    }
    const leaks = BOSS_IDS.map((id) => ENEMIES[id].leakDamage);
    expect(leaks).toEqual([...leaks].sort((a, b) => a - b));
    const hp = BOSS_IDS.map((id) => ENEMIES[id].hp);
    expect(hp).toEqual([...hp].sort((a, b) => a - b));
    // ...except Omega on Hard and Nightmare
    expect(ENEMIES.omega.lethalOn).toEqual(['hard', 'nightmare']);
    for (const [id, def] of all) if (id !== 'omega') expect(def.lethalOn).toBeUndefined();
    // armor low enough that basic towers still matter against bosses
    for (const [, def] of bosses) expect(def.armor).toBeLessThanOrEqual(6);
  });

  it('only references existing, non-boss enemies for splits and summons', () => {
    for (const [, def] of all) {
      if (def.onDeath) {
        expect(ENEMIES).toHaveProperty(def.onDeath.spawn);
        expect(isBoss(def.onDeath.spawn)).toBe(false);
        expect(def.onDeath.count).toBeGreaterThan(0);
      }
      for (const a of flatten(def.ability)) {
        if (a.kind === 'spawn') {
          expect(ENEMIES).toHaveProperty(a.enemyId);
          expect(isBoss(a.enemyId)).toBe(false);
        }
      }
    }
  });

  it('never chains splits back into a splitter', () => {
    for (const [, def] of all) {
      if (def.onDeath) expect(ENEMIES[def.onDeath.spawn as keyof typeof ENEMIES].onDeath).toBeUndefined();
    }
  });

  it('marks splitters and ability users with the matching trait, and vice versa', () => {
    for (const [, def] of all) {
      expect(def.traits.includes('splitter')).toBe(def.onDeath !== undefined);
      const kinds = new Set(flatten(def.ability).map((a) => a.kind));
      for (const [kind, trait] of Object.entries(TRAIT_FOR)) {
        expect(def.traits.includes(trait), `${def.id} ${trait}`).toBe(kinds.has(kind as EnemyAbilityDef['kind']));
      }
      expect(new Set(def.traits).size).toBe(def.traits.length);
    }
  });

  it('covers every trait of the content targets', () => {
    const traits = new Set(all.flatMap(([, d]) => d.traits));
    for (const t of ['armored', 'stealth', 'flying', 'regen', 'slowImmune', 'splitter', 'shielder', 'healer',
      'burrower', 'spawner', 'boss'] as EnemyTrait[]) {
      expect(traits.has(t), t).toBe(true);
    }
  });

  it('orders boss phases from high to low HP, each named, with positive intervals', () => {
    for (const [, def] of all) {
      for (const a of flatten(def.ability)) {
        if (a.kind === 'bossPhases') {
          const f = a.phases.map((p) => p.hpFraction);
          expect(f).toEqual([...f].sort((x, y) => y - x));
          for (const p of a.phases) {
            expect(p.hpFraction).toBeGreaterThan(0);
            expect(p.hpFraction).toBeLessThanOrEqual(1);
            expect(p.name?.trim()).toBeTruthy();
          }
        }
        if ('interval' in a) expect(a.interval).toBeGreaterThan(0);
      }
    }
  });

  it('gives jelly its fire weakness relative to everything else', () => {
    const r = ENEMIES.jelly.resist ?? {};
    expect(r.fire ?? 1).toBe(1);
    for (const t of ['physical', 'explosive', 'ice', 'energy', 'poison'] as const) expect(r[t] ?? 1).toBeLessThan(1);
    expect(ENEMIES.jelly.traits).toContain('slowImmune');
  });
});
