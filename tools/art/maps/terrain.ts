/** Ground layer: base colour, soft noise patches, fine grain and vignette. */
import { darken, lighten } from '../lib/color';
import type { Rng } from '../lib/rng';
import { blob } from '../lib/shapes';
import { el, g, type SvgDoc } from '../lib/svg';
import type { ThemePalette } from './theme';
import { MAP_H, MAP_W } from './types';

function grainTile(doc: SvgDoc, rng: Rng, p: ThemePalette): string {
  const size = 96;
  const marks: string[] = [];
  const [dark, light] = p.grain;
  if (p.grainKind === 'tiles') {
    marks.push(el('rect', { width: size, height: size, fill: 'none', stroke: dark, 'stroke-width': 3 }));
    marks.push(el('rect', { x: 2, y: 2, width: size - 4, height: size - 4, fill: 'none', stroke: light, 'stroke-width': 1, opacity: 0.5 }));
    marks.push(el('line', { x1: size / 2, y1: 0, x2: size / 2, y2: size, stroke: dark, 'stroke-width': 1.5, opacity: 0.6 }));
    marks.push(el('line', { x1: 0, y1: size / 2, x2: size, y2: size / 2, stroke: dark, 'stroke-width': 1.5, opacity: 0.6 }));
    for (let i = 0; i < 6; i++) marks.push(el('circle', { cx: rng.range(4, size - 4), cy: rng.range(4, size - 4), r: rng.range(0.8, 1.8), fill: light, opacity: 0.35 }));
  } else {
    for (let i = 0; i < 26; i++) {
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      const c = rng.next() < 0.5 ? dark : light;
      if (p.grainKind === 'blades') {
        const h = rng.range(4, 8);
        const lean = rng.range(-2.5, 2.5);
        marks.push(el('path', { d: `M${x},${y} q${lean / 2},${-h / 2} ${lean},${-h}`, stroke: c, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round', opacity: 0.55 }));
      } else if (p.grainKind === 'cracks') {
        const a = rng.range(0, Math.PI);
        const l = rng.range(4, 12);
        marks.push(el('line', { x1: x, y1: y, x2: x + Math.cos(a) * l, y2: y + Math.sin(a) * l, stroke: c, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.5 }));
      } else {
        marks.push(el('circle', { cx: x, cy: y, r: rng.range(0.8, 2), fill: c, opacity: 0.5 }));
      }
    }
  }
  return doc.pattern(size, size, marks.join(''));
}

/** Full-bleed ground with organic tonal variation. `detail` false skips fine grain (thumbnails). */
export function terrain(doc: SvgDoc, rng: Rng, p: ThemePalette, detail: boolean): string {
  const parts = [el('rect', { width: MAP_W, height: MAP_H, fill: p.ground })];
  const big: string[] = [];
  for (let i = 0; i < 34; i++) {
    const c = rng.pick(p.patches);
    big.push(el('path', { d: blob(rng, rng.range(-80, MAP_W + 80), rng.range(-80, MAP_H + 80), rng.range(110, 260), 0.35, 9, rng.range(0.8, 1.5), 1), fill: c, opacity: rng.range(0.45, 0.85) }));
  }
  parts.push(g({ filter: doc.blur(38) }, big));
  const mid: string[] = [];
  for (let i = 0; i < 70; i++) {
    const c = rng.pick(p.patches);
    mid.push(el('path', { d: blob(rng, rng.range(0, MAP_W), rng.range(0, MAP_H), rng.range(24, 70), 0.4, 7, rng.range(0.8, 1.8), 1), fill: c, opacity: rng.range(0.25, 0.5) }));
  }
  parts.push(g({ filter: doc.blur(8) }, mid));
  if (detail) {
    parts.push(el('rect', { width: MAP_W, height: MAP_H, fill: grainTile(doc, rng, p), opacity: 0.9 }));
  }
  return parts.join('');
}

/** Darkened edges to frame the field. */
export function vignette(doc: SvgDoc, p: ThemePalette): string {
  const paint = doc.radial(
    [
      [0, '#000000', 0],
      [0.62, '#000000', 0],
      [1, darken(p.ground, 0.9), p.vignette],
    ],
    0.5,
    0.5,
    0.75,
  );
  return el('rect', { width: MAP_W, height: MAP_H, fill: paint });
}

/** Soft top-left light wash to give the field a sense of direction. */
export function lightWash(doc: SvgDoc, p: ThemePalette): string {
  const paint = doc.radial([[0, lighten(p.ground, 0.6), 0.16], [1, '#ffffff', 0]], 0.2, 0.15, 0.7);
  return el('rect', { width: MAP_W, height: MAP_H, fill: paint });
}
