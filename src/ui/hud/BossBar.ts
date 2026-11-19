import Phaser from 'phaser';
import { FIELD_W, TOPBAR_H } from '../../config';
import { ENEMIES } from '../../data/enemies';
import type { EnemyDef } from '../../sim/types';
import { drawGlass } from '../Panel';
import { CSS, FONT, UI, space, textStyle } from '../theme';
import { bossPhaseMarkers, formatCompact } from './hudModel';
import type { Banner } from './Banner';
import type { HudContext, HudWidget } from './HudContext';

const W = 640;
const H = 76;
const BAR_X = 88;
const BAR_Y = 44;
const BAR_W = W - BAR_X - 20;
const BAR_H = 16;

interface Tracked {
  uid: number;
  def: EnemyDef | undefined;
  name: string;
  maxHp: number;
}

/**
 * Large boss HP bar at the top centre of the field while a boss is alive: portrait, name,
 * current phase, HP with a lagging damage trail and phase markers. Announces each boss with a
 * banner. Redraws only when the shown HP fraction changes visibly.
 */
export class BossBar implements HudWidget {
  /** Screen rectangle while visible (for the controller's pointer blocker). */
  readonly rect = { x: (FIELD_W - W) / 2, y: TOPBAR_H + space(1), w: W, h: H };
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly bosses: Tracked[] = [];
  private current: Tracked | null = null;
  private frac = 1;
  private trail = 1;
  private drawnFrac = -1;
  private drawnTrail = -1;
  private shown = false;
  private hpLabel = -1;

  constructor(private readonly ctx: HudContext, banner: Banner) {
    const s = ctx.scene;
    const { x, y } = this.rect;
    this.root = s.add.container(x, y).setDepth(102).setVisible(false);
    const bg = s.add.graphics();
    drawGlass(bg, 0, 0, W, H, { fill: 0x160d17, alpha: 0.94, border: UI.danger, borderAlpha: 0.55, shadow: 1 });
    bg.fillStyle(UI.danger, 0.16).fillCircle(44, H / 2, 30);
    bg.lineStyle(2, UI.danger, 0.8).strokeCircle(44, H / 2, 30);
    this.portrait = s.add.image(44, H / 2, 'boss-queen').setDisplaySize(56, 56);
    this.name = s.add.text(BAR_X, 12, '', textStyle(FONT.lg, { weight: 700 }));
    this.phase = s.add.text(BAR_X + BAR_W, 14, '', textStyle(FONT.xs, { weight: 700, color: CSS.danger })).setOrigin(1, 0);
    this.hpText = s.add
      .text(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, '', { ...textStyle(12, { weight: 700, color: '#ffffff' }), stroke: '#2a0a14', strokeThickness: 3 })
      .setOrigin(0.5);
    this.fill = s.add.graphics();
    this.root.add([bg, this.portrait, this.name, this.phase, this.fill, this.hpText]);

    ctx.listen('bossSpawned', (e) => {
      const def = ENEMIES[e.enemyId as keyof typeof ENEMIES] as EnemyDef | undefined;
      this.bosses.push({ uid: e.uid, def, name: e.name, maxHp: e.maxHp });
      banner.show('BOSS INCOMING', e.name, UI.danger, 1600);
    });
    ctx.listen('bossPhase', (e) => {
      if (this.current?.uid !== e.uid) return;
      this.phase.setText(e.name.toUpperCase());
      this.ctx.scene.tweens.add({ targets: this.root, scale: { from: 1.05, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    });
  }

  /** True while the bar is on screen. */
  get visible(): boolean {
    return this.shown;
  }

  update(dt: number): void {
    const sim = this.ctx.c.sim;
    // Drop dead bosses; follow the oldest one still alive.
    while (this.bosses.length && !sim.getEnemy((this.bosses[0] as Tracked).uid)) this.bosses.shift();
    const next = this.bosses[0] ?? null;
    if (next !== this.current) this.bind(next);
    if (!this.current) return;
    const e = sim.getEnemy(this.current.uid);
    if (!e) return;
    const max = Math.max(1, this.current.maxHp);
    this.frac = Math.max(0, Math.min(1, e.hp / max));
    if (this.trail > this.frac) this.trail = Math.max(this.frac, this.trail - dt * 0.35);
    else this.trail = this.frac;
    if (Math.abs(this.frac - this.drawnFrac) > 0.001 || Math.abs(this.trail - this.drawnTrail) > 0.002) this.drawBar();
    const hp = Math.ceil(e.hp);
    if (hp !== this.hpLabel) {
      this.hpLabel = hp;
      this.hpText.setText(`${formatCompact(hp)} / ${formatCompact(max)}`);
    }
  }

  destroy(): void {
    this.root.destroy();
  }

  private bind(t: Tracked | null): void {
    this.current = t;
    const s = this.ctx.scene;
    s.tweens.killTweensOf(this.root);
    if (!t) {
      if (!this.shown) return;
      this.shown = false;
      s.tweens.add({
        targets: this.root, alpha: 0, y: this.rect.y - 20, duration: 300, ease: 'Quad.easeIn',
        onComplete: () => this.root.setVisible(false),
      });
      return;
    }
    this.shown = true;
    const key = t.def?.sprite ?? 'boss-queen';
    this.portrait.setTexture(key).setDisplaySize(56, 56);
    this.name.setText(t.name);
    this.phase.setText('');
    this.frac = 1;
    this.trail = 1;
    this.drawnFrac = -1;
    this.hpLabel = -1;
    this.drawBar();
    this.root.setVisible(true).setAlpha(0).setScale(1).setY(this.rect.y - 24);
    s.tweens.add({ targets: this.root, alpha: 1, y: this.rect.y, duration: 420, delay: 300, ease: 'Back.easeOut' });
  }

  private drawBar(): void {
    this.drawnFrac = this.frac;
    this.drawnTrail = this.trail;
    const g = this.fill;
    const r = BAR_H / 2;
    g.clear();
    g.fillStyle(0x07090f, 1).fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, r);
    const tw = BAR_W * this.trail;
    if (tw > 2) g.fillStyle(0xfda4af, 0.55).fillRoundedRect(BAR_X, BAR_Y, Math.max(tw, BAR_H), BAR_H, r);
    const fw = BAR_W * this.frac;
    if (fw > 2) {
      g.fillStyle(UI.danger, 1).fillRoundedRect(BAR_X, BAR_Y, Math.max(fw, BAR_H), BAR_H, r);
      g.fillStyle(UI.white, 0.22).fillRoundedRect(BAR_X + 3, BAR_Y + 2, Math.max(fw - 6, 4), 4, 2);
    }
    if (this.current?.def) {
      for (const m of bossPhaseMarkers(this.current.def)) {
        const mx = BAR_X + BAR_W * m;
        const passed = this.frac <= m;
        g.fillStyle(passed ? 0x5b6a86 : UI.white, passed ? 0.6 : 0.9).fillRect(mx - 1, BAR_Y - 4, 2, BAR_H + 8);
        g.fillTriangle(mx - 5, BAR_Y - 8, mx + 5, BAR_Y - 8, mx, BAR_Y - 2);
      }
    }
    g.lineStyle(1, UI.danger, 0.6).strokeRoundedRect(BAR_X - 0.5, BAR_Y - 0.5, BAR_W + 1, BAR_H + 1, r);
  }
}
