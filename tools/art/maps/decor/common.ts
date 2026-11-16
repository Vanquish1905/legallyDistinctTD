/** Shared helpers for map decor drawers. */
import type { Rng } from '../../lib/rng';
import { OUTLINE } from '../../lib/palette';
import { el, type SvgDoc } from '../../lib/svg';

/** Draws one decor item centred at (x, y) with size multiplier s. */
export type DecorDraw = (doc: SvgDoc, rng: Rng, x: number, y: number, s: number) => string;

export interface DecorKind {
  /** Footprint radius at s = 1 (used for spacing and path clearance). */
  r: number;
  weight: number;
  draw: DecorDraw;
  /** Size multiplier range. */
  scale?: [number, number];
}

export interface ThemeDecor {
  large: DecorKind[];
  small: DecorKind[];
  largeCount: number;
  smallCount: number;
}

/** Soft cast shadow offset down-right (light from top-left). */
export function castShadow(doc: SvgDoc, x: number, y: number, rx: number, ry: number, opacity = 0.32): string {
  return el('ellipse', { cx: x + rx * 0.25, cy: y + ry * 0.45, rx, ry, fill: '#000000', opacity, filter: doc.blur(5) });
}

/**
 * Draws several path shapes as one silhouette: a thick dark stroke under all of them,
 * then the fills on top, so the outline wraps the union.
 */
export function union(shapes: { d: string; fill: string; opacity?: number }[], outline = 5, color = OUTLINE): string {
  const under = shapes.map((s) => el('path', { d: s.d, fill: color, stroke: color, 'stroke-width': outline, 'stroke-linejoin': 'round' })).join('');
  const over = shapes.map((s) => el('path', { d: s.d, fill: s.fill, opacity: s.opacity })).join('');
  return under + over;
}
