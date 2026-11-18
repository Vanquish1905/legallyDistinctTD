import { ScriptedWaveSource, type SpawnEvent } from '../../sim/WaveSource';

const KINDS = ['larva', 'mite', 'tick', 'leech', 'beetle', 'jelly', 'gnat', 'shieldbug', 'phantom', 'burrower'];

/**
 * Debug wave source for performance checks (`?stress=N`): wave 1 sends N tough enemies within a
 * few seconds so they are all on the field at once.
 */
export function stressWaves(count: number, pathCount: number): ScriptedWaveSource {
  const wave: SpawnEvent[] = [];
  for (let i = 0; i < count; i++) {
    wave.push({ enemyId: KINDS[i % KINDS.length] as string, at: i * 0.04, pathIndex: i % pathCount, hpMul: 40 });
  }
  return new ScriptedWaveSource([wave]);
}
