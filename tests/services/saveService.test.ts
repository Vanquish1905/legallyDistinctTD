import { describe, expect, it } from 'vitest';
import { GameSim } from '../../src/sim/GameSim';
import type { SimSnapshot } from '../../src/sim/snapshot';
import { getMap, MAP_ORDER } from '../../src/data/maps';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { MemoryStore, writeVersioned } from '../../src/services/storage';
import {
  AUTOSAVE_KEY, AUTOSAVE_VERSION, PROGRESS_KEY, PROGRESS_VERSION, SaveService, medalForDifficulty,
} from '../../src/services/SaveService';

function snapshot(mapId = 'green-valley', difficulty: keyof typeof DIFFICULTIES = 'normal', wave = 3): SimSnapshot {
  const map = getMap(mapId);
  if (!map) throw new Error('missing map');
  const sim = new GameSim({ map, difficulty: DIFFICULTIES[difficulty], seed: 11 });
  sim.grantMoney(500);
  sim.placeTower('blaster', 420, 330);
  return { ...sim.snapshot(), wave };
}

describe('SaveService progress', () => {
  it('unlocks the tutorial and the first three maps only', () => {
    const s = new SaveService(new MemoryStore());
    expect(s.unlockedMaps()).toEqual(MAP_ORDER.slice(0, 4));
    expect(s.isUnlocked(MAP_ORDER[4]!)).toBe(false);
    expect(s.isUnlocked('no-such-map')).toBe(false);
  });

  it('beating a map on any difficulty unlocks the next one', () => {
    const s = new SaveService(new MemoryStore());
    const third = MAP_ORDER[3]!;
    const fourth = MAP_ORDER[4]!;
    const lost = s.recordResult({ mapId: third, difficulty: 'easy', wave: 12, won: false });
    expect(lost).toEqual({ medal: null, improved: true, newlyUnlocked: [] });
    expect(s.isUnlocked(fourth)).toBe(false);
    const won = s.recordResult({ mapId: third, difficulty: 'easy', wave: 30, won: true });
    expect(won.medal).toBe('bronze');
    expect(won.newlyUnlocked).toEqual([fourth]);
    expect(s.isUnlocked(fourth)).toBe(true);
    expect(s.isUnlocked(MAP_ORDER[5]!)).toBe(false);
  });

  it('keeps best waves, wins and the best medal', () => {
    const s = new SaveService(new MemoryStore());
    s.recordResult({ mapId: 'green-valley', difficulty: 'hard', wave: 20, won: false });
    s.recordResult({ mapId: 'green-valley', difficulty: 'hard', wave: 10, won: false });
    expect(s.result('green-valley', 'hard')).toEqual({ bestWave: 20, won: false });
    expect(s.bestMedal('green-valley')).toBeNull();
    s.recordResult({ mapId: 'green-valley', difficulty: 'normal', wave: 40, won: true });
    expect(s.bestMedal('green-valley')).toBe('silver');
    s.recordResult({ mapId: 'green-valley', difficulty: 'easy', wave: 30, won: true });
    expect(s.bestMedal('green-valley')).toBe('silver');
    const again = s.recordResult({ mapId: 'green-valley', difficulty: 'normal', wave: 40, won: true });
    expect(again.improved).toBe(false);
    s.recordResult({ mapId: 'green-valley', difficulty: 'nightmare', wave: 60, won: true });
    expect(s.bestMedal('green-valley')).toBe('gold');
  });

  it('medals map to difficulties', () => {
    expect(['easy', 'normal', 'hard', 'nightmare'].map((d) => medalForDifficulty(d as 'easy'))).toEqual(['bronze', 'silver', 'gold', 'gold']);
  });

  it('persists progress and ignores unknown maps/difficulties', () => {
    const store = new MemoryStore();
    const a = new SaveService(store);
    a.recordResult({ mapId: 'dune-canyon', difficulty: 'normal', wave: 40, won: true });
    a.recordResult({ mapId: 'atlantis', difficulty: 'normal', wave: 40, won: true });
    a.recordWave('dune-canyon', 'hard', 7);
    const b = new SaveService(store);
    expect(b.isBeaten('dune-canyon')).toBe(true);
    expect(b.result('dune-canyon', 'hard')?.bestWave).toBe(7);
    expect(b.result('atlantis', 'normal')).toBeUndefined();
  });

  it('ignores corrupt progress and keeps the valid parts of damaged progress', () => {
    const store = new MemoryStore();
    store.setItem(PROGRESS_KEY, 'garbage');
    expect(new SaveService(store).unlockedMaps()).toEqual(MAP_ORDER.slice(0, 4));
    writeVersioned(store, PROGRESS_KEY, PROGRESS_VERSION, {
      maps: { 'green-valley': { easy: { bestWave: 'x', won: true }, hard: 5, bogus: { bestWave: 3, won: true } }, atlantis: {} },
    });
    const s = new SaveService(store);
    expect(s.result('green-valley', 'easy')).toEqual({ bestWave: 0, won: true });
    expect(s.result('green-valley', 'hard')).toBeUndefined();
    expect(s.isBeaten('green-valley')).toBe(true);
  });

  it('resetProgress forgets everything', () => {
    const store = new MemoryStore();
    const s = new SaveService(store);
    s.recordResult({ mapId: 'green-valley', difficulty: 'easy', wave: 30, won: true });
    s.resetProgress();
    expect(s.isBeaten('green-valley')).toBe(false);
    expect(new SaveService(store).isBeaten('green-valley')).toBe(false);
  });
});

describe('SaveService autosave', () => {
  it('writes, reads and clears the continue slot', () => {
    const store = new MemoryStore();
    const s = new SaveService(store, { now: () => 1234 });
    expect(s.getAutosave()).toBeNull();
    const snap = snapshot('green-valley', 'hard', 4);
    s.writeAutosave(snap);
    const slot = new SaveService(store).getAutosave();
    expect(slot).toEqual({ mapId: 'green-valley', difficulty: 'hard', wave: 4, savedAt: 1234, snapshot: snap });
    expect(s.result('green-valley', 'hard')?.bestWave).toBe(4);
    s.clearAutosave();
    expect(s.hasAutosave()).toBe(false);
  });

  it('the saved snapshot restores a game', () => {
    const s = new SaveService(new MemoryStore());
    s.writeAutosave(snapshot('green-valley', 'normal', 0));
    const slot = s.getAutosave();
    if (!slot) throw new Error('no slot');
    const map = getMap(slot.mapId);
    if (!map) throw new Error('missing map');
    const sim = new GameSim({ map, difficulty: DIFFICULTIES[slot.difficulty], seed: slot.snapshot.seed, save: slot.snapshot });
    expect(sim.towers.length).toBe(1);
  });

  it('drops invalid slots: corrupt, bad snapshot, unknown map or difficulty, mismatches', () => {
    const store = new MemoryStore();
    const s = new SaveService(store);
    const good = snapshot();
    const cases: unknown[] = [
      { mapId: 'green-valley', difficulty: 'normal', wave: 3, savedAt: 1, snapshot: { ...good, towers: 'nope' } },
      { mapId: 'green-valley', difficulty: 'normal', wave: 3, savedAt: 1, snapshot: { ...good, version: 999 } },
      { mapId: 'atlantis', difficulty: 'normal', wave: 3, savedAt: 1, snapshot: { ...good, mapId: 'atlantis' } },
      { mapId: 'green-valley', difficulty: 'insane', wave: 3, savedAt: 1, snapshot: { ...good, difficultyId: 'insane' } },
      { mapId: 'dune-canyon', difficulty: 'normal', wave: 3, savedAt: 1, snapshot: good },
      { mapId: 'green-valley', difficulty: 'normal', wave: 9, savedAt: 1, snapshot: good },
      'string',
    ];
    for (const c of cases) {
      writeVersioned(store, AUTOSAVE_KEY, AUTOSAVE_VERSION, c);
      expect(s.getAutosave()).toBeNull();
      expect(store.getItem(AUTOSAVE_KEY)).toBeNull();
    }
    store.setItem(AUTOSAVE_KEY, '{"v":1,"data":');
    expect(s.getAutosave()).toBeNull();
  });

  it('a slot whose map was removed from the game is dropped', () => {
    const store = new MemoryStore();
    new SaveService(store).writeAutosave(snapshot());
    const shrunk = new SaveService(store, { mapOrder: ['tutorial', 'dune-canyon'] });
    expect(shrunk.getAutosave()).toBeNull();
  });

  it('refuses to write snapshots for unknown maps', () => {
    const store = new MemoryStore();
    const s = new SaveService(store);
    s.writeAutosave({ ...snapshot(), mapId: 'atlantis' });
    expect(store.getItem(AUTOSAVE_KEY)).toBeNull();
  });
});
