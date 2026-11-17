import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_MANIFEST } from '../../src/data/artManifest';
import { SPRITE_ART, artEntries } from '../../src/data/loadArt';
import { MAPS } from '../../src/data/maps';

const PUBLIC = join(__dirname, '../../public');

describe('art manifest', () => {
  it('points every entry at a file that exists', () => {
    const missing = ART_MANIFEST.filter((e) => !existsSync(join(PUBLIC, e.path))).map((e) => e.path);
    expect(missing).toEqual([]);
  });

  it('ships map backgrounds and thumbnails as pre-rendered images, not SVG', () => {
    for (const map of MAPS) {
      const [bg, thumb] = artEntries([map.background, `thumb-${map.id}`]);
      expect(bg?.format).toBe('image');
      expect(thumb?.format).toBe('image');
    }
  });

  it('keeps map images out of the boot sprite set', () => {
    expect(SPRITE_ART.some((e) => e.key.startsWith('map-') || e.key.startsWith('thumb-'))).toBe(false);
    expect(SPRITE_ART.length).toBe(ART_MANIFEST.length - MAPS.length * 2);
  });

  it('rejects unknown texture keys', () => {
    expect(() => artEntries(['map-does-not-exist'])).toThrow(/Unknown texture key/);
  });
});
