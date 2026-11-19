import Phaser from 'phaser';
import { ScrollPhysics } from './ScrollPhysics';
import { PressGesture } from './gesture';
import { UI } from './theme';

/** Constructor options of `ScrollList`. The viewport rectangle is in scene (screen) px. */
export interface ScrollListOptions<V extends Phaser.GameObjects.Container> {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Items per row (1 = plain list). */
  columns: number;
  itemHeight: number;
  /** Space between items, both directions (px). */
  gap: number;
  /** Empty space above the first and below the last row (px). */
  padding?: number;
  /** Create one pooled item view (positioned by its top-left). */
  create: () => V;
  /** Fill `view` for item `index` (called when a view (re)binds or on `refresh`). */
  bind: (view: V, index: number) => void;
  /** A tap (not a drag, not a long-press, not a press that stopped a fling) on an item. */
  onTap?: (index: number, view: V) => void;
  /** Mouse hover changed (index -1 = none). */
  onHover?: (index: number, view: V | null) => void;
  /** Item pressed / released (for press visuals). */
  onPress?: (index: number, view: V, down: boolean) => void;
  /** Touch long-press on an item (tooltips). */
  onLongPress?: (index: number, view: V) => void;
  /**
   * A press on an item turned into a mostly horizontal drag toward -x (out of a right-hand
   * sidebar). When set, such drags call this instead of scrolling (drag-to-place).
   */
  onDragOut?: (index: number) => void;
}

const SCROLLBAR_W = 6;
const SCROLLBAR_GAP = 5;
const SCROLLBAR_HIT = 22;
const SCROLLBAR_MIN = 40;
/** Scrollbar stays visible this long after the last movement (ms). */
const SCROLLBAR_LINGER = 900;
/** A drag counts as "out" when horizontal travel exceeds vertical by this factor. */
const DRAG_OUT_RATIO = 1.3;

/**
 * Vertical, mask-clipped, virtualised list/grid. Only rows in view have item views; views are
 * pooled and re-bound while scrolling, so long lists cost the same as short ones.
 *
 * Input: mouse wheel, drag with inertia and overscroll bounce, a draggable scrollbar thumb,
 * tap vs drag threshold (a press that stops a fling never taps), touch long-press.
 * The owner must call `update(dt)` every frame and `destroy()` on shutdown.
 */
export class ScrollList<V extends Phaser.GameObjects.Container> extends Phaser.GameObjects.Container {
  readonly physics = new ScrollPhysics();
  private readonly content: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly barZone: Phaser.GameObjects.Zone;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly gesture = new PressGesture();
  private readonly bound = new Map<number, V>();
  private readonly pool: V[] = [];
  private readonly scratch: number[] = [];
  private total = 0;
  private viewH: number;
  private readonly itemW: number;
  private pointerId = -1;
  private pressIndex = -1;
  private hoverIndex = -1;
  private hoverX = 0;
  private hoverY = 0;
  private hovering = false;
  private thumbDrag = false;
  private thumbGrab = 0;
  private lastActivity = -Infinity;
  private barAlpha = 0;
  private laidOutOffset = Number.NaN;

  constructor(scene: Phaser.Scene, private readonly o: ScrollListOptions<V>) {
    super(scene, 0, 0);
    this.viewH = o.height;
    this.itemW = (o.width - o.gap * (o.columns - 1)) / o.columns;
    this.content = scene.add.container(o.x, o.y);
    this.maskShape = scene.make.graphics({}, false);
    this.content.setMask(this.maskShape.createGeometryMask());
    this.bar = scene.add.graphics();
    this.zone = scene.add.zone(o.x, o.y, o.width, o.height).setOrigin(0, 0).setInteractive();
    this.barZone = scene.add
      .zone(o.x + o.width + SCROLLBAR_GAP - (SCROLLBAR_HIT - SCROLLBAR_W) / 2, o.y, SCROLLBAR_HIT, o.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.add([this.content, this.bar, this.zone, this.barZone]);
    const E = Phaser.Input.Events;
    this.zone.on(E.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.zone.on(E.GAMEOBJECT_POINTER_MOVE, this.onHoverMove, this);
    this.zone.on(E.GAMEOBJECT_POINTER_OUT, this.onHoverOut, this);
    this.zone.on(E.GAMEOBJECT_POINTER_WHEEL, this.onWheel, this);
    this.barZone.on(E.GAMEOBJECT_POINTER_DOWN, this.onBarDown, this);
    this.barZone.on(E.GAMEOBJECT_POINTER_WHEEL, this.onWheel, this);
    scene.input.on(E.POINTER_MOVE, this.onMove, this);
    scene.input.on(E.POINTER_UP, this.onUp, this);
    scene.input.on(E.POINTER_UP_OUTSIDE, this.onUp, this);
    this.redrawMask();
    scene.add.existing(this);
  }

  /** Width of one item (px). */
  get itemWidth(): number {
    return this.itemW;
  }

  get itemCount(): number {
    return this.total;
  }

  /** Set the number of items; `resetScroll` jumps back to the top. Rebinds visible views. */
  setCount(count: number, resetScroll = false): void {
    this.total = Math.max(0, count);
    this.physics.setSize(this.viewH, this.contentHeight());
    if (resetScroll) this.physics.scrollTo(0);
    this.releaseAll();
    this.layout(true);
  }

  /** Change the viewport height (top stays put), e.g. when a panel slides over the list. */
  setViewportHeight(height: number): void {
    const h = Math.max(0, Math.round(height));
    if (h === this.viewH) return;
    this.viewH = h;
    this.zone.setSize(this.o.width, h);
    this.zone.input?.hitArea.setTo(0, 0, this.o.width, h);
    this.barZone.setSize(SCROLLBAR_HIT, h);
    this.barZone.input?.hitArea.setTo(0, 0, SCROLLBAR_HIT, h);
    this.physics.setSize(h, this.contentHeight());
    this.redrawMask();
    this.layout(true);
  }

  get viewportHeight(): number {
    return this.viewH;
  }

  /** Re-run `bind` for every visible view (data changed, e.g. money). */
  refresh(): void {
    for (const [i, v] of this.bound) this.o.bind(v, i);
  }

  /** Visit every bound (visible) view. */
  forEachVisible(fn: (view: V, index: number) => void): void {
    for (const [i, v] of this.bound) fn(v, i);
  }

  /** View of item `index` when it is in view. */
  viewAt(index: number): V | undefined {
    return this.bound.get(index);
  }

  /** Scroll so item `index` is fully visible. */
  scrollToIndex(index: number, animate = true): void {
    const rowH = this.o.itemHeight + this.o.gap;
    const top = (this.o.padding ?? 0) + Math.floor(index / this.o.columns) * rowH;
    const off = this.physics.offset;
    if (top < off) this.physics.scrollTo(top - (this.o.padding ?? 0), animate);
    else if (top + this.o.itemHeight > off + this.viewH) this.physics.scrollTo(top + this.o.itemHeight - this.viewH + (this.o.padding ?? 0), animate);
    this.touch();
  }

  /** Screen-space rectangle of item `index` (whether visible or not). */
  itemRect(index: number): { x: number; y: number; w: number; h: number } {
    const col = index % this.o.columns;
    const row = Math.floor(index / this.o.columns);
    return {
      x: this.o.x + col * (this.itemW + this.o.gap),
      y: this.o.y + (this.o.padding ?? 0) + row * (this.o.itemHeight + this.o.gap) - this.physics.offset,
      w: this.itemW,
      h: this.o.itemHeight,
    };
  }

  /** Item index under screen point (x, y), or -1 (gaps and the area outside the viewport). */
  indexAt(x: number, y: number): number {
    const lx = x - this.o.x;
    const ly = y - this.o.y;
    if (lx < 0 || lx >= this.o.width || ly < 0 || ly >= this.viewH) return -1;
    const cy = ly + this.physics.offset - (this.o.padding ?? 0);
    if (cy < 0) return -1;
    const colW = this.itemW + this.o.gap;
    const rowH = this.o.itemHeight + this.o.gap;
    const col = Math.floor(lx / colW);
    const row = Math.floor(cy / rowH);
    if (lx - col * colW > this.itemW || cy - row * rowH > this.o.itemHeight) return -1;
    const i = row * this.o.columns + col;
    return i < this.total ? i : -1;
  }

  /** Step scrolling and long-press detection; call every frame. */
  update(dt: number): void {
    const now = performance.now();
    if (this.gesture.active && this.pressIndex >= 0 && this.gesture.tick(now)) {
      const v = this.bound.get(this.pressIndex);
      if (v) {
        this.o.onPress?.(this.pressIndex, v, false);
        this.o.onLongPress?.(this.pressIndex, v);
      }
    }
    if (this.physics.step(dt)) this.touch(now);
    if (this.physics.offset !== this.laidOutOffset) this.layout(false);
    const visible = this.physics.isDragging || this.thumbDrag || this.physics.moving || now - this.lastActivity < SCROLLBAR_LINGER || this.hovering;
    const target = this.physics.max > 0 && visible ? 1 : 0;
    const a = this.barAlpha + (target - this.barAlpha) * Math.min(1, dt * 10);
    if (Math.abs(a - this.barAlpha) > 0.01 || (target === 0 && this.barAlpha !== 0 && a < 0.02)) {
      this.barAlpha = a < 0.02 ? 0 : a;
      this.bar.setAlpha(this.barAlpha);
    }
  }

  private contentHeight(): number {
    const rows = Math.ceil(this.total / this.o.columns);
    const pad = this.o.padding ?? 0;
    return rows === 0 ? 0 : pad * 2 + rows * this.o.itemHeight + (rows - 1) * this.o.gap;
  }

  /** Bind views for rows in view, release the rest, and position everything. */
  private layout(force: boolean): void {
    const off = this.physics.offset;
    if (!force && off === this.laidOutOffset) return;
    this.laidOutOffset = off;
    const o = this.o;
    const pad = o.padding ?? 0;
    const rowH = o.itemHeight + o.gap;
    const first = Math.max(0, Math.floor((off - pad) / rowH));
    const last = Math.floor((off - pad + this.viewH) / rowH);
    const lo = first * o.columns;
    const hi = Math.min(this.total - 1, (last + 1) * o.columns - 1);
    const drop = this.scratch;
    drop.length = 0;
    for (const i of this.bound.keys()) if (i < lo || i > hi) drop.push(i);
    for (const i of drop) this.release(i);
    for (let i = lo; i <= hi; i++) {
      let v = this.bound.get(i);
      if (!v) {
        v = this.pool.pop() ?? this.make();
        v.setVisible(true);
        this.bound.set(i, v);
        o.bind(v, i);
      }
      const col = i % o.columns;
      const row = Math.floor(i / o.columns);
      v.setPosition(col * (this.itemW + o.gap), pad + row * rowH - off);
    }
    this.drawBar();
    if (this.hovering) this.updateHover();
  }

  private make(): V {
    const v = this.o.create();
    this.content.add(v);
    return v;
  }

  private release(i: number): void {
    const v = this.bound.get(i);
    if (!v) return;
    this.bound.delete(i);
    v.setVisible(false);
    this.pool.push(v);
    if (i === this.hoverIndex) this.hoverIndex = -1;
  }

  private releaseAll(): void {
    const keys = this.scratch;
    keys.length = 0;
    for (const i of this.bound.keys()) keys.push(i);
    for (const i of keys) this.release(i);
    this.laidOutOffset = Number.NaN;
  }

  private redrawMask(): void {
    // Generous horizontal bleed so card shadows and press-scale are not clipped at the sides.
    this.maskShape.clear().fillStyle(0xffffff).fillRect(this.o.x - 12, this.o.y, this.o.width + 24, this.viewH);
  }

  private drawBar(): void {
    const g = this.bar;
    g.clear();
    const max = this.physics.max;
    if (max <= 0) return;
    const x = this.o.x + this.o.width + SCROLLBAR_GAP;
    const y = this.o.y;
    const h = this.viewH;
    const total = this.contentHeight();
    const thumbH = Math.max(SCROLLBAR_MIN, (h * h) / total);
    const off = this.physics.offset;
    // Overscroll squashes the thumb against the end, like native scrollbars.
    const over = off < 0 ? -off : off > max ? off - max : 0;
    const th = Math.max(16, thumbH - over * 0.6);
    const t = Math.min(1, Math.max(0, off / max));
    const ty = y + (h - th) * t;
    g.fillStyle(UI.white, 0.05).fillRoundedRect(x, y, SCROLLBAR_W, h, SCROLLBAR_W / 2);
    g.fillStyle(this.thumbDrag ? UI.accent : 0x6b7fa6, this.thumbDrag ? 1 : 0.85).fillRoundedRect(x, ty, SCROLLBAR_W, th, SCROLLBAR_W / 2);
  }

  private touch(now = performance.now()): void {
    this.lastActivity = now;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.gesture.active || p.rightButtonDown()) return;
    this.pointerId = p.id;
    const flinging = this.physics.flinging || this.physics.moving;
    this.physics.stop();
    this.gesture.down(p.x, p.y, performance.now());
    this.gesture.suppressTap = flinging;
    this.pressIndex = flinging ? -1 : this.indexAt(p.x, p.y);
    const v = this.pressIndex >= 0 ? this.bound.get(this.pressIndex) : undefined;
    if (v) this.o.onPress?.(this.pressIndex, v, true);
    this.touch();
  }

  private onBarDown(p: Phaser.Input.Pointer): void {
    if (this.physics.max <= 0) return;
    this.pointerId = p.id;
    this.thumbDrag = true;
    this.physics.stop();
    const h = this.viewH;
    const thumbH = Math.max(SCROLLBAR_MIN, (h * h) / this.contentHeight());
    const ty = this.o.y + (h - thumbH) * (this.physics.offset / this.physics.max);
    // Grabbing outside the thumb centres it under the pointer.
    this.thumbGrab = p.y >= ty && p.y <= ty + thumbH ? p.y - ty : thumbH / 2;
    this.dragThumb(p.y);
  }

  private dragThumb(py: number): void {
    const h = this.viewH;
    const thumbH = Math.max(SCROLLBAR_MIN, (h * h) / this.contentHeight());
    const t = (py - this.thumbGrab - this.o.y) / Math.max(1, h - thumbH);
    this.physics.scrollTo(t * this.physics.max);
    this.touch();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    if (this.thumbDrag) {
      this.dragThumb(p.y);
      return;
    }
    if (!this.gesture.active) return;
    const now = performance.now();
    if (this.gesture.move(p.x, p.y)) {
      const v = this.pressIndex >= 0 ? this.bound.get(this.pressIndex) : undefined;
      if (v) this.o.onPress?.(this.pressIndex, v, false);
      const dx = p.x - this.gesture.startX;
      const dy = p.y - this.gesture.startY;
      if (this.o.onDragOut && this.pressIndex >= 0 && dx < 0 && Math.abs(dx) > Math.abs(dy) * DRAG_OUT_RATIO) {
        const idx = this.pressIndex;
        this.endPress();
        this.o.onDragOut(idx);
        return;
      }
      this.physics.beginDrag(p.y, now);
    }
    if (this.gesture.kind === 'drag') {
      this.physics.dragTo(p.y, now);
      this.touch(now);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    if (this.thumbDrag) {
      this.thumbDrag = false;
      this.pointerId = -1;
      this.drawBar();
      return;
    }
    if (!this.gesture.active) return;
    const idx = this.pressIndex;
    const v = idx >= 0 ? this.bound.get(idx) : undefined;
    if (v) this.o.onPress?.(idx, v, false);
    const tap = this.gesture.up(p.x, p.y);
    this.physics.endDrag(performance.now());
    this.pointerId = -1;
    this.pressIndex = -1;
    if (tap && v && this.indexAt(p.x, p.y) === idx) this.o.onTap?.(idx, v);
  }

  private endPress(): void {
    this.gesture.cancel();
    this.pointerId = -1;
    this.pressIndex = -1;
  }

  private onHoverMove(p: Phaser.Input.Pointer): void {
    if (p.wasTouch) return;
    this.hovering = true;
    this.hoverX = p.x;
    this.hoverY = p.y;
    this.updateHover();
  }

  private onHoverOut(p: Phaser.Input.Pointer): void {
    if (p.wasTouch) return;
    this.hovering = false;
    this.setHover(-1);
  }

  private updateHover(): void {
    this.setHover(this.gesture.kind === 'drag' ? -1 : this.indexAt(this.hoverX, this.hoverY));
  }

  private setHover(i: number): void {
    if (i === this.hoverIndex) return;
    this.hoverIndex = i;
    this.o.onHover?.(i, i >= 0 ? (this.bound.get(i) ?? null) : null);
  }

  private onWheel(_p: Phaser.Input.Pointer, _dx: number, dy: number): void {
    this.physics.wheel(dy);
    this.touch();
  }

  override destroy(fromScene?: boolean): void {
    const input = this.scene?.input;
    if (input) {
      input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    }
    this.content.clearMask(true);
    this.maskShape.destroy();
    this.bound.clear();
    this.pool.length = 0;
    super.destroy(fromScene);
  }
}
