import { MUSIC_TRACKS } from '../data/audioManifest';
import { getDefaultStore, readVersioned, writeVersioned, type KeyValueStore } from './storage';

/** Particle detail level. */
export type ParticleSetting = 'low' | 'medium' | 'high';

/** Every user setting. Volumes are 0..1. */
export interface SettingsData {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  /** A music track key from the audio manifest, or 'shuffle'. */
  musicTrack: string;
  muted: boolean;
  damageNumbers: boolean;
  particles: ParticleSetting;
  showFps: boolean;
  autoStartWaves: boolean;
  reducedMotion: boolean;
}

export const SETTINGS_KEY = 'ldtd.settings';
export const SETTINGS_VERSION = 1;

const PARTICLES: readonly ParticleSetting[] = ['low', 'medium', 'high'];

/** Whether the OS asks for reduced motion (false outside a browser). */
function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Defaults; `reducedMotion` follows the OS preference. */
export function defaultSettings(reducedMotion = prefersReducedMotion()): SettingsData {
  return {
    masterVolume: 0.8,
    musicVolume: 0.55,
    sfxVolume: 0.8,
    musicTrack: 'shuffle',
    muted: false,
    damageNumbers: true,
    particles: 'high',
    showFps: false,
    autoStartWaves: false,
    reducedMotion,
  };
}

function vol(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Whether a music setting value is valid ('shuffle' or a known track key). */
export function isMusicTrackSetting(v: unknown): v is string {
  return v === 'shuffle' || MUSIC_TRACKS.some((t) => t.key === v);
}

/**
 * Merge untrusted data over `base`, field by field: invalid or missing fields keep the base
 * value, volumes are clamped. Never throws.
 */
export function sanitizeSettings(data: unknown, base: SettingsData = defaultSettings()): SettingsData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ...base };
  const d = data as Record<string, unknown>;
  return {
    masterVolume: vol(d.masterVolume, base.masterVolume),
    musicVolume: vol(d.musicVolume, base.musicVolume),
    sfxVolume: vol(d.sfxVolume, base.sfxVolume),
    musicTrack: isMusicTrackSetting(d.musicTrack) ? d.musicTrack : base.musicTrack,
    muted: bool(d.muted, base.muted),
    damageNumbers: bool(d.damageNumbers, base.damageNumbers),
    particles: PARTICLES.includes(d.particles as ParticleSetting) ? (d.particles as ParticleSetting) : base.particles,
    showFps: bool(d.showFps, base.showFps),
    autoStartWaves: bool(d.autoStartWaves, base.autoStartWaves),
    reducedMotion: bool(d.reducedMotion, base.reducedMotion),
  };
}

/** Listener for setting changes: the new settings and the keys that changed. */
export type SettingsListener = (settings: Readonly<SettingsData>, changed: ReadonlyArray<keyof SettingsData>) => void;

/**
 * Typed settings store with defaults, validation, persistence and change events.
 * Pure TS: works without Phaser or a browser (pass a `MemoryStore`).
 */
export class Settings {
  private data: SettingsData;
  private listeners: SettingsListener[] = [];

  constructor(private readonly store: KeyValueStore, private readonly defaults: SettingsData = defaultSettings()) {
    const saved = readVersioned(store, SETTINGS_KEY, SETTINGS_VERSION, (d) => sanitizeSettings(d, defaults));
    this.data = saved ?? { ...defaults };
  }

  /** Current settings (read-only view; use `set` to change). */
  get(): Readonly<SettingsData> {
    return this.data;
  }

  /** Change some settings. Invalid values are ignored; listeners get the keys that changed. */
  set(patch: Partial<SettingsData>): void {
    const next = sanitizeSettings({ ...this.data, ...patch }, this.data);
    const changed = (Object.keys(next) as (keyof SettingsData)[]).filter((k) => next[k] !== this.data[k]);
    if (changed.length === 0) return;
    this.data = next;
    writeVersioned(this.store, SETTINGS_KEY, SETTINGS_VERSION, next);
    for (const fn of this.listeners) fn(next, changed);
  }

  /** Back to defaults (persisted). */
  reset(): void {
    this.set({ ...this.defaults });
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  onChange(fn: SettingsListener): () => void {
    this.listeners = [...this.listeners, fn];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
}

let shared: Settings | null = null;

/** The app-wide settings, backed by localStorage (or memory when unavailable). */
export function getSettings(): Settings {
  shared ??= new Settings(getDefaultStore());
  return shared;
}
