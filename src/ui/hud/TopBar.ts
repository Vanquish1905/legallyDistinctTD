import Phaser from 'phaser';
import { FIELD_W, TOPBAR_H } from '../../config';
import { Button } from '../Button';
import { drawGlass } from '../Panel';
import { CSS, DURATION, FONT, UI, space, textStyle } from '../theme';
import { formatCompact, formatNumber, waveLabel } from './hudModel';
import type { HudContext, HudWidget } from './HudContext';

const PILL_H = 48;
const PILL_Y = (TOPBAR_H - PILL_H) / 2;
const BTN_H = 56;
const BTN_Y = TOPBAR_H / 2;
/** How often the early-start bonus is re-read while a wave runs (s). */
const BONUS_POLL = 0.25;

/** Horizontal room the top bar leaves free for the wave preview: [left, right] in px. */
export const TOPBAR_CENTER: readonly [number, number] = [548, 972];

interface Stat {
  /** Coloured outline + glow flashed on change. */
  flash: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  x: number;
  w: number;
}

/**
 * The bar across the top of the field: lives, money (counts up), wave X/Y on the left;
 * auto-start, speed, pause and the next-wave button (early bonus, idle pulse) on the right.
 */
export class TopBar implements HudWidget {
  private readonly root: Phaser.GameObjects.Container;
  private readonly lives: Stat;
  private readonly money: Stat;
  private readonly wave: Stat;
  private readonly next: Button;
  private readonly nextBonus: Phaser.GameObjects.Text;
  private readonly nextGlow: Phaser.GameObjects.Graphics;
  private readonly speed: Button;
  private readonly pause: Button;
  private readonly auto: Button;
  private shownMoney: number;
  private targetMoney: number;
  private bonus = -1;
  private bonusPoll = 0;
  private pulse: Phaser.Tweens.Tween | null = null;

  constructor(private readonly ctx: HudContext) {
    const { scene, c } = ctx;
    this.root = scene.add.container(0, 0);
    const bar = scene.add.graphics();
    // Soft shadow under the bar, then the glass strip.
    for (let i = 0; i < 4; i++) bar.fillStyle(UI.shadow, 0.1 - i * 0.022).fillRect(0, TOPBAR_H + i * 3, FIELD_W, 3);
    bar.fillStyle(0x0e1420, 0.9).fillRect(0, 0, FIELD_W, TOPBAR_H);
    bar.fillStyle(UI.white, 0.03).fillRect(0, 0, FIELD_W, TOPBAR_H / 2);
    bar.fillStyle(UI.border, 1).fillRect(0, TOPBAR_H - 1, FIELD_W, 1);
    const blocker = scene.add.zone(0, 0, FIELD_W, TOPBAR_H).setOrigin(0, 0).setInteractive();
    this.root.add([bar, blocker]);

    let x = space(2);
    this.lives = this.stat(x, 132, 'icon-heart', CSS.text);
    x += 132 + space(1);
    this.money = this.stat(x, 176, 'icon-coin', CSS.gold);
    x += 176 + space(1);
    this.wave = this.stat(x, 208, 'icon-wave', CSS.text, FONT.lg);

    // Right group, laid out from the right edge.
    let r = FIELD_W - space(2);
    const nextW = 236;
    this.nextGlow = scene.add.graphics();
    this.next = new Button(scene, r - nextW / 2, BTN_Y, {
      width: nextW, height: BTN_H, variant: 'primary', label: 'Start Wave 1', icon: 'icon-play', iconSize: 26, fontSize: FONT.md,
      onClick: () => c.startNextWave(),
    });
    this.nextBonus = scene.add.text(nextW / 2 - 12, 0, '', textStyle(FONT.sm, { weight: 700, color: CSS.gold })).setOrigin(1, 0.5);
    this.next.content.add(this.nextBonus);
    this.drawGlow(r - nextW, nextW);
    r -= nextW + space(1);
    this.pause = new Button(scene, r - BTN_H / 2, BTN_Y, {
      width: BTN_H, height: BTN_H, icon: 'icon-pause', iconSize: 28, onClick: () => c.togglePause(),
    });
    r -= BTN_H + space(1);
    this.speed = new Button(scene, r - 48, BTN_Y, {
      width: 96, height: BTN_H, icon: 'icon-speed1', iconSize: 26, label: '1×', fontSize: FONT.lg, onClick: () => c.cycleSpeed(),
    });
    r -= 96 + space(1);
    this.auto = new Button(scene, r - 64, BTN_Y, {
      width: 128, height: BTN_H, icon: 'icon-restart', iconSize: 22, label: 'Auto', fontSize: FONT.md,
      onClick: () => c.setAutoStart(!c.sim.autoStart),
    });
    this.root.add([this.nextGlow, this.next, this.pause, this.speed, this.auto]);
    this.root.setDepth(100);

    this.shownMoney = c.sim.money;
    this.targetMoney = c.sim.money;
    this.money.text.setText(formatCompact(c.sim.money));
    this.setLives(c.sim.lives, 0);
    this.refreshWave();
    this.refreshSpeed();
    this.refreshPause();
    this.refreshAuto();

    ctx.listen('moneyChanged', ({ money, delta }) => {
      this.targetMoney = money;
      if (delta >= 50) this.pop(this.money, UI.gold);
    });
    ctx.listen('livesChanged', ({ lives, delta }) => this.setLives(lives, delta));
    ctx.listen('waveChanged', () => this.refreshWave());
    ctx.listen('speedChanged', () => this.refreshSpeed());
    ctx.listen('pauseChanged', () => this.refreshPause());
    ctx.listen('autoStartChanged', () => this.refreshAuto());
    ctx.listen('gameOver', () => this.refreshWave());
  }

  update(dt: number): void {
    if (this.shownMoney !== this.targetMoney) {
      const d = this.targetMoney - this.shownMoney;
      this.shownMoney = Math.abs(d) < 1 ? this.targetMoney : this.shownMoney + d * Math.min(1, dt * 9);
      const label = formatCompact(Math.round(this.shownMoney));
      if (this.money.text.text !== label) this.money.text.setText(label);
    }
    this.bonusPoll -= dt;
    if (this.bonusPoll <= 0) {
      this.bonusPoll = BONUS_POLL;
      this.refreshBonus();
    }
  }

  /** Centre of 'next' | 'speed' | 'pause' | 'auto' (e2e hooks). */
  control(name: string): { x: number; y: number } | null {
    const b = name === 'next' ? this.next : name === 'speed' ? this.speed : name === 'pause' ? this.pause : name === 'auto' ? this.auto : null;
    return b?.screenCenter() ?? null;
  }

  destroy(): void {
    this.pulse?.stop();
    this.root.destroy();
  }

  private stat(x: number, w: number, icon: string, color: string, size: number = FONT.xl): Stat {
    const s = this.ctx.scene;
    const bg = s.add.graphics();
    drawGlass(bg, x, PILL_Y, w, PILL_H, { fill: UI.track, alpha: 0.75, radius: PILL_H / 2, shadow: 0, highlight: false });
    const flash = s.add.graphics().setAlpha(0);
    const ic = s.add.image(x + 28, TOPBAR_H / 2, icon).setDisplaySize(34, 34);
    const text = s.add.text(x + 52, TOPBAR_H / 2, '', textStyle(size, { weight: 700, color })).setOrigin(0, 0.5);
    this.root.add([bg, flash, ic, text]);
    return { flash, icon: ic, text, x, w };
  }

  private setLives(lives: number, delta: number): void {
    this.lives.text.setText(formatNumber(lives));
    const low = lives <= 5;
    this.lives.text.setColor(low ? CSS.danger : CSS.text);
    if (delta < 0) this.pop(this.lives, UI.danger);
  }

  /** Quick scale pop of a stat's icon and text, with a coloured flash behind it. */
  private pop(stat: Stat, color: number): void {
    const s = this.ctx.scene;
    s.tweens.killTweensOf([stat.icon, stat.text]);
    stat.text.setScale(1);
    stat.icon.setDisplaySize(34, 34);
    const base = stat.icon.scale;
    s.tweens.add({ targets: stat.icon, scale: { from: base * 1.3, to: base }, duration: DURATION.slow, ease: 'Back.easeOut' });
    s.tweens.add({ targets: stat.text, scale: { from: 1.12, to: 1 }, duration: DURATION.slow, ease: 'Back.easeOut' });
    const g = stat.flash;
    g.clear();
    g.fillStyle(color, 0.16).fillRoundedRect(stat.x, PILL_Y, stat.w, PILL_H, PILL_H / 2);
    g.lineStyle(2, color, 1).strokeRoundedRect(stat.x + 1, PILL_Y + 1, stat.w - 2, PILL_H - 2, PILL_H / 2 - 1);
    s.tweens.killTweensOf(g);
    s.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, duration: 600, ease: 'Quad.easeIn' });
  }

  private refreshWave(): void {
    const sim = this.ctx.c.sim;
    this.wave.text.setText(waveLabel(sim.wave, sim.difficulty.waves, sim.freeplay));
    this.refreshBonus(true);
  }

  /** Next-wave button label, bonus chip, enabled state and idle pulse. */
  private refreshBonus(force = false): void {
    const sim = this.ctx.c.sim;
    const can = sim.canStartNextWave();
    const bonus = can ? sim.nextWaveBonus() : 0;
    if (!force && bonus === this.bonus) return;
    this.bonus = bonus;
    const idle = can && sim.phase === 'build';
    let label: string;
    if (sim.phase === 'won') label = 'Victory!';
    else if (sim.phase === 'lost') label = 'Defeated';
    else if (!can) label = 'Final wave';
    else if (idle) label = `Start Wave ${sim.wave + 1}`;
    else label = 'Next wave';
    this.next.setLabel(label).setEnabled(can).setIcon(idle ? 'icon-play' : 'icon-next');
    this.nextBonus.setText(bonus > 0 ? `+${formatNumber(bonus)}` : '');
    this.setPulse(idle);
  }

  private drawGlow(x: number, w: number): void {
    const g = this.nextGlow;
    g.clear();
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(UI.accent, 0.08 * (4 - i));
      g.fillRoundedRect(x - i * 4, BTN_Y - BTN_H / 2 - i * 4, w + i * 8, BTN_H + i * 8, 12 + i * 4);
    }
    g.setAlpha(0);
  }

  private setPulse(on: boolean): void {
    if (on === (this.pulse !== null)) return;
    this.pulse?.stop();
    this.pulse = null;
    if (on) {
      this.pulse = this.ctx.scene.tweens.add({
        targets: this.nextGlow, alpha: { from: 0.15, to: 1 }, duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });
    } else this.nextGlow.setAlpha(0);
  }

  private refreshSpeed(): void {
    const sp = this.ctx.c.speed;
    this.speed.setLabel(`${sp}×`).setIcon(`icon-speed${sp}`).setSelected(sp > 1);
  }

  private refreshPause(): void {
    const p = this.ctx.c.paused;
    this.pause.setIcon(p ? 'icon-play' : 'icon-pause').setSelected(p);
  }

  private refreshAuto(): void {
    const on = this.ctx.c.sim.autoStart;
    this.auto.setSelected(on).setIcon(on ? 'icon-check' : 'icon-restart');
  }
}
