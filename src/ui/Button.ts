import Phaser from 'phaser';
import { CSS, DURATION, FONT, HIT_MIN, RADIUS, UI, textStyle } from './theme';
import { drawGlass } from './Panel';

/** Color scheme of a button. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold';

/** Constructor options of `Button`. Sizes are px; the button is positioned by its centre. */
export interface ButtonOptions {
  width: number;
  height: number;
  variant?: ButtonVariant;
  label?: string;
  fontSize?: number;
  /** Texture key of an icon drawn left of the label (or centred without a label). */
  icon?: string;
  iconSize?: number;
  radius?: number;
  onClick?: () => void;
}

interface Scheme {
  fill: number;
  fillAlpha: number;
  hover: number;
  border: number;
  borderAlpha: number;
  text: string;
}

const SCHEMES: Record<ButtonVariant, Scheme> = {
  primary: { fill: 0x0c8fd0, fillAlpha: 1, hover: 0x1aa6e8, border: UI.accent, borderAlpha: 1, text: '#ffffff' },
  secondary: { fill: UI.surface, fillAlpha: 1, hover: UI.surfaceHover, border: UI.border, borderAlpha: 1, text: CSS.text },
  ghost: { fill: UI.surface, fillAlpha: 0, hover: UI.surfaceHover, border: UI.border, borderAlpha: 0, text: CSS.text },
  danger: { fill: 0x2a1522, fillAlpha: 1, hover: 0x3b1a2b, border: UI.danger, borderAlpha: 0.7, text: CSS.danger },
  success: { fill: 0x10281f, fillAlpha: 1, hover: 0x16382b, border: UI.ok, borderAlpha: 0.7, text: CSS.ok },
  gold: { fill: 0x2a2212, fillAlpha: 1, hover: 0x3a2f16, border: UI.gold, borderAlpha: 0.7, text: CSS.gold },
};

/**
 * Clickable surface with hover / pressed / disabled / selected states, a press-scale tween and a
 * touch target of at least `HIT_MIN` px. Positioned by its centre. Custom content goes into
 * `content` (coordinates relative to the centre); `label` and `icon` are optional built-ins.
 *
 * Clicks fire on release over the button (tap on touch). Disabled buttons still receive hover
 * (so tooltips can explain why) but never click.
 */
export class Button extends Phaser.GameObjects.Container {
  /** Children here scale with the press animation; (0, 0) is the button centre. */
  readonly content: Phaser.GameObjects.Container;
  readonly hit: Phaser.GameObjects.Zone;
  protected readonly bg: Phaser.GameObjects.Graphics;
  protected label: Phaser.GameObjects.Text | null = null;
  protected icon: Phaser.GameObjects.Image | null = null;
  protected bw: number;
  protected bh: number;
  private variant: ButtonVariant;
  private readonly radius: number;
  private hovered = false;
  private pressed = false;
  private enabled = true;
  private selected = false;
  private focused = false;
  private clickFn: (() => void) | null;
  private pressTween: Phaser.Tweens.Tween | null = null;
  private swallowClick = false;
  private readonly iconSize: number;

  constructor(scene: Phaser.Scene, x: number, y: number, o: ButtonOptions) {
    super(scene, x, y);
    this.bw = o.width;
    this.bh = o.height;
    this.variant = o.variant ?? 'secondary';
    this.radius = o.radius ?? RADIUS.button;
    this.clickFn = o.onClick ?? null;
    this.iconSize = o.iconSize ?? Math.round(Math.min(o.height * 0.5, 36));
    this.content = scene.add.container(0, 0);
    this.bg = scene.add.graphics();
    this.content.add(this.bg);
    if (o.icon) {
      this.icon = scene.add.image(0, 0, o.icon).setDisplaySize(this.iconSize, this.iconSize);
      this.content.add(this.icon);
    }
    if (o.label !== undefined) {
      this.label = scene.add
        .text(0, 0, o.label, textStyle(o.fontSize ?? FONT.md, { weight: 700, color: SCHEMES[this.variant].text }))
        .setOrigin(0.5);
      this.content.add(this.label);
    }
    this.layoutContent();
    this.hit = scene.add
      .zone(0, 0, Math.max(this.bw, HIT_MIN), Math.max(this.bh, HIT_MIN))
      .setInteractive({ useHandCursor: true });
    this.add([this.content, this.hit]);
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.onOver, this);
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onOut, this);
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.onUp, this);
    this.redraw();
    scene.add.existing(this);
  }

  get buttonWidth(): number {
    return this.bw;
  }

  get buttonHeight(): number {
    return this.bh;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isHovered(): boolean {
    return this.hovered;
  }

  /** Set (replace) the click handler. */
  onClick(fn: () => void): this {
    this.clickFn = fn;
    return this;
  }

  /** Centre in screen (scene) px, or null while hidden. */
  screenCenter(): { x: number; y: number } | null {
    if (!this.visible || (this.parentContainer && !this.parentContainer.visible)) return null;
    const m = this.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  /** Swallow the click of the current press (e.g. a long-press opened a tooltip instead). */
  suppressNextClick(): void {
    this.swallowClick = true;
  }

  /** Activate as if clicked (keyboard focus, tests). Ignored while disabled. */
  click(): void {
    if (this.enabled && this.visible) this.clickFn?.();
  }

  setEnabled(enabled: boolean): this {
    if (enabled === this.enabled) return this;
    this.enabled = enabled;
    if (this.hit.input) this.hit.input.cursor = enabled ? 'pointer' : 'default';
    this.redraw();
    return this;
  }

  /** Selected = toggled on (segmented controls, toggles): accent border and tint. */
  setSelected(selected: boolean): this {
    if (selected === this.selected) return this;
    this.selected = selected;
    this.redraw();
    return this;
  }

  /** Keyboard focus ring (for modals). */
  setFocused(focused: boolean): this {
    if (focused === this.focused) return this;
    this.focused = focused;
    this.redraw();
    return this;
  }

  setVariant(variant: ButtonVariant): this {
    if (variant === this.variant) return this;
    this.variant = variant;
    this.label?.setColor(SCHEMES[variant].text);
    this.redraw();
    return this;
  }

  /** Change the label text (no-op when unchanged, so it is cheap to call on every update). */
  setLabel(text: string): this {
    if (this.label && this.label.text !== text) {
      this.label.setText(text);
      this.layoutContent();
    }
    return this;
  }

  setLabelColor(color: string): this {
    this.label?.setColor(color);
    return this;
  }

  setIcon(key: string): this {
    if (this.icon && this.icon.texture.key !== key) this.icon.setTexture(key).setDisplaySize(this.iconSize, this.iconSize);
    return this;
  }

  /** Resize the button surface (and hit area). */
  setButtonSize(width: number, height: number): this {
    this.bw = width;
    this.bh = height;
    this.hit.setSize(Math.max(width, HIT_MIN), Math.max(height, HIT_MIN));
    this.hit.input?.hitArea.setTo(0, 0, this.hit.width, this.hit.height);
    this.layoutContent();
    this.redraw();
    return this;
  }

  /** Redraw the background for the current state. Subclasses may extend. */
  protected redraw(): void {
    const s = SCHEMES[this.variant];
    const g = this.bg;
    const x = -this.bw / 2;
    const y = -this.bh / 2;
    g.clear();
    const fill = !this.enabled ? UI.surface : this.pressed ? s.fill : this.hovered ? s.hover : s.fill;
    const fillAlpha = !this.enabled ? 0.6 : this.variant === 'ghost' && (this.hovered || this.pressed) ? 0.9 : s.fillAlpha;
    const border = this.selected ? UI.accent : s.border;
    const borderAlpha = !this.enabled ? 0.35 : this.selected ? 1 : this.hovered && this.variant !== 'ghost' ? 1 : s.borderAlpha;
    drawGlass(g, x, y, this.bw, this.bh, {
      fill: this.selected ? 0x12324a : fill,
      alpha: fillAlpha,
      border,
      borderAlpha,
      borderWidth: this.selected ? 2 : 1,
      radius: this.radius,
      shadow: this.variant === 'ghost' || !this.enabled ? 0 : 0.35,
      highlight: this.variant !== 'ghost',
    });
    if (this.focused) {
      g.lineStyle(2, UI.accent, 0.9);
      g.strokeRoundedRect(x - 4, y - 4, this.bw + 8, this.bh + 8, this.radius + 4);
    }
    this.content.setAlpha(this.enabled ? 1 : 0.5);
  }

  private layoutContent(): void {
    const gap = 10;
    if (this.icon && this.label) {
      const total = this.iconSize + gap + this.label.width;
      this.icon.setPosition(-total / 2 + this.iconSize / 2, 0);
      this.label.setOrigin(0, 0.5).setPosition(-total / 2 + this.iconSize + gap, 0);
    } else {
      this.icon?.setPosition(0, 0);
      this.label?.setOrigin(0.5).setPosition(0, 0);
    }
  }

  private onOver(): void {
    this.hovered = true;
    this.redraw();
  }

  private onOut(): void {
    this.hovered = false;
    if (this.pressed) this.release(false);
    this.redraw();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (p.rightButtonDown()) return;
    this.pressed = true;
    this.swallowClick = false;
    this.animatePress(true);
    this.redraw();
  }

  private onUp(): void {
    if (!this.pressed) return;
    this.release(true);
  }

  private release(fire: boolean): void {
    this.pressed = false;
    this.animatePress(false);
    this.redraw();
    const swallow = this.swallowClick;
    this.swallowClick = false;
    if (fire && this.enabled && !swallow) this.clickFn?.();
  }

  private animatePress(down: boolean): void {
    this.pressTween?.stop();
    this.pressTween = this.scene.tweens.add({
      targets: this.content,
      scale: down ? 0.95 : 1,
      duration: down ? DURATION.fast * 0.7 : DURATION.normal,
      ease: down ? 'Quad.easeOut' : 'Back.easeOut',
    });
  }

  override destroy(fromScene?: boolean): void {
    this.pressTween?.stop();
    this.pressTween = null;
    this.clickFn = null;
    super.destroy(fromScene);
  }
}
