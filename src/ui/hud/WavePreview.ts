import Phaser from 'phaser';
import { TOPBAR_H } from '../../config';
import { ENEMIES } from '../../data/enemies';
import type { EnemyDef } from '../../sim/types';
import { bindTooltip } from '../Tooltip';
import { CSS, FONT, RADIUS, UI, textStyle } from '../theme';
import { enemyHint, formatCompact, previewChips, type PreviewChip } from './hudModel';
import type { HudContext, HudWidget } from './HudContext';

const CHIP = 48;
const BOSS_W = 104;
const GAP = 6;
const MAX_CHIPS = 6;
const LABEL_W = 64;

interface ChipView {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  data: PreviewChip | null;
  w: number;
}

/**
 * Next-wave preview strip in the top bar centre: enemy icons with counts, "NEW" tags, a red boss
 * chip, and a tooltip per chip. Recomputed only when the wave changes (preview() allocates).
 */
export class WavePreview implements HudWidget {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly chips: ChipView[] = [];
  private readonly unbind: (() => void)[] = [];
  private shownWave = -1;

  constructor(private readonly ctx: HudContext, private readonly left: number, private readonly right: number) {
    const s = ctx.scene;
    this.root = s.add.container(0, 0).setDepth(101);
    this.title = s.add.text(left, TOPBAR_H / 2 - 11, 'NEXT', textStyle(FONT.xs - 1, { weight: 700, color: CSS.textMute })).setOrigin(0, 0.5);
    this.sub = s.add.text(left, TOPBAR_H / 2 + 9, '', textStyle(FONT.md, { weight: 700, color: CSS.text })).setOrigin(0, 0.5);
    this.root.add([this.title, this.sub]);
    for (let i = 0; i < MAX_CHIPS; i++) this.chips.push(this.makeChip());
    ctx.listen('waveChanged', () => this.refresh());
    this.refresh();
  }

  destroy(): void {
    for (const u of this.unbind) u();
    this.unbind.length = 0;
    this.root.destroy();
  }

  private makeChip(): ChipView {
    const s = this.ctx.scene;
    const root = s.add.container(0, TOPBAR_H / 2).setVisible(false);
    const bg = s.add.graphics();
    const icon = s.add.image(0, 0, 'enemy-larva');
    const count = s.add
      .text(0, 0, '', { ...textStyle(FONT.xs, { weight: 700, color: '#ffffff' }), stroke: '#0b101b', strokeThickness: 4 })
      .setOrigin(1, 1);
    const tag = s.add.text(0, 0, '', textStyle(11, { weight: 700, color: CSS.dark })).setOrigin(0.5);
    const zone = s.add.zone(0, 0, CHIP, CHIP).setInteractive();
    root.add([bg, icon, count, tag, zone]);
    this.root.add(root);
    const chip: ChipView = { root, bg, icon, count, tag, zone, data: null, w: CHIP };
    this.unbind.push(bindTooltip(zone, this.ctx.tooltip, {
      side: 'bottom',
      content: () => (chip.data ? enemyTooltip(chip.data) : null),
      anchor: () => ({ x: root.x - chip.w / 2, y: TOPBAR_H / 2 - CHIP / 2, w: chip.w, h: CHIP }),
    }));
    return chip;
  }

  private refresh(): void {
    const sim = this.ctx.c.sim;
    if (sim.wave === this.shownWave && sim.phase !== 'won' && sim.phase !== 'lost') return;
    this.shownWave = sim.wave;
    const can = sim.canStartNextWave();
    const { chips, more, boss } = previewChips(can ? sim.previewWave() : null, MAX_CHIPS);
    this.sub.setText(can ? `Wave ${sim.wave + 1}` : sim.phase === 'won' ? 'Victory' : sim.phase === 'lost' ? '—' : 'Last wave');
    this.title.setText(boss ? 'BOSS' : 'NEXT').setColor(boss ? CSS.danger : CSS.textMute);
    let x = this.left + LABEL_W + 8;
    for (let i = 0; i < this.chips.length; i++) {
      const v = this.chips[i] as ChipView;
      const data = chips[i];
      if (!data || x + CHIP > this.right) {
        v.data = null;
        v.root.setVisible(false);
        continue;
      }
      const isBoss = data.enemy === boss;
      const w = isBoss ? BOSS_W : CHIP;
      const last = i === chips.length - 1 && more > 0;
      this.fillChip(v, data, w, isBoss, last ? more : 0);
      v.root.setPosition(x + w / 2, TOPBAR_H / 2).setVisible(true);
      x += w + GAP;
    }
  }

  private fillChip(v: ChipView, data: PreviewChip, w: number, isBoss: boolean, more: number): void {
    v.data = data;
    v.w = w;
    const def = ENEMIES[data.enemy as keyof typeof ENEMIES] as EnemyDef | undefined;
    const g = v.bg;
    g.clear();
    g.fillStyle(isBoss ? 0x3a1222 : UI.track, isBoss ? 0.95 : 0.75).fillRoundedRect(-w / 2, -CHIP / 2, w, CHIP, RADIUS.chip);
    g.lineStyle(isBoss ? 2 : 1, isBoss ? UI.danger : data.isNew ? UI.accent : UI.border, 1)
      .strokeRoundedRect(-w / 2 + 0.5, -CHIP / 2 + 0.5, w - 1, CHIP - 1, RADIUS.chip);
    const iconSize = isBoss ? 42 : 38;
    const ix = isBoss ? -w / 2 + 26 : 0;
    v.icon.setTexture(def?.sprite ?? 'enemy-larva').setDisplaySize(iconSize, iconSize).setPosition(ix, 0);
    v.zone.setSize(w, CHIP);
    v.zone.input?.hitArea.setTo(0, 0, w, CHIP);
    if (isBoss) {
      v.count.setText('BOSS').setOrigin(0, 0.5).setPosition(ix + 24, 0).setColor(CSS.danger).setFontSize(FONT.sm);
      v.tag.setVisible(false);
      return;
    }
    v.count.setOrigin(1, 1).setPosition(w / 2 - 3, CHIP / 2 - 1).setColor('#ffffff').setFontSize(FONT.xs);
    v.count.setText(more > 0 ? `×${data.count} +${more}` : `×${data.count}`);
    v.tag.setVisible(data.isNew);
    if (data.isNew) {
      v.tag.setText('NEW').setPosition(0, -CHIP / 2);
      g.fillStyle(UI.accent, 1).fillRoundedRect(-17, -CHIP / 2 - 8, 34, 16, 8);
    }
  }
}

/** Tooltip content for an enemy chip. */
function enemyTooltip(chip: PreviewChip): { title: string; subtitle: string; subtitleColor: number; body: string; lines: string[] } | null {
  const def = ENEMIES[chip.enemy as keyof typeof ENEMIES] as EnemyDef | undefined;
  if (!def) return null;
  const boss = def.traits.includes('boss');
  const lines = [`${formatCompact(def.hp)} HP  ·  speed ${def.speed}`];
  if (def.armor > 0) lines.push(`Armor ${def.armor}`);
  if (!boss) lines.push(`Tip: ${enemyHint(def)}`);
  return {
    title: def.name,
    subtitle: boss ? 'BOSS' : chip.isNew ? `NEW  ·  ×${chip.count}` : `×${chip.count}`,
    subtitleColor: boss ? UI.danger : UI.accent,
    body: def.description,
    lines,
  };
}
