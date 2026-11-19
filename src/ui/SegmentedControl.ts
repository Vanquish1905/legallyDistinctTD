import Phaser from 'phaser';
import { CSS, DURATION, FONT, HIT_MIN, RADIUS, UI, textStyle } from './theme';

/** One choice of a segmented control. */
export interface Segment<T extends string> {
  id: T;
  label: string;
}

/** Constructor options of `SegmentedControl`. Positioned by its top-left corner. */
export interface SegmentedOptions<T extends string> {
  width: number;
  height: number;
  segments: readonly Segment<T>[];
  value: T;
  fontSize?: number;
  onChange?: (id: T) => void;
}

/**
 * A row of mutually exclusive choices on a recessed track with a sliding highlight (tabs,
 * target mode, speed). Each segment's touch target is at least `HIT_MIN` px tall.
 */
export class SegmentedControl<T extends string> extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly thumb: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  private readonly segW: number;
  private current: T;
  private enabled = true;
  private hoverIndex = -1;
  private thumbTween: Phaser.Tweens.Tween | null = null;
  private onChange: ((id: T) => void) | null;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly o: SegmentedOptions<T>) {
    super(scene, x, y);
    this.current = o.value;
    this.onChange = o.onChange ?? null;
    const n = o.segments.length;
    this.segW = o.width / n;
    this.track = scene.add.graphics();
    this.thumb = scene.add.graphics();
    this.add([this.track, this.thumb]);
    const hitH = Math.max(o.height, HIT_MIN);
    o.segments.forEach((seg, i) => {
      const cx = this.segW * (i + 0.5);
      const label = scene.add
        .text(cx, o.height / 2, seg.label, textStyle(o.fontSize ?? FONT.sm, { weight: 700, color: CSS.textDim }))
        .setOrigin(0.5);
      const zone = scene.add
        .zone(cx, o.height / 2, this.segW, hitH)
        .setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.pick(i));
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.setHover(i));
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setHover(-1));
      this.labels.push(label);
      this.zones.push(zone);
      this.add([label, zone]);
    });
    this.drawTrack();
    this.drawThumb();
    this.thumb.x = this.indexOf(this.current) * this.segW;
    this.refreshLabels();
    scene.add.existing(this);
  }

  get value(): T {
    return this.current;
  }

  /** Select `id` (animated slide); `emit` also calls onChange. */
  setValue(id: T, animate = true, emit = false): this {
    const i = this.indexOf(id);
    if (i < 0) return this;
    const changed = id !== this.current;
    this.current = id;
    const tx = i * this.segW;
    this.thumbTween?.stop();
    if (animate && this.scene && this.thumb.x !== tx) {
      this.thumbTween = this.scene.tweens.add({ targets: this.thumb, x: tx, duration: DURATION.normal, ease: 'Cubic.easeOut' });
    } else this.thumb.x = tx;
    this.refreshLabels();
    if (changed && emit) this.onChange?.(id);
    return this;
  }

  /** Centre of segment `id` in screen px, or null when hidden/unknown. */
  segmentCenter(id: T): { x: number; y: number } | null {
    const i = this.indexOf(id);
    if (i < 0 || !this.visible) return null;
    const m = this.getWorldTransformMatrix();
    return { x: m.tx + this.segW * (i + 0.5), y: m.ty + this.o.height / 2 };
  }

  setEnabled(enabled: boolean): this {
    if (enabled === this.enabled) return this;
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.45);
    for (const z of this.zones) if (z.input) z.input.cursor = enabled ? 'pointer' : 'default';
    return this;
  }

  private pick(i: number): void {
    const seg = this.o.segments[i];
    if (!seg || !this.enabled) return;
    this.setValue(seg.id, true, true);
  }

  private setHover(i: number): void {
    this.hoverIndex = i;
    this.refreshLabels();
  }

  private indexOf(id: T): number {
    return this.o.segments.findIndex((s) => s.id === id);
  }

  private refreshLabels(): void {
    const sel = this.indexOf(this.current);
    this.labels.forEach((l, i) => {
      const color = i === sel ? '#ffffff' : i === this.hoverIndex && this.enabled ? CSS.text : CSS.textDim;
      if (l.style.color !== color) l.setColor(color);
    });
  }

  private drawTrack(): void {
    const { width, height } = this.o;
    const g = this.track;
    g.clear();
    g.fillStyle(UI.track, 0.9).fillRoundedRect(0, 0, width, height, RADIUS.button);
    g.lineStyle(1, UI.border, 0.8).strokeRoundedRect(0.5, 0.5, width - 1, height - 1, RADIUS.button);
  }

  private drawThumb(): void {
    const inset = 4;
    const w = this.segW - inset * 2;
    const h = this.o.height - inset * 2;
    const g = this.thumb;
    g.clear();
    g.fillStyle(UI.shadow, 0.3).fillRoundedRect(inset, inset + 2, w, h, RADIUS.small + 1);
    g.fillStyle(0x0c8fd0, 1).fillRoundedRect(inset, inset, w, h, RADIUS.small + 1);
    g.fillStyle(UI.white, 0.12).fillRoundedRect(inset + 1, inset + 1, w - 2, h * 0.45, { tl: RADIUS.small, tr: RADIUS.small, bl: 0, br: 0 });
    g.lineStyle(1, UI.accent, 1).strokeRoundedRect(inset + 0.5, inset + 0.5, w - 1, h - 1, RADIUS.small + 1);
  }

  override destroy(fromScene?: boolean): void {
    this.thumbTween?.stop();
    this.thumbTween = null;
    this.onChange = null;
    super.destroy(fromScene);
  }
}
