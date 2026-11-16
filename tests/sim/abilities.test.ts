import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../../src/sim/World';
import { TOWER_BEHAVIORS } from '../../src/sim/towerBehaviors';
import { ENEMY_ABILITIES } from '../../src/sim/enemyAbilities';
import type { EnemyDef } from '../../src/sim/types';
import { SIM_DT } from '../../src/config';
import { stubDifficulty, stubEnemy, stubMap } from './helpers';

function world(enemies: Record<string, EnemyDef>): World {
  return new World({
    map: stubMap, difficulty: stubDifficulty, seed: 3, towerDefs: {}, enemyDefs: enemies,
    behaviors: TOWER_BEHAVIORS, money: 0, lives: 10,
  });
}

function tick(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) w.tickEnemies(SIM_DT);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('enemy ability hook', () => {
  it('dispatches each tick to the registry handler of the ability kind', () => {
    const spy = vi.spyOn(ENEMY_ABILITIES, 'enrage');
    const w = world({ angry: stubEnemy({ id: 'angry', ability: { kind: 'enrage', maxSpeedMul: 3 } }) });
    const e = w.spawnEnemy('angry', 0, 0, 1)!;
    tick(w, 0.5);
    expect(spy).toHaveBeenCalledTimes(30);
    expect(spy.mock.calls[0]![0]).toBe(e);
  });
});

describe('abilities', () => {
  it('enrage speeds up as hp drops', () => {
    const w = world({ angry: stubEnemy({ id: 'angry', ability: { kind: 'enrage', maxSpeedMul: 3 } }) });
    const e = w.spawnEnemy('angry', 0, 0, 1)!;
    e.hp = e.maxHp / 2;
    tick(w, SIM_DT);
    expect(e.currentSpeed).toBeCloseTo(200);
  });

  it('burrow alternates between surfaced and submerged', () => {
    const w = world({ mole: stubEnemy({ id: 'mole', speed: 0, ability: { kind: 'burrow', interval: 1, duration: 0.5 } }) });
    const e = w.spawnEnemy('mole', 0, 100, 1)!;
    tick(w, 0.9);
    expect(e.burrowed).toBe(false);
    tick(w, 0.2);
    expect(e.burrowed).toBe(true);
    tick(w, 0.5);
    expect(e.burrowed).toBe(false);
  });

  it('shield and heal auras buff nearby allies only', () => {
    const w = world({
      grub: stubEnemy({ speed: 0 }),
      guard: stubEnemy({ id: 'guard', speed: 0, ability: { kind: 'shieldAura', radius: 100, amount: 30, interval: 1 } }),
      medic: stubEnemy({ id: 'medic', speed: 0, ability: { kind: 'healAura', radius: 100, fraction: 0.2, interval: 1 } }),
    });
    const near = w.spawnEnemy('grub', 0, 550, 1)!;
    const far = w.spawnEnemy('grub', 0, 900, 1)!;
    const guard = w.spawnEnemy('guard', 0, 500, 1)!;
    w.spawnEnemy('medic', 0, 520, 1);
    near.hp = 10;
    far.hp = 10;
    tick(w, 1);
    expect(near.shield).toBe(30);
    expect(guard.shield).toBe(0);
    expect(far.shield).toBe(0);
    expect(near.hp).toBe(20);
    expect(far.hp).toBe(10);
  });

  it('spawn summons enemies behind the summoner in its wave', () => {
    const w = world({
      grub: stubEnemy(),
      queen: stubEnemy({ id: 'queen', speed: 0, ability: { kind: 'spawn', enemyId: 'grub', count: 2, interval: 1 } }),
    });
    w.spawnEnemy('queen', 0, 400, 5);
    tick(w, 1);
    expect(w.enemies.map((e) => e.def.id)).toEqual(['queen', 'grub', 'grub']);
    expect(w.aliveInWave(5)).toBe(3);
  });

  it('boss phases trigger once per threshold, shedding armor and changing speed', () => {
    const w = world({
      boss: stubEnemy({
        id: 'boss', armor: 10, traits: ['boss'], hp: 1000,
        ability: { kind: 'bossPhases', phases: [
          { hpFraction: 0.5, armor: 0, speedMul: 2 },
          { hpFraction: 0.25, ability: { kind: 'enrage', maxSpeedMul: 4 } },
        ] },
      }),
    });
    const boss = w.spawnEnemy('boss', 0, 0, 1)!;
    expect(w.events.drain().map((e) => e.type)).toEqual(['enemySpawn', 'bossSpawn']);
    tick(w, 0.1);
    expect(boss.armor).toBe(10);
    boss.hp = 400;
    tick(w, 0.1);
    tick(w, 0.1);
    expect(boss.armor).toBe(0);
    expect(boss.currentSpeed).toBeCloseTo(200);
    boss.hp = 100;
    tick(w, SIM_DT);
    expect(boss.currentSpeed).toBeCloseTo(100 * (1 + 3 * 0.9));
    expect(w.events.drain().filter((e) => e.type === 'bossPhase').map((e) => (e.type === 'bossPhase' ? e.phase : 0)))
      .toEqual([1, 2]);
  });

  it('regen heals over time and dots tick through the pipeline', () => {
    const w = world({ leech: stubEnemy({ id: 'leech', speed: 0, hp: 100, traits: ['regen'] }) });
    const e = w.spawnEnemy('leech', 0, 100, 1)!;
    e.hp = 50;
    tick(w, 1);
    expect(e.hp).toBeCloseTo(52);
    w.hitEnemy(e, { damage: 0, damageType: 'poison', canHitFlying: true, canHitStealth: true, dot: { dps: 10, duration: 1, type: 'poison' } }, null);
    tick(w, 1);
    expect(e.hp).toBeCloseTo(44);
  });

  it('slowImmune enemies ignore slows', () => {
    const w = world({ jelly: stubEnemy({ id: 'jelly', traits: ['slowImmune'] }) });
    const e = w.spawnEnemy('jelly', 0, 100, 1)!;
    w.hitEnemy(e, { damage: 1, damageType: 'ice', canHitFlying: true, canHitStealth: true, slow: { factor: 0.1, duration: 5 } }, null);
    tick(w, SIM_DT);
    expect(e.currentSpeed).toBe(100);
  });
});
