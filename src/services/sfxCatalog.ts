import type { DamageType } from '../sim/types';
import { DEFAULT_SFX_RULE, type SfxRule } from './sfxGate';

/** Mixing and limits of one sound key. */
export interface SfxDef {
  /** Base volume (multiplied by the sfx bus). */
  volume: number;
  rule: SfxRule;
  /** Random detune range in cents (±) and rate range (1 ± rate) for repeats. */
  detune?: number;
  rate?: number;
}

const r = (minInterval: number, maxVoices: number): SfxRule => ({ minInterval, maxVoices });

/** Every sound key the AudioService knows: the team's recordings plus the synth cues. */
export const SFX_DEFS: Record<string, SfxDef> = {
  // Recordings (public/assets/audio).
  'sfx-place': { volume: 0.8, rule: r(0.06, 2), detune: 40 },
  'sfx-sell': { volume: 0.7, rule: r(0.08, 2) },
  'sfx-hit': { volume: 0.22, rule: r(0.07, 3), detune: 150, rate: 0.08 },
  'sfx-on-hit': { volume: 0.28, rule: r(0.06, 3), detune: 120, rate: 0.08 },
  'sfx-fire': { volume: 0.32, rule: r(0.05, 4), detune: 100, rate: 0.06 },
  'sfx-explosion': { volume: 0.45, rule: r(0.09, 4), detune: 120, rate: 0.08 },
  'sfx-win': { volume: 0.9, rule: r(1, 1) },
  'sfx-game-over': { volume: 0.9, rule: r(1, 1) },
  // Generated (sfxSynth.ts); their samples are already quiet.
  'sfx-ui-click': { volume: 0.8, rule: r(0.04, 2) },
  'sfx-ui-hover': { volume: 0.6, rule: r(0.06, 1) },
  'sfx-coin': { volume: 0.7, rule: r(0.08, 2), detune: 30 },
  'sfx-zap': { volume: 0.7, rule: r(0.06, 3), detune: 200 },
  'sfx-laser': { volume: 0.6, rule: r(0.2, 2), detune: 60 },
  'sfx-freeze': { volume: 0.7, rule: r(0.1, 3), detune: 120 },
  'sfx-poison': { volume: 0.6, rule: r(0.12, 2), detune: 150 },
  'sfx-flame': { volume: 0.6, rule: r(0.15, 2), detune: 100 },
  'sfx-saw': { volume: 0.6, rule: r(0.1, 3), detune: 120 },
  'sfx-railgun': { volume: 0.8, rule: r(0.1, 2), detune: 60 },
  'sfx-mortar': { volume: 0.8, rule: r(0.1, 3), detune: 80 },
  'sfx-pulse': { volume: 0.7, rule: r(0.1, 3), detune: 80 },
  'sfx-boss-warning': { volume: 1, rule: r(1.5, 1) },
  'sfx-wave-start': { volume: 0.9, rule: r(0.4, 1) },
  'sfx-upgrade': { volume: 0.8, rule: r(0.08, 2) },
  'sfx-error': { volume: 0.7, rule: r(0.15, 1) },
  'sfx-life-lost': { volume: 0.8, rule: r(0.25, 2), detune: 60 },
};

/** How a tower's shots sound. `interval` = min seconds between shot sounds per tower kind. */
export interface FireCue {
  key: string;
  interval: number;
  volume?: number;
  /** Base playback rate (pitches the shared recording per family). */
  rate?: number;
}

/** Shot sound per tower id (towers missing here are silent when firing). */
export const TOWER_FIRE: Record<string, FireCue> = {
  blaster: { key: 'sfx-fire', interval: 0.09 },
  gatling: { key: 'sfx-fire', interval: 0.12, volume: 0.7, rate: 1.35 },
  sniper: { key: 'sfx-fire', interval: 0.2, rate: 0.7, volume: 1.2 },
  heli: { key: 'sfx-fire', interval: 0.14, rate: 1.2, volume: 0.7 },
  seeker: { key: 'sfx-fire', interval: 0.18, rate: 0.85 },
  rocket: { key: 'sfx-fire', interval: 0.2, rate: 0.6, volume: 1.1 },
  frost: { key: 'sfx-freeze', interval: 0.25 },
  flamethrower: { key: 'sfx-flame', interval: 0.3 },
  tesla: { key: 'sfx-zap', interval: 0.15 },
  mortar: { key: 'sfx-mortar', interval: 0.25 },
  toxin: { key: 'sfx-poison', interval: 0.3 },
  saw: { key: 'sfx-saw', interval: 0.2 },
  pulse: { key: 'sfx-pulse', interval: 0.25 },
  railgun: { key: 'sfx-railgun', interval: 0.15 },
};

/** Explosion sound per damage type. */
export const EXPLOSION_SFX: Record<DamageType, string> = {
  physical: 'sfx-explosion',
  explosive: 'sfx-explosion',
  fire: 'sfx-explosion',
  ice: 'sfx-freeze',
  poison: 'sfx-poison',
  energy: 'sfx-pulse',
};

/** Throttle-key prefix for per-tower-kind shot sounds. */
export const FIRE_GATE_PREFIX = 'fire:';

/**
 * Limits for a throttle key: `fire:<towerId>` keys use the tower's shot interval (two
 * overlapping voices), other keys their sound's rule.
 */
export function ruleForGate(gate: string): SfxRule {
  if (gate.startsWith(FIRE_GATE_PREFIX)) {
    const cue = TOWER_FIRE[gate.slice(FIRE_GATE_PREFIX.length)];
    return cue ? r(cue.interval, 2) : DEFAULT_SFX_RULE;
  }
  return SFX_DEFS[gate]?.rule ?? DEFAULT_SFX_RULE;
}
