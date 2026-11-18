import type { TowerBehavior } from './types';

/** All Coin Factories together pay at most this much interest per cleared wave. */
export const INTEREST_CAP_PER_WAVE = 600;

/**
 * Coin Factory: pays `income` plus interest (`interest.rate` × money, at most `interest.cap`)
 * at each wave clear, emitting an 'income' event for the coin pop. Interest of all factories
 * combined is capped at `INTEREST_CAP_PER_WAVE`; factories pay in placement order and later ones
 * only get what is left of the cap (tracked in `memory.interestWave` / `memory.interestPaid`).
 */
export const incomeBehavior: TowerBehavior = {
  update() {},
  onWaveCleared(t, ctx, wave) {
    const i = t.stats.interest;
    let interest = i && i.rate > 0 ? Math.min(i.cap, Math.floor(ctx.money * i.rate)) : 0;
    if (interest > 0) {
      let paid = 0;
      for (const other of ctx.towers) {
        if (other !== t && other.memory.interestWave === wave) paid += other.memory.interestPaid ?? 0;
      }
      interest = Math.max(0, Math.min(interest, INTEREST_CAP_PER_WAVE - paid));
    }
    t.memory.interestWave = wave;
    t.memory.interestPaid = interest;
    const amount = Math.round(t.stats.income ?? 0) + interest;
    if (amount <= 0) return;
    ctx.addMoney(amount);
    ctx.events.push({ type: 'income', uid: t.uid, towerId: t.def.id, x: t.x, y: t.y, amount });
  },
};
