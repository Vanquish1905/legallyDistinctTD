import Phaser from 'phaser';
import { drawGlass } from './Panel';
import { CSS, DURATION, FONT, RADIUS, UI, space, textStyle } from './theme';

/** Look of a toast: accent colour and icon. */
export type ToastKind = 'info' | 'success' | 'warning' | 'danger' | 'money';

/** A message for `ToastStack.show`. */
export interface ToastMessage {
  title: string;
  body?: string;
  kind?: ToastKind;
  /** Texture key of the icon (defaults per kind). */
  icon?: string;
  /** Visible time in ms (default 2600). */
  duration?: number;
  /** Toasts with the same key replace each other instead of stacking (default: title). */
  key?: string;
}

const KIND: Record<ToastKind, { color: number; icon: string }> = {
  info: { color: UI.accent, icon: 'icon-info' },
  success: { color: UI.ok, icon: 'icon-check' },
  warning: { color: UI.gold, icon: 'icon-info' },
  danger: { color: UI.danger, icon: 'icon-close' },
  money: { color: UI.gold, icon: 'icon-coin' },
};

const ICON = 40;
const PAD = space(2);
const GAP = space(1);

interface ToastView {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
  key: string;
  h: number;
  /** ms left before it starts leaving. */
  life: number;
  leaving: boolean;
  y: number;
}

/**
 * Stack of small notifications anchored at a bottom-centre point; newest at the bottom,
 * older ones slide up. Views are pooled; repeated keys refresh the existing toast.
 * Call `update(dtMs)` every frame.
 */
export class ToastStack {
  private readonly live: ToastView[] = [];
  private readonly free: ToastView[] = [];
  private readonly width: number;

  /**
   * @param x centre x of the stack
   * @param bottom y of the newest toast's bottom edge
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly bottom: number,
    width = 560,
    private readonly maxVisible = 3,
    private readonly depth = 900,
  ) {
    this.width = width;
  }

  /** Show a toast (or refresh the one with the same key). */
  show(m: ToastMessage): void {
    const key = m.key ?? m.title;
    const existing = this.live.find((t) => t.key === key && !t.leaving);
    const duration = m.duration ?? 2600;
    if (existing) {
      this.fill(existing, m);
      existing.life = duration;
      this.scene.tweens.add({ targets: existing.root, scale: { from: 1.04, to: 1 }, duration: DURATION.normal, ease: 'Back.easeOut' });
      this.relayout(null);
      return;
    }
    const t = this.free.pop() ?? this.make();
    t.key = key;
    t.life = duration;
    t.leaving = false;
    this.fill(t, m);
    this.live.push(t);
    while (this.live.filter((v) => !v.leaving).length > this.maxVisible) {
      const oldest = this.live.find((v) => !v.leaving);
      if (!oldest) break;
      this.leave(oldest);
    }
    this.relayout(t);
    const root = t.root;
    root.setVisible(true).setAlpha(0).setScale(0.96);
    root.y = t.y + 24;
    this.scene.tweens.add({ targets: root, alpha: 1, y: t.y, scale: 1, duration: DURATION.slow, ease: 'Back.easeOut' });
  }

  /** Advance timers (ms). */
  update(dtMs: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const t = this.live[i] as ToastView;
      if (t.leaving) continue;
      t.life -= dtMs;
      if (t.life <= 0) this.leave(t);
    }
  }

  /** Remove every toast immediately. */
  clear(): void {
    for (const t of this.live) {
      this.scene.tweens.killTweensOf(t.root);
      t.root.setVisible(false);
      this.free.push(t);
    }
    this.live.length = 0;
  }

  destroy(): void {
    this.clear();
    for (const t of this.free) t.root.destroy();
    this.free.length = 0;
  }

  private make(): ToastView {
    const s = this.scene;
    const root = s.add.container(this.x, this.bottom).setDepth(this.depth);
    const bg = s.add.graphics();
    const icon = s.add.image(0, 0, 'icon-info');
    const title = s.add.text(0, 0, '', textStyle(FONT.md, { weight: 700 }));
    const body = s.add.text(0, 0, '', textStyle(FONT.sm, { color: CSS.textDim, wrap: this.width - PAD * 3 - ICON }));
    root.add([bg, icon, title, body]);
    return { root, bg, icon, title, body, key: '', h: 0, life: 0, leaving: false, y: 0 };
  }

  private fill(t: ToastView, m: ToastMessage): void {
    const kind = KIND[m.kind ?? 'info'];
    const w = this.width;
    const left = -w / 2;
    t.title.setText(m.title).setPosition(left + PAD * 2 + ICON - 4, 0);
    t.body.setText(m.body ?? '').setVisible(!!m.body);
    const textH = t.title.height + (m.body ? 2 + t.body.height : 0);
    const h = Math.max(ICON + PAD * 1.5, textH + PAD * 1.5);
    t.h = h;
    t.title.setY(-h / 2 + (h - textH) / 2);
    t.body.setPosition(t.title.x, t.title.y + t.title.height + 2);
    t.icon.setTexture(m.icon ?? kind.icon).setDisplaySize(ICON - 8, ICON - 8).setPosition(left + PAD + ICON / 2 - 4, 0);
    const g = t.bg;
    g.clear();
    drawGlass(g, left, -h / 2, w, h, { fill: 0x0f1522, alpha: 0.96, shadow: 1, radius: RADIUS.panel });
    g.fillStyle(kind.color, 1).fillRoundedRect(left, -h / 2, 5, h, { tl: RADIUS.panel, bl: RADIUS.panel, tr: 0, br: 0 });
    g.fillStyle(kind.color, 0.14).fillCircle(t.icon.x, 0, ICON / 2 + 2);
  }

  private leave(t: ToastView): void {
    t.leaving = true;
    this.scene.tweens.killTweensOf(t.root);
    this.scene.tweens.add({
      targets: t.root, alpha: 0, y: t.root.y + 10, duration: DURATION.normal, ease: 'Quad.easeIn',
      onComplete: () => {
        const i = this.live.indexOf(t);
        if (i >= 0) this.live.splice(i, 1);
        t.root.setVisible(false);
        this.free.push(t);
        this.relayout(null);
      },
    });
  }

  /** Stack live toasts upwards from `bottom`, newest lowest; all but `skip` glide into place. */
  private relayout(skip: ToastView | null): void {
    let y = this.bottom;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const t = this.live[i] as ToastView;
      if (t.leaving) continue;
      t.y = y - t.h / 2;
      y -= t.h + GAP;
      if (t !== skip && t.root.y !== t.y) this.scene.tweens.add({ targets: t.root, y: t.y, duration: DURATION.normal, ease: 'Cubic.easeOut' });
    }
  }
}
