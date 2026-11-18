import Phaser from 'phaser';
import type { EnemyState } from '../sim/EnemyState';
import type { Effects } from './Effects';
import type { HealthBars } from './HealthBars';
import { KeyedViews, type KeyedView } from './Pool';
import { DEPTH, Y_SORT } from './layers';
import { smoothAngle } from './math';
import { enemyScale } from './sizes';

const FADE_IN = 0.3;
const FLASH_TIME = 0.06;
/** Minimum gap between hit flashes so rapid-fire towers do not keep enemies white. */
const FLASH_GAP = 0.12;
const PHASE_FLASH_TIME = 0.9;
const TURN_RATE = 10;
const STEALTH_ALPHA = 0.32;
const SUBMERGED_ALPHA = 0.3;
const DUST_INTERVAL = 0.12;

const TINT_NONE = 0xffffff;
const TINT_SLOW = 0x9fdcff;
const TINT_STUN = 0xfff0a0;
const TINT_POISON = 0xbdf59a;
const TINT_BURN = 0xffb38a;
const TINT_RAGE = 0xff6b6b;

/** Rendering of one enemy: body sprite, flyer shadow and a lazily created shield bubble. */
interface EnemyView extends KeyedView {
  state: EnemyState | null;
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  shield: Phaser.GameObjects.Image | null;
  baseScale: number;
  angle: number;
  age: number;
  flash: number;
  /** Current tint key, so tint calls only happen on change (-1 = white fill flash). */
  tint: number;
  phaseFlash: number;
  dust: number;
  bob: number;
}

/** Syncs enemy sprites with `sim.enemies` every frame. */
export class EnemyViews {
  private readonly views: KeyedViews<EnemyView>;
  private time = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly effects: Effects) {
    this.views = new KeyedViews<EnemyView>(
      () => this.make(),
      (v) => {
        v.age = 0;
        v.flash = -1;
        v.tint = TINT_NONE;
        v.phaseFlash = 0;
        v.dust = 0;
        v.bob = Math.random() * Math.PI * 2;
      },
      (v) => {
        v.state = null;
        v.body.setVisible(false);
        v.shadow.setVisible(false);
        v.shield?.setVisible(false);
      },
    );
  }

  /** Number of enemy views alive (for stats). */
  get count(): number {
    return this.views.list.length;
  }

  /** Live sim state of an enemy that is on screen. */
  state(uid: number): EnemyState | null {
    return this.views.get(uid)?.state ?? null;
  }

  /** White hit flash on an enemy (rate limited). */
  hit(uid: number): void {
    const v = this.views.get(uid);
    if (v && v.flash < -FLASH_GAP) v.flash = FLASH_TIME;
  }

  /** Red pulse when a boss enters a new phase. */
  bossPhase(uid: number): void {
    const v = this.views.get(uid);
    if (v) v.phaseFlash = PHASE_FLASH_TIME;
  }

  /** Match sprites to the sim's enemy list, then animate them by `dt` seconds of game time. */
  sync(enemies: ReadonlyArray<EnemyState>, dt: number, bars: HealthBars): void {
    this.time += dt;
    const views = this.views;
    views.begin();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i] as EnemyState;
      if (!e.alive) continue;
      const v = views.touch(e.uid);
      if (v.state !== e) this.bind(v, e);
      this.animate(v, e, dt, bars);
    }
    views.sweep();
  }


  private bind(v: EnemyView, e: EnemyState): void {
    v.state = e;
    const key = e.def.sprite;
    const tex = this.scene.textures.exists(key) ? key : 'enemy-larva';
    v.body.setTexture(tex).clearTint().setVisible(true).setAlpha(0);
    v.baseScale = enemyScale(e.radius, v.body.frame.width);
    v.angle = e.angle;
    v.body.setRotation(e.angle).setScale(v.baseScale);
    if (e.flying) {
      v.shadow.setTexture(tex).setTintFill(0x000000).setAlpha(0).setVisible(true);
    } else {
      v.shadow.setVisible(false);
    }
    v.shield?.setVisible(false);
  }

  private animate(v: EnemyView, e: EnemyState, dt: number, bars: HealthBars): void {
    const body = v.body;
    v.age += dt;
    v.flash -= dt;
    if (v.phaseFlash > 0) v.phaseFlash -= dt;
    const st = e.status;
    const stunned = st.stunRemaining > 0;

    v.angle = smoothAngle(v.angle, e.angle, TURN_RATE, dt);
    const moving = !stunned && e.currentSpeed > 0;
    if (moving) v.bob += dt * (6 + e.currentSpeed / 10);
    const wobble = Math.sin(v.bob) * (e.isBoss ? 0.03 : 0.06);
    let scale = v.baseScale * (e.flying ? 1.12 : 1);
    if (v.phaseFlash > 0) scale *= 1 + 0.12 * Math.sin((v.phaseFlash / PHASE_FLASH_TIME) * Math.PI);
    body.setScale(scale * (1 + wobble), scale * (1 - wobble));
    body.setRotation(v.angle + (e.flying ? Math.sin(v.bob * 0.5) * 0.08 : 0));
    body.setPosition(e.x, e.y);
    body.setDepth((e.flying ? DEPTH.flying : DEPTH.enemy) + (e.isBoss ? 0.5 : 0) + e.y * Y_SORT);

    let alpha = Math.min(1, v.age / FADE_IN);
    if (e.burrowed) alpha *= SUBMERGED_ALPHA;
    else if (e.stealth && !e.revealed) alpha *= STEALTH_ALPHA + 0.08 * Math.sin(this.time * 4 + v.bob);
    body.setAlpha(alpha);

    this.applyTint(v, e, stunned);

    if (e.flying) {
      const lift = e.altitude;
      v.shadow
        .setPosition(e.x + lift * 0.35, e.y + lift * 0.7)
        .setRotation(v.angle)
        .setScale(v.baseScale * 0.9)
        .setAlpha(0.28 * alpha)
        .setDepth(DEPTH.flyingShadow);
    }

    if (e.shield > 0) {
      const s = v.shield ?? (v.shield = this.scene.add.image(0, 0, 'fx-shield').setDepth(DEPTH.enemy + 0.9));
      const sf = e.maxShield > 0 ? Math.min(1, e.shield / e.maxShield) : 1;
      s.setVisible(true)
        .setPosition(e.x, e.y)
        .setScale(((e.radius * 2.4) / 128) * (1 + 0.04 * Math.sin(this.time * 5)))
        .setAlpha((0.25 + 0.4 * sf) * alpha)
        .setDepth(body.depth + 0.001);
    } else if (v.shield?.visible) {
      v.shield.setVisible(false);
    }

    if (e.burrowed) {
      v.dust -= dt;
      if (v.dust <= 0) {
        v.dust = DUST_INTERVAL;
        this.effects.dust(e.x, e.y);
      }
    }

    if (!e.burrowed) bars.draw(e, e.x, e.y, e.radius * (e.flying ? 1.25 : 1.05), Math.min(1, alpha * 1.6));
  }

  private applyTint(v: EnemyView, e: EnemyState, stunned: boolean): void {
    const body = v.body;
    if (v.flash > 0) {
      if (v.tint !== -1) {
        v.tint = -1;
        body.setTintFill(0xffffff);
      }
      return;
    }
    let want = TINT_NONE;
    if (v.phaseFlash > 0 && Math.sin(v.phaseFlash * 30) > 0) want = TINT_RAGE;
    else if (stunned) want = TINT_STUN;
    else if (e.status.slowRemaining > 0) want = TINT_SLOW;
    else if (e.status.dots.length > 0) want = dotTint(e.status.dots[0]?.type);
    if (want === v.tint) return;
    v.tint = want;
    if (want === TINT_NONE) body.clearTint();
    else body.setTint(want);
  }

  private make(): EnemyView {
    const scene = this.scene;
    return {
      uid: 0,
      seen: 0,
      state: null,
      body: scene.add.image(0, 0, 'enemy-larva').setVisible(false),
      shadow: scene.add.image(0, 0, 'enemy-larva').setVisible(false),
      shield: null,
      baseScale: 1,
      angle: 0,
      age: 0,
      flash: -1,
      tint: TINT_NONE,
      phaseFlash: 0,
      dust: 0,
      bob: 0,
    };
  }
}

function dotTint(type: string | undefined): number {
  if (type === 'fire') return TINT_BURN;
  if (type === 'poison') return TINT_POISON;
  return TINT_NONE;
}
