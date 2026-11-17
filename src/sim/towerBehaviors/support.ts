import type { TowerBehavior } from './types';

/**
 * Radar-style support: in `prepare`, every non-support tower within `buff.radius` gets
 * range ×(1 + buff.range) and cooldown ×buff.cooldownMul. Buffs do not stack: the strongest wins.
 * (Stealth reveal is applied by the core from `buff.revealStealth`.)
 */
export const supportBehavior: TowerBehavior = {
  prepare(t, ctx) {
    const b = t.stats.buff;
    if (!b) return;
    const r2 = b.radius * b.radius;
    for (const o of ctx.towers) {
      if (o === t || o.behavior === 'support' || o.behavior === 'income') continue;
      if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 > r2) continue;
      o.buffRangeMul = Math.max(o.buffRangeMul, 1 + b.range);
      o.buffCooldownMul = Math.min(o.buffCooldownMul, b.cooldownMul);
    }
  },
  update() {},
};
