/**
 * Which music track plays when (pure logic). Moods: `menu` and `game` follow the player's
 * track setting (a fixed track loops; 'shuffle' walks a shuffled bag without immediate
 * repeats), `boss` is the epic track while a boss lives, `credits` is the credits song and
 * `silence` stops music.
 */

export type MusicMood = 'menu' | 'game' | 'boss' | 'credits' | 'silence';

/** A track to play and whether it loops (non-looping tracks advance on end). */
export interface TrackChoice {
  key: string;
  loop: boolean;
}

export interface PlaylistConfig {
  /** Tracks used by shuffle (game mood). */
  pool: readonly string[];
  /** Menu track while shuffling. */
  menuTrack: string;
  bossTrack: string;
  creditsTrack: string;
}

/** Picks tracks for moods and keeps the shuffle bag. */
export class Playlist {
  private setting = 'shuffle';
  private bag: string[] = [];
  private last: string | null = null;

  constructor(private readonly cfg: PlaylistConfig, private readonly rng: () => number = Math.random) {}

  /** The player's setting: 'shuffle' or a track key. */
  setTrackSetting(setting: string): void {
    this.setting = setting;
  }

  get trackSetting(): string {
    return this.setting;
  }

  /** The track a mood starts with (null = silence). Shuffle draws the next bag track. */
  trackFor(mood: MusicMood): TrackChoice | null {
    switch (mood) {
      case 'silence':
        return null;
      case 'boss':
        return { key: this.cfg.bossTrack, loop: true };
      case 'credits':
        return { key: this.cfg.creditsTrack, loop: true };
      case 'menu':
        return this.setting === 'shuffle' ? { key: this.cfg.menuTrack, loop: true } : { key: this.setting, loop: true };
      case 'game':
        return this.setting === 'shuffle' ? { key: this.nextShuffled(), loop: false } : { key: this.setting, loop: true };
    }
  }

  /** The track `trackFor(mood)` would start, without consuming the shuffle bag (preloading). */
  peekFor(mood: MusicMood): string | null {
    if (mood === 'game' && this.setting === 'shuffle') return this.peekShuffled();
    return this.trackFor(mood)?.key ?? null;
  }

  /** Next shuffled track: the bag is refilled when empty and never repeats the last track. */
  nextShuffled(): string {
    if (this.bag.length === 0) this.refill();
    const key = this.bag.pop() ?? this.cfg.menuTrack;
    this.last = key;
    return key;
  }

  /** The track `nextShuffled` would return, without consuming it (for preloading). */
  peekShuffled(): string {
    if (this.bag.length === 0) this.refill();
    return this.bag[this.bag.length - 1] ?? this.cfg.menuTrack;
  }

  private refill(): void {
    const bag = [...this.cfg.pool];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    // bag is consumed from the end: avoid starting with the track that just played.
    if (bag.length > 1 && bag[bag.length - 1] === this.last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
    this.bag = bag;
  }
}
