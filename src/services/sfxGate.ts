/**
 * Voice limiting for sound effects (pure logic, no audio). Each throttle key has a minimum
 * interval between starts and a maximum number of overlapping voices; on top of that a global
 * cap bounds all voices (iOS Safari crackles or drops audio with too many buffer sources).
 * Voices are tracked by their expected end time, so no completion callbacks are needed.
 */

/** Limits for one throttle key. Times in seconds. */
export interface SfxRule {
  minInterval: number;
  maxVoices: number;
}

export const DEFAULT_SFX_RULE: SfxRule = { minInterval: 0.05, maxVoices: 3 };

interface KeyState {
  lastStart: number;
  /** End times of voices still sounding (unsorted, small). */
  ends: number[];
}

/** Decides whether a sound may start now. */
export class SfxGate {
  private readonly keys = new Map<string, KeyState>();
  private globalEnds: number[] = [];

  constructor(
    private readonly globalMax: number,
    private readonly ruleFor: (key: string) => SfxRule = () => DEFAULT_SFX_RULE,
  ) {}

  /**
   * Try to start a voice of `duration` s for `key` at time `now` (s). Returns true (and
   * records the voice) when every limit allows it.
   */
  tryAcquire(key: string, now: number, duration: number): boolean {
    const rule = this.ruleFor(key);
    let st = this.keys.get(key);
    if (!st) {
      st = { lastStart: -Infinity, ends: [] };
      this.keys.set(key, st);
    }
    if (now - st.lastStart < rule.minInterval) return false;
    prune(st.ends, now);
    if (st.ends.length >= rule.maxVoices) return false;
    prune(this.globalEnds, now);
    if (this.globalEnds.length >= this.globalMax) return false;
    const end = now + Math.max(0.01, duration);
    st.lastStart = now;
    st.ends.push(end);
    this.globalEnds.push(end);
    return true;
  }

  /** Number of voices sounding at `now` (global). */
  activeVoices(now: number): number {
    prune(this.globalEnds, now);
    return this.globalEnds.length;
  }

  /** Forget all voices (e.g. after stopping every sound). */
  reset(): void {
    this.keys.clear();
    this.globalEnds = [];
  }
}

/** Remove end times that are past, in place, without allocating. */
function prune(ends: number[], now: number): void {
  let w = 0;
  for (let i = 0; i < ends.length; i++) {
    const e = ends[i]!;
    if (e > now) ends[w++] = e;
  }
  ends.length = w;
}

/**
 * Random variation for repeated sounds: a detune in cents within ±`cents` and a playback rate
 * within 1 ± `rate`. `rng` returns [0, 1).
 */
export function variation(rng: () => number, cents: number, rate: number): { detune: number; rate: number } {
  return { detune: (rng() * 2 - 1) * cents, rate: 1 + (rng() * 2 - 1) * rate };
}
