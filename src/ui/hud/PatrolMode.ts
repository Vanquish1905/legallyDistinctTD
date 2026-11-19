import Phaser from 'phaser';
import { FIELD_W, GAME_H, TOPBAR_H } from '../../config';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { CSS, FONT, UI, space, textStyle } from '../theme';
import type { HudContext, HudWidget } from './HudContext';

const W = 640;
const H = 72;

/**
 * "Set patrol point" mode for the Heli Pad: while active the controller's pointer blocker keeps
 * the field from placing/selecting, a reticle follows the pointer and the next tap on the field
 * sends the helicopter there. A banner offers "Recall to pad" and "Cancel"; Esc cancels.
 */
export class PatrolMode implements HudWidget {
  private readonly banner: Panel;
  private readonly reticle: Phaser.GameObjects.Image;
  private uid: number | null = null;
  private downOnField = false;
  private readonly escKey: (() => void) | null;

  constructor(private readonly ctx: HudContext) {
    const s = ctx.scene;
    const c = ctx.c;
    this.banner = new Panel(s, (FIELD_W - W) / 2, GAME_H - H - space(3), W, H, { fill: 0x0f1a2b, alpha: 0.97, border: UI.accent, borderAlpha: 0.8, shadow: 1 })
      .blockInput();
    const icon = s.add.image(36, H / 2, 'icon-target').setDisplaySize(32, 32);
    const text = s.add.text(64, H / 2, 'Tap the map to set the patrol point', textStyle(FONT.md, { weight: 700, color: CSS.text })).setOrigin(0, 0.5);
    const recall = new Button(s, W - 96 - 120 - 16, H / 2, {
      width: 136, height: 48, label: 'Recall to pad', fontSize: FONT.sm,
      onClick: () => {
        if (this.uid !== null) c.setHeliTarget(this.uid, null);
        this.stop();
      },
    });
    const cancel = new Button(s, W - 60, H / 2, { width: 96, height: 48, variant: 'ghost', label: 'Cancel', fontSize: FONT.sm, onClick: () => this.stop() });
    this.banner.add([icon, text, recall, cancel]);
    this.banner.setDepth(120).setVisible(false);
    this.reticle = s.add.image(0, 0, 'icon-target').setDisplaySize(56, 56).setTint(UI.accent).setDepth(119).setVisible(false);

    s.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    s.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    s.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    const esc = (): void => this.stop();
    s.input.keyboard?.on('keydown-ESC', esc);
    this.escKey = () => s.input.keyboard?.off('keydown-ESC', esc);
    ctx.listen('selectionChanged', ({ uid }) => {
      if (uid !== this.uid) this.stop();
    });
    ctx.listen('gameOver', () => this.stop());
  }

  /** True while waiting for the patrol tap (the field ignores pointers meanwhile). */
  get active(): boolean {
    return this.uid !== null;
  }

  /** Start waiting for a patrol point for heli `uid`. */
  start(uid: number): void {
    this.uid = uid;
    this.downOnField = false;
    this.banner.setVisible(true).setAlpha(0).setY(GAME_H - H - space(1));
    this.ctx.scene.tweens.add({ targets: this.banner, alpha: 1, y: GAME_H - H - space(3), duration: 220, ease: 'Back.easeOut' });
  }

  stop(): void {
    if (this.uid === null) return;
    this.uid = null;
    this.reticle.setVisible(false);
    this.ctx.scene.tweens.add({ targets: this.banner, alpha: 0, duration: 150, onComplete: () => this.banner.setVisible(false) });
  }

  destroy(): void {
    const input = this.ctx.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.escKey?.();
    this.banner.destroy();
    this.reticle.destroy();
  }

  private onField(x: number, y: number, over: Phaser.GameObjects.GameObject[]): boolean {
    return over.length === 0 && x >= 0 && x < FIELD_W && y >= TOPBAR_H && y < GAME_H;
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    this.downOnField = this.active && this.onField(p.x, p.y, over);
  }

  private onMove(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.active) return;
    const show = this.onField(p.x, p.y, over);
    this.reticle.setVisible(show).setPosition(p.x, p.y);
  }

  private onUp(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.active || !this.downOnField) return;
    this.downOnField = false;
    if (!this.onField(p.x, p.y, over) || this.uid === null) return;
    if (this.ctx.c.setHeliTarget(this.uid, { x: p.x, y: p.y })) {
      this.ctx.toasts.show({ title: 'Patrol point set', kind: 'success', icon: 'icon-target', duration: 1600 });
    }
    this.stop();
  }
}
