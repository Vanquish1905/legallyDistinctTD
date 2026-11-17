import type { DifficultyDef } from '../sim/types';

/** The four difficulties. Nightmare is the legacy "chaos" joke: a single life. */
export const DIFFICULTIES: Readonly<Record<DifficultyDef['id'], DifficultyDef>> = {
  easy: { id: 'easy', name: 'Easy', startMoney: 800, lives: 150, hpMul: 0.8, speedMul: 0.95, rewardMul: 1.15, costMul: 0.9, waves: 30 },
  normal: { id: 'normal', name: 'Normal', startMoney: 650, lives: 100, hpMul: 1, speedMul: 1, rewardMul: 1, costMul: 1, waves: 40 },
  hard: { id: 'hard', name: 'Hard', startMoney: 600, lives: 60, hpMul: 1.25, speedMul: 1.05, rewardMul: 0.9, costMul: 1.08, waves: 50 },
  nightmare: { id: 'nightmare', name: 'Nightmare', startMoney: 550, lives: 1, hpMul: 1.6, speedMul: 1.12, rewardMul: 0.8, costMul: 1.15, waves: 60 },
};

/** Display order for the difficulty picker. */
export const DIFFICULTY_ORDER: readonly DifficultyDef['id'][] = ['easy', 'normal', 'hard', 'nightmare'];
