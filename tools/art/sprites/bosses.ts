/** The five bosses (192x192, facing +x). Drawn in a 96-unit space and scaled 2x. */
import { darken, lighten } from '../lib/color';
import type { ArtAsset } from '../lib/asset';
import { OUTLINE, UI } from '../lib/palette';
import { Rng } from '../lib/rng';
import { blob, gloss, starPts } from '../lib/shapes';
import { el, g, SvgDoc } from '../lib/svg';
import { creature, eyes, glowEyes, legs, mandibles, seg } from './creature';

type Draw = (doc: SvgDoc) => string[];

/** Top-down crown: a gold ring of points with a gem. */
function crown(doc: SvgDoc, x: number, y: number): string {
  return [
    el('polygon', { points: starPts(x, y, 10, 6.5, 5, Math.PI), fill: doc.shade(UI.gold, 0.35), stroke: OUTLINE, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
    el('circle', { cx: x, cy: y, r: 3, fill: doc.sphere('#f43f5e', 0.5), stroke: OUTLINE, 'stroke-width': 1 }),
  ].join('');
}

const queen: Draw = (doc) => {
  const c = '#d68fd6';
  const p: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i - 3) * 0.32;
    p.push(el('circle', { cx: -30 + Math.cos(a) * 15, cy: Math.sin(a) * 15, r: 5, fill: doc.sphere('#fef3c7', 0.4), stroke: OUTLINE, 'stroke-width': 1.5 }));
  }
  p.push(seg(doc, -28, 0, 16, 18, '#f5d0fe', 2));
  for (const [x, rx, ry] of [[-14, 12, 17], [0, 13, 19], [14, 13, 19]] as const) p.push(seg(doc, x, 0, rx, ry, c, 2));
  p.push(legs([-6, 6, 16], 18, 6, darken(c, 0.3), 2, 0.2));
  p.push(seg(doc, 30, 0, 13, 14, lighten(c, 0.15), 2));
  p.push(mandibles(38, 5, 7, '#6b2148'));
  p.push(crown(doc, 26, 0));
  p.push(eyes(34, 6, 4.2, '#7e22ce', true));
  return p;
};

const irontick: Draw = (doc) => {
  const steel = '#7b8798';
  const p = [legs([-6, 4, 14, 22], 16, 16, '#334155', 2.6, 0.55)];
  p.push(el('path', { d: 'M-36,0 C-36,-28 12,-30 22,-15 C29,-6 29,6 22,15 C12,30 -36,28 -36,0 Z', fill: doc.sphere(steel, 0.5), stroke: OUTLINE, 'stroke-width': 2.4 }));
  for (const x of [-22, -8, 6]) p.push(el('path', { d: `M${x},-22 q8,22 0,44`, fill: 'none', stroke: OUTLINE, 'stroke-width': 2, opacity: 0.85 }));
  for (const [x, y] of [[-28, -8], [-28, 8], [-15, -17], [-15, 17], [-1, -17], [-1, 17], [12, -10], [12, 10]] as const) {
    p.push(el('circle', { cx: x, cy: y, r: 1.8, fill: '#e2e8f0', stroke: OUTLINE, 'stroke-width': 0.8 }));
  }
  for (const x of [-22, -8, 6]) {
    p.push(el('path', { d: `M${x + 1},-20 q8,20 0,40`, fill: 'none', stroke: '#fb923c', 'stroke-width': 3, opacity: 0.6, filter: doc.blur(1.5) }));
    p.push(el('path', { d: `M${x + 1},-20 q8,20 0,40`, fill: 'none', stroke: '#fed7aa', 'stroke-width': 0.9 }));
  }
  p.push(gloss(-10, -16, 14, 3.5, 0.5, 0));
  p.push(seg(doc, 28, 0, 10, 10, '#475569', 2));
  p.push(mandibles(34, 4, 8, '#94a3b8'));
  p.push(glowEyes(doc, 30, 5, 2.6, '#fb923c'));
  return p;
};

const hivemind: Draw = (doc) => {
  const c = '#e879a9';
  const rng = new Rng(5);
  const p = [el('circle', { cx: 0, cy: 0, r: 44, fill: '#34d399', opacity: 0.18, filter: doc.blur(5) })];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.push(el('path', { d: `M${Math.cos(a) * 20},${Math.sin(a) * 20} Q${Math.cos(a + 0.4) * 34},${Math.sin(a + 0.4) * 34} ${Math.cos(a) * 42},${Math.sin(a) * 42}`, fill: 'none', stroke: OUTLINE, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    p.push(el('path', { d: `M${Math.cos(a) * 20},${Math.sin(a) * 20} Q${Math.cos(a + 0.4) * 34},${Math.sin(a + 0.4) * 34} ${Math.cos(a) * 42},${Math.sin(a) * 42}`, fill: 'none', stroke: darken(c, 0.2), 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
  }
  p.push(el('path', { d: blob(rng, 0, 0, 30, 0.08, 10), fill: doc.sphere(c, 0.45), stroke: OUTLINE, 'stroke-width': 2.4 }));
  p.push(el('path', { d: 'M-24,0 C-12,-6 -4,6 6,0 S20,-6 26,0', fill: 'none', stroke: darken(c, 0.35), 'stroke-width': 2 }));
  for (const [x, y, r] of [[-12, -12, 4], [-14, 12, 3.6], [8, -16, 3.2], [6, 14, 3.4]] as const) p.push(g({ transform: `translate(0 ${y})` }, singleEye(x, r)));
  p.push(el('path', { d: 'M-16,-20 C-6,-26 6,-26 14,-20', fill: 'none', stroke: lighten(c, 0.5), 'stroke-width': 2, opacity: 0.6 }));
  p.push(singleEye(18, 7));
  return p;
};

function singleEye(x: number, r: number): string {
  return [
    el('circle', { cx: x, cy: 0, r, fill: '#ffffff', stroke: OUTLINE, 'stroke-width': 1.4 }),
    el('circle', { cx: x + r * 0.3, cy: 0, r: r * 0.55, fill: '#16a34a' }),
    el('circle', { cx: x + r * 0.3, cy: 0, r: r * 0.25, fill: OUTLINE }),
    el('circle', { cx: x + r * 0.05, cy: -r * 0.35, r: r * 0.2, fill: '#ffffff' }),
  ].join('');
}

const colossus: Draw = (doc) => {
  const shell = '#9b2c2c';
  const p = [legs([-18, -4, 10], 24, 16, '#1c1917', 3.4, 0.6)];
  p.push(el('path', { d: 'M-42,0 C-42,-30 -16,-36 6,-33 L12,-30 L12,30 L6,33 C-16,36 -42,30 -42,0 Z', fill: doc.sphere(shell, 0.5), stroke: OUTLINE, 'stroke-width': 2.6 }));
  p.push(el('line', { x1: -42, y1: 0, x2: 12, y2: 0, stroke: OUTLINE, 'stroke-width': 2.6 }));
  for (const [x, y] of [[-30, -16], [-14, -24], [-30, 16], [-14, 24], [0, -18], [0, 18]] as const) {
    p.push(el('polygon', { points: `${x - 4},${y} ${x},${y - 6 * Math.sign(y)} ${x + 4},${y}`, fill: '#f5e6c8', stroke: OUTLINE, 'stroke-width': 1.4 }));
  }
  p.push(el('path', { d: 'M-34,-14 C-24,-26 -6,-26 4,-22', fill: 'none', stroke: '#fca5a5', 'stroke-width': 2.4, opacity: 0.6, 'stroke-linecap': 'round' }));
  p.push(el('path', { d: 'M10,-24 C24,-24 30,-12 30,0 C30,12 24,24 10,24 Z', fill: doc.sphere('#3f1d1d', 0.45), stroke: OUTLINE, 'stroke-width': 2.4 }));
  for (const s of [-1, 1]) p.push(el('path', { d: `M24,${s * 10} Q40,${s * 18} 46,${s * 6} Q36,${s * 8} 28,${s * 4} Z`, fill: doc.shade('#e7e5e4'), stroke: OUTLINE, 'stroke-width': 2 }));
  p.push(el('path', { d: 'M28,-4 L46,0 L28,4 Z', fill: doc.shade('#d6d3d1'), stroke: OUTLINE, 'stroke-width': 2 }));
  p.push(glowEyes(doc, 22, 11, 2.6, '#f43f5e'));
  return p;
};

const omega: Draw = (doc) => {
  const c = '#3b1f6e';
  const rng = new Rng(9);
  const p = [el('circle', { cx: 0, cy: 0, r: 46, fill: '#dc2626', opacity: 0.22, filter: doc.blur(6) })];
  p.push(legs([-16, -4, 8, 20], 22, 16, '#1e1b4b', 3, 0.6));
  p.push(el('polygon', { points: starPts(0, 0, 40, 30, 12, 0), fill: doc.sphere('#4c1d95', 0.35), stroke: OUTLINE, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
  p.push(el('path', { d: blob(rng, -2, 0, 28, 0.08, 9), fill: doc.sphere(c, 0.5), stroke: OUTLINE, 'stroke-width': 2.4 }));
  for (const a of [0.9, 2.2, 3.4, 4.6, 5.6]) p.push(el('path', { d: `M${Math.cos(a) * 8},${Math.sin(a) * 8} L${Math.cos(a + 0.2) * 20},${Math.sin(a + 0.2) * 20} L${Math.cos(a) * 26},${Math.sin(a) * 26}`, fill: 'none', stroke: '#f43f5e', 'stroke-width': 1.6, opacity: 0.85 }));
  p.push(el('circle', { cx: -4, cy: 0, r: 13, fill: '#ef4444', opacity: 0.6, filter: doc.blur(4) }));
  p.push(el('circle', { cx: -4, cy: 0, r: 8, fill: doc.sphere('#fca5a5', 0.6), stroke: OUTLINE, 'stroke-width': 2 }));
  p.push(seg(doc, 30, 0, 11, 12, '#2e1065', 2));
  p.push(mandibles(38, 5, 8, '#a78bfa'));
  p.push(glowEyes(doc, 32, 5.5, 2.4, '#f43f5e'));
  p.push(glowEyes(doc, 26, 10, 1.8, '#f43f5e'));
  return p;
};

const BOSS_DRAW: Record<string, Draw> = { queen, irontick, hivemind, colossus, omega };

/** Boss textures in the pinned id order. */
export function bossAssets(): ArtAsset[] {
  return Object.entries(BOSS_DRAW).map(([id, draw]) => {
    const key = `boss-${id}`;
    return {
      key,
      dir: 'bosses',
      width: 192,
      height: 192,
      render: () => {
        const doc = new SvgDoc(192, 192, key);
        return doc.render(creature(doc, 192, draw(doc), 2));
      },
    };
  });
}
