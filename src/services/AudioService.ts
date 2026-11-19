import Phaser from 'phaser';
import { AUDIO_MANIFEST, MUSIC_TRACKS, SFX } from '../data/audioManifest';
import { getSettings, type Settings, type SettingsData } from './Settings';
import { SfxGate, variation } from './sfxGate';
import { SFX_DEFS, ruleForGate } from './sfxCatalog';
import { SYNTH_CUES, synthBuffer } from './sfxSynth';
import { Playlist, type MusicMood } from './playlist';
import { MusicPlayer } from './MusicPlayer';

const AUDIO_DIR = 'assets/audio/';
/** Global cap on simultaneous sound effects (iOS Safari distorts beyond ~24 sources). */
const MAX_SFX_VOICES = 16;
const GAME_POOL = ['music-background-1', 'music-background-2', 'music-background-3', 'music-tropical', 'music-pop', 'music-chill'];

/** Extra options for one sound effect. */
export interface SfxOptions {
  /** Volume multiplier on top of the key's base volume (default 1). */
  volume?: number;
  /** Base playback rate (random variation is added on top). */
  rate?: number;
  /** Throttle key (default: the sound key), e.g. `fire:gatling`. */
  gate?: string;
}

/**
 * Game-wide audio: music (streamed playlist with crossfades and moods) and sound effects
 * (team recordings decoded at boot plus synthesized cues), with volume buses
 * (master × music / sfx), mute, per-key throttling and voice caps, unlock on first input and
 * pausing in hidden tabs. Lives across scenes; get it with `AudioService.get()`.
 * Audio failures are logged once and never throw.
 */
export class AudioService {
  private static instance: AudioService | null = null;

  private readonly sound: Phaser.Sound.BaseSoundManager;
  private readonly ctx: AudioContext | null;
  private readonly gate = new SfxGate(MAX_SFX_VOICES, ruleForGate);
  private readonly playlist: Playlist;
  private readonly music: MusicPlayer;
  private mood: MusicMood = 'silence';
  private unlocked = false;
  private sfxVolume = 1;
  private warned = false;
  private bootStarted = false;
  private readonly cleanups: (() => void)[] = [];

  /** Create the service for a game (idempotent). */
  static install(game: Phaser.Game, settings: Settings = getSettings()): AudioService {
    AudioService.instance ??= new AudioService(game, settings);
    return AudioService.instance;
  }

  /** The installed service, or null before `install`. */
  static get(): AudioService | null {
    return AudioService.instance;
  }

  private constructor(private readonly game: Phaser.Game, private readonly settings: Settings) {
    this.sound = game.sound;
    this.ctx = this.sound instanceof Phaser.Sound.WebAudioSoundManager ? this.sound.context : null;
    const destination = this.sound instanceof Phaser.Sound.WebAudioSoundManager ? this.sound.destination : null;
    this.playlist = new Playlist({ pool: GAME_POOL, menuTrack: 'music-chill', bossTrack: 'music-epic', creditsTrack: 'music-credits' });
    this.music = new MusicPlayer(this.ctx, destination, {
      urlOf: (key) => {
        const entry = AUDIO_MANIFEST.find((a) => a.key === key);
        return entry ? AUDIO_DIR + entry.file : null;
      },
      warn: (msg) => this.warn(msg),
      onEnded: () => {
        if (this.mood === 'game') this.applyMood(true);
      },
    });
    this.applySettings(settings.get());
    this.cleanups.push(settings.onChange((s, changed) => {
      this.applySettings(s);
      if (changed.includes('musicTrack') && (this.mood === 'menu' || this.mood === 'game')) this.applyMood(true);
    }));
    this.listenForUnlock();
    this.listenForVisibility();
  }

  /** True once the browser allowed audio (after the first input). */
  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** The current music mood. */
  get currentMood(): MusicMood {
    return this.mood;
  }

  /** Music track keys and labels for the settings picker (excluding 'shuffle'). */
  static musicTracks(): { key: string; label: string }[] {
    return MUSIC_TRACKS.map((t) => ({ key: t.key, label: t.label ?? t.key }));
  }

  /**
   * Boot-time loading: decode the team's sfx and synthesize the generated cues in the
   * background (boot does not wait), and start fetching the first track of `firstMood`.
   * Never throws.
   */
  loadBootAudio(firstMood: MusicMood = 'game'): void {
    if (this.bootStarted) return;
    this.bootStarted = true;
    const ctx = this.ctx;
    if (!ctx) return; // HTML5 / no-audio fallback: music only.
    // One cue per task so rendering (~150 ms in total) never blocks a frame for long.
    SYNTH_CUES.forEach((cue, i) => setTimeout(() => {
      const buf = synthBuffer(ctx, cue);
      if (buf) this.game.cache.audio.add(`sfx-${cue}`, buf);
    }, 50 + i * 16));
    for (const entry of SFX) void this.decode(ctx, entry.key, AUDIO_DIR + entry.file);
    const first = this.playlist.peekFor(firstMood);
    if (first) this.music.preload(first);
  }

  /** Switch the music mood (crossfades; same mood keeps the current track). */
  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.applyMood(false);
  }

  /**
   * Play a sound effect. Returns false when it was throttled, muted, unknown or not loaded yet.
   */
  playSfx(key: string, opts: SfxOptions = {}): boolean {
    if (!this.unlocked || !this.ctx || this.settings.get().muted) return false;
    const def = SFX_DEFS[key];
    const buffer: unknown = this.game.cache.audio.get(key);
    if (!def || !(buffer instanceof AudioBuffer)) return false;
    const volume = def.volume * (opts.volume ?? 1) * this.sfxVolume;
    if (volume <= 0.001) return false;
    const now = this.ctx.currentTime;
    const v = variation(Math.random, def.detune ?? 0, def.rate ?? 0);
    const rate = (opts.rate ?? 1) * v.rate;
    if (!this.gate.tryAcquire(opts.gate ?? key, now, buffer.duration / rate)) return false;
    try {
      return this.sound.play(key, { volume, detune: v.detune, rate });
    } catch (e) {
      this.warn(`sfx "${key}" failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  /** Stop music and listeners (game destroy). */
  destroy(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
    this.music.destroy();
    if (AudioService.instance === this) AudioService.instance = null;
  }

  // ---- internals ----------------------------------------------------------------------------

  private applySettings(s: Readonly<SettingsData>): void {
    this.playlist.setTrackSetting(s.musicTrack);
    this.sfxVolume = s.sfxVolume;
    try {
      this.sound.volume = s.masterVolume;
      this.sound.mute = s.muted;
    } catch {
      // ignore
    }
    // WebAudio: master and mute live in Phaser's master nodes; element mode applies them here.
    this.music.setVolume(this.ctx ? s.musicVolume : (s.muted ? 0 : s.masterVolume * s.musicVolume));
  }

  /** Start the mood's track (`advance`: draw a new shuffle track even in the same mood). */
  private applyMood(advance: boolean): void {
    if (!this.unlocked && this.mood !== 'silence') return; // started on unlock
    const choice = this.playlist.trackFor(this.mood);
    if (!choice) {
      this.music.play(null, false);
      return;
    }
    // Staying in 'game' mood (e.g. back from a boss) keeps a shuffled track that still plays.
    const cur = this.music.current;
    if (!advance && this.mood === 'game' && this.settings.get().musicTrack === 'shuffle' && cur && GAME_POOL.includes(cur)) {
      this.music.play(cur, false);
      return;
    }
    this.music.play(choice.key, choice.loop);
  }

  private decode(ctx: AudioContext, key: string, url: string): Promise<void> {
    return fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
      // Callback form: old iOS Safari has no promise-returning decodeAudioData.
      .then((data) => new Promise<AudioBuffer>((resolve, reject) => {
        const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
        p?.catch(() => undefined);
      }))
      .then((buf) => {
        this.game.cache.audio.add(key, buf);
      })
      .catch((e: unknown) => this.warn(`could not load "${key}": ${e instanceof Error ? e.message : String(e)}`));
  }

  /** Resume the context and unlock music elements inside the first real user gesture. */
  private listenForUnlock(): void {
    const events = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
    const handler = (): void => {
      const ctx = this.ctx;
      if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
      this.music.bless();
      if (!this.unlocked) {
        this.unlocked = true;
        this.applyMood(true);
      }
      if (!ctx || ctx.state === 'running') remove();
    };
    const remove = (): void => {
      for (const ev of events) window.removeEventListener(ev, handler, true);
    };
    for (const ev of events) window.addEventListener(ev, handler, true);
    this.cleanups.push(remove);
  }

  private listenForVisibility(): void {
    const onVis = (): void => this.music.setSuspended(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
  }

  private warn(msg: string): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(`[audio] ${msg} (further audio warnings suppressed)`);
  }
}
