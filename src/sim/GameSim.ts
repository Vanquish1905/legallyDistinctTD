import type { DifficultyDef, EnemyDef, MapDef, TargetMode, TowerDef } from './types';
import type { EnemyState } from './EnemyState';
import type { ProjectileState } from './ProjectileState';
import type { SimEventQueue } from './events';
import type { TowerBehavior } from './towerBehaviors/types';
import { SIM_DT } from '../config';
import { TOWERS } from '../data/towers';
import { ENEMIES } from '../data/enemies';
import { TOWER_BEHAVIORS } from './towerBehaviors';
import { World } from './World';
import { TowerState, canUpgradePath } from './TowerState';
import { WaveRunner } from './waveRunner';
import { ScriptedWaveSource, type SpawnEvent, type WaveSource } from './WaveSource';
import { checkPlacement, type PlacementResult } from './placement';
import { scaledCost, sellValue } from './Economy';
import { SNAPSHOT_VERSION, type SimSnapshot } from './snapshot';

/** Longest frame time `step` will simulate at once (s); prevents a spiral after tab sleep. */
const MAX_STEP = 0.5;

/** Game phase. 'build' = between waves, 'wave' = at least one wave running. */
export type SimPhase = 'build' | 'wave' | 'won' | 'lost';

/** Constructor options. Registries default to the real content in `src/data`. */
export interface GameSimOptions {
  map: MapDef;
  difficulty: DifficultyDef;
  seed: number;
  /** Restore this between-waves state. */
  save?: SimSnapshot;
  towers?: Readonly<Record<string, TowerDef>>;
  enemies?: Readonly<Record<string, EnemyDef>>;
  behaviors?: Readonly<Record<string, TowerBehavior>>;
  /** Where waves come from (default: no waves). */
  waves?: WaveSource;
}

/**
 * The single entry point scenes use: owns all sim state, advances it in fixed `SIM_DT` steps and
 * exposes command methods. Rendering reads the state arrays and drains `events`.
 */
export class GameSim {
  phase: SimPhase = 'build';
  /** Number of waves started so far (1-based number of the latest wave). */
  wave = 0;
  /** True after the player chose to keep playing past the last wave. */
  freeplay = false;
  readonly seed: number;
  private readonly world: World;
  private readonly source: WaveSource;
  private readonly runner = new WaveRunner();
  private accumulator = 0;

  constructor(opts: GameSimOptions) {
    this.seed = opts.seed;
    this.source = opts.waves ?? new ScriptedWaveSource([]);
    const save = opts.save;
    if (save) {
      if (save.version !== SNAPSHOT_VERSION) throw new Error(`Unsupported save version ${save.version}`);
      if (save.mapId !== opts.map.id) throw new Error(`Save is for map ${save.mapId}, not ${opts.map.id}`);
    }
    this.world = new World({
      map: opts.map,
      difficulty: opts.difficulty,
      seed: opts.seed,
      towerDefs: opts.towers ?? TOWERS,
      enemyDefs: opts.enemies ?? ENEMIES,
      behaviors: opts.behaviors ?? TOWER_BEHAVIORS,
      money: save?.money ?? opts.difficulty.startMoney,
      lives: save?.lives ?? opts.difficulty.lives,
    });
    if (save) this.restore(save);
  }

  get enemies(): ReadonlyArray<EnemyState> { return this.world.enemies; }
  get towers(): ReadonlyArray<TowerState> { return this.world.towers; }
  get projectiles(): ReadonlyArray<ProjectileState> { return this.world.projectiles; }
  get events(): SimEventQueue { return this.world.events; }
  get money(): number { return this.world.economy.money; }
  get lives(): number { return this.world.lives; }
  get time(): number { return this.world.time; }
  get map(): MapDef { return this.world.map; }
  get difficulty(): DifficultyDef { return this.world.difficulty; }

  /** Advance by `dt` seconds of real time, in whole `SIM_DT` ticks (remainder carried over). */
  step(dt: number): void {
    this.accumulator += Math.min(Math.max(dt, 0), MAX_STEP);
    while (this.accumulator >= SIM_DT - 1e-9) {
      this.accumulator -= SIM_DT;
      this.tick();
    }
  }

  private tick(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    const w = this.world;
    w.time += SIM_DT;
    this.runner.update(SIM_DT, this.spawnFromWave);
    w.tickEnemies(SIM_DT);
    w.tickTowers(SIM_DT);
    w.tickProjectiles(SIM_DT);
    w.compactEnemies();
    if (w.lives <= 0) {
      this.phase = 'lost';
      w.events.push({ type: 'gameLost', wave: this.wave });
      return;
    }
    for (const cleared of this.runner.takeCleared((n) => w.aliveInWave(n))) this.clearWave(cleared);
    if (this.phase === 'wave' && !this.runner.running) {
      if (!this.freeplay && this.wave >= w.difficulty.waves) {
        this.phase = 'won';
        w.events.push({ type: 'gameWon', wave: this.wave });
      } else {
        this.phase = 'build';
      }
    }
  }

  private readonly spawnFromWave = (ev: SpawnEvent, wave: number): void => {
    this.world.spawnEnemy(ev.enemyId, ev.pathIndex, 0, wave, ev.hpMul ?? 1);
  };

  private clearWave(wave: number): void {
    const w = this.world;
    const bonus = this.source.clearBonus(wave);
    w.economy.earn(bonus);
    w.events.push({ type: 'waveCleared', wave, bonus });
    for (const t of w.towers) w.behaviorOf(t).onWaveCleared?.(t, w, wave);
  }

  /** Price of a tower on this difficulty (undefined for unknown ids). */
  towerCost(towerId: string): number | undefined {
    const def = this.world.towerDefs[towerId];
    return def && scaledCost(def.cost, this.world.difficulty.costMul);
  }

  /** Price of the next tier on `path`, or null when that path cannot be upgraded. */
  upgradeCost(uid: number, path: 0 | 1): number | null {
    const t = this.world.getTower(uid);
    if (!t || !canUpgradePath(t.tiers, path)) return null;
    const tier = t.def.paths[path].tiers[t.tiers[path]];
    return tier ? scaledCost(tier.cost, this.world.difficulty.costMul) : null;
  }

  /** Whether `towerId` could be placed at (x, y) now, with a reason when not. */
  canPlace(towerId: string, x: number, y: number): PlacementResult {
    const def = this.world.towerDefs[towerId];
    if (!def) return { ok: false, reason: 'Unknown tower' };
    if (this.phase === 'won' || this.phase === 'lost') return { ok: false, reason: 'Game over' };
    const geo = checkPlacement(def, x, y, this.world);
    if (!geo.ok) return geo;
    if (!this.world.economy.canAfford(scaledCost(def.cost, this.world.difficulty.costMul))) {
      return { ok: false, reason: 'Not enough money' };
    }
    return geo;
  }

  /** Buy and place a tower. Returns null when `canPlace` fails. */
  placeTower(towerId: string, x: number, y: number): TowerState | null {
    if (!this.canPlace(towerId, x, y).ok) return null;
    const w = this.world;
    const def = w.towerDefs[towerId] as TowerDef;
    const cost = scaledCost(def.cost, w.difficulty.costMul);
    if (!w.economy.trySpend(cost)) return null;
    const tower = new TowerState({
      uid: w.nextUid++, def, x, y, spent: cost, placedBuildWave: this.phase === 'build' ? this.wave : -1,
    });
    w.addTower(tower);
    w.behaviorOf(tower).onPlace?.(tower, w);
    w.events.push({ type: 'towerPlaced', uid: tower.uid, towerId, x, y });
    return tower;
  }

  /** Buy the next tier on `path`. False when locked, maxed, unaffordable or unknown. */
  upgradeTower(uid: number, path: 0 | 1): boolean {
    if (this.phase === 'won' || this.phase === 'lost') return false;
    const cost = this.upgradeCost(uid, path);
    const t = this.world.getTower(uid);
    if (cost === null || !t || !this.world.economy.trySpend(cost)) return false;
    t.applyUpgrade(path, cost);
    this.world.events.push({ type: 'towerUpgraded', uid, towerId: t.def.id, path, tier: t.tiers[path] });
    return true;
  }

  /** Refund a tower would give if sold now (0 for unknown uids). */
  sellValueOf(uid: number): number {
    const t = this.world.getTower(uid);
    if (!t) return 0;
    return sellValue(t.spent, this.phase === 'build' && t.placedBuildWave === this.wave);
  }

  /** Sell a tower. Returns the refund (0 when not found). */
  sellTower(uid: number): number {
    if (this.phase === 'won' || this.phase === 'lost') return 0;
    const t = this.world.getTower(uid);
    if (!t) return 0;
    const refund = this.sellValueOf(uid);
    this.world.removeTower(t);
    this.world.economy.earn(refund);
    this.world.events.push({ type: 'towerSold', uid, towerId: t.def.id, x: t.x, y: t.y, refund });
    return refund;
  }

  /** Change how a tower picks targets. */
  setTargetMode(uid: number, mode: TargetMode): void {
    const t = this.world.getTower(uid);
    if (t) t.targetMode = mode;
  }

  /**
   * Start the next wave. Calling it while a wave is still running starts the next one early and
   * pays the source's early-start bonus. No-op after the last wave (unless in freeplay) or when
   * the game is over.
   */
  startNextWave(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    if (!this.freeplay && this.wave >= this.world.difficulty.waves) return;
    const early = this.phase === 'wave';
    this.wave++;
    const bonus = early ? this.source.earlyStartBonus(this.wave) : 0;
    this.world.economy.earn(bonus);
    this.runner.start(this.wave, this.source.spawnsFor(this.wave, this.world.paths.length));
    this.phase = 'wave';
    this.world.events.push({ type: 'waveStart', wave: this.wave, early, bonus });
  }

  /** After winning, keep playing endless waves. */
  enterFreeplay(): void {
    if (this.phase !== 'won') return;
    this.freeplay = true;
    this.phase = 'build';
  }

  /** Pay for something outside the sim (e.g. the slot machine). False when too poor. */
  spendMoney(amount: number): boolean {
    return this.world.economy.trySpend(amount);
  }

  /** Grant money from outside the sim (e.g. a slot machine win). */
  grantMoney(amount: number): void {
    this.world.economy.earn(amount);
  }

  /** JSON-safe state for saves. Only valid in the build phase; throws otherwise. */
  snapshot(): SimSnapshot {
    if (this.phase !== 'build') throw new Error(`Cannot snapshot during phase "${this.phase}"`);
    const w = this.world;
    return {
      version: SNAPSHOT_VERSION,
      mapId: w.map.id,
      difficultyId: w.difficulty.id,
      seed: this.seed,
      rngState: w.rng.state,
      money: this.money,
      lives: w.lives,
      wave: this.wave,
      time: w.time,
      freeplay: this.freeplay,
      nextUid: w.nextUid,
      towers: w.towers.map((t) => ({
        uid: t.uid, towerId: t.def.id, x: t.x, y: t.y, tiers: [t.tiers[0], t.tiers[1]], spent: t.spent,
        placedBuildWave: t.placedBuildWave, targetMode: t.targetMode, kills: t.kills,
        damageDealt: t.damageDealt, memory: { ...t.memory },
      })),
    };
  }

  private restore(save: SimSnapshot): void {
    const w = this.world;
    w.rng.state = save.rngState;
    w.time = save.time;
    w.nextUid = save.nextUid;
    this.wave = save.wave;
    this.freeplay = save.freeplay;
    for (const s of save.towers) {
      const def = w.towerDefs[s.towerId];
      if (!def) continue;
      const t = new TowerState({
        uid: s.uid, def, x: s.x, y: s.y, spent: s.spent, placedBuildWave: s.placedBuildWave, tiers: s.tiers,
      });
      t.targetMode = s.targetMode;
      t.kills = s.kills;
      t.damageDealt = s.damageDealt;
      Object.assign(t.memory, s.memory);
      w.addTower(t);
      w.behaviorOf(t).onPlace?.(t, w);
    }
  }
}
