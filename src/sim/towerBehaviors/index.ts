import type { TowerBehavior } from './types';
import { createProjectileBehavior } from './projectile';
import { auraBehavior } from './aura';
import { beamBehavior } from './beam';
import { chainBehavior } from './chain';
import { incomeBehavior } from './income';
import { supportBehavior } from './support';
import { trapBehavior } from './trap';

const shooter = createProjectileBehavior();

/**
 * All tower behaviours, keyed by `TowerDef.behavior`. 'projectile' is the default shooter;
 * 'lob' arcs shells and 'boomerang' throws out-and-back shots. 'heli' and 'line' currently use the
 * plain projectile loop (the helicopter fires from its pad, the rail fires a fast piercing slug).
 */
export const TOWER_BEHAVIORS: Record<string, TowerBehavior> = {
  projectile: shooter,
  lob: createProjectileBehavior('lob'),
  boomerang: createProjectileBehavior('boomerang'),
  beam: beamBehavior,
  chain: chainBehavior,
  aura: auraBehavior,
  trap: trapBehavior,
  income: incomeBehavior,
  support: supportBehavior,
  heli: shooter,
  line: shooter,
};
