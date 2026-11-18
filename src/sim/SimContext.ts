import type { DamageType, TowerStats } from './types';
import type { EnemyState } from './EnemyState';
import type { TowerState } from './TowerState';
import type { ProjectileInit, ProjectileState } from './ProjectileState';
import type { PathFollower } from './PathFollower';
import type { Rng } from './rng';
import type { SimEventQueue } from './events';

/** What a hit carries. `TowerStats` satisfies this, so behaviours can pass a tower's stats as is. */
export type HitSpec = Pick<TowerStats, 'damage' | 'damageType' | 'slow' | 'dot' | 'canHitStealth' | 'canHitFlying'>;

/** Which enemies an attack may touch. */
export type HitFilter = Pick<TowerStats, 'canHitStealth' | 'canHitFlying'>;

/**
 * The sim services that tower behaviours, projectiles and enemy abilities may use. Implemented
 * by the internal `World`; never exposed to rendering code.
 */
export interface SimContext {
  readonly time: number;
  readonly rng: Rng;
  readonly events: SimEventQueue;
  readonly enemies: ReadonlyArray<EnemyState>;
  readonly towers: ReadonlyArray<TowerState>;
  /** The player's current money (read-only; use `addMoney` to pay out). */
  readonly money: number;
  /** Alive enemy by uid. */
  getEnemy(uid: number): EnemyState | undefined;
  /** Path follower for a map path index. */
  pathAt(index: number): PathFollower;
  /** Alive enemies whose circle touches the query circle (written into `out`). */
  queryEnemies(x: number, y: number, r: number, out: EnemyState[]): EnemyState[];
  /** Best target for a tower in range, by its target mode. */
  findTarget(tower: TowerState): EnemyState | null;
  /** Whether an attack with this filter may touch the enemy (alive, surfaced, flying/stealth rules). */
  canHit(enemy: EnemyState, filter: HitFilter): boolean;
  /** Damage plus on-hit effects (slow, dot). `damage` overrides `spec.damage` when given. */
  hitEnemy(enemy: EnemyState, spec: HitSpec, towerUid: number | null, damage?: number): void;
  /** Raw damage through the damage pipeline. Returns HP + shield removed. */
  damageEnemy(enemy: EnemyState, amount: number, type: DamageType, towerUid: number | null, ignoreArmor?: boolean): number;
  /**
   * Area hit at a point. `groundOnly` excludes flying enemies (e.g. lobbed shells landing).
   * `damage` overrides `spec.damage` when given. Emits an 'explosion' event.
   */
  explode(
    x: number, y: number, radius: number, spec: HitSpec, towerUid: number | null, groundOnly: boolean, damage?: number,
  ): void;
  /** Launch a pooled projectile (emits 'projectileSpawn'). */
  spawnProjectile(init: ProjectileInit): ProjectileState;
  /**
   * Spawn an enemy mid-path (splits, summons). `hpMul` is extra wave scaling on top of the
   * difficulty (pass the parent's `waveHpMul`). Returns null for unknown ids.
   */
  spawnEnemy(enemyId: string, pathIndex: number, distance: number, wave: number, hpMul?: number): EnemyState | null;
  /** Take a tower off the field without refund (e.g. a consumed trap). Safe during `update`. */
  removeTower(tower: TowerState): void;
  /** Grant money (income, bonuses). */
  addMoney(amount: number): void;
}
