/**
 * Pure 1-D scroll physics for `ScrollList` (no Phaser, unit tested): drag with rubber-band
 * overscroll, release inertia with exponential friction, spring back into bounds, mouse wheel
 * steps and animated `scrollTo`.
 *
 * `offset` is how far the content is scrolled (0 = top, `max` = bottom). While dragging or
 * springing it may leave [0, max] by a damped amount (the overscroll bounce).
 */

/** Tunables; the defaults feel close to iOS. */
export interface ScrollPhysicsOptions {
  /** Velocity decay rate per second (velocity *= exp(-friction * dt)). */
  friction?: number;
  /** Spring stiffness pulling an overscrolled offset back into bounds (1/s²). */
  spring?: number;
  /** Rubber-band constant: lower = stiffer overscroll. */
  rubber?: number;
  /** Below this speed (px/s) inertia stops. */
  minVelocity?: number;
  /** Fastest fling (px/s). */
  maxVelocity?: number;
  /** Time constant (s) of the eased approach used by wheel steps and `scrollTo`. */
  ease?: number;
}

const DEFAULTS: Required<ScrollPhysicsOptions> = {
  friction: 3.2,
  spring: 180,
  rubber: 0.55,
  minVelocity: 12,
  maxVelocity: 6000,
  ease: 0.09,
};

/** Drag samples older than this (ms) are ignored for the release velocity. */
const SAMPLE_WINDOW_MS = 100;

/** Damped overscroll distance for a raw overshoot `x` with viewport `dim` (iOS formula). */
export function rubberBand(x: number, dim: number, c: number): number {
  if (dim <= 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  return sign * (1 - 1 / ((a * c) / dim + 1)) * dim;
}

/** Scroll state machine; call `step(dt)` every frame while `moving` is true. */
export class ScrollPhysics {
  offset = 0;
  velocity = 0;
  private viewport = 0;
  private content = 0;
  private dragging = false;
  /** Unclamped offset following the finger (before the rubber band). */
  private dragRaw = 0;
  private dragStartPointer = 0;
  private dragStartOffset = 0;
  /** Ring of recent (time, pointer) samples for the release velocity. */
  private readonly sampleT = new Float64Array(8);
  private readonly sampleP = new Float64Array(8);
  private sampleCount = 0;
  private sampleHead = 0;
  /** Eased target for wheel/scrollTo, or NaN when none. */
  private target = Number.NaN;
  private readonly o: Required<ScrollPhysicsOptions>;

  constructor(options: ScrollPhysicsOptions = {}) {
    this.o = { ...DEFAULTS, ...options };
  }

  /** Largest in-bounds offset. */
  get max(): number {
    return Math.max(0, this.content - this.viewport);
  }

  /** True while the finger/mouse holds the content. */
  get isDragging(): boolean {
    return this.dragging;
  }

  /** True while something still animates (inertia, spring, eased target). */
  get moving(): boolean {
    if (this.dragging) return false;
    return this.velocity !== 0 || !Number.isNaN(this.target) || this.offset < 0 || this.offset > this.max;
  }

  /** True while flinging fast enough that a tap should only stop the list, not select. */
  get flinging(): boolean {
    return !this.dragging && Math.abs(this.velocity) > 120;
  }

  /** Set viewport and content heights; clamps the offset when not dragging. */
  setSize(viewport: number, content: number): void {
    this.viewport = Math.max(0, viewport);
    this.content = Math.max(0, content);
    if (!this.dragging) {
      this.offset = clamp(this.offset, 0, this.max);
      if (!Number.isNaN(this.target)) this.target = clamp(this.target, 0, this.max);
    }
  }

  /** Jump (or ease when `animate`) to `offset`, clamped to bounds. */
  scrollTo(offset: number, animate = false): void {
    const to = clamp(offset, 0, this.max);
    this.velocity = 0;
    if (animate) this.target = to;
    else {
      this.target = Number.NaN;
      this.offset = to;
    }
  }

  /** Stop all motion where it is (clamped into bounds). */
  stop(): void {
    this.velocity = 0;
    this.target = Number.NaN;
    this.offset = clamp(this.offset, 0, this.max);
  }

  /** Finger/mouse went down at pointer coordinate `p` (px along the scroll axis), time `t` ms. */
  beginDrag(p: number, t: number): void {
    this.dragging = true;
    this.velocity = 0;
    this.target = Number.NaN;
    this.dragStartPointer = p;
    // Continue from where an overscroll currently shows, so grabbing a bouncing list is seamless.
    this.dragRaw = this.unrubber(this.offset);
    this.dragStartOffset = this.dragRaw;
    this.sampleCount = 0;
    this.sampleHead = 0;
    this.addSample(t, p);
  }

  /** Pointer moved to `p` at time `t` ms while dragging. */
  dragTo(p: number, t: number): void {
    if (!this.dragging) return;
    this.dragRaw = this.dragStartOffset - (p - this.dragStartPointer);
    this.offset = this.rubberOffset(this.dragRaw);
    this.addSample(t, p);
  }

  /** Finger/mouse released at time `t` ms: starts inertia from recent movement. */
  endDrag(t: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.velocity = this.releaseVelocity(t);
    // Flinging further out of bounds while already overscrolled just springs back.
    if ((this.offset < 0 && this.velocity < 0) || (this.offset > this.max && this.velocity > 0)) this.velocity = 0;
  }

  /** Mouse wheel / trackpad: `delta` px (positive = scroll down), eased. */
  wheel(delta: number): void {
    if (this.dragging) return;
    this.velocity = 0;
    const from = Number.isNaN(this.target) ? this.offset : this.target;
    this.target = clamp(from + delta, 0, this.max);
  }

  /** Advance animations by `dt` seconds. Returns true when the offset changed. */
  step(dt: number): boolean {
    if (this.dragging || dt <= 0) return false;
    const before = this.offset;
    const max = this.max;
    if (!Number.isNaN(this.target)) {
      const k = 1 - Math.exp(-dt / this.o.ease);
      this.offset += (this.target - this.offset) * k;
      if (Math.abs(this.target - this.offset) < 0.5) {
        this.offset = this.target;
        this.target = Number.NaN;
      }
      return this.offset !== before;
    }
    const out = this.offset < 0 ? this.offset : this.offset > max ? this.offset - max : 0;
    if (out !== 0) {
      // Critically damped spring back to the nearest bound; inertia dies fast while out.
      const bound = out < 0 ? 0 : max;
      const w = Math.sqrt(this.o.spring);
      const x = this.offset - bound;
      const accel = -this.o.spring * x - 2 * w * this.velocity;
      this.velocity += accel * dt;
      this.offset += this.velocity * dt;
      const nowOut = this.offset - bound;
      if (Math.abs(nowOut) < 0.5 && Math.abs(this.velocity) < 30) {
        this.offset = bound;
        this.velocity = 0;
      } else if (Math.sign(nowOut) !== Math.sign(x) && nowOut !== 0) {
        this.offset = bound;
        this.velocity = 0;
      }
      return this.offset !== before;
    }
    if (this.velocity !== 0) {
      this.offset += this.velocity * dt;
      this.velocity *= Math.exp(-this.o.friction * dt);
      if (Math.abs(this.velocity) < this.o.minVelocity) this.velocity = 0;
      // Hitting a bound with speed: keep a little of it as overscroll, the spring returns it.
      if (this.offset < 0 || this.offset > max) {
        const bound = this.offset < 0 ? 0 : max;
        const over = rubberBand(this.offset - bound, this.viewport, this.o.rubber) * 0.35;
        this.offset = bound + over;
        this.velocity *= 0.25;
      }
    }
    return this.offset !== before;
  }

  private rubberOffset(raw: number): number {
    const max = this.max;
    if (raw < 0) return rubberBand(raw, this.viewport, this.o.rubber);
    if (raw > max) return max + rubberBand(raw - max, this.viewport, this.o.rubber);
    return raw;
  }

  /** Inverse of `rubberOffset` (raw drag offset that shows `offset`). */
  private unrubber(offset: number): number {
    const max = this.max;
    const dim = this.viewport;
    const c = this.o.rubber;
    const inv = (d: number): number => {
      const a = Math.min(Math.abs(d), dim * 0.999);
      const raw = (dim / c) * (1 / (1 - a / dim) - 1);
      return d < 0 ? -raw : raw;
    };
    if (dim <= 0) return clamp(offset, 0, max);
    if (offset < 0) return inv(offset);
    if (offset > max) return max + inv(offset - max);
    return offset;
  }

  private addSample(t: number, p: number): void {
    this.sampleT[this.sampleHead] = t;
    this.sampleP[this.sampleHead] = p;
    this.sampleHead = (this.sampleHead + 1) % this.sampleT.length;
    this.sampleCount = Math.min(this.sampleCount + 1, this.sampleT.length);
  }

  private releaseVelocity(t: number): number {
    const n = this.sampleCount;
    if (n < 2) return 0;
    const len = this.sampleT.length;
    const newest = (this.sampleHead - 1 + len) % len;
    const tNew = this.sampleT[newest] as number;
    // A pause before release means no fling.
    if (t - tNew > SAMPLE_WINDOW_MS) return 0;
    let oldest = newest;
    for (let i = 1; i < n; i++) {
      const idx = (newest - i + len) % len;
      if (tNew - (this.sampleT[idx] as number) > SAMPLE_WINDOW_MS) break;
      oldest = idx;
    }
    const dt = (tNew - (this.sampleT[oldest] as number)) / 1000;
    if (dt <= 0) return 0;
    const v = -((this.sampleP[newest] as number) - (this.sampleP[oldest] as number)) / dt;
    return clamp(v, -this.o.maxVelocity, this.o.maxVelocity);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
