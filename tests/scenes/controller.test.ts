import { describe, expect, it } from 'vitest';
import { GameSim } from '../../src/sim/GameSim';
import { getMap } from '../../src/data/maps';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { GameController, type GameEvents } from '../../src/scenes/game/GameController';

function setup(money = 0) {
  const map = getMap('green-valley');
  if (!map) throw new Error('missing map');
  const sim = new GameSim({ map, difficulty: DIFFICULTIES.normal, seed: 7 });
  if (money) sim.grantMoney(money);
  const c = new GameController(sim);
  sim.events.drain();
  const log: { name: keyof GameEvents; payload: unknown }[] = [];
  for (const name of ['selectionChanged', 'placementChanged', 'placementRejected', 'moneyChanged', 'waveChanged',
    'towerChanged', 'speedChanged', 'pauseChanged', 'gameOver'] as const) {
    c.events.on(name, (payload) => log.push({ name, payload }));
  }
  const names = () => log.map((l) => l.name);
  return { sim, c, log, names };
}

describe('GameController placement', () => {
  it('places the pending tower and ends placement', () => {
    const { c, sim, names } = setup();
    expect(c.beginPlacement('blaster')).toBe(true);
    expect(c.pendingTowerId).toBe('blaster');
    const t = c.placeAt(400, 330);
    expect(t?.def.id).toBe('blaster');
    expect(sim.towers.length).toBe(1);
    expect(c.pendingTowerId).toBeNull();
    expect(names()).toEqual(['placementChanged', 'placementChanged', 'moneyChanged', 'towerChanged']);
  });

  it('keeps placing with Shift while money lasts', () => {
    const { c } = setup(1000);
    c.beginPlacement('blaster');
    expect(c.placeAt(400, 330, true)).not.toBeNull();
    expect(c.pendingTowerId).toBe('blaster');
    expect(c.placeAt(400, 330, true)).toBeNull();
    expect(c.pendingTowerId).toBe('blaster');
  });

  it('rejects invalid spots with a reason and unaffordable towers up front', () => {
    const { c, log } = setup();
    c.beginPlacement('blaster');
    expect(c.placeAt(300, 244)).toBeNull();
    expect(log.at(-1)).toEqual({ name: 'placementRejected', payload: { towerId: 'blaster', reason: 'Too close to the path' } });
    c.cancelPlacement();
    expect(c.beginPlacement('railgun')).toBe(false);
    expect(log.at(-1)?.name).toBe('placementRejected');
    expect(c.pendingTowerId).toBeNull();
  });

  it('snaps path towers onto the path centre line', () => {
    const { c } = setup();
    c.beginPlacement('spikes');
    const pos = { x: 0, y: 0 };
    expect(c.resolvePlacement(400, 280, pos).ok).toBe(true);
    expect(pos).toEqual({ x: 400, y: 244 });
    const t = c.placeAt(690, 420);
    expect(t && [t.x, t.y]).toEqual([715, 420]);
  });
});

describe('GameController selection and tower commands', () => {
  it('selects, sells and deselects', () => {
    const { c, names } = setup(2000);
    const t = c.placeTower('blaster', 400, 330);
    if (!t) throw new Error('place failed');
    expect(c.towerAt(410, 335)?.uid).toBe(t.uid);
    expect(c.towerAt(600, 600)).toBeUndefined();
    c.select(t.uid);
    expect(c.selectedTower()).toBe(t);
    expect(c.upgrade(t.uid, 0)).toBe(true);
    c.cycleTargetMode(t.uid);
    expect(t.targetMode).toBe('last');
    expect(c.sell(t.uid)).toBeGreaterThan(0);
    expect(c.selectedUid).toBeNull();
    expect(names().filter((n) => n === 'selectionChanged')).toHaveLength(2);
  });

  it('selecting cancels placement and beginning placement deselects', () => {
    const { c } = setup(2000);
    const t = c.placeTower('blaster', 400, 330);
    c.beginPlacement('frost');
    c.select(t?.uid ?? null);
    expect(c.pendingTowerId).toBeNull();
    c.beginPlacement('frost');
    expect(c.selectedUid).toBeNull();
  });
});

describe('GameController flow', () => {
  it('steps the sim by dt × speed, clamps long frames and stops while paused', () => {
    const { c, sim } = setup();
    c.update(0.05);
    expect(sim.time).toBeCloseTo(0.05, 1);
    c.setSpeed(3);
    c.update(1);
    expect(sim.time).toBeCloseTo(0.05 + 0.3, 1);
    c.togglePause();
    c.update(0.05);
    expect(sim.time).toBeCloseTo(0.35, 1);
    expect(c.paused).toBe(true);
  });

  it('emits waveChanged on wave start and when the wave ends', () => {
    const { c, log } = setup(5000);
    c.placeTower('gatling', 400, 330);
    c.placeTower('gatling', 620, 330);
    c.startNextWave();
    expect(log.filter((l) => l.name === 'waveChanged').at(-1)?.payload).toMatchObject({ wave: 1, phase: 'wave' });
    for (let i = 0; i < 2000 && c.sim.phase === 'wave'; i++) c.update(0.1);
    expect(log.filter((l) => l.name === 'waveChanged').at(-1)?.payload).toMatchObject({ wave: 1, phase: 'build' });
  });

  it('cycles speed 1 → 2 → 3 → 1', () => {
    const { c } = setup();
    c.cycleSpeed();
    c.cycleSpeed();
    expect(c.speed).toBe(3);
    c.cycleSpeed();
    expect(c.speed).toBe(1);
  });
});
