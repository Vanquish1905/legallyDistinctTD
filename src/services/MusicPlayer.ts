/**
 * Streams music through two `<audio>` elements with a crossfade. Tracks are fetched on demand
 * as compressed blobs (a 4 MB mp3 stays 4 MB instead of ~70 MB of decoded PCM, which matters
 * on iPhones) and played from blob URLs, so no media range requests are ever aborted. With a
 * WebAudio context the elements are routed through gain nodes into `destination` (iOS ignores
 * `element.volume`); without one, element volume is used directly. Never throws.
 */

const FADE_S = 1.6;

/** 20 ms of silent 8 kHz mono WAV, used to unlock the elements inside the first gesture. */
const SILENT_WAV = makeSilentWav();

function makeSilentWav(): string {
  const samples = 160;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (o: number, t: string): void => {
    for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}
/** Blob URLs kept around (current, previous and one preloaded track). */
const BLOB_CACHE = 3;

interface Deck {
  el: HTMLAudioElement;
  /** Fade gain (WebAudio) — null in element-volume mode. */
  fade: GainNode | null;
  key: string | null;
  level: number;
}

export interface MusicPlayerOptions {
  /** URL of a track key. */
  urlOf: (key: string) => string | null;
  /** Called once when something fails (fetch, decode, play). */
  warn: (msg: string) => void;
  /** Fired when a non-looping track ends. */
  onEnded: (key: string) => void;
}

/** Two-deck streaming music player. */
export class MusicPlayer {
  private readonly decks: [Deck, Deck];
  private active: 0 | 1 = 0;
  private readonly bus: GainNode | null;
  private readonly blobs = new Map<string, Promise<string | null>>();
  private wanted: string | null = null;
  private volume = 1;
  private suspended = false;
  private blessed = false;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly ctx: AudioContext | null, destination: AudioNode | null, private readonly opts: MusicPlayerOptions) {
    this.bus = null;
    if (ctx && destination) {
      try {
        this.bus = ctx.createGain();
        this.bus.connect(destination);
      } catch {
        this.bus = null;
      }
    }
    this.decks = [this.makeDeck(), this.makeDeck()];
  }

  /** Music bus volume 0..1 (already including master in element mode). */
  setVolume(v: number): void {
    this.volume = v;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    else for (const d of this.decks) this.applyElementVolume(d);
  }

  /** Start fetching a track without playing it. */
  preload(key: string): void {
    void this.blobUrl(key);
  }

  /**
   * Play a track (crossfading from the current one). Same track: only the loop flag changes.
   * `null` fades out to silence.
   */
  play(key: string | null, loop: boolean): void {
    this.wanted = key;
    const cur = this.decks[this.active];
    if (key !== null && cur.key === key) {
      cur.el.loop = loop;
      if (cur.el.paused && !this.suspended) this.startElement(cur);
      this.fadeTo(this.active);
      return;
    }
    if (key === null) {
      this.fadeTo(-1);
      return;
    }
    void this.blobUrl(key).then((url) => {
      if (!url || this.wanted !== key) return;
      const next: 0 | 1 = this.active === 0 ? 1 : 0;
      const deck = this.decks[next];
      try {
        deck.el.pause();
        deck.el.src = url;
        deck.el.loop = loop;
        deck.el.currentTime = 0;
      } catch {
        return;
      }
      deck.key = key;
      this.active = next;
      if (!this.suspended) this.startElement(deck);
      this.fadeTo(next);
    });
  }

  /** Key of the track currently wanted (null = silence). */
  get current(): string | null {
    return this.wanted;
  }

  /** Pause or resume all playback (hidden tab). */
  setSuspended(suspended: boolean): void {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    const deck = this.decks[this.active];
    if (suspended) {
      for (const d of this.decks) d.el.pause();
    } else if (deck.key && deck.key === this.wanted) {
      this.startElement(deck);
    }
  }

  /**
   * Call from inside a user gesture: iOS only lets an element play later if `play()` was called
   * on it during a gesture once.
   */
  bless(): void {
    const active = this.decks[this.active];
    if (active.key && active.key === this.wanted && !this.suspended) this.startElement(active);
    if (this.blessed) return;
    this.blessed = true;
    for (const d of this.decks) {
      if (d.key) continue;
      try {
        d.el.src = SILENT_WAV;
        const p = d.el.play();
        const done = (): void => {
          if (!d.key) {
            d.el.pause();
            d.el.removeAttribute('src');
          }
        };
        if (p) p.then(done, done);
        else done();
      } catch {
        // ignore
      }
    }
  }

  destroy(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    for (const d of this.decks) {
      d.el.pause();
      d.el.removeAttribute('src');
    }
    for (const p of this.blobs.values()) void p.then((u) => u && URL.revokeObjectURL(u));
    this.blobs.clear();
  }

  // ---- internals ----------------------------------------------------------------------------

  private makeDeck(): Deck {
    const el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    let fade: GainNode | null = null;
    if (this.ctx && this.bus) {
      try {
        const src = this.ctx.createMediaElementSource(el);
        fade = this.ctx.createGain();
        fade.gain.value = 0;
        src.connect(fade);
        fade.connect(this.bus);
      } catch {
        fade = null;
      }
    }
    const deck: Deck = { el, fade, key: null, level: 0 };
    el.addEventListener('ended', () => {
      if (deck.key && deck === this.decks[this.active] && !el.loop) this.opts.onEnded(deck.key);
    });
    el.addEventListener('error', () => {
      if (deck.key) this.opts.warn(`music element error (${deck.key})`);
    });
    return deck;
  }

  private startElement(deck: Deck): void {
    try {
      const p = deck.el.play();
      if (p) p.catch(() => undefined); // Autoplay refusal: retried on the next unlock/visibility change.
    } catch {
      // ignore
    }
  }

  /** Fade `target` deck to 1 and the others to 0 (target -1 = all to 0). */
  private fadeTo(target: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < 2; i++) {
      const d = this.decks[i as 0 | 1];
      const to = i === target ? 1 : 0;
      if (d.fade && ctx) {
        const g = d.fade.gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setValueAtTime(g.value, ctx.currentTime);
        g.linearRampToValueAtTime(to, ctx.currentTime + FADE_S);
      }
    }
    // Element-volume mode fades with a timer; both modes pause silent decks after the fade.
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const t0 = Date.now();
    const from = this.decks.map((d) => d.level);
    this.fadeTimer = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / (FADE_S * 1000));
      for (let i = 0; i < 2; i++) {
        const d = this.decks[i as 0 | 1];
        d.level = from[i]! + ((i === target ? 1 : 0) - from[i]!) * k;
        if (!d.fade) this.applyElementVolume(d);
      }
      if (k >= 1) {
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        for (let i = 0; i < 2; i++) {
          const d = this.decks[i as 0 | 1];
          if (i !== target) {
            d.el.pause();
            d.key = null;
          }
        }
      }
    }, 50);
  }

  private applyElementVolume(d: Deck): void {
    try {
      d.el.volume = Math.max(0, Math.min(1, this.volume * d.level));
    } catch {
      // ignore
    }
  }

  private blobUrl(key: string): Promise<string | null> {
    const cached = this.blobs.get(key);
    if (cached) {
      // Refresh LRU position.
      this.blobs.delete(key);
      this.blobs.set(key, cached);
      return cached;
    }
    const url = this.opts.urlOf(key);
    if (!url) return Promise.resolve(null);
    const p = fetch(url)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((blob) => URL.createObjectURL(blob))
      .catch((e: unknown) => {
        this.opts.warn(`could not load music "${key}": ${e instanceof Error ? e.message : String(e)}`);
        this.blobs.delete(key);
        return null;
      });
    this.blobs.set(key, p);
    this.evict();
    return p;
  }

  /** Drop the oldest blob URLs not used by a deck. */
  private evict(): void {
    if (this.blobs.size <= BLOB_CACHE) return;
    const inUse = new Set(this.decks.map((d) => d.key));
    for (const [key, p] of this.blobs) {
      if (this.blobs.size <= BLOB_CACHE) break;
      if (inUse.has(key) || key === this.wanted) continue;
      this.blobs.delete(key);
      void p.then((u) => u && URL.revokeObjectURL(u));
    }
  }
}
