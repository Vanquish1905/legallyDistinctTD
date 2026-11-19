import type Phaser from 'phaser';
import type { GameController, GameEvents } from '../../scenes/game/GameController';
import type { Tooltip } from '../Tooltip';
import type { ToastStack } from '../Toast';

/**
 * What every HUD widget gets: its scene, the game controller, the shared tooltip and toasts,
 * and `listen`, which subscribes to controller events and unsubscribes on HUD shutdown.
 */
export interface HudContext {
  readonly scene: Phaser.Scene;
  readonly c: GameController;
  readonly tooltip: Tooltip;
  readonly toasts: ToastStack;
  listen<K extends keyof GameEvents>(name: K, fn: (payload: GameEvents[K]) => void): void;
}

/** A HUD widget with per-frame work and cleanup. */
export interface HudWidget {
  /** Per-frame update; `dt` in seconds (real time, not game speed). */
  update?(dt: number): void;
  destroy(): void;
}

/** Category accent colours, shared by cards, tooltips and the tower panel. */
export const CATEGORY_COLOR: Record<'basic' | 'magic' | 'heavy' | 'support', number> = {
  basic: 0x38bdf8,
  magic: 0xa78bfa,
  heavy: 0xfb923c,
  support: 0x34d399,
};

/** Upgrade path colours (match the tier pips drawn under towers on the field). */
export const PATH_COLOR: readonly [number, number] = [0x38bdf8, 0xfbbf24];
