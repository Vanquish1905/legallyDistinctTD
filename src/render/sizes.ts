/**
 * How big sprites are drawn relative to their sim size. Textures are authored at a fixed
 * canvas size; these factors were tuned by eye against the 1540×1080 play field.
 */

/** Housing radius inside the 128 px tower canvas. */
const TOWER_ART_RADIUS = 46;
/** A tower's drawn housing radius relative to its footprint. */
const TOWER_VISUAL = 1.12;

/** Scale of tower textures (base, turret) for a footprint in px. */
export function towerScale(footprint: number): number {
  return (footprint * TOWER_VISUAL) / TOWER_ART_RADIUS;
}

/** Drawn creature diameter relative to the canvas, per sim radius px. */
const ENEMY_VISUAL = 3.1;

/** Scale of an enemy texture of width `textureSize` for a sim radius. */
export function enemyScale(radius: number, textureSize: number): number {
  return (radius * ENEMY_VISUAL) / textureSize;
}
