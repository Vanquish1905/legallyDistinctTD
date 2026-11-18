/**
 * Draw order of the game world, back to front. Objects inside a layer may add a tiny
 * y-based fraction so lower things overlap higher ones.
 */
export const DEPTH = {
  map: 0,
  decal: 5,
  trap: 10,
  enemyShadow: 18,
  enemy: 20,
  towerBase: 30,
  towerTurret: 31,
  flyingShadow: 38,
  flying: 40,
  heliBody: 42,
  heliRotor: 43,
  projectile: 50,
  fx: 60,
  beam: 62,
  healthBar: 65,
  range: 70,
  ghost: 72,
  floatingText: 80,
  ui: 100,
} as const;

/** Fraction added per px of y so objects lower on screen draw in front within a layer. */
export const Y_SORT = 1e-5;
