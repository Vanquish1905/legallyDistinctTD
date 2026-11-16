import type { TargetMode } from './types';
import { TARGET_MODES } from './targeting';

/** Bump when the snapshot shape changes; older saves are rejected. */
export const SNAPSHOT_VERSION = 1;

/** One placed tower in a save. */
export interface TowerSnapshot {
  uid: number;
  towerId: string;
  x: number;
  y: number;
  tiers: [number, number];
  spent: number;
  placedBuildWave: number;
  targetMode: TargetMode;
  kills: number;
  damageDealt: number;
  memory: Record<string, number>;
}

/**
 * JSON-safe game state between waves (build phase only: no enemies or projectiles are in
 * flight). Restoring recomputes tower stats from their tiers.
 */
export interface SimSnapshot {
  version: number;
  mapId: string;
  difficultyId: string;
  seed: number;
  rngState: number;
  money: number;
  lives: number;
  wave: number;
  time: number;
  freeplay: boolean;
  nextUid: number;
  towers: TowerSnapshot[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isTowerSnapshot(v: unknown): v is TowerSnapshot {
  if (!isRecord(v)) return false;
  const tiers = v.tiers;
  const memory = v.memory;
  return isNum(v.uid) && typeof v.towerId === 'string' && isNum(v.x) && isNum(v.y)
    && Array.isArray(tiers) && tiers.length === 2 && tiers.every(isNum)
    && isNum(v.spent) && isNum(v.placedBuildWave) && isNum(v.kills) && isNum(v.damageDealt)
    && TARGET_MODES.includes(v.targetMode as TargetMode)
    && isRecord(memory) && Object.values(memory).every(isNum);
}

/** Validate untrusted data (e.g. from localStorage) as a current-version snapshot. */
export function isSimSnapshot(v: unknown): v is SimSnapshot {
  if (!isRecord(v)) return false;
  return v.version === SNAPSHOT_VERSION && typeof v.mapId === 'string' && typeof v.difficultyId === 'string'
    && isNum(v.seed) && isNum(v.rngState) && isNum(v.money) && isNum(v.lives) && isNum(v.wave)
    && isNum(v.time) && typeof v.freeplay === 'boolean' && isNum(v.nextUid)
    && Array.isArray(v.towers) && v.towers.every(isTowerSnapshot);
}
