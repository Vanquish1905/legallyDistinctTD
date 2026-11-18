import Phaser from 'phaser';
import type { GameSim } from '../sim/GameSim';
import type { SimEvent } from '../sim/events';
import type { EnemyState } from '../sim/EnemyState';
import type { TowerState } from '../sim/TowerState';
import { ENEMIES } from '../data/enemies';
import { FIELD_W, GAME_H } from '../config';
import { Effects } from './Effects';
import { EnemyViews } from './EnemyViews';
import { HealthBars } from './HealthBars';
import { PlacementGhost } from './PlacementGhost';
import { ProjectileViews } from './ProjectileViews';
import { RANGE_OK, RangeIndicator } from './RangeIndicator';
import { TowerViews, type Muzzle } from './TowerViews';
import { DEPTH } from './layers';
import type { ParticleQuality } from './quality';

/** Towers whose direct hits are too frequent or already visualised for impact sparks. */
const NO_HIT_SPARK = new Set(['flamethrower', 'laser', 'pulse', 'tesla']);
const VIGNETTE_KEY = 'fx-vignette';
const VIGNETTE_W = 386;
const VIGNETTE_H = 270;

/** Render counts for the debug overlay and perf checks. */
export interface RenderStats { enemies: number; towers: number; projectiles: number; particles: number }

/**
 * Draws the whole game world from sim state: map, towers, enemies, projectiles, effects,
 * selection range and placement ghost. Reads the sim and its events; never mutates it.
 */
export class WorldRenderer {
  readonly effects: Effects;
  readonly ghost: PlacementGhost;
  private readonly enemies: EnemyViews;
  private readonly towers: TowerViews;
  private readonly projectiles: ProjectileViews;
  private readonly bars: HealthBars;
  private readonly selection: RangeIndicator;
  private readonly selRing: Phaser.GameObjects.Graphics;
  private selRingR = 0;
  private time = 0;
  private readonly hurt: Phaser.GameObjects.Image;
  private readonly muzzle: Muzzle = { x: 0, y: 0 };
  private selectedUid: number | null = null;
  private hurtT = 0;
  private readonly enemyAt = (uid: number): EnemyState | null => this.enemies.state(uid);

  constructor(private readonly scene: Phaser.Scene, private readonly sim: GameSim) {
    scene.add.image(0, 0, sim.map.background).setOrigin(0, 0).setDepth(DEPTH.map);
    makeVignette(scene);
    scene.add.image(0, 0, VIGNETTE_KEY).setOrigin(0, 0).setDisplaySize(FIELD_W, GAME_H)
      .setTint(0x05070c).setAlpha(0.55).setDepth(DEPTH.map + 1);
    this.hurt = scene.add.image(0, 0, VIGNETTE_KEY).setOrigin(0, 0).setDisplaySize(FIELD_W, GAME_H)
      .setTint(0xf43f5e).setAlpha(0).setDepth(DEPTH.ui - 1).setVisible(false);
    this.effects = new Effects(scene);
    this.enemies = new EnemyViews(scene, this.effects);
    this.towers = new TowerViews(scene);
    this.projectiles = new ProjectileViews(scene, this.effects);
    this.bars = new HealthBars(scene);
    this.selection = new RangeIndicator(scene);
    this.selRing = scene.add.graphics().setDepth(DEPTH.towerBase - 0.5).setVisible(false);
    this.ghost = new PlacementGhost(scene);
  }

  /** Particle detail (settings screen). */
  setQuality(q: ParticleQuality): void {
    this.effects.setQuality(q);
  }

  /** Show the range of the selected tower (null hides it). */
  setSelection(uid: number | null): void {
    this.selectedUid = uid;
    if (uid === null) this.selection.hide();
  }

  /**
   * Redraw from sim state. `gameDt` is game time that passed this frame (0 while paused, scaled
   * by speed) and drives animation; `realDt` drives UI-only motion.
   */
  update(gameDt: number, realDt: number, selected: TowerState | undefined): void {
    const sim = this.sim;
    this.bars.begin();
    this.towers.sync(sim.towers, gameDt, this.enemyAt);
    this.enemies.sync(sim.enemies, gameDt, this.bars);
    this.projectiles.sync(sim.projectiles, gameDt);
    this.effects.update(gameDt);
    this.ghost.update(realDt);
    this.time += realDt;
    if (this.selectedUid !== null && selected) {
      this.selection.show(selected.x, selected.y, selected.range, RANGE_OK);
      const r = selected.def.footprint * 1.25;
      if (r !== this.selRingR) {
        this.selRingR = r;
        this.selRing.clear().fillStyle(RANGE_OK, 0.22).fillCircle(0, 0, r).lineStyle(3, RANGE_OK, 0.95).strokeCircle(0, 0, r);
      }
      this.selRing.setPosition(selected.x, selected.y).setVisible(true).setAlpha(0.65 + 0.35 * Math.sin(this.time * 5));
    } else {
      this.selection.hide();
      this.selRing.setVisible(false);
    }
    if (this.hurtT > 0) {
      this.hurtT = Math.max(0, this.hurtT - realDt);
      this.hurt.setAlpha(0.55 * (this.hurtT / 0.6)).setVisible(this.hurtT > 0);
    }
  }

  /** React to one sim event (wired to the controller's `sim` event). */
  handle(e: SimEvent): void {
    const fx = this.effects;
    switch (e.type) {
      case 'enemyHit': {
        this.enemies.hit(e.uid);
        const t = e.towerUid === null ? undefined : this.towerById(e.towerUid);
        if (e.shielded) fx.hit(e.x, e.y, 'energy');
        else if (t && !NO_HIT_SPARK.has(t.def.id)) fx.hit(e.x, e.y, e.damageType);
        break;
      }
      case 'enemyKilled': {
        const def = ENEMIES[e.enemyId as keyof typeof ENEMIES];
        const boss = def?.traits.includes('boss') ?? false;
        fx.death(e.x, e.y, e.enemyId, def?.radius ?? 18, e.reward, boss);
        if (boss) this.scene.cameras.main.shake(450, 0.008);
        break;
      }
      case 'towerFired':
        this.towerFired(e.uid, e.angle, e.targetUid);
        break;
      case 'towerPlaced':
        this.towers.placed(e.uid);
        fx.ring(e.x, e.y, 70, 0x9be7ff, 0.4, DEPTH.decal + 2);
        for (let i = 0; i < fx.fx.count(6); i++) fx.dust(e.x + Math.cos(i) * 26, e.y + Math.sin(i) * 26, 0xd8d2c0, 0.4);
        break;
      case 'towerUpgraded': {
        const t = this.towerById(e.uid);
        if (t) {
          fx.ring(t.x, t.y, 80, 0xfbbf24, 0.5);
          fx.sparks(t.x, t.y, fx.fx.count(10), 0xfde68a, 260);
        }
        break;
      }
      case 'towerSold':
        fx.coins(e.x, e.y, e.refund, 5);
        fx.smoke(e.x, e.y, fx.fx.count(5), 40);
        break;
      case 'towerExpired':
        fx.smoke(e.x, e.y, fx.fx.count(4), 24);
        break;
      case 'income':
        fx.coins(e.x, e.y, e.amount, 5);
        fx.ring(e.x, e.y, 60, 0xfbbf24, 0.5);
        break;
      case 'explosion':
        fx.explosion(e.x, e.y, e.radius, e.damageType);
        break;
      case 'chainLightning':
        fx.lightning(e.points);
        break;
      case 'beam': {
        const tip = this.towers.tip(e.towerUid, this.muzzle);
        fx.beam(tip ? tip.x : e.x1, tip ? tip.y : e.y1, e.x2, e.y2, e.intensity);
        break;
      }
      case 'enemyHealed':
        fx.heal(e.x, e.y, e.radius);
        break;
      case 'bossSpawn':
        this.scene.cameras.main.shake(700, 0.01);
        break;
      case 'bossPhase': {
        this.enemies.bossPhase(e.uid);
        const b = this.enemies.state(e.uid);
        if (b) fx.ring(b.x, b.y, 160, 0xf43f5e, 0.6);
        this.scene.cameras.main.shake(350, 0.006);
        break;
      }
      case 'livesChanged':
        if (e.delta < 0) {
          this.scene.cameras.main.shake(180, 0.005);
          this.hurtT = 0.6;
        }
        break;
      case 'gameLost':
        this.scene.cameras.main.shake(900, 0.012);
        break;
      default:
        break;
    }
  }

  stats(): RenderStats {
    return {
      enemies: this.enemies.count,
      towers: this.towers.count,
      projectiles: this.projectiles.count,
      particles: this.effects.fx.active,
    };
  }

  private towerFired(uid: number, angle: number, targetUid: number): void {
    const t = this.towerById(uid);
    if (!t) return;
    const m = this.towers.fired(uid, angle, this.muzzle);
    if (!m) return;
    const id = t.def.id;
    const behavior = t.def.behavior ?? 'projectile';
    if (behavior === 'projectile' && t.stats.projectileSpeed <= 0) {
      const target = this.enemies.state(targetUid);
      if (target) this.effects.tracer(m.x, m.y, target.x, target.y);
    } else if (id === 'mortar' || id === 'rocket' || id === 'railgun') {
      this.effects.smoke(m.x, m.y, this.effects.fx.count(2), 10, 0xb8bcc6);
    } else if (id === 'tesla') {
      this.effects.flash(t.x, t.y - 6, 0x8be9ff, 0.8);
    }
  }

  private towerById(uid: number): TowerState | undefined {
    const towers = this.sim.towers;
    for (let i = 0; i < towers.length; i++) if ((towers[i] as TowerState).uid === uid) return towers[i];
    return undefined;
  }
}

/** A soft edge-darkening texture, made once per game on a small canvas. */
function makeVignette(scene: Phaser.Scene): void {
  if (scene.textures.exists(VIGNETTE_KEY)) return;
  const tex = scene.textures.createCanvas(VIGNETTE_KEY, VIGNETTE_W, VIGNETTE_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const cx = VIGNETTE_W / 2;
  const cy = VIGNETTE_H / 2;
  const grad = ctx.createRadialGradient(cx, cy, VIGNETTE_H * 0.42, cx, cy, VIGNETTE_W * 0.62);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIGNETTE_W, VIGNETTE_H);
  tex.refresh();
}
