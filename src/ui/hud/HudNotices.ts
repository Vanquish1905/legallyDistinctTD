import { ENEMIES } from '../../data/enemies';
import { TOWERS, type TowerId } from '../../data/towers';
import type { EnemyDef } from '../../sim/types';
import { UI } from '../theme';
import type { Banner } from './Banner';
import { enemyHint, formatNumber } from './hudModel';
import type { HudContext, HudWidget } from './HudContext';

/**
 * Turns game events into toasts and banners: rejected placements, first sightings of each
 * enemy type, wave start/clear with bonuses, victory and defeat.
 */
export class HudNotices implements HudWidget {
  private readonly seen = new Set<string>();

  constructor(ctx: HudContext, banner: Banner) {
    const { c, toasts } = ctx;
    // Enemies already on the field (resumed games) are not "new".
    for (const e of c.sim.enemies) this.seen.add(e.def.id);
    ctx.listen('placementRejected', ({ towerId, reason }) => {
      if (reason === 'Not enough money') {
        const cost = c.sim.towerCost(towerId);
        const name = TOWERS[towerId as TowerId]?.name ?? 'That tower';
        toasts.show({
          title: 'Not enough money', body: cost !== undefined ? `${name} costs ${formatNumber(cost)} coins.` : undefined,
          kind: 'danger', icon: 'icon-coin',
        });
      } else if (reason !== 'Game over') {
        toasts.show({ title: "Can't build there", body: reason, kind: 'warning', icon: 'icon-close', key: 'cant-build' });
      }
    });
    ctx.listen('sim', (e) => {
      switch (e.type) {
        case 'enemySpawn': {
          if (e.boss || this.seen.has(e.enemyId)) return;
          this.seen.add(e.enemyId);
          const def = ENEMIES[e.enemyId as keyof typeof ENEMIES] as EnemyDef | undefined;
          if (!def) return;
          toasts.show({
            title: `New enemy: ${def.name} — ${enemyHint(def)}`, body: def.description, kind: 'info', icon: def.sprite,
            duration: 5200, key: `new-${def.id}`,
          });
          return;
        }
        case 'waveStart': {
          const total = c.sim.freeplay ? '' : ` of ${c.sim.difficulty.waves}`;
          if (!e.boss) banner.show(`WAVE ${e.wave}`, e.early && e.bonus > 0 ? `Early start  +${formatNumber(e.bonus)} coins` : `Wave ${e.wave}${total}`, UI.text, 900);
          if (e.early && e.bonus > 0) toasts.show({ title: `Early start bonus +${formatNumber(e.bonus)}`, kind: 'money', key: 'early' });
          return;
        }
        case 'waveCleared':
          toasts.show({
            title: `Wave ${e.wave} cleared`, body: e.bonus > 0 ? `+${formatNumber(e.bonus)} coins bonus` : undefined,
            kind: 'success', icon: 'icon-check', key: 'cleared',
          });
          return;
        default:
          return;
      }
    });
    ctx.listen('gameOver', ({ won, wave }) => {
      if (won) banner.show('VICTORY', `All ${wave} waves held back`, UI.gold, 3200);
      else banner.show('DEFEAT', `The parasites got through on wave ${wave}`, UI.danger, 3200);
    });
  }

  destroy(): void {
    this.seen.clear();
  }
}
