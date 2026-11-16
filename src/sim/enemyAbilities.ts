import type { EnemyAbilityDef } from './types';
import type { EnemyState } from './EnemyState';
import type { SimContext } from './SimContext';

type AbilityKind = EnemyAbilityDef['kind'];
type AbilityOf<K extends AbilityKind> = Extract<EnemyAbilityDef, { kind: K }>;

/** Per-tick logic of one ability kind. Runtime state lives in `enemy.ability`. */
export type AbilityHandler<K extends AbilityKind> = (
  enemy: EnemyState, ability: AbilityOf<K>, ctx: SimContext, dt: number,
) => void;

/** One handler per ability kind (adding a kind to `EnemyAbilityDef` forces a handler here). */
export type AbilityRegistry = { [K in AbilityKind]: AbilityHandler<K> };

/** Spacing of summoned enemies behind their summoner (px). */
const SUMMON_SPACING = 12;
const allies: EnemyState[] = [];

/** Count the ability timer down; true (and re-armed) when it fires. */
function every(enemy: EnemyState, interval: number, dt: number): boolean {
  enemy.ability.timer -= dt;
  if (enemy.ability.timer > 0) return false;
  enemy.ability.timer += interval;
  return true;
}

export const ENEMY_ABILITIES: AbilityRegistry = {
  shieldAura(enemy, a, ctx, dt) {
    if (!every(enemy, a.interval, dt)) return;
    for (const ally of ctx.queryEnemies(enemy.x, enemy.y, a.radius, allies)) {
      if (ally !== enemy) ally.shield = Math.max(ally.shield, a.amount);
    }
  },
  healAura(enemy, a, ctx, dt) {
    if (!every(enemy, a.interval, dt)) return;
    for (const ally of ctx.queryEnemies(enemy.x, enemy.y, a.radius, allies)) {
      ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * a.fraction);
    }
  },
  burrow(enemy, a, _ctx, dt) {
    if (!every(enemy, enemy.burrowed ? a.interval : a.duration, dt)) return;
    enemy.burrowed = !enemy.burrowed;
  },
  spawn(enemy, a, ctx, dt) {
    if (!every(enemy, a.interval, dt)) return;
    for (let i = 1; i <= a.count; i++) {
      ctx.spawnEnemy(a.enemyId, enemy.pathIndex, enemy.distance - i * SUMMON_SPACING, enemy.wave);
    }
  },
  enrage(enemy, a) {
    const lost = 1 - enemy.hp / enemy.maxHp;
    enemy.ability.speedMul = 1 + (a.maxSpeedMul - 1) * lost;
  },
  bossPhases(enemy, a, ctx, dt) {
    const rt = enemy.ability;
    let next = a.phases[rt.phase];
    while (next && enemy.hp / enemy.maxHp <= next.hpFraction) {
      rt.phase++;
      if (next.speedMul !== undefined) rt.speedMul = next.speedMul;
      if (next.armor !== undefined) enemy.armor = next.armor;
      rt.timer = next.ability && 'interval' in next.ability ? next.ability.interval : 0;
      ctx.events.push({ type: 'bossPhase', uid: enemy.uid, enemyId: enemy.def.id, phase: rt.phase });
      next = a.phases[rt.phase];
    }
    const current = rt.phase > 0 ? a.phases[rt.phase - 1]?.ability : undefined;
    if (current) updateAbility(enemy, current, ctx, dt);
  },
};

/** Arm the ability timer of a freshly spawned enemy. */
export function initAbility(enemy: EnemyState): void {
  const a = enemy.def.ability;
  if (a && 'interval' in a) enemy.ability.timer = a.interval;
}

/** Run the handler registered for `ability.kind`. */
export function updateAbility(enemy: EnemyState, ability: EnemyAbilityDef, ctx: SimContext, dt: number): void {
  const handler = ENEMY_ABILITIES[ability.kind] as (e: EnemyState, a: EnemyAbilityDef, c: SimContext, d: number) => void;
  handler(enemy, ability, ctx, dt);
}
