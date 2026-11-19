import Phaser from 'phaser';
import { FIELD_W, GAME_H, GAME_W, SIDEBAR_W } from '../../config';
import { TOWERS, type TowerId } from '../../data/towers';
import type { TowerDef } from '../../sim/types';
import { ScrollList } from '../ScrollList';
import { SegmentedControl } from '../SegmentedControl';
import type { TooltipContent } from '../Tooltip';
import { CSS, FONT, UI, space, textStyle } from '../theme';
import { CATEGORY_COLOR, type HudContext, type HudWidget } from './HudContext';
import { CARD_H, TowerCard } from './TowerCard';
import {
  TOWER_CATEGORIES, cardState, damageTypeName, formatNumber, hotkeyLabel, keyStats, specialStats, towersInCategory,
  type TowerCategory,
} from './hudModel';

/** Left edge of sidebar content (px). */
export const SIDEBAR_X = FIELD_W + space(2);
/** Width of sidebar content (px). */
export const SIDEBAR_INNER = SIDEBAR_W - space(4);
const TABS_Y = 76;
const LIST_Y = 140;
const HOVER_DELAY = 320;

/**
 * Right sidebar: background, header, category tabs and the scrollable tower card grid.
 * Tap a card to start placing (tap again to cancel), drag a card onto the field to place it,
 * hover (mouse) or long-press (touch) for a stats tooltip.
 */
export class TowerSelector implements HudWidget {
  readonly list: ScrollList<TowerCard>;
  private readonly root: Phaser.GameObjects.Container;
  private readonly tabs: SegmentedControl<TowerCategory>;
  private readonly count: Phaser.GameObjects.Text;
  private ids: TowerId[] = towersInCategory('all');
  private hoverIndex = -1;
  private hoverTimer: Phaser.Time.TimerEvent | null = null;
  private tipIndex = -1;

  constructor(private readonly ctx: HudContext) {
    const s = ctx.scene;
    const c = ctx.c;
    this.root = s.add.container(0, 0).setDepth(100);
    const bg = s.add.graphics();
    for (let i = 0; i < 6; i++) bg.fillStyle(UI.shadow, 0.09 - i * 0.014).fillRect(FIELD_W - (i + 1) * 3, 0, 3, GAME_H);
    bg.fillStyle(0x0d131f, 0.98).fillRect(FIELD_W, 0, SIDEBAR_W, GAME_H);
    bg.fillStyle(UI.white, 0.025).fillRect(FIELD_W, 0, SIDEBAR_W, 64);
    bg.fillStyle(UI.border, 1).fillRect(FIELD_W, 0, 1, GAME_H);
    const blocker = s.add.zone(FIELD_W, 0, SIDEBAR_W, GAME_H).setOrigin(0, 0).setInteractive();
    const title = s.add.text(SIDEBAR_X, 22, 'Machines', textStyle(FONT.xl, { weight: 700 }));
    this.count = s.add
      .text(GAME_W - space(2), 36, '', textStyle(FONT.xs, { weight: 500, color: CSS.textDim }))
      .setOrigin(1, 0.5);
    this.root.add([bg, blocker, title, this.count]);
    this.tabs = new SegmentedControl<TowerCategory>(s, SIDEBAR_X, TABS_Y, {
      width: SIDEBAR_INNER, height: 48, segments: TOWER_CATEGORIES, value: 'all', fontSize: FONT.sm - 1,
      onChange: (id) => this.setCategory(id),
    });
    this.root.add(this.tabs);

    this.list = new ScrollList<TowerCard>(s, {
      x: SIDEBAR_X, y: LIST_Y, width: SIDEBAR_INNER, height: GAME_H - LIST_Y - space(2),
      columns: 2, itemHeight: CARD_H, gap: space(1), padding: 4,
      create: () => new TowerCard(s),
      bind: (card, i) => this.bindCard(card, i),
      onTap: (i) => this.tap(i),
      onPress: (_i, card, down) => {
        card.press(down);
        if (down) this.hideTip();
      },
      onHover: (i) => this.hover(i),
      onLongPress: (i) => this.showTip(i),
      onDragOut: (i) => {
        this.hideTip();
        const id = this.ids[i];
        if (id) c.beginPlacement(id);
      },
    });
    this.list.setDepth(100);
    this.list.setCount(this.ids.length);
    this.updateCount();

    const refresh = (): void => this.refreshStates();
    ctx.listen('moneyChanged', refresh);
    ctx.listen('waveChanged', refresh);
    ctx.listen('placementChanged', refresh);
  }

  update(dt: number): void {
    this.list.update(dt);
  }

  /** Centre of `towerId`'s card when fully inside the list viewport (e2e hooks). */
  cardCenter(towerId: string): { x: number; y: number } | null {
    const i = (this.ids as string[]).indexOf(towerId);
    if (i < 0) return null;
    const r = this.list.itemRect(i);
    if (r.y < LIST_Y || r.y + r.h > LIST_Y + this.list.viewportHeight) return null;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** Move the list's bottom edge (the tower panel slides over the lower sidebar). */
  setListBottom(y: number): void {
    this.list.setViewportHeight(y - LIST_Y);
  }

  destroy(): void {
    this.hoverTimer?.remove(false);
    this.list.destroy();
    this.tabs.destroy();
    this.root.destroy();
  }

  private setCategory(cat: TowerCategory): void {
    this.hideTip();
    this.ids = towersInCategory(cat);
    this.list.setCount(this.ids.length, true);
    this.updateCount();
  }

  private updateCount(): void {
    this.count.setText(`${this.ids.length} tower${this.ids.length === 1 ? '' : 's'}`);
  }

  private bindCard(card: TowerCard, i: number): void {
    const id = this.ids[i];
    if (!id) return;
    const def = TOWERS[id];
    card.bindTower(def, this.ctx.c.sim.towerCost(id) ?? def.cost);
    this.applyState(card, i);
  }

  private applyState(card: TowerCard, i: number): void {
    const sim = this.ctx.c.sim;
    const def = TOWERS[card.towerId as TowerId] as TowerDef | undefined;
    if (!def) return;
    card.setFlags(
      cardState(card.shownCost, sim.money, def.unlockWave, sim.wave),
      i === this.hoverIndex,
      this.ctx.c.pendingTowerId === card.towerId,
    );
  }

  private refreshStates(): void {
    this.list.forEachVisible((card, i) => this.applyState(card, i));
  }

  private tap(i: number): void {
    const id = this.ids[i];
    if (!id) return;
    this.hideTip();
    const c = this.ctx.c;
    const def = TOWERS[id];
    if (def.unlockWave !== undefined && c.sim.wave < def.unlockWave) {
      this.ctx.toasts.show({ title: `${def.name} is locked`, body: `Unlocks at wave ${def.unlockWave}.`, kind: 'warning', icon: 'icon-lock' });
      return;
    }
    if (c.pendingTowerId === id) c.cancelPlacement();
    else c.beginPlacement(id);
  }

  private hover(i: number): void {
    const prev = this.hoverIndex;
    this.hoverIndex = i;
    const pc = this.list.viewAt(prev);
    if (pc) this.applyState(pc, prev);
    const nc = this.list.viewAt(i);
    if (nc) this.applyState(nc, i);
    this.hoverTimer?.remove(false);
    this.hoverTimer = null;
    if (i < 0) {
      this.hideTip();
      return;
    }
    if (this.tipIndex >= 0) this.showTip(i);
    else this.hoverTimer = this.ctx.scene.time.delayedCall(HOVER_DELAY, () => this.showTip(i));
  }

  private showTip(i: number): void {
    this.hoverTimer = null;
    const id = this.ids[i];
    if (!id) return;
    this.tipIndex = i;
    const r = this.list.itemRect(i);
    this.ctx.tooltip.show(towerTooltip(TOWERS[id], this.ctx.c.sim.towerCost(id) ?? TOWERS[id].cost), r, 'left');
  }

  private hideTip(): void {
    this.hoverTimer?.remove(false);
    this.hoverTimer = null;
    if (this.tipIndex < 0) return;
    this.tipIndex = -1;
    this.ctx.tooltip.hide();
  }
}

/** Tooltip content for a tower card. */
export function towerTooltip(def: TowerDef, cost: number): TooltipContent {
  const stats = keyStats(def, def.stats);
  const [dmg, rate, range] = stats;
  const lines: string[] = [];
  if (dmg && dmg.value !== '—') lines.push(`${dmg.value} ${damageTypeName(def.stats.damageType).toLowerCase()} damage  ·  ${rate?.value ?? ''}`);
  if (range && range.value !== '—') lines.push(`${range.label} ${range.value}`);
  for (const sp of specialStats(def.stats)) lines.push(sp);
  if (def.placement === 'path') lines.push('Placed on the path');
  const hk = hotkeyLabel(def.id);
  const cat = def.category[0]?.toUpperCase() + def.category.slice(1);
  return {
    title: def.name,
    subtitle: `${cat.toUpperCase()}  ·  ${formatNumber(cost)} coins${hk ? `  ·  key ${hk}` : ''}`,
    subtitleColor: CATEGORY_COLOR[def.category],
    body: def.description,
    lines,
  };
}
