import Phaser from 'phaser';
import { RADIUS, UI } from './theme';

/** Look of a glass panel. All fields optional; defaults are the theme panel. */
export interface GlassStyle {
  fill?: number;
  alpha?: number;
  border?: number;
  borderAlpha?: number;
  /** Border width in px (default 1). */
  borderWidth?: number;
  radius?: number;
  /** Soft drop shadow strength 0..1 (0 = none; default 0.5). */
  shadow?: number;
  /** Subtle light band along the top inner edge (default true). */
  highlight?: boolean;
}

/**
 * Draw a dark glass panel into `g` at (x, y, w, h): soft layered drop shadow, translucent fill,
 * a faint top highlight band and a 1 px border. Does not clear `g`.
 */
export function drawGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, s: GlassStyle = {}): void {
  const r = Math.min(s.radius ?? RADIUS.panel, h / 2, w / 2);
  const shadow = s.shadow ?? 0.5;
  if (shadow > 0) {
    // Three widening, fading layers approximate a blurred shadow without a texture.
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(UI.shadow, 0.13 * shadow * (4 - i));
      g.fillRoundedRect(x - i * 2, y - i + 4 + i * 2, w + i * 4, h + i * 2, r + i * 2);
    }
  }
  g.fillStyle(s.fill ?? UI.panel, s.alpha ?? UI.panelAlpha);
  g.fillRoundedRect(x, y, w, h, r);
  if (s.highlight ?? true) {
    const band = Math.min(h * 0.45, 40);
    g.fillStyle(UI.white, 0.035);
    g.fillRoundedRect(x + 1, y + 1, w - 2, band, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
    g.lineStyle(1, UI.white, 0.06);
    g.beginPath();
    g.moveTo(x + r, y + 1.5);
    g.lineTo(x + w - r, y + 1.5);
    g.strokePath();
  }
  const bw = s.borderWidth ?? 1;
  if (bw > 0) {
    g.lineStyle(bw, s.border ?? UI.border, s.borderAlpha ?? 1);
    g.strokeRoundedRect(x + bw / 2, y + bw / 2, w - bw, h - bw, r);
  }
}

/**
 * A glass panel game object: a Container whose background is redrawn on `resize`. Add content
 * with `add(...)`; children use the panel's top-left as (0, 0).
 */
export class Panel extends Phaser.GameObjects.Container {
  readonly bg: Phaser.GameObjects.Graphics;
  private pw: number;
  private ph: number;
  private blocker: Phaser.GameObjects.Zone | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, private style: GlassStyle = {}) {
    super(scene, x, y);
    this.pw = width;
    this.ph = height;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.setSize(width, height);
    this.redraw();
    scene.add.existing(this);
  }

  get panelWidth(): number {
    return this.pw;
  }

  get panelHeight(): number {
    return this.ph;
  }

  /** Change size (and optionally style) and redraw the background. */
  resize(width: number, height: number, style?: GlassStyle): this {
    this.pw = width;
    this.ph = height;
    if (style) this.style = style;
    this.setSize(width, height);
    if (this.blocker) {
      this.blocker.setSize(width, height);
      this.blocker.input?.hitArea.setTo(0, 0, width, height);
    }
    this.redraw();
    return this;
  }

  /**
   * Swallow pointer events on the panel area so nothing below (other scenes, the field)
   * receives them.
   */
  blockInput(): this {
    if (!this.blocker) {
      this.blocker = this.scene.add.zone(0, 0, this.pw, this.ph).setOrigin(0, 0).setInteractive();
      this.addAt(this.blocker, 0);
    }
    return this;
  }

  private redraw(): void {
    this.bg.clear();
    drawGlass(this.bg, 0, 0, this.pw, this.ph, this.style);
  }
}
