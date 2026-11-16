/** Tower base renderers. Most use the shared housing; a few machines get bespoke platforms. */
import { darken } from '../lib/color';
import { CATEGORY_COLOR, METAL, OUTLINE, UI } from '../lib/palette';
import { bolt, gloss, roundRect } from '../lib/shapes';
import { el, g, ol, type SvgDoc } from '../lib/svg';
import { C, groundShadow, housing } from './kit';

/** Base renderer returns the full body of the 128x128 base texture. */
export type BaseFn = (doc: SvgDoc) => string;

/** Yellow/black warning stripes paint. */
export function hazard(doc: SvgDoc, size = 10): string {
  return doc.pattern(
    size,
    size,
    el('rect', { width: size, height: size, fill: '#f5b81c' }) + el('rect', { width: size / 2, height: size, fill: '#1f2430' }),
    { patternTransform: 'rotate(45)' },
  );
}

export const spikesBase: BaseFn = (doc) => {
  const parts = [el('path', { d: roundRect(14, 18, 102, 102, 14), fill: '#000000', opacity: 0.35, filter: doc.blur(3) })];
  parts.push(el('path', { d: roundRect(12, 16, 104, 104, 14), fill: darken(METAL.dark, 0.3), ...ol() }));
  parts.push(el('path', { d: roundRect(12, 12, 104, 104, 14), fill: hazard(doc, 12), ...ol() }));
  parts.push(el('path', { d: roundRect(22, 22, 84, 84, 8), fill: doc.shade(METAL.mid, 0.25), ...ol(2.5) }));
  for (let gx = -1; gx <= 1; gx++) {
    for (let gy = -1; gy <= 1; gy++) {
      parts.push(el('circle', { cx: C + gx * 24, cy: C + gy * 24, r: 9, fill: '#141821', stroke: '#ffffff', 'stroke-opacity': 0.25, 'stroke-width': 1.5 }));
    }
  }
  for (const [x, y] of [[28, 28], [100, 28], [28, 100], [100, 100]] as const) parts.push(bolt(x, y));
  return parts.join('');
};

export const heliBase: BaseFn = (doc) => {
  const parts = [groundShadow(doc, 54, 44, 74)];
  parts.push(el('circle', { cx: C, cy: C + 6, r: 54, fill: darken('#3a4150', 0.4), ...ol() }));
  parts.push(el('circle', { cx: C, cy: C, r: 54, fill: doc.shade('#3d4554', 0.2), ...ol() }));
  parts.push(el('circle', { cx: C, cy: C, r: 45, fill: 'none', stroke: '#f5b81c', 'stroke-width': 4.5 }));
  parts.push(el('circle', { cx: C, cy: C, r: 45, fill: 'none', stroke: OUTLINE, 'stroke-width': 1, 'stroke-dasharray': '10 6' }));
  const h = 'M46,40 h9 v19 h18 v-19 h9 v48 h-9 v-20 h-18 v20 h-9 Z';
  parts.push(el('path', { d: h, fill: '#f1f5f9', ...ol(2.5) }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = C + Math.cos(a) * 50;
    const y = C + Math.sin(a) * 50;
    parts.push(el('circle', { cx: x, cy: y, r: 4, fill: i % 2 ? '#34d399' : '#f43f5e', opacity: 0.45, filter: doc.blur(1.5) }));
    parts.push(el('circle', { cx: x, cy: y, r: 2.2, fill: i % 2 ? '#a7f3d0' : '#fecdd3', stroke: OUTLINE, 'stroke-width': 1 }));
  }
  return parts.join('');
};

export const coinfactoryBase: BaseFn = (doc) => {
  const parts = [el('path', { d: roundRect(14, 22, 104, 100, 12), fill: '#000000', opacity: 0.38, filter: doc.blur(3.5) })];
  // front wall (3/4 view)
  parts.push(el('path', { d: roundRect(14, 30, 100, 88, 10), fill: doc.shade('#8a4b2c', 0.25), ...ol() }));
  for (const x of [26, 52, 78]) parts.push(el('rect', { x, y: 104, width: 14, height: 9, rx: 2, fill: '#fde68a', stroke: OUTLINE, 'stroke-width': 2 }));
  parts.push(el('rect', { x: 92, y: 100, width: 14, height: 18, rx: 2, fill: '#5b3420', stroke: OUTLINE, 'stroke-width': 2 }));
  // roof
  parts.push(el('path', { d: roundRect(14, 12, 100, 90, 10), fill: doc.shade('#b8693c', 0.3), ...ol() }));
  for (let y = 20; y < 98; y += 10) parts.push(el('line', { x1: 20, y1: y, x2: 108, y2: y, stroke: darken('#b8693c', 0.3), 'stroke-width': 1.4, opacity: 0.6 }));
  parts.push(el('path', { d: roundRect(14, 12, 100, 10, 6), fill: UI.gold, ...ol(2) }));
  // chimney
  parts.push(el('rect', { x: 18, y: 18, width: 22, height: 22, rx: 4, fill: doc.shade('#6b7280'), ...ol(2.5) }));
  parts.push(el('rect', { x: 22, y: 22, width: 14, height: 14, rx: 3, fill: '#111318' }));
  parts.push(el('circle', { cx: 29, cy: 29, r: 9, fill: '#9ca3af', opacity: 0.35, filter: doc.blur(3) }));
  // gear socket
  parts.push(el('circle', { cx: C, cy: C, r: 29, fill: '#2a1a12', ...ol(2.5) }));
  parts.push(el('circle', { cx: C, cy: C, r: 29, fill: 'none', stroke: CATEGORY_COLOR.support, 'stroke-width': 3, opacity: 0.85 }));
  parts.push(bolt(104, 22), bolt(104, 92));
  return parts.join('');
};

export const mortarBase: BaseFn = (doc) => {
  const parts = [housing(doc, 'round', CATEGORY_COLOR.heavy, '#6b6f5e', 42)];
  const bags: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (i === 0) continue; // opening toward +x for the crew
    const a = (i / 12) * Math.PI * 2;
    const x = C + Math.cos(a) * 49;
    const y = C + 4 + Math.sin(a) * 47;
    bags.push(
      el('rect', {
        x: x - 9,
        y: y - 6,
        width: 18,
        height: 12,
        rx: 6,
        fill: doc.shade('#c8b48a', 0.3),
        ...ol(2.2),
        transform: `rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`,
      }),
    );
  }
  return parts.join('') + g({}, bags);
};

export const pulseBase: BaseFn = (doc) => {
  const parts = [housing(doc, 'round', CATEGORY_COLOR.magic, '#4d5d7a')];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push(el('circle', { cx: C + Math.cos(a) * 41, cy: C + Math.sin(a) * 41, r: 4, fill: '#22d3ee', opacity: 0.9, stroke: OUTLINE, 'stroke-width': 1.5 }));
  }
  return parts.join('');
};

export const teslaBase: BaseFn = (doc) => {
  const parts = [housing(doc, 'oct', CATEGORY_COLOR.magic, '#57607a')];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
    const x = C + Math.cos(a) * 40;
    const y = C + Math.sin(a) * 40;
    parts.push(el('rect', { x: x - 4, y: y - 7, width: 8, height: 14, rx: 3, fill: doc.shade('#e8e0cf'), ...ol(1.8) }));
    parts.push(el('rect', { x: x - 4, y: y - 2, width: 8, height: 2, fill: '#8b7355' }));
  }
  return parts.join('');
};

export const radarBase: BaseFn = (doc) => {
  const parts = [housing(doc, 'round', CATEGORY_COLOR.support, '#5d7268')];
  parts.push(el('circle', { cx: C, cy: C, r: 41, fill: 'none', stroke: '#34d399', 'stroke-width': 1.2, 'stroke-dasharray': '3 5', opacity: 0.8 }));
  parts.push(gloss(44, 34, 10, 3, 0.25));
  return parts.join('');
};
