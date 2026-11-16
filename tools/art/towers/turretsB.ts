/** Turrets for tesla, laser, mortar, toxin, saw, pulse, railgun, radar, coinfactory. */
import { darken, lighten } from '../lib/color';
import { METAL, OUTLINE } from '../lib/palette';
import { gloss, polyPoints, regularPts, starPts } from '../lib/shapes';
import { el, g, ol, type SvgDoc } from '../lib/svg';
import { band, barrel, box, GOLD, lamp, rankChevrons, type TurretOpts } from './kit';
import type { TurretFn } from './turretsA';

const trimOf = (o: TurretOpts): string => (o.t3 ? GOLD : METAL.light);

/** Jagged lightning polyline between two points. */
export function bolt2(x1: number, y1: number, x2: number, y2: number, jag: number[]): string {
  const pts: string[] = [`${x1},${y1}`];
  const n = jag.length + 1;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  jag.forEach((j, i) => {
    const t = (i + 1) / n;
    pts.push(`${x1 + (x2 - x1) * t + (nx / len) * j},${y1 + (y2 - y1) * t + (ny / len) * j}`);
  });
  pts.push(`${x2},${y2}`);
  return pts.join(' ');
}

export const tesla: TurretFn = (doc, o) => {
  const copper = '#d9822b';
  const p: string[] = [];
  p.push(el('circle', { cx: 0, cy: 0, r: 30, fill: doc.shade(METAL.dark), ...ol() }));
  for (const r of [26, 20]) p.push(el('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: OUTLINE, 'stroke-width': 6 }), el('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: doc.shade(copper, 0.4), 'stroke-width': 3.2 }));
  for (const pt of regularPts(0, 0, 26, 4, Math.PI / 4)) p.push(el('circle', { cx: pt.x, cy: pt.y, r: 3, fill: doc.sphere(trimOf(o)), ...ol(1.5) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 16, fill: '#a78bfa', opacity: 0.5, filter: doc.blur(4) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 14, fill: doc.sphere('#c4b5fd', 0.6), ...ol(2.5) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 6, fill: '#f5f3ff', opacity: 0.9 }));
  const arcs = o.t3 ? 4 : 3;
  for (let i = 0; i < arcs; i++) {
    const a = (i / arcs) * Math.PI * 2 + 0.4;
    const x2 = Math.cos(a) * 26;
    const y2 = Math.sin(a) * 26;
    p.push(el('polyline', { points: bolt2(Math.cos(a) * 10, Math.sin(a) * 10, x2, y2, [3, -3]), fill: 'none', stroke: '#e0f2fe', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
  }
  p.push(gloss(-4, -5, 4, 2, 0.8));
  return p;
};

export const laser: TurretFn = (doc, o) => {
  const body = '#5b3f8f';
  const p = [box(doc, -28, -18, 40, 36, 10, body)];
  p.push(barrel(doc, 10, 30, 14, METAL.dark, 0, false));
  p.push(el('rect', { x: 36, y: -10, width: 8, height: 20, rx: 3, fill: doc.shade(trimOf(o)), ...ol(2.5) }));
  p.push(el('circle', { cx: 48, cy: 0, r: 9, fill: '#f472b6', opacity: 0.55, filter: doc.blur(3) }));
  p.push(el('ellipse', { cx: 45, cy: 0, rx: 4, ry: 7, fill: doc.sphere('#fbcfe8', 0.6), ...ol(2) }));
  p.push(el('polygon', { points: '-14,-13 8,0 -14,13', fill: doc.linear([[0, '#fdf2f8'], [0.5, '#f472b6'], [1, '#9d174d']], 0, 0, 1, 1), ...ol(2.5) }));
  p.push(el('polygon', { points: '-14,-13 8,0 -6,0', fill: '#ffffff', opacity: 0.35 }));
  p.push(el('line', { x1: 8, y1: 0, x2: 40, y2: 0, stroke: '#f9a8d4', 'stroke-width': 2, opacity: 0.8 }));
  if (o.t3) p.push(el('polygon', { points: '-24,-24 -10,-18 -24,-12', fill: GOLD, ...ol(2) }), el('polygon', { points: '-24,24 -10,18 -24,12', fill: GOLD, ...ol(2) }));
  return p;
};

export const mortar: TurretFn = (doc, o) => {
  const body = '#55624a';
  const p = [el('circle', { cx: -4, cy: 0, r: 22, fill: doc.shade(darken(body, 0.2)), ...ol() })];
  p.push(el('rect', { x: -28, y: -6, width: 14, height: 12, rx: 3, fill: doc.shade(METAL.dark), ...ol(2) }));
  p.push(el('path', { d: 'M-6,-15 L26,-17 L26,17 L-6,15 Z', fill: doc.linear([[0, lighten(body, 0.3)], [0.5, body], [1, darken(body, 0.4)]]), ...ol() }));
  p.push(band(doc, 4, 6, 32, trimOf(o)));
  p.push(el('ellipse', { cx: 28, cy: 0, rx: 9, ry: 18, fill: doc.shade(METAL.mid), ...ol() }));
  p.push(el('ellipse', { cx: 29, cy: 0, rx: 5.5, ry: 13, fill: doc.radial([[0, '#05070b'], [1, '#2a3242']]) }));
  p.push(gloss(10, -10, 10, 2.5, 0.35, 0));
  if (o.t3) p.push(rankChevrons(-24, -12), rankChevrons(-24, 12));
  return p;
};

export const toxin: TurretFn = (doc, o) => {
  const goo = '#84cc16';
  const p: string[] = [];
  const tanks = o.t3 ? [-16, 0, 16] : [-11, 11];
  for (const y of tanks) {
    p.push(el('circle', { cx: -16, cy: y, r: o.t3 ? 9 : 11, fill: doc.sphere('#b6e94a', 0.45), ...ol(2.5) }));
    p.push(el('circle', { cx: -16, cy: y, r: o.t3 ? 4 : 5, fill: lighten(goo, 0.5), opacity: 0.7 }));
  }
  p.push(box(doc, -8, -12, 24, 24, 7, '#3f6212'));
  p.push(barrel(doc, 12, 28, 9, METAL.dark, 0, false));
  p.push(el('polygon', { points: '38,-5 48,-10 50,0 48,10 38,5', fill: doc.shade(trimOf(o)), ...ol(2.2) }));
  p.push(el('circle', { cx: 54, cy: 0, r: 4.5, fill: goo, opacity: 0.8, filter: doc.blur(1.6) }));
  p.push(hazardTrefoil(4, 0, 7));
  return p;
};

/** Simple three-blade warning emblem. */
function hazardTrefoil(cx: number, cy: number, r: number): string {
  const parts = [el('circle', { cx, cy, r: r + 2, fill: '#facc15', stroke: OUTLINE, 'stroke-width': 1.5 })];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const b = a + 0.7;
    parts.push(el('path', { d: `M${cx},${cy} L${cx + Math.cos(a - 0.5) * r},${cy + Math.sin(a - 0.5) * r} A${r},${r} 0 0 1 ${cx + Math.cos(b - 0.2) * r},${cy + Math.sin(b - 0.2) * r} Z`, fill: OUTLINE }));
  }
  parts.push(el('circle', { cx, cy, r: 1.6, fill: '#facc15' }));
  return parts.join('');
}

/** Saw blade with teeth (also used by the projectile). */
export function sawBlade(doc: SvgDoc, cx: number, cy: number, r: number, color = '#cbd5e1', teeth = 12): string {
  return [
    el('polygon', { points: starPts(cx, cy, r, r * 0.78, teeth, 0), fill: doc.shade(color, 0.35), ...ol(2.2) }),
    el('circle', { cx, cy, r: r * 0.58, fill: 'none', stroke: darken(color, 0.35), 'stroke-width': 1.6 }),
    el('circle', { cx, cy, r: r * 0.28, fill: doc.sphere(METAL.dark), ...ol(1.8) }),
    gloss(cx - r * 0.25, cy - r * 0.35, r * 0.35, r * 0.12, 0.6),
  ].join('');
}

export const saw: TurretFn = (doc, o) => {
  const body = '#c2410c';
  const p: string[] = [];
  for (const s of [-1, 1]) p.push(el('rect', { x: -4, y: s > 0 ? 10 : -18, width: 30, height: 8, rx: 3, fill: doc.shade(METAL.mid), ...ol(2.2) }));
  p.push(sawBlade(doc, 30, 0, o.t3 ? 21 : 18, o.t3 ? '#fde68a' : '#dbe3ee', 14));
  p.push(box(doc, -30, -16, 34, 32, 9, body));
  p.push(el('rect', { x: -24, y: -10, width: 6, height: 20, rx: 2, fill: darken(body, 0.45) }));
  p.push(lamp(doc, -6, 0, 3.4, '#fdba74'));
  if (o.t3) p.push(rankChevrons(-28));
  return p;
};

export const pulse: TurretFn = (doc, o) => {
  const glow = '#22d3ee';
  const p: string[] = [];
  p.push(el('circle', { cx: 0, cy: 0, r: 29, fill: doc.shade('#1e3a5f'), ...ol() }));
  for (let i = 0; i < 6; i++) {
    p.push(g({ transform: `rotate(${i * 60})` }, el('path', { d: 'M19,-6 L28,-8 L28,8 L19,6 Z', fill: doc.shade(trimOf(o)), ...ol(1.8) })));
  }
  p.push(el('circle', { cx: 0, cy: 0, r: 15, fill: glow, opacity: 0.55, filter: doc.blur(4) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 13, fill: doc.sphere('#a5f3fc', 0.5), ...ol(2.5) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 8, fill: 'none', stroke: '#ecfeff', 'stroke-width': 2, opacity: 0.85 }));
  p.push(el('circle', { cx: 0, cy: 0, r: 3.5, fill: '#ffffff' }));
  if (o.t3) p.push(el('polygon', { points: polyPoints(0, 0, 33, 6, Math.PI / 6), fill: 'none', stroke: GOLD, 'stroke-width': 2, opacity: 0.9 }));
  return p;
};

export const railgun: TurretFn = (doc, o) => {
  const body = '#24407a';
  const p = [box(doc, -32, -17, 38, 34, 9, body)];
  for (const s of [-1, 1]) p.push(el('rect', { x: 0, y: s * 9 - 3.5, width: 54, height: 7, rx: 2, fill: doc.shade(METAL.light), ...ol(2.5) }));
  p.push(el('rect', { x: 6, y: -4, width: 46, height: 8, fill: '#60a5fa', opacity: 0.55, filter: doc.blur(2) }));
  p.push(el('line', { x1: 6, y1: 0, x2: 50, y2: 0, stroke: '#dbeafe', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
  for (const x of [10, 26, 42]) p.push(band(doc, x, 5, 26, x === 42 ? trimOf(o) : '#3b5ba8'));
  p.push(el('rect', { x: -26, y: -11, width: 18, height: 22, rx: 4, fill: '#0b1530', ...ol(2) }));
  for (const y of [-6, 0, 6]) p.push(el('rect', { x: -23, y: y - 1.5, width: 12, height: 3, rx: 1.5, fill: '#60a5fa' }));
  if (o.t3) p.push(lamp(doc, 52, 0, 3, '#93c5fd'), rankChevrons(-31, -13));
  return p;
};

export const radar: TurretFn = (doc, o) => {
  const p: string[] = [];
  p.push(el('rect', { x: -6, y: -3, width: 30, height: 6, rx: 3, fill: doc.shade(METAL.mid), ...ol(2.2) }));
  p.push(el('path', { d: 'M-2,-30 C16,-22 16,22 -2,30 C6,16 6,-16 -2,-30 Z', fill: doc.linear([[0, '#e2f7ee'], [0.5, '#94d9b9'], [1, '#2f7a5a']], 0, 0, 1, 1), ...ol() }));
  p.push(el('path', { d: 'M-2,-30 C-14,-18 -14,18 -2,30 C6,16 6,-16 -2,-30 Z', fill: doc.shade('#cfeee0', 0.35), ...ol() }));
  for (const t of [-14, 0, 14]) p.push(el('line', { x1: -8, y1: t, x2: 6, y2: t * 0.9, stroke: '#2f7a5a', 'stroke-width': 1.4, opacity: 0.7 }));
  p.push(el('circle', { cx: 26, cy: 0, r: 5, fill: doc.sphere(trimOf(o)), ...ol(2) }));
  p.push(lamp(doc, 26, 0, 2, '#34d399'));
  p.push(el('circle', { cx: -4, cy: 0, r: 6, fill: doc.sphere(METAL.dark), ...ol(2) }));
  if (o.t3) p.push(el('line', { x1: -2, y1: -30, x2: -2, y2: 30, stroke: GOLD, 'stroke-width': 2 }));
  return [g({ transform: 'scale(1.22)' }, p)];
};

/** Spinning gear with a coin face (coin factory press). */
export const coinfactory: TurretFn = (doc, o) => {
  const p: string[] = [];
  p.push(el('polygon', { points: starPts(0, 0, 24, 19, 10, 0), fill: doc.shade(o.t3 ? '#e0b43a' : METAL.light, 0.3), ...ol(2.5) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 16, fill: doc.sphere('#fbbf24', 0.5), ...ol(2.5) }));
  p.push(el('circle', { cx: 0, cy: 0, r: 11.5, fill: 'none', stroke: '#b45309', 'stroke-width': 1.8 }));
  p.push(coinGlyph(0, 0, 7));
  p.push(gloss(-5, -7, 5, 2.2, 0.7));
  return p;
};

/** Stylised "$"-free coin mark: a bold diamond (keeps currency neutral). */
export function coinGlyph(cx: number, cy: number, r: number, color = '#92400e'): string {
  return el('polygon', { points: `${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}`, fill: color, opacity: 0.85 });
}
