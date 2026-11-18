import Phaser from 'phaser';
import { DEPTH } from './layers';
import { QUALITY_CAP, QUALITY_MUL, type ParticleQuality } from './quality';

/**
 * One pooled effect sprite. `spawn` resets every field; callers tweak the ones they need right
 * after spawning (this keeps spawning allocation-free).
 */
export interface Particle {
  img: Phaser.GameObjects.Image;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  /** Velocity damping per second (0 = none, 3 = strong). */
  drag: number;
  gravity: number;
  spin: number;
  scale0: number;
  scale1: number;
  alpha0: number;
  alpha1: number;
  /** Fraction of the life spent at alpha0 before fading starts (0..1). */
  hold: number;
}

/**
 * A tiny particle engine on pooled Images: linear motion with drag/gravity, scale and alpha
 * ramps. Cheaper and more predictable than tweens for hundreds of short-lived sprites.
 */
export class FxSystem {
  private readonly live: Particle[] = [];
  private readonly free: Particle[] = [];
  private quality: ParticleQuality = 'high';

  constructor(private readonly scene: Phaser.Scene) {}

  /** Particle detail level. */
  setQuality(q: ParticleQuality): void {
    this.quality = q;
  }

  /** Scaled particle count for the current quality (at least `min`). */
  count(n: number, min = 1): number {
    return Math.max(min, Math.round(n * QUALITY_MUL[this.quality]));
  }

  /** True when there is room for optional particles (use before purely decorative bursts). */
  get hasRoom(): boolean {
    return this.live.length < QUALITY_CAP[this.quality];
  }

  /** Particles alive right now. */
  get active(): number {
    return this.live.length;
  }

  /**
   * Show `texture` at (x, y) for `life` seconds. Returns null when the cap is reached and
   * `essential` is false.
   */
  spawn(texture: string, x: number, y: number, life: number, depth: number = DEPTH.fx, essential = false): Particle | null {
    if (!essential && !this.hasRoom) return null;
    const p = this.free.pop() ?? this.make();
    const img = p.img;
    img.setTexture(texture).setPosition(x, y).setDepth(depth).setVisible(true).setActive(true);
    img.setRotation(0).setAlpha(1).setScale(1).clearTint().setBlendMode(Phaser.BlendModes.NORMAL);
    p.life = life;
    p.maxLife = life;
    p.vx = 0;
    p.vy = 0;
    p.drag = 0;
    p.gravity = 0;
    p.spin = 0;
    p.scale0 = 1;
    p.scale1 = 1;
    p.alpha0 = 1;
    p.alpha1 = 0;
    p.hold = 0;
    this.live.push(p);
    return p;
  }

  /** Advance every particle by `dt` seconds. */
  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i] as Particle;
      p.life -= dt;
      if (p.life <= 0) {
        this.kill(i);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.gravity * dt;
      const img = p.img;
      img.x += p.vx * dt;
      img.y += p.vy * dt;
      if (p.spin !== 0) img.rotation += p.spin * dt;
      img.setScale(p.scale0 + (p.scale1 - p.scale0) * easeOut(t));
      const fade = p.hold >= 1 ? 0 : Math.max(0, (t - p.hold) / (1 - p.hold));
      img.setAlpha(p.alpha0 + (p.alpha1 - p.alpha0) * fade);
    }
  }

  private kill(i: number): void {
    const p = this.live[i] as Particle;
    const last = this.live.pop() as Particle;
    if (i < this.live.length) this.live[i] = last;
    p.img.setVisible(false).setActive(false);
    this.free.push(p);
  }

  private make(): Particle {
    const img = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    return {
      img, life: 0, maxLife: 1, vx: 0, vy: 0, drag: 0, gravity: 0, spin: 0,
      scale0: 1, scale1: 1, alpha0: 1, alpha1: 0, hold: 0,
    };
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Set a particle's scale ramp, start alpha and fade hold in one call. */
export function look(p: Particle, scale0: number, scale1: number, alpha0: number, hold = 0): void {
  p.scale0 = scale0;
  p.scale1 = scale1;
  p.alpha0 = alpha0;
  p.hold = hold;
}

/** Set a particle's velocity, drag and gravity in one call. */
export function move(p: Particle, vx: number, vy: number, drag = 0, gravity = 0): void {
  p.vx = vx;
  p.vy = vy;
  p.drag = drag;
  p.gravity = gravity;
}
