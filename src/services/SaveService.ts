import type { DifficultyDef } from '../sim/types';
import { isSimSnapshot, type SimSnapshot } from '../sim/snapshot';
import { MAP_ORDER } from '../data/maps';
import { DIFFICULTY_ORDER } from '../data/difficulty';
import { getDefaultStore, readVersioned, removeKey, writeVersioned, type KeyValueStore } from './storage';

export type DifficultyId = DifficultyDef['id'];

/** Medal for winning a map: bronze = Easy, silver = Normal, gold = Hard or Nightmare. */
export type Medal = 'bronze' | 'silver' | 'gold';

/** Best result on one map at one difficulty. */
export interface DifficultyProgress {
  /** Highest wave cleared (0 = none). */
  bestWave: number;
  won: boolean;
}

/** All persisted progress: mapId → difficulty → result. */
export interface ProgressData {
  maps: Record<string, Partial<Record<DifficultyId, DifficultyProgress>>>;
}

/** The single "Continue" slot. */
export interface AutosaveSlot {
  mapId: string;
  difficulty: DifficultyId;
  /** Waves cleared when saved (same as `snapshot.wave`). */
  wave: number;
  /** `Date.now()` at save time. */
  savedAt: number;
  snapshot: SimSnapshot;
}

/** What `recordResult` changed. */
export interface ResultOutcome {
  /** Medal earned by this game (null on defeat). */
  medal: Medal | null;
  /** True when the best wave or win state for this map/difficulty improved. */
  improved: boolean;
  /** Maps that became playable because of this game. */
  newlyUnlocked: string[];
}

export const PROGRESS_KEY = 'ldtd.progress';
export const PROGRESS_VERSION = 1;
export const AUTOSAVE_KEY = 'ldtd.autosave';
export const AUTOSAVE_VERSION = 1;

/** Maps unlocked from the start: the tutorial plus the first three real maps. */
export const INITIAL_UNLOCKED = 4;

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };

/** The medal a win on `difficulty` earns. */
export function medalForDifficulty(difficulty: DifficultyId): Medal {
  if (difficulty === 'easy') return 'bronze';
  if (difficulty === 'normal') return 'silver';
  return 'gold';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Options for tests; defaults are the real map/difficulty lists and `Date.now`. */
export interface SaveServiceOptions {
  mapOrder?: readonly string[];
  difficulties?: readonly DifficultyId[];
  now?: () => number;
}

/**
 * Progress (best waves, wins, medals, unlocks) and the autosave slot, persisted as versioned
 * JSON. Corrupt or outdated data is ignored (defaults), nothing here throws. Pure TS.
 */
export class SaveService {
  private readonly mapOrder: readonly string[];
  private readonly difficulties: readonly DifficultyId[];
  private readonly now: () => number;
  private progress: ProgressData;

  constructor(private readonly store: KeyValueStore, opts: SaveServiceOptions = {}) {
    this.mapOrder = opts.mapOrder ?? MAP_ORDER;
    this.difficulties = opts.difficulties ?? DIFFICULTY_ORDER;
    this.now = opts.now ?? Date.now;
    this.progress = readVersioned(store, PROGRESS_KEY, PROGRESS_VERSION, (d) => this.sanitizeProgress(d)) ?? { maps: {} };
  }

  // ---- progress -----------------------------------------------------------------------------

  /** Best result on a map at a difficulty, or undefined when never played. */
  result(mapId: string, difficulty: DifficultyId): Readonly<DifficultyProgress> | undefined {
    return this.progress.maps[mapId]?.[difficulty];
  }

  /** Whether the map has been won on any difficulty. */
  isBeaten(mapId: string): boolean {
    const m = this.progress.maps[mapId];
    return !!m && this.difficulties.some((d) => m[d]?.won === true);
  }

  /** Best medal on a map (null when never won). */
  bestMedal(mapId: string): Medal | null {
    let best: Medal | null = null;
    for (const d of this.difficulties) {
      if (!this.result(mapId, d)?.won) continue;
      const m = medalForDifficulty(d);
      if (!best || MEDAL_RANK[m] > MEDAL_RANK[best]) best = m;
    }
    return best;
  }

  /**
   * Whether a map can be played: the tutorial and the first three maps always, every later map
   * once the map before it (in MAP_ORDER) was won on any difficulty. Unknown maps are locked.
   */
  isUnlocked(mapId: string): boolean {
    const i = this.mapOrder.indexOf(mapId);
    if (i < 0) return false;
    if (i < INITIAL_UNLOCKED) return true;
    const prev = this.mapOrder[i - 1];
    return prev !== undefined && this.isBeaten(prev);
  }

  /** All playable map ids, in map order. */
  unlockedMaps(): string[] {
    return this.mapOrder.filter((id) => this.isUnlocked(id));
  }

  /** Raise the best wave reached (called while playing, e.g. on autosave). */
  recordWave(mapId: string, difficulty: DifficultyId, wave: number): void {
    if (!this.known(mapId, difficulty)) return;
    const cur = this.entry(mapId, difficulty);
    if (wave <= cur.bestWave) return;
    cur.bestWave = Math.floor(wave);
    this.saveProgress();
  }

  /** Record a finished game (win or defeat). Clears nothing else; see `clearAutosave`. */
  recordResult(r: { mapId: string; difficulty: DifficultyId; wave: number; won: boolean }): ResultOutcome {
    if (!this.known(r.mapId, r.difficulty)) return { medal: null, improved: false, newlyUnlocked: [] };
    const before = new Set(this.unlockedMaps());
    const cur = this.entry(r.mapId, r.difficulty);
    let improved = false;
    if (r.wave > cur.bestWave) {
      cur.bestWave = Math.floor(r.wave);
      improved = true;
    }
    if (r.won && !cur.won) {
      cur.won = true;
      improved = true;
    }
    if (improved) this.saveProgress();
    return {
      medal: r.won ? medalForDifficulty(r.difficulty) : null,
      improved,
      newlyUnlocked: this.unlockedMaps().filter((id) => !before.has(id)),
    };
  }

  /** Forget all progress (not settings). */
  resetProgress(): void {
    this.progress = { maps: {} };
    removeKey(this.store, PROGRESS_KEY);
  }

  // ---- autosave -----------------------------------------------------------------------------

  /** Save a between-waves snapshot into the Continue slot (and raise the best wave). */
  writeAutosave(snapshot: SimSnapshot): void {
    const difficulty = snapshot.difficultyId as DifficultyId;
    if (!this.known(snapshot.mapId, difficulty)) return;
    const slot: AutosaveSlot = { mapId: snapshot.mapId, difficulty, wave: snapshot.wave, savedAt: this.now(), snapshot };
    writeVersioned(this.store, AUTOSAVE_KEY, AUTOSAVE_VERSION, slot);
    this.recordWave(snapshot.mapId, difficulty, snapshot.wave);
  }

  /**
   * The Continue slot, or null. An invalid slot (corrupt, old snapshot version, map or
   * difficulty no longer existing) is deleted.
   */
  getAutosave(): AutosaveSlot | null {
    const slot = readVersioned(this.store, AUTOSAVE_KEY, AUTOSAVE_VERSION, (d) => this.validateSlot(d));
    if (!slot) removeKey(this.store, AUTOSAVE_KEY);
    return slot;
  }

  /** Whether a valid Continue slot exists. */
  hasAutosave(): boolean {
    return this.getAutosave() !== null;
  }

  /** Empty the Continue slot (on win, defeat, or starting over). */
  clearAutosave(): void {
    removeKey(this.store, AUTOSAVE_KEY);
  }

  // ---- internals ----------------------------------------------------------------------------

  private known(mapId: string, difficulty: string): difficulty is DifficultyId {
    return this.mapOrder.includes(mapId) && this.difficulties.includes(difficulty as DifficultyId);
  }

  private entry(mapId: string, difficulty: DifficultyId): DifficultyProgress {
    const m = (this.progress.maps[mapId] ??= {});
    return (m[difficulty] ??= { bestWave: 0, won: false });
  }

  private saveProgress(): void {
    writeVersioned(this.store, PROGRESS_KEY, PROGRESS_VERSION, this.progress);
  }

  private validateSlot(d: unknown): AutosaveSlot | null {
    if (!isRecord(d)) return null;
    const { mapId, difficulty, wave, savedAt, snapshot } = d;
    if (typeof mapId !== 'string' || typeof difficulty !== 'string' || !this.known(mapId, difficulty)) return null;
    if (typeof wave !== 'number' || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (!isSimSnapshot(snapshot)) return null;
    if (snapshot.mapId !== mapId || snapshot.difficultyId !== difficulty || snapshot.wave !== wave) return null;
    return { mapId, difficulty, wave, savedAt, snapshot };
  }

  /** Keep only well-formed entries for known maps and difficulties. */
  private sanitizeProgress(d: unknown): ProgressData | null {
    if (!isRecord(d) || !isRecord(d.maps)) return null;
    const maps: ProgressData['maps'] = {};
    for (const [mapId, perDiff] of Object.entries(d.maps)) {
      if (!this.mapOrder.includes(mapId) || !isRecord(perDiff)) continue;
      const out: Partial<Record<DifficultyId, DifficultyProgress>> = {};
      for (const diff of this.difficulties) {
        const e = perDiff[diff];
        if (!isRecord(e)) continue;
        const bestWave = typeof e.bestWave === 'number' && Number.isFinite(e.bestWave) ? Math.max(0, Math.floor(e.bestWave)) : 0;
        out[diff] = { bestWave, won: e.won === true };
      }
      maps[mapId] = out;
    }
    return { maps };
  }
}

let shared: SaveService | null = null;

/** The app-wide save service, backed by localStorage (or memory when unavailable). */
export function getSaveService(): SaveService {
  shared ??= new SaveService(getDefaultStore());
  return shared;
}
