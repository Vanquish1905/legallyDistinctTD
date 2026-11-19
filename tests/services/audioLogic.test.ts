import { describe, expect, it } from 'vitest';
import { SfxGate, variation } from '../../src/services/sfxGate';
import { Playlist } from '../../src/services/playlist';
import { SFX_DEFS, TOWER_FIRE, EXPLOSION_SFX, ruleForGate } from '../../src/services/sfxCatalog';
import { SYNTH_CUES, cueDuration, renderCue } from '../../src/services/sfxSynth';
import { SFX } from '../../src/data/audioManifest';
import { TOWER_ORDER } from '../../src/data/towers';

describe('SfxGate', () => {
  it('enforces the minimum interval per key', () => {
    const g = new SfxGate(10, () => ({ minInterval: 0.1, maxVoices: 5 }));
    expect(g.tryAcquire('a', 0, 0.05)).toBe(true);
    expect(g.tryAcquire('a', 0.05, 0.05)).toBe(false);
    expect(g.tryAcquire('b', 0.05, 0.05)).toBe(true);
    expect(g.tryAcquire('a', 0.1, 0.05)).toBe(true);
  });

  it('caps overlapping voices per key until they end', () => {
    const g = new SfxGate(10, () => ({ minInterval: 0, maxVoices: 2 }));
    expect(g.tryAcquire('a', 0, 1)).toBe(true);
    expect(g.tryAcquire('a', 0.1, 1)).toBe(true);
    expect(g.tryAcquire('a', 0.2, 1)).toBe(false);
    expect(g.tryAcquire('a', 1.05, 1)).toBe(true); // the first voice ended at 1.0
  });

  it('caps voices globally', () => {
    const g = new SfxGate(3, () => ({ minInterval: 0, maxVoices: 10 }));
    expect(['a', 'b', 'c', 'd'].map((k) => g.tryAcquire(k, 0, 1))).toEqual([true, true, true, false]);
    expect(g.activeVoices(0.5)).toBe(3);
    expect(g.activeVoices(2)).toBe(0);
    expect(g.tryAcquire('d', 2, 1)).toBe(true);
  });

  it('throttles a 60 shots/s gatling to its fire interval', () => {
    const g = new SfxGate(16, ruleForGate);
    let played = 0;
    for (let i = 0; i < 60; i++) if (g.tryAcquire('fire:gatling', i / 60, 0.2)) played++;
    expect(played).toBeLessThanOrEqual(Math.ceil(1 / TOWER_FIRE.gatling!.interval));
    expect(played).toBeGreaterThan(3);
  });

  it('variation stays in range', () => {
    for (const x of [0, 0.5, 0.9999]) {
      const v = variation(() => x, 100, 0.1);
      expect(Math.abs(v.detune)).toBeLessThanOrEqual(100);
      expect(v.rate).toBeGreaterThanOrEqual(0.9);
      expect(v.rate).toBeLessThanOrEqual(1.1);
    }
  });
});

describe('Playlist', () => {
  const cfg = { pool: ['a', 'b', 'c'], menuTrack: 'm', bossTrack: 'boss', creditsTrack: 'cr' };

  it('plays fixed tracks on loop and the special moods', () => {
    const p = new Playlist(cfg);
    p.setTrackSetting('b');
    expect(p.trackFor('menu')).toEqual({ key: 'b', loop: true });
    expect(p.trackFor('game')).toEqual({ key: 'b', loop: true });
    expect(p.trackFor('boss')).toEqual({ key: 'boss', loop: true });
    expect(p.trackFor('credits')).toEqual({ key: 'cr', loop: true });
    expect(p.trackFor('silence')).toBeNull();
  });

  it('shuffles through every track before repeating, never twice in a row', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const p = new Playlist(cfg, rng);
    expect(p.trackFor('menu')).toEqual({ key: 'm', loop: true });
    const seq: string[] = [];
    for (let i = 0; i < 30; i++) {
      const peek = p.peekFor('game');
      const t = p.trackFor('game');
      expect(t?.loop).toBe(false);
      expect(t?.key).toBe(peek);
      seq.push(t!.key);
    }
    for (let i = 0; i < 30; i += 3) expect(new Set(seq.slice(i, i + 3)).size).toBe(3);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });
});

describe('sfx catalog and synth', () => {
  it('every catalog key is a recording or a synth cue, and every recording is cataloged', () => {
    const known = new Set([...SFX.map((s) => s.key), ...SYNTH_CUES.map((c) => `sfx-${c}`)]);
    for (const key of Object.keys(SFX_DEFS)) expect(known.has(key), key).toBe(true);
    for (const key of known) expect(SFX_DEFS[key], key).toBeDefined();
    for (const cue of Object.values(TOWER_FIRE)) expect(SFX_DEFS[cue.key]).toBeDefined();
    for (const key of Object.values(EXPLOSION_SFX)) expect(SFX_DEFS[key]).toBeDefined();
    for (const id of Object.keys(TOWER_FIRE)) expect(TOWER_ORDER).toContain(id);
  });

  it('renders every cue: right length, finite, quiet, deterministic', () => {
    for (const cue of SYNTH_CUES) {
      const a = renderCue(cue, 22050);
      expect(a.length).toBe(Math.ceil(cueDuration(cue) * 22050));
      let peak = 0;
      let finite = true;
      for (const s of a) {
        finite &&= Number.isFinite(s);
        peak = Math.max(peak, Math.abs(s));
      }
      expect(finite, cue).toBe(true);
      expect(peak, cue).toBeGreaterThan(0.05);
      expect(peak, cue).toBeLessThanOrEqual(0.45);
      expect(Math.abs(a[a.length - 1]!)).toBeLessThan(1e-3);
      const b = renderCue(cue, 22050);
      let same = b.length === a.length;
      for (let i = 0; i < a.length && same; i++) same = a[i] === b[i];
      expect(same, cue).toBe(true);
      expect(cueDuration(cue)).toBeLessThan(2);
    }
  });
});
