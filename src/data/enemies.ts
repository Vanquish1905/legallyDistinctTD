import type { EnemyDef } from '../sim/types';
import { BOSSES, BOSS_IDS, type BossId } from './bosses';

/** Regular enemy ids, roughly in the order the player meets them. */
export const ENEMY_IDS = [
  'larva', 'mite', 'tick', 'leech', 'spore', 'sporelet', 'phantom', 'beetle', 'swarmling', 'jelly',
  'shieldbug', 'medic', 'burrower', 'gnat',
] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

/**
 * Regular parasites. HP and speed are before difficulty and wave multipliers. Legacy
 * EnemyLevel1-6 live on as Larva, Mite, Tick, Leech, Spore and Beetle.
 */
const REGULAR: Readonly<Record<EnemyId, EnemyDef>> = {
  larva: {
    id: 'larva', name: 'Larva',
    description: 'A squishy little wriggler. Harmless alone, annoying in bulk.',
    hp: 20, speed: 70, armor: 0, reward: 3, leakDamage: 1, radius: 18,
    traits: [], sprite: 'enemy-larva',
  },
  mite: {
    id: 'mite', name: 'Mite',
    description: 'Tiny, twitchy and twice as fast as a Larva. Gatlings love these.',
    hp: 14, speed: 140, armor: 0, reward: 3, leakDamage: 1, radius: 14,
    traits: [], sprite: 'enemy-mite',
  },
  tick: {
    id: 'tick', name: 'Tick',
    description: 'Wears a little shell. Armor shaves damage off every bullet, so hit it hard, not often.',
    hp: 90, speed: 60, armor: 4, reward: 6, leakDamage: 2, radius: 20,
    traits: ['armored'], sprite: 'enemy-tick',
  },
  leech: {
    id: 'leech', name: 'Leech',
    description: 'Slowly regrows what you shoot off. Finish it quickly or it keeps coming back for seconds.',
    hp: 140, speed: 65, armor: 0, reward: 8, leakDamage: 2, radius: 20,
    traits: ['regen'], sprite: 'enemy-leech',
  },
  spore: {
    id: 'spore', name: 'Spore',
    description: 'A bloated pod. Pop it and three Sporelets come tumbling out.',
    hp: 180, speed: 55, armor: 0, reward: 6, leakDamage: 2, radius: 24,
    traits: ['splitter'], onDeath: { spawn: 'sporelet', count: 3 }, sprite: 'enemy-spore',
  },
  sporelet: {
    id: 'sporelet', name: 'Sporelet',
    description: 'Spore shrapnel with legs. Small, quick and very much still your problem.',
    hp: 40, speed: 95, armor: 0, reward: 2, leakDamage: 1, radius: 12,
    traits: [], sprite: 'enemy-sporelet',
  },
  phantom: {
    id: 'phantom', name: 'Phantom',
    description: "Can't be seen without detection. Radar Dish or a sharp-eyed Sniper helps.",
    hp: 160, speed: 90, armor: 0, reward: 10, leakDamage: 2, radius: 18,
    traits: ['stealth'], sprite: 'enemy-phantom',
  },
  beetle: {
    id: 'beetle', name: 'Beetle',
    description: 'A rolling armored wall. Small bullets just bounce off; bring snipers, rails or poison.',
    hp: 900, speed: 45, armor: 8, reward: 25, leakDamage: 4, radius: 30,
    traits: ['armored'], sprite: 'enemy-beetle',
  },
  swarmling: {
    id: 'swarmling', name: 'Swarmling',
    description: 'Barely a snack on its own, but they never come alone. Splash damage is your friend.',
    hp: 8, speed: 160, armor: 0, reward: 1, leakDamage: 1, radius: 10,
    traits: [], sprite: 'enemy-swarmling',
  },
  jelly: {
    id: 'jelly', name: 'Jelly',
    description: 'Wobbly goo that ignores slows and soaks up most hits. It melts nicely, though: bring fire.',
    hp: 1200, speed: 50, armor: 0, reward: 30, leakDamage: 3, radius: 26,
    resist: { physical: 0.6, explosive: 0.7, ice: 0.5, energy: 0.8, poison: 0.7 },
    traits: ['slowImmune'], sprite: 'enemy-jelly',
  },
  shieldbug: {
    id: 'shieldbug', name: 'Shieldbug',
    description: 'Projects bubble shields onto its friends. Take it out first or everything gets tougher.',
    hp: 650, speed: 55, armor: 2, reward: 20, leakDamage: 3, radius: 22,
    traits: ['shielder'], ability: { kind: 'shieldAura', radius: 110, amount: 60, interval: 3 },
    sprite: 'enemy-shieldbug',
  },
  medic: {
    id: 'medic', name: 'Medic Mite',
    description: 'Carries a tiny first-aid kit and patches up everyone nearby. Rude.',
    hp: 450, speed: 70, armor: 0, reward: 16, leakDamage: 2, radius: 18,
    traits: ['healer'], ability: { kind: 'healAura', radius: 120, fraction: 0.08, interval: 2 },
    sprite: 'enemy-medic',
  },
  burrower: {
    id: 'burrower', name: 'Burrower',
    description: 'Dives underground now and then, where nothing can touch it. Cover a long stretch of path.',
    hp: 1800, speed: 60, armor: 4, reward: 40, leakDamage: 5, radius: 24,
    traits: ['burrower', 'armored'], ability: { kind: 'burrow', interval: 2.5, duration: 1.5 },
    sprite: 'enemy-burrower',
  },
  gnat: {
    id: 'gnat', name: 'Gnat Cloud',
    description: 'A buzzing cloud that flies over traps and mortar shells. Needs towers that can aim up.',
    hp: 120, speed: 100, armor: 0, reward: 8, leakDamage: 2, radius: 20,
    traits: ['flying'], sprite: 'enemy-gnat',
  },
};

/** Every enemy the sim can spawn, regular parasites and bosses, by id. */
export const ENEMIES: Readonly<Record<EnemyId | BossId, EnemyDef>> = { ...REGULAR, ...BOSSES };

/** Whether `id` names a boss. */
export function isBoss(id: string): id is BossId {
  return (BOSS_IDS as readonly string[]).includes(id);
}

export { BOSS_IDS, type BossId };
