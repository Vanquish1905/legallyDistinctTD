import { describe, expect, it } from 'vitest';
import { GameSim } from '../../src/sim/GameSim';
import { isSimSnapshot } from '../../src/sim/snapshot';
import { PATH_Y, makeSim, runTicks, runUntil, stubDifficulty, stubEnemy, stubMap, stubTower, waves } from './helpers';

const towers = { gun: stubTower(), sniper: stubTower({ id: 'sniper' }, { projectileSpeed: 0, range: 500, damage: 30, cooldown: 1 }) };
const enemies = { grub: stubEnemy(), tank: stubEnemy({ id: 'tank', hp: 400, armor: 4, speed: 70, reward: 20 }) };
const source = () => waves(
  [{ id: 'grub', count: 8, gap: 0.3 }],
  [{ id: 'grub', count: 10, gap: 0.2 }, { id: 'tank', count: 3, gap: 1.1 }],
  [{ id: 'tank', count: 6, gap: 0.6 }],
);

/** Everything observable about a sim, for equality checks. */
function digest(sim: GameSim): string {
  return JSON.stringify({
    money: sim.money, lives: sim.lives, wave: sim.wave, phase: sim.phase, time: sim.time.toFixed(9),
    enemies: sim.enemies.map((e) => [e.uid, e.def.id, e.x, e.y, e.hp, e.shield]),
    towers: sim.towers.map((t) => [t.uid, t.tiers, t.kills, t.damageDealt, t.cooldownLeft, t.angle]),
    projectiles: sim.projectiles.map((p) => [p.uid, p.x, p.y, p.pierce]),
  });
}

/** A scripted session: same commands at the same ticks. */
function play(seed: number): { sim: GameSim; trace: string[] } {
  const sim = new GameSim({ map: stubMap, difficulty: stubDifficulty, seed, towers, enemies, waves: source() });
  const trace: string[] = [];
  const a = sim.placeTower('gun', 400, PATH_Y - 100)!;
  sim.placeTower('sniper', 900, PATH_Y + 120);
  sim.startNextWave();
  for (let i = 0; i < 600; i++) {
    if (i === 100) sim.upgradeTower(a.uid, 0);
    if (i === 200) sim.setTargetMode(a.uid, 'strong');
    if (i === 300) sim.startNextWave();
    runTicks(sim, 1);
    if (i % 50 === 0) trace.push(digest(sim));
  }
  runUntil(sim, () => sim.phase !== 'wave');
  trace.push(digest(sim));
  return { sim, trace };
}

describe('determinism', () => {
  it('gives identical state for the same seed and commands', () => {
    const a = play(1234);
    const b = play(1234);
    expect(b.trace).toEqual(a.trace);
    expect(a.sim.phase).toBe('build');
  });

  it('differs for another seed', () => {
    expect(play(1).trace).not.toEqual(play(2).trace);
  });
});

describe('snapshot', () => {
  it('round-trips through JSON and resumes identically', () => {
    const { sim } = play(77);
    const t = sim.towers[0]!;
    sim.upgradeTower(t.uid, 0);
    sim.upgradeTower(t.uid, 0);
    const snap = sim.snapshot();
    const json = JSON.parse(JSON.stringify(snap)) as unknown;
    expect(isSimSnapshot(json)).toBe(true);
    if (!isSimSnapshot(json)) return;
    const restored = new GameSim({
      map: stubMap, difficulty: stubDifficulty, seed: 77, towers, enemies, waves: source(), save: json,
    });
    expect(restored.snapshot()).toEqual(snap);
    expect(restored.towers[0]!.stats).toEqual(t.stats);
    expect(restored.sellValueOf(t.uid)).toBe(sim.sellValueOf(t.uid));
    sim.startNextWave();
    restored.startNextWave();
    runUntil(sim, () => sim.phase !== 'wave');
    runUntil(restored, () => restored.phase !== 'wave');
    expect(digest(restored)).toEqual(digest(sim));
  });

  it('is refused during a wave and for another map or version', () => {
    const sim = makeSim({ waves: waves([{ id: 'grub', count: 1 }]) });
    const snap = sim.snapshot();
    sim.startNextWave();
    expect(() => sim.snapshot()).toThrow();
    expect(() => makeSim({ map: { ...stubMap, id: 'other' }, save: snap })).toThrow();
    expect(() => makeSim({ save: { ...snap, version: 0 } })).toThrow();
  });

  it('rejects corrupted data', () => {
    const good = makeSim().snapshot();
    expect(isSimSnapshot(good)).toBe(true);
    expect(isSimSnapshot(null)).toBe(false);
    expect(isSimSnapshot('save')).toBe(false);
    expect(isSimSnapshot({ ...good, money: 'lots' })).toBe(false);
    expect(isSimSnapshot({ ...good, towers: [{ uid: 1 }] })).toBe(false);
    expect(isSimSnapshot({ ...good, money: Number.NaN })).toBe(false);
  });

  it('skips towers whose definition no longer exists', () => {
    const sim = makeSim();
    sim.placeTower('gun', 600, 300);
    const snap = sim.snapshot();
    const restored = makeSim({ towers: {}, save: snap });
    expect(restored.towers).toHaveLength(0);
    expect(restored.money).toBe(900);
  });
});
