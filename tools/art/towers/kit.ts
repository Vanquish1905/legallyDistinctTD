/** Shared building blocks for tower bases and turrets (128x128, centre 64,64). */
import { darken, lighten } from '../lib/color';
import { METAL, OUTLINE, UI } from '../lib/palette';
import { bolt, gloss, polyPoints, regularPts, roundRect } from '../lib/shapes';
import { el, g, ol, type SvgDoc } from '../lib/svg';

export const SIZE = 128;
export const C = 64;
export const GOLD = UI.gold;

/** Options every turret renderer receives. */
export interface TurretOpts {
  /** Max-tier variant: gold trim and extra hardware. */
  t3: boolean;
}

export type BaseShape = 'oct' | 'round' | 'hex' | 'square';

function shapeEl(shape: BaseShape, cx: number, cy: number, r: number, attrs: Record<string, string | number>): string {
  switch (shape) {
    case 'round':
      return el('circle', { cx, cy, r, ...attrs });
    case 'hex':
      return el('polygon', { points: polyPoints(cx, cy, r, 6, Math.PI / 6), ...attrs });
    case 'square':
      return el('path', { d: roundRect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8, r * 0.28), ...attrs });
    default:
      return el('polygon', { points: polyPoints(cx, cy, r, 8, Math.PI / 8), ...attrs });
  }
}

/** Soft elliptical contact shadow under a tower base. */
export function groundShadow(doc: SvgDoc, rx = 50, ry = 40, cy = 76): string {
  return el('ellipse', { cx: C + 2, cy, rx, ry, fill: '#000000', opacity: 0.38, filter: doc.blur(3.5) });
}

/**
 * Standard machine platform: extruded plate (3/4 view) with panel seams, category coloured
 * light strips, bolts and a dark socket the turret sits in.
 */
export function housing(doc: SvgDoc, shape: BaseShape, accent: string, plate: string = METAL.mid, r = 46): string {
  const depth = 9;
  const parts: string[] = [groundShadow(doc)];
  parts.push(shapeEl(shape, C, C + depth, r, { fill: doc.shade(darken(plate, 0.5), 0.15), ...flat(ol()) }));
  parts.push(shapeEl(shape, C, C, r, { fill: doc.shade(plate, 0.38), ...flat(ol()) }));
  parts.push(shapeEl(shape, C, C, r - 6, { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.16, 'stroke-width': 2 }));
  // panel seams
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    parts.push(el('line', { x1: C + Math.cos(a) * 30, y1: C + Math.sin(a) * 30, x2: C + Math.cos(a) * (r - 2), y2: C + Math.sin(a) * (r - 2), stroke: darken(plate, 0.55), 'stroke-width': 2 }));
  }
  // category light strips on the four sides
  for (let i = 0; i < 4; i++) {
    const deg = i * 90;
    parts.push(
      g({ transform: `rotate(${deg} ${C} ${C})` }, [
        el('rect', { x: C + 31, y: C - 9, width: 8, height: 18, rx: 3, fill: OUTLINE }),
        el('rect', { x: C + 32.5, y: C - 7.5, width: 5, height: 15, rx: 2, fill: doc.shade(accent, 0.3) }),
        el('rect', { x: C + 33, y: C - 6, width: 1.6, height: 8, rx: 0.8, fill: '#ffffff', opacity: 0.6 }),
      ]),
    );
  }
  parts.push(el('circle', { cx: C, cy: C, r: 29, fill: OUTLINE }));
  parts.push(el('circle', { cx: C, cy: C, r: 27, fill: doc.radial([[0, '#202737'], [1, '#121620']]), stroke: accent, 'stroke-width': 2.2, 'stroke-opacity': 0.9 }));
  const boltR = shape === 'round' ? r - 6 : r - 7;
  const sides = shape === 'hex' ? 6 : shape === 'square' ? 4 : 8;
  const rot = shape === 'hex' ? Math.PI / 6 : shape === 'square' ? Math.PI / 4 : Math.PI / 8;
  const br = shape === 'square' ? boltR * 1.1 : boltR;
  for (const p of regularPts(C, C, br, sides, rot)) parts.push(bolt(p.x, p.y));
  return parts.join('');
}

/** Drops undefined values so attrs can be spread into shapeEl. */
function flat(a: Record<string, string | number | undefined>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(a)) if (v !== undefined) out[k] = v;
  return out;
}

/** Wraps turret content (drawn around 0,0 pointing +x) with centring and a rotation-safe shadow. */
export function turretGroup(doc: SvgDoc, content: string[], scale = 1.12): string {
  return g({ filter: doc.shadow(0, 0, 3, 0.75) }, g({ transform: `translate(${C} ${C}) scale(${scale})` }, content));
}

/** A straight gun barrel from x0 to x0+len, centred on y. */
export function barrel(doc: SvgDoc, x0: number, len: number, w: number, color: string, y = 0, muzzle = true, trim: string = METAL.light): string {
  const parts = [el('rect', { x: x0, y: y - w / 2, width: len, height: w, rx: w * 0.3, fill: doc.shade(color, 0.35), ...ol() })];
  parts.push(el('line', { x1: x0 + 3, y1: y - w * 0.18, x2: x0 + len - 4, y2: y - w * 0.18, stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': Math.max(1.2, w * 0.18), 'stroke-linecap': 'round' }));
  if (muzzle) {
    const mw = w + 5;
    parts.push(el('rect', { x: x0 + len - 7, y: y - mw / 2, width: 9, height: mw, rx: 2.5, fill: doc.shade(trim, 0.3), ...ol() }));
  }
  return parts.join('');
}

/** A band/clamp around a barrel. */
export function band(doc: SvgDoc, x: number, w: number, h: number, color: string, y = 0): string {
  return el('rect', { x, y: y - h / 2, width: w, height: h, rx: 2, fill: doc.shade(color, 0.3), ...ol(2.5) });
}

/** Round turret hub with gloss. */
export function hub(doc: SvgDoc, r: number, color: string, cx = 0): string {
  return [
    el('circle', { cx, cy: 0, r, fill: doc.sphere(color, 0.4), ...ol() }),
    gloss(cx - r * 0.3, -r * 0.38, r * 0.45, r * 0.22, 0.4),
  ].join('');
}

/** Rounded box hub (axis aligned in turret space). */
export function box(doc: SvgDoc, x: number, y: number, w: number, h: number, r: number, color: string, amount = 0.32): string {
  return [
    el('path', { d: roundRect(x, y, w, h, r), fill: doc.shade(color, amount), ...ol() }),
    el('path', { d: roundRect(x + 4, y + 3, w - 8, Math.max(3, h * 0.22), Math.min(r, 4)), fill: '#ffffff', opacity: 0.18 }),
  ].join('');
}

/** Glowing light dot. */
export function lamp(doc: SvgDoc, cx: number, cy: number, r: number, color: string): string {
  return [
    el('circle', { cx, cy, r: r * 2.2, fill: color, opacity: 0.35, filter: doc.blur(r * 0.7) }),
    el('circle', { cx, cy, r, fill: doc.sphere(lighten(color, 0.2), 0.6), stroke: OUTLINE, 'stroke-width': 1.5 }),
  ].join('');
}

/** Three gold chevrons stamped on the back of a max-tier turret. */
export function rankChevrons(x: number, y = 0): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 5;
    parts.push(el('polyline', { points: `${cx - 2},${y - 6} ${cx + 2},${y} ${cx - 2},${y + 6}`, fill: 'none', stroke: OUTLINE, 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    parts.push(el('polyline', { points: `${cx - 2},${y - 6} ${cx + 2},${y} ${cx - 2},${y + 6}`, fill: 'none', stroke: GOLD, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  return parts.join('');
}
