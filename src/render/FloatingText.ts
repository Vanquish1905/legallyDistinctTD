import type Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { DEPTH } from './layers';

/** Most labels alive at once; extra requests are dropped (kills can come in hundreds). */
const MAX_LABELS = 28;
const LIFE = 0.9;
const RISE = 46;

interface Label {
  text: Phaser.GameObjects.Text;
  life: number;
  x: number;
  y: number;
}

/** Pooled floating labels ("+12" coins, notices) that rise and fade. */
export class FloatingText {
  private readonly live: Label[] = [];
  private readonly free: Label[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Show `value` at (x, y) in `color`; ignored when too many labels are up. */
  show(x: number, y: number, value: string, color: string, size = 24): void {
    if (this.live.length >= MAX_LABELS) return;
    const l = this.free.pop() ?? this.make();
    l.text.setText(value).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setScale(0.6).setVisible(true);
    l.life = LIFE;
    l.x = x;
    l.y = y;
    this.live.push(l);
  }

  /** Advance labels by `dt` seconds. */
  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i] as Label;
      l.life -= dt;
      if (l.life <= 0) {
        l.text.setVisible(false);
        const last = this.live.pop() as Label;
        if (i < this.live.length) this.live[i] = last;
        this.free.push(l);
        continue;
      }
      const t = 1 - l.life / LIFE;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (t - 0.15) * 0.4);
      l.text.setScale(pop);
      l.text.setPosition(l.x, l.y - RISE * (1 - (1 - t) * (1 - t)));
      l.text.setAlpha(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
  }

  private make(): Label {
    const text = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#fbbf24',
        stroke: '#1b1f2a',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.floatingText)
      .setVisible(false);
    return { text, life: 0, x: 0, y: 0 };
  }
}
