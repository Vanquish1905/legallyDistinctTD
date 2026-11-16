import type { NumericStatKey, StatMods, TargetMode, TowerDef, TowerStats } from './types';

/** Highest tier per upgrade path. */
export const MAX_TIER = 3;

/** Tiers bought on each of the two upgrade paths. */
export type Tiers = [number, number];

/**
 * Whether `path` can go one tier higher: each path goes up to tier 3, but only one path may
 * exceed tier 2 (so 3/2 is the best build).
 */
export function canUpgradePath(tiers: Readonly<Tiers>, path: 0 | 1): boolean {
  const next = tiers[path] + 1;
  if (next > MAX_TIER) return false;
  const other = tiers[path === 0 ? 1 : 0];
  return !(next > 2 && other > 2);
}

function cloneStats(s: TowerStats): TowerStats {
  return {
    ...s,
    slow: s.slow && { ...s.slow },
    dot: s.dot && { ...s.dot },
    chain: s.chain && { ...s.chain },
    buff: s.buff && { ...s.buff },
  };
}

/**
 * Stats of `def` with the given tiers bought. All adds apply first, then all multipliers, then
 * sets, so the order the tiers were bought in does not matter. Returns the stats and the union of
 * all upgrade flags.
 */
export function computeStats(def: TowerDef, tiers: Readonly<Tiers>): { stats: TowerStats; flags: Set<string> } {
  const stats = cloneStats(def.stats);
  const flags = new Set<string>();
  const bought: StatMods[] = [];
  for (const p of [0, 1] as const) {
    const path = def.paths[p];
    for (let t = 0; t < tiers[p] && t < MAX_TIER; t++) {
      const tier = path.tiers[t];
      if (tier) bought.push(tier.mods);
    }
  }
  for (const mods of bought) {
    for (const [k, v] of Object.entries(mods.add ?? {}) as [NumericStatKey, number][]) {
      stats[k] = (stats[k] ?? 0) + v;
    }
  }
  for (const mods of bought) {
    for (const [k, v] of Object.entries(mods.mul ?? {}) as [NumericStatKey, number][]) {
      stats[k] = (stats[k] ?? 0) * v;
    }
  }
  for (const mods of bought) {
    if (mods.set) Object.assign(stats, cloneStats({ ...stats, ...mods.set }));
    for (const f of mods.flags ?? []) flags.add(f);
  }
  return { stats, flags };
}

/** Options for creating a tower. */
export interface TowerInit {
  uid: number;
  def: TowerDef;
  x: number;
  y: number;
  /** Money paid for the tower itself. */
  spent: number;
  /** Wave counter at placement time, or -1 if placed while a wave was running. */
  placedBuildWave: number;
  tiers?: Tiers;
}

/** Live state of one placed tower. */
export class TowerState {
  readonly uid: number;
  readonly def: TowerDef;
  readonly x: number;
  readonly y: number;
  /** Turret heading in radians. */
  angle = -Math.PI / 2;
  tiers: Tiers;
  stats: TowerStats;
  flags: Set<string>;
  /** Total money spent (tower + upgrades), basis for the sell value. */
  spent: number;
  /** See `TowerInit.placedBuildWave`. */
  placedBuildWave: number;
  targetMode: TargetMode = 'first';
  /** Seconds until the next shot may fire (<= 0 = ready). */
  cooldownLeft = 0;
  /** Uid of the current target, or -1. */
  targetUid = -1;
  kills = 0;
  damageDealt = 0;
  /** Range multiplier from support buffs (reset each tick). */
  buffRangeMul = 1;
  /** Cooldown multiplier from support buffs (reset each tick). */
  buffCooldownMul = 1;
  /** Free numeric state for behaviours (beam ramp, heli position, ...). Kept JSON-safe. */
  readonly memory: Record<string, number> = {};

  constructor(o: TowerInit) {
    this.uid = o.uid;
    this.def = o.def;
    this.x = o.x;
    this.y = o.y;
    this.spent = o.spent;
    this.placedBuildWave = o.placedBuildWave;
    this.tiers = o.tiers ? [o.tiers[0], o.tiers[1]] : [0, 0];
    const { stats, flags } = computeStats(o.def, this.tiers);
    this.stats = stats;
    this.flags = flags;
  }

  /** Behaviour key, defaulting to 'projectile'. */
  get behavior(): string {
    return this.def.behavior ?? 'projectile';
  }

  /** Range including support buffs. */
  get range(): number {
    return this.stats.range * this.buffRangeMul;
  }

  /** Cooldown including support buffs. */
  get cooldown(): number {
    return this.stats.cooldown * this.buffCooldownMul;
  }

  /** Raise one path by a tier and recompute stats. Caller checks `canUpgradePath` and pays. */
  applyUpgrade(path: 0 | 1, cost: number): void {
    this.tiers[path] += 1;
    this.spent += cost;
    const { stats, flags } = computeStats(this.def, this.tiers);
    this.stats = stats;
    this.flags = flags;
  }
}
