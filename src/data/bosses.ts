import type { EnemyDef } from '../sim/types';

/** Boss ids, in the order they first show up (waves 10, 20, 30, 40, 50). */
export const BOSS_IDS = ['queen', 'irontick', 'hivemind', 'colossus', 'omega'] as const;
export type BossId = (typeof BOSS_IDS)[number];

/**
 * Boss definitions. Bosses are ordinary `EnemyDef`s with the 'boss' trait; `ENEMIES` merges them
 * in so the sim finds them in one registry. HP is before difficulty and wave multipliers.
 *
 * Tuning: a boss wave carries roughly 2-3x the HP of the waves before it, and a leaking boss
 * costs a big chunk of lives but (on Easy/Normal) never the whole run. Bosses resist crowd
 * control (see `controlResist` in EnemyState).
 */
export const BOSSES: Readonly<Record<BossId, EnemyDef>> = {
  queen: {
    id: 'queen', name: 'Queen Larva',
    description: 'The mother of all larvae, and she brought the whole family. Pops out fresh larvae every few seconds.',
    hp: 2400, speed: 40, armor: 0, reward: 300, leakDamage: 20, radius: 46,
    traits: ['boss', 'spawner'],
    ability: { kind: 'spawn', enemyId: 'larva', count: 3, interval: 3.5 },
    sprite: 'boss-queen',
  },
  irontick: {
    id: 'irontick', name: 'Iron Tick',
    description: 'A tick in a tank. Bolts on extra plating when hurt, then sheds its shell at half health and sprints.',
    hp: 9000, speed: 34, armor: 4, reward: 600, leakDamage: 30, radius: 48,
    traits: ['boss', 'armored'],
    ability: {
      kind: 'bossPhases', phases: [
        { hpFraction: 0.75, name: 'Plating Up', armor: 7, speedMul: 0.8 },
        { hpFraction: 0.5, name: 'Shell Shed', armor: 0, speedMul: 1.4 },
      ],
    },
    sprite: 'boss-irontick',
  },
  hivemind: {
    id: 'hivemind', name: 'Hive Mind',
    description: 'A floating brain of pure parasite thought. Heals everything around it and calls in Phantoms. Bring detection.',
    hp: 20000, speed: 30, armor: 2, reward: 1000, leakDamage: 40, radius: 52,
    traits: ['boss', 'healer', 'spawner'],
    ability: {
      kind: 'bossPhases', phases: [
        {
          hpFraction: 1, name: 'Hive Link',
          ability: { kind: 'combo', abilities: [
            { kind: 'healAura', radius: 220, fraction: 0.01, interval: 4 },
            { kind: 'spawn', enemyId: 'phantom', count: 2, interval: 7 },
          ] },
        },
        {
          hpFraction: 0.4, name: 'Psychic Frenzy', speedMul: 1.3,
          ability: { kind: 'combo', abilities: [
            { kind: 'healAura', radius: 260, fraction: 0.015, interval: 3 },
            { kind: 'spawn', enemyId: 'phantom', count: 2, interval: 5 },
          ] },
        },
      ],
    },
    sprite: 'boss-hivemind',
  },
  colossus: {
    id: 'colossus', name: 'Colossus',
    description: 'A walking mountain of chitin. The more you hurt it, the angrier and faster it gets. Bursts into Beetles.',
    hp: 30000, speed: 26, armor: 4, reward: 1600, leakDamage: 60, radius: 60,
    traits: ['boss', 'armored', 'splitter'],
    onDeath: { spawn: 'beetle', count: 8 },
    ability: { kind: 'enrage', maxSpeedMul: 1.8 },
    sprite: 'boss-colossus',
  },
  omega: {
    id: 'omega', name: 'Omega Parasite',
    description: 'Everything you have fought so far, in one terrible body. On Hard and Nightmare, if it reaches the exit, it is over.',
    hp: 130000, speed: 28, armor: 6, reward: 3000, leakDamage: 80, lethalOn: ['hard', 'nightmare'], radius: 66,
    traits: ['boss', 'armored', 'spawner', 'healer', 'splitter'],
    onDeath: { spawn: 'beetle', count: 6 },
    ability: {
      kind: 'bossPhases', phases: [
        {
          hpFraction: 1, name: 'Emergence',
          ability: { kind: 'spawn', enemyId: 'larva', count: 4, interval: 4 },
        },
        {
          hpFraction: 0.75, name: 'Iron Hide', armor: 12, speedMul: 0.85,
          ability: { kind: 'spawn', enemyId: 'tick', count: 3, interval: 5 },
        },
        {
          hpFraction: 0.5, name: 'Hive Chorus', armor: 3, speedMul: 1.2,
          ability: { kind: 'combo', abilities: [
            { kind: 'healAura', radius: 240, fraction: 0.01, interval: 4 },
            { kind: 'spawn', enemyId: 'phantom', count: 3, interval: 5 },
          ] },
        },
        {
          hpFraction: 0.25, name: 'Final Frenzy', armor: 0,
          ability: { kind: 'combo', abilities: [
            { kind: 'enrage', maxSpeedMul: 2.2 },
            { kind: 'spawn', enemyId: 'beetle', count: 2, interval: 6 },
          ] },
        },
      ],
    },
    sprite: 'boss-omega',
  },
};
