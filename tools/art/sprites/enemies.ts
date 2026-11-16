/** The 14 regular parasites (96x96, facing +x). */
import { darken, lighten } from '../lib/color';
import type { ArtAsset } from '../lib/asset';
import { OUTLINE } from '../lib/palette';
import { blob, gloss, polyPoints, starPts } from '../lib/shapes';
import { Rng } from '../lib/rng';
import { el, g, SvgDoc } from '../lib/svg';
import { creature, eyes, glowEyes, legs, mandibles, seg, wings } from './creature';

type Draw = (doc: SvgDoc) => string[];

const larva: Draw = (doc) => {
  const c = '#a8dd6f';
  const p: string[] = [];
  const segs: [number, number, number][] = [[-30, 10, 9], [-18, 13, 12], [-4, 15, 14], [12, 15, 15]];
  for (const [x, rx, ry] of segs) p.push(seg(doc, x, 0, rx, ry, c));
  for (const [x, , ry] of segs) p.push(el('path', { d: `M${x - 2},${-ry * 0.8} q4,${ry * 0.8} 0,${ry * 1.6}`, fill: 'none', stroke: darken(c, 0.35), 'stroke-width': 1.6, opacity: 0.7 }));
  p.push(legs([-16, -4, 8], 12, 6, darken(c, 0.25), 2.6, 0.2));
  p.push(seg(doc, 28, 0, 13, 13, '#c5ea8f'));
  p.push(mandibles(36, 5, 8, '#6b4a2b'));
  p.push(eyes(30, 6, 4.6));
  return p;
};

const mite: Draw = (doc) => {
  const c = '#ef4b4b';
  return [
    legs([-8, 0, 8, 16], 12, 22, darken(c, 0.3), 2.6, 0.7),
    seg(doc, -6, 0, 24, 21, c),
    el('path', { d: 'M-20,-8 q10,-6 20,0 M-22,6 q10,-6 20,0', fill: 'none', stroke: lighten(c, 0.35), 'stroke-width': 2, opacity: 0.6 }),
    seg(doc, 20, 0, 12, 11, darken(c, 0.15)),
    eyes(22, 5.5, 4.2, OUTLINE, true),
    ...[-14, -4].map((x) => el('circle', { cx: x, cy: 8, r: 2.5, fill: darken(c, 0.35) })),
  ];
};

const tick: Draw = (doc) => {
  const shell = '#8a6a4c';
  const p = [legs([-6, 4, 14, 22], 16, 16, '#4a3626', 3, 0.55)];
  p.push(el('path', { d: 'M-34,0 C-34,-26 12,-28 22,-14 C28,-6 28,6 22,14 C12,28 -34,26 -34,0 Z', fill: doc.sphere(shell, 0.4), stroke: OUTLINE, 'stroke-width': 3 }));
  for (const [x, w] of [[-20, 18], [-6, 22], [8, 20]] as const) {
    p.push(el('path', { d: `M${x},${-w} q8,${w} 0,${w * 2}`, fill: 'none', stroke: OUTLINE, 'stroke-width': 2.4, opacity: 0.8 }));
    p.push(el('path', { d: `M${x + 2},${-w + 2} q7,${w - 2} 0,${w * 2 - 4}`, fill: 'none', stroke: lighten(shell, 0.35), 'stroke-width': 1.4, opacity: 0.6 }));
  }
  for (const [x, y] of [[-24, -10], [-24, 10], [-10, -16], [-10, 16], [2, -14], [2, 14]] as const) p.push(el('circle', { cx: x, cy: y, r: 2, fill: '#d6c2a3', stroke: OUTLINE, 'stroke-width': 1 }));
  p.push(gloss(-8, -14, 14, 4, 0.4, 0));
  p.push(seg(doc, 28, 0, 10, 9, '#5b4331'));
  p.push(mandibles(34, 4, 8, '#3a2a1e'));
  p.push(eyes(28, 5, 3.6, '#7f1d1d'));
  return p;
};

const leech: Draw = (doc) => {
  const c = '#6b3fa0';
  const body = 'M-40,0 C-40,-10 -24,-16 -6,-16 C14,-16 30,-12 36,-6 C40,-2 40,2 36,6 C30,12 14,16 -6,16 C-24,16 -40,10 -40,0 Z';
  return [
    el('path', { d: body, fill: doc.sphere(c, 0.4), stroke: OUTLINE, 'stroke-width': 3 }),
    el('path', { d: 'M-34,-5 C-14,-11 10,-10 30,-4', fill: 'none', stroke: '#c084fc', 'stroke-width': 2.6, opacity: 0.8, 'stroke-linecap': 'round' }),
    el('path', { d: 'M-34,5 C-14,11 10,10 30,4', fill: 'none', stroke: '#c084fc', 'stroke-width': 2.6, opacity: 0.8, 'stroke-linecap': 'round' }),
    ...[-24, -12, 0, 12].map((x) => el('circle', { cx: x, cy: 0, r: 2.6, fill: '#86efac', opacity: 0.9, stroke: OUTLINE, 'stroke-width': 1 })),
    el('circle', { cx: 35, cy: 0, r: 8, fill: doc.sphere('#f9a8d4', 0.4), stroke: OUTLINE, 'stroke-width': 2.5 }),
    el('circle', { cx: 36, cy: 0, r: 4, fill: '#7f1d4f' }),
    ...polyPointsRing(36, 0, 6, 8),
    gloss(-8, -9, 16, 3.5, 0.35, 0),
    eyes(24, 7, 3.2),
  ];
};

function polyPointsRing(cx: number, cy: number, r: number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(el('circle', { cx: cx + Math.cos(a) * r, cy: cy + Math.sin(a) * r, r: 1.1, fill: '#fdf2f8' }));
  }
  return out;
}

function sporeBody(doc: SvgDoc, r: number, c: string, spots: number): string[] {
  const rng = new Rng(r * 13);
  const p = [el('polygon', { points: starPts(0, 0, r, r * 0.88, 22, 0), fill: doc.sphere(c, 0.45), stroke: OUTLINE, 'stroke-width': 3, 'stroke-linejoin': 'round' })];
  for (let i = 0; i < spots; i++) {
    const a = (i / spots) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const d = r * rng.range(0.35, 0.62);
    p.push(el('circle', { cx: Math.cos(a) * d - r * 0.1, cy: Math.sin(a) * d, r: r * rng.range(0.1, 0.17), fill: lighten(c, 0.45), stroke: darken(c, 0.4), 'stroke-width': 1.2 }));
  }
  p.push(gloss(-r * 0.25, -r * 0.4, r * 0.4, r * 0.15, 0.45));
  return p;
}

const spore: Draw = (doc) => [...sporeBody(doc, 34, '#d98a2b', 7), eyes(18, 8, 5.2, OUTLINE, true), el('path', { d: 'M24,-3 q4,3 0,6', fill: 'none', stroke: OUTLINE, 'stroke-width': 2 })];

const sporelet: Draw = (doc) => [...sporeBody(doc, 22, '#f2b25c', 4), eyes(10, 6, 4.2)];

const phantom: Draw = (doc) => {
  const c = '#7ee7f7';
  const body = 'M30,0 C30,-20 6,-26 -10,-20 C-22,-16 -28,-12 -40,-16 C-34,-8 -44,-4 -36,0 C-44,4 -34,8 -40,16 C-28,12 -22,16 -10,20 C6,26 30,20 30,0 Z';
  return [
    el('path', { d: body, fill: c, opacity: 0.35, filter: doc.blur(5) }),
    g({ opacity: 0.82 }, [
      el('path', { d: body, fill: doc.radial([[0, '#ecfeff'], [0.6, c], [1, '#0e7490']], 0.7, 0.5, 0.75), stroke: OUTLINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }),
      el('path', { d: 'M-30,-6 C-18,-12 -6,-8 6,-12', fill: 'none', stroke: '#ffffff', 'stroke-width': 2, opacity: 0.6, 'stroke-linecap': 'round' }),
    ]),
    glowEyes(doc, 14, 7, 4.4, '#a855f7'),
    el('ellipse', { cx: 24, cy: 0, rx: 2.5, ry: 4, fill: '#164e63', opacity: 0.8 }),
  ];
};

const beetle: Draw = (doc) => {
  const shell = '#2f5fd0';
  return [
    legs([-14, 0, 14], 20, 14, '#1e293b', 3.6, 0.6),
    el('path', { d: 'M-38,0 C-38,-24 -16,-30 4,-28 L10,-26 L10,26 L4,28 C-16,30 -38,24 -38,0 Z', fill: doc.sphere(shell, 0.5), stroke: OUTLINE, 'stroke-width': 3 }),
    el('line', { x1: -38, y1: 0, x2: 10, y2: 0, stroke: OUTLINE, 'stroke-width': 3 }),
    el('path', { d: 'M-30,-12 C-20,-22 -4,-22 4,-18', fill: 'none', stroke: '#bfdbfe', 'stroke-width': 3, opacity: 0.7, 'stroke-linecap': 'round' }),
    el('path', { d: 'M-30,12 C-20,4 -4,4 4,8', fill: 'none', stroke: '#93c5fd', 'stroke-width': 2, opacity: 0.4, 'stroke-linecap': 'round' }),
    el('path', { d: 'M8,-20 C20,-20 26,-12 26,0 C26,12 20,20 8,20 Z', fill: doc.sphere('#1e3a8a', 0.45), stroke: OUTLINE, 'stroke-width': 3 }),
    el('path', { d: 'M24,-5 L42,-2 L44,0 L42,2 L24,5 Z', fill: doc.shade('#cbd5e1'), stroke: OUTLINE, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
    eyes(20, 10, 3.2, '#facc15'),
  ];
};

const swarmling: Draw = (doc) => [
  wings(doc, 2, 26, 8, 28, '#fef9c3'),
  legs([-2, 6], 6, 8, OUTLINE, 1.6, 0.6),
  seg(doc, -14, 0, 14, 10, '#facc15'),
  el('path', { d: 'M-20,-9 q3,9 0,18 M-12,-10 q3,10 0,20', fill: 'none', stroke: OUTLINE, 'stroke-width': 3.2 }),
  el('path', { d: 'M-30,0 L-36,0', stroke: OUTLINE, 'stroke-width': 3, 'stroke-linecap': 'round' }),
  seg(doc, 4, 0, 8, 7, '#a16207'),
  seg(doc, 16, 0, 8, 8, '#facc15'),
  eyes(18, 4, 3.4, OUTLINE, true),
];

const jelly: Draw = (doc) => {
  const c = '#f472b6';
  const p: string[] = [];
  for (const y of [-12, -4, 4, 12]) {
    const d = `M-6,${y} C-18,${y - 6} -26,${y + 6} -40,${y + (y > 0 ? 4 : -4)}`;
    p.push(el('path', { d, fill: 'none', stroke: OUTLINE, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.8 }));
    p.push(el('path', { d, fill: 'none', stroke: lighten(c, 0.3), 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
  }
  p.push(el('circle', { cx: 6, cy: 0, r: 30, fill: c, opacity: 0.3, filter: doc.blur(4) }));
  p.push(el('path', { d: blob(new Rng(7), 6, 0, 27, 0.06, 10), fill: doc.radial([[0, '#fdf2f8', 0.95], [0.6, c, 0.8], [1, '#9d174d', 0.9]], 0.4, 0.4, 0.7), stroke: OUTLINE, 'stroke-width': 3 }));
  p.push(el('circle', { cx: 2, cy: 2, r: 10, fill: doc.sphere('#a21caf', 0.5), opacity: 0.85, stroke: '#701a75', 'stroke-width': 1.5 }));
  p.push(gloss(-4, -14, 12, 4.5, 0.6));
  p.push(eyes(20, 7, 4));
  return p;
};

const shieldbug: Draw = (doc) => {
  const c = '#2fbf63';
  return [
    el('circle', { cx: 0, cy: 0, r: 40, fill: 'none', stroke: '#38bdf8', 'stroke-width': 3, opacity: 0.55, filter: doc.blur(1.5) }),
    legs([-12, 0, 12], 18, 12, '#14532d', 3, 0.5),
    el('path', { d: 'M-32,-20 L10,-26 L28,0 L10,26 L-32,20 Z', fill: doc.sphere(c, 0.45), stroke: OUTLINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    el('polygon', { points: polyPoints(-6, 0, 12, 6, Math.PI / 6), fill: doc.sphere('#7dd3fc', 0.55), stroke: OUTLINE, 'stroke-width': 2.5 }),
    el('polygon', { points: polyPoints(-6, 0, 6, 6, Math.PI / 6), fill: 'none', stroke: '#e0f2fe', 'stroke-width': 1.6 }),
    gloss(-12, -14, 12, 3, 0.35, -5),
    seg(doc, 28, 0, 9, 9, '#166534'),
    eyes(30, 4.5, 3.2),
  ];
};

const medic: Draw = (doc) => {
  const c = '#e9f3f7';
  return [
    legs([-8, 2, 12], 12, 18, '#64748b', 2.6, 0.6),
    seg(doc, -6, 0, 22, 19, c),
    el('rect', { x: -26, y: -12, width: 12, height: 24, rx: 4, fill: doc.shade('#94a3b8'), stroke: OUTLINE, 'stroke-width': 2.5 }),
    el('circle', { cx: -4, cy: 0, r: 11, fill: '#34d399', opacity: 0.35, filter: doc.blur(3) }),
    el('path', { d: 'M-8,-9 h8 v5 h5 v8 h-5 v5 h-8 v-5 h-5 v-8 h5 Z', fill: '#22c55e', stroke: OUTLINE, 'stroke-width': 2, transform: 'translate(0 0)' }),
    seg(doc, 20, 0, 11, 10, '#cbd5e1'),
    eyes(22, 5, 3.8, '#0f766e'),
  ];
};

const burrower: Draw = (doc) => {
  const c = '#a8743a';
  const p: string[] = [];
  for (const [x, r] of [[-32, 9], [-21, 12], [-8, 14]] as const) p.push(seg(doc, x, 0, r, r, c));
  p.push(seg(doc, 6, 0, 14, 15, darken(c, 0.1)));
  p.push(el('path', { d: 'M14,-15 L42,0 L14,15 Z', fill: doc.linear([[0, '#e2e8f0'], [0.5, '#94a3b8'], [1, '#334155']], 0, 0, 0, 1), stroke: OUTLINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  for (const t of [0.25, 0.5, 0.75]) p.push(el('line', { x1: 14 + 28 * t - 3, y1: -15 * (1 - t), x2: 14 + 28 * t + 3, y2: 15 * (1 - t), stroke: OUTLINE, 'stroke-width': 1.8 }));
  p.push(el('rect', { x: 10, y: -16, width: 6, height: 32, rx: 2, fill: doc.shade('#64748b'), stroke: OUTLINE, 'stroke-width': 2 }));
  p.push(...[-30, -18, -6].map((x) => el('circle', { cx: x, cy: -4, r: 2, fill: lighten(c, 0.4), opacity: 0.8 })));
  p.push(eyes(2, 8, 3));
  return p;
};

const gnat: Draw = (doc) => [
  el('ellipse', { cx: 0, cy: 0, rx: 20, ry: 20, fill: '#000000', opacity: 0.18, filter: doc.blur(5) }),
  wings(doc, -2, 34, 10, 22, '#dbeafe'),
  wings(doc, -8, 26, 8, 52, '#e0e7ff'),
  legs([-2, 4], 5, 10, OUTLINE, 1.4, 0.8),
  seg(doc, -14, 0, 14, 8, '#64748b'),
  el('path', { d: 'M-20,-7 q3,7 0,14 M-12,-8 q3,8 0,16', fill: 'none', stroke: '#334155', 'stroke-width': 2 }),
  seg(doc, 4, 0, 9, 8, '#475569'),
  seg(doc, 16, 0, 7, 7, '#64748b'),
  eyes(17, 4, 3.6, '#be123c'),
  el('path', { d: 'M22,-2 L32,-1 L22,1', fill: '#1e293b', stroke: OUTLINE, 'stroke-width': 1.2 }),
];

const ENEMY_DRAW: Record<string, Draw> = { larva, mite, tick, leech, spore, sporelet, phantom, beetle, swarmling, jelly, shieldbug, medic, burrower, gnat };

/** Enemy textures in the pinned id order. */
export function enemyAssets(): ArtAsset[] {
  return Object.entries(ENEMY_DRAW).map(([id, draw]) => {
    const key = `enemy-${id}`;
    return {
      key,
      dir: 'enemies',
      width: 96,
      height: 96,
      render: () => {
        const doc = new SvgDoc(96, 96, key);
        return doc.render(creature(doc, 96, draw(doc)));
      },
    };
  });
}
