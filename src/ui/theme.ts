/**
 * UI design tokens (Global Constraint 10) and text helpers shared by every UI component.
 * Colors come as numbers (Graphics/tints) and CSS strings (Text). Spacing is on an 8 px grid.
 */
import type Phaser from 'phaser';
import { FONT_FAMILY } from '../config';

/** Numeric colors for Graphics fills, strokes and tints. */
export const UI = {
  panel: 0x121826,
  panelAlpha: 0.92,
  border: 0x2f3b55,
  /** Raised surfaces inside panels (cards, buttons). */
  surface: 0x1a2234,
  surfaceHover: 0x222d44,
  surfacePressed: 0x161d2c,
  /** Recessed tracks (segmented controls, bars). */
  track: 0x0b101b,
  accent: 0x38bdf8,
  accentDeep: 0x0e7fb5,
  gold: 0xfbbf24,
  goldDeep: 0xb7791f,
  danger: 0xf43f5e,
  dangerDeep: 0xa21c3a,
  ok: 0x34d399,
  okDeep: 0x13895f,
  text: 0xe6edf7,
  textDim: 0x8b9bb8,
  textMute: 0x5b6a86,
  shadow: 0x000000,
  white: 0xffffff,
} as const;

/** CSS colors for Text objects (same palette as `UI`). */
export const CSS = {
  text: '#e6edf7',
  textDim: '#8b9bb8',
  textMute: '#5b6a86',
  accent: '#38bdf8',
  gold: '#fbbf24',
  danger: '#f43f5e',
  ok: '#34d399',
  dark: '#0b101b',
} as const;

/** Corner radii (px). */
export const RADIUS = { panel: 14, button: 12, chip: 10, small: 8 } as const;

/** 8 px spacing grid: `space(2)` = 16. */
export function space(steps: number): number {
  return steps * 8;
}

/** Minimum touch target edge (px at the 1920×1080 logical size). */
export const HIT_MIN = 56;

/** Animation durations (ms). */
export const DURATION = { fast: 110, normal: 200, slow: 320 } as const;

/** Font sizes (px). */
export const FONT = { xs: 14, sm: 16, md: 18, lg: 22, xl: 28, xxl: 40, huge: 64 } as const;

/** Font weights available from Google Fonts (index.html loads 400, 500, 700). */
export type FontWeight = 400 | 500 | 700;

/**
 * Text texture resolution: 2 on high-DPI screens so text stays crisp when the canvas is shown
 * larger than its 1920×1080 backing size, 1 otherwise (saves texture memory).
 */
export const TEXT_RESOLUTION = typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1 ? 2 : 1;

/** Options for `textStyle`. */
export interface TextOptions {
  color?: string;
  weight?: FontWeight;
  /** Word wrap width in px. */
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  lineSpacing?: number;
  /** Soft dark shadow under the glyphs (for text drawn over the map). */
  shadow?: boolean;
}

/** A Phaser text style in the UI font. */
export function textStyle(size: number, o: TextOptions = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: o.weight && o.weight !== 400 ? String(o.weight) : 'normal',
    color: o.color ?? CSS.text,
    align: o.align ?? 'left',
    resolution: TEXT_RESOLUTION,
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.lineSpacing !== undefined) style.lineSpacing = o.lineSpacing;
  if (o.shadow) style.shadow = { offsetX: 0, offsetY: 2, color: '#000000', blur: 6, fill: true };
  return style;
}

/** Add a UI text object (origin defaults to top-left). */
export function addText(
  scene: Phaser.Scene, x: number, y: number, text: string, size: number, o: TextOptions = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, textStyle(size, o));
}

/** `#rrggbb` for a numeric color. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
