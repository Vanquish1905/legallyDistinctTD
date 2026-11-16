/** Decor for the volcano, lab, crystal and city themes. */
import { darken, lighten } from '../../lib/color';
import { OUTLINE } from '../../lib/palette';
import { blob, polyPoints, roundRect } from '../../lib/shapes';
import { el } from '../../lib/svg';
import { castShadow, union, type DecorDraw, type ThemeDecor } from './common';
import { rock } from './nature';

const spire: DecorDraw = (doc, rng, x, y, s) => {
  const r = 22 * s;
  const out = [castShadow(doc, x + 8, y + 8, r * 1.2, r * 0.7, 0.45)];
  out.push(el('path', { d: blob(rng, x, y + 4, r * 1.25, 0.1, 7), fill: '#ff6a1a', opacity: 0.35, filter: doc.blur(8) }));
  out.push(union([{ d: blob(rng, x, y + r * 0.2, r, 0.3, 6, 1.1, 0.9), fill: '#2a2120' }], 5, '#0e0a0a'));
  out.push(el('path', { d: blob(rng, x - r * 0.15, y - r * 0.1, r * 0.65, 0.3, 5), fill: '#4a3a36' }));
  out.push(el('path', { d: blob(rng, x - r * 0.3, y - r * 0.3, r * 0.28, 0.3, 5), fill: '#6b5650' }));
  out.push(el('path', { d: `M${x - r * 0.6},${y + r * 0.5} L${x - r * 0.1},${y + r * 0.1} L${x + r * 0.4},${y + r * 0.6}`, fill: 'none', stroke: '#ff8a1f', 'stroke-width': 2, opacity: 0.9 }));
  return out.join('');
};

const lavaCrack: DecorDraw = (doc, rng, x, y, s) => {
  let d = `M${x},${y}`;
  let cx = x;
  let cy = y;
  const a0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const a = a0 + rng.range(-0.6, 0.6);
    cx += Math.cos(a) * 12 * s;
    cy += Math.sin(a) * 12 * s;
    d += ` L${cx},${cy}`;
  }
  return [
    el('path', { d, fill: 'none', stroke: '#ff6a1a', 'stroke-width': 10 * s, opacity: 0.45, filter: doc.blur(5), 'stroke-linecap': 'round' }),
    el('path', { d, fill: 'none', stroke: '#1a1110', 'stroke-width': 6 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    el('path', { d, fill: 'none', stroke: '#ffb02e', 'stroke-width': 2.2 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  ].join('');
};

const vent: DecorDraw = (doc, rng, x, y, s) => [
  el('path', { d: blob(rng, x, y, 14 * s, 0.2, 7, 1.2, 0.8), fill: '#1a1211', stroke: '#5a4640', 'stroke-width': 3 }),
  el('ellipse', { cx: x, cy: y, rx: 7 * s, ry: 4 * s, fill: '#ff7a1a', opacity: 0.8, filter: doc.blur(2) }),
  el('circle', { cx: x + 6 * s, cy: y - 16 * s, r: 12 * s, fill: '#cfc7c4', opacity: 0.22, filter: doc.blur(6) }),
].join('');

const ember: DecorDraw = (doc, rng, x, y, s) =>
  el('circle', { cx: x, cy: y, r: rng.range(1.5, 3) * s, fill: '#ffb02e', opacity: 0.9 }) +
  el('circle', { cx: x, cy: y, r: 6 * s, fill: '#ff6a1a', opacity: 0.3, filter: doc.blur(3) });

const crate: DecorDraw = (doc, rng, x, y, s) => {
  const w = 34 * s;
  const metal = rng.next() < 0.5;
  const top = metal ? '#6b7b90' : '#b9874f';
  const out = [castShadow(doc, x + 6, y + 8, w * 0.7, w * 0.45, 0.4)];
  out.push(el('path', { d: roundRect(x - w / 2, y - w / 2 + 6 * s, w, w, 4), fill: darken(top, 0.4), stroke: OUTLINE, 'stroke-width': 3 }));
  out.push(el('path', { d: roundRect(x - w / 2, y - w / 2, w, w, 4), fill: doc.shade(top, 0.25), stroke: OUTLINE, 'stroke-width': 3 }));
  out.push(el('path', { d: roundRect(x - w / 2 + 5, y - w / 2 + 5, w - 10, w - 10, 2), fill: 'none', stroke: darken(top, 0.35), 'stroke-width': 2 }));
  out.push(el('line', { x1: x - w / 2 + 5, y1: y - w / 2 + 5, x2: x + w / 2 - 5, y2: y + w / 2 - 5, stroke: darken(top, 0.35), 'stroke-width': 3 }));
  return out.join('');
};

const toxicBarrel: DecorDraw = (doc, rng, x, y, s) => {
  const r = 13 * s;
  const out = [el('path', { d: blob(rng, x + r * 0.9, y + r * 0.8, r * 0.9, 0.3, 7, 1.4, 0.7), fill: '#86e23a', opacity: 0.55, stroke: '#3f9d1f', 'stroke-width': 1.5 })];
  out.push(castShadow(doc, x + 4, y + 5, r * 1.1, r * 0.8, 0.45));
  out.push(el('circle', { cx: x, cy: y, r, fill: doc.sphere('#e3b021', 0.35), stroke: OUTLINE, 'stroke-width': 3 }));
  out.push(el('circle', { cx: x, cy: y, r: r * 0.78, fill: 'none', stroke: darken('#e3b021', 0.4), 'stroke-width': 1.8 }));
  out.push(el('circle', { cx: x, cy: y, r: r * 0.45, fill: 'none', stroke: darken('#e3b021', 0.3), 'stroke-width': 1.2 }));
  out.push(el('circle', { cx: x + r * 0.35, cy: y - r * 0.35, r: r * 0.16, fill: '#5b6472', stroke: OUTLINE, 'stroke-width': 1.2 }));
  return out.join('');
};

const tank: DecorDraw = (doc, _rng, x, y, s) => {
  const r = 26 * s;
  return [
    castShadow(doc, x + 8, y + 10, r * 1.1, r * 0.8, 0.45),
    el('circle', { cx: x, cy: y + 6 * s, r, fill: darken('#5b6b80', 0.4), stroke: OUTLINE, 'stroke-width': 3 }),
    el('circle', { cx: x, cy: y, r, fill: doc.shade('#7b8aa0', 0.3), stroke: OUTLINE, 'stroke-width': 3 }),
    el('circle', { cx: x, cy: y, r: r * 0.68, fill: doc.radial([[0, '#d9ff9e'], [0.6, '#86e23a'], [1, '#3f9d1f']]), stroke: OUTLINE, 'stroke-width': 2.5 }),
    el('circle', { cx: x, cy: y, r: r * 0.8, fill: '#86e23a', opacity: 0.25, filter: doc.blur(4) }),
    el('ellipse', { cx: x - r * 0.25, cy: y - r * 0.3, rx: r * 0.25, ry: r * 0.1, fill: '#ffffff', opacity: 0.6, transform: `rotate(-30 ${x - r * 0.25} ${y - r * 0.3})` }),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return el('circle', { cx: x + Math.cos(a) * r * 0.86, cy: y + Math.sin(a) * r * 0.86, r: 1.8 * s, fill: '#c9d4e5', stroke: OUTLINE, 'stroke-width': 1 });
    }),
  ].join('');
};

const pipes: DecorDraw = (doc, rng, x, y, s) => {
  const horiz = rng.next() < 0.5;
  const len = 110 * s;
  const w = 14 * s;
  const color = rng.pick(['#8a97a8', '#b07a3c', '#4f7fae']);
  const out: string[] = [];
  const rect = (o: number) => (horiz ? { x: x - len / 2, y: y - w / 2 + o, width: len, height: w } : { x: x - w / 2 + o, y: y - len / 2, width: w, height: len });
  out.push(el('rect', { ...rect(0), rx: w / 2, fill: '#000000', opacity: 0.35, transform: 'translate(5 8)', filter: doc.blur(4) }));
  for (const o of [-w * 0.65, w * 0.65]) {
    out.push(el('rect', { ...rect(o), rx: w / 2, fill: doc.linear(horiz ? [[0, lighten(color, 0.4)], [0.5, color], [1, darken(color, 0.45)]] : [[0, lighten(color, 0.4)], [0.5, color], [1, darken(color, 0.45)]], 0, 0, horiz ? 0 : 1, horiz ? 1 : 0), stroke: OUTLINE, 'stroke-width': 2.5 }));
  }
  for (const t of [-0.35, 0, 0.35]) {
    const fx = horiz ? x + t * len : x;
    const fy = horiz ? y : y + t * len;
    out.push(el('rect', { x: fx - (horiz ? 4 : w * 1.3), y: fy - (horiz ? w * 1.3 : 4), width: horiz ? 8 : w * 2.6, height: horiz ? w * 2.6 : 8, rx: 2, fill: doc.shade('#5a6474'), stroke: OUTLINE, 'stroke-width': 2 }));
  }
  return out.join('');
};

const grate: DecorDraw = (doc, _rng, x, y, s) => {
  const w = 30 * s;
  const out = [el('path', { d: roundRect(x - w / 2, y - w / 2, w, w, 4), fill: '#1b222c', stroke: '#566377', 'stroke-width': 3 })];
  for (let i = 1; i < 5; i++) out.push(el('line', { x1: x - w / 2 + 4, y1: y - w / 2 + (i * w) / 5, x2: x + w / 2 - 4, y2: y - w / 2 + (i * w) / 5, stroke: '#3f4a5a', 'stroke-width': 2.5 }));
  out.push(el('circle', { cx: x, cy: y, r: w * 0.3, fill: '#86e23a', opacity: 0.12, filter: doc.blur(4) }));
  return out.join('');
};

const floorMark: DecorDraw = (_doc, _rng, x, y, s) => {
  const out = [el('rect', { x: x - 17 * s, y: y - 5 * s, width: 34 * s, height: 10 * s, fill: 'none', stroke: '#f5b81c', 'stroke-width': 1.5, opacity: 0.4 })];
  for (let i = 0; i < 4; i++) {
    const px = x - 15 * s + i * 7.5 * s;
    out.push(el('polygon', { points: `${px},${y + 3 * s} ${px + 4 * s},${y - 3 * s} ${px + 8 * s},${y - 3 * s} ${px + 4 * s},${y + 3 * s}`, fill: '#f5b81c', opacity: 0.4 }));
  }
  return out.join('');
};

const boltPair: DecorDraw = (_doc, _rng, x, y, s) =>
  [x - 5 * s, x + 5 * s].map((bx) => el('circle', { cx: bx, cy: y, r: 1.8 * s, fill: '#6b778a', stroke: '#1e2530', 'stroke-width': 1 })).join('');

function crystal(colors: string[]): DecorDraw {
  return (doc, rng, x, y, s) => {
    const c = rng.pick(colors);
    const out = [el('circle', { cx: x, cy: y - 8 * s, r: 30 * s, fill: c, opacity: 0.32, filter: doc.blur(10) })];
    out.push(castShadow(doc, x + 6, y + 6, 22 * s, 9 * s, 0.4));
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) {
      const lean = rng.range(-0.5, 0.5) + (i - (n - 1) / 2) * 0.35;
      const h = rng.range(22, 40) * s * (i === Math.floor(n / 2) ? 1.25 : 1);
      const w = rng.range(6, 9) * s;
      const bx = x + (i - (n - 1) / 2) * 7 * s;
      const tx = bx + Math.sin(lean) * h;
      const ty = y - Math.cos(lean) * h;
      const nx = Math.cos(lean) * w;
      const ny = Math.sin(lean) * w;
      const mx = bx + Math.sin(lean) * h * 0.8;
      const my = y - Math.cos(lean) * h * 0.8;
      out.push(el('polygon', { points: `${bx - nx},${y - ny} ${mx - nx},${my - ny} ${tx},${ty} ${mx + nx},${my + ny} ${bx + nx},${y + ny}`, fill: doc.linear([[0, lighten(c, 0.55)], [0.5, c], [1, darken(c, 0.45)]], 0, 0, 1, 0), stroke: OUTLINE, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
      out.push(el('polyline', { points: `${bx},${y} ${(bx + mx) / 2 + 0.01},${(y + my) / 2} ${tx},${ty}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.4, opacity: 0.6 }));
    }
    return out.join('');
  };
}

const glowShroom: DecorDraw = (doc, rng, x, y, s) => {
  const c = rng.pick(['#22d3ee', '#a3e635', '#f472b6']);
  const out = [el('circle', { cx: x, cy: y, r: 18 * s, fill: c, opacity: 0.25, filter: doc.blur(6) })];
  for (let i = 0; i < 2; i++) {
    const cx = x + (i ? 8 : -4) * s;
    const cy = y + (i ? 3 : -3) * s;
    const r = (i ? 5 : 8) * s;
    out.push(el('rect', { x: cx - 1.5 * s, y: cy, width: 3 * s, height: 6 * s, rx: 1.5, fill: '#d8d2e8', stroke: OUTLINE, 'stroke-width': 1.2 }));
    out.push(el('ellipse', { cx, cy, rx: r, ry: r * 0.7, fill: doc.sphere(c, 0.5), stroke: OUTLINE, 'stroke-width': 2 }));
  }
  return out.join('');
};

const glowDot: DecorDraw = (doc, rng, x, y, s) => {
  const c = rng.pick(['#c4b5fd', '#67e8f9', '#f0abfc']);
  return el('circle', { cx: x, cy: y, r: 5 * s, fill: c, opacity: 0.35, filter: doc.blur(2.5) }) + el('circle', { cx: x, cy: y, r: 1.4 * s, fill: '#ffffff', opacity: 0.9 });
};

const shard: DecorDraw = (doc, rng, x, y, s) => {
  const c = rng.pick(['#8b5cf6', '#22d3ee', '#e879f9']);
  return el('polygon', { points: `${x - 4 * s},${y} ${x},${y - 11 * s} ${x + 4 * s},${y} ${x},${y + 3 * s}`, fill: doc.linear([[0, lighten(c, 0.5)], [1, darken(c, 0.3)]], 0, 0, 1, 0), stroke: OUTLINE, 'stroke-width': 1.5 });
};

const building: DecorDraw = (doc, rng, x, y, s) => {
  const w = rng.range(60, 84) * s;
  const h = rng.range(54, 76) * s;
  const wall = 14 * s;
  const roof = rng.pick(['#3b4256', '#454c63', '#353b4d']);
  const neon = rng.pick(['#f472b6', '#22d3ee', '#a78bfa', '#facc15']);
  const x0 = x - w / 2;
  const y0 = y - h / 2;
  const out = [el('rect', { x: x0 + 8, y: y0 + 14, width: w, height: h + wall, rx: 6, fill: '#000000', opacity: 0.45, filter: doc.blur(6) })];
  out.push(el('rect', { x: x0, y: y0 + h - 4, width: w, height: wall + 4, rx: 4, fill: darken(roof, 0.35), stroke: OUTLINE, 'stroke-width': 3 }));
  for (let i = 0; i < Math.floor(w / (12 * s)); i++) {
    const lit = rng.next() < 0.6;
    out.push(el('rect', { x: x0 + 6 * s + i * 12 * s, y: y0 + h + 1, width: 6 * s, height: 6 * s, rx: 1, fill: lit ? '#fde68a' : '#1f2533', opacity: lit ? 0.95 : 1 }));
  }
  out.push(el('rect', { x: x0, y: y0, width: w, height: h, rx: 5, fill: doc.shade(roof, 0.2), stroke: OUTLINE, 'stroke-width': 3 }));
  out.push(el('rect', { x: x0 + 5, y: y0 + 5, width: w - 10, height: h - 10, rx: 3, fill: 'none', stroke: lighten(roof, 0.15), 'stroke-width': 2 }));
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const ax = x0 + rng.range(12, w - 24);
    const ay = y0 + rng.range(12, h - 24);
    out.push(el('rect', { x: ax, y: ay, width: 14 * s, height: 12 * s, rx: 2, fill: doc.shade('#7c8496'), stroke: OUTLINE, 'stroke-width': 2 }));
    out.push(el('circle', { cx: ax + 7 * s, cy: ay + 6 * s, r: 4 * s, fill: '#2a2f3c' }));
  }
  out.push(el('rect', { x: x0 + 2, y: y0 + h - 2, width: w - 4, height: 3, fill: neon, opacity: 0.9 }));
  out.push(el('rect', { x: x0, y: y0 + h - 8, width: w, height: 14, fill: neon, opacity: 0.3, filter: doc.blur(6) }));
  return out.join('');
};

const streetLamp: DecorDraw = (doc, _rng, x, y, s) => [
  el('circle', { cx: x, cy: y, r: 30 * s, fill: '#fde68a', opacity: 0.16, filter: doc.blur(10) }),
  el('circle', { cx: x, cy: y, r: 5 * s, fill: '#4b5366', stroke: OUTLINE, 'stroke-width': 2 }),
  el('circle', { cx: x, cy: y, r: 2.4 * s, fill: '#fff7c2' }),
].join('');

const planter: DecorDraw = (doc, rng, x, y, s) => {
  const r = 20 * s;
  return [
    castShadow(doc, x + 5, y + 6, r * 1.1, r * 0.7, 0.4),
    el('circle', { cx: x, cy: y + 3, r, fill: '#596176', stroke: OUTLINE, 'stroke-width': 3 }),
    el('circle', { cx: x, cy: y, r, fill: doc.shade('#7c8496'), stroke: OUTLINE, 'stroke-width': 3 }),
    el('path', { d: blob(rng, x, y - 2, r * 0.82, 0.18, 7), fill: '#2f7a44', stroke: OUTLINE, 'stroke-width': 2.5 }),
    el('path', { d: blob(rng, x - r * 0.2, y - r * 0.3, r * 0.4, 0.2, 6), fill: '#4ea35f' }),
  ].join('');
};

const manhole: DecorDraw = (_doc, _rng, x, y, s) =>
  el('circle', { cx: x, cy: y, r: 8 * s, fill: '#3a3f4c', stroke: '#1a1d25', 'stroke-width': 2 }) +
  el('polygon', { points: polyPoints(x, y, 4.5 * s, 6), fill: 'none', stroke: '#545b6b', 'stroke-width': 1.2 });

export const VOLCANO: ThemeDecor = {
  large: [
    { r: 28, weight: 5, draw: spire, scale: [1, 1.8] },
    { r: 40, weight: 3, draw: lavaCrack },
    { r: 18, weight: 2, draw: vent },
  ],
  small: [
    { r: 6, weight: 5, draw: ember },
    { r: 6, weight: 3, draw: rock('#4a3a36'), scale: [0.3, 0.5] },
  ],
  largeCount: 30,
  smallCount: 120,
};

export const LAB: ThemeDecor = {
  large: [
    { r: 26, weight: 4, draw: crate, scale: [1, 1.5] },
    { r: 30, weight: 2, draw: tank, scale: [1, 1.4] },
    { r: 20, weight: 3, draw: toxicBarrel, scale: [1.1, 1.5] },
    { r: 62, weight: 2, draw: pipes, scale: [0.8, 1.1] },
    { r: 22, weight: 2, draw: grate },
  ],
  small: [
    { r: 8, weight: 3, draw: boltPair },
    { r: 16, weight: 2, draw: floorMark },
  ],
  largeCount: 26,
  smallCount: 70,
};

export const CRYSTAL: ThemeDecor = {
  large: [
    { r: 30, weight: 5, draw: crystal(['#8b5cf6', '#22d3ee', '#e879f9', '#6366f1']), scale: [1.1, 1.9] },
    { r: 22, weight: 2, draw: rock('#4a3f66'), scale: [0.8, 1.3] },
    { r: 18, weight: 3, draw: glowShroom, scale: [1, 1.6] },
  ],
  small: [
    { r: 6, weight: 5, draw: glowDot },
    { r: 6, weight: 3, draw: shard },
  ],
  largeCount: 30,
  smallCount: 140,
};

export const CITY: ThemeDecor = {
  large: [
    { r: 46, weight: 6, draw: building, scale: [0.9, 1.2] },
    { r: 24, weight: 3, draw: planter, scale: [1, 1.4] },
    { r: 10, weight: 3, draw: streetLamp },
  ],
  small: [{ r: 9, weight: 2, draw: manhole }],
  largeCount: 40,
  smallCount: 30,
};
