import type { GameController } from './GameController';
import type { SaveService } from '../../services/SaveService';

/**
 * Persists a running game: writes the Continue slot whenever the game is back in the build
 * phase after a wave (so overlapping early-started waves are saved once all are cleared),
 * records the result and empties the slot when the game ends.
 */
export class SaveDirector {
  private readonly offs: (() => void)[] = [];

  constructor(controller: GameController, saves: SaveService) {
    const sim = controller.sim;
    this.offs.push(
      controller.events.on('waveChanged', ({ phase, wave }) => {
        if (phase !== 'build' || wave <= 0) return;
        try {
          saves.writeAutosave(sim.snapshot());
        } catch {
          // Snapshot is only valid in the build phase; never break the game over a save.
        }
      }),
      controller.events.on('gameOver', ({ won, wave }) => {
        const difficulty = sim.difficulty.id;
        saves.recordResult({ mapId: sim.map.id, difficulty, wave: won ? wave : Math.max(0, wave - 1), won });
        saves.clearAutosave();
      }),
    );
  }

  /** Unsubscribe (scene shutdown). */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
