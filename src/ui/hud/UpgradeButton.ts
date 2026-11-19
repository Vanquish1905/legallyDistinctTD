import Phaser from 'phaser';
import type { TowerDef } from '../../sim/types';
import { MAX_TIER } from '../../sim/TowerState';
import { Button } from '../Button';
import { CSS, FONT, UI, cssColor, textStyle } from '../theme';
import { formatNumber, type UpgradeButtonState } from './hudModel';

/** Upgrade button size (px). */
export const UPGRADE_W = 316;
export const UPGRADE_H = 112;

/**
 * One upgrade path of the tower panel: path colour stripe, path name with tier pips, the next
 * tier's name and description, and a cost / LOCKED / MAXED tag. States: buy (gold), too
 * expensive (red cost, still clickable to explain), locked by the 3-2 rule, maxed.
 */
export class UpgradeButton extends Button {
  private readonly deco: Phaser.GameObjects.Graphics;
  private readonly pathName: Phaser.GameObjects.Text;
  private readonly tierName: Phaser.GameObjects.Text;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly tag: Phaser.GameObjects.Text;
  private readonly tagIcon: Phaser.GameObjects.Image;
  private readonly keyHint: Phaser.GameObjects.Text;
  private shownState: UpgradeButtonState = 'buy';

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly color: number, hotkey: string, onClick: () => void) {
    super(scene, x, y, { width: UPGRADE_W, height: UPGRADE_H, variant: 'secondary', onClick });
    const L = -UPGRADE_W / 2;
    const T = -UPGRADE_H / 2;
    this.deco = scene.add.graphics();
    this.pathName = scene.add.text(L + 22, T + 12, '', textStyle(12, { weight: 700, color: cssColor(color) }));
    this.tierName = scene.add.text(L + 22, T + 32, '', textStyle(FONT.md + 1, { weight: 700 }));
    this.desc = scene.add.text(L + 22, T + 60, '', textStyle(FONT.xs, { color: CSS.textDim, wrap: UPGRADE_W - 40, lineSpacing: 2 }));
    this.tag = scene.add.text(-L - 14, T + 22, '', textStyle(FONT.md, { weight: 700, color: CSS.gold })).setOrigin(1, 0.5);
    this.tagIcon = scene.add.image(0, T + 22, 'icon-coin').setDisplaySize(22, 22);
    this.keyHint = scene.add.text(-L - 12, -T - 10, hotkey, textStyle(12, { weight: 700, color: CSS.textMute })).setOrigin(1, 1);
    this.content.add([this.deco, this.pathName, this.tierName, this.desc, this.tag, this.tagIcon, this.keyHint]);
  }

  /** Show path `path` of `def` at `tier` (tiers bought) in `state` with `cost`. */
  bindPath(def: TowerDef, path: 0 | 1, tier: number, state: UpgradeButtonState, cost: number | null): void {
    const p = def.paths[path];
    const next = p.tiers[Math.min(tier, MAX_TIER - 1)];
    this.shownState = state;
    this.pathName.setText(p.name.toUpperCase());
    this.tierName.setText(state === 'maxed' ? (p.tiers[MAX_TIER - 1]?.name ?? '') : (next?.name ?? ''));
    let desc = next?.description ?? '';
    if (state === 'locked') desc = 'Locked: only one path can go past tier 2.';
    else if (state === 'maxed') desc = 'Fully upgraded. Signature ability unlocked.';
    this.desc.setText(desc);
    const tagColor = state === 'buy' ? CSS.gold : state === 'money' ? CSS.danger : state === 'maxed' ? CSS.ok : CSS.textMute;
    this.tag.setText(state === 'locked' ? 'LOCKED' : state === 'maxed' ? 'MAXED' : formatNumber(cost ?? 0)).setColor(tagColor);
    const icon = state === 'locked' ? 'icon-lock' : state === 'maxed' ? 'icon-check' : 'icon-coin';
    this.tagIcon.setTexture(icon).setDisplaySize(22, 22).setX(this.tag.x - this.tag.width - 16).setAlpha(state === 'money' ? 0.6 : 1);
    // Pips sit after the path name.
    const g = this.deco;
    const L = -UPGRADE_W / 2;
    const T = -UPGRADE_H / 2;
    g.clear();
    g.fillStyle(this.color, state === 'locked' ? 0.3 : 0.95).fillRoundedRect(L + 6, T + 10, 5, UPGRADE_H - 20, 2.5);
    const px = L + 22 + this.pathName.width + 12;
    for (let i = 0; i < MAX_TIER; i++) {
      const cx = px + i * 16;
      const cy = T + 19;
      if (i < tier) g.fillStyle(this.color, 1).fillCircle(cx, cy, 5);
      else g.lineStyle(1.5, this.color, 0.5).strokeCircle(cx, cy, 4.5);
    }
    if (state === 'buy') {
      g.fillStyle(UI.gold, 0.08).fillRoundedRect(this.tagIcon.x - 18, T + 8, -L - 14 - (this.tagIcon.x - 18) + 4, 28, 8);
    }
    this.setEnabled(state === 'buy' || state === 'money');
    this.redraw();
  }

  get upgradeState(): UpgradeButtonState {
    return this.shownState;
  }

  protected override redraw(): void {
    super.redraw();
    // Affordable upgrades get a green outline so the eye finds them.
    if (this.shownState === 'buy' && this.isEnabled) {
      const x = -this.bw / 2;
      const y = -this.bh / 2;
      this.bg.lineStyle(this.isHovered ? 2 : 1.5, UI.ok, this.isHovered ? 1 : 0.7).strokeRoundedRect(x + 1, y + 1, this.bw - 2, this.bh - 2, 12);
    }
    if (this.shownState === 'maxed') this.content.setAlpha(0.85);
  }
}
