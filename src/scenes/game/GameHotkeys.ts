import type Phaser from 'phaser';
import { TOWER_ORDER } from '../../data/towers';
import type { GameController } from './GameController';

/** Keys whose browser default (scroll, focus change) is suppressed while playing. */
const CAPTURED = 'TAB,SPACE';

/** Keys 1..9, 0 pick the first ten towers of the shop order. */
const DIGITS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'] as const;

/**
 * Keyboard shortcuts from the feature list: 1-9/0 towers, U/I upgrade, Del/S sell, Space next
 * wave, F speed, P pause, Tab target mode. (Esc cancel lives in GameInput.)
 */
export class GameHotkeys {
  private readonly bindings: [string, () => void][] = [];

  constructor(private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null, private readonly c: GameController) {
    DIGITS.forEach((key, i) => {
      const id = TOWER_ORDER[i];
      if (id) this.bind(key, () => c.beginPlacement(id));
    });
    this.bind('U', () => this.withSelected((uid) => c.upgrade(uid, 0)));
    this.bind('I', () => this.withSelected((uid) => c.upgrade(uid, 1)));
    this.bind('DELETE', () => this.withSelected((uid) => c.sell(uid)));
    this.bind('S', () => this.withSelected((uid) => c.sell(uid)));
    this.bind('SPACE', () => c.startNextWave());
    this.bind('F', () => c.cycleSpeed());
    this.bind('P', () => c.togglePause());
    this.bind('TAB', () => this.withSelected((uid) => c.cycleTargetMode(uid)));
    keyboard?.addCapture(CAPTURED);
  }

  destroy(): void {
    for (const [name, fn] of this.bindings) this.keyboard?.off(`keydown-${name}`, fn);
    // Captures live on the global KeyboardManager; release them so Space/Tab work in other scenes.
    this.keyboard?.removeCapture(CAPTURED);
    this.bindings.length = 0;
  }

  private bind(name: string, fn: () => void): void {
    this.keyboard?.on(`keydown-${name}`, fn);
    this.bindings.push([name, fn]);
  }

  private withSelected(fn: (uid: number) => void): void {
    const uid = this.c.selectedUid;
    if (uid !== null) fn(uid);
  }
}
