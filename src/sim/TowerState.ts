import type { NestedStatGroup, NumericStatKey, StatModKey, StatMods, TargetMode, TowerDef, TowerStats } from './types';

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

/** Stat sub-objects (copied on clone, addressable by dotted upgrade keys). */
const NESTED_GROUPS: readonly NestedStatGroup[] = ['slow', 'dot', 'chain', 'buff', 'ramp', 'flight', 'interest'];

function cloneStats(s: TowerStats): TowerStats {
  const out: TowerStats = { ...s };
  const target = out as unknown as Record<string, unknown>;
  for (const g of NESTED_GROUPS) {
    const sub = s[g];
    if (sub) target[g] = { ...sub };
  }
  return out;
}

/** Apply `fn` to one stat; dotted keys reach into a sub-object and are skipped when it is absent. */
function modifyStat(stats: TowerStats, key: StatModKey, fn: (v: number) => number): void {
  const dot = key.indexOf('.');
  if (dot < 0) {
    const k = key as NumericStatKey;
    stats[k] = fn(stats[k] ?? 0);
    return;
  }
  const group = stats[key.slice(0, dot) as NestedStatGroup] as Record<string, unknown> | undefined;
  if (!group) return;
  const field = key.slice(dot + 1);
  const v = group[field];
  group[field] = fn(typeof v === 'number' ? v : 0);
}

/**
 * Stats of `def` with the given tiers bought. All adds apply first, then all multipliers, then
 * sets, so the order the tiers were bought in does not matter. Dotted keys (`'slow.duration'`)
 * modify a field of a sub-object that the base stats already have. Returns the stats and the union of
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
    for (const [k, v] of Object.entries(mods.add ?? {}) as [StatModKey, number][]) modifyStat(stats, k, (x) => x + v);
  }
  for (const mods of bought) {
    for (const [k, v] of Object.entries(mods.mul ?? {}) as [StatModKey, number][]) modifyStat(stats, k, (x) => x * v);
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
