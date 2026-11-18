import { describe, expect, it } from 'vitest';
import { MIXED, NO_LASER, runBot } from './bot';

/**
 * Balance guard rails: scripted bots playing real content. If a content edit makes these fail,
 * the game got much harder (or broke) for an ordinary player; re-tune rather than loosen them.
 */
describe('balance', () => {
  it('a mixed generalist build wins Green Valley on Normal with lives to spare', () => {
    const r = runBot('green-valley', 'normal', MIXED);
    expect(r.won).toBe(true);
    expect(r.lives).toBeGreaterThanOrEqual(20);
    // no single boss wave takes the run on its own
    for (const w of r.waves) expect(w.livesBefore - w.livesAfter).toBeLessThan(70);
  }, 30_000);

  it('a build without lasers gets past the Iron Tick on Normal', () => {
    const r = runBot('green-valley', 'normal', NO_LASER, 21);
    expect(r.wave).toBe(21);
    expect(r.lives).toBeGreaterThan(0);
  }, 30_000);

  it('Easy is comfortable for the generalist', () => {
    const r = runBot('dune-canyon', 'easy', MIXED);
    expect(r.won).toBe(true);
    expect(r.lives).toBeGreaterThanOrEqual(120);
  }, 30_000);
});
