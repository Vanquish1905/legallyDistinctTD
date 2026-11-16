/**
 * The seam between the sim and wave content. `GameSim` asks a `WaveSource` for the spawn list of
 * a wave when it starts and for the money it pays; scheduling, wave-clear tracking and win/lose
 * stay inside the sim. The real content-driven source is the WaveManager; `ScriptedWaveSource`
 * is a fixed list (tests, tutorial).
 */

/** One enemy to spawn, `at` seconds after its wave started. */
export interface SpawnEvent {
  enemyId: string;
  at: number;
  /** Map path to walk (wrapped to the map's path count). */
  pathIndex: number;
  /** Extra HP multiplier on top of difficulty (e.g. freeplay scaling). */
  hpMul?: number;
}

/** Supplies waves to the sim. Must be deterministic for a given wave number. */
export interface WaveSource {
  /** Spawns for 1-based `wave`, sorted by `at`. */
  spawnsFor(wave: number, pathCount: number): readonly SpawnEvent[];
  /** Money paid when `wave` is cleared. */
  clearBonus(wave: number): number;
  /** Money paid for calling `wave` while the previous one is still running. */
  earlyStartBonus(wave: number): number;
}

/** Money rules for `ScriptedWaveSource`. */
export interface ScriptedBonuses {
  clearBonus?: (wave: number) => number;
  earlyStartBonus?: (wave: number) => number;
}

/** Fixed, hand-written waves. Waves past the list are empty. */
export class ScriptedWaveSource implements WaveSource {
  constructor(
    private readonly waves: readonly (readonly SpawnEvent[])[],
    private readonly bonuses: ScriptedBonuses = {},
  ) {}

  spawnsFor(wave: number): readonly SpawnEvent[] {
    const list = this.waves[wave - 1] ?? [];
    return [...list].sort((a, b) => a.at - b.at);
  }

  clearBonus(wave: number): number {
    return this.bonuses.clearBonus?.(wave) ?? 0;
  }

  earlyStartBonus(wave: number): number {
    return this.bonuses.earlyStartBonus?.(wave) ?? 0;
  }
}
