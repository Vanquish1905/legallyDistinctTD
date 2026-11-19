/**
 * Pure press-gesture classifier shared by UI components (no Phaser, unit tested): tells a tap
 * from a drag and detects long-presses. Times are ms, coordinates px.
 */

/** Pointer travel (px) after which a press is a drag, not a tap. */
export const TAP_SLOP = 12;
/** Holding this long (ms) without dragging is a long-press (touch tooltips). */
export const LONG_PRESS_MS = 450;

/** What a press turned into. */
export type GestureKind = 'none' | 'pressing' | 'drag' | 'longPress';

/** Tracks one press from down to up. */
export class PressGesture {
  kind: GestureKind = 'none';
  startX = 0;
  startY = 0;
  startT = 0;
  /** Set by the owner when the press should never become a tap (e.g. it stopped a fling). */
  suppressTap = false;

  constructor(private readonly slop = TAP_SLOP, private readonly longPressMs = LONG_PRESS_MS) {}

  /** True between `down` and `up`. */
  get active(): boolean {
    return this.kind !== 'none';
  }

  down(x: number, y: number, t: number): void {
    this.kind = 'pressing';
    this.startX = x;
    this.startY = y;
    this.startT = t;
    this.suppressTap = false;
  }

  /** Pointer moved; returns true the moment the press becomes a drag. */
  move(x: number, y: number): boolean {
    if (this.kind !== 'pressing') return false;
    if (Math.hypot(x - this.startX, y - this.startY) > this.slop) {
      this.kind = 'drag';
      return true;
    }
    return false;
  }

  /** Time passed; returns true the moment the press becomes a long-press. */
  tick(t: number): boolean {
    if (this.kind !== 'pressing' || t - this.startT < this.longPressMs) return false;
    this.kind = 'longPress';
    return true;
  }

  /** Pointer released; returns true when the whole press was a tap. Resets the gesture. */
  up(x: number, y: number): boolean {
    if (this.kind === 'pressing') this.move(x, y);
    const tap = this.kind === 'pressing' && !this.suppressTap;
    this.kind = 'none';
    return tap;
  }

  /** Abandon the press (pointer left, scene paused...). */
  cancel(): void {
    this.kind = 'none';
  }
}
