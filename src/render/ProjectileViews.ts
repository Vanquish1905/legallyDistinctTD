import Phaser from 'phaser';
import type { ProjectileState } from '../sim/ProjectileState';
import type { Effects } from './Effects';
import { KeyedViews, type KeyedView } from './Pool';
import type { WorldLayers } from './WorldLayers';

/** Kinds drawn additively (glowing). */
const GLOW = new Set(['flame', 'frost', 'rail', 'toxin']);
/** Kinds leaving a smoke trail, with seconds between puffs. */
const TRAIL: Readonly<Record<string, number>> = { rocket: 0.035, missile: 0.045, mortar: 0.06 };
/** Spinning kinds (rad/s). */
const SPIN: Readonly<Record<string, number>> = { saw: 22, spike: 10, bomb: 4, mortar: 3 };

interface ProjectileView extends KeyedView {
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  kind: string;
  age: number;
  trail: number;
  spin: number;
}

/** Pooled sprites for every live projectile, keyed by projectile uid. */
export class ProjectileViews {
  private readonly views: KeyedViews<ProjectileView>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: Effects,
    private readonly layers: WorldLayers,
  ) {
    this.views = new KeyedViews<ProjectileView>(
      () => this.make(),
      (v) => {
        v.kind = '';
        v.age = 0;
        v.trail = 0;
      },
      (v) => {
        v.body.setVisible(false);
        v.shadow.setVisible(false);
      },
    );
  }

  get count(): number {
    return this.views.list.length;
  }

  /** Match sprites to the sim's projectiles and animate them by `dt` seconds. */
  sync(list: ReadonlyArray<ProjectileState>, dt: number): void {
    const views = this.views;
    views.begin();
    for (let i = 0; i < list.length; i++) {
      const p = list[i] as ProjectileState;
      if (!p.active) continue;
      const v = views.touch(p.uid);
      if (v.kind !== p.kind) this.bind(v, p);
      this.animate(v, p, dt);
    }
    views.sweep();
  }


  private bind(v: ProjectileView, p: ProjectileState): void {
    v.kind = p.kind;
    const key = `proj-${p.kind}`;
    const tex = this.scene.textures.exists(key) ? key : 'proj-bullet';
    v.body
      .setTexture(tex)
      .setBlendMode(GLOW.has(p.kind) ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1);
    v.spin = SPIN[p.kind] ?? 0;
    v.body.setRotation(v.spin ? Math.random() * 6.28 : p.angle);
    const lob = p.motion === 'lob';
    v.shadow.setTexture(tex).setTintFill(0x000000).setAlpha(0.3).setVisible(lob);
  }

  private animate(v: ProjectileView, p: ProjectileState, dt: number): void {
    v.age += dt;
    const body = v.body;
    const lift = p.z;
    body.setPosition(p.x, p.y - lift);
    if (v.spin) body.rotation += v.spin * dt;
    else body.setRotation(p.angle);

    if (p.kind === 'flame') {
      // Flames grow and fade as they travel.
      const t = p.maxDistance > 0 ? Math.min(1, p.traveled / p.maxDistance) : 0;
      body.setScale(0.55 + t * 1.3).setAlpha(0.95 - t * 0.7);
    } else if (lift > 0) {
      body.setScale(1 + lift / 220);
      v.shadow.setPosition(p.x + lift * 0.15, p.y + lift * 0.1).setScale(Math.max(0.4, 1 - lift / 300));
    }

    const trail = TRAIL[p.kind];
    if (trail !== undefined) {
      v.trail -= dt;
      if (v.trail <= 0 && this.effects.fx.hasRoom) {
        v.trail = trail;
        const back = 14;
        const px = p.x - Math.cos(p.angle) * back;
        const py = p.y - lift - Math.sin(p.angle) * back;
        const puff = this.effects.fx.spawn('fx-smoke', px, py, 0.45, 'trail');
        if (puff) {
          puff.scale0 = 0.16;
          puff.scale1 = 0.42;
          puff.alpha0 = 0.5;
          puff.img.setTint(0xc8ccd4).setRotation(Math.random() * 6.28);
        }
      }
    }
  }

  private make(): ProjectileView {
    const scene = this.scene;
    return {
      uid: 0,
      seen: 0,
      body: this.layers.put('projectile', scene.add.image(0, 0, 'proj-bullet').setVisible(false)),
      shadow: this.layers.put('projectileShadow', scene.add.image(0, 0, 'proj-bullet').setVisible(false)),
      kind: '',
      age: 0,
      trail: 0,
      spin: 0,
    };
  }
}
