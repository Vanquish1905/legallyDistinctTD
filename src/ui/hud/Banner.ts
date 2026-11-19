import Phaser from 'phaser';
import { FIELD_W, GAME_H } from '../../config';
import { CSS, FONT, UI, cssColor, textStyle } from '../theme';
import type { HudWidget } from './HudContext';

/**
 * Big centred announcement over the field ("WAVE 5", "BOSS INCOMING", "VICTORY"): a title
 * with a subtitle on a soft dark band that scales in, holds and fades. One reused view.
 */
export class Banner implements HudWidget {
  private readonly root: Phaser.GameObjects.Container;
  private readonly band: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.TweenChain | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const cy = GAME_H * 0.38;
    this.root = scene.add.container(FIELD_W / 2, cy).setDepth(950).setVisible(false);
    this.band = scene.add.graphics();
    this.title = scene.add
      .text(0, -18, '', { ...textStyle(FONT.huge, { weight: 700, shadow: true }), stroke: '#0b101b', strokeThickness: 8 })
      .setOrigin(0.5);
    this.sub = scene.add.text(0, 40, '', textStyle(FONT.lg, { weight: 500, color: CSS.text, shadow: true })).setOrigin(0.5);
    this.root.add([this.band, this.title, this.sub]);
  }

  /** Show `title` (in `color`) with an optional subtitle for `hold` ms. */
  show(title: string, subtitle = '', color: number = UI.text, hold = 1300): void {
    this.tween?.stop();
    this.title.setText(title).setColor(cssColor(color));
    this.sub.setText(subtitle).setVisible(subtitle !== '');
    const g = this.band;
    g.clear();
    const w = Math.max(this.title.width, this.sub.width) + 240;
    const h = subtitle ? 150 : 110;
    for (let i = 0; i < 6; i++) {
      const k = 1 - i / 6;
      g.fillStyle(0x05070c, 0.1).fillRect(-w / 2 + (w / 2) * (1 - k), -h / 2 + 6, w * k, h);
    }
    g.fillStyle(color, 0.9).fillRect(-w * 0.2, h / 2 + 4, w * 0.4, 3);
    this.root.setVisible(true).setAlpha(0).setScale(0.85);
    this.tween = this.scene.tweens.chain({
      targets: this.root,
      tweens: [
        { alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' },
        { alpha: 0, scale: 1.04, duration: 320, delay: hold, ease: 'Quad.easeIn' },
      ],
      onComplete: () => this.root.setVisible(false),
    });
  }

  destroy(): void {
    this.tween?.stop();
    this.tween = null;
    this.root.destroy();
  }
}
