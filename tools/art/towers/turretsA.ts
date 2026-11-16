/** Turrets for blaster, gatling, sniper, frost, flamethrower, rocket, seeker, spikes, heli. */
import { darken, lighten } from '../lib/color';
import { METAL, OUTLINE } from '../lib/palette';
import { gloss, polyPoints, roundRect } from '../lib/shapes';
import { el, g, ol, type SvgDoc } from '../lib/svg';
import { band, barrel, box, GOLD, hub, lamp, rankChevrons, type TurretOpts } from './kit';

/** Turret renderer: content in local space around (0,0), pointing +x. */
export type TurretFn = (doc: SvgDoc, o: TurretOpts) => string[];

const trimOf = (o: TurretOpts): string => (o.t3 ? GOLD : METAL.light);

export const blaster: TurretFn = (doc, o) => {
  const body = '#2f9be6';
  const p = [box(doc, -30, -15, 22, 30, 7, METAL.dark)];
  if (o.t3) {
    p.push(barrel(doc, 4, 36, 7, METAL.mid, -15, true, GOLD), barrel(doc, 4, 36, 7, METAL.mid, 15, true, GOLD));
  }
  p.push(barrel(doc, 8, 44, 13, METAL.mid, 0, true, trimOf(o)));
  p.push(band(doc, 22, 5, 19, body), band(doc, 31, 5, 19, body));
  p.push(hub(doc, 23, body));
  p.push(el('path', { d: roundRect(-4, -6, 16, 12, 4), fill: '#0f2236', ...ol(2) }));
  p.push(lamp(doc, 6, 0, 3.2, '#7dd3fc'));
  if (o.t3) p.push(rankChevrons(-24));
  return p;
};

export const gatling: TurretFn = (doc, o) => {
  const body = '#e3b322';
  const p = [box(doc, -30, -21, 40, 42, 10, body)];
  p.push(box(doc, -22, 18, 26, 12, 3, '#556b2f'));
  const ys = o.t3 ? [-12, -4, 4, 12] : [-9, 0, 9];
  for (const y of ys) p.push(barrel(doc, 6, 46, 7, METAL.mid, y, false));
  p.push(band(doc, 20, 6, ys.length * 8 + 10, METAL.dark), band(doc, 40, 6, ys.length * 8 + 10, trimOf(o)));
  p.push(el('rect', { x: 49, y: -(ys.length * 4 + 4), width: 6, height: ys.length * 8 + 8, rx: 2, fill: doc.shade(METAL.dark), ...ol(2.5) }));
  p.push(el('circle', { cx: -10, cy: 0, r: 11, fill: doc.sphere(darken(body, 0.25)), ...ol(2.5) }));
  p.push(el('circle', { cx: -10, cy: 0, r: 4, fill: METAL.deep, ...ol(2) }));
  p.push(gloss(-20, -13, 10, 3.5, 0.35, 0));
  if (o.t3) p.push(rankChevrons(-27));
  return p;
};

export const sniper: TurretFn = (doc, o) => {
  const body = '#5f7f2c';
  const p = [box(doc, -32, -13, 34, 26, 7, body)];
  p.push(barrel(doc, -2, 54, 8, METAL.dark, 0, false));
  p.push(el('rect', { x: 44, y: -8, width: 10, height: 16, rx: 2, fill: doc.shade(trimOf(o)), ...ol(2.5) }));
  p.push(el('line', { x1: 47, y1: -8, x2: 47, y2: 8, stroke: OUTLINE, 'stroke-width': 2 }));
  p.push(el('rect', { x: -14, y: -19, width: 30, height: 9, rx: 4.5, fill: doc.shade('#2e3a1c'), ...ol(2.5) }));
  p.push(el('circle', { cx: 15, cy: -14.5, r: 4.5, fill: doc.sphere('#7dd3fc', 0.6), ...ol(2) }));
  p.push(el('rect', { x: -26, y: 5, width: 16, height: 6, rx: 3, fill: darken(body, 0.35) }));
  p.push(gloss(-20, -8, 10, 2.6, 0.3, 0));
  if (o.t3) p.push(lamp(doc, 52, 0, 2.6, '#f43f5e'), rankChevrons(-28));
  return p;
};

export const frost: TurretFn = (doc, o) => {
  const body = '#8fdcff';
  const p = [box(doc, -28, -20, 26, 40, 9, '#4f8fc0')];
  p.push(el('polygon', { points: '6,-13 44,-20 50,-20 50,20 44,20 6,13', fill: doc.shade('#d7f2ff', 0.3), ...ol() }));
  p.push(el('rect', { x: 44, y: -22, width: 8, height: 44, rx: 3, fill: doc.shade(trimOf(o)), ...ol(2.5) }));
  p.push(el('ellipse', { cx: 50, cy: 0, rx: 3, ry: 15, fill: '#0b3a5c', opacity: 0.8 }));
  for (const y of [-8, 0, 8]) p.push(el('line', { x1: 14, y1: y * 0.8, x2: 40, y2: y * 1.3, stroke: '#ffffff', 'stroke-opacity': 0.55, 'stroke-width': 2 }));
  p.push(hub(doc, 20, body));
  p.push(snowflake(0, 0, 11, '#ffffff'));
  if (o.t3) {
    for (const s of [-1, 1]) p.push(el('polygon', { points: `-6,${s * 20} 8,${s * 34} 14,${s * 22}`, fill: doc.shade('#bfeaff'), ...ol(2.5) }));
    p.push(rankChevrons(-25));
  }
  return p;
};

/** Six-armed flake used on frost hardware. */
export function snowflake(cx: number, cy: number, r: number, color: string): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    parts.push(el('line', { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, stroke: OUTLINE, 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
    parts.push(el('line', { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  }
  return parts.join('');
}

export const flamethrower: TurretFn = (doc, o) => {
  const body = '#e2483d';
  const p: string[] = [];
  for (const y of o.t3 ? [-15, 0, 15] : [-10, 10]) {
    p.push(el('rect', { x: -34, y: y - 7, width: 26, height: 14, rx: 7, fill: doc.shade('#f59e0b', 0.35), ...ol(2.5) }));
    p.push(el('rect', { x: -26, y: y - 7, width: 4, height: 14, fill: OUTLINE, opacity: 0.6 }));
  }
  p.push(box(doc, -14, -16, 30, 32, 10, body));
  p.push(barrel(doc, 12, 30, 10, METAL.dark, 0, false));
  p.push(el('polygon', { points: '38,-7 50,-12 50,12 38,7', fill: doc.shade(trimOf(o)), ...ol(2.5) }));
  p.push(el('ellipse', { cx: 55, cy: 0, rx: 6, ry: 5, fill: '#fb923c', opacity: 0.85, filter: doc.blur(2) }));
  p.push(el('ellipse', { cx: 53, cy: 0, rx: 3, ry: 2.5, fill: '#fde68a' }));
  p.push(el('path', { d: 'M-8,8 C-2,18 10,16 16,6', fill: 'none', stroke: OUTLINE, 'stroke-width': 5, 'stroke-linecap': 'round' }));
  p.push(el('path', { d: 'M-8,8 C-2,18 10,16 16,6', fill: 'none', stroke: '#57534e', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  p.push(lamp(doc, 2, -6, 3, '#fbbf24'));
  if (o.t3) p.push(rankChevrons(-6, 0));
  return p;
};

export const rocket: TurretFn = (doc, o) => {
  const body = '#6f8a2e';
  const n = o.t3 ? 3 : 2;
  const h = n * 16 + 8;
  const p = [box(doc, -26, -h / 2, 48, h, 8, body)];
  for (let i = 0; i < n; i++) {
    const y = -h / 2 + 12 + i * 16;
    p.push(el('rect', { x: -18, y: y - 6, width: 42, height: 12, rx: 3, fill: darken(body, 0.5), ...ol(2) }));
    p.push(el('rect', { x: -10, y: y - 4, width: 26, height: 8, rx: 2, fill: doc.shade('#e5e7eb'), stroke: OUTLINE, 'stroke-width': 1.5 }));
    p.push(el('path', { d: `M16,${y - 4} L26,${y} L16,${y + 4} Z`, fill: doc.shade('#ef4444'), stroke: OUTLINE, 'stroke-width': 1.5 }));
  }
  p.push(band(doc, 22, 6, h + 2, trimOf(o)));
  p.push(el('rect', { x: -32, y: -8, width: 8, height: 16, rx: 3, fill: doc.shade(METAL.dark), ...ol(2) }));
  if (o.t3) p.push(rankChevrons(-22, -h / 2 - 1));
  return p;
};

export const seeker: TurretFn = (doc, o) => {
  const body = '#c04fd8';
  const p: string[] = [];
  for (const s of [-1, 1]) {
    const y = s * 19;
    p.push(el('rect', { x: -12, y: y - 6, width: 40, height: 12, rx: 6, fill: doc.shade('#f1f5f9'), ...ol(2.5) }));
    p.push(el('path', { d: `M28,${y - 6} Q40,${y} 28,${y + 6} Z`, fill: doc.shade('#f43f5e'), ...ol(2) }));
    p.push(el('polygon', { points: `-12,${y - 6} -18,${y - 11} -18,${y + 11} -12,${y + 6}`, fill: doc.shade(METAL.mid), ...ol(2) }));
  }
  p.push(box(doc, -26, -14, 42, 28, 10, body));
  p.push(el('circle', { cx: 0, cy: 0, r: 12, fill: doc.sphere('#fde7ff', 0.3), ...ol(2.5) }));
  p.push(el('path', { d: 'M-6,-6 A9,9 0 0 1 6,-6', fill: 'none', stroke: '#c04fd8', 'stroke-width': 2.2 }));
  p.push(lamp(doc, 0, 0, 3, '#e879f9'));
  p.push(el('rect', { x: 16, y: -4, width: 12, height: 8, rx: 2, fill: doc.shade(trimOf(o)), ...ol(2) }));
  if (o.t3) p.push(lamp(doc, 30, 0, 2.5, '#f43f5e'), rankChevrons(-24));
  return p;
};

/** Spike cluster that sits in the spike plate (no rotation needed). */
export const spikes: TurretFn = (_doc, o) => {
  const p: string[] = [];
  const steel = o.t3 ? GOLD : '#d1d9e6';
  for (let gx = -1; gx <= 1; gx++) {
    for (let gy = -1; gy <= 1; gy++) {
      const x = gx * 24;
      const y = gy * 24;
      const s = gx === 0 && gy === 0 ? 11 : 9;
      p.push(el('polygon', { points: `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`, fill: darken(steel, 0.45), ...ol(2.2) }));
      p.push(el('polygon', { points: `${x},${y - s} ${x},${y} ${x - s},${y}`, fill: lighten(steel, 0.35) }));
      p.push(el('polygon', { points: `${x},${y - s} ${x + s},${y} ${x},${y}`, fill: steel }));
      p.push(el('polygon', { points: `${x},${y} ${x + s},${y} ${x},${y + s}`, fill: darken(steel, 0.2) }));
      p.push(el('circle', { cx: x, cy: y, r: 1.4, fill: '#ffffff' }));
    }
  }
  return p;
};

/** Helicopter body seen from above; rotor hub at (0,0). */
export const heli: TurretFn = (doc, o) => {
  const body = o.t3 ? '#3d4a2a' : '#4a6a3a';
  const p: string[] = [];
  p.push(el('rect', { x: -52, y: -3.5, width: 40, height: 7, rx: 3.5, fill: doc.shade(darken(body, 0.15)), ...ol(2.5) }));
  p.push(el('rect', { x: -53, y: -13, width: 7, height: 26, rx: 3, fill: doc.shade(body), ...ol(2.2) }));
  p.push(el('circle', { cx: -49.5, cy: 0, r: 2, fill: METAL.light }));
  for (const s of [-1, 1]) {
    p.push(el('rect', { x: -4, y: s > 0 ? 12 : -24, width: 14, height: 12, rx: 3, fill: doc.shade(darken(body, 0.2)), ...ol(2.2) }));
    p.push(el('rect', { x: -2, y: s * 24 - 4, width: 22, height: 8, rx: 4, fill: doc.shade(METAL.dark), ...ol(2.2) }));
    if (o.t3) p.push(el('rect', { x: 16, y: s * 24 - 2, width: 10, height: 4, rx: 2, fill: GOLD, ...ol(1.5) }));
  }
  p.push(el('path', { d: 'M-24,0 C-24,-15 -6,-19 14,-17 C30,-15 40,-8 40,0 C40,8 30,15 14,17 C-6,19 -24,15 -24,0 Z', fill: doc.shade(body, 0.35), ...ol() }));
  p.push(el('path', { d: 'M16,-13 C28,-12 37,-6 37,0 C37,6 28,12 16,13 C20,6 20,-6 16,-13 Z', fill: doc.linear([[0, '#bde8ff'], [0.5, '#3b93c9'], [1, '#123a5c']], 0, 0, 1, 1), ...ol(2.2) }));
  p.push(gloss(26, -6, 6, 2.2, 0.6, 15));
  p.push(el('line', { x1: -20, y1: 0, x2: 8, y2: 0, stroke: darken(body, 0.4), 'stroke-width': 2 }));
  p.push(el('circle', { cx: 0, cy: 0, r: 6, fill: doc.sphere(METAL.mid), ...ol(2) }));
  if (o.t3) p.push(rankChevrons(-18, -9));
  return p;
};

/** Separate rotor texture (spins around the canvas centre). */
export function heliRotor(doc: SvgDoc): string[] {
  const p = [el('circle', { cx: 0, cy: 0, r: 57, fill: '#dbe4f0', opacity: 0.1 })];
  p.push(el('circle', { cx: 0, cy: 0, r: 57, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.16, 'stroke-width': 1.5 }));
  for (let i = 0; i < 4; i++) {
    p.push(
      g({ transform: `rotate(${i * 90 + 20})`, opacity: 0.82 }, [
        el('path', { d: 'M4,-3 L54,-4 Q57,0 54,4 L4,3 Z', fill: doc.shade('#2f3747', 0.3), ...ol(2) }),
        el('rect', { x: 48, y: -4, width: 6, height: 8, fill: '#fbbf24', opacity: 0.9 }),
      ]),
    );
  }
  p.push(el('circle', { cx: 0, cy: 0, r: 7, fill: doc.sphere(METAL.light), ...ol(2) }));
  p.push(el('polygon', { points: polyPoints(0, 0, 3, 6), fill: OUTLINE }));
  return p;
}
