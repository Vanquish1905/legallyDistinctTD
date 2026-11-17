import type Phaser from 'phaser';
import { ART_MANIFEST, type ArtManifestEntry } from './artManifest';

const isMapImage = (e: ArtManifestEntry): boolean => e.key.startsWith('map-') || e.key.startsWith('thumb-');

/** Every sprite, icon and UI texture (everything except map backgrounds and thumbnails). */
export const SPRITE_ART: readonly ArtManifestEntry[] = ART_MANIFEST.filter((e) => !isMapImage(e));

/** Manifest entries for the given texture keys; throws on unknown keys so typos fail loudly. */
export function artEntries(keys: readonly string[]): ArtManifestEntry[] {
  return keys.map((key) => {
    const entry = ART_MANIFEST.find((e) => e.key === key);
    if (!entry) throw new Error(`Unknown texture key: ${key}`);
    return entry;
  });
}

/**
 * Queues textures on a Phaser loader, skipping ones already in the texture cache.
 * Map images are loaded on demand rather than at boot to keep memory low on phones.
 */
export function loadArt(
  load: Phaser.Loader.LoaderPlugin,
  textures: Phaser.Textures.TextureManager,
  entries: readonly ArtManifestEntry[],
): void {
  for (const e of entries) {
    if (textures.exists(e.key)) continue;
    if (e.format === 'svg') load.svg(e.key, e.path, { width: e.width, height: e.height });
    else load.image(e.key, e.path);
  }
}
