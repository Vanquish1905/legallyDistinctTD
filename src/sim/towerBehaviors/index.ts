import type { TowerBehavior } from './types';
import { createProjectileBehavior } from './projectile';

/** Placeholder for behaviours whose logic is not written yet: the tower stays idle. */
const idle: TowerBehavior = { update() {} };

/**
 * All tower behaviours, keyed by `TowerDef.behavior`. 'projectile' is the default shooter;
 * 'lob' is the same loop with arcing shells.
 */
export const TOWER_BEHAVIORS: Record<string, TowerBehavior> = {
  projectile: createProjectileBehavior(),
  lob: createProjectileBehavior('lob'),
  beam: idle,
  chain: idle,
  aura: idle,
  trap: idle,
  income: idle,
  support: idle,
  heli: idle,
  line: idle,
  boomerang: idle,
};
