import Phaser from 'phaser';
import { FIELD_W, GAME_H, TOPBAR_H } from '../config';
import type { GameController, GameEvents } from './game/GameController';
import type { GameScene } from './GameScene';
import type { HudDebug } from './game/debugApi';
import { Tooltip } from '../ui/Tooltip';
import { ToastStack } from '../ui/Toast';
import { CSS, FONT, textStyle, space } from '../ui/theme';
import type { HudContext, HudWidget } from '../ui/hud/HudContext';
import { Banner } from '../ui/hud/Banner';
import { BossBar } from '../ui/hud/BossBar';
import { HudNotices } from '../ui/hud/HudNotices';
import { PatrolMode } from '../ui/hud/PatrolMode';
import { TOPBAR_CENTER, TopBar } from '../ui/hud/TopBar';
import { TowerPanel } from '../ui/hud/TowerPanel';
import { TowerSelector } from '../ui/hud/TowerSelector';
import { WavePreview } from '../ui/hud/WavePreview';

/**
 * In-game HUD, running in parallel on top of `GameScene` (launched by it). Talks to the game
 * only through the `GameController` and its events; everything is torn down on shutdown.
 */
export class HudScene extends Phaser.Scene {
  private widgets: HudWidget[] = [];
  private unsubs: (() => void)[] = [];
  private controller: GameController | null = null;
  private hudApi: HudDebug | null = null;

  constructor() {
    super('HudScene');
  }

  create(): void {
    const game = this.scene.get('GameScene') as GameScene;
    const c = game.controller;
    this.controller = c;
    const tooltip = new Tooltip(this);
    const toasts = new ToastStack(this, FIELD_W / 2, GAME_H - space(3), 600);
    const ctx: HudContext = {
      scene: this,
      c,
      tooltip,
      toasts,
      listen: <K extends keyof GameEvents>(name: K, fn: (payload: GameEvents[K]) => void) => {
        this.unsubs.push(c.events.on(name, fn));
      },
    };
    const banner = new Banner(this);
    const top = new TopBar(ctx);
    const preview = new WavePreview(ctx, TOPBAR_CENTER[0], TOPBAR_CENTER[1]);
    const selector = new TowerSelector(ctx);
    const patrol = new PatrolMode(ctx);
    const panel = new TowerPanel(ctx, (y) => selector.setListBottom(Math.min(GAME_H - space(2), y - space(2))), (uid) => patrol.start(uid));
    const boss = new BossBar(ctx, banner);
    const notices = new HudNotices(ctx, banner);
    const paused = this.pauseOverlay(ctx);
    this.widgets = [top, preview, selector, panel, boss, notices, patrol, banner, paused, {
      update: (dt) => toasts.update(dt * 1000),
      destroy: () => {
        toasts.destroy();
        tooltip.destroy();
      },
    }];
    c.pointerBlocker = (x, y) => {
      if (patrol.active) return true;
      const r = boss.visible ? boss.rect : null;
      return !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    };
    const api = window.__LDTD__;
    if (api) {
      this.hudApi = {
        listOffset: () => selector.list.physics.offset,
        listMoving: () => selector.list.physics.moving || selector.list.physics.isDragging,
        cardCenter: (id) => selector.cardCenter(id),
        control: (name) => top.control(name) ?? panel.control(name),
      };
      api.hud = this.hudApi;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    for (const w of this.widgets) w.update?.(dt);
  }

  /** Dim the field with a "Paused" label while the game is paused (Task 10 adds the menu). */
  private pauseOverlay(ctx: HudContext): HudWidget {
    const dim = this.add.rectangle(0, TOPBAR_H, FIELD_W, GAME_H - TOPBAR_H, 0x05070c, 0.45).setOrigin(0, 0).setDepth(90);
    const label = this.add
      .text(FIELD_W / 2, GAME_H / 2 - 20, 'PAUSED', { ...textStyle(FONT.huge, { weight: 700, shadow: true }), stroke: '#0b101b', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(91);
    const hint = this.add
      .text(FIELD_W / 2, GAME_H / 2 + 36, 'Press P or the play button to resume', textStyle(FONT.md, { color: CSS.textDim, shadow: true }))
      .setOrigin(0.5).setDepth(91);
    const set = (on: boolean): void => {
      for (const o of [dim, label, hint]) o.setVisible(on);
    };
    set(ctx.c.paused);
    ctx.listen('pauseChanged', ({ paused }) => set(paused));
    return { destroy: () => [dim, label, hint].forEach((o) => o.destroy()) };
  }

  private teardown(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const w of this.widgets) w.destroy();
    this.widgets = [];
    if (this.controller) this.controller.pointerBlocker = null;
    if (window.__LDTD__ && window.__LDTD__.hud === this.hudApi) delete window.__LDTD__.hud;
    this.hudApi = null;
    this.controller = null;
  }
}
