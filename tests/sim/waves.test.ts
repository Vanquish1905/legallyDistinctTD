import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/events';
import { WaveManager } from '../../src/sim/WaveManager';
import { WAVES } from '../../src/data/waves';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../src/data/difficulty';
import { BOSS_IDS, ENEMIES, ENEMY_IDS, isBoss } from '../../src/data/enemies';
import { makeSim, runTicks, runUntil, stubEnemy } from './helpers';

const normal = DIFFICULTIES.normal;
const wm = (seed = 7, d = normal) => new WaveManager({ difficulty: d, seed });

describe('difficulty data', () => {
  it('has the four difficulties with their win waves', () => {
    expect(DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].waves)).toEqual([30, 40, 50, 60]);
    expect(DIFFICULTIES.nightmare.lives).toBe(1);
    for (const id of DIFFICULTY_ORDER) expect(DIFFICULTIES[id].id).toBe(id);
  });
});

describe('authored waves', () => {
  it('has 60 waves referencing only real enemies, with valid timing', () => {
    expect(WAVES).toHaveLength(60);
    for (const wave of WAVES) {
      expect(wave.groups.length).toBeGreaterThan(0);
      for (const g of wave.groups) {
        expect(ENEMIES[g.enemy as keyof typeof ENEMIES], g.enemy).toBeDefined();
        expect(g.count).toBeGreaterThan(0);
        expect(g.interval).toBeGreaterThan(0);
        expect(g.delay).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('puts exactly one boss on waves 10..60 and none elsewhere', () => {
    const expected: Record<number, string> = { 10: 'queen', 20: 'irontick', 30: 'hivemind', 40: 'colossus', 50: 'omega', 60: 'omega' };
    WAVES.forEach((wave, i) => {
      const bosses = wave.groups.filter((g) => isBoss(g.enemy));
      const want = expected[i + 1];
      expect(bosses.map((b) => b.enemy), `wave ${i + 1}`).toEqual(want ? [want] : []);
      if (want) expect(bosses[0]!.count).toBe(1);
      expect(wave.tag === 'boss').toBe(Boolean(want));
    });
  });

  it('introduces every regular enemy except split-only sporelets, and every boss', () => {
    const used = new Set(WAVES.flatMap((w) => w.groups.map((g) => g.enemy)));
    for (const id of ENEMY_IDS) if (id !== 'sporelet') expect(used.has(id), id).toBe(true);
    for (const id of BOSS_IDS) expect(used.has(id), id).toBe(true);
  });

  it('grows in total HP on average (smooth curve)', () => {
    const m = wm();
    const hp = (a: number, b: number) => {
      let s = 0;
      for (let w = a; w <= b; w++) s += m.preview(w).totalHpEstimate;
      return s;
    };
    for (let d = 1; d < 60; d += 10) expect(hp(d + 10, d + 18)).toBeGreaterThan(hp(d, d + 8));
  });
});

describe('WaveManager', () => {
  it('schedules groups by delay + i * interval, sorted, round-robin over paths', () => {
    const s = wm().spawnsFor(3, 2);
    expect(s.filter((e) => e.enemyId === 'larva').map((e) => e.at)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(s.filter((e) => e.enemyId === 'mite').map((e) => e.at)).toEqual([6, 7.5, 9, 10.5]);
    for (let i = 1; i < s.length; i++) expect(s[i]!.at).toBeGreaterThanOrEqual(s[i - 1]!.at);
    expect(s.filter((e) => e.enemyId === 'larva').map((e) => e.pathIndex).slice(0, 4)).toEqual([0, 1, 0, 1]);
    expect(s.filter((e) => e.enemyId === 'mite')[0]!.pathIndex).toBe(1);
    expect(s.every((e) => e.hpMul === undefined)).toBe(true);
    const pinned = wm().spawnsFor(33, 3).filter((e) => e.enemyId === 'mite');
    expect(pinned.every((e) => e.pathIndex === 1)).toBe(true);
  });

  it('previews grouped counts, boss, new enemies and HP', () => {
    const p = wm().preview(10);
    expect(p.groups).toEqual([{ enemy: 'larva', count: 20 }, { enemy: 'queen', count: 1 }, { enemy: 'mite', count: 8 }]);
    expect(p.boss).toBe('queen');
    expect(p.newEnemies).toEqual([]);
    expect(p.totalHpEstimate).toBe(20 * ENEMIES.larva.hp + ENEMIES.queen.hp + 8 * ENEMIES.mite.hp);
    expect(wm().preview(3).newEnemies).toEqual(['mite']);
    expect(wm().preview(1).newEnemies).toEqual(['larva']);
    expect(wm().preview(3).boss).toBeUndefined();
    expect(wm(7, DIFFICULTIES.hard).preview(1).totalHpEstimate).toBe(Math.round(10 * ENEMIES.larva.hp * 1.25));
  });

  it('pays 100 + 10*wave on clear and an early bonus from remaining spawn time, both with rewardMul', () => {
    expect(wm().clearBonus(5)).toBe(150);
    expect(wm(7, DIFFICULTIES.easy).clearBonus(10)).toBe(Math.round(200 * 1.15));
    expect(wm().earlyStartBonus(4, 10)).toBe(70);
    expect(wm().earlyStartBonus(4)).toBe(20);
  });

  it('caps the early bonus and shrinks it with every wave already overlapping', () => {
    expect(wm().earlyStartBonus(4, 60)).toBe(80);
    expect(wm().earlyStartBonus(4, 60, 2)).toBe(20);
    expect(wm().earlyStartBonus(4, 60, 3)).toBe(Math.round(80 / 9));
    // calling 40 waves back to back at t = 0 pays less than two normal clears
    let spam = 0;
    for (let w = 2; w <= 40; w++) spam += wm().earlyStartBonus(w, 60, w - 1);
    expect(spam).toBeLessThan(wm().clearBonus(1) + wm().clearBonus(2));
  });

  it('generates deterministic endless waves with growing budget and HP', () => {
    const a = wm(99);
    const b = wm(99);
    b.spawnsFor(80, 1);
    expect(a.spawnsFor(75, 2)).toEqual(b.spawnsFor(75, 2));
    expect(wm(100).groupsFor(75)).not.toEqual(a.groupsFor(75));
    for (let w = 61; w < 100; w++) expect(a.endlessBudget(w + 1)).toBeGreaterThan(a.endlessBudget(w));
    expect(a.spawnsFor(61, 1)[0]!.hpMul).toBeCloseTo(1.08);
    expect(a.spawnsFor(70, 1)[0]!.hpMul).toBeCloseTo(1.08 ** 10);
    expect(a.bossOf(70)).toBe('omega');
    expect(a.bossOf(71)).toBeUndefined();
    for (const w of [61, 77, 150]) {
      for (const g of a.groupsFor(w)) expect(ENEMIES[g.enemy as keyof typeof ENEMIES]).toBeDefined();
    }
  });
});

/** Stub registry: every real id walks off instantly and costs no lives. */
const fastStubs = Object.fromEntries(
  Object.keys(ENEMIES).map((id) => [id, stubEnemy({ id, speed: 20000, leakDamage: 0, traits: isBoss(id) ? ['boss'] : [] })]),
);

describe('GameSim with the WaveManager', () => {
  it('is the default source: emits waveStart with boss, bossSpawn, waveCleared, and gameWon at difficulty.waves', () => {
    const sim = makeSim({ difficulty: { ...DIFFICULTIES.easy, waves: 10 }, enemies: fastStubs });
    const seen: SimEvent[] = [];
    for (let w = 1; w <= 10; w++) {
      sim.startNextWave();
      runUntil(sim, () => {
        seen.push(...sim.events.drain());
        return sim.phase !== 'wave';
      }, 200);
    }
    expect(sim.phase).toBe('won');
    expect(seen.find((e) => e.type === 'waveStart' && e.wave === 10)).toMatchObject({ boss: 'queen' });
    expect(seen.find((e) => e.type === 'waveStart' && e.wave === 9)).not.toHaveProperty('boss');
    expect(seen.filter((e) => e.type === 'bossSpawn')).toHaveLength(1);
    expect(seen.find((e) => e.type === 'waveCleared' && e.wave === 3)).toMatchObject({ bonus: Math.round(130 * 1.15) });
    expect(seen.filter((e) => e.type === 'gameWon')).toHaveLength(1);
    expect(sim.previewWave()?.boss).toBeUndefined();
    sim.enterFreeplay();
    sim.startNextWave();
    expect(sim.wave).toBe(11);
  });

  it('pays the early bonus only while a wave is running', () => {
    const sim = makeSim({ difficulty: normal, enemies: fastStubs });
    sim.startNextWave();
    expect(sim.money).toBe(normal.startMoney);
    runTicks(sim, 60);
    // wave 1: 10 larvae 1.2 s apart -> last at 10.8 s, 1 s elapsed
    const expected = Math.round(5 * (10.8 - 1) + 10 * Math.sqrt(2));
    expect(sim.nextWaveBonus()).toBe(expected);
    sim.startNextWave();
    expect(sim.money).toBe(normal.startMoney + expected);
  });

  it('pays no early bonus when the next wave cannot start (last wave running)', () => {
    const sim = makeSim({ difficulty: { ...normal, waves: 2 }, enemies: fastStubs });
    sim.startNextWave();
    runTicks(sim, 30);
    expect(sim.nextWaveBonus()).toBeGreaterThan(0);
    sim.startNextWave();
    expect(sim.wave).toBe(2);
    expect(sim.phase).toBe('wave');
    expect(sim.canStartNextWave()).toBe(false);
    expect(sim.nextWaveBonus()).toBe(0);
    const money = sim.money;
    sim.startNextWave();
    expect(sim.money).toBe(money);
    expect(sim.wave).toBe(2);
  });

  it('auto-starts the next wave 3 s after a clear', () => {
    const sim = makeSim({ difficulty: normal, enemies: fastStubs });
    sim.autoStart = true;
    runTicks(sim, 400);
    expect(sim.wave).toBe(0);
    sim.startNextWave();
    runUntil(sim, () => sim.phase === 'build', 60);
    runTicks(sim, 170);
    expect(sim.wave).toBe(1);
    runTicks(sim, 15);
    expect(sim.wave).toBe(2);
  });
});
