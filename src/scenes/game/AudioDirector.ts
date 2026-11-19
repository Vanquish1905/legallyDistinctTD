import type { GameController } from './GameController';
import type { SimEvent } from '../../sim/events';
import type { AudioService } from '../../services/AudioService';
import { EXPLOSION_SFX, FIRE_GATE_PREFIX, TOWER_FIRE } from '../../services/sfxCatalog';

/** Minimum seconds between laser hum bursts (beam events arrive every tick). */
const BEAM_GATE = 'beam';

/**
 * Plays the game's sound cues from controller and sim events, and switches the music to the
 * epic track while a boss is alive. Throttling and voice caps live in the AudioService, so
 * this only maps events to cues.
 */
export class AudioDirector {
  private readonly offs: (() => void)[] = [];
  private readonly bosses = new Set<number>();

  constructor(private readonly controller: GameController, private readonly audio: AudioService) {
    const ev = controller.events;
    audio.setMood('game');
    this.offs.push(
      ev.on('towerChanged', ({ change }) => {
        if (change === 'placed') audio.playSfx('sfx-place');
        else if (change === 'sold') audio.playSfx('sfx-sell');
        else if (change === 'upgraded') audio.playSfx('sfx-upgrade');
      }),
      ev.on('placementRejected', () => audio.playSfx('sfx-error')),
      ev.on('bossSpawned', ({ uid }) => {
        this.bosses.add(uid);
        audio.playSfx('sfx-boss-warning');
        audio.setMood('boss');
      }),
      ev.on('gameOver', ({ won }) => {
        this.bosses.clear();
        audio.setMood('silence');
        audio.playSfx(won ? 'sfx-win' : 'sfx-game-over');
      }),
      ev.on('sim', (e) => this.onSim(e)),
    );
  }

  private onSim(e: SimEvent): void {
    const audio = this.audio;
    switch (e.type) {
      case 'towerFired': {
        const cue = TOWER_FIRE[e.towerId];
        if (cue) audio.playSfx(cue.key, { gate: FIRE_GATE_PREFIX + e.towerId, volume: cue.volume, rate: cue.rate });
        break;
      }
      case 'beam':
        audio.playSfx('sfx-laser', { gate: BEAM_GATE, volume: 0.5 + 0.5 * Math.min(1, e.intensity) });
        break;
      case 'explosion':
        audio.playSfx(EXPLOSION_SFX[e.damageType], { volume: e.radius > 90 ? 1 : 0.75 });
        break;
      case 'enemyHit':
        audio.playSfx('sfx-hit');
        break;
      case 'enemyKilled':
        if (this.bosses.delete(e.uid)) {
          audio.playSfx('sfx-explosion', { volume: 1.6, rate: 0.7, gate: 'boss-death' });
          this.afterBoss();
        } else {
          audio.playSfx('sfx-on-hit');
        }
        break;
      case 'enemyLeaked':
        if (this.bosses.delete(e.uid)) this.afterBoss();
        break;
      case 'livesChanged':
        if (e.delta < 0 && e.lives > 0) audio.playSfx('sfx-life-lost');
        break;
      case 'waveStart':
        audio.playSfx('sfx-wave-start');
        break;
      case 'waveCleared':
      case 'income':
        audio.playSfx('sfx-coin');
        break;
      default:
        break;
    }
  }

  private afterBoss(): void {
    if (this.bosses.size === 0 && !this.controller.gameOver) this.audio.setMood('game');
  }

  /** Unsubscribe (scene shutdown). Music keeps playing across restarts. */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
