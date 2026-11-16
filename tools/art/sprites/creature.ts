/** Building blocks for parasites (enemies and bosses). Local space: centre (0,0), head toward +x. */
import { darken, lighten } from '../lib/color';
import { OUTLINE } from '../lib/palette';
import { gloss } from '../lib/shapes';
import { el, g, type SvgDoc } from '../lib/svg';

/** Shaded outlined ellipse body segment. */
export function seg(doc: SvgDoc, cx: number, cy: number, rx: number, ry: number, color: string, w = 3): string {
  return [
    el('ellipse', { cx, cy, rx, ry, fill: doc.sphere(color, 0.42), stroke: OUTLINE, 'stroke-width': w }),
    gloss(cx - rx * 0.15, cy - ry * 0.45, rx * 0.45, ry * 0.18, 0.35, 0),
  ].join('');
}

/** Pair(s) of jointed legs, mirrored on both sides. xs are leg root x positions. */
export function legs(xs: number[], rootY: number, len: number, color: string, w = 3.2, sweep = 0.5): string {
  const parts: string[] = [];
  for (const side of [-1, 1]) {
    xs.forEach((x, i) => {
      const lean = (i - (xs.length - 1) / 2) * sweep;
      const kx = x + lean * len * 0.5;
      const ky = side * (rootY + len * 0.55);
      const fx = x + lean * len * 1.1;
      const fy = side * (rootY + len);
      const d = `M${x},${side * rootY} L${kx},${ky} L${fx},${fy}`;
      parts.push(el('path', { d, fill: 'none', stroke: OUTLINE, 'stroke-width': w + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      parts.push(el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    });
  }
  return parts.join('');
}

/** Two forward-looking eyes at x, separated by gap. */
export function eyes(x: number, gap: number, r: number, iris = '#1b1f2a', angry = false): string {
  const parts: string[] = [];
  for (const s of [-1, 1]) {
    const y = s * gap;
    parts.push(el('circle', { cx: x, cy: y, r, fill: '#ffffff', stroke: OUTLINE, 'stroke-width': Math.max(1.5, r * 0.35) }));
    parts.push(el('circle', { cx: x + r * 0.35, cy: y, r: r * 0.55, fill: iris }));
    parts.push(el('circle', { cx: x + r * 0.15, cy: y - r * 0.3, r: r * 0.22, fill: '#ffffff' }));
    if (angry) parts.push(el('line', { x1: x - r * 0.9, y1: y - s * r * 1.25, x2: x + r * 0.9, y2: y - s * r * 0.55, stroke: OUTLINE, 'stroke-width': r * 0.55, 'stroke-linecap': 'round' }));
  }
  return parts.join('');
}

/** Glowing eyes (no pupils) for ghostly or boss creatures. */
export function glowEyes(doc: SvgDoc, x: number, gap: number, r: number, color: string): string {
  const parts: string[] = [];
  for (const s of [-1, 1]) {
    parts.push(el('ellipse', { cx: x, cy: s * gap, rx: r * 1.8, ry: r * 1.5, fill: color, opacity: 0.55, filter: doc.blur(r * 0.7) }));
    parts.push(el('ellipse', { cx: x, cy: s * gap, rx: r, ry: r * 0.8, fill: lighten(color, 0.6), stroke: OUTLINE, 'stroke-width': 1.5 }));
  }
  return parts.join('');
}

/** Small pincers at the front. */
export function mandibles(x: number, gap: number, len: number, color: string): string {
  const parts: string[] = [];
  for (const s of [-1, 1]) {
    const d = `M${x},${s * gap} Q${x + len},${s * gap * 1.3} ${x + len * 1.15},${s * gap * 0.25}`;
    parts.push(el('path', { d, fill: 'none', stroke: OUTLINE, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    parts.push(el('path', { d, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  }
  return parts.join('');
}

/** Translucent insect wings, mirrored. */
export function wings(doc: SvgDoc, x: number, len: number, wid: number, angle: number, tint = '#e0f2fe'): string {
  const parts: string[] = [];
  for (const s of [-1, 1]) {
    parts.push(
      g({ transform: `rotate(${s * angle} ${x} 0)` }, [
        el('ellipse', { cx: x - len * 0.1, cy: s * len * 0.55, rx: wid, ry: len * 0.55, fill: doc.linear([[0, '#ffffff', 0.85], [1, tint, 0.35]]), stroke: OUTLINE, 'stroke-width': 2, 'stroke-opacity': 0.8 }),
        el('line', { x1: x, y1: s * 4, x2: x - len * 0.1, y2: s * len, stroke: darken(tint, 0.4), 'stroke-width': 1, opacity: 0.6 }),
      ]),
    );
  }
  return parts.join('');
}

/** Rotation-safe ambient shadow wrapper that centres content on the canvas. */
export function creature(doc: SvgDoc, size: number, content: string[], scale = 1): string {
  const c = size / 2;
  return g({ filter: doc.shadow(0, 0, size / 40, 0.7) }, g({ transform: `translate(${c} ${c}) scale(${scale})` }, content));
}
