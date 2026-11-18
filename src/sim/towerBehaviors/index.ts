import type { TowerBehavior } from './types';
import { createProjectileBehavior } from './projectile';
import { auraBehavior } from './aura';
import { beamBehavior } from './beam';
import { chainBehavior } from './chain';
import { incomeBehavior } from './income';
import { supportBehavior } from './support';
import { trapBehavior } from './trap';
import { heliBehavior } from './heli';
import { lineBehavior } from './line';

const shooter = createProjectileBehavior();

/**
 * All tower behaviours, keyed by `TowerDef.behavior`. 'projectile' is the default shooter;
 * 'lob' arcs shells and 'boomerang' throws out-and-back shots; 'heli' flies a helicopter unit
 * that shoots from where it is; 'line' fires instant piercing rail lines.
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
  heli: heliBehavior,
  line: lineBehavior,
};
