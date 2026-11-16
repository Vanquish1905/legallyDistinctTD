import type { TowerState } from '../TowerState';
import type { SimContext } from '../SimContext';

/**
 * Pluggable tower logic, selected by `TowerDef.behavior`. Only `update` is required. Per-tower
 * state belongs in `tower.memory` (numbers only, so snapshots stay JSON-safe).
 */
export interface TowerBehavior {
  /** Once, right after the tower was placed (or restored from a save). */
  onPlace?(tower: TowerState, ctx: SimContext): void;
  /**
   * Every tick for every tower before any `update` runs. Support towers set `buffRangeMul` /
   * `buffCooldownMul` on neighbours here (both are reset to 1 at the start of each tick).
   */
  prepare?(tower: TowerState, ctx: SimContext): void;
  /** Every tick: acquire targets, fire, tick cooldowns. */
  update(tower: TowerState, ctx: SimContext, dt: number): void;
  /** When a wave is cleared (income towers pay out here). */
  onWaveCleared?(tower: TowerState, ctx: SimContext, wave: number): void;
  /** When the tower is sold or otherwise removed. */
  onRemove?(tower: TowerState, ctx: SimContext): void;
}
