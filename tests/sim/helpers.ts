import type { DifficultyDef, EnemyDef, MapDef, TowerDef, UpgradeDef, UpgradePathDef } from '../../src/sim/types';
import { EnemyState } from '../../src/sim/EnemyState';
import { PathFollower } from '../../src/sim/PathFollower';
import { GameSim, type GameSimOptions } from '../../src/sim/GameSim';
import { ScriptedWaveSource, type SpawnEvent } from '../../src/sim/WaveSource';
import { SIM_DT } from '../../src/config';

/** Horizontal path across the field at y = 540, entering and leaving off-screen. */
export const PATH_Y = 540;
export const stubMap: MapDef = {
  id: 'stub', name: 'Stub', theme: 'meadow', difficulty: 1, description: '',
  paths: [[{ x: -100, y: PATH_Y }, { x: 1640, y: PATH_Y }]],
  pathWidth: 64, decorSeed: 1, blockers: [{ x: 300, y: 300, r: 40 }], background: 'map-stub',
};

export const stubDifficulty: DifficultyDef = {
  id: 'normal', name: 'Normal', startMoney: 1000, lives: 100, hpMul: 1, speedMul: 1, rewardMul: 1, costMul: 1, waves: 3,
};

function tier(cost: number, mods: UpgradeDef['mods'] = {}): UpgradeDef {
  return { name: `T${cost}`, description: '', cost, mods, icon: 'icon-upgrade' };
}

function path(name: string, mods: UpgradeDef['mods'][] = [{}, {}, {}]): UpgradePathDef {
  return { name, tiers: [tier(10, mods[0]), tier(20, mods[1]), tier(30, mods[2])] };
}

/** A plain shooter; override anything. */
export function stubTower(over: Partial<TowerDef> = {}, stats: Partial<TowerDef['stats']> = {}): TowerDef {
  return {
    id: 'gun', name: 'Gun', description: '', category: 'basic', cost: 100, footprint: 30, placement: 'ground',
    stats: {
      range: 200, cooldown: 0.5, damage: 10, damageType: 'physical', pierce: 1, projectileSpeed: 1200,
      splashRadius: 0, canHitStealth: false, canHitFlying: true, ...stats,
    },
    paths: [path('A', [{ add: { damage: 5 } }, { mul: { damage: 2 } }, { flags: ['big'] }]), path('B')],
    sprite: { base: 'tower-gun-base' },
    ...over,
  };
}

/** A plain walker; override anything. */
export function stubEnemy(over: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id: 'grub', name: 'Grub', description: '', hp: 50, speed: 100, armor: 0, reward: 5, leakDamage: 1,
    radius: 16, traits: [], sprite: 'enemy-grub', ...over,
  };
}

let uid = 1000;
/** Standalone enemy on a path (for unit tests that do not need a sim). */
export function makeEnemy(def: EnemyDef, distance: number, p = new PathFollower(stubMap.paths[0]!)): EnemyState {
  return new EnemyState({ uid: uid++, def, pathIndex: 0, path: p, distance, offset: 0, hpMul: 1, speedMul: 1, wave: 1 });
}

/** Build a sim with stub registries. */
export function makeSim(opts: Partial<GameSimOptions> & { waves?: GameSimOptions['waves'] } = {}): GameSim {
  return new GameSim({
    map: stubMap, difficulty: stubDifficulty, seed: 42,
    towers: { gun: stubTower() }, enemies: { grub: stubEnemy() },
    ...opts,
  });
}

/** Waves of `count` enemies spaced `gap` seconds apart. */
export function waves(...list: { id: string; count: number; gap?: number }[][]): ScriptedWaveSource {
  return new ScriptedWaveSource(list.map((groups) => {
    const out: SpawnEvent[] = [];
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) out.push({ enemyId: g.id, at: i * (g.gap ?? 0.5), pathIndex: 0 });
    }
    return out;
  }), { clearBonus: (w) => 100 + w, earlyStartBonus: (w) => 10 * w });
}

/** Run whole ticks. */
export function runTicks(sim: GameSim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step(SIM_DT);
}

/** Run until `done()` or `maxSeconds` of sim time pass. */
export function runUntil(sim: GameSim, done: () => boolean, maxSeconds = 120): void {
  const limit = Math.ceil(maxSeconds / SIM_DT);
  for (let i = 0; i < limit && !done(); i++) sim.step(SIM_DT);
}
