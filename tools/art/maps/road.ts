/** The enemy path drawn as a layered, textured road with rim, shadow and theme specific markings. */
import { darken, lighten } from '../lib/color';
import type { Rng } from '../lib/rng';
import type { Pt } from '../lib/shapes';
import { el, g, num, type SvgDoc } from '../lib/svg';
import type { ThemePalette } from './theme';

/** Polyline path data. */
export function polyD(path: Pt[]): string {
  return path.map((p, i) => `${i ? 'L' : 'M'}${num(p.x)},${num(p.y)}`).join('');
}

function stroke(d: string, width: number, color: string, extra: Record<string, string | number> = {}): string {
  return el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });
}

function hazardPaint(doc: SvgDoc): string {
  return doc.pattern(18, 18, el('rect', { width: 18, height: 18, fill: '#f5b81c' }) + el('rect', { width: 9, height: 18, fill: '#1c2029' }), { patternTransform: 'rotate(45)' });
}

function markTile(doc: SvgDoc, rng: Rng, p: ThemePalette): string {
  const s = 80;
  const marks: string[] = [];
  const style = p.roadStyle;
  if (style === 'stone' || style === 'basalt') {
    for (let y = 0; y < s; y += 20) {
      const off = (y / 20) % 2 ? 10 : 0;
      for (let x = -20; x < s + 20; x += 20) {
        const c = rng.next() < 0.5 ? lighten(p.road, 0.08) : darken(p.road, 0.08);
        marks.push(el('rect', { x: x + off + 1.5, y: y + 1.5, width: 17, height: 17, rx: 5, fill: c, stroke: p.roadMark, 'stroke-width': 1.5 }));
      }
    }
  } else if (style === 'metal') {
    marks.push(el('rect', { width: s, height: s, fill: p.road }));
    marks.push(el('rect', { x: 1, y: 1, width: s / 2 - 2, height: s / 2 - 2, fill: 'none', stroke: p.roadMark, 'stroke-width': 2 }));
    marks.push(el('rect', { x: s / 2 + 1, y: s / 2 + 1, width: s / 2 - 2, height: s / 2 - 2, fill: 'none', stroke: p.roadMark, 'stroke-width': 2 }));
    for (let i = 0; i < s; i += 8) marks.push(el('line', { x1: s / 2 + 4, y1: i + 2, x2: s - 4, y2: i + 2, stroke: darken(p.road, 0.25), 'stroke-width': 2, opacity: i < s / 2 ? 1 : 0 }));
    for (let i = 0; i < s / 2; i += 8) marks.push(el('line', { x1: 4 + i, y1: s / 2 + 4, x2: 4 + i, y2: s - 4, stroke: darken(p.road, 0.25), 'stroke-width': 2 }));
    for (const [x, y] of [[6, 6], [s / 2 - 6, 6], [6, s / 2 - 6], [s / 2 - 6, s / 2 - 6]] as const) marks.push(el('circle', { cx: x, cy: y, r: 1.6, fill: lighten(p.road, 0.35) }));
  } else if (style === 'asphalt') {
    for (let i = 0; i < 40; i++) marks.push(el('circle', { cx: rng.range(0, s), cy: rng.range(0, s), r: rng.range(0.6, 1.4), fill: rng.next() < 0.5 ? '#40444f' : '#24262d', opacity: 0.8 }));
  } else {
    const n = style === 'snow' ? 18 : 22;
    for (let i = 0; i < n; i++) {
      const c = rng.next() < 0.55 ? p.roadMark : lighten(p.road, style === 'snow' ? 0.5 : 0.18);
      const rx = rng.range(1.5, style === 'glow' ? 3 : 4.5);
      marks.push(el('ellipse', { cx: rng.range(0, s), cy: rng.range(0, s), rx, ry: rx * rng.range(0.55, 0.9), fill: c, opacity: 0.85, transform: undefined }));
    }
    if (style === 'glow') for (let i = 0; i < 5; i++) marks.push(el('circle', { cx: rng.range(0, s), cy: rng.range(0, s), r: 1.6, fill: '#c4b5fd', opacity: 0.8 }));
  }
  return doc.pattern(s, s, marks.join(''));
}

/** Renders all paths. Each layer is drawn for every path before the next so crossings merge cleanly. */
export function roads(doc: SvgDoc, rng: Rng, p: ThemePalette, paths: Pt[][], w: number, detail: boolean): string {
  const ds = paths.map(polyD);
  const layer = (fn: (d: string) => string) => ds.map(fn).join('');
  const out: string[] = [];
  const style = p.roadStyle;
  out.push(g({ transform: 'translate(4 10)', filter: doc.blur(9), opacity: 0.45 }, layer((d) => stroke(d, w + 22, '#000000'))));
  if (style === 'glow') out.push(g({ filter: doc.blur(14), opacity: 0.55 }, layer((d) => stroke(d, w + 40, '#8b5cf6'))));
  if (style === 'basalt') out.push(g({ filter: doc.blur(10), opacity: 0.5 }, layer((d) => stroke(d, w + 30, '#ff6a1a'))));
  out.push(layer((d) => stroke(d, w + 18, darken(p.roadEdge, 0.35))));
  if (style === 'metal') {
    out.push(layer((d) => stroke(d, w + 12, hazardPaint(doc))));
  } else {
    out.push(layer((d) => stroke(d, w + 12, p.roadEdge)));
    out.push(layer((d) => stroke(d, w + 6, lighten(p.roadEdge, 0.12))));
  }
  out.push(layer((d) => stroke(d, w, darken(p.road, 0.18))));
  out.push(layer((d) => stroke(d, w - 6, p.road)));
  if (detail) out.push(g({ opacity: style === 'metal' ? 1 : 0.75 }, layer((d) => stroke(d, w - 8, markTile(doc, rng, p)))));
  if (style === 'dirt' || style === 'mud' || style === 'snow') {
    out.push(g({ opacity: 0.16 }, layer((d) => stroke(d, w * 0.56, darken(p.road, 0.5)))));
    out.push(layer((d) => stroke(d, w * 0.42, p.road, { opacity: 0.85 })));
    if (detail) out.push(g({ opacity: 0.45 }, layer((d) => stroke(d, w * 0.42, markTile(doc, rng, p)))));
  }
  if (style === 'asphalt') {
    out.push(layer((d) => stroke(d, w - 10, '#e8ecf4', { opacity: 0.75 })));
    out.push(layer((d) => stroke(d, w - 14, p.road)));
    if (detail) out.push(g({ opacity: 0.8 }, layer((d) => stroke(d, w - 14, markTile(doc, rng, p)))));
    out.push(layer((d) => stroke(d, 3.5, '#facc15', { 'stroke-dasharray': '26 22', 'stroke-linecap': 'butt', opacity: 0.9 })));
  }
  if (style === 'glow') out.push(layer((d) => stroke(d, 2, '#c4b5fd', { 'stroke-dasharray': '2 18', opacity: 0.9 })));
  out.push(g({ filter: doc.blur(6), opacity: 0.22 }, layer((d) => stroke(d, w * 0.35, lighten(p.road, 0.5)))));
  return out.join('');
}
