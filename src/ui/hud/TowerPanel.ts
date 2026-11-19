import Phaser from 'phaser';
import { GAME_H } from '../../config';
import type { TargetMode } from '../../sim/types';
import type { TowerState } from '../../sim/TowerState';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { SegmentedControl } from '../SegmentedControl';
import { CSS, FONT, RADIUS, UI, space, textStyle } from '../theme';
import { CATEGORY_COLOR, PATH_COLOR, type HudContext, type HudWidget } from './HudContext';
import { formatNumber, keyStats, upgradeButtonState, usesTargetMode } from './hudModel';
import { SIDEBAR_INNER, SIDEBAR_X } from './TowerSelector';
import { UPGRADE_H, UPGRADE_W, UpgradeButton } from './UpgradeButton';

/** Panel height (px); it sits at the bottom of the sidebar. */
export const PANEL_H = 572;
/** Panel top edge when open. */
export const PANEL_TOP = GAME_H - space(2) - PANEL_H;

const PAD = space(2);
const CELL_W = (UPGRADE_W - space(1)) / 2;
const CELL_H = 44;
const STATS_Y = 96;
const TARGET_Y = 204;
const UP_Y = [260, 380] as const;
const SELL_Y = 504;
const SELL_H = 52;
const SELL_CONFIRM_MS = 2500;
const POLL = 0.5;

const TARGET_SEGMENTS: readonly { id: TargetMode; label: string }[] = [
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
  { id: 'strong', label: 'Strong' },
  { id: 'close', label: 'Close' },
];

interface Cell {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
}

/**
 * Selected tower panel in the lower sidebar: portrait, name, kills, key stats, target mode,
 * two upgrade buttons, sell (tap twice) and, for the Heli Pad, the patrol point button.
 * Slides in on selection; `onLayout` reports its top edge so the list above can shrink.
 */
export class TowerPanel implements HudWidget {
  private readonly panel: Panel;
  private readonly portraitBase: Phaser.GameObjects.Image;
  private readonly portraitTurret: Phaser.GameObjects.Image;
  private readonly portraitBg: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly cells: Cell[] = [];
  private readonly target: SegmentedControl<TargetMode>;
  private readonly noTarget: Phaser.GameObjects.Text;
  private readonly upgrades: [UpgradeButton, UpgradeButton];
  private readonly sell: Button;
  private readonly patrol: Button;
  private uid: number | null = null;
  private open = false;
  private slide: Phaser.Tweens.Tween | null = null;
  private sellArmed = 0;
  private poll = 0;
  private subLabel = '';

  constructor(
    private readonly ctx: HudContext,
    private readonly onLayout: (top: number) => void,
    private readonly onPatrol: (uid: number) => void,
  ) {
    const s = ctx.scene;
    const c = ctx.c;
    this.panel = new Panel(s, SIDEBAR_X, GAME_H + 20, SIDEBAR_INNER, PANEL_H, { fill: 0x131b2b, alpha: 0.98, shadow: 1 }).blockInput();
    this.panel.setDepth(110).setVisible(false);
    const p = this.panel;

    this.portraitBg = s.add.graphics();
    this.portraitBase = s.add.image(PAD + 32, PAD + 32, 'tower-blaster-base').setScale(0.56);
    this.portraitTurret = s.add.image(PAD + 32, PAD + 32, 'tower-blaster-turret').setScale(0.56).setRotation(-Math.PI / 2);
    this.name = s.add.text(PAD + 80, PAD + 2, '', textStyle(FONT.lg + 2, { weight: 700 }));
    this.sub = s.add.text(PAD + 80, PAD + 38, '', textStyle(FONT.xs, { weight: 500, color: CSS.textDim }));
    const close = new Button(s, SIDEBAR_INNER - 34, PAD + 18, {
      width: 44, height: 44, variant: 'ghost', icon: 'icon-close', iconSize: 22, onClick: () => c.select(null),
    });
    p.add([this.portraitBg, this.portraitBase, this.portraitTurret, this.name, this.sub, close]);

    const cellBg = s.add.graphics();
    p.add(cellBg);
    for (let i = 0; i < 4; i++) {
      const x = PAD + (i % 2) * (CELL_W + space(1));
      const y = STATS_Y + Math.floor(i / 2) * (CELL_H + space(1));
      cellBg.fillStyle(UI.track, 0.7).fillRoundedRect(x, y, CELL_W, CELL_H, RADIUS.small);
      const icon = s.add.image(x + 22, y + CELL_H / 2, 'icon-skull').setDisplaySize(24, 24).setAlpha(0.85);
      const label = s.add.text(x + 42, y + 6, '', textStyle(11, { weight: 700, color: CSS.textMute }));
      const value = s.add.text(x + 42, y + 20, '', textStyle(FONT.sm, { weight: 700 }));
      this.cells.push({ icon, label, value });
      p.add([icon, label, value]);
    }

    this.target = new SegmentedControl<TargetMode>(s, PAD, TARGET_Y, {
      width: UPGRADE_W, height: 44, segments: TARGET_SEGMENTS, value: 'first', fontSize: FONT.sm - 1,
      onChange: (mode) => {
        if (this.uid !== null) c.setTargetMode(this.uid, mode);
      },
    });
    this.noTarget = s.add
      .text(PAD + UPGRADE_W / 2, TARGET_Y + 22, '', textStyle(FONT.xs, { weight: 500, color: CSS.textMute, align: 'center' }))
      .setOrigin(0.5);
    p.add([this.target, this.noTarget]);

    const mk = (path: 0 | 1): UpgradeButton =>
      new UpgradeButton(s, PAD + UPGRADE_W / 2, UP_Y[path] + UPGRADE_H / 2, PATH_COLOR[path], path === 0 ? 'U' : 'I', () => this.buy(path));
    this.upgrades = [mk(0), mk(1)];
    this.sell = new Button(s, 0, SELL_Y + SELL_H / 2, {
      width: UPGRADE_W, height: SELL_H, variant: 'danger', icon: 'icon-sell', iconSize: 24, label: 'Sell', fontSize: FONT.md,
      onClick: () => this.sellTap(),
    });
    this.patrol = new Button(s, 0, SELL_Y + SELL_H / 2, {
      width: CELL_W, height: SELL_H, variant: 'secondary', icon: 'icon-target', iconSize: 24, label: 'Patrol', fontSize: FONT.md,
      onClick: () => {
        if (this.uid !== null) this.onPatrol(this.uid);
      },
    });
    p.add([...this.upgrades, this.sell, this.patrol]);

    ctx.listen('selectionChanged', ({ uid }) => (uid === null ? this.hide() : this.show(uid)));
    ctx.listen('towerChanged', ({ uid }) => {
      if (uid === this.uid) this.refresh();
    });
    ctx.listen('moneyChanged', () => this.refreshButtons());
    ctx.listen('waveChanged', () => this.refreshButtons());
  }

  /** Screen rectangle while open (null when hidden). */
  get bounds(): { x: number; y: number; w: number; h: number } | null {
    return this.open ? { x: SIDEBAR_X, y: this.panel.y, w: SIDEBAR_INNER, h: PANEL_H } : null;
  }

  /** Centre of 'upgrade0' | 'upgrade1' | 'sell' | 'patrol' | 'target-<mode>' while open and settled (e2e hooks). */
  control(name: string): { x: number; y: number } | null {
    if (!this.open || this.panel.y !== PANEL_TOP) return null;
    if (name.startsWith('target-')) return this.target.segmentCenter(name.slice(7) as TargetMode);
    const b = name === 'upgrade0' ? this.upgrades[0] : name === 'upgrade1' ? this.upgrades[1] : name === 'sell' ? this.sell : name === 'patrol' ? this.patrol : null;
    return b?.screenCenter() ?? null;
  }

  update(dt: number): void {
    if (!this.open) return;
    this.poll -= dt;
    if (this.poll <= 0) {
      this.poll = POLL;
      this.refreshSub();
    }
    if (this.sellArmed > 0) {
      this.sellArmed -= dt * 1000;
      if (this.sellArmed <= 0) this.refreshButtons();
    }
  }

  destroy(): void {
    this.slide?.stop();
    this.panel.destroy();
  }

  private tower(): TowerState | undefined {
    return this.uid === null ? undefined : this.ctx.c.towerByUid(this.uid);
  }

  private show(uid: number): void {
    const changed = uid !== this.uid;
    this.uid = uid;
    this.sellArmed = 0;
    this.refresh();
    if (this.open && !changed) return;
    if (this.open) {
      this.ctx.scene.tweens.add({ targets: this.panel, alpha: { from: 0.6, to: 1 }, duration: 160 });
      return;
    }
    this.open = true;
    this.panel.setVisible(true).setAlpha(1);
    this.animateTo(PANEL_TOP, 'Cubic.easeOut', 300);
  }

  private hide(): void {
    this.uid = null;
    if (!this.open) return;
    this.open = false;
    this.ctx.tooltip.hide();
    this.animateTo(GAME_H + 20, 'Cubic.easeIn', 220, () => this.panel.setVisible(false));
  }

  private animateTo(y: number, ease: string, duration: number, done?: () => void): void {
    this.slide?.stop();
    this.slide = this.ctx.scene.tweens.add({
      targets: this.panel, y, duration, ease,
      onUpdate: () => this.onLayout(Math.min(GAME_H, this.panel.y)),
      onComplete: () => {
        this.onLayout(Math.min(GAME_H, this.panel.y));
        done?.();
      },
    });
  }

  /** Rebind everything for the selected tower. */
  private refresh(): void {
    const t = this.tower();
    if (!t) return;
    const def = t.def;
    const cat = CATEGORY_COLOR[def.category];
    const g = this.portraitBg;
    g.clear();
    g.fillStyle(UI.track, 0.9).fillRoundedRect(PAD, PAD, 64, 64, RADIUS.button);
    g.fillStyle(cat, 0.16).fillCircle(PAD + 32, PAD + 32, 28);
    g.lineStyle(1.5, cat, 0.8).strokeRoundedRect(PAD + 0.5, PAD + 0.5, 63, 63, RADIUS.button);
    const turret3 = t.tiers[0] === 3 || t.tiers[1] === 3;
    this.portraitBase.setTexture(def.sprite.base);
    this.portraitTurret.setVisible(!!def.sprite.turret);
    if (def.sprite.turret) {
      const key = turret3 && this.ctx.scene.textures.exists(`${def.sprite.turret}-t3`) ? `${def.sprite.turret}-t3` : def.sprite.turret;
      this.portraitTurret.setTexture(key);
    }
    this.name.setText(def.name);
    const fit = SIDEBAR_INNER - PAD - 80 - 56;
    this.name.setScale(this.name.width > fit ? fit / this.name.width : 1);
    keyStats(def, t.stats).forEach((line, i) => {
      const cell = this.cells[i];
      if (!cell) return;
      cell.icon.setTexture(line.icon).setDisplaySize(24, 24);
      cell.label.setText(line.label.toUpperCase());
      cell.value.setText(line.value);
      const maxW = CELL_W - 50;
      cell.value.setScale(cell.value.width > maxW ? maxW / cell.value.width : 1);
    });
    const aims = usesTargetMode(def);
    this.target.setVisible(aims);
    if (aims) this.target.setValue(t.targetMode, this.open);
    this.noTarget.setVisible(!aims).setText(
      def.behavior === 'income' ? 'Pays out when a wave is cleared' : def.behavior === 'support' ? 'Boosts towers in its radius' : 'Hits everything that comes close',
    );
    const heli = def.behavior === 'heli';
    this.patrol.setVisible(heli);
    if (heli) {
      this.sell.setButtonSize(CELL_W, SELL_H).setX(PAD + CELL_W / 2);
      this.patrol.setX(PAD + CELL_W + space(1) + CELL_W / 2);
    } else this.sell.setButtonSize(UPGRADE_W, SELL_H).setX(PAD + UPGRADE_W / 2);
    this.subLabel = '';
    this.refreshSub();
    this.refreshButtons();
  }

  private refreshSub(): void {
    const t = this.tower();
    if (!t) return;
    const cat = t.def.category.toUpperCase();
    const label = `${cat}  ·  ${formatNumber(t.kills)} kills  ·  ${t.tiers[0]}-${t.tiers[1]}`;
    if (label !== this.subLabel) {
      this.subLabel = label;
      this.sub.setText(label);
    }
  }

  /** Upgrade states and sell value (money, phase or tiers changed). */
  private refreshButtons(): void {
    const t = this.tower();
    if (!t || this.uid === null) return;
    const sim = this.ctx.c.sim;
    for (const path of [0, 1] as const) {
      const { state, cost } = upgradeButtonState(sim.canUpgrade(this.uid, path));
      this.upgrades[path].bindPath(t.def, path, t.tiers[path], state, cost);
    }
    const value = sim.sellValueOf(this.uid);
    const full = value >= t.spent;
    const armed = this.sellArmed > 0;
    const compact = t.def.behavior === 'heli';
    this.sell.setLabel(armed ? (compact ? 'Confirm' : `Tap again: +${formatNumber(value)}`) : `Sell  +${formatNumber(value)}${full && !compact ? '  (full)' : ''}`);
    this.sell.setSelected(armed);
  }

  private buy(path: 0 | 1): void {
    if (this.uid === null) return;
    const c = this.ctx.c;
    const check = c.sim.canUpgrade(this.uid, path);
    if (check && !check.ok && check.reason === 'money') {
      this.ctx.toasts.show({
        title: 'Not enough money', body: `This upgrade costs ${formatNumber(check.cost ?? 0)} coins.`, kind: 'danger', icon: 'icon-coin',
      });
      return;
    }
    if (c.upgrade(this.uid, path)) {
      const btn = this.upgrades[path];
      this.ctx.scene.tweens.add({ targets: btn.content, scale: { from: 1.06, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    }
  }

  private sellTap(): void {
    if (this.uid === null) return;
    if (this.sellArmed <= 0) {
      this.sellArmed = SELL_CONFIRM_MS;
      this.refreshButtons();
      return;
    }
    this.sellArmed = 0;
    this.ctx.c.sell(this.uid);
  }
}
