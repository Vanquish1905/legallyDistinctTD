/** Shared palette for all generated art (Global Constraint 10). */

export const OUTLINE = '#1b1f2a';

export const METAL = {
  light: '#9aabc4',
  mid: '#66768f',
  dark: '#434f66',
  deep: '#2a3242',
} as const;

export const CATEGORY_COLOR = {
  basic: '#38bdf8',
  magic: '#a78bfa',
  heavy: '#fb923c',
  support: '#34d399',
} as const;

export type Category = keyof typeof CATEGORY_COLOR;

export const UI = {
  accent: '#38bdf8',
  gold: '#fbbf24',
  danger: '#f43f5e',
  ok: '#34d399',
  text: '#e6edf7',
  panel: '#121826',
} as const;
