/** Every non-map texture, in a stable order (the manifest follows it). */
import type { ArtAsset } from './lib/asset';
import { bossAssets } from './sprites/bosses';
import { effectAssets } from './sprites/effects';
import { enemyAssets } from './sprites/enemies';
import { iconAssets } from './sprites/icons';
import { logoAssets } from './sprites/logo';
import { projectileAssets } from './sprites/projectiles';
import { towerAssets } from './towers';

/** All sprite, icon and UI textures (maps are added by the generator when map data exists). */
export function allSpriteAssets(): ArtAsset[] {
  return [...towerAssets(), ...enemyAssets(), ...bossAssets(), ...projectileAssets(), ...effectAssets(), ...iconAssets(), ...logoAssets()];
}
