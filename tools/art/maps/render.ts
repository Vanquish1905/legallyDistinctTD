/** Map background and thumbnail composition. */
import type { ArtAsset } from '../lib/asset';
import { Rng } from '../lib/rng';
import { SvgDoc } from '../lib/svg';
import { DECOR } from './decor';
import { place } from './placement';
import { roads } from './road';
import { lightWash, terrain, vignette } from './terrain';
import { THEME_PALETTES } from './theme';
import { MAP_H, MAP_W, THUMB_H, THUMB_W, type MapArtInput } from './types';
import { blockers } from './water';

function compose(doc: SvgDoc, map: MapArtInput, detail: boolean): string {
  const p = THEME_PALETTES[map.theme];
  const decor = DECOR[map.theme];
  const rng = new Rng(map.decorSeed);
  const placeRng = new Rng(map.decorSeed * 7919 + 17);
  const large = place(placeRng, map, decor.large, decor.largeCount, [], 1.05).sort((a, b) => a.y - b.y);
  const small = detail ? place(placeRng, map, decor.small, decor.smallCount, large, 0.8) : [];
  const largeRng = new Rng(map.decorSeed ^ 0x5bd1e995);
  const smallRng = new Rng(map.decorSeed ^ 0x27d4eb2f);
  const out = [terrain(doc, rng, p, detail)];
  for (const d of small) out.push(d.kind.draw(doc, smallRng, d.x, d.y, d.s));
  out.push(blockers(doc, rng, p, map.theme, map.blockers ?? []));
  out.push(roads(doc, rng, p, map.paths, map.pathWidth, detail));
  for (const d of large) out.push(d.kind.draw(doc, largeRng, d.x, d.y, d.s));
  out.push(lightWash(doc, p), vignette(doc, p));
  return out.join('');
}

/** Full 1540x1080 play-field background as an SVG string. */
export function renderMapBackground(map: MapArtInput): string {
  const doc = new SvgDoc(MAP_W, MAP_H, `map-${map.id}`);
  return doc.render(compose(doc, map, true));
}

/** 384x216 preview: same scene without fine detail, cropped vertically to 16:9. */
export function renderMapThumbnail(map: MapArtInput): string {
  const doc = new SvgDoc(THUMB_W, THUMB_H, `thumb-${map.id}`);
  const viewH = (MAP_W * THUMB_H) / THUMB_W;
  return doc.render(compose(doc, map, false), `0 ${(MAP_H - viewH) / 2} ${MAP_W} ${viewH}`);
}

/** Background + thumbnail texture entries for one map. */
export function mapAssets(map: MapArtInput): ArtAsset[] {
  return [
    { key: `map-${map.id}`, dir: 'maps', width: MAP_W, height: MAP_H, render: () => renderMapBackground(map) },
    { key: `thumb-${map.id}`, dir: 'maps', width: THUMB_W, height: THUMB_H, render: () => renderMapThumbnail(map) },
  ];
}
