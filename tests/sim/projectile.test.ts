import { describe, expect, it } from 'vitest';
import { World } from '../../src/sim/World';
import { TOWER_BEHAVIORS } from '../../src/sim/towerBehaviors';
import { TowerState } from '../../src/sim/TowerState';
import type { ProjectileInit } from '../../src/sim/ProjectileState';
import type { EnemyDef, TowerDef } from '../../src/sim/types';
import { SIM_DT } from '../../src/config';
import { PATH_Y, stubDifficulty, stubEnemy, stubMap, stubTower } from './helpers';

const still = stubEnemy({ id: 'still', speed: 0, hp: 100 });
const flyer = stubEnemy({ id: 'flyer', speed: 0, hp: 100, traits: ['flying'] });

function world(towers: Record<string, TowerDef> = {}, enemies: Record<string, EnemyDef> = { still, flyer }): World {
  return new World({
    map: { ...stubMap, pathWidth: 32 }, difficulty: stubDifficulty, seed: 1, towerDefs: towers, enemyDefs: enemies,
    behaviors: TOWER_BEHAVIORS, money: 0, lives: 10,
  });
}

function tick(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    w.time += SIM_DT;
    w.tickEnemies(SIM_DT);
    w.tickTowers(SIM_DT);
    w.tickProjectiles(SIM_DT);
    w.compactEnemies();
  }
}

/** Enemy at field x on the stub path (path starts at x = -100). */
function at(w: World, x: number, id = 'still') {
  return w.spawnEnemy(id, 0, x + 100, 1)!;
}

function shot(over: Partial<ProjectileInit>): ProjectileInit {
  return {
    towerUid: -1, kind: 'bullet', motion: 'straight', x: 100, y: PATH_Y, targetX: 1500, targetY: PATH_Y,
    targetUid: -1, speed: 900, spec: stubTower().stats, damage: 10, pierce: 1, splashRadius: 0, maxDistance: 2000,
    ...over,
  };
}

describe('straight projectiles', () => {
  it('hit the first enemy on their line and expire', () => {
    const w = world();
    const a = at(w, 400);
    const b = at(w, 600);
    w.spawnProjectile(shot({}));
    tick(w, 60);
    expect(a.hp).toBe(90);
    expect(b.hp).toBe(100);
    expect(w.projectiles).toHaveLength(0);
  });

  it('pierce through several enemies, each hit once', () => {
    const w = world();
    const list = [300, 360, 420, 480].map((x) => at(w, x));
    w.spawnProjectile(shot({ pierce: 3 }));
    tick(w, 90);
    expect(list.map((e) => e.hp)).toEqual([90, 90, 90, 100]);
  });

  it('do not tunnel through enemies at high speed', () => {
    const w = world();
    const e = at(w, 500);
    w.spawnProjectile(shot({ speed: 5000 }));
    tick(w, 30);
    expect(e.hp).toBe(90);
  });

  it('expire after maxDistance', () => {
    const w = world();
    const e = at(w, 900);
    w.spawnProjectile(shot({ maxDistance: 300 }));
    tick(w, 120);
    expect(e.hp).toBe(100);
    expect(w.projectiles).toHaveLength(0);
  });

  it('splash damages everything around the impact', () => {
    const w = world();
    const hit = at(w, 400);
    const near = at(w, 450);
    const far = at(w, 700);
    w.spawnProjectile(shot({ splashRadius: 80 }));
    tick(w, 60);
    expect([hit.hp, near.hp, far.hp]).toEqual([90, 90, 100]);
    expect(w.events.drain().some((e) => e.type === 'explosion')).toBe(true);
  });
});

describe('homing projectiles', () => {
  it('follow their target and retarget when it dies', () => {
    const w = world();
    const target = at(w, 900);
    const other = at(w, 1000);
    w.spawnProjectile(shot({ motion: 'homing', targetX: 100, targetY: 0, targetUid: target.uid, speed: 600, homingRadius: 2000 }));
    tick(w, 5);
    target.alive = false; // dies to something else
    tick(w, 5);
    w.compactEnemies();
    tick(w, 200);
    expect(other.hp).toBe(90);
  });
});

describe('homing pierce', () => {
  it('drops a target it already hit and homes onto a new one', () => {
    const w = world();
    const first = at(w, 600);
    const second = at(w, 300);
    w.spawnProjectile(shot({
      motion: 'homing', x: 600, y: PATH_Y - 200, targetX: 600, targetY: PATH_Y, targetUid: first.uid,
      speed: 600, pierce: 3, homingRadius: 2000,
    }));
    tick(w, 180);
    expect(first.hp).toBe(90);
    expect(second.hp).toBe(90);
  });
});

describe('lobbed projectiles', () => {
  it('fly an arc and burst on the ground, never hitting flyers', () => {
    const w = world();
    const ground = at(w, 600);
    const air = at(w, 610, 'flyer');
    const p = w.spawnProjectile(shot({ motion: 'lob', targetX: 600, targetY: PATH_Y, speed: 500, splashRadius: 60 }));
    tick(w, 30);
    expect(p.z).toBeGreaterThan(0);
    expect(ground.hp).toBe(100);
    tick(w, 60);
    expect(ground.hp).toBe(90);
    expect(air.hp).toBe(100);
    expect(w.projectiles).toHaveLength(0);
  });
});

describe('projectile behaviour', () => {
  it('fires at the cooldown rate, leading targets, and recycles projectiles', () => {
    const gun = stubTower({}, { cooldown: 0.25, damage: 1, range: 400 });
    const w = world({ gun }, { still, walker: stubEnemy({ id: 'walker', hp: 1e6, speed: 60 }) });
    const tower = new TowerState({ uid: w.nextUid++, def: gun, x: 600, y: PATH_Y - 100, spent: 0, placedBuildWave: 0 });
    w.addTower(tower);
    const e = w.spawnEnemy('walker', 0, 500, 1)!;
    tick(w, 120);
    const fired = w.events.drain().filter((ev) => ev.type === 'towerFired').length;
    expect(fired).toBe(8);
    expect(e.maxHp - e.hp).toBeGreaterThanOrEqual(7);
    expect(tower.damageDealt).toBe(e.maxHp - e.hp);
  });

  it('fires several shots per tick for sub-tick cooldowns without building up debt', () => {
    const minigun = stubTower({ id: 'minigun' }, { cooldown: SIM_DT / 3, damage: 1, projectileSpeed: 0, range: 300 });
    const w = world({ minigun }, { still: stubEnemy({ id: 'still', speed: 0, hp: 1e9 }) });
    const tower = new TowerState({ uid: w.nextUid++, def: minigun, x: 600, y: PATH_Y - 100, spent: 0, placedBuildWave: 0 });
    w.addTower(tower);
    const e = at(w, 600);
    tick(w, 60);
    expect(e.maxHp - e.hp).toBe(180);
    expect(tower.cooldownLeft).toBeGreaterThanOrEqual(-tower.cooldown - 1e-9);
    // idle with no target, then a target appears: no catch-up burst
    e.alive = false;
    w.compactEnemies();
    tick(w, 120);
    const next = at(w, 600);
    tick(w, 1);
    expect(next.maxHp - next.hp).toBeLessThanOrEqual(4);
  });

  it('drops cooldown debt instead of bursting to catch up', () => {
    const gun = stubTower({}, { cooldown: 0.25, damage: 1, projectileSpeed: 0, range: 300 });
    const w = world({ gun }, { still: stubEnemy({ id: 'still', speed: 0, hp: 1e9 }) });
    const tower = new TowerState({ uid: w.nextUid++, def: gun, x: 600, y: PATH_Y - 100, spent: 0, placedBuildWave: 0 });
    w.addTower(tower);
    const e = at(w, 600);
    tower.cooldownLeft = -5; // e.g. buffed cooldown mid-flight or a restored odd value: 20 shots of debt
    w.tickTowers(SIM_DT);
    expect(e.maxHp - e.hp).toBeLessThanOrEqual(8);
    expect(tower.cooldownLeft).toBeGreaterThanOrEqual(-SIM_DT);
    let before = e.hp;
    w.tickTowers(SIM_DT);
    expect(before - e.hp).toBe(1);
    before = e.hp;
    for (let i = 0; i < 10; i++) w.tickTowers(SIM_DT);
    expect(before - e.hp).toBe(0);
  });

  it('hitscans when projectile speed is 0 and skips targets it cannot see', () => {
    const sniper = stubTower({ id: 'sniper' }, { projectileSpeed: 0, damage: 25, canHitFlying: false, range: 300 });
    const w = world({ sniper });
    w.addTower(new TowerState({ uid: w.nextUid++, def: sniper, x: 600, y: PATH_Y - 100, spent: 0, placedBuildWave: 0 }));
    const air = at(w, 600, 'flyer');
    const ground = at(w, 700);
    tick(w, 1);
    expect(ground.hp).toBe(75);
    expect(air.hp).toBe(100);
    expect(w.projectiles).toHaveLength(0);
  });
});
