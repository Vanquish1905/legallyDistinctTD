import Phaser from 'phaser';
import type { TowerState } from '../sim/TowerState';
import type { EnemyState } from '../sim/EnemyState';
import { KeyedViews, type KeyedView } from './Pool';
import { DEPTH, Y_SORT } from './layers';
import { smoothAngle } from './math';
import { towerScale } from './sizes';

/** How a tower's top part moves. */
type TurretMode = 'aim' | 'spin' | 'trap' | 'heli' | 'pulse';

const MODE: Readonly<Record<string, TurretMode>> = {
  radar: 'spin', coinfactory: 'spin', spikes: 'trap', heli: 'heli', pulse: 'pulse',
};
/** Turret spin speed (rad/s) for 'spin' and 'pulse' towers. */
const SPIN: Readonly<Record<string, number>> = { radar: 1.4, coinfactory: 0.5, pulse: 0.35 };
/** Recoil kick in px (at scale 1). */
const RECOIL: Readonly<Record<string, number>> = {
  sniper: 9, railgun: 12, mortar: 8, rocket: 7, seeker: 5, gatling: 2, flamethrower: 0.8, frost: 5, toxin: 3, saw: 5,
};
const FLASH_TINT: Readonly<Record<string, number>> = {
  flamethrower: 0xff9a3d, frost: 0xbfe9ff, toxin: 0xa3f07a, tesla: 0x8be9ff, seeker: 0xc4b5fd, railgun: 0x8be9ff,
};
const TURN_RATE = 16;
const POP_TIME = 0.32;
const ROTOR_SPEED = 26;
const PIP_COLORS = [0x38bdf8, 0xfbbf24] as const;
/** The helicopter is drawn a bit larger than the pad scale; its shadow falls this far away. */
const HELI_SCALE = 1.1;
const HELI_SHADOW_X = 14;
const HELI_SHADOW_Y = 24;

/** Rendering of one placed tower. */
interface TowerView extends KeyedView {
  state: TowerState | null;
  base: Phaser.GameObjects.Image;
  turret: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
  /** Heli only. */
  rotor: Phaser.GameObjects.Image | null;
  heliShadow: Phaser.GameObjects.Image | null;
  pips: Phaser.GameObjects.Graphics;
  mode: TurretMode;
  scale: number;
  angle: number;
  recoil: number;
  flashT: number;
  pop: number;
  spinAngle: number;
  /** Tier signature drawn into `pips` (re-drawn on change). */
  tierKey: number;
  /** Heli body position. */
  hx: number;
  hy: number;
  t: number;
}

/** Hands out muzzle positions to effects code without allocating. */
export interface Muzzle { x: number; y: number }

/** Syncs tower sprites with `sim.towers`: aiming, recoil, muzzle flash, rotor, tier pips. */
export class TowerViews {
  private readonly views: KeyedViews<TowerView>;

  constructor(private readonly scene: Phaser.Scene) {
    this.views = new KeyedViews<TowerView>(
      () => this.make(),
      () => undefined,
      (v) => {
        v.state = null;
        v.base.setVisible(false);
        v.turret.setVisible(false);
        v.flash.setVisible(false);
        v.rotor?.setVisible(false);
        v.heliShadow?.setVisible(false);
        v.pips.clear().setVisible(false);
      },
    );
  }

  get count(): number {
    return this.views.list.length;
  }

  /**
   * A tower fired along `angle`: snap the turret, kick it back and flash the muzzle. Writes the
   * muzzle point into `out` and returns it (null for unknown towers).
   */
  fired(uid: number, angle: number, out: Muzzle): Muzzle | null {
    const v = this.views.get(uid);
    if (!v || !v.state) return null;
    if (v.mode === 'aim') v.angle = angle;
    v.recoil = 1;
    if (v.mode === 'trap' || v.mode === 'pulse') v.pop = Math.max(v.pop, POP_TIME * 0.45);
    const reach = v.mode === 'heli' ? 30 * v.scale : 50 * v.scale;
    const ox = v.mode === 'heli' ? v.hx : v.state.x;
    const oy = v.mode === 'heli' ? v.hy : v.state.y;
    out.x = ox + Math.cos(angle) * reach;
    out.y = oy + Math.sin(angle) * reach;
    if (v.mode === 'aim' || v.mode === 'heli') {
      v.flashT = 0.07;
      v.flash
        .setPosition(out.x, out.y)
        .setRotation(Math.random() * 6.28)
        .setScale((0.35 + Math.random() * 0.15) * (v.state.def.footprint / 30))
        .setVisible(true);
    }
    return out;
  }

  /** Current turret tip of a tower (where beams start). Null for unknown towers. */
  tip(uid: number, out: Muzzle): Muzzle | null {
    const v = this.views.get(uid);
    if (!v || !v.state) return null;
    const reach = 46 * v.scale;
    out.x = v.state.x + Math.cos(v.angle) * reach;
    out.y = v.state.y + Math.sin(v.angle) * reach;
    return out;
  }

  /** Play the placement pop. */
  placed(uid: number): void {
    const v = this.views.get(uid);
    if (v) v.pop = POP_TIME;
  }

  /** Match sprites to the sim's towers and animate them by `dt` seconds. */
  sync(towers: ReadonlyArray<TowerState>, dt: number, enemyAt: (uid: number) => EnemyState | null): void {
    const views = this.views;
    views.begin();
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i] as TowerState;
      const v = views.touch(t.uid);
      if (v.state !== t) this.bind(v, t);
      this.animate(v, t, dt, enemyAt);
    }
    views.sweep();
  }


  private bind(v: TowerView, t: TowerState): void {
    v.state = t;
    v.mode = MODE[t.def.id] ?? 'aim';
    v.scale = towerScale(t.def.footprint);
    v.angle = t.angle;
    v.recoil = 0;
    v.flashT = 0;
    v.pop = 0;
    v.spinAngle = Math.random() * Math.PI * 2;
    v.tierKey = -1;
    v.hx = t.unit ? t.unit.x : t.x;
    v.hy = t.unit ? t.unit.y : t.y;
    if (t.unit) v.angle = t.unit.angle;
    v.t = Math.random() * 10;
    const trap = t.def.placement === 'path';
    const depth = (trap ? DEPTH.trap : DEPTH.towerBase) + t.y * Y_SORT;
    // Pooled views may come from any other tower: reset every transform and visual property.
    v.base.setTexture(t.def.sprite.base).setPosition(t.x, t.y).setScale(v.scale).setRotation(0)
      .clearTint().setDepth(depth).setVisible(true).setAlpha(1);
    const turretKey = this.turretKey(t);
    const turretRotation = v.mode === 'aim' || v.mode === 'heli' ? v.angle : v.mode === 'trap' ? 0 : v.spinAngle;
    v.turret.setTexture(turretKey).setPosition(v.mode === 'heli' ? v.hx : t.x, v.mode === 'heli' ? v.hy : t.y)
      .setScale(v.scale).setRotation(turretRotation).clearTint().setVisible(true).setAlpha(1);
    v.turret.setDepth(v.mode === 'heli' ? DEPTH.heliBody : (trap ? DEPTH.trap + 0.5 : DEPTH.towerTurret) + t.y * Y_SORT);
    v.flash.setTint(FLASH_TINT[t.def.id] ?? 0xffe08a).setAlpha(1).setVisible(false);
    if (v.mode === 'heli') {
      v.rotor ??= this.scene.add.image(0, 0, 'tower-heli-rotor').setDepth(DEPTH.heliRotor);
      v.heliShadow ??= this.scene.add.image(0, 0, 'tower-heli-turret').setTintFill(0x000000).setDepth(DEPTH.flyingShadow);
      v.rotor.setAlpha(0.6).setVisible(true);
      v.heliShadow.setTexture(turretKey).setScale(v.scale * 0.85).setAlpha(0.25).setVisible(true);
    } else {
      v.rotor?.setVisible(false);
      v.heliShadow?.setVisible(false);
    }
    v.pips.setPosition(t.x, t.y).setDepth(depth + 0.6).setVisible(true);
  }

  private turretKey(t: TowerState): string {
    const base = t.def.sprite.turret ?? t.def.sprite.base;
    if (t.tiers[0] >= 3 || t.tiers[1] >= 3) {
      const t3 = `${base}-t3`;
      if (this.scene.textures.exists(t3)) return t3;
    }
    return base;
  }

  private animate(v: TowerView, t: TowerState, dt: number, enemyAt: (uid: number) => EnemyState | null): void {
    v.t += dt;
    const tierKey = t.tiers[0] * 10 + t.tiers[1];
    if (tierKey !== v.tierKey) {
      if (v.tierKey >= 0) {
        v.turret.setTexture(this.turretKey(t));
        if (v.mode === 'heli') v.heliShadow?.setTexture(this.turretKey(t));
      }
      v.tierKey = tierKey;
      this.drawPips(v, t);
    }

    let popMul = 1;
    if (v.pop > 0) {
      v.pop = Math.max(0, v.pop - dt);
      const k = 1 - v.pop / POP_TIME;
      popMul = 0.7 + 0.3 * easeOutBack(k);
    }
    v.base.setScale(v.scale * popMul);

    const target = t.targetUid >= 0 ? enemyAt(t.targetUid) : null;
    const turret = v.turret;
    switch (v.mode) {
      case 'spin':
      case 'pulse': {
        v.spinAngle += (SPIN[t.def.id] ?? 1) * dt;
        turret.setRotation(v.spinAngle).setScale(v.scale * popMul);
        break;
      }
      case 'trap': {
        const max = t.memory.maxCharges ?? 0;
        const left = t.memory.charges ?? max;
        turret.setPosition(t.x, t.y).setRotation(0).setScale(v.scale * popMul).setAlpha(max > 0 ? 0.45 + 0.55 * (left / max) : 1);
        break;
      }
      case 'heli': {
        this.animateHeli(v, t, dt);
        break;
      }
      default: {
        const want = target ? Math.atan2(target.y - t.y, target.x - t.x) : t.angle;
        v.angle = smoothAngle(v.angle, want, TURN_RATE, dt);
        v.recoil *= Math.exp(-14 * dt);
        const kick = v.recoil * (RECOIL[t.def.id] ?? 4) * v.scale;
        turret
          .setPosition(t.x - Math.cos(v.angle) * kick, t.y - Math.sin(v.angle) * kick)
          .setRotation(v.angle)
          .setScale(v.scale * popMul);
      }
    }

    if (v.flashT > 0) {
      v.flashT -= dt;
      if (v.flashT <= 0) v.flash.setVisible(false);
      else v.flash.setAlpha(Math.min(1, v.flashT / 0.04));
    }
  }

  /**
   * The helicopter flies where the sim puts it (`TowerState.unit`, heading = body angle); the
   * pad stays put. A gentle hover bob, a ground shadow offset by its altitude, constant rotor.
   */
  private animateHeli(v: TowerView, t: TowerState, dt: number): void {
    const unit = t.unit;
    const ux = unit ? unit.x : t.x;
    const uy = unit ? unit.y : t.y;
    const k = 1 - Math.exp(-20 * dt);
    v.hx += (ux - v.hx) * k;
    v.hy += (uy - v.hy) * k;
    v.angle = smoothAngle(v.angle, unit ? unit.angle : v.angle, 12, dt);
    v.recoil *= Math.exp(-14 * dt);
    const kick = v.recoil * 2;
    const bob = Math.sin(v.t * 2.2) * 0.03;
    const s = v.scale * HELI_SCALE * (1 + bob);
    v.turret.setPosition(v.hx - Math.cos(v.angle) * kick, v.hy - Math.sin(v.angle) * kick).setRotation(v.angle).setScale(s);
    v.rotor?.setPosition(v.hx, v.hy).setRotation(v.t * ROTOR_SPEED).setScale(s);
    v.heliShadow?.setPosition(v.hx + HELI_SHADOW_X, v.hy + HELI_SHADOW_Y).setRotation(v.angle);
  }

  private drawPips(v: TowerView, t: TowerState): void {
    const g = v.pips.clear();
    if (t.tiers[0] + t.tiers[1] === 0) return;
    const y = t.def.footprint * 1.12 + 4;
    const gap = 8;
    for (let path = 0; path < 2; path++) {
      const tiers = t.tiers[path] ?? 0;
      const cx = path === 0 ? -14 : 14;
      for (let i = 0; i < 3; i++) {
        const x = cx + (i - 1) * gap;
        g.fillStyle(0x1b1f2a, 0.9).fillCircle(x, y, 4.2);
        if (i < tiers) g.fillStyle(PIP_COLORS[path] as number, 1).fillCircle(x, y, 3);
        else g.fillStyle(0x3a4560, 1).fillCircle(x, y, 2.4);
      }
    }
  }

  private make(): TowerView {
    const scene = this.scene;
    return {
      uid: 0,
      seen: 0,
      state: null,
      base: scene.add.image(0, 0, 'tower-blaster-base').setVisible(false),
      turret: scene.add.image(0, 0, 'tower-blaster-turret').setVisible(false),
      flash: scene.add.image(0, 0, 'fx-spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setVisible(false),
      rotor: null,
      heliShadow: null,
      pips: scene.add.graphics().setVisible(false),
      mode: 'aim',
      scale: 1,
      angle: 0,
      recoil: 0,
      flashT: 0,
      pop: 0,
      spinAngle: 0,
      tierKey: -1,
      hx: 0,
      hy: 0,
      t: 0,
    };
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

