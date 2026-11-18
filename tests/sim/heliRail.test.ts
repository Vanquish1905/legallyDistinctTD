import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/events';
import type { TowerDef } from '../../src/sim/types';
import { GameSim } from '../../src/sim/GameSim';
import { World } from '../../src/sim/World';
import { TowerState } from '../../src/sim/TowerState';
import { ScriptedWaveSource } from '../../src/sim/WaveSource';
import { TOWER_BEHAVIORS } from '../../src/sim/towerBehaviors';
import { fireRail } from '../../src/sim/towerBehaviors/line';
import { isSimSnapshot } from '../../src/sim/snapshot';
import { TOWERS } from '../../src/data/towers';
import { FIELD_W, SIM_DT } from '../../src/config';
import { PATH_Y, makeSim, runTicks, stubDifficulty, stubEnemy, stubMap, stubTower } from './helpers';

const enemies = {
  grub: stubEnemy({ hp: 5000, speed: 20 }),
  gnat: stubEnemy({ id: 'gnat', hp: 5000, speed: 20, traits: ['flying'] }),
  ghost: stubEnemy({ id: 'ghost', hp: 5000, speed: 20, traits: ['stealth'] }),
};
const towers: Record<string, TowerDef> = { heli: TOWERS.heli, railgun: TOWERS.railgun, gun: stubTower() };

function one(enemyId: string, count = 1, gap = 1): ScriptedWaveSource {
  return new ScriptedWaveSource([Array.from({ length: count }, (_, i) => ({ enemyId, at: i * gap, pathIndex: 0 }))]);
}

function collect(sim: GameSim, seconds: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    sim.step(SIM_DT);
    out.push(...sim.events.drain());
  }
  return out;
}

/** A stub sim with enough money for the expensive towers. */
function rich(waves: ScriptedWaveSource): GameSim {
  const sim = makeSim({ towers, enemies, waves });
  sim.grantMoney(100000);
  return sim;
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('heli behaviour', () => {
  it('starts on its pad and circles it while idle', () => {
    const sim = rich(one('grub', 0));
    const t = sim.placeTower('heli', 600, 300)!;
    expect(t.unit).toEqual({ x: 600, y: 300, angle: -Math.PI / 2 });
    runTicks(sim, 300);
    expect(near(t.unit!, t)).toBeLessThan(70);
  });

  it('flies to a target within its leash, circles it and fires from the helicopter (also at flyers)', () => {
    const sim = rich(one('gnat'));
    const t = sim.placeTower('heli', 400, 300)!;
    sim.startNextWave();
    const events = collect(sim, 14);
    const gnat = sim.enemies[0]!;
    expect(gnat.hp).toBeLessThan(gnat.maxHp);
    expect(near(t.unit!, gnat)).toBeLessThan(160);
    const shots = events.filter((e): e is Extract<SimEvent, { type: 'projectileSpawn' }> => e.type === 'projectileSpawn');
    expect(shots.length).toBeGreaterThan(5);
    // shots leave from the helicopter, not from the pad
    expect(shots.some((s) => near(s, t) > 60)).toBe(true);
  });

  it('ignores enemies outside the leash and stays home', () => {
    const sim = rich(one('grub'));
    const t = sim.placeTower('heli', 1300, 120)!; // 420 px from the path: beyond leash and gun range
    sim.startNextWave();
    const events = collect(sim, 20);
    expect(events.some((e) => e.type === 'projectileSpawn')).toBe(false);
    expect(near(t.unit!, t)).toBeLessThan(70);
  });

  it('patrols a player-set point, validated, and returns home when cleared', () => {
    const sim = rich(one('grub', 0));
    const t = sim.placeTower('heli', 600, 300)!;
    const gun = sim.placeTower('gun', 900, 300)!;
    expect(sim.setHeliTarget(gun.uid, { x: 700, y: 700 })).toBe(false);
    expect(sim.setHeliTarget(t.uid, { x: FIELD_W + 10, y: 500 })).toBe(false);
    expect(sim.setHeliTarget(t.uid, { x: 500, y: 20 })).toBe(false);
    expect(sim.setHeliTarget(424242, { x: 500, y: 500 })).toBe(false);
    expect(sim.setHeliTarget(t.uid, { x: 1100, y: 800 })).toBe(true);
    expect(t.patrol).toEqual({ x: 1100, y: 800 });
    runTicks(sim, 6 * 60);
    expect(near(t.unit!, { x: 1100, y: 800 })).toBeLessThan(70);
    expect(sim.setHeliTarget(t.uid, null)).toBe(true);
    expect(t.patrol).toBeNull();
    runTicks(sim, 6 * 60);
    expect(near(t.unit!, t)).toBeLessThan(70);
  });

  it('keeps the helicopter and patrol point through a snapshot round-trip', () => {
    const sim = rich(one('grub', 0));
    const t = sim.placeTower('heli', 600, 300)!;
    sim.setHeliTarget(t.uid, { x: 1000, y: 800 });
    runTicks(sim, 90);
    const json = JSON.parse(JSON.stringify(sim.snapshot())) as unknown;
    expect(isSimSnapshot(json)).toBe(true);
    if (!isSimSnapshot(json)) return;
    const back = new GameSim({ map: stubMap, difficulty: stubDifficulty, seed: 42, towers, enemies, save: json });
    const r = back.getTower(t.uid)!;
    expect(r.unit).toEqual(t.unit);
    expect(r.patrol).toEqual({ x: 1000, y: 800 });
    runTicks(sim, 60);
    runTicks(back, 60);
    expect(r.unit).toEqual(t.unit);
    expect(isSimSnapshot({ ...json, towers: [{ ...json.towers[0], unit: { x: 1, y: 'a' } }] })).toBe(false);
  });

  it('Gunship fires at two different targets per volley', () => {
    const sim = rich(one('grub', 4, 0.4));
    const t = sim.placeTower('heli', 200, 420)!;
    for (let i = 0; i < 3; i++) sim.upgradeTower(t.uid, 0);
    expect(t.stats.shots).toBe(2);
    sim.startNextWave();
    const events = collect(sim, 12);
    const fired = events.filter((e): e is Extract<SimEvent, { type: 'towerFired' }> => e.type === 'towerFired');
    const targets = new Set(fired.map((e) => e.targetUid));
    expect(targets.size).toBeGreaterThan(1);
  });
});

describe('line behaviour (railgun)', () => {
  function world(): World {
    return new World({
      map: stubMap, difficulty: stubDifficulty, seed: 3, towerDefs: towers, enemyDefs: enemies,
      behaviors: TOWER_BEHAVIORS, money: 0, lives: 100,
    });
  }
  function rail(w: World, stats: Partial<TowerDef['stats']> = {}): TowerState {
    const def: TowerDef = { ...TOWERS.railgun, stats: { ...TOWERS.railgun.stats, ...stats } };
    const t = new TowerState({ uid: 900, def, x: 0, y: PATH_Y, spent: 0, placedBuildWave: -1 });
    w.addTower(t);
    return t;
  }

  it('hits every enemy on the line once, nearest first, up to pierce, and ends at the field edge', () => {
    const w = world();
    const t = rail(w, { pierce: 6, damage: 100 });
    // path starts at x = -100: distance d sits at x = d - 100
    const row = [300, 450, 600].map((d) => w.spawnEnemy('grub', 0, d, 1)!);
    const flyer = w.spawnEnemy('gnat', 0, 800, 1)!;
    const ghost = w.spawnEnemy('ghost', 0, 900, 1)!;
    for (const e of w.enemies) e.y = PATH_Y;
    w.events.drain();
    expect(fireRail(t, w, row[0]!)).toBe(4);
    for (const e of [...row, flyer]) expect(e.maxHp - e.hp).toBe(100);
    expect(ghost.hp).toBe(ghost.maxHp);
    const shot = w.events.drain().find((e) => e.type === 'railShot');
    expect(shot).toMatchObject({ towerUid: 900, hits: 4 });
    expect(shot && 'x2' in shot && shot.x2).toBeCloseTo(FIELD_W);
  });

  it('stops after pierce and draws the line to the last enemy hit', () => {
    const w = world();
    const t = rail(w, { pierce: 2, damage: 100 });
    const row = [300, 450, 600].map((d) => w.spawnEnemy('grub', 0, d, 1)!);
    for (const e of w.enemies) e.y = PATH_Y;
    w.events.drain();
    expect(fireRail(t, w, row[0]!)).toBe(2);
    expect(row.map((e) => e.maxHp - e.hp)).toEqual([100, 100, 0]);
    const shot = w.events.drain().find((e) => e.type === 'railShot');
    expect(shot && 'x2' in shot && shot.x2).toBeCloseTo(row[1]!.x, 0);
  });

  it('charges for its cooldown between shots in the sim', () => {
    const sim = rich(one('grub'));
    sim.placeTower('railgun', 400, PATH_Y - 150);
    sim.startNextWave();
    const shots = collect(sim, 10).filter((e) => e.type === 'railShot');
    // the grub walks into range quickly; then one shot per 3 s cooldown
    expect(shots.length).toBeGreaterThanOrEqual(3);
    expect(shots.length).toBeLessThanOrEqual(4);
  });
});
