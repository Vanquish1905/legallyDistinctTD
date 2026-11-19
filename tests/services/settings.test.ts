import { describe, expect, it } from 'vitest';
import { MemoryStore, writeVersioned } from '../../src/services/storage';
import { SETTINGS_KEY, SETTINGS_VERSION, Settings, defaultSettings, sanitizeSettings } from '../../src/services/Settings';

describe('Settings', () => {
  it('starts from defaults and follows the reduced-motion preference', () => {
    expect(new Settings(new MemoryStore()).get()).toEqual(defaultSettings(false));
    expect(new Settings(new MemoryStore(), defaultSettings(true)).get().reducedMotion).toBe(true);
  });

  it('persists changes and reloads them', () => {
    const store = new MemoryStore();
    const a = new Settings(store, defaultSettings(false));
    a.set({ musicVolume: 0.2, musicTrack: 'music-epic', particles: 'low', showFps: true });
    const b = new Settings(store, defaultSettings(false));
    expect(b.get()).toMatchObject({ musicVolume: 0.2, musicTrack: 'music-epic', particles: 'low', showFps: true });
  });

  it('clamps volumes and ignores invalid values', () => {
    const s = new Settings(new MemoryStore(), defaultSettings(false));
    s.set({ masterVolume: 3, sfxVolume: -1, musicTrack: 'music-nope', particles: 'ultra' as 'high', muted: 'yes' as unknown as boolean });
    const v = s.get();
    expect(v.masterVolume).toBe(1);
    expect(v.sfxVolume).toBe(0);
    expect(v.musicTrack).toBe('shuffle');
    expect(v.particles).toBe('high');
    expect(v.muted).toBe(false);
  });

  it('emits the changed keys only when something changed', () => {
    const s = new Settings(new MemoryStore(), defaultSettings(false));
    const calls: string[][] = [];
    const off = s.onChange((_v, changed) => calls.push([...changed]));
    s.set({ muted: true, damageNumbers: true });
    s.set({ muted: true });
    off();
    s.set({ muted: false });
    expect(calls).toEqual([['muted']]);
  });

  it('falls back to defaults on corrupt or outdated data, field by field otherwise', () => {
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, '{{{');
    expect(new Settings(store, defaultSettings(false)).get()).toEqual(defaultSettings(false));
    writeVersioned(store, SETTINGS_KEY, SETTINGS_VERSION + 1, { muted: true });
    expect(new Settings(store, defaultSettings(false)).get().muted).toBe(false);
    writeVersioned(store, SETTINGS_KEY, SETTINGS_VERSION, { muted: true, masterVolume: 'loud' });
    const s = new Settings(store, defaultSettings(false)).get();
    expect(s.muted).toBe(true);
    expect(s.masterVolume).toBe(defaultSettings(false).masterVolume);
  });

  it('reset restores the defaults', () => {
    const s = new Settings(new MemoryStore(), defaultSettings(false));
    s.set({ sfxVolume: 0.1, autoStartWaves: true });
    s.reset();
    expect(s.get()).toEqual(defaultSettings(false));
  });

  it('sanitizeSettings handles non-objects', () => {
    expect(sanitizeSettings(null, defaultSettings(false))).toEqual(defaultSettings(false));
    expect(sanitizeSettings([1, 2], defaultSettings(false))).toEqual(defaultSettings(false));
  });
});
