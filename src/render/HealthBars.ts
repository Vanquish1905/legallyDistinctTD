import type Phaser from 'phaser';
import type { EnemyState } from '../sim/EnemyState';
import { DEPTH } from './layers';

const W = 34;
const H = 5;
const BOSS_W = 96;
const BOSS_H = 8;

/**
 * HP (and shield) bars for every damaged enemy, drawn into one shared Graphics that is cleared
 * and refilled each frame: a few hundred rectangles cost far less than one object per enemy.
 */
export class HealthBars {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.healthBar);
  }

  /** Start a frame. */
  begin(): void {
    this.g.clear();
  }

  /** Bar above an enemy drawn at (x, y) with visual half-height `top`; skipped at full HP and no shield. */
  draw(e: EnemyState, x: number, y: number, top: number, alpha: number): void {
    const frac = e.hp / e.maxHp;
    if (frac >= 0.999 && e.shield <= 0) return;
    const boss = e.isBoss;
    const w = boss ? BOSS_W : Math.max(W, e.radius * 1.6);
    const h = boss ? BOSS_H : H;
    const bx = x - w / 2;
    const by = y - top - h - 4;
    const g = this.g;
    g.fillStyle(0x1b1f2a, 0.85 * alpha).fillRect(bx - 1.5, by - 1.5, w + 3, h + 3);
    const color = frac > 0.6 ? 0x34d399 : frac > 0.3 ? 0xfbbf24 : 0xf43f5e;
    g.fillStyle(color, alpha).fillRect(bx, by, w * Math.max(0, frac), h);
    g.fillStyle(0xffffff, 0.25 * alpha).fillRect(bx, by, w * Math.max(0, frac), h * 0.4);
    if (e.shield > 0 && e.maxShield > 0) {
      const sf = Math.min(1, e.shield / e.maxShield);
      g.fillStyle(0x1b1f2a, 0.85 * alpha).fillRect(bx - 1.5, by - 5, w + 3, 4);
      g.fillStyle(0x7dd3fc, alpha).fillRect(bx, by - 4, w * sf, 2.5);
    }
  }
}
