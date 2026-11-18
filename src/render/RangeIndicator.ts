import type Phaser from 'phaser';
import { DEPTH } from './layers';

export const RANGE_OK = 0x38bdf8;
export const RANGE_BAD = 0xf43f5e;
export const RANGE_PLACE_OK = 0x34d399;

/**
 * A tower range circle: soft fill, bright rim and a faint outer halo. Drawn once around (0, 0)
 * and moved with setPosition; redrawn only when radius or colour change.
 */
export class RangeIndicator {
  private readonly g: Phaser.GameObjects.Graphics;
  private radius = -1;
  private color = -1;

  constructor(scene: Phaser.Scene, depth: number = DEPTH.range) {
    this.g = scene.add.graphics().setDepth(depth).setVisible(false);
  }

  /** Show a circle of `radius` px in `color` centred on (x, y). */
  show(x: number, y: number, radius: number, color: number): void {
    if (radius !== this.radius || color !== this.color) {
      this.radius = radius;
      this.color = color;
      const g = this.g.clear();
      if (radius > 0) {
        g.fillStyle(color, 0.12).fillCircle(0, 0, radius);
        g.lineStyle(6, color, 0.12).strokeCircle(0, 0, radius + 2);
        g.lineStyle(2, color, 0.8).strokeCircle(0, 0, radius);
      }
    }
    this.g.setPosition(x, y).setVisible(radius > 0);
  }

  hide(): void {
    this.g.setVisible(false);
  }
}
