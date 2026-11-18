import type Phaser from 'phaser';
import { DEPTH } from './layers';

/** Layer depths (scene depth of each Phaser Layer). */
const LAYER_DEPTH = {
  decal: DEPTH.decal,
  ground: DEPTH.decal + 1,
  enemy: DEPTH.enemy,
  flyingShadow: DEPTH.flyingShadow,
  flying: DEPTH.flying,
  projectileShadow: DEPTH.projectile - 2,
  trail: DEPTH.projectile - 1,
  projectile: DEPTH.projectile,
  fx: DEPTH.fx,
  fxTop: DEPTH.fx + 1,
} as const;

export type LayerName = keyof typeof LAYER_DEPTH;

/**
 * Phaser Layers for the busy, pooled world objects. A depth change re-sorts only the list that
 * holds the object, so y-sorting enemies or spawning particles never re-sorts the whole scene.
 * Objects inside a layer keep a constant depth except enemies (coarse y-sort).
 */
export class WorldLayers {
  private readonly layers: Record<LayerName, Phaser.GameObjects.Layer>;

  constructor(scene: Phaser.Scene) {
    const out = {} as Record<LayerName, Phaser.GameObjects.Layer>;
    for (const name of Object.keys(LAYER_DEPTH) as LayerName[]) {
      out[name] = scene.add.layer().setDepth(LAYER_DEPTH[name]);
    }
    this.layers = out;
  }

  /** Move `obj` into layer `name` (no-op when it is already there) and return it. */
  put<T extends Phaser.GameObjects.GameObject>(name: LayerName, obj: T): T {
    const layer = this.layers[name];
    if (obj.displayList !== layer) layer.add(obj);
    return obj;
  }
}
