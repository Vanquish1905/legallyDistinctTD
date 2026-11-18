import type { TargetMode } from '../../src/sim/types';
import type { DifficultyDef } from '../../src/sim/types';
import { GameSim, type SimPhase } from '../../src/sim/GameSim';
import { PathFollower } from '../../src/sim/PathFollower';
import { TOWERS, type TowerId } from '../../src/data/towers';
import { getMap } from '../../src/data/maps';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { isBoss } from '../../src/data/enemies';

/**
 * A scripted "player" for balance checks: follows a build order, then keeps adding towers from a
 * rotation and buys upgrades along fixed per-tower plans. Deterministic; plays every wave from
 * the build phase (no early calls).
 */

/** One scripted action. `tag` names a placed tower so later steps can upgrade it. */
export type BotStep =
  | { place: TowerId; tag: string; mode?: TargetMode }
  | { up: string; path: 0 | 1 };

/** A bot build strategy. */
export interface BotStrategy {
  name: string;
  steps: readonly BotStep[];
  /** Towers placed in rotation once the script is done. */
  extra: readonly TowerId[];
  /** Upgrade order per tower type used after the script (paths in buying order). */
  plans: Partial<Record<TowerId, readonly (0 | 1)[]>>;
  /** Target mode for towers placed from `extra`. */
  modes?: Partial<Record<TowerId, TargetMode>>;
}

/** Result of one wave. */
export interface BotWave {
  wave: number; livesBefore: number; livesAfter: number; seconds: number;
  /** Leaked enemies by id. */
  leaks: Record<string, number>;
  /** HP fraction a leaking boss still had (undefined when no boss leaked). */
  bossLeakHp?: number;
}

/** Outcome of a bot run. */
export interface BotResult {
  /** Last wave reached (started). */
  wave: number;
  lives: number;
  won: boolean;
  waves: BotWave[];
  towers: string[];
}

const DEFAULT_PLANS: Partial<Record<TowerId, readonly (0 | 1)[]>> = {
  blaster: [0, 0, 1, 1, 0],
  gatling: [1, 1, 0, 0, 1],
  sniper: [1, 0, 0, 1, 0],
  frost: [0, 1, 1, 0],
  tesla: [1, 0, 0, 1, 0],
  rocket: [0, 1, 0, 1, 0],
  mortar: [0, 1, 0, 1, 0],
  laser: [0, 1, 0, 1, 0],
  radar: [1, 0, 1, 0],
  toxin: [0, 1, 0, 1, 0],
  railgun: [1, 0, 0, 1, 1],
  saw: [0, 1, 0, 1, 0],
};

/** Generalist: darts, gatling, frost, sniper, tesla, rockets, a radar, one or two lasers late. */
export const MIXED: BotStrategy = {
  name: 'mixed',
  steps: [
    { place: 'blaster', tag: 'b1' }, { place: 'blaster', tag: 'b2' }, { up: 'b1', path: 0 }, { up: 'b2', path: 0 },
    { place: 'frost', tag: 'f1' }, { place: 'gatling', tag: 'g1' }, { up: 'g1', path: 1 },
    { up: 'b1', path: 0 }, { up: 'b2', path: 0 }, { place: 'sniper', tag: 's1', mode: 'strong' }, { up: 's1', path: 1 },
    { up: 'g1', path: 1 }, { up: 'b1', path: 1 }, { up: 'b2', path: 1 }, { up: 's1', path: 0 },
    { place: 'tesla', tag: 't1' }, { up: 't1', path: 1 }, { up: 'f1', path: 0 }, { place: 'rocket', tag: 'r1' },
    { up: 't1', path: 0 }, { up: 's1', path: 0 }, { place: 'radar', tag: 'rd' }, { up: 'r1', path: 0 },
    { place: 'gatling', tag: 'g2' }, { up: 'g2', path: 1 }, { up: 'g2', path: 1 }, { up: 'r1', path: 1 },
    { up: 'b1', path: 0 }, { up: 'b2', path: 0 }, { place: 'laser', tag: 'l1' }, { up: 'g1', path: 0 },
    { up: 'g1', path: 0 }, { up: 's1', path: 1 }, { up: 'f1', path: 1 }, { up: 'l1', path: 0 },
  ],
  extra: ['tesla', 'rocket', 'sniper', 'mortar', 'gatling', 'laser', 'frost', 'toxin'],
  plans: DEFAULT_PLANS,
  modes: { sniper: 'strong' },
};

/** No lasers: snipers and tesla coils carry, with darts and frost for support. */
export const NO_LASER: BotStrategy = {
  name: 'nolaser',
  steps: [
    { place: 'blaster', tag: 'b1' }, { place: 'blaster', tag: 'b2' }, { up: 'b1', path: 0 }, { up: 'b2', path: 0 },
    { place: 'sniper', tag: 's1', mode: 'strong' }, { up: 's1', path: 0 }, { place: 'frost', tag: 'f1' },
    { place: 'sniper', tag: 's2', mode: 'first' }, { up: 's2', path: 1 }, { up: 's1', path: 0 },
    { up: 'b1', path: 0 }, { up: 'b2', path: 0 }, { place: 'tesla', tag: 't1' }, { up: 't1', path: 1 },
    { up: 's2', path: 0 }, { up: 's2', path: 0 }, { up: 't1', path: 0 }, { place: 'sniper', tag: 's3', mode: 'strong' },
    { up: 's3', path: 0 }, { up: 's3', path: 0 }, { place: 'tesla', tag: 't2' }, { up: 't2', path: 1 },
    { up: 't2', path: 0 }, { up: 's1', path: 1 }, { up: 'f1', path: 0 }, { up: 't1', path: 0 }, { up: 's1', path: 0 },
  ],
  extra: ['sniper', 'tesla', 'gatling', 'sniper', 'tesla', 'rocket'],
  plans: DEFAULT_PLANS,
  modes: { sniper: 'strong' },
};

/** All strategies by name. */
export const STRATEGIES: Readonly<Record<string, BotStrategy>> = { mixed: MIXED, nolaser: NO_LASER };

const GRID = 16;

class Bot {
  private readonly sim: GameSim;
  private readonly samples: { x: number; y: number }[] = [];
  private readonly spotCache = new Map<number, { x: number; y: number; c: number }[]>();
  private readonly tags = new Map<string, number>();
  private readonly placed: number[] = [];
  private cursor = 0;
  private extraIndex = 0;

  constructor(sim: GameSim, private readonly strategy: BotStrategy) {
    this.sim = sim;
    for (const pts of sim.map.paths) {
      const p = new PathFollower(pts);
      for (let d = 0; d < p.length; d += 10) this.samples.push(p.positionAt(d));
    }
  }

  /** Grid cells sorted by how much path they cover within `r` (cached per radius). */
  private spots(r: number): { x: number; y: number; c: number }[] {
    let list = this.spotCache.get(r);
    if (list) return list;
    list = [];
    const r2 = r * r;
    for (let x = 40; x < 1520; x += GRID) {
      for (let y = 90; y < 1060; y += GRID) {
        let c = 0;
        for (const s of this.samples) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= r2) c++;
        if (c > 0) list.push({ x, y, c });
      }
    }
    list.sort((a, b) => b.c - a.c || a.x - b.x || a.y - b.y);
    this.spotCache.set(r, list);
    return list;
  }

  private place(id: TowerId, mode?: TargetMode): number | null {
    const cost = this.sim.towerCost(id) ?? Infinity;
    if (this.sim.money < cost) return null;
    const r = Math.min(TOWERS[id].stats.range, 400);
    for (const s of this.spots(r)) {
      if (!this.sim.canPlace(id, s.x, s.y).ok) continue;
      const t = this.sim.placeTower(id, s.x, s.y);
      if (!t) return null;
      if (mode) this.sim.setTargetMode(t.uid, mode);
      this.placed.push(t.uid);
      return t.uid;
    }
    return -1;
  }

  private nextPlanned(uid: number): { path: 0 | 1; cost: number; ok: boolean } | null {
    const t = this.sim.towers.find((x) => x.uid === uid);
    if (!t) return null;
    const plan = this.strategy.plans[t.def.id as TowerId];
    if (!plan) return null;
    const counts: [number, number] = [0, 0];
    for (const p of plan) {
      counts[p]++;
      if (t.tiers[p] < counts[p]) {
        const c = this.sim.canUpgrade(uid, p);
        if (!c || c.cost === null) return null;
        return { path: p, cost: c.cost, ok: c.ok };
      }
    }
    return null;
  }

  /** Spend money for this build phase. */
  spend(): void {
    for (let guard = 0; guard < 300; guard++) {
      const step = this.strategy.steps[this.cursor];
      if (!step) {
        if (!this.spendFallback()) return;
        continue;
      }
      if ('place' in step) {
        const uid = this.place(step.place, step.mode);
        if (uid === null) return;
        if (uid >= 0) this.tags.set(step.tag, uid);
        this.cursor++;
      } else {
        const uid = this.tags.get(step.up);
        const c = uid === undefined ? null : this.sim.canUpgrade(uid, step.path);
        if (uid === undefined || !c) { this.cursor++; continue; }
        if (!c.ok) {
          if (c.reason === 'money') return;
          this.cursor++;
          continue;
        }
        this.sim.upgradeTower(uid, step.path);
        this.cursor++;
      }
    }
  }

  private spendFallback(): boolean {
    let best: { uid: number; path: 0 | 1; cost: number; ok: boolean } | null = null;
    for (const uid of this.placed) {
      const n = this.nextPlanned(uid);
      if (n && (!best || n.cost < best.cost)) best = { uid, ...n };
    }
    const id = this.strategy.extra[this.extraIndex % this.strategy.extra.length] as TowerId;
    const towerCost = this.sim.towerCost(id) ?? Infinity;
    if (best && best.cost <= towerCost * 1.2) {
      return best.ok && this.sim.upgradeTower(best.uid, best.path);
    }
    if (this.sim.money >= towerCost) {
      const uid = this.place(id, this.strategy.modes?.[id]);
      this.extraIndex++;
      return uid !== null;
    }
    return best !== null && best.ok && this.sim.upgradeTower(best.uid, best.path);
  }
}

/** Play `mapId` on `difficulty` with `strategy` for up to `maxWave` waves. */
export function runBot(
  mapId: string, difficulty: DifficultyDef['id'], strategy: BotStrategy, maxWave = Infinity, seed = 1234,
): BotResult {
  const map = getMap(mapId);
  if (!map) throw new Error(`Unknown map ${mapId}`);
  const sim = new GameSim({ map, difficulty: DIFFICULTIES[difficulty], seed });
  const bot = new Bot(sim, strategy);
  const waves: BotWave[] = [];
  bot.spend();
  while (sim.wave < maxWave && sim.phase === 'build') {
    const livesBefore = sim.lives;
    sim.startNextWave();
    let t = 0;
    const leaks: Record<string, number> = {};
    let bossHp = 1;
    let bossLeakHp: number | undefined;
    const phase = (): SimPhase => sim.phase;
    while (phase() === 'wave' && t < 900) {
      sim.step(1 / 60);
      for (const e of sim.events.drain()) {
        if (e.type === 'enemyLeaked') leaks[e.enemyId] = (leaks[e.enemyId] ?? 0) + 1;
        if (e.type === 'enemyLeaked' && isBoss(e.enemyId)) bossLeakHp = bossHp;
      }
      for (const e of sim.enemies) if (e.isBoss) bossHp = e.hp / e.maxHp;
      t += 1 / 60;
    }
    waves.push({
      wave: sim.wave, livesBefore, livesAfter: sim.lives, seconds: Math.round(t), leaks,
      ...(bossLeakHp === undefined ? {} : { bossLeakHp }),
    });
    if (phase() === 'build') bot.spend();
  }
  return {
    wave: sim.wave, lives: sim.lives, won: sim.phase === 'won', waves,
    towers: sim.towers.map((x) => `${x.def.id}${x.tiers[0]}${x.tiers[1]}`),
  };
}
