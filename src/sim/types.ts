/**
 * Shared content and simulation types. Pure data shapes only: `src/data/**` authors values against
 * these, `src/sim/**` consumes them.
 */

export type DamageType = 'physical' | 'explosive' | 'fire' | 'ice' | 'energy' | 'poison';
export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export type EnemyTrait = 'armored' | 'stealth' | 'flying' | 'regen' | 'slowImmune' | 'splitter'
  | 'shielder' | 'healer' | 'burrower' | 'spawner' | 'boss';

export interface Vec2 { x: number; y: number }

/** An enemy ability that a boss phase can switch on (any ability except nested phases). */
export type PhaseAbilityDef = Exclude<EnemyAbilityDef, { kind: 'bossPhases' }>;

/** One boss phase, entered once the boss drops to `hpFraction` of its max HP. */
export interface BossPhaseDef {
  /** Phase starts when hp / maxHp <= this value (0..1). */
  hpFraction: number;
  /** Multiplies the boss' base speed from this phase on. */
  speedMul?: number;
  /** Replaces the boss' armor from this phase on (e.g. 0 to shed armor). */
  armor?: number;
  /** Ability that becomes active from this phase on (replaces any earlier phase ability). */
  ability?: PhaseAbilityDef;
  /** Shown in the boss phase banner (defaults to "Phase N"). */
  name?: string;
}

/** An ability that can run inside a `combo` (anything except phases and nested combos). */
export type ComboPartDef = Exclude<EnemyAbilityDef, { kind: 'bossPhases' } | { kind: 'combo' }>;

/** Several abilities running side by side, each with its own timer. */
export interface ComboAbilityDef { kind: 'combo'; abilities: ComboPartDef[] }

/**
 * Special enemy behaviour, discriminated on `kind`. Handlers live in `src/sim/enemyAbilities.ts`.
 * Intervals and durations are seconds, radii px.
 */
export type EnemyAbilityDef =
  /** Every `interval` s, gives allies within `radius` a shield of `amount` HP (does not stack above it). */
  | { kind: 'shieldAura'; radius: number; amount: number; interval: number }
  /** Every `interval` s, heals allies within `radius` by `fraction` of their max HP. */
  | { kind: 'healAura'; radius: number; fraction: number; interval: number }
  /** Surfaces for `interval` s, then burrows (untargetable) for `duration` s, repeating. */
  | { kind: 'burrow'; interval: number; duration: number }
  /** Every `interval` s, spawns `count` × `enemyId` on its path, starting 20 px behind itself. */
  | { kind: 'spawn'; enemyId: string; count: number; interval: number }
  /** Speed multiplier ramps linearly from 1 (full HP) to `maxSpeedMul` (0 HP). */
  | { kind: 'enrage'; maxSpeedMul: number }
  /** Ordered phases (highest `hpFraction` first). */
  | { kind: 'bossPhases'; phases: BossPhaseDef[] }
  | ComboAbilityDef;

export interface EnemyDef {
  id: string; name: string; description: string;
  /** Speed in px/s; armor = flat reduction vs physical & explosive. */
  hp: number; speed: number; armor: number;
  reward: number; leakDamage: number; radius: number;
  /** Damage multiplier per type, 0..1 (0 = immune). */
  resist?: Partial<Record<DamageType, number>>;
  traits: EnemyTrait[];
  onDeath?: { spawn: string; count: number };
  ability?: EnemyAbilityDef;
  /** Texture key. */
  sprite: string;
}

export interface TowerStats {
  range: number; cooldown: number; damage: number; damageType: DamageType;
  pierce: number; projectileSpeed: number; splashRadius: number;
  /** `factor` is the speed multiplier while slowed (0 = frozen, 1 = no slow). */
  slow?: { factor: number; duration: number };
  dot?: { dps: number; duration: number; type: DamageType };
  chain?: { jumps: number; range: number; falloff: number };
  canHitStealth: boolean; canHitFlying: boolean;
  /** Money per cleared wave. */
  income?: number;
  buff?: { range: number; cooldownMul: number; revealStealth: boolean; radius: number };
}

/** Numeric `TowerStats` fields that upgrades may add to or multiply. */
export type NumericStatKey = 'range' | 'cooldown' | 'damage' | 'pierce' | 'projectileSpeed'
  | 'splashRadius' | 'income';

/**
 * Stat changes of one upgrade tier. All `add`s of all bought tiers are applied first, then all
 * `mul`s, then `set` (in tier order), so the result does not depend on purchase order.
 */
export interface StatMods {
  add?: Partial<Record<NumericStatKey, number>>;
  mul?: Partial<Record<NumericStatKey, number>>;
  set?: Partial<TowerStats>;
  /** Free-form switches read by tower behaviours (e.g. a tier-3 signature ability). */
  flags?: string[];
}

export interface UpgradeDef { name: string; description: string; cost: number; mods: StatMods; icon: string }
export interface UpgradePathDef { name: string; tiers: [UpgradeDef, UpgradeDef, UpgradeDef] }

/** How the default projectile behaviour moves its shots. */
export type ProjectileMotion = 'straight' | 'homing' | 'lob';

/** Projectile look and motion for towers that shoot. */
export interface ProjectileSpec {
  /** Projectile kind used for the `proj-<kind>` texture key. */
  kind: string;
  motion: ProjectileMotion;
  /** Retarget radius for homing shots whose target died (default 150). */
  homingRadius?: number;
}

export interface TowerDef {
  id: string; name: string; description: string; category: 'basic' | 'magic' | 'heavy' | 'support';
  /** Collision radius in px. */
  cost: number; footprint: number;
  /** 'path' = trap placed ON the path. */
  placement: 'ground' | 'path';
  /** Key into `TOWER_BEHAVIORS`; defaults to 'projectile'. */
  behavior?: string;
  /** Shot look/motion for projectile-based behaviours (default: straight 'bullet'). */
  projectile?: ProjectileSpec;
  stats: TowerStats;
  /** 2 paths × 3 tiers. Only one path may exceed tier 2. */
  paths: [UpgradePathDef, UpgradePathDef];
  sprite: { base: string; turret?: string };
  unlockWave?: number;
}

export interface MapDef {
  id: string; name: string; theme: 'meadow' | 'desert' | 'snow' | 'volcano' | 'swamp' | 'lab' | 'crystal' | 'city';
  difficulty: 1 | 2 | 3 | 4 | 5; description: string;
  /** ≥1 polylines in play-field px, starting and ending off-screen. */
  paths: Vec2[][];
  /** Default 64. */
  pathWidth: number;
  /** Unbuildable circles (water, rocks). */
  decorSeed: number; blockers?: { x: number; y: number; r: number }[];
  /** Texture key of the generated background. */
  background: string;
}

export interface DifficultyDef {
  id: 'easy' | 'normal' | 'hard' | 'nightmare'; name: string;
  startMoney: number; lives: number; hpMul: number; speedMul: number; rewardMul: number; costMul: number;
  /** Waves to win (then optional freeplay). */
  waves: number;
}
