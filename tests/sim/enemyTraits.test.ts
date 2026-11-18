import { describe, expect, it } from 'vitest';
import { World } from '../../src/sim/World';
import { GameSim } from '../../src/sim/GameSim';
import { ScriptedWaveSource } from '../../src/sim/WaveSource';
import { TOWER_BEHAVIORS } from '../../src/sim/towerBehaviors';
import { FLYING_ALTITUDE, type EnemyState } from '../../src/sim/EnemyState';
import type { HitSpec } from '../../src/sim/SimContext';
import type { SimEvent } from '../../src/sim/events';
import { ENEMIES } from '../../src/data/enemies';
import { SIM_DT } from '../../src/config';
import { TowerState } from '../../src/sim/TowerState';
import { knockBack, stunFromTower } from '../../src/sim/towerBehaviors/common';
import { RESIST_STUN_COOLDOWN } from '../../src/sim/status';
import { DIFFICULTIES } from '../../src/data/difficulty';
import type { DifficultyDef } from '../../src/sim/types';
import { runUntil, stubDifficulty, stubMap, stubTower } from './helpers';

/** A World with the real enemy registry and no towers. */
function world(): World {
  return new World({
    map: stubMap, difficulty: stubDifficulty, seed: 9, towerDefs: {}, enemyDefs: ENEMIES,
    behaviors: TOWER_BEHAVIORS, money: 0, lives: 100,
  });
}

function tick(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    w.tickEnemies(SIM_DT);
    w.compactEnemies();
  }
}

function spawn(w: World, id: string, distance = 400): EnemyState {
  const e = w.spawnEnemy(id, 0, distance, 1);
  if (!e) throw new Error(`unknown enemy ${id}`);
  return e;
}

function ofType<T extends SimEvent['type']>(events: readonly SimEvent[], type: T): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

const gun: HitSpec = { damage: 10, damageType: 'physical', canHitStealth: false, canHitFlying: false };
const seeAll: HitSpec = { ...gun, canHitStealth: true, canHitFlying: true };

describe('enemy traits', () => {
  it('leech regenerates 2% of max HP per second', () => {
    const w = world();
    const e = spawn(w, 'leech');
    e.hp = 70;
    tick(w, 1);
    expect(e.hp).toBeCloseTo(70 + ENEMIES.leech.hp * 0.02);
  });

  it('tick armor shaves physical damage but not poison', () => {
    const w = world();
    const e = spawn(w, 'tick');
    w.damageEnemy(e, 10, 'physical', null);
    expect(e.hp).toBe(90 - 6);
    w.damageEnemy(e, 10, 'poison', null);
    expect(e.hp).toBe(84 - 10);
  });

  it('spore splits into three sporelets behind it in the same wave', () => {
    const w = world();
    const spore = spawn(w, 'spore', 500);
    w.damageEnemy(spore, 9999, 'fire', null);
    const kids = w.enemies.filter((e) => e.alive);
    expect(kids.map((e) => e.def.id)).toEqual(['sporelet', 'sporelet', 'sporelet']);
    for (const k of kids) expect(k.distance).toBeLessThanOrEqual(500);
    expect(w.aliveInWave(1)).toBe(3);
  });

  it('phantom is hidden from towers without detection unless revealed', () => {
    const w = world();
    const e = spawn(w, 'phantom');
    expect(e.stealth).toBe(true);
    expect(w.canHit(e, gun)).toBe(false);
    expect(w.canHit(e, seeAll)).toBe(true);
    e.revealed = true;
    expect(w.canHit(e, { ...gun, canHitFlying: true })).toBe(true);
  });

  it('gnat flies at an altitude, dodges ground-only splash and needs canHitFlying', () => {
    const w = world();
    const gnat = spawn(w, 'gnat', 400);
    const larva = spawn(w, 'larva', 400);
    expect(gnat.flying).toBe(true);
    expect(gnat.altitude).toBe(FLYING_ALTITUDE);
    expect(larva.altitude).toBe(0);
    expect(w.canHit(gnat, gun)).toBe(false);
    expect(w.canHit(gnat, seeAll)).toBe(true);
    tick(w, SIM_DT);
    w.explode(gnat.x, gnat.y, 80, seeAll, null, true, 5);
    expect(gnat.hp).toBe(ENEMIES.gnat.hp);
    expect(larva.hp).toBe(ENEMIES.larva.hp - 5);
  });

  it('gnat still follows the ground path', () => {
    const w = world();
    const gnat = spawn(w, 'gnat', 400);
    tick(w, 1);
    expect(gnat.distance).toBeCloseTo(500);
    expect(Math.abs(gnat.y - 540)).toBeLessThanOrEqual(stubMap.pathWidth / 2);
  });

  it('jelly ignores slows and takes full fire damage but reduced physical damage', () => {
    const w = world();
    const e = spawn(w, 'jelly');
    w.hitEnemy(e, { ...seeAll, damage: 0, slow: { factor: 0.2, duration: 5 } }, null);
    tick(w, SIM_DT);
    expect(e.currentSpeed).toBe(ENEMIES.jelly.speed);
    const before = e.hp;
    w.damageEnemy(e, 100, 'fire', null);
    expect(before - e.hp).toBe(100);
    w.damageEnemy(e, 100, 'physical', null);
    expect(before - 100 - e.hp).toBeCloseTo(60);
  });

  it('shieldbug shields nearby allies (not itself) and exposes maxShield', () => {
    const w = world();
    const bug = spawn(w, 'shieldbug', 400);
    const near = spawn(w, 'larva', 450);
    const far = spawn(w, 'larva', 900);
    tick(w, 3.05);
    expect(near.shield).toBe(60);
    expect(near.maxShield).toBe(60);
    expect(far.shield).toBe(0);
    expect(bug.shield).toBe(0);
    w.damageEnemy(near, 50, 'energy', null);
    expect(near.shield).toBe(10);
    expect(near.hp).toBe(20);
    expect(near.maxShield).toBe(60);
  });

  it('medic heals nearby allies and emits enemyHealed at its position', () => {
    const w = world();
    const medic = spawn(w, 'medic', 400);
    const hurt = spawn(w, 'tick', 430);
    hurt.hp = 10;
    w.events.drain();
    tick(w, 2.05);
    expect(hurt.hp).toBeCloseTo(10 + 90 * 0.08);
    const healed = ofType(w.events.drain(), 'enemyHealed');
    expect(healed).toHaveLength(1);
    expect(healed[0]).toMatchObject({ uid: medic.uid, enemyId: 'medic', radius: 120 });
    expect(Math.abs(healed[0]!.x - medic.x)).toBeLessThan(5);
    expect(healed[0]!.amount).toBeCloseTo(90 * 0.08);
  });

  it('burrower submerges on a cycle: untargetable and untouched by splash while under', () => {
    const w = world();
    const e = spawn(w, 'burrower', 400);
    tick(w, 2.4);
    expect(e.submerged).toBe(false);
    expect(w.canHit(e, seeAll)).toBe(true);
    tick(w, 0.2);
    expect(e.submerged).toBe(true);
    expect(w.canHit(e, seeAll)).toBe(false);
    tick(w, SIM_DT);
    w.explode(e.x, e.y, 100, seeAll, null, false, 500);
    expect(e.hp).toBe(ENEMIES.burrower.hp);
    tick(w, 1.5);
    expect(e.submerged).toBe(false);
    expect(e.currentSpeed).toBe(ENEMIES.burrower.speed);
  });
});

describe('bosses', () => {
  it('queen spawns larvae from 20 px behind her, with enemySpawn events', () => {
    const w = world();
    const queen = spawn(w, 'queen', 600);
    expect(queen.isBoss).toBe(true);
    w.events.drain();
    tick(w, 3.55);
    const larvae = w.enemies.filter((e) => e.def.id === 'larva');
    expect(larvae).toHaveLength(3);
    const lead = Math.max(...larvae.map((l) => l.distance));
    expect(queen.distance - lead).toBeGreaterThan(18);
    expect(queen.distance - lead).toBeLessThan(22);
    expect(ofType(w.events.drain(), 'enemySpawn').map((e) => e.enemyId)).toEqual(['larva', 'larva', 'larva']);
    expect(w.aliveInWave(1)).toBe(4);
  });

  it('iron tick plates up at 75% then sheds its armor and speeds up at 50%', () => {
    const w = world();
    const boss = spawn(w, 'irontick', 0);
    w.events.drain();
    tick(w, SIM_DT);
    expect(boss.armor).toBe(4);
    boss.hp = boss.maxHp * 0.7;
    tick(w, SIM_DT);
    expect(boss.armor).toBe(7);
    expect(boss.currentSpeed).toBeCloseTo(34 * 0.8);
    boss.hp = boss.maxHp * 0.4;
    tick(w, SIM_DT);
    expect(boss.armor).toBe(0);
    expect(boss.currentSpeed).toBeCloseTo(34 * 1.4);
    expect(ofType(w.events.drain(), 'bossPhase').map((e) => [e.phase, e.name]))
      .toEqual([[1, 'Plating Up'], [2, 'Shell Shed']]);
  });

  it('hive mind heals and summons phantoms side by side from the first tick', () => {
    const w = world();
    const boss = spawn(w, 'hivemind', 300);
    const hurt = spawn(w, 'beetle', 330);
    hurt.hp = 100;
    tick(w, SIM_DT);
    expect(ofType(w.events.drain(), 'bossPhase')).toEqual([
      expect.objectContaining({ uid: boss.uid, phase: 1, name: 'Hive Link' }),
    ]);
    tick(w, 4);
    expect(hurt.hp).toBeGreaterThan(100);
    expect(w.enemies.filter((e) => e.def.id === 'phantom')).toHaveLength(0);
    tick(w, 3);
    expect(w.enemies.filter((e) => e.def.id === 'phantom')).toHaveLength(2);
    boss.hp = boss.maxHp * 0.3;
    tick(w, SIM_DT);
    expect(ofType(w.events.drain(), 'bossPhase').map((e) => e.name)).toEqual(['Psychic Frenzy']);
    tick(w, 5);
    expect(w.enemies.filter((e) => e.def.id === 'phantom')).toHaveLength(4);
  });

  it('colossus enrages as it loses HP and bursts into eight beetles', () => {
    const w = world();
    const boss = spawn(w, 'colossus', 500);
    tick(w, SIM_DT);
    expect(boss.currentSpeed).toBeCloseTo(26);
    boss.hp = boss.maxHp * 0.5;
    tick(w, SIM_DT);
    expect(boss.currentSpeed).toBeCloseTo(26 * 1.4);
    boss.hp = boss.maxHp * 0.1;
    tick(w, SIM_DT);
    expect(boss.currentSpeed).toBeCloseTo(26 * 1.72);
    w.damageEnemy(boss, 1e9, 'fire', null);
    expect(w.enemies.filter((e) => e.alive).map((e) => e.def.id)).toEqual(Array(8).fill('beetle'));
  });

  it('omega runs through all four phases with their abilities and splits on death', () => {
    const w = world();
    const boss = spawn(w, 'omega', 800);
    const ids = (): string[] => w.enemies.filter((e) => e.alive && e !== boss).map((e) => e.def.id);
    tick(w, 4.05);
    expect(ids()).toEqual(['larva', 'larva', 'larva', 'larva']);
    boss.hp = boss.maxHp * 0.7;
    tick(w, 5.05);
    expect(boss.armor).toBe(12);
    expect(ids().filter((id) => id === 'tick')).toHaveLength(3);
    boss.hp = boss.maxHp * 0.45;
    tick(w, 5.05);
    expect(boss.armor).toBe(3);
    expect(ids().filter((id) => id === 'phantom')).toHaveLength(3);
    boss.hp = boss.maxHp * 0.2;
    tick(w, 6.05);
    expect(boss.armor).toBe(0);
    expect(boss.currentSpeed).toBeGreaterThan(28 * 1.9);
    expect(ids().filter((id) => id === 'beetle')).toHaveLength(2);
    expect(ofType(w.events.drain(), 'bossPhase').map((e) => e.name))
      .toEqual(['Emergence', 'Iron Hide', 'Hive Chorus', 'Final Frenzy']);
    w.damageEnemy(boss, 1e9, 'fire', null);
    expect(ids().filter((id) => id === 'beetle')).toHaveLength(8);
  });

  it('are found by the default GameSim registry; an Omega leak ends the run only on Hard and Nightmare', () => {
    const leakOmega = (difficulty: DifficultyDef): { sim: GameSim; events: SimEvent[] } => {
      const sim = new GameSim({
        map: { ...stubMap, paths: [[{ x: -100, y: 540 }, { x: 0, y: 540 }]] },
        difficulty, seed: 1, towers: { gun: stubTower() },
        waves: new ScriptedWaveSource([[{ enemyId: 'omega', at: 0, pathIndex: 0 }]]),
      });
      sim.startNextWave();
      const events: SimEvent[] = [];
      runUntil(sim, () => {
        events.push(...sim.events.drain());
        return sim.phase !== 'wave' || sim.lives < difficulty.lives;
      }, 10);
      return { sim, events };
    };
    const hard = leakOmega(DIFFICULTIES.hard);
    expect(hard.sim.phase).toBe('lost');
    expect(hard.events.find((e) => e.type === 'enemyLeaked')).toMatchObject({ damage: DIFFICULTIES.hard.lives });
    expect(hard.events.find((e) => e.type === 'bossSpawn')).toMatchObject({
      name: 'Omega Parasite', maxHp: ENEMIES.omega.hp * DIFFICULTIES.hard.hpMul,
    });
    const normal = leakOmega(DIFFICULTIES.normal);
    expect(normal.sim.phase).not.toBe('lost');
    expect(normal.sim.lives).toBe(DIFFICULTIES.normal.lives - ENEMIES.omega.leakDamage);
    const leak = normal.events.find((e) => e.type === 'enemyLeaked');
    expect(leak).toMatchObject({ enemyId: 'omega', damage: ENEMIES.omega.leakDamage });
    expect(leak && 'x' in leak && leak.x).toBeCloseTo(0);
  });
});

describe('boss control resistance', () => {
  it('weakens slows with a 0.6 speed floor; regular enemies take the full slow', () => {
    const w = world();
    const boss = spawn(w, 'colossus', 300);
    const grunt = spawn(w, 'larva', 300);
    const frost: HitSpec = { ...seeAll, damage: 0, slow: { factor: 0.5, duration: 2 } };
    w.hitEnemy(boss, frost, null);
    w.hitEnemy(grunt, frost, null);
    expect(boss.status.slowFactor).toBeCloseTo(0.8);
    expect(grunt.status.slowFactor).toBeCloseTo(0.5);
    w.hitEnemy(boss, { ...frost, slow: { factor: 0, duration: 2 } }, null);
    expect(boss.status.slowFactor).toBeCloseTo(0.6);
  });

  it('shortens stuns to a quarter and ignores new stuns during the cooldown; no knockback', () => {
    const w = world();
    const boss = spawn(w, 'queen', 300);
    const coil = new TowerState({ uid: 999, def: stubTower({}, { stun: 0.4, knockback: 30 }), x: 0, y: 0, spent: 0, placedBuildWave: -1 });
    stunFromTower(coil, boss);
    expect(boss.status.stunRemaining).toBeCloseTo(0.1);
    tick(w, 0.2);
    stunFromTower(coil, boss);
    expect(boss.status.stunRemaining).toBe(0);
    tick(w, RESIST_STUN_COOLDOWN);
    stunFromTower(coil, boss);
    expect(boss.status.stunRemaining).toBeCloseTo(0.1);
    const before = boss.distance;
    knockBack(w, boss, 30);
    expect(boss.distance).toBe(before);
  });
});

describe('freeplay scaling', () => {
  it('passes the wave HP multiplier on to splits and summons', () => {
    const w = world();
    const spore = w.spawnEnemy('spore', 0, 400, 1, 2)!;
    expect(spore.maxHp).toBeCloseTo(ENEMIES.spore.hp * 2);
    w.damageEnemy(spore, 1e9, 'fire', null);
    const lets = w.enemies.filter((e) => e.alive && e.def.id === 'sporelet');
    expect(lets).toHaveLength(3);
    for (const l of lets) expect(l.maxHp).toBeCloseTo(ENEMIES.sporelet.hp * 2);
    const queen = w.spawnEnemy('queen', 0, 600, 1, 1.5)!;
    tick(w, 3.55);
    const larvae = w.enemies.filter((e) => e.def.id === 'larva');
    expect(larvae).toHaveLength(3);
    for (const l of larvae) expect(l.maxHp).toBeCloseTo(ENEMIES.larva.hp * 1.5);
    expect(queen.waveHpMul).toBe(1.5);
  });
});
