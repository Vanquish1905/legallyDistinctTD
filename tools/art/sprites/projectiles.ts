/** Projectile sprites (facing +x, centred) and their canvas sizes. */
import type { ArtAsset } from '../lib/asset';
import { OUTLINE } from '../lib/palette';
import { gloss, starPts } from '../lib/shapes';
import { el, g, SvgDoc } from '../lib/svg';
import { sawBlade } from '../towers/turretsB';

interface ProjArt {
  kind: string;
  w: number;
  h: number;
  /** Draws around (0,0). */
  draw(doc: SvgDoc): string[];
}

const trail = (doc: SvgDoc, x0: number, x1: number, h: number, color: string) =>
  el('path', { d: `M${x1},${-h / 2} L${x0},0 L${x1},${h / 2} Z`, fill: doc.linear([[0, color, 0], [1, color, 0.8]], 0, 0, 1, 0) });

const PROJECTILES: ProjArt[] = [
  {
    kind: 'bullet', w: 28, h: 14,
    draw: (doc) => [trail(doc, -13, -2, 6, '#fde68a'), el('path', { d: 'M-4,-3.5 L5,-3.5 Q10,0 5,3.5 L-4,3.5 Z', fill: doc.shade('#fbbf24', 0.35), stroke: OUTLINE, 'stroke-width': 1.6 })],
  },
  {
    kind: 'dart', w: 36, h: 14,
    draw: (doc) => [
      trail(doc, -17, -6, 6, '#7dd3fc'),
      el('path', { d: 'M-12,-1.5 L8,-1.5 L8,1.5 L-12,1.5 Z', fill: '#94a3b8', stroke: OUTLINE, 'stroke-width': 1.2 }),
      el('path', { d: 'M6,-3.5 L15,0 L6,3.5 Z', fill: doc.shade('#38bdf8'), stroke: OUTLINE, 'stroke-width': 1.4 }),
      el('path', { d: 'M-12,-1 L-15,-5 L-8,-1.5 M-12,1 L-15,5 L-8,1.5', fill: '#f43f5e', stroke: OUTLINE, 'stroke-width': 1 }),
    ],
  },
  {
    kind: 'sniper', w: 48, h: 12,
    draw: (doc) => [el('rect', { x: -23, y: -1.5, width: 34, height: 3, rx: 1.5, fill: doc.linear([[0, '#ffffff', 0], [1, '#fef3c7', 0.9]], 0, 0, 1, 0) }), el('path', { d: 'M8,-2.5 L16,-2.5 Q21,0 16,2.5 L8,2.5 Z', fill: doc.shade('#e5e7eb'), stroke: OUTLINE, 'stroke-width': 1.4 })],
  },
  {
    kind: 'rocket', w: 52, h: 22,
    draw: (doc) => [
      el('ellipse', { cx: -18, cy: 0, rx: 8, ry: 5, fill: '#fb923c', opacity: 0.9, filter: doc.blur(1.6) }),
      el('ellipse', { cx: -16, cy: 0, rx: 4, ry: 2.6, fill: '#fef08a' }),
      el('path', { d: 'M-12,-5 L-17,-9 L-8,-5 Z M-12,5 L-17,9 L-8,5 Z', fill: '#475569', stroke: OUTLINE, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
      el('rect', { x: -13, y: -5, width: 24, height: 10, rx: 3, fill: doc.shade('#e5e7eb', 0.35), stroke: OUTLINE, 'stroke-width': 1.8 }),
      el('path', { d: 'M10,-5 Q22,0 10,5 Z', fill: doc.shade('#ef4444'), stroke: OUTLINE, 'stroke-width': 1.8 }),
      el('rect', { x: -4, y: -5, width: 3, height: 10, fill: '#ef4444' }),
    ],
  },
  {
    kind: 'missile', w: 44, h: 20,
    draw: (doc) => [
      el('ellipse', { cx: -15, cy: 0, rx: 6, ry: 4, fill: '#e879f9', opacity: 0.85, filter: doc.blur(1.6) }),
      el('rect', { x: -11, y: -4, width: 20, height: 8, rx: 4, fill: doc.shade('#f1f5f9'), stroke: OUTLINE, 'stroke-width': 1.6 }),
      el('path', { d: 'M8,-4 Q17,0 8,4 Z', fill: doc.shade('#c04fd8'), stroke: OUTLINE, 'stroke-width': 1.6 }),
      el('path', { d: 'M-9,-4 L-12,-8 L-5,-4 Z M-9,4 L-12,8 L-5,4 Z', fill: '#c04fd8', stroke: OUTLINE, 'stroke-width': 1.2 }),
    ],
  },
  {
    kind: 'mortar', w: 28, h: 28,
    draw: (doc) => [el('circle', { cx: 0, cy: 0, r: 10, fill: doc.sphere('#4b5563', 0.5), stroke: OUTLINE, 'stroke-width': 2 }), el('rect', { x: -3, y: -12, width: 6, height: 5, rx: 1, fill: '#a16207', stroke: OUTLINE, 'stroke-width': 1.4 }), gloss(-3, -4, 4, 2, 0.6)],
  },
  {
    kind: 'frost', w: 32, h: 32,
    draw: (doc) => [
      el('circle', { cx: 0, cy: 0, r: 13, fill: '#7dd3fc', opacity: 0.5, filter: doc.blur(3) }),
      el('polygon', { points: starPts(0, 0, 11, 5, 6, 0), fill: doc.sphere('#e0f2fe', 0.3), stroke: '#0c4a6e', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
      el('circle', { cx: 0, cy: 0, r: 3, fill: '#ffffff' }),
    ],
  },
  {
    kind: 'flame', w: 40, h: 40,
    draw: (doc) => [
      el('circle', { cx: 0, cy: 0, r: 16, fill: '#f97316', opacity: 0.45, filter: doc.blur(4) }),
      el('path', { d: 'M12,0 C6,-12 -8,-14 -14,-4 C-10,-6 -10,0 -16,4 C-8,12 8,10 12,0 Z', fill: doc.radial([[0, '#fef9c3'], [0.45, '#fbbf24'], [1, '#ea580c']], 0.6, 0.5, 0.7), stroke: '#9a3412', 'stroke-width': 1.4 }),
    ],
  },
  {
    kind: 'toxin', w: 28, h: 28,
    draw: (doc) => [
      el('circle', { cx: 0, cy: 0, r: 11, fill: '#84cc16', opacity: 0.45, filter: doc.blur(3) }),
      el('path', { d: 'M9,0 C9,-6 2,-8 -2,-7 C-8,-6 -10,0 -8,4 C-6,8 4,8 9,0 Z', fill: doc.sphere('#a3e635', 0.45), stroke: '#365314', 'stroke-width': 1.6 }),
      el('circle', { cx: -9, cy: -6, r: 2, fill: '#a3e635', stroke: '#365314', 'stroke-width': 1 }),
      gloss(1, -3, 3, 1.5, 0.7),
    ],
  },
  { kind: 'saw', w: 48, h: 48, draw: (doc) => [sawBlade(doc, 0, 0, 20, '#dbe3ee', 14)] },
  {
    kind: 'spike', w: 24, h: 24,
    draw: (doc) => [el('polygon', { points: '-8,-6 10,0 -8,6 -4,0', fill: doc.shade('#cbd5e1'), stroke: OUTLINE, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })],
  },
  {
    kind: 'rail', w: 72, h: 18,
    draw: (doc) => [
      el('rect', { x: -34, y: -6, width: 68, height: 12, rx: 6, fill: '#3b82f6', opacity: 0.55, filter: doc.blur(2.5) }),
      el('rect', { x: -34, y: -2.5, width: 68, height: 5, rx: 2.5, fill: doc.linear([[0, '#93c5fd', 0], [0.6, '#dbeafe'], [1, '#ffffff']], 0, 0, 1, 0) }),
    ],
  },
  {
    kind: 'bomb', w: 32, h: 32,
    draw: (doc) => [
      el('circle', { cx: -1, cy: 1, r: 10, fill: doc.sphere('#334155', 0.5), stroke: OUTLINE, 'stroke-width': 2 }),
      el('rect', { x: 5, y: -10, width: 6, height: 5, rx: 1, fill: '#64748b', stroke: OUTLINE, 'stroke-width': 1.4, transform: 'rotate(40 8 -7)' }),
      el('path', { d: 'M10,-9 q4,-4 2,-6', fill: 'none', stroke: '#a16207', 'stroke-width': 1.6 }),
      el('circle', { cx: 12, cy: -15, r: 2.6, fill: '#fde047', filter: doc.blur(0.8) }),
      gloss(-4, -3, 4, 2, 0.5),
    ],
  },
];

/** Projectile textures (`proj-<kind>`). */
export function projectileAssets(): ArtAsset[] {
  return PROJECTILES.map((p) => {
    const key = `proj-${p.kind}`;
    return {
      key,
      dir: 'projectiles',
      width: p.w,
      height: p.h,
      render: () => {
        const doc = new SvgDoc(p.w, p.h, key);
        return doc.render(g({ transform: `translate(${p.w / 2} ${p.h / 2})` }, p.draw(doc)));
      },
    };
  });
}
