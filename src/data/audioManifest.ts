/** Audio files under public/assets/audio, keyed by logical name. Pure data. */

export interface AudioEntry {
  key: string;
  file: string;
  kind: 'music' | 'sfx';
  /** Human-readable label (used by the music picker). */
  label?: string;
}

export const AUDIO_MANIFEST: AudioEntry[] = [
  { key: 'music-background-1', file: 'background-1.mp3', kind: 'music', label: 'Background 1' },
  { key: 'music-background-2', file: 'background-2.mp3', kind: 'music', label: 'Background 2' },
  { key: 'music-background-3', file: 'background-3.mp3', kind: 'music', label: 'Background 3' },
  { key: 'music-chill', file: 'chill-song.mp3', kind: 'music', label: 'Chill Song' },
  { key: 'music-tropical', file: 'tropical-song.mp3', kind: 'music', label: 'Tropical Song' },
  { key: 'music-pop', file: 'pop.mp3', kind: 'music', label: 'Pop' },
  { key: 'music-epic', file: 'epic.mp3', kind: 'music', label: 'Epic' },
  { key: 'music-credits', file: 'credits.mp3', kind: 'music', label: 'Credits' },
  { key: 'sfx-place', file: 'place.mp3', kind: 'sfx' },
  { key: 'sfx-sell', file: 'sell.mp3', kind: 'sfx' },
  { key: 'sfx-hit', file: 'hit.mp3', kind: 'sfx' },
  { key: 'sfx-on-hit', file: 'on-hit.mp3', kind: 'sfx' },
  { key: 'sfx-fire', file: 'fire.mp3', kind: 'sfx' },
  { key: 'sfx-explosion', file: 'explosion.mp3', kind: 'sfx' },
  { key: 'sfx-win', file: 'win.mp3', kind: 'sfx' },
  { key: 'sfx-game-over', file: 'game-over.mp3', kind: 'sfx' },
];

export const MUSIC_TRACKS = AUDIO_MANIFEST.filter((a) => a.kind === 'music');
export const SFX = AUDIO_MANIFEST.filter((a) => a.kind === 'sfx');
