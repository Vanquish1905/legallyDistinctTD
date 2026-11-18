import Phaser from 'phaser';
import type { DamageType, Vec2 } from '../sim/types';
import { FloatingText } from './FloatingText';
import { FxSystem, look, move } from './FxSystem';
import { DEPTH } from './layers';
import type { LayerName, WorldLayers } from './WorldLayers';
import type { ParticleQuality } from './quality';

/** Goo colour of each creature's death splat. */
const SPLAT_TINT: Readonly<Record<string, number>> = {
  larva: 0x9ad65c, mite: 0xf2a65a, tick: 0x8e7cc3, leech: 0x6b3b5a, spore: 0xc9a2e8, sporelet: 0xc9a2e8,
  phantom: 0x9fd8ff, beetle: 0x6d8a3a, swarmling: 0xffd166, jelly: 0x7fe3e0, shieldbug: 0x5fb3f0,
  medic: 0xf28ab2, burrower: 0xa47148, gnat: 0xb8c070,
  queen: 0x9ad65c, irontick: 0x8e7cc3, hivemind: 0xc9a2e8, colossus: 0x6d8a3a, omega: 0xf43f5e,
};

const ARC_LIFE = 0.16;
const BEAM_LIFE = 0.12;
const TRACER_LIFE = 0.14;
const MAX_ARCS = 32;
const MAX_LINES = 64;

interface Arc { points: readonly Vec2[]; life: number }
interface Line { x1: number; y1: number; x2: number; y2: number; life: number; maxLife: number; color: number; width: number }

/**
 * All one-shot world effects: explosions by damage type, splats, coin pops, sparks, smoke,
 * lightning arcs, laser beams and hitscan tracers. Sprites come from a pooled FxSystem; arcs,
 * beams and tracers share one Graphics that is only redrawn while something is showing.
 */
export class Effects {
  readonly fx: FxSystem;
  readonly text: FloatingText;
  private readonly lines: Graphics;
  private readonly arcs: Arc[] = [];
  private readonly beams: Line[] = [];
  private readonly tracers: Line[] = [];
  private readonly spareLines: Line[] = [];
  private dirty = false;

  constructor(scene: Phaser.Scene, layers: WorldLayers) {
    this.fx = new FxSystem(scene, layers);
    this.text = new FloatingText(scene);
    this.lines = scene.add.graphics().setDepth(DEPTH.beam).setBlendMode(Phaser.BlendModes.ADD);
  }

  setQuality(q: ParticleQuality): void {
    this.fx.setQuality(q);
  }

  /** Advance and redraw everything by `dt` seconds. */
  update(dt: number): void {
    this.fx.update(dt);
    this.text.update(dt);
    this.updateLines(dt);
  }

  // ---- bursts -----------------------------------------------------------------------------

  /** Blast of `radius` px coloured by damage type. */
  explosion(x: number, y: number, radius: number, type: DamageType): void {
    const fx = this.fx;
    const size = (radius * 2) / 128;
    if (type === 'ice') {
      const p = fx.spawn('fx-frost-burst', x, y, 0.45, 'fx', true);
      if (p) {
        look(p, size * 0.35, size * 1.05, 0.95, 0.3);
        p.spin = 1.5;
      }
      this.sparks(x, y, 6, 0xbfe9ff, radius * 2.2);
      return;
    }
    if (type === 'poison') {
      const p = fx.spawn('fx-poison-cloud', x, y, 1.1, 'fx', true);
      if (p) {
        look(p, size * 0.5, size * 1.15, 0.85, 0.35);
        p.spin = 0.4;
        p.img.setRotation(Math.random() * 6.28);
      }
      return;
    }
    if (type === 'energy') {
      const p = fx.spawn('fx-ring', x, y, 0.35, 'fx', true);
      if (p) {
        look(p, size * 0.15, size, 0.9);
        p.img.setTint(0x7dd3fc).setBlendMode(Phaser.BlendModes.ADD);
      }
      return;
    }
    const p = fx.spawn('fx-explosion', x, y, 0.42, 'fx', true);
    if (p) {
      look(p, size * 0.3, size * 1.1, 1, 0.25);
      p.spin = 0.6;
      p.img.setRotation(Math.random() * 6.28);
      if (type === 'fire') p.img.setTint(0xffb070);
    }
    const ring = fx.spawn('fx-ring', x, y, 0.3);
    if (ring) {
      look(ring, size * 0.3, size * 1.25, 0.55);
      ring.img.setTint(0xffd8a0).setBlendMode(Phaser.BlendModes.ADD);
    }
    this.smoke(x, y, fx.count(3), radius * 0.5, 0x6b6f7a);
    this.sparks(x, y, fx.count(5), 0xffd27a, radius * 3);
  }

  /** Small impact spark for a direct hit. */
  hit(x: number, y: number, type: DamageType): void {
    if (!this.fx.hasRoom) return;
    const p = this.fx.spawn('fx-spark', x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, 0.14);
    if (!p) return;
    look(p, 0.32, 0.12, 0.95);
    p.img.setRotation(Math.random() * 6.28).setBlendMode(Phaser.BlendModes.ADD).setTint(HIT_TINT[type]);
  }

  /** Creature death: goo splat decal, droplets and a coin pop. */
  death(x: number, y: number, enemyId: string, radius: number, reward: number, boss: boolean): void {
    const tint = SPLAT_TINT[enemyId] ?? 0x9ad65c;
    const s = (radius * 2.4) / 96;
    const splat = this.fx.spawn('fx-splat', x, y, boss ? 3 : 1.8, 'decal', true);
    if (splat) {
      look(splat, s * 0.5, s, 0.85, 0.55);
      splat.img.setTint(tint).setRotation(Math.random() * 6.28);
    }
    const drops = this.fx.count(boss ? 14 : 5);
    for (let i = 0; i < drops; i++) {
      const p = this.fx.spawn('fx-spark', x, y, 0.35 + Math.random() * 0.2);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const v = (60 + Math.random() * 140) * (boss ? 2 : 1);
      look(p, 0.28, 0.1, 1);
      move(p, Math.cos(a) * v, Math.sin(a) * v, 5);
      p.img.setTint(tint);
    }
    if (boss) {
      this.explosion(x, y, radius * 2.2, 'explosive');
      this.explosion(x + 30, y - 20, radius * 1.4, 'fire');
    }
    if (reward > 0) this.coins(x, y, reward, boss ? 6 : 1);
  }

  /** Coin sprites jumping out of (x, y) plus a "+N" label. */
  coins(x: number, y: number, amount: number, count = 1): void {
    for (let i = 0; i < count; i++) {
      const p = this.fx.spawn('fx-coin', x, y - 6, 0.7, 'fxTop');
      if (!p) break;
      look(p, 0.55, 0.45, 1, 0.6);
      move(p, (Math.random() - 0.5) * (count > 1 ? 220 : 50), -170 - Math.random() * 60, 0, 520);
      p.spin = (Math.random() - 0.5) * 6;
    }
    this.text.show(x, y - 26, `+${amount}`, '#fbbf24', count > 1 ? 32 : 22);
  }

  /** Grey smoke puffs drifting up from (x, y). */
  smoke(x: number, y: number, n: number, spread: number, tint = 0x8a8f99): void {
    for (let i = 0; i < n; i++) {
      const p = this.fx.spawn('fx-smoke', x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, 0.7 + Math.random() * 0.4);
      if (!p) return;
      look(p, 0.35, 0.75, 0.55);
      move(p, (Math.random() - 0.5) * 30, -25 - Math.random() * 25, 1);
      p.img.setTint(tint).setRotation(Math.random() * 6.28);
    }
  }

  /** Tiny dust puff (burrowers, placement, enemy footsteps). */
  dust(x: number, y: number, tint = 0xb08d62, scale = 0.32): void {
    const p = this.fx.spawn('fx-smoke', x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16, 0.5, 'ground');
    if (!p) return;
    look(p, scale * 0.6, scale * 1.3, 0.6);
    move(p, 0, -12);
    p.img.setTint(tint).setRotation(Math.random() * 6.28);
  }

  /** Fast sparks flying out of (x, y). */
  sparks(x: number, y: number, n: number, tint: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.fx.spawn('fx-spark', x, y, 0.25 + Math.random() * 0.15);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      look(p, 0.3, 0.05, 1);
      move(p, Math.cos(a) * v, Math.sin(a) * v, 6);
      p.img.setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  /** Expanding ring (placement, upgrade, boss phase, heal pulses). */
  ring(x: number, y: number, radius: number, tint: number, life = 0.45, layer: LayerName = 'fx'): void {
    const p = this.fx.spawn('fx-ring', x, y, life, layer, true);
    if (!p) return;
    look(p, (radius * 0.4) / 64, radius / 64, 0.85);
    p.img.setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Green heal motes rising around (x, y). */
  heal(x: number, y: number, radius: number): void {
    this.ring(x, y, radius, 0x34d399, 0.6, 'ground');
    const n = this.fx.count(5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.7;
      const p = this.fx.spawn('fx-heal', x + Math.cos(a) * r, y + Math.sin(a) * r, 0.7);
      if (!p) return;
      look(p, 0.5, 0.3, 0.95, 0.4);
      move(p, 0, -40);
    }
  }

  /** Muzzle-flash style glow that is not attached to a tower view. */
  flash(x: number, y: number, tint: number, scale: number): void {
    const p = this.fx.spawn('fx-spark', x, y, 0.08);
    if (!p) return;
    look(p, scale, scale * 0.6, 1);
    p.img.setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setRotation(Math.random() * 6.28);
  }

  // ---- lines ------------------------------------------------------------------------------

  /** Jagged lightning through `points` (kept by reference for a few frames). */
  lightning(points: readonly Vec2[]): void {
    if (this.arcs.length >= MAX_ARCS) this.arcs.shift();
    this.arcs.push({ points, life: ARC_LIFE });
    for (let i = 1; i < points.length; i++) {
      const p = points[i] as Vec2;
      this.flash(p.x, p.y, 0x9be7ff, 0.5);
    }
    this.dirty = true;
  }

  /** Laser beam segment; `intensity` 0..1 widens and brightens it. */
  beam(x1: number, y1: number, x2: number, y2: number, intensity: number): void {
    this.pushLine(this.beams, x1, y1, x2, y2, BEAM_LIFE, 0xff4d8d, 3 + intensity * 7);
    if (Math.random() < 0.5) this.flash(x2, y2, 0xff8ab5, 0.35 + intensity * 0.3);
  }

  /** Instant hitscan tracer (sniper). */
  tracer(x1: number, y1: number, x2: number, y2: number, color = 0xfff1b8, width = 3): void {
    this.pushLine(this.tracers, x1, y1, x2, y2, TRACER_LIFE, color, width);
  }

  private pushLine(list: Line[], x1: number, y1: number, x2: number, y2: number, life: number, color: number, width: number): void {
    if (list.length >= MAX_LINES) return;
    const l = this.spareLines.pop() ?? { x1: 0, y1: 0, x2: 0, y2: 0, life: 0, maxLife: 1, color: 0, width: 1 };
    l.x1 = x1; l.y1 = y1; l.x2 = x2; l.y2 = y2;
    l.life = life; l.maxLife = life; l.color = color; l.width = width;
    list.push(l);
    this.dirty = true;
  }

  private updateLines(dt: number): void {
    if (!this.dirty) return;
    const g = this.lines;
    g.clear();
    this.ageLines(this.beams, dt);
    this.ageLines(this.tracers, dt);
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i] as Arc;
      a.life -= dt;
      if (a.life <= 0) this.arcs.splice(i, 1);
    }
    for (const l of this.beams) {
      const k = l.life / l.maxLife;
      g.lineStyle(l.width * 2.4, l.color, 0.22 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
      g.lineStyle(l.width, l.color, 0.75 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
      g.lineStyle(Math.max(1.5, l.width * 0.35), 0xffffff, 0.95 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
    for (const l of this.tracers) {
      const k = l.life / l.maxLife;
      g.lineStyle(l.width * 3, l.color, 0.18 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
      g.lineStyle(l.width, 0xffffff, 0.9 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
    for (const a of this.arcs) this.drawArc(g, a);
    this.dirty = this.beams.length > 0 || this.tracers.length > 0 || this.arcs.length > 0;
  }

  private ageLines(list: Line[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const l = list[i] as Line;
      l.life -= dt;
      if (l.life > 0) continue;
      const last = list.pop() as Line;
      if (i < list.length) list[i] = last;
      this.spareLines.push(l);
    }
  }

  /** Lightning re-jitters every frame, which reads as crackling. */
  private drawArc(g: Graphics, a: Arc): void {
    const k = a.life / ARC_LIFE;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 0) g.lineStyle(9, 0x38bdf8, 0.28 * k);
      else g.lineStyle(2.5, 0xe0f7ff, k);
      for (let i = 1; i < a.points.length; i++) {
        const p0 = a.points[i - 1] as Vec2;
        const p1 = a.points[i] as Vec2;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const steps = Math.max(3, Math.min(8, Math.round(len / 22)));
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const j = (Math.random() - 0.5) * Math.min(26, len * 0.25);
          g.lineTo(p0.x + dx * t + nx * j, p0.y + dy * t + ny * j);
        }
        g.lineTo(p1.x, p1.y);
        g.strokePath();
      }
    }
  }
}

type Graphics = Phaser.GameObjects.Graphics;

const HIT_TINT: Readonly<Record<DamageType, number>> = {
  physical: 0xffe8a3, explosive: 0xffb36b, fire: 0xff8a3d, ice: 0xbfe9ff, energy: 0x8be9ff, poison: 0xa3f07a,
};
