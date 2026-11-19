import { describe, expect, it } from 'vitest';
import { GameSim } from '../../src/sim/GameSim';
import { getMap } from '../../src/data/maps';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { GameController } from '../../src/scenes/game/GameController';
import { SaveDirector } from '../../src/scenes/game/SaveDirector';
import { AudioDirector } from '../../src/scenes/game/AudioDirector';
import { SaveService } from '../../src/services/SaveService';
import { MemoryStore } from '../../src/services/storage';
import type { AudioService } from '../../src/services/AudioService';
import type { MusicMood } from '../../src/services/playlist';

function setup() {
  const map = getMap('green-valley');
  if (!map) throw new Error('missing map');
  const sim = new GameSim({ map, difficulty: DIFFICULTIES.easy, seed: 3 });
  const c = new GameController(sim);
  sim.events.drain();
  return { sim, c };
}

function runUntilBuild(c: GameController, maxSeconds = 300): void {
  for (let t = 0; t < maxSeconds * 10 && (c.sim.phase === 'wave'); t++) c.update(0.1);
}

/** Records cues instead of playing them. */
function fakeAudio() {
  const sfx: string[] = [];
  const moods: MusicMood[] = [];
  const audio = {
    playSfx: (key: string) => { sfx.push(key); return true; },
    setMood: (m: MusicMood) => { moods.push(m); },
  } as unknown as AudioService;
  return { audio, sfx, moods };
}

describe('SaveDirector', () => {
  it('autosaves after a wave clears and clears the slot when the game ends', () => {
    const { sim, c } = setup();
    const saves = new SaveService(new MemoryStore());
    const d = new SaveDirector(c, saves);
    c.placeTower('blaster', 420, 330);
    c.startNextWave();
    expect(saves.getAutosave()).toBeNull();
    runUntilBuild(c);
    expect(sim.phase).toBe('build');
    const slot = saves.getAutosave();
    expect(slot?.wave).toBe(1);
    expect(slot?.snapshot.towers.length).toBe(1);
    expect(saves.result('green-valley', 'easy')?.bestWave).toBe(1);
    // Lose: let a lot of waves run with no defence.
    c.sell(sim.towers[0]!.uid);
    for (let i = 0; i < 400 && !c.gameOver; i++) {
      c.startNextWave();
      c.update(0.1);
      runUntilBuild(c, 5);
    }
    expect(sim.phase).toBe('lost');
    expect(saves.hasAutosave()).toBe(false);
    expect(saves.result('green-valley', 'easy')?.won).toBe(false);
    d.destroy();
  });
});

describe('AudioDirector', () => {
  it('maps game events to cues and switches music for bosses', () => {
    const { sim, c } = setup();
    const { audio, sfx, moods } = fakeAudio();
    const d = new AudioDirector(c, audio);
    expect(moods).toEqual(['game']);
    const t = c.placeTower('blaster', 420, 330);
    expect(sfx).toContain('sfx-place');
    c.upgrade(t!.uid, 0);
    expect(sfx).toContain('sfx-upgrade');
    c.beginPlacement('railgun'); // too expensive
    expect(sfx).toContain('sfx-error');
    c.startNextWave();
    expect(sfx).toContain('sfx-wave-start');
    runUntilBuild(c);
    expect(sfx).toContain('sfx-fire');
    expect(sfx).toContain('sfx-coin');

    sim.events.push({ type: 'bossSpawn', uid: 999, enemyId: 'queen', name: 'Queen Larva', maxHp: 100 });
    c.pump();
    expect(sfx).toContain('sfx-boss-warning');
    expect(moods.at(-1)).toBe('boss');
    sim.events.push({ type: 'enemyKilled', uid: 999, enemyId: 'queen', x: 0, y: 0, reward: 1, towerUid: null });
    c.pump();
    expect(moods.at(-1)).toBe('game');

    sfx.length = 0;
    d.destroy();
    c.placeTower('blaster', 620, 330);
    expect(sfx).toEqual([]);
  });
});
