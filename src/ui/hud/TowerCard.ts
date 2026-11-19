import Phaser from 'phaser';
import type { TowerDef } from '../../sim/types';
import { drawGlass } from '../Panel';
import { CSS, DURATION, FONT, RADIUS, UI, textStyle } from '../theme';
import { CATEGORY_COLOR } from './HudContext';
import { formatNumber, hotkeyLabel, type CardState } from './hudModel';

/** Card size in the tower selector grid (px). */
export const CARD_W = 170;
export const CARD_H = 176;

const ICON = 96;

/** Visual flags of a card besides its money state. */
interface Flags {
  state: CardState;
  hover: boolean;
  pending: boolean;
}

/**
 * One pooled tower card of the selector: icon composed from base + turret, name, cost (red when
 * unaffordable, grey when locked), hotkey badge. Positioned by its top-left corner; redraws its
 * background only when its state changes.
 */
export class TowerCard extends Phaser.GameObjects.Container {
  towerId = '';
  private readonly inner: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly base: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly cost: Phaser.GameObjects.Text;
  private readonly keyBg: Phaser.GameObjects.Graphics;
  private readonly key: Phaser.GameObjects.Text;
  private readonly lock: Phaser.GameObjects.Image;
  private category: TowerDef['category'] = 'basic';
  private price = 0;
  private readonly flags: Flags = { state: 'ok', hover: false, pending: false };
  private drawn = '';
  private pressTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.inner = scene.add.container(CARD_W / 2, CARD_H / 2);
    this.bg = scene.add.graphics();
    const iy = -CARD_H / 2 + 14 + ICON / 2;
    this.base = scene.add.image(0, iy, 'tower-blaster-base');
    this.turret = scene.add.image(0, iy, 'tower-blaster-turret').setRotation(-Math.PI / 2);
    this.nameText = scene.add.text(0, CARD_H / 2 - 50, '', textStyle(FONT.md - 1, { weight: 700 })).setOrigin(0.5);
    this.coin = scene.add.image(0, CARD_H / 2 - 22, 'icon-coin').setDisplaySize(22, 22);
    this.cost = scene.add.text(0, CARD_H / 2 - 22, '', textStyle(FONT.md, { weight: 700, color: CSS.gold })).setOrigin(0, 0.5);
    this.keyBg = scene.add.graphics();
    this.key = scene.add.text(-CARD_W / 2 + 21, -CARD_H / 2 + 21, '', textStyle(FONT.xs, { weight: 700, color: CSS.textDim })).setOrigin(0.5);
    this.lock = scene.add.image(0, iy, 'icon-lock').setDisplaySize(44, 44).setVisible(false);
    this.inner.add([this.bg, this.base, this.turret, this.lock, this.nameText, this.coin, this.cost, this.keyBg, this.key]);
    this.add(this.inner);
  }

  /** Show tower `def` at price `cost`. */
  bindTower(def: TowerDef, cost: number): void {
    this.towerId = def.id;
    this.category = def.category;
    this.price = cost;
    const s = ICON / 128;
    this.base.setTexture(def.sprite.base).setScale(s);
    this.turret.setVisible(!!def.sprite.turret);
    if (def.sprite.turret) this.turret.setTexture(def.sprite.turret).setScale(s);
    this.nameText.setText(def.name);
    if (this.nameText.width > CARD_W - 16) this.nameText.setScale((CARD_W - 16) / this.nameText.width);
    else this.nameText.setScale(1);
    this.cost.setText(formatNumber(cost));
    const total = 22 + 6 + this.cost.width;
    this.coin.setX(-total / 2 + 11);
    this.cost.setX(-total / 2 + 28);
    const hk = hotkeyLabel(def.id);
    this.key.setText(hk ?? '').setVisible(hk !== null);
    this.keyBg.clear();
    if (hk !== null) {
      this.keyBg.fillStyle(UI.track, 0.9).fillRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 8, 26, 26, 7);
      this.keyBg.lineStyle(1, UI.border, 1).strokeRoundedRect(-CARD_W / 2 + 8.5, -CARD_H / 2 + 8.5, 25, 25, 7);
    }
    this.drawn = '';
    this.redraw();
  }

  /** Update money/lock/hover/pending state; cheap when nothing changed. */
  setFlags(state: CardState, hover: boolean, pending: boolean): void {
    const f = this.flags;
    if (f.state === state && f.hover === hover && f.pending === pending && this.drawn !== '') return;
    f.state = state;
    f.hover = hover;
    f.pending = pending;
    this.redraw();
  }

  /** Press-scale feedback. */
  press(down: boolean): void {
    this.pressTween?.stop();
    this.pressTween = this.scene.tweens.add({
      targets: this.inner, scale: down ? 0.95 : 1, duration: down ? 80 : DURATION.normal, ease: down ? 'Quad.easeOut' : 'Back.easeOut',
    });
  }

  private redraw(): void {
    const f = this.flags;
    const sig = `${f.state}|${f.hover}|${f.pending}|${this.category}`;
    if (sig === this.drawn) return;
    this.drawn = sig;
    const g = this.bg;
    const x = -CARD_W / 2;
    const y = -CARD_H / 2;
    const cat = CATEGORY_COLOR[this.category];
    g.clear();
    if (f.pending) {
      g.fillStyle(UI.accent, 0.18).fillRoundedRect(x - 4, y - 4, CARD_W + 8, CARD_H + 8, RADIUS.button + 4);
    }
    drawGlass(g, x, y, CARD_W, CARD_H, {
      fill: f.pending ? 0x12324a : f.hover ? UI.surfaceHover : UI.surface,
      alpha: 1,
      radius: RADIUS.button,
      border: f.pending ? UI.accent : f.hover ? 0x4a5d85 : UI.border,
      borderWidth: f.pending ? 2 : 1,
      shadow: 0.4,
    });
    // Category glow behind the icon and a thin category stripe on top.
    const iy = y + 14 + ICON / 2;
    const locked = f.state === 'locked';
    g.fillStyle(cat, locked ? 0.04 : f.hover || f.pending ? 0.2 : 0.12).fillCircle(0, iy, ICON / 2 - 2);
    g.fillStyle(cat, locked ? 0.25 : 0.85).fillRoundedRect(-24, y + 1, 48, 3, 1.5);
    const dim = f.state !== 'ok';
    this.base.setAlpha(locked ? 0.25 : dim ? 0.55 : 1);
    this.turret.setAlpha(locked ? 0.25 : dim ? 0.55 : 1);
    this.lock.setVisible(locked);
    this.nameText.setColor(locked ? CSS.textMute : CSS.text);
    this.cost.setColor(f.state === 'ok' ? CSS.gold : f.state === 'expensive' ? CSS.danger : CSS.textMute);
    this.coin.setAlpha(f.state === 'ok' ? 1 : 0.5);
  }

  /** Price this card shows. */
  get shownCost(): number {
    return this.price;
  }

  override destroy(fromScene?: boolean): void {
    this.pressTween?.stop();
    this.pressTween = null;
    super.destroy(fromScene);
  }
}
