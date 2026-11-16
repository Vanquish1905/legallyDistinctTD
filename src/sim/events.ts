import type { DamageType, Vec2 } from './types';

/** Everything the sim tells the outside world, discriminated on `type`. Positions are field px. */
export type SimEvent =
  | { type: 'enemySpawn'; uid: number; enemyId: string; x: number; y: number; boss: boolean }
  | { type: 'enemyKilled'; uid: number; enemyId: string; x: number; y: number; reward: number; towerUid: number | null }
  | { type: 'enemyLeaked'; uid: number; enemyId: string; damage: number }
  | { type: 'enemyHit'; uid: number; x: number; y: number; amount: number; damageType: DamageType; shielded: boolean; towerUid: number | null }
  | { type: 'towerFired'; uid: number; towerId: string; x: number; y: number; angle: number; targetUid: number }
  | { type: 'towerPlaced'; uid: number; towerId: string; x: number; y: number }
  | { type: 'towerUpgraded'; uid: number; towerId: string; path: 0 | 1; tier: number }
  | { type: 'towerSold'; uid: number; towerId: string; x: number; y: number; refund: number }
  | { type: 'projectileSpawn'; uid: number; kind: string; x: number; y: number; towerUid: number }
  | { type: 'explosion'; x: number; y: number; radius: number; damageType: DamageType }
  | { type: 'chainLightning'; towerUid: number; points: Vec2[] }
  | { type: 'beam'; towerUid: number; x1: number; y1: number; x2: number; y2: number; intensity: number }
  | { type: 'waveStart'; wave: number; early: boolean; bonus: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'bossSpawn'; uid: number; enemyId: string; name: string }
  | { type: 'bossPhase'; uid: number; enemyId: string; phase: number }
  | { type: 'moneyChanged'; money: number; delta: number }
  | { type: 'livesChanged'; lives: number; delta: number }
  | { type: 'gameWon'; wave: number }
  | { type: 'gameLost'; wave: number };

/**
 * FIFO of sim events. The sim pushes during ticks; the renderer drains once per frame.
 * Two buffers are swapped on drain, so draining does not allocate.
 */
export class SimEventQueue {
  private buffer: SimEvent[] = [];
  private spare: SimEvent[] = [];

  /** Queue an event. */
  push(event: SimEvent): void {
    this.buffer.push(event);
  }

  /** Number of queued events. */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Return all queued events and empty the queue. The returned array is only valid until the
   * next `drain()` call.
   */
  drain(): readonly SimEvent[] {
    const out = this.buffer;
    this.buffer = this.spare;
    this.buffer.length = 0;
    this.spare = out;
    return out;
  }

  /** Drop all queued events. */
  clear(): void {
    this.buffer.length = 0;
  }
}
