/** Map geometry the background generator needs (a subset of MapDef from src/data/maps.ts). */
import type { Pt } from '../lib/shapes';

export const THEMES = ['meadow', 'desert', 'snow', 'volcano', 'swamp', 'lab', 'crystal', 'city'] as const;
export type Theme = (typeof THEMES)[number];

export interface Blocker {
  x: number;
  y: number;
  r: number;
}

export interface MapArtInput {
  id: string;
  theme: Theme;
  paths: Pt[][];
  pathWidth: number;
  decorSeed: number;
  blockers?: Blocker[];
}

export const MAP_W = 1540;
export const MAP_H = 1080;
export const THUMB_W = 384;
export const THUMB_H = 216;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isPt(v: unknown): v is Pt {
  return isRecord(v) && typeof v.x === 'number' && typeof v.y === 'number';
}

function isBlocker(v: unknown): v is Blocker {
  return isPt(v) && isRecord(v) && typeof v.r === 'number';
}

function toMap(v: unknown, i: number): MapArtInput {
  if (!isRecord(v)) throw new Error(`MAPS[${i}] is not an object`);
  const { id, theme, paths, pathWidth, decorSeed, blockers } = v;
  if (typeof id !== 'string') throw new Error(`MAPS[${i}].id missing`);
  if (typeof theme !== 'string' || !(THEMES as readonly string[]).includes(theme)) throw new Error(`map ${id}: bad theme`);
  if (!Array.isArray(paths) || !paths.every((p) => Array.isArray(p) && p.every(isPt))) throw new Error(`map ${id}: bad paths`);
  if (blockers !== undefined && !(Array.isArray(blockers) && blockers.every(isBlocker))) throw new Error(`map ${id}: bad blockers`);
  return {
    id,
    theme: theme as Theme,
    paths: paths as Pt[][],
    pathWidth: typeof pathWidth === 'number' ? pathWidth : 64,
    decorSeed: typeof decorSeed === 'number' ? decorSeed : 1,
    blockers: blockers as Blocker[] | undefined,
  };
}

/** Validates the dynamically imported src/data/maps.ts module and returns its maps. */
export function parseMaps(mod: unknown): MapArtInput[] {
  if (!isRecord(mod) || !Array.isArray(mod.MAPS)) throw new Error('src/data/maps.ts must export MAPS: MapDef[]');
  return mod.MAPS.map(toMap);
}
