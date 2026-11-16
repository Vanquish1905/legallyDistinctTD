/** Geometry helpers that produce SVG path data / point lists. */
import type { Rng } from './rng';
import { num, el, type Attrs, type SvgDoc, ol } from './svg';

export interface Pt {
  x: number;
  y: number;
}

/** Points of a regular polygon as an SVG points attribute. */
export function polyPoints(cx: number, cy: number, r: number, sides: number, rot = 0): string {
  return regularPts(cx, cy, r, sides, rot)
    .map((p) => `${num(p.x)},${num(p.y)}`)
    .join(' ');
}

/** Vertex list of a regular polygon (rot in radians). */
export function regularPts(cx: number, cy: number, r: number, sides: number, rot = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** Points attribute from a list. */
export function pts(list: Pt[]): string {
  return list.map((p) => `${num(p.x)},${num(p.y)}`).join(' ');
}

/** Star with alternating outer/inner radius. */
export function starPts(cx: number, cy: number, outer: number, inner: number, n: number, rot = -Math.PI / 2): string {
  const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts(out);
}

/** Smooth closed curve through points (Catmull-Rom converted to cubic Beziers). */
export function smoothClosed(p: Pt[], tension = 1): string {
  const n = p.length;
  const at = (i: number): Pt => p[((i % n) + n) % n] as Pt;
  let d = `M${num(at(0).x)},${num(at(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    d += `C${num(c1x)},${num(c1y)} ${num(c2x)},${num(c2y)} ${num(p2.x)},${num(p2.y)}`;
  }
  return d + 'Z';
}

/** Organic wobbly blob outline around a centre. */
export function blob(rng: Rng, cx: number, cy: number, r: number, wobble = 0.2, n = 9, sx = 1, sy = 1): string {
  const p: Pt[] = [];
  const off = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const rr = r * (1 + rng.range(-wobble, wobble));
    p.push({ x: cx + Math.cos(a) * rr * sx, y: cy + Math.sin(a) * rr * sy });
  }
  return smoothClosed(p);
}

/** Rounded rectangle path data (for rotation-friendly paths). */
export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${num(x + rr)},${num(y)}H${num(x + w - rr)}A${num(rr)},${num(rr)} 0 0 1 ${num(x + w)},${num(y + rr)}` +
    `V${num(y + h - rr)}A${num(rr)},${num(rr)} 0 0 1 ${num(x + w - rr)},${num(y + h)}` +
    `H${num(x + rr)}A${num(rr)},${num(rr)} 0 0 1 ${num(x)},${num(y + h - rr)}` +
    `V${num(y + rr)}A${num(rr)},${num(rr)} 0 0 1 ${num(x + rr)},${num(y)}Z`
  );
}

/** Outlined rounded rect with three-tone shading. */
export function part(doc: SvgDoc, x: number, y: number, w: number, h: number, r: number, color: string, extra: Attrs = {}): string {
  return el('rect', { x, y, width: w, height: h, rx: r, fill: doc.shade(color), ...ol(), ...extra });
}

/** Outlined shaded circle. */
export function ball(doc: SvgDoc, cx: number, cy: number, r: number, color: string, extra: Attrs = {}): string {
  return el('circle', { cx, cy, r, fill: doc.sphere(color), ...ol(), ...extra });
}

/** Soft white specular highlight. */
export function gloss(cx: number, cy: number, rx: number, ry: number, opacity = 0.45, rot = -20): string {
  return el('ellipse', {
    cx,
    cy,
    rx,
    ry,
    fill: '#ffffff',
    opacity,
    transform: `rotate(${rot} ${num(cx)} ${num(cy)})`,
  });
}

/** Small rivet/bolt. */
export function bolt(cx: number, cy: number, r = 2.6, color = '#c9d4e5'): string {
  return el('circle', { cx, cy, r, fill: color, stroke: '#1b1f2a', 'stroke-width': 1.4 });
}
