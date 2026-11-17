import type { TowerBehavior } from './types';

/**
 * Coin Factory: pays `income` plus interest (`interest.rate` × money, at most `interest.cap`)
 * at each wave clear, emitting an 'income' event for the coin pop.
 */
export const incomeBehavior: TowerBehavior = {
  update() {},
  onWaveCleared(t, ctx) {
    const i = t.stats.interest;
    const interest = i && i.rate > 0 ? Math.min(i.cap, Math.floor(ctx.money * i.rate)) : 0;
    const amount = Math.round(t.stats.income ?? 0) + interest;
    if (amount <= 0) return;
    ctx.addMoney(amount);
    ctx.events.push({ type: 'income', uid: t.uid, towerId: t.def.id, x: t.x, y: t.y, amount });
  },
};
