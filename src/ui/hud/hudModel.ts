/**
 * Pure HUD logic (no Phaser, unit tested): tower list filtering and hotkeys, card and upgrade
 * button states, stat formatting, wave/boss labels and enemy hints.
 */
import type { DamageType, EnemyDef, TowerDef, TowerStats } from '../../sim/types';
import type { UpgradeCheck } from '../../sim/upgrades';
import type { WavePreview } from '../../sim/WaveSource';
import { TOWER_ORDER, TOWERS, type TowerId } from '../../data/towers';

/** Category tab ids ('all' plus the tower categories). */
export type TowerCategory = 'all' | TowerDef['category'];

/** Tabs of the tower selector, in display order. */
export const TOWER_CATEGORIES: readonly { id: TowerCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'basic', label: 'Basic' },
  { id: 'magic', label: 'Magic' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'support', label: 'Support' },
];

/** Tower ids shown under `category`, in shop order. */
export function towersInCategory(category: TowerCategory): TowerId[] {
  return TOWER_ORDER.filter((id) => category === 'all' || TOWERS[id].category === category);
}

const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Hotkey label of a tower (the first ten in shop order get 1-9, 0), or null. */
export function hotkeyLabel(towerId: string): string | null {
  const i = (TOWER_ORDER as readonly string[]).indexOf(towerId);
  return HOTKEYS[i] ?? null;
}

/** How a tower card looks: buyable, too expensive or not unlocked yet. */
export type CardState = 'ok' | 'expensive' | 'locked';

/** Card state from price, money and unlock wave. */
export function cardState(cost: number, money: number, unlockWave: number | undefined, wave: number): CardState {
  if (unlockWave !== undefined && wave < unlockWave) return 'locked';
  return cost <= money ? 'ok' : 'expensive';
}

/** State of an upgrade button. */
export type UpgradeButtonState = 'buy' | 'money' | 'locked' | 'maxed';

/** Upgrade button state from the sim's `canUpgrade` verdict (null = unknown tower → maxed look). */
export function upgradeButtonState(check: UpgradeCheck | null): { state: UpgradeButtonState; cost: number | null } {
  if (!check) return { state: 'maxed', cost: null };
  if (check.ok) return { state: 'buy', cost: check.cost };
  if (check.reason === 'money') return { state: 'money', cost: check.cost };
  return { state: check.reason, cost: null };
}

/** Thousands separators: 12345 → "12,345". */
export function formatNumber(n: number): string {
  const v = Math.round(n);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return v < 0 ? `-${s}` : s;
}

/** Compact number for tight spots: 950 → "950", 12500 → "12.5k", 2300000 → "2.3M". */
export function formatCompact(n: number): string {
  const a = Math.abs(n);
  if (a < 10_000) return formatNumber(n);
  if (a < 1_000_000) return `${trim1(n / 1000)}k`;
  return `${trim1(n / 1_000_000)}M`;
}

function trim1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

/** "Wave 3 / 40", or "Wave 45" in freeplay. */
export function waveLabel(wave: number, total: number, freeplay: boolean): string {
  return freeplay ? `Wave ${wave}` : `Wave ${wave} / ${total}`;
}

/** One stat shown in the tower panel. */
export interface StatLine {
  /** Texture key of the stat icon. */
  icon: string;
  label: string;
  value: string;
}

const DOT_NAMES: Record<DamageType, string> = {
  fire: 'Burn', poison: 'Poison', ice: 'Frostbite', physical: 'Bleed', explosive: 'Burn', energy: 'Shock',
};

const TYPE_NAMES: Record<DamageType, string> = {
  physical: 'Physical', explosive: 'Explosive', fire: 'Fire', ice: 'Ice', energy: 'Energy', poison: 'Poison',
};

function num(v: number): string {
  return Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1);
}

/** Every special trait of a tower's stats, most important first (for tooltips and the panel). */
export function specialStats(s: TowerStats): string[] {
  const out: string[] = [];
  if (s.income) out.push(`+${num(s.income)} coins / wave`);
  if (s.interest && s.interest.rate > 0) out.push(`${num(s.interest.rate * 100)}% interest`);
  if (s.buff) {
    if (s.buff.range) out.push(`+${num(s.buff.range * 100)}% range aura`);
    if (s.buff.cooldownMul < 1) out.push(`+${num((1 / s.buff.cooldownMul - 1) * 100)}% fire rate aura`);
    if (s.buff.revealStealth) out.push('Reveals stealth');
  }
  if (s.chain) out.push(`Chains ×${num(s.chain.jumps)}`);
  if (s.ramp) out.push(`Ramps to ×${num(s.ramp.max)}`);
  if (s.dot) out.push(`${DOT_NAMES[s.dot.type]} ${num(s.dot.dps)}/s`);
  if (s.slow) out.push(`Slow ${num((1 - s.slow.factor) * 100)}%`);
  if (s.stun) out.push(`Stun ${num(s.stun)} s`);
  if (s.knockback) out.push(`Knockback ${num(s.knockback)}`);
  if (s.splashRadius > 0) out.push(`Splash ${num(s.splashRadius)}`);
  if (s.charges) out.push(`${num(s.charges)} spikes`);
  if (s.flight) out.push(`Patrols ${num(s.flight.leash)} px`);
  if (s.pierce > 1) out.push(`Pierce ${num(s.pierce)}`);
  if (s.canHitStealth && !s.buff) out.push('Sees stealth');
  if (!s.canHitFlying) out.push('Ground only');
  return out;
}

/** Whether a behaviour aims at targets (so the target mode control applies). */
export function usesTargetMode(def: TowerDef): boolean {
  const b = def.behavior ?? 'projectile';
  return b !== 'income' && b !== 'support' && b !== 'trap' && b !== 'aura';
}

/** The four key stats of the tower panel: damage, rate, range and the top special. */
export function keyStats(def: TowerDef, s: TowerStats): StatLine[] {
  const passive = def.behavior === 'income' || def.behavior === 'support';
  const shots = s.shots ?? 1;
  const dmg = passive ? '—' : shots > 1 ? `${num(s.damage)} ×${num(shots)}` : num(s.damage);
  const rate = passive || s.cooldown <= 0 ? '—' : `${num(shots / s.cooldown)}/s`;
  const range = def.behavior === 'income' ? '—' : num(s.buff?.radius ?? s.range);
  const special = specialStats(s)[0] ?? TYPE_NAMES[s.damageType];
  return [
    { icon: 'icon-skull', label: 'Damage', value: dmg },
    { icon: 'icon-speed2', label: 'Rate', value: rate },
    { icon: 'icon-target', label: def.behavior === 'support' ? 'Radius' : 'Range', value: range },
    { icon: 'icon-star', label: 'Special', value: special },
  ];
}

/** Damage type display name. */
export function damageTypeName(t: DamageType): string {
  return TYPE_NAMES[t];
}

/** One chip of the next-wave preview. */
export interface PreviewChip {
  enemy: string;
  count: number;
  isNew: boolean;
}

/**
 * Chips for a wave preview: the boss first (if any), then the biggest groups, at most `max`
 * chips; `more` counts the enemy types left out.
 */
export function previewChips(preview: WavePreview | null, max: number): { chips: PreviewChip[]; more: number; boss: string | null } {
  if (!preview) return { chips: [], more: 0, boss: null };
  const sorted = preview.groups
    .filter((g) => g.enemy !== preview.boss)
    .sort((a, b) => b.count - a.count);
  const slots = Math.max(0, max - (preview.boss ? 1 : 0));
  const chips: PreviewChip[] = [];
  if (preview.boss) chips.push({ enemy: preview.boss, count: 1, isNew: false });
  for (const g of sorted.slice(0, slots)) {
    chips.push({ enemy: g.enemy, count: g.count, isNew: preview.newEnemies.includes(g.enemy) });
  }
  return { chips, more: Math.max(0, sorted.length - slots), boss: preview.boss ?? null };
}

/** Short counter-play hint for a "New enemy" toast. */
export function enemyHint(def: EnemyDef): string {
  const t = def.traits;
  if (t.includes('stealth')) return 'needs detection!';
  if (t.includes('flying')) return 'flies over traps and mortars!';
  if (t.includes('burrower')) return 'hides underground!';
  if (t.includes('shielder')) return 'shields its friends!';
  if (t.includes('healer')) return 'heals its friends!';
  if (t.includes('slowImmune')) return 'ignores slows, weak to fire!';
  if (t.includes('regen')) return 'regenerates!';
  if (t.includes('splitter')) return 'splits when popped!';
  if (t.includes('armored')) return 'armored, hit it hard!';
  if (def.speed >= 120) return 'very fast!';
  return 'watch out!';
}

/** HP fractions (0..1, exclusive) where a boss changes phase, for the boss bar markers. */
export function bossPhaseMarkers(def: EnemyDef): number[] {
  const a = def.ability;
  if (!a || a.kind !== 'bossPhases') return [];
  return a.phases.map((p) => p.hpFraction).filter((f) => f > 0 && f < 1);
}
