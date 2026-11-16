/** Blockers drawn as recessed liquid pools (water, ice holes, lava, toxic goo, crystal pools). */
import { darken, lighten, mix } from '../lib/color';
import type { Rng } from '../lib/rng';
import { blob } from '../lib/shapes';
import { el, g, type SvgDoc } from '../lib/svg';
import type { ThemePalette } from './theme';
import type { Blocker, Theme } from './types';

function pool(doc: SvgDoc, rng: Rng, p: ThemePalette, theme: Theme, b: Blocker): string {
  const { deep, shallow, rim, shine, glow } = p.liquid;
  const shape = blob(rng, b.x, b.y, b.r, 0.1, 11);
  const rimShape = blob(rng, b.x, b.y, b.r + 13, 0.09, 11);
  const out: string[] = [];
  if (glow) out.push(el('path', { d: blob(rng, b.x, b.y, b.r + 34, 0.1, 9), fill: shallow, opacity: 0.4, filter: doc.blur(18) }));
  out.push(el('path', { d: rimShape, fill: '#000000', opacity: 0.3, transform: 'translate(3 7)', filter: doc.blur(6) }));
  out.push(el('path', { d: rimShape, fill: doc.shade(rim, 0.22), stroke: darken(rim, 0.45), 'stroke-width': 3 }));
  const clip = doc.clip(el('path', { d: shape }));
  const body = doc.radial([[0, deep], [0.75, mix(deep, shallow, 0.5)], [1, shallow]], 0.5, 0.55, 0.55);
  const inner: string[] = [el('rect', { x: b.x - b.r * 1.3, y: b.y - b.r * 1.3, width: b.r * 2.6, height: b.r * 2.6, fill: body })];
  inner.push(el('path', { d: shape, fill: 'none', stroke: darken(deep, 0.6), 'stroke-width': 18, opacity: 0.55, transform: 'translate(0 9)', filter: doc.blur(5) }));
  if (glow) {
    for (let i = 0; i < Math.max(4, Math.round(b.r / 10)); i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, b.r * 0.7);
      const r = rng.range(2, 6);
      inner.push(el('circle', { cx: b.x + Math.cos(a) * d, cy: b.y + Math.sin(a) * d, r, fill: lighten(shallow, 0.4), opacity: 0.8, stroke: shine, 'stroke-width': 1 }));
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const y = b.y - b.r * 0.35 + i * b.r * 0.32;
      const w = b.r * (0.5 - i * 0.1);
      inner.push(el('path', { d: `M${b.x - w},${y} q${w / 2},-5 ${w},0 t${w},0`, fill: 'none', stroke: shine, 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.5 - i * 0.1 }));
    }
  }
  out.push(g({ 'clip-path': clip }, inner));
  out.push(el('path', { d: shape, fill: 'none', stroke: darken(rim, 0.55), 'stroke-width': 3 }));
  if (theme === 'snow') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const x = b.x + Math.cos(a) * (b.r + 6);
      const y = b.y + Math.sin(a) * (b.r + 6);
      const s = rng.range(6, 12);
      out.push(el('polygon', { points: `${x - s},${y} ${x},${y - s * 0.6} ${x + s * 0.8},${y + s * 0.2} ${x - s * 0.2},${y + s * 0.6}`, fill: '#f4fbff', stroke: '#9bb8d3', 'stroke-width': 1.5, opacity: 0.95 }));
    }
  }
  out.push(el('ellipse', { cx: b.x - b.r * 0.35, cy: b.y - b.r * 0.4, rx: b.r * 0.22, ry: b.r * 0.08, fill: '#ffffff', opacity: 0.35, transform: `rotate(-25 ${b.x - b.r * 0.35} ${b.y - b.r * 0.4})` }));
  return out.join('');
}

/** All blockers of a map. */
export function blockers(doc: SvgDoc, rng: Rng, p: ThemePalette, theme: Theme, list: Blocker[]): string {
  return list.map((b) => pool(doc, rng, p, theme, b)).join('');
}
