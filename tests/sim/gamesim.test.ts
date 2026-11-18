import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/events';
import { SIM_DT } from '../../src/config';
import { sellValue, scaledCost } from '../../src/sim/Economy';
import { ScriptedWaveSource } from '../../src/sim/WaveSource';
import { PATH_Y, makeSim, runTicks, runUntil, stubDifficulty, stubEnemy, stubTower, waves } from './helpers';

function types(events: readonly SimEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('fixed-step accumulator', () => {
  it('runs whole SIM_DT ticks and carries the remainder', () => {
    const sim = makeSim();
    sim.step(SIM_DT / 2);
    expect(sim.time).toBe(0);
    sim.step(SIM_DT / 2);
    expect(sim.time).toBeCloseTo(SIM_DT);
    sim.step(SIM_DT * 3.5);
    expect(sim.time).toBeCloseTo(SIM_DT * 4);
    sim.step(10);
    expect(sim.time).toBeCloseTo(SIM_DT * 4 + 0.5, 5);
    sim.step(-1);
    expect(sim.time).toBeCloseTo(SIM_DT * 4 + 0.5, 5);
  });
});

describe('economy', () => {
  it('computes sell value and scaled costs', () => {
    expect(sellValue(100, false)).toBe(70);
    expect(sellValue(155, false)).toBe(108);
    expect(sellValue(155, true)).toBe(155);
    expect(scaledCost(100, 1.25)).toBe(125);
  });

  it('refunds 100% in the build phase the tower was placed in, 70% after a wave', () => {
    const sim = makeSim({ waves: waves([{ id: 'grub', count: 1 }]) });
    const a = sim.placeTower('gun', 600, 300)!;
    const b = sim.placeTower('gun', 800, 300)!;
    expect(sim.upgradeTower(a.uid, 0)).toBe(true);
    expect(sim.sellValueOf(a.uid)).toBe(110);
    expect(sim.sellTower(a.uid)).toBe(110);
    expect(sim.money).toBe(900);
    sim.startNextWave();
    expect(sim.sellValueOf(b.uid)).toBe(70);
    const c = sim.placeTower('gun', 1000, 300)!;
    runUntil(sim, () => sim.phase === 'build');
    expect(sim.sellValueOf(c.uid)).toBe(70);
    expect(sim.sellTower(b.uid)).toBe(70);
    expect(sim.sellTower(9999)).toBe(0);
  });

  it('emits moneyChanged on every change and applies the cost multiplier', () => {
    const sim = makeSim({ difficulty: { ...stubDifficulty, costMul: 1.5 } });
    sim.events.drain();
    const t = sim.placeTower('gun', 600, 300)!;
    expect(sim.money).toBe(850);
    expect(sim.upgradeCost(t.uid, 0)).toBe(15);
    sim.upgradeTower(t.uid, 0);
    const money = sim.events.drain().filter((e) => e.type === 'moneyChanged');
    expect(money).toEqual([
      { type: 'moneyChanged', money: 850, delta: -150 },
      { type: 'moneyChanged', money: 835, delta: -15 },
    ]);
    expect(sim.spendMoney(10_000)).toBe(false);
    expect(sim.spendMoney(35)).toBe(true);
    sim.grantMoney(5);
    expect(sim.money).toBe(805);
  });

  it('enforces the upgrade path rule', () => {
    const sim = makeSim();
    const t = sim.placeTower('gun', 600, 300)!;
    for (let i = 0; i < 3; i++) expect(sim.upgradeTower(t.uid, 0)).toBe(true);
    expect(sim.upgradeTower(t.uid, 0)).toBe(false);
    expect(sim.upgradeTower(t.uid, 1)).toBe(true);
    expect(sim.upgradeTower(t.uid, 1)).toBe(true);
    expect(sim.upgradeTower(t.uid, 1)).toBe(false);
    expect(sim.upgradeCost(t.uid, 1)).toBeNull();
    expect(t.tiers).toEqual([3, 2]);
    expect(sim.upgradeTower(424242, 0)).toBe(false);
  });
});

describe('waves', () => {
  it('spawns on schedule, pays kill rewards and the clear bonus', () => {
    const sim = makeSim({
      towers: { gun: stubTower({}, { cooldown: 0.2 }) },
      waves: waves([{ id: 'grub', count: 3, gap: 1 }]),
    });
    sim.placeTower('gun', 400, PATH_Y - 100);
    sim.startNextWave();
    expect(sim.phase).toBe('wave');
    runTicks(sim, 1);
    expect(sim.enemies).toHaveLength(1);
    runTicks(sim, 60);
    expect(sim.enemies.length).toBe(2);
    const seen: SimEvent[] = [];
    runUntil(sim, () => {
      seen.push(...sim.events.drain());
      return sim.phase === 'build';
    });
    const kills = seen.filter((e) => e.type === 'enemyKilled');
    expect(kills).toHaveLength(3);
    expect(seen.find((e) => e.type === 'waveCleared')).toEqual({ type: 'waveCleared', wave: 1, bonus: 101 });
    expect(sim.money).toBe(1000 - 100 + 3 * 5 + 101);
    expect(sim.towers[0]!.kills).toBe(3);
  });

  it('starting a wave early runs both and pays the early bonus', () => {
    const sim = makeSim({ waves: waves([{ id: 'grub', count: 2 }], [{ id: 'grub', count: 2 }], [{ id: 'grub', count: 1 }]) });
    sim.startNextWave();
    runTicks(sim, 10);
    sim.events.drain();
    sim.startNextWave();
    expect(sim.events.drain()).toContainEqual({ type: 'waveStart', wave: 2, early: true, bonus: 20 });
    expect(sim.money).toBe(1020);
    runTicks(sim, 120);
    expect(sim.enemies).toHaveLength(4);
  });

  it('leaks cost lives, emit livesChanged and end the game at 0', () => {
    const sim = makeSim({
      enemies: { grub: stubEnemy({ speed: 2000, leakDamage: 40 }) },
      waves: waves([{ id: 'grub', count: 3, gap: 0.1 }]),
    });
    sim.startNextWave();
    const seen: SimEvent[] = [];
    runUntil(sim, () => {
      seen.push(...sim.events.drain());
      return sim.phase === 'lost';
    }, 10);
    expect(sim.phase).toBe('lost');
    expect(sim.lives).toBe(0);
    expect(seen.filter((e) => e.type === 'livesChanged')).toEqual([
      { type: 'livesChanged', lives: 60, delta: -40 },
      { type: 'livesChanged', lives: 20, delta: -40 },
      { type: 'livesChanged', lives: 0, delta: -20 },
    ]);
    expect(types(seen)).toContain('gameLost');
    expect(seen.find((e) => e.type === 'enemyLeaked')).toMatchObject({ damage: 40, x: 1640 });
    expect(sim.placeTower('gun', 600, 300)).toBeNull();
    const t = sim.time;
    runTicks(sim, 10);
    expect(sim.time).toBe(t);
  });

  it('is won after the last wave and can continue in freeplay', () => {
    const sim = makeSim({
      difficulty: { ...stubDifficulty, waves: 2 },
      enemies: { grub: stubEnemy({ speed: 3000 }) },
      waves: waves([{ id: 'grub', count: 1 }], [{ id: 'grub', count: 1 }], [{ id: 'grub', count: 1 }]),
    });
    for (let w = 0; w < 2; w++) {
      sim.startNextWave();
      runUntil(sim, () => sim.phase !== 'wave');
    }
    expect(sim.phase).toBe('won');
    expect(types(sim.events.drain())).toContain('gameWon');
    sim.startNextWave();
    expect(sim.wave).toBe(2);
    sim.enterFreeplay();
    expect(sim.phase).toBe('build');
    sim.startNextWave();
    expect(sim.wave).toBe(3);
  });

  it('splits enemies on death into the same wave', () => {
    const sim = makeSim({
      towers: { gun: stubTower({}, { damage: 100, cooldown: 0.1 }) },
      enemies: {
        grub: stubEnemy({ onDeath: { spawn: 'bit', count: 3 } }),
        bit: stubEnemy({ id: 'bit', hp: 1, reward: 1 }),
      },
      waves: waves([{ id: 'grub', count: 1 }]),
    });
    sim.placeTower('gun', 400, PATH_Y - 100);
    sim.startNextWave();
    const seen: SimEvent[] = [];
    runUntil(sim, () => {
      seen.push(...sim.events.drain());
      return sim.phase === 'build';
    });
    const spawned = seen.filter((e) => e.type === 'enemySpawn').map((e) => (e.type === 'enemySpawn' ? e.enemyId : ''));
    expect(spawned).toEqual(['grub', 'bit', 'bit', 'bit']);
    expect(seen.filter((e) => e.type === 'enemyKilled')).toHaveLength(4);
  });

  it('applies difficulty multipliers to spawned enemies', () => {
    const sim = makeSim({
      difficulty: { ...stubDifficulty, hpMul: 2, speedMul: 1.5, rewardMul: 2 },
      waves: waves([{ id: 'grub', count: 1 }]),
    });
    sim.startNextWave();
    runTicks(sim, 1);
    const e = sim.enemies[0]!;
    expect(e.maxHp).toBe(100);
    expect(e.baseSpeed).toBe(150);
  });

  it('reveals stealth enemies near a revealing support', () => {
    const radar = stubTower({ id: 'radar', behavior: 'support' }, {
      buff: { range: 0, cooldownMul: 1, revealStealth: true, radius: 300 },
    });
    const sim = makeSim({
      towers: { gun: stubTower(), radar },
      enemies: { ghost: stubEnemy({ id: 'ghost', traits: ['stealth'], hp: 10 }) },
      waves: new ScriptedWaveSource([[{ enemyId: 'ghost', at: 0, pathIndex: 0 }]]),
    });
    const gun = sim.placeTower('gun', 400, PATH_Y - 100)!;
    sim.startNextWave();
    runTicks(sim, 240);
    expect(gun.kills).toBe(0);
    expect(sim.enemies[0]!.revealed).toBe(false);
    sim.placeTower('radar', 700, PATH_Y - 100);
    runUntil(sim, () => sim.phase === 'build', 30);
    expect(sim.lives).toBe(100);
    expect(gun.kills).toBe(1);
  });
});

describe('lookups', () => {
  it('finds towers and alive enemies by uid', () => {
    const sim = makeSim({ waves: waves([{ id: 'grub', count: 1 }]) });
    const t = sim.placeTower('gun', 600, 300)!;
    expect(sim.getTower(t.uid)).toBe(t);
    sim.startNextWave();
    runTicks(sim, 2);
    const e = sim.enemies[0]!;
    expect(sim.getEnemy(e.uid)).toBe(e);
    expect(sim.getEnemy(t.uid)).toBeUndefined();
    sim.sellTower(t.uid);
    expect(sim.getTower(t.uid)).toBeUndefined();
    expect(sim.getTower(424242)).toBeUndefined();
  });
});

describe('tower behaviours', () => {
  it('can remove themselves mid-update without skipping other towers', () => {
    let updates = 0;
    const sim = makeSim({
      towers: { gun: stubTower({ behavior: 'oneshot' }), other: stubTower({ id: 'other', behavior: 'count' }) },
      behaviors: {
        oneshot: { update: (t, ctx) => ctx.removeTower(t) },
        count: { update: () => { updates++; } },
      },
    });
    sim.placeTower('gun', 600, 300);
    sim.placeTower('other', 800, 300);
    runTicks(sim, 2);
    expect(sim.towers.map((t) => t.def.id)).toEqual(['other']);
    expect(updates).toBe(2);
  });

  it('get an onWaveCleared callback', () => {
    const sim = makeSim({
      towers: { bank: stubTower({ id: 'bank', behavior: 'bank' }) },
      behaviors: { bank: { update() {}, onWaveCleared: (_t, ctx, wave) => ctx.addMoney(wave * 7) } },
      waves: waves([{ id: 'grub', count: 0 }]),
    });
    sim.placeTower('bank', 600, 300);
    sim.startNextWave();
    runTicks(sim, 1);
    expect(sim.phase).toBe('build');
    expect(sim.money).toBe(1000 - 100 + 101 + 7);
  });
});
