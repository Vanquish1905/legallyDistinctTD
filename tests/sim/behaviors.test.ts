import { describe, expect, it } from 'vitest';
import { ScriptedWaveSource } from '../../src/sim/WaveSource';
import { computeStats } from '../../src/sim/TowerState';
import { PATH_Y, makeSim, runTicks, runUntil, stubEnemy, stubTower, waves } from './helpers';

const one = (id: string, n = 1, gap = 0.3) => new ScriptedWaveSource([
  Array.from({ length: n }, (_, i) => ({ enemyId: id, at: i * gap, pathIndex: 0 })),
]);

describe('nested stat mods', () => {
  it('adds and multiplies fields of sub-objects', () => {
    const def = stubTower({
      paths: [
        { name: 'A', tiers: [
          { name: '', description: '', cost: 1, icon: '', mods: { add: { 'slow.duration': 1 } } },
          { name: '', description: '', cost: 1, icon: '', mods: { mul: { 'slow.factor': 0.5 } } },
          { name: '', description: '', cost: 1, icon: '', mods: { add: { 'dot.dps': 5 } } },
        ] },
        stubTower().paths[1],
      ],
    }, { slow: { factor: 0.8, duration: 1 } });
    const s = computeStats(def, [3, 0]).stats;
    expect(s.slow).toEqual({ factor: 0.4, duration: 2 });
    expect(s.dot).toBeUndefined();
    expect(def.stats.slow).toEqual({ factor: 0.8, duration: 1 });
  });
});

describe('support behaviour', () => {
  it('buffs range and fire rate of nearby towers, strongest wins', () => {
    const radar = stubTower({ id: 'radar', behavior: 'support' }, {
      damage: 0, buff: { range: 0.2, cooldownMul: 0.8, revealStealth: false, radius: 250 },
    });
    const sim = makeSim({ towers: { gun: stubTower(), radar } });
    const near = sim.placeTower('gun', 600, 300)!;
    const far = sim.placeTower('gun', 1200, 300)!;
    sim.placeTower('radar', 700, 300);
    runTicks(sim, 1);
    expect(near.range).toBeCloseTo(240);
    expect(near.cooldown).toBeCloseTo(0.4);
    expect(far.range).toBe(200);
  });
});

describe('income behaviour', () => {
  it('pays income plus capped interest at wave clear with an income event', () => {
    const bank = stubTower({ id: 'bank', behavior: 'income' }, { damage: 0, income: 50, interest: { rate: 0.1, cap: 40 } });
    const sim = makeSim({ towers: { bank }, waves: waves([{ id: 'grub', count: 0 }]) });
    const t = sim.placeTower('bank', 600, 300)!;
    sim.events.drain();
    sim.startNextWave();
    runTicks(sim, 1);
    // 900 + clear bonus 101 = 1001; interest min(40, 100) = 40
    expect(sim.money).toBe(1001 + 50 + 40);
    const ev = sim.events.drain().find((e) => e.type === 'income');
    expect(ev).toMatchObject({ type: 'income', uid: t.uid, amount: 90 });
  });
});

describe('aura behaviour', () => {
  it('hits everything in range, knocks back and stuns', () => {
    const pulse = stubTower({ id: 'pulse', behavior: 'aura' }, { range: 150, cooldown: 1, damage: 5, knockback: 40, stun: 0.5 });
    const sim = makeSim({ towers: { pulse }, enemies: { grub: stubEnemy({ hp: 1000 }) }, waves: one('grub', 3, 0.1) });
    sim.startNextWave();
    runTicks(sim, 240);
    const before = sim.enemies.map((e) => e.distance);
    sim.placeTower('pulse', sim.enemies[1]!.x, PATH_Y - 80);
    runTicks(sim, 1);
    sim.enemies.forEach((e, i) => {
      expect(e.hp).toBe(995);
      expect(e.distance).toBeLessThan(before[i]! - 35);
      expect(e.status.stunRemaining).toBeGreaterThan(0);
    });
  });
});

describe('chain behaviour', () => {
  it('jumps between enemies with falloff and emits chainLightning', () => {
    const tesla = stubTower({ id: 'tesla', behavior: 'chain' }, {
      range: 400, cooldown: 10, damage: 100, damageType: 'energy', chain: { jumps: 2, range: 200, falloff: 0.5 },
    });
    const sim = makeSim({ towers: { tesla }, enemies: { grub: stubEnemy({ hp: 1000, speed: 1 }) }, waves: one('grub', 4, 0.5) });
    sim.startNextWave();
    runTicks(sim, 120);
    sim.placeTower('tesla', 100, PATH_Y - 100);
    sim.events.drain();
    runTicks(sim, 1);
    const damage = sim.enemies.map((e) => 1000 - e.hp).sort((a, b) => b - a);
    expect(damage).toEqual([100, 50, 25, 0]);
    const zap = sim.events.drain().find((e) => e.type === 'chainLightning');
    expect(zap && zap.type === 'chainLightning' && zap.points.length).toBe(4);
  });
});

describe('trap behaviour', () => {
  it('uses charges, ignores flyers and expires when empty', () => {
    const trap = stubTower({ id: 'trap', behavior: 'trap', placement: 'path', footprint: 20 }, {
      range: 30, cooldown: 0.2, damage: 5, charges: 3, canHitFlying: false, canHitStealth: true,
    });
    const sim = makeSim({
      towers: { trap },
      enemies: { grub: stubEnemy({ hp: 1000 }), fly: stubEnemy({ id: 'fly', hp: 1000, traits: ['flying'] }) },
      waves: new ScriptedWaveSource([[{ enemyId: 'fly', at: 0, pathIndex: 0 }, { enemyId: 'grub', at: 3, pathIndex: 0 }]]),
    });
    const t = sim.placeTower('trap', 300, PATH_Y)!;
    expect(t.memory.charges).toBe(3);
    sim.startNextWave();
    runUntil(sim, () => !sim.towers.includes(t), 20);
    const fly = sim.enemies.find((e) => e.def.id === 'fly');
    if (fly) expect(fly.hp).toBe(1000);
    expect(sim.towers.includes(t)).toBe(false);
    expect(sim.events.drain().some((e) => e.type === 'towerExpired' && e.uid === t.uid)).toBe(true);
  });

  it('with refill sleeps when empty and refills at wave clear', () => {
    const trap = stubTower({ id: 'trap', behavior: 'trap', placement: 'path', footprint: 20 }, {
      range: 30, cooldown: 0.2, damage: 5, charges: 2, canHitFlying: false,
    });
    trap.paths[1].tiers[0] = { ...trap.paths[1].tiers[0], mods: { flags: ['refill'] } };
    const sim = makeSim({ towers: { trap }, enemies: { grub: stubEnemy({ hp: 1000 }) }, waves: one('grub') });
    const t = sim.placeTower('trap', 1400, PATH_Y)!;
    sim.upgradeTower(t.uid, 1);
    sim.startNextWave();
    runUntil(sim, () => sim.phase === 'build', 60);
    expect(sim.towers.includes(t)).toBe(true);
    expect(t.memory.charges).toBe(2);
  });
});

describe('beam behaviour', () => {
  it('ramps damage while locked on one target', () => {
    const laser = stubTower({ id: 'laser', behavior: 'beam' }, {
      range: 2000, cooldown: 0.1, damage: 1, damageType: 'energy', ramp: { max: 3, time: 1 },
    });
    const sim = makeSim({ towers: { laser }, enemies: { grub: stubEnemy({ hp: 1e6, speed: 10 }) }, waves: one('grub') });
    sim.placeTower('laser', 600, PATH_Y - 100);
    sim.startNextWave();
    runTicks(sim, 60);
    const e = sim.enemies[0]!;
    const after1 = 1e6 - e.hp;
    runTicks(sim, 60);
    const second = 1e6 - e.hp - after1;
    expect(after1).toBeGreaterThan(10);
    expect(second).toBeCloseTo(30, 0);
    expect(sim.events.drain().some((ev) => ev.type === 'beam')).toBe(true);
  });
});

describe('boomerang projectiles', () => {
  it('fly out and come back', () => {
    const saw = stubTower({ id: 'saw', behavior: 'boomerang', projectile: { kind: 'saw', motion: 'boomerang' } }, {
      range: 200, cooldown: 100, projectileSpeed: 400, pierce: 10,
    });
    const sim = makeSim({ towers: { saw }, enemies: { grub: stubEnemy({ hp: 1e6, speed: 10 }) }, waves: one('grub') });
    sim.startNextWave();
    runTicks(sim, 1200);
    expect(sim.placeTower('saw', 200, PATH_Y - 100)).not.toBeNull();
    runTicks(sim, 2);
    const p = sim.projectiles[0]!;
    expect(p.motion).toBe('boomerang');
    runTicks(sim, 40);
    expect(p.returning).toBe(true);
    runTicks(sim, 60);
    expect(sim.projectiles.length).toBe(0);
  });
});
