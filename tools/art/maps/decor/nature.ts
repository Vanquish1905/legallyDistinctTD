/** Decor for the meadow, desert, snow and swamp themes. */
import { darken, lighten } from '../../lib/color';
import { OUTLINE } from '../../lib/palette';
import { blob, starPts } from '../../lib/shapes';
import { el } from '../../lib/svg';
import { castShadow, union, type DecorDraw, type ThemeDecor } from './common';

/** Cartoon tree seen from above: puffy canopy in three tones with one outline. */
export function leafyTree(base: string): DecorDraw {
  return (doc, rng, x, y, s) => {
    const r = 30 * s;
    const out = [castShadow(doc, x + 10 * s, y + 12 * s, r * 1.1, r * 0.85, 0.38)];
    const puffs: { x: number; y: number; r: number }[] = [{ x, y, r: r * 0.62 }];
    const n = rng.int(6, 8);
    const off = rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      const d = r * rng.range(0.42, 0.55);
      puffs.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.92, r: r * rng.range(0.4, 0.52) });
    }
    const circle = (p: { x: number; y: number; r: number }, fill: string, dx = 0, dy = 0, k = 1) =>
      el('circle', { cx: p.x + dx, cy: p.y + dy, r: p.r * k, fill });
    out.push(puffs.map((p) => el('circle', { cx: p.x, cy: p.y, r: p.r + 2.5, fill: OUTLINE })).join(''));
    out.push(puffs.map((p) => circle(p, darken(base, 0.3))).join(''));
    out.push(puffs.map((p) => circle(p, base, -r * 0.08, -r * 0.1, 0.86)).join(''));
    out.push(puffs.filter((p) => p.x + p.y < x + y + r * 0.2).map((p) => circle(p, lighten(base, 0.22), -r * 0.16, -r * 0.2, 0.52)).join(''));
    out.push(el('circle', { cx: x - r * 0.3, cy: y - r * 0.34, r: r * 0.16, fill: lighten(base, 0.45), opacity: 0.8 }));
    return out.join('');
  };
}

/** Mossy swamp tree: leafy canopy with hanging moss strands. */
export function mossyTree(base: string): DecorDraw {
  const tree = leafyTree(base);
  return (doc, rng, x, y, s) => {
    const out = [tree(doc, rng, x, y, s)];
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0.3, Math.PI - 0.3);
      const px = x + Math.cos(a) * 24 * s;
      const py = y + Math.sin(a) * 20 * s;
      out.push(el('path', { d: `M${px},${py} q2,6 0,${10 * s}`, stroke: '#9fb36a', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.85 }));
    }
    return out.join('');
  };
}

/** Grey boulder with a lit top facet. */
export function rock(base: string): DecorDraw {
  return (doc, rng, x, y, s) => {
    const r = 18 * s;
    const out = [castShadow(doc, x + 4 * s, y + 6 * s, r * 1.1, r * 0.7, 0.35)];
    out.push(union([{ d: blob(rng, x, y + r * 0.2, r, 0.18, 7, 1.15, 0.85), fill: darken(base, 0.2) }], 5));
    out.push(el('path', { d: blob(rng, x - r * 0.12, y - r * 0.08, r * 0.72, 0.18, 6, 1.1, 0.75), fill: base }));
    out.push(el('path', { d: blob(rng, x - r * 0.3, y - r * 0.25, r * 0.28, 0.2, 5), fill: lighten(base, 0.3), opacity: 0.8 }));
    return out.join('');
  };
}

const flower: DecorDraw = (_doc, rng, x, y, s) => {
  const c = rng.pick(['#f472b6', '#fde047', '#f8fafc', '#a78bfa', '#fb7185']);
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    out.push(el('circle', { cx: x + Math.cos(a) * 3.2 * s, cy: y + Math.sin(a) * 3.2 * s, r: 2.6 * s, fill: c, stroke: darken(c, 0.5), 'stroke-width': 0.8 }));
  }
  out.push(el('circle', { cx: x, cy: y, r: 1.8 * s, fill: '#f59e0b' }));
  return out.join('');
};

function tuft(color: string): DecorDraw {
  return (_doc, rng, x, y, s) => {
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const dx = rng.range(-6, 6) * s;
      const h = rng.range(7, 12) * s;
      out.push(el('path', { d: `M${x + dx},${y} q${dx * 0.3},${-h * 0.6} ${dx * 0.6 + rng.range(-3, 3)},${-h}`, stroke: i % 2 ? color : darken(color, 0.25), 'stroke-width': 2.2 * s, fill: 'none', 'stroke-linecap': 'round' }));
    }
    return out.join('');
  };
}

function pebble(color: string): DecorDraw {
  return (_doc, rng, x, y, s) =>
    el('ellipse', { cx: x, cy: y, rx: rng.range(3, 6) * s, ry: rng.range(2, 4) * s, fill: color, stroke: darken(color, 0.5), 'stroke-width': 1.2 }) +
    el('ellipse', { cx: x - 1, cy: y - 1, rx: 1.5 * s, ry: 1 * s, fill: lighten(color, 0.4) });
}

const bush: DecorDraw = (doc, rng, x, y, s) => {
  const base = '#3f8a3a';
  const r = 16 * s;
  const out = [castShadow(doc, x + 3, y + 5, r * 1.1, r * 0.7)];
  out.push(union([0, 1, 2].map((i) => ({ d: blob(rng, x + (i - 1) * r * 0.6, y + (i === 1 ? -r * 0.2 : 0), r * 0.7, 0.2, 7), fill: darken(base, 0.1) })), 4.5));
  out.push(el('path', { d: blob(rng, x - r * 0.2, y - r * 0.3, r * 0.5, 0.2, 6), fill: lighten(base, 0.15) }));
  for (let i = 0; i < 4; i++) out.push(el('circle', { cx: x + rng.range(-r, r) * 0.7, cy: y + rng.range(-r, r) * 0.4, r: 2.2 * s, fill: '#ef4444', stroke: OUTLINE, 'stroke-width': 0.8 }));
  return out.join('');
};

const cactus: DecorDraw = (doc, _rng, x, y, s) => {
  const green = '#4f9a4a';
  const out = [castShadow(doc, x + 10 * s, y + 10 * s, 20 * s, 9 * s, 0.35)];
  const arm = (dx: number, top: number) => `M${x + dx * 6 * s},${y - 2 * s} h${dx * 12 * s} v${-top * s}`;
  for (const [dx, top] of [[-1, 18], [1, 12]] as const) {
    out.push(el('path', { d: arm(dx, top), fill: 'none', stroke: OUTLINE, 'stroke-width': 13 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    out.push(el('path', { d: arm(dx, top), fill: 'none', stroke: green, 'stroke-width': 8 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  out.push(el('rect', { x: x - 7 * s, y: y - 34 * s, width: 14 * s, height: 44 * s, rx: 7 * s, fill: doc.shade(green, 0.3), stroke: OUTLINE, 'stroke-width': 3 }));
  out.push(el('line', { x1: x - 2 * s, y1: y - 30 * s, x2: x - 2 * s, y2: y + 6 * s, stroke: lighten(green, 0.35), 'stroke-width': 1.6 }));
  out.push(el('line', { x1: x + 3 * s, y1: y - 30 * s, x2: x + 3 * s, y2: y + 6 * s, stroke: darken(green, 0.3), 'stroke-width': 1.6 }));
  out.push(el('circle', { cx: x, cy: y - 34 * s, r: 3 * s, fill: '#f472b6', stroke: OUTLINE, 'stroke-width': 1.2 }));
  return out.join('');
};

const barrelCactus: DecorDraw = (doc, _rng, x, y, s) => {
  const r = 13 * s;
  return [
    castShadow(doc, x + 3, y + 4, r * 1.1, r * 0.7),
    el('polygon', { points: starPts(x, y, r, r * 0.86, 12, 0), fill: doc.sphere('#5aa851', 0.35), stroke: OUTLINE, 'stroke-width': 3 }),
    el('polygon', { points: starPts(x, y, r * 0.55, r * 0.45, 8, 0.2), fill: 'none', stroke: '#2f6b2c', 'stroke-width': 1.2 }),
    ...[0, 1, 2].map((i) => el('circle', { cx: x + (i - 1) * 3.5 * s, cy: y - 1 * s, r: 2.4 * s, fill: '#fb7185', stroke: OUTLINE, 'stroke-width': 0.8 })),
  ].join('');
};

const mesa: DecorDraw = (doc, rng, x, y, s) => {
  const r = 26 * s;
  const out = [castShadow(doc, x + 8, y + 10, r * 1.15, r * 0.75, 0.38)];
  out.push(union([{ d: blob(rng, x, y + 6 * s, r, 0.14, 8, 1.2, 0.8), fill: '#a8653a' }], 5));
  out.push(el('path', { d: blob(rng, x - 2, y - 2 * s, r * 0.82, 0.14, 8, 1.2, 0.72), fill: '#d18a52' }));
  out.push(el('path', { d: blob(rng, x - 4, y - 6 * s, r * 0.55, 0.16, 7, 1.2, 0.6), fill: '#e7a96c' }));
  out.push(el('path', { d: `M${x - r * 0.8},${y + 6 * s} q${r * 0.8},${5 * s} ${r * 1.6},0`, fill: 'none', stroke: '#8a4f2c', 'stroke-width': 1.6, opacity: 0.8 }));
  return out.join('');
};

const dryShrub: DecorDraw = (_doc, rng, x, y, s) => {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2);
    const l = rng.range(6, 11) * s;
    out.push(el('line', { x1: x, y1: y, x2: x + Math.cos(a) * l, y2: y + Math.sin(a) * l * 0.7, stroke: '#7c5a36', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  }
  return out.join('');
};

const ripple: DecorDraw = (_doc, rng, x, y, s) => {
  const w = rng.range(14, 26) * s;
  return el('path', { d: `M${x - w},${y} q${w / 2},${-5 * s} ${w},0 t${w},0`, fill: 'none', stroke: '#f6dcaa', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.7 }) +
    el('path', { d: `M${x - w},${y + 2.5} q${w / 2},${-5 * s} ${w},0 t${w},0`, fill: 'none', stroke: '#c48f52', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.5 });
};

const pine: DecorDraw = (doc, rng, x, y, s) => {
  const out = [castShadow(doc, x + 10 * s, y + 10 * s, 30 * s, 22 * s, 0.3)];
  const tiers = [30, 22, 14];
  tiers.forEach((r, i) => {
    const rr = r * s;
    const cy = y - i * 6 * s;
    out.push(el('polygon', { points: starPts(x, cy, rr, rr * 0.62, 8, rng.range(0, 1)), fill: i % 2 ? '#2f6b4f' : '#245a42', stroke: OUTLINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    out.push(el('path', { d: blob(rng, x - rr * 0.25, cy - rr * 0.25, rr * 0.5, 0.25, 6), fill: '#f4f9ff', opacity: 0.95 }));
  });
  out.push(el('circle', { cx: x, cy: y - 14 * s, r: 3 * s, fill: '#ffffff' }));
  return out.join('');
};

const iceRock: DecorDraw = (doc, rng, x, y, s) => {
  const r = 18 * s;
  const out = [castShadow(doc, x + 4, y + 6, r, r * 0.6, 0.25)];
  out.push(union([{ d: blob(rng, x, y, r, 0.25, 6, 1.1, 0.85), fill: '#9cc7e6' }], 5, '#2b4663'));
  out.push(el('path', { d: blob(rng, x - r * 0.2, y - r * 0.2, r * 0.55, 0.3, 5), fill: '#d6eefc' }));
  out.push(el('path', { d: `M${x - r * 0.1},${y - r * 0.6} L${x + r * 0.2},${y + r * 0.3}`, stroke: '#ffffff', 'stroke-width': 1.5, opacity: 0.8 }));
  return out.join('');
};

const snowMound: DecorDraw = (doc, rng, x, y, s) =>
  el('path', { d: blob(rng, x, y, 10 * s, 0.2, 6, 1.5, 0.8), fill: doc.shade('#ffffff', 0.12), stroke: '#b9cde0', 'stroke-width': 1.5 });

const mushrooms: DecorDraw = (doc, rng, x, y, s) => {
  const out: string[] = [];
  const cap = rng.pick(['#d9534f', '#c58b4a', '#b45bd1']);
  for (let i = 0; i < 3; i++) {
    const cx = x + (i - 1) * 9 * s + rng.range(-2, 2);
    const cy = y + (i === 1 ? -5 : 0) * s;
    const r = (i === 1 ? 8 : 6) * s;
    out.push(castShadow(doc, cx, cy + 2, r, r * 0.5, 0.25));
    out.push(el('rect', { x: cx - 2 * s, y: cy, width: 4 * s, height: 7 * s, rx: 2, fill: '#efe6d2', stroke: OUTLINE, 'stroke-width': 1.6 }));
    out.push(el('ellipse', { cx, cy, rx: r, ry: r * 0.72, fill: doc.sphere(cap, 0.4), stroke: OUTLINE, 'stroke-width': 2.2 }));
    out.push(el('circle', { cx: cx - r * 0.3, cy: cy - r * 0.2, r: r * 0.18, fill: '#fff7ed' }));
    out.push(el('circle', { cx: cx + r * 0.35, cy: cy + r * 0.05, r: r * 0.13, fill: '#fff7ed' }));
  }
  return out.join('');
};

const lilyPond: DecorDraw = (doc, rng, x, y, s) => {
  const r = 22 * s;
  const out = [el('path', { d: blob(rng, x, y, r, 0.15, 8, 1.3, 0.8), fill: doc.radial([[0, '#24423a'], [1, '#3f6a55']]), stroke: '#2b3a22', 'stroke-width': 3 })];
  for (let i = 0; i < 3; i++) {
    const px = x + rng.range(-r, r) * 0.6;
    const py = y + rng.range(-r, r) * 0.35;
    const pr = rng.range(4, 7) * s;
    out.push(el('path', { d: `M${px},${py} L${px + pr},${py - 1} A${pr},${pr} 0 1 1 ${px + pr},${py + 1.5} Z`, fill: '#5fae4a', stroke: '#1f3a1a', 'stroke-width': 1.4 }));
  }
  if (rng.next() < 0.6) out.push(el('circle', { cx: x + r * 0.2, cy: y - 2, r: 2.6 * s, fill: '#f9a8d4', stroke: OUTLINE, 'stroke-width': 1 }));
  return out.join('');
};

const reeds: DecorDraw = (_doc, rng, x, y, s) => {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const dx = rng.range(-7, 7) * s;
    const h = rng.range(12, 20) * s;
    out.push(el('line', { x1: x + dx, y1: y, x2: x + dx * 1.3, y2: y - h, stroke: '#3f5a2a', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    if (i % 2 === 0) out.push(el('rect', { x: x + dx * 1.3 - 1.8, y: y - h - 1, width: 3.6, height: 8 * s, rx: 1.8, fill: '#6b4a2b', stroke: OUTLINE, 'stroke-width': 1 }));
  }
  return out.join('');
};

export const MEADOW: ThemeDecor = {
  large: [
    { r: 34, weight: 6, draw: leafyTree('#4fa043'), scale: [1.1, 1.7] },
    { r: 20, weight: 3, draw: bush, scale: [1, 1.4] },
    { r: 22, weight: 2, draw: rock('#9aa3ad'), scale: [0.8, 1.5] },
  ],
  small: [
    { r: 6, weight: 4, draw: flower },
    { r: 8, weight: 5, draw: tuft('#3f7a2e') },
    { r: 5, weight: 2, draw: pebble('#a3a9b0') },
  ],
  largeCount: 42,
  smallCount: 260,
};

export const DESERT: ThemeDecor = {
  large: [
    { r: 24, weight: 4, draw: cactus, scale: [1.1, 1.6] },
    { r: 16, weight: 3, draw: barrelCactus, scale: [1, 1.5] },
    { r: 34, weight: 3, draw: mesa, scale: [1.1, 1.9] },
    { r: 20, weight: 2, draw: rock('#c08a5a'), scale: [0.9, 1.5] },
  ],
  small: [
    { r: 10, weight: 4, draw: dryShrub },
    { r: 5, weight: 3, draw: pebble('#b98a5c') },
    { r: 18, weight: 4, draw: ripple },
  ],
  largeCount: 30,
  smallCount: 200,
};

export const SNOW: ThemeDecor = {
  large: [
    { r: 34, weight: 6, draw: pine, scale: [1.1, 1.7] },
    { r: 22, weight: 3, draw: iceRock, scale: [1, 1.6] },
    { r: 20, weight: 2, draw: rock('#8d99a8') },
  ],
  small: [
    { r: 12, weight: 5, draw: snowMound },
    { r: 5, weight: 2, draw: pebble('#8d99a8') },
    { r: 8, weight: 2, draw: tuft('#6b7f72') },
  ],
  largeCount: 34,
  smallCount: 160,
};

export const SWAMP: ThemeDecor = {
  large: [
    { r: 32, weight: 4, draw: mossyTree('#56763a'), scale: [1.1, 1.6] },
    { r: 32, weight: 3, draw: leafyTree('#3f6a3a'), scale: [1, 1.5] },
    { r: 30, weight: 3, draw: lilyPond, scale: [1, 1.7] },
    { r: 18, weight: 3, draw: mushrooms, scale: [1, 1.5] },
  ],
  small: [
    { r: 10, weight: 5, draw: reeds },
    { r: 8, weight: 4, draw: tuft('#3a5229') },
    { r: 5, weight: 2, draw: pebble('#6b6a5a') },
  ],
  largeCount: 34,
  smallCount: 220,
};

