import type { TowerDef, TowerStats } from './types';
import { MAX_TIER, canUpgradePath, computeStats, type Tiers } from './TowerState';
import { scaledCost } from './Economy';

/** Why an upgrade cannot be bought. */
export type UpgradeBlock = 'maxed' | 'locked' | 'money';

/** Result of `canUpgrade`; `cost` is the scaled price of the next tier (null when maxed/locked). */
export type UpgradeCheck = { ok: true; cost: number } | { ok: false; reason: UpgradeBlock; cost: number | null };

/** Stats of `def` with `tiers` bought (pure; for tooltips and previews). */
export function towerStatsAt(def: TowerDef, tiers: Readonly<Tiers>): TowerStats {
  return computeStats(def, tiers).stats;
}

/** Base price of tier `tier` (1..3) on `path`, scaled by `costMul`. Null for tiers that do not exist. */
export function upgradeCost(def: TowerDef, path: 0 | 1, tier: number, costMul = 1): number | null {
  const t = def.paths[path].tiers[tier - 1];
  return t ? scaledCost(t.cost, costMul) : null;
}

/** Whether `tower` can buy the next tier on `path` with `money` (3/2 rule, then price). */
export function canUpgrade(
  tower: { def: TowerDef; tiers: Readonly<Tiers> }, path: 0 | 1, money = Infinity, costMul = 1,
): UpgradeCheck {
  if (tower.tiers[path] >= MAX_TIER) return { ok: false, reason: 'maxed', cost: null };
  if (!canUpgradePath(tower.tiers, path)) return { ok: false, reason: 'locked', cost: null };
  const cost = upgradeCost(tower.def, path, tower.tiers[path] + 1, costMul) ?? 0;
  return cost <= money ? { ok: true, cost } : { ok: false, reason: 'money', cost };
}
