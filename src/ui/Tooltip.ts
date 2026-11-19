import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { drawGlass } from './Panel';
import { CSS, DURATION, FONT, UI, cssColor, space, textStyle } from './theme';
import { LONG_PRESS_MS } from './gesture';

/** What a tooltip shows. */
export interface TooltipContent {
  title: string;
  /** Small coloured line under the title (category, cost...). */
  subtitle?: string;
  subtitleColor?: number;
  body?: string;
  /** Bullet lines under the body (stats, traits). */
  lines?: readonly string[];
}

/** Screen rectangle a tooltip points at. */
export interface AnchorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Which side of the anchor the tooltip prefers. */
export type TooltipSide = 'left' | 'right' | 'top' | 'bottom';

const PAD = space(2);
const GAP = 12;
/** Mouse hover delay before showing (ms). */
const HOVER_DELAY = 320;

/**
 * Floating info box. One per scene is enough; it never takes input, so it can never block a
 * click. Show it with `show`, or wire it to an object with `bindTooltip` (hover for mouse,
 * long-press for touch).
 */
export class Tooltip extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly lines: Phaser.GameObjects.Text;
  private fade: Phaser.Tweens.Tween | null = null;
  private th = 0;

  constructor(scene: Phaser.Scene, private readonly tw = 360) {
    super(scene, 0, 0);
    const inner = tw - PAD * 2;
    this.bg = scene.add.graphics();
    this.title = scene.add.text(PAD, PAD, '', textStyle(FONT.lg, { weight: 700 }));
    this.subtitle = scene.add.text(PAD, 0, '', textStyle(FONT.xs, { weight: 700, color: CSS.accent }));
    this.bodyText = scene.add.text(PAD, 0, '', textStyle(FONT.sm, { color: CSS.textDim, wrap: inner, lineSpacing: 4 }));
    this.lines = scene.add.text(PAD, 0, '', textStyle(FONT.sm, { color: CSS.text, wrap: inner, lineSpacing: 6 }));
    this.add([this.bg, this.title, this.subtitle, this.bodyText, this.lines]);
    this.setVisible(false).setAlpha(0).setDepth(1000);
    scene.add.existing(this);
  }

  /** Show `content` next to `anchor` (screen px), preferring `side`, clamped to the screen. */
  show(content: TooltipContent, anchor: AnchorRect, side: TooltipSide = 'left'): void {
    this.title.setText(content.title);
    let y = PAD + this.title.height + 2;
    this.subtitle.setVisible(!!content.subtitle).setText(content.subtitle ?? '');
    this.subtitle.setColor(content.subtitleColor !== undefined ? cssColor(content.subtitleColor) : CSS.accent);
    if (content.subtitle) {
      this.subtitle.setY(y);
      y += this.subtitle.height + space(1);
    } else y += 6;
    this.bodyText.setVisible(!!content.body).setText(content.body ?? '');
    if (content.body) {
      this.bodyText.setY(y);
      y += this.bodyText.height + space(1);
    }
    const lines = content.lines ?? [];
    this.lines.setVisible(lines.length > 0).setText(lines.map((l) => `•  ${l}`).join('\n'));
    if (lines.length) {
      this.lines.setY(y + 4);
      y += this.lines.height + space(1) + 4;
    }
    this.th = y + PAD - space(1);
    this.bg.clear();
    drawGlass(this.bg, 0, 0, this.tw, this.th, { fill: 0x0f1522, alpha: 0.97, shadow: 1, border: 0x3b4a6b });
    if (lines.length) {
      this.bg.lineStyle(1, UI.border, 0.8);
      this.bg.lineBetween(PAD, this.lines.y - 6, this.tw - PAD, this.lines.y - 6);
    }
    const { x: tx, y: ty } = this.place(anchor, side);
    this.setPosition(tx, ty);
    this.fade?.stop();
    if (!this.visible) {
      const dx = side === 'left' ? 10 : side === 'right' ? -10 : 0;
      const dy = side === 'top' ? 10 : side === 'bottom' ? -10 : 0;
      this.setVisible(true).setAlpha(0).setPosition(tx + dx, ty + dy);
      this.fade = this.scene.tweens.add({ targets: this, alpha: 1, x: tx, y: ty, duration: DURATION.fast, ease: 'Quad.easeOut' });
    } else this.setAlpha(1);
  }

  /** Hide (fades out quickly). */
  hide(): void {
    if (!this.visible) return;
    this.fade?.stop();
    this.fade = this.scene.tweens.add({
      targets: this, alpha: 0, duration: DURATION.fast, ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
  }

  private place(a: AnchorRect, side: TooltipSide): { x: number; y: number } {
    const w = this.tw;
    const h = this.th;
    let x: number;
    let y: number;
    if (side === 'left' || side === 'right') {
      x = side === 'left' ? a.x - GAP - w : a.x + a.w + GAP;
      if (x < 8 || x + w > GAME_W - 8) x = side === 'left' ? a.x + a.w + GAP : a.x - GAP - w;
      y = a.y + a.h / 2 - h / 2;
    } else {
      y = side === 'top' ? a.y - GAP - h : a.y + a.h + GAP;
      if (y < 8 || y + h > GAME_H - 8) y = side === 'top' ? a.y + a.h + GAP : a.y - GAP - h;
      x = a.x + a.w / 2 - w / 2;
    }
    return { x: clamp(x, 8, GAME_W - 8 - w), y: clamp(y, 8, GAME_H - 8 - h) };
  }

  override destroy(fromScene?: boolean): void {
    this.fade?.stop();
    this.fade = null;
    super.destroy(fromScene);
  }
}

/** Options of `bindTooltip`. */
export interface TooltipBinding {
  /** Content to show; return null to show nothing right now. */
  content: () => TooltipContent | null;
  /** Screen rectangle to point at (default: the target's bounds). */
  anchor?: () => AnchorRect;
  side?: TooltipSide;
  /** Called when a touch long-press opened the tooltip (e.g. to swallow the click). */
  onLongPress?: () => void;
}

/**
 * Wire `tooltip` to an interactive game object: shows after a short hover with a mouse, or on
 * long-press with touch; hides on out / release. Returns an unbind function.
 */
export function bindTooltip(target: Phaser.GameObjects.GameObject, tooltip: Tooltip, b: TooltipBinding): () => void {
  const scene = target.scene;
  let timer: Phaser.Time.TimerEvent | null = null;
  const clear = (): void => {
    timer?.remove(false);
    timer = null;
  };
  const anchorOf = (): AnchorRect => {
    if (b.anchor) return b.anchor();
    const r = (target as unknown as Phaser.GameObjects.Components.GetBounds).getBounds();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const open = (touch: boolean): void => {
    timer = null;
    const c = b.content();
    if (!c) return;
    tooltip.show(c, anchorOf(), b.side ?? 'left');
    if (touch) b.onLongPress?.();
  };
  const over = (p: Phaser.Input.Pointer): void => {
    if (p.wasTouch) return;
    clear();
    timer = scene.time.delayedCall(HOVER_DELAY, () => open(false));
  };
  const down = (p: Phaser.Input.Pointer): void => {
    clear();
    if (!p.wasTouch) {
      tooltip.hide();
      return;
    }
    timer = scene.time.delayedCall(LONG_PRESS_MS, () => open(true));
  };
  const out = (): void => {
    clear();
    tooltip.hide();
  };
  const up = (p: Phaser.Input.Pointer): void => {
    clear();
    if (p.wasTouch) tooltip.hide();
  };
  const E = Phaser.Input.Events;
  target.on(E.GAMEOBJECT_POINTER_OVER, over);
  target.on(E.GAMEOBJECT_POINTER_DOWN, down);
  target.on(E.GAMEOBJECT_POINTER_OUT, out);
  target.on(E.GAMEOBJECT_POINTER_UP, up);
  return () => {
    clear();
    target.off(E.GAMEOBJECT_POINTER_OVER, over);
    target.off(E.GAMEOBJECT_POINTER_DOWN, down);
    target.off(E.GAMEOBJECT_POINTER_OUT, out);
    target.off(E.GAMEOBJECT_POINTER_UP, up);
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
