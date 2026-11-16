import type { SimEventQueue } from './events';

/** Fraction of total spend refunded when selling. */
export const SELL_RATIO = 0.7;

/**
 * Sell value of a tower: 70% of everything spent on it (cost + upgrades), or 100% when it is
 * sold in the same build phase it was placed in, before any wave started.
 */
export function sellValue(spent: number, sameBuildPhase: boolean): number {
  return sameBuildPhase ? spent : Math.floor(spent * SELL_RATIO);
}

/** Price after the difficulty cost multiplier (rounded to whole coins). */
export function scaledCost(base: number, costMul: number): number {
  return Math.round(base * costMul);
}

/** The player's wallet. Every change emits a 'moneyChanged' event. */
export class Economy {
  private value: number;

  constructor(private readonly events: SimEventQueue, start: number) {
    this.value = start;
  }

  get money(): number {
    return this.value;
  }

  /** Whether `amount` can be paid. */
  canAfford(amount: number): boolean {
    return amount <= this.value;
  }

  /** Pay `amount` if possible. Returns false (and changes nothing) when too poor. */
  trySpend(amount: number): boolean {
    if (amount < 0 || amount > this.value) return false;
    this.change(-amount);
    return true;
  }

  /** Receive `amount` (ignored when not positive). */
  earn(amount: number): void {
    if (amount > 0) this.change(amount);
  }

  private change(delta: number): void {
    if (delta === 0) return;
    this.value += delta;
    this.events.push({ type: 'moneyChanged', money: this.value, delta });
  }
}
