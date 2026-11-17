import type { DifficultyDef, EnemyDef } from './types';
import type { SpawnEvent, WavePreview, WaveSource } from './WaveSource';
import { ENEMIES, isBoss } from '../data/enemies';
import { ENDLESS_THREAT, WAVES, type WaveGroup } from '../data/waves';
import { Rng } from './rng';

/** Freeplay HP growth per wave past the authored ones. */
const ENDLESS_HP_GROWTH = 1.08;
/** Early-start bonus: money per second of spawning the current wave still had left. */
const EARLY_BONUS_PER_SECOND = 5;

/** Options for a WaveManager. */
export interface WaveManagerOptions {
  difficulty: DifficultyDef;
  seed: number;
  /** Enemy registry for HP estimates (default ENEMIES). */
  enemies?: Readonly<Record<string, EnemyDef>>;
}

/**
 * The content-driven WaveSource: authored waves 1-60, then endless waves built from a growing
 * threat budget with a seeded RNG (deterministic per seed and wave number, independent of call
 * order). Freeplay enemies get `1.08^(wave-60)` extra HP; difficulty hpMul is applied by the sim.
 */
export class WaveManager implements WaveSource {
  private readonly difficulty: DifficultyDef;
  private readonly seed: number;
  private readonly enemies: Readonly<Record<string, EnemyDef>>;
  private readonly firstSeen = new Map<string, number>();
  private readonly cache = new Map<number, readonly WaveGroup[]>();

  constructor(o: WaveManagerOptions) {
    this.difficulty = o.difficulty;
    this.seed = o.seed;
    this.enemies = o.enemies ?? ENEMIES;
    WAVES.forEach((wave, i) => {
      for (const grp of wave.groups) if (!this.firstSeen.has(grp.enemy)) this.firstSeen.set(grp.enemy, i + 1);
    });
  }

  /** Spawn groups of a 1-based wave (authored or generated). */
  groupsFor(wave: number): readonly WaveGroup[] {
    const authored = WAVES[wave - 1];
    if (authored) return authored.groups;
    let groups = this.cache.get(wave);
    if (!groups) {
      groups = this.generate(wave);
      this.cache.set(wave, groups);
    }
    return groups;
  }

  /** Extra HP multiplier for a wave (1 for authored waves). */
  hpMulFor(wave: number): number {
    return wave > WAVES.length ? ENDLESS_HP_GROWTH ** (wave - WAVES.length) : 1;
  }

  /** Threat budget of a generated wave; grows every wave. */
  endlessBudget(wave: number): number {
    return 900 + 25 * (wave - WAVES.length);
  }

  spawnsFor(wave: number, pathCount: number): readonly SpawnEvent[] {
    const paths = Math.max(1, pathCount);
    const hpMul = this.hpMulFor(wave);
    const out: SpawnEvent[] = [];
    this.groupsFor(wave).forEach((grp, gi) => {
      for (let i = 0; i < grp.count; i++) {
        const ev: SpawnEvent = {
          enemyId: grp.enemy, at: grp.delay + i * grp.interval, pathIndex: grp.path ?? (gi + i) % paths,
        };
        if (hpMul !== 1) ev.hpMul = hpMul;
        out.push(ev);
      }
    });
    return out.sort((a, b) => a.at - b.at);
  }

  /** `100 + 10 * wave`, scaled by the difficulty's rewardMul. */
  clearBonus(wave: number): number {
    return Math.round((100 + 10 * wave) * this.difficulty.rewardMul);
  }

  /** `5 * remainingSpawnTime + 10 * sqrt(wave)`, scaled by rewardMul. */
  earlyStartBonus(wave: number, remainingSpawnTime = 0): number {
    const raw = EARLY_BONUS_PER_SECOND * Math.max(0, remainingSpawnTime) + 10 * Math.sqrt(wave);
    return Math.round(raw * this.difficulty.rewardMul);
  }

  bossOf(wave: number): string | undefined {
    return this.groupsFor(wave).find((grp) => isBoss(grp.enemy))?.enemy;
  }

  preview(wave: number): WavePreview {
    const counts = new Map<string, number>();
    for (const grp of this.groupsFor(wave)) counts.set(grp.enemy, (counts.get(grp.enemy) ?? 0) + grp.count);
    const hpMul = this.hpMulFor(wave) * this.difficulty.hpMul;
    let totalHp = 0;
    const groups: { enemy: string; count: number }[] = [];
    const newEnemies: string[] = [];
    for (const [enemy, count] of counts) {
      groups.push({ enemy, count });
      totalHp += count * this.hpOf(enemy, 0);
      if (!isBoss(enemy) && this.firstSeen.get(enemy) === wave) newEnemies.push(enemy);
    }
    const boss = this.bossOf(wave);
    return { groups, ...(boss ? { boss } : {}), newEnemies, totalHpEstimate: Math.round(totalHp * hpMul) };
  }

  /** HP of an enemy including everything it splits into. */
  private hpOf(id: string, depth: number): number {
    const def = this.enemies[id];
    if (!def || depth > 4) return 0;
    const split = def.onDeath ? def.onDeath.count * this.hpOf(def.onDeath.spawn, depth + 1) : 0;
    return def.hp + split;
  }

  /** Endless wave: 3-5 groups spending the budget; Omega every 10 waves. */
  private generate(wave: number): WaveGroup[] {
    const rng = new Rng((this.seed ^ Math.imul(wave, 0x9e3779b1)) >>> 0);
    const pool = Object.keys(ENDLESS_THREAT);
    const groupCount = rng.int(3, 5);
    const budget = this.endlessBudget(wave);
    const groups: WaveGroup[] = [];
    let delay = 0;
    for (let i = 0; i < groupCount; i++) {
      const enemy = rng.pick(pool);
      const threat = ENDLESS_THREAT[enemy] ?? 1;
      const count = Math.max(1, Math.min(80, Math.floor(budget / groupCount / threat)));
      const interval = Math.max(0.12, Math.min(2, 30 / count));
      groups.push({ enemy, count, interval: Math.round(interval * 100) / 100, delay });
      delay += rng.int(2, 5);
    }
    if (wave % 10 === 0) groups.push({ enemy: 'omega', count: 1, interval: 1, delay: 8 });
    return groups;
  }
}
