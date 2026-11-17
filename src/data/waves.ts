/**
 * Hand-authored waves 1-60. Each wave is a list of spawn groups that run concurrently; a group
 * releases `count` enemies `interval` s apart, starting `delay` s into the wave. Groups without a
 * `path` are spread round-robin over the map's paths. Bosses arrive on waves 10/20/30/40/50/60.
 * Past wave 60 the WaveManager generates endless waves.
 */

/** One stream of identical enemies inside a wave. */
export interface WaveGroup {
  enemy: string;
  count: number;
  interval: number;
  delay: number;
  path?: number;
}

/** Flavor tag for the UI ("rush", "breather"...). */
export type WaveTag = 'normal' | 'rush' | 'breather' | 'pack' | 'mixed' | 'boss';

/** One authored wave. */
export interface WaveDef {
  tag: WaveTag;
  groups: readonly WaveGroup[];
}

/** Group helper: `count` of `enemy`, `interval` s apart, after `delay` s. */
function g(enemy: string, count: number, interval: number, delay = 0, path?: number): WaveGroup {
  return path === undefined ? { enemy, count, interval, delay } : { enemy, count, interval, delay, path };
}

/** `packs` tight clumps of `size` enemies, one clump every `gap` s. */
function packs(enemy: string, packCount: number, size: number, gap: number, delay = 0): WaveGroup[] {
  const out: WaveGroup[] = [];
  for (let i = 0; i < packCount; i++) out.push(g(enemy, size, 0.15, delay + i * gap));
  return out;
}

function w(tag: WaveTag, ...groups: (WaveGroup | WaveGroup[])[]): WaveDef {
  return { tag, groups: groups.flat() };
}

/** Waves 1-60 (index 0 = wave 1). */
export const WAVES: readonly WaveDef[] = [
  // 1-10: larva, mite (3), tick (5), swarmling (7), leech (9), Queen Larva (10)
  w('normal', g('larva', 10, 1.2)),
  w('normal', g('larva', 16, 0.9)),
  w('normal', g('larva', 12, 1.0), g('mite', 4, 1.5, 6)),
  w('normal', g('larva', 18, 0.7), g('mite', 8, 1.0, 4)),
  w('normal', g('larva', 15, 0.8), g('tick', 3, 3, 5)),
  w('rush', g('mite', 20, 0.4)),
  w('pack', g('larva', 20, 0.6), packs('swarmling', 3, 6, 5, 4)),
  w('mixed', g('tick', 8, 1.5), g('mite', 12, 0.7, 3), g('larva', 20, 0.5, 8)),
  w('normal', g('larva', 20, 0.5), g('leech', 4, 3, 6), g('mite', 10, 0.6, 10)),
  w('boss', g('larva', 20, 0.6), g('queen', 1, 1, 6), g('mite', 8, 0.8, 12)),
  // 11-20: spore (12), phantom (14), gnat (16), jelly (18), Iron Tick (20)
  w('breather', g('larva', 30, 0.4)),
  w('normal', g('spore', 5, 3), g('larva', 20, 0.6, 2), g('tick', 6, 2, 8)),
  w('rush', g('mite', 25, 0.3), packs('swarmling', 4, 8, 4, 3)),
  w('normal', g('larva', 25, 0.5), g('phantom', 5, 2.5, 4), g('tick', 8, 1.5, 6)),
  w('mixed', g('leech', 10, 1.5), g('mite', 15, 0.5, 3), g('spore', 6, 2.5, 6)),
  w('normal', g('larva', 30, 0.4), g('gnat', 6, 2, 3), g('tick', 10, 1.2, 8)),
  w('pack', packs('swarmling', 6, 10, 4), g('mite', 20, 0.5, 6)),
  w('normal', g('jelly', 5, 3, 2), g('leech', 10, 1.2, 6), g('phantom', 8, 1.5, 10)),
  w('mixed', g('larva', 40, 0.3), g('tick', 15, 1), g('spore', 10, 1.8, 4), g('gnat', 10, 1.2, 8)),
  w('boss', g('tick', 15, 1), g('irontick', 1, 1, 5), g('mite', 20, 0.5, 10)),
  // 21-30: beetle (21), shieldbug (24), medic (27), Hive Mind (30)
  w('normal', g('larva', 40, 0.3), g('beetle', 3, 4, 4)),
  w('breather', g('mite', 30, 0.3), g('gnat', 8, 1.5, 5)),
  w('mixed', g('phantom', 15, 1.0), packs('swarmling', 4, 12, 5, 3), g('jelly', 8, 2, 5)),
  w('normal', g('tick', 20, 0.8), g('shieldbug', 3, 5, 2), g('beetle', 3, 4, 8)),
  w('rush', g('mite', 40, 0.2), packs('swarmling', 6, 12, 3), g('gnat', 15, 0.8, 6)),
  w('mixed', g('spore', 15, 1.2), g('leech', 15, 1.0, 4), g('jelly', 8, 2, 10)),
  w('normal', g('tick', 20, 0.7, 3), g('beetle', 6, 3), g('medic', 4, 4, 2)),
  w('mixed', g('phantom', 20, 0.7), g('gnat', 20, 0.7, 5), g('shieldbug', 4, 4, 8)),
  w('mixed', g('larva', 60, 0.2), g('tick', 20, 0.6, 4), g('spore', 12, 1.2, 8), g('medic', 4, 3, 10)),
  w('boss', g('phantom', 15, 1, 2), g('hivemind', 1, 1, 6), g('leech', 15, 1, 10), g('shieldbug', 4, 4, 12)),
  // 31-40: burrower (32), Colossus (40)
  w('breather', g('jelly', 15, 1.2)),
  w('normal', g('tick', 25, 0.6, 2), g('burrower', 5, 3)),
  w('rush', packs('swarmling', 10, 12, 2.5), g('mite', 40, 0.25, 1, 1)),
  w('normal', g('beetle', 10, 2), g('shieldbug', 5, 3, 2), g('medic', 5, 3, 3)),
  w('mixed', g('gnat', 30, 0.5), g('phantom', 20, 0.6, 4)),
  w('mixed', g('burrower', 10, 2), g('spore', 20, 1, 3), g('leech', 20, 0.8, 6)),
  w('mixed', g('larva', 50, 0.2), g('mite', 30, 0.3, 3), g('tick', 20, 0.6, 6), g('jelly', 10, 1.5, 8), g('gnat', 15, 0.8, 10)),
  w('normal', g('beetle', 15, 1.5), g('tick', 30, 0.5, 2), g('shieldbug', 6, 3, 4), g('medic', 6, 3, 5)),
  w('mixed', g('phantom', 30, 0.5), g('gnat', 30, 0.5, 3), g('burrower', 10, 2, 6)),
  w('boss', g('beetle', 10, 2, 2), g('colossus', 1, 1, 6), g('shieldbug', 5, 3, 8), g('medic', 5, 3, 10)),
  // 41-50: escalation, Omega Parasite (50)
  w('breather', g('larva', 80, 0.15), g('mite', 30, 0.3, 6)),
  w('normal', g('jelly', 20, 0.8), g('spore', 25, 0.8, 4)),
  w('pack', packs('swarmling', 12, 14, 2.5), g('gnat', 30, 0.4, 4)),
  w('mixed', g('burrower', 15, 1.5), g('phantom', 25, 0.6, 3), g('medic', 6, 3, 6)),
  w('normal', g('beetle', 20, 1.2), g('shieldbug', 8, 2.5, 2), g('tick', 30, 0.5, 4)),
  w('rush', g('mite', 60, 0.15), packs('swarmling', 10, 15, 2.5, 2), g('gnat', 20, 0.5, 5)),
  w('mixed', g('leech', 30, 0.6), g('jelly', 20, 0.8, 3), g('medic', 8, 2, 5)),
  w('mixed', g('tick', 40, 0.4), g('spore', 25, 0.8, 3), g('phantom', 25, 0.6, 6), g('burrower', 12, 1.5, 9)),
  w('mixed', g('beetle', 25, 1), g('burrower', 15, 1.5, 3), g('phantom', 30, 0.5, 5), g('shieldbug', 8, 2.5, 7), g('medic', 8, 2.5, 9)),
  w('boss', g('beetle', 12, 1.5, 2), g('omega', 1, 1, 8), g('shieldbug', 6, 3, 10), g('medic', 6, 3, 12)),
  // 51-60: the long road to the second Omega
  w('breather', g('jelly', 25, 0.8), g('spore', 20, 1, 4)),
  w('normal', g('beetle', 25, 0.9), g('tick', 40, 0.4, 3)),
  w('rush', g('mite', 80, 0.12), g('gnat', 40, 0.3, 3)),
  w('mixed', g('burrower', 20, 1), g('phantom', 35, 0.4, 3), g('medic', 10, 2, 5)),
  w('pack', packs('swarmling', 15, 15, 2), g('jelly', 20, 0.8, 4)),
  w('mixed', g('leech', 40, 0.4), g('spore', 30, 0.6, 3), g('shieldbug', 10, 2, 5)),
  w('normal', g('beetle', 35, 0.7), g('shieldbug', 10, 2, 2), g('medic', 10, 2, 4)),
  w('mixed', g('gnat', 50, 0.3), g('phantom', 40, 0.35, 3), g('burrower', 20, 1, 6)),
  w('mixed', g('beetle', 30, 0.8), g('jelly', 25, 0.8, 2), g('tick', 50, 0.3, 4), g('medic', 10, 2, 6), g('shieldbug', 10, 2, 8)),
  w('boss', g('beetle', 20, 1, 2), g('omega', 1, 1, 8), g('burrower', 15, 1.2, 10), g('shieldbug', 8, 2.5, 12), g('medic', 8, 2.5, 14)),
];

/**
 * Threat points per regular enemy, used by the endless generator to spend a wave budget.
 * Roughly proportional to how hard each one is to stop.
 */
export const ENDLESS_THREAT: Readonly<Record<string, number>> = {
  larva: 1, mite: 1.2, tick: 4, swarmling: 0.6, leech: 5, spore: 7, phantom: 6, gnat: 4,
  jelly: 9, beetle: 20, shieldbug: 15, medic: 12, burrower: 14,
};
