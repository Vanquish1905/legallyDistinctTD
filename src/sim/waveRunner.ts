import type { SpawnEvent } from './WaveSource';

/** A wave whose spawns are being released. */
interface ActiveWave {
  wave: number;
  spawns: readonly SpawnEvent[];
  cursor: number;
  elapsed: number;
}

/**
 * Releases the spawns of running waves on schedule. Several waves can run at once (calling the
 * next wave early); each is cleared on its own once fully spawned and all its enemies are gone.
 */
export class WaveRunner {
  private readonly active: ActiveWave[] = [];

  /** Whether any wave is still running. */
  get running(): boolean {
    return this.active.length > 0;
  }

  /** Number of waves currently running. */
  get count(): number {
    return this.active.length;
  }

  /** Seconds until the most recently started wave has released its last spawn (0 when none). */
  remainingSpawnTime(): number {
    const w = this.active[this.active.length - 1];
    const last = w?.spawns[w.spawns.length - 1];
    return w && last ? Math.max(0, last.at - w.elapsed) : 0;
  }

  /** Begin releasing a wave's spawns. */
  start(wave: number, spawns: readonly SpawnEvent[]): void {
    this.active.push({ wave, spawns, cursor: 0, elapsed: 0 });
  }

  /** Advance time and call `spawn` for every event that became due. */
  update(dt: number, spawn: (ev: SpawnEvent, wave: number) => void): void {
    for (const w of this.active) {
      w.elapsed += dt;
      while (w.cursor < w.spawns.length) {
        const ev = w.spawns[w.cursor] as SpawnEvent;
        if (ev.at > w.elapsed) break;
        w.cursor++;
        spawn(ev, w.wave);
      }
    }
  }

  /**
   * Remove and return (in start order) the waves that are fully spawned and have no enemies left.
   */
  takeCleared(aliveInWave: (wave: number) => number): number[] {
    const cleared: number[] = [];
    for (let i = 0; i < this.active.length; i++) {
      const w = this.active[i] as ActiveWave;
      if (w.cursor >= w.spawns.length && aliveInWave(w.wave) === 0) {
        cleared.push(w.wave);
        this.active.splice(i, 1);
        i--;
      }
    }
    return cleared;
  }
}
