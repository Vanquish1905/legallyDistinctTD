import type { DamageType, DifficultyDef, EnemyDef, MapDef, TowerDef } from './types';
import type { HitFilter, HitSpec, SimContext } from './SimContext';
import type { TowerBehavior } from './towerBehaviors/types';
import { EnemyState } from './EnemyState';
import { TowerState } from './TowerState';
import { ProjectilePool, updateProjectile, type ProjectileInit, type ProjectileState } from './ProjectileState';
import { PathFollower } from './PathFollower';
import { SpatialHash } from './SpatialHash';
import { SimEventQueue } from './events';
import { Economy } from './Economy';
import { Rng } from './rng';
import { applyDamage, makeDamageResult } from './damage';
import { applyDot, applySlow, tickStatus, type DotEffect } from './status';
import { isTargetable, selectTarget } from './targeting';
import { initAbility, updateAbility } from './enemyAbilities';

/** HP fraction per second that enemies with the 'regen' trait recover. */
const REGEN_PER_SECOND = 0.02;
/** Children of a splitting enemy are spaced this far apart along the path (px). */
const SPLIT_SPACING = 14;

/** Everything a World is built from. */
export interface WorldOptions {
  map: MapDef;
  difficulty: DifficultyDef;
  seed: number;
  towerDefs: Readonly<Record<string, TowerDef>>;
  enemyDefs: Readonly<Record<string, EnemyDef>>;
  behaviors: Readonly<Record<string, TowerBehavior>>;
  money: number;
  lives: number;
}

/**
 * Mutable sim state plus the services behaviours use (`SimContext`). Internal to `src/sim`:
 * scenes talk to `GameSim`, which owns one World.
 */
export class World implements SimContext {
  time = 0;
  lives: number;
  nextUid = 1;
  readonly map: MapDef;
  readonly difficulty: DifficultyDef;
  readonly towerDefs: Readonly<Record<string, TowerDef>>;
  readonly enemyDefs: Readonly<Record<string, EnemyDef>>;
  readonly rng: Rng;
  readonly events = new SimEventQueue();
  readonly economy: Economy;
  readonly paths: PathFollower[];
  readonly enemies: EnemyState[] = [];
  readonly towers: TowerState[] = [];
  readonly projectiles: ProjectileState[] = [];
  private readonly behaviors: Readonly<Record<string, TowerBehavior>>;
  private readonly enemyByUid = new Map<number, EnemyState>();
  private readonly towerByUid = new Map<number, TowerState>();
  private readonly aliveByWave = new Map<number, number>();
  private readonly hash = new SpatialHash<EnemyState>(128);
  private readonly pool = new ProjectilePool();
  private readonly dmg = makeDamageResult();
  private readonly targetScratch: EnemyState[] = [];
  private readonly areaScratch: EnemyState[] = [];
  private dotTarget: EnemyState | null = null;
  /** True while behaviours run, so removals are deferred until the loop ends. */
  private updatingTowers = false;
  private removedTowers = false;
  /** Damage over time ignores armor (it is per-hit; resist still applies) and emits no hit events. */
  private readonly dotSink = (dot: DotEffect, amount: number): void => {
    if (this.dotTarget) this.applyHp(this.dotTarget, amount, dot.type, dot.source >= 0 ? dot.source : null, true, true);
  };

  constructor(o: WorldOptions) {
    this.map = o.map;
    this.difficulty = o.difficulty;
    this.towerDefs = o.towerDefs;
    this.enemyDefs = o.enemyDefs;
    this.behaviors = o.behaviors;
    this.rng = new Rng(o.seed);
    this.economy = new Economy(this.events, o.money);
    this.lives = o.lives;
    this.paths = o.map.paths.map((p) => new PathFollower(p));
    if (this.paths.length === 0) throw new Error(`Map ${o.map.id} has no paths`);
  }

  // ---- SimContext -------------------------------------------------------------------------

  getEnemy(uid: number): EnemyState | undefined {
    const e = this.enemyByUid.get(uid);
    return e && e.alive ? e : undefined;
  }

  getTower(uid: number): TowerState | undefined {
    return this.towerByUid.get(uid);
  }

  pathAt(index: number): PathFollower {
    const n = this.paths.length;
    return this.paths[((index % n) + n) % n] as PathFollower;
  }

  queryEnemies(x: number, y: number, r: number, out: EnemyState[]): EnemyState[] {
    this.hash.query(x, y, r, out);
    let w = 0;
    for (let i = 0; i < out.length; i++) {
      const e = out[i] as EnemyState;
      if (e.alive) out[w++] = e;
    }
    out.length = w;
    return out;
  }

  findTarget(tower: TowerState): EnemyState | null {
    const candidates = this.queryEnemies(tower.x, tower.y, tower.range, this.targetScratch);
    return selectTarget(candidates, tower.targetMode, tower.x, tower.y, tower.stats);
  }

  canHit(enemy: EnemyState, filter: HitFilter): boolean {
    return isTargetable(enemy, filter);
  }

  hitEnemy(enemy: EnemyState, spec: HitSpec, towerUid: number | null, damage = spec.damage): void {
    if (!enemy.alive) return;
    if (damage > 0) this.damageEnemy(enemy, damage, spec.damageType, towerUid);
    if (!enemy.alive) return;
    if (spec.slow && !enemy.def.traits.includes('slowImmune')) {
      applySlow(enemy.status, spec.slow.factor, spec.slow.duration);
    }
    if (spec.dot) applyDot(enemy.status, towerUid ?? -1, spec.dot.dps, spec.dot.duration, spec.dot.type);
  }

  damageEnemy(enemy: EnemyState, amount: number, type: DamageType, towerUid: number | null, ignoreArmor = false): number {
    return this.applyHp(enemy, amount, type, towerUid, ignoreArmor, false);
  }

  explode(
    x: number, y: number, radius: number, spec: HitSpec, towerUid: number | null, groundOnly: boolean, damage = spec.damage,
  ): void {
    this.events.push({ type: 'explosion', x, y, radius, damageType: spec.damageType });
    const victims = this.queryEnemies(x, y, radius, this.areaScratch);
    for (let i = 0; i < victims.length; i++) {
      const e = victims[i] as EnemyState;
      if (groundOnly && e.flying) continue;
      if (this.canHit(e, spec)) this.hitEnemy(e, spec, towerUid, damage);
    }
  }

  spawnProjectile(init: ProjectileInit): ProjectileState {
    const p = this.pool.acquire();
    p.launch(this.nextUid++, init);
    this.projectiles.push(p);
    this.events.push({ type: 'projectileSpawn', uid: p.uid, kind: p.kind, x: p.x, y: p.y, towerUid: p.towerUid });
    return p;
  }

  spawnEnemy(enemyId: string, pathIndex: number, distance: number, wave: number, hpMul = 1): EnemyState | null {
    const def = this.enemyDefs[enemyId];
    if (!def) return null;
    const path = this.pathAt(pathIndex);
    const spread = Math.max(0, this.map.pathWidth / 2 - def.radius) * 0.5;
    const offset = def.traits.includes('boss') ? 0 : this.rng.range(-spread, spread);
    const e = new EnemyState({
      uid: this.nextUid++, def, pathIndex: this.paths.indexOf(path), path, offset, wave,
      distance: Math.max(0, Math.min(distance, path.length)),
      hpMul: this.difficulty.hpMul * hpMul,
      speedMul: this.difficulty.speedMul,
    });
    initAbility(e);
    this.enemies.push(e);
    this.enemyByUid.set(e.uid, e);
    this.aliveByWave.set(wave, (this.aliveByWave.get(wave) ?? 0) + 1);
    this.events.push({ type: 'enemySpawn', uid: e.uid, enemyId, x: e.x, y: e.y, boss: e.isBoss });
    if (e.isBoss) this.events.push({ type: 'bossSpawn', uid: e.uid, enemyId, name: def.name });
    return e;
  }

  addMoney(amount: number): void {
    this.economy.earn(amount);
  }

  // ---- bookkeeping ------------------------------------------------------------------------

  /** Enemies of `wave` still on the field. */
  aliveInWave(wave: number): number {
    return this.aliveByWave.get(wave) ?? 0;
  }

  /** Behaviour of a tower (throws for unknown behaviour keys: a content bug). */
  behaviorOf(tower: TowerState): TowerBehavior {
    const b = this.behaviors[tower.behavior];
    if (!b) throw new Error(`Unknown tower behavior "${tower.behavior}" on ${tower.def.id}`);
    return b;
  }

  /** Add a tower to the field (no payment, no event). */
  addTower(tower: TowerState): void {
    this.towers.push(tower);
    this.towerByUid.set(tower.uid, tower);
  }

  /**
   * Remove a tower from the field (no refund, no event). Safe to call from a behaviour's
   * `update` (e.g. a consumed trap): the array is compacted after the update loop.
   */
  removeTower(tower: TowerState): void {
    if (!this.towerByUid.delete(tower.uid)) return;
    if (this.updatingTowers) {
      this.removedTowers = true;
    } else {
      const i = this.towers.indexOf(tower);
      if (i >= 0) this.towers.splice(i, 1);
    }
    this.behaviorOf(tower).onRemove?.(tower, this);
  }

  private applyHp(
    e: EnemyState, amount: number, type: DamageType, towerUid: number | null, ignoreArmor: boolean, silent: boolean,
  ): number {
    if (!e.alive || amount <= 0) return 0;
    const r = applyDamage(e, amount, type, this.dmg, ignoreArmor);
    const total = r.dealt + r.absorbed;
    const tower = towerUid === null ? undefined : this.towerByUid.get(towerUid);
    if (tower) tower.damageDealt += r.dealt;
    if (!silent && total > 0) {
      this.events.push({
        type: 'enemyHit', uid: e.uid, x: e.x, y: e.y, amount: total, damageType: type,
        shielded: r.absorbed > 0, towerUid,
      });
    }
    if (r.killed) this.kill(e, tower);
    return total;
  }

  private kill(e: EnemyState, tower: TowerState | undefined): void {
    e.alive = false;
    this.aliveByWave.set(e.wave, this.aliveInWave(e.wave) - 1);
    const reward = Math.round(e.def.reward * this.difficulty.rewardMul);
    this.economy.earn(reward);
    if (tower) tower.kills++;
    this.events.push({
      type: 'enemyKilled', uid: e.uid, enemyId: e.def.id, x: e.x, y: e.y, reward, towerUid: tower?.uid ?? null,
    });
    const split = e.def.onDeath;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        this.spawnEnemy(split.spawn, e.pathIndex, e.distance - i * SPLIT_SPACING, e.wave);
      }
    }
  }

  private leak(e: EnemyState): void {
    e.alive = false;
    this.aliveByWave.set(e.wave, this.aliveInWave(e.wave) - 1);
    const damage = Math.min(this.lives, e.def.leakDamage);
    this.events.push({ type: 'enemyLeaked', uid: e.uid, enemyId: e.def.id, damage: e.def.leakDamage });
    if (damage > 0) {
      this.lives -= damage;
      this.events.push({ type: 'livesChanged', lives: this.lives, delta: -damage });
    }
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const e of this.enemies) if (e.alive) this.hash.insert(e);
  }

  // ---- systems ----------------------------------------------------------------------------

  /** Statuses, regen, abilities and movement for every enemy. */
  tickEnemies(dt: number): void {
    this.rebuildHash();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i] as EnemyState;
      if (!e.alive) continue;
      this.dotTarget = e;
      tickStatus(e.status, dt, this.dotSink);
      this.dotTarget = null;
      if (!e.alive) continue;
      if (e.hp < e.maxHp && e.def.traits.includes('regen')) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * REGEN_PER_SECOND * dt);
      }
      if (e.def.ability) updateAbility(e, e.def.ability, this, dt);
      if (e.move(this.pathAt(e.pathIndex), dt)) this.leak(e);
    }
  }

  /** Stealth reveal, support buffs and every tower's behaviour. */
  tickTowers(dt: number): void {
    this.rebuildHash();
    for (const e of this.enemies) e.revealed = false;
    for (const t of this.towers) {
      t.buffRangeMul = 1;
      t.buffCooldownMul = 1;
      const buff = t.stats.buff;
      if (buff?.revealStealth) {
        for (const e of this.queryEnemies(t.x, t.y, buff.radius, this.areaScratch)) e.revealed = true;
      }
    }
    for (const t of this.towers) this.behaviorOf(t).prepare?.(t, this);
    this.updatingTowers = true;
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i] as TowerState;
      if (this.towerByUid.has(t.uid)) this.behaviorOf(t).update(t, this, dt);
    }
    this.updatingTowers = false;
    if (this.removedTowers) {
      this.removedTowers = false;
      let w = 0;
      for (let i = 0; i < this.towers.length; i++) {
        const t = this.towers[i] as TowerState;
        if (this.towerByUid.has(t.uid)) this.towers[w++] = t;
      }
      this.towers.length = w;
    }
  }

  /** Move projectiles, resolve hits and recycle spent ones. */
  tickProjectiles(dt: number): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      updateProjectile(this.projectiles[i] as ProjectileState, this, dt);
    }
    let w = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i] as ProjectileState;
      if (p.active) this.projectiles[w++] = p;
      else this.pool.release(p);
    }
    this.projectiles.length = w;
  }

  /** Drop dead and leaked enemies (keeps order). */
  compactEnemies(): void {
    let w = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i] as EnemyState;
      if (e.alive) this.enemies[w++] = e;
      else this.enemyByUid.delete(e.uid);
    }
    this.enemies.length = w;
  }
}
