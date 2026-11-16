/** Global game constants shared by sim-adjacent code, scenes and UI. */

export const GAME_W = 1920;
export const GAME_H = 1080;
export const FIELD_W = 1540;
export const SIDEBAR_W = 380;
export const TOPBAR_H = 72;

/** Fixed simulation timestep in seconds. */
export const SIM_DT = 1 / 60;

export const FONT_FAMILY = "Rubik, system-ui, sans-serif";

/** Theme colors as hex strings (CSS) and numbers (Phaser graphics). */
export const COLORS = {
  background: '#0d1117',
  panel: '#121826',
  panelBorder: '#2f3b55',
  accent: '#38bdf8',
  gold: '#fbbf24',
  danger: '#f43f5e',
  ok: '#34d399',
  outline: '#1b1f2a',
  text: '#e6edf7',
  textDim: '#8b9bb8',
} as const;

export const COLORS_NUM = {
  background: 0x0d1117,
  panel: 0x121826,
  panelBorder: 0x2f3b55,
  accent: 0x38bdf8,
  gold: 0xfbbf24,
  danger: 0xf43f5e,
  ok: 0x34d399,
  outline: 0x1b1f2a,
} as const;

export const PANEL_ALPHA = 0.92;
export const PANEL_RADIUS = 14;
