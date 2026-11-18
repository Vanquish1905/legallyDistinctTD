import type { GameSim } from '../../sim/GameSim';
import type { RenderStats } from '../../render/WorldRenderer';
import type { GameController, GameSpeed } from './GameController';

/** Read-only view of the sim for tests and the console. */
export type ReadonlySim = Readonly<Pick<GameSim,
  'enemies' | 'towers' | 'projectiles' | 'money' | 'lives' | 'wave' | 'phase' | 'time' | 'map' | 'difficulty' | 'freeplay'>>;

/** Frame and object counts. */
export interface DebugStats extends RenderStats {
  fps: number;
  /** Smoothed ms per frame spent in the game scene's update (sim step + view sync). */
  updateMs: number;
}

/** `window.__LDTD__`: hooks for the e2e smoke test and console debugging. */
export interface DebugApi {
  /** True once the game scene has rendered its first frame. */
  ready: boolean;
  scene: 'game';
  readonly sim: ReadonlySim;
  readonly controller: GameController;
  /** Place a tower directly; returns its uid or null when placement fails. */
  placeTower(towerId: string, x: number, y: number): number | null;
  startWave(): void;
  setSpeed(speed: number): void;
  stats(): DebugStats;
}

declare global {
  interface Window {
    __LDTD__?: DebugApi;
  }
}

/** Install the debug hooks for a running game. */
export function installDebugApi(c: GameController, stats: () => DebugStats): DebugApi {
  const api: DebugApi = {
    ready: false,
    scene: 'game',
    get sim(): ReadonlySim { return c.sim; },
    controller: c,
    placeTower: (id, x, y) => c.placeTower(id, x, y)?.uid ?? null,
    startWave: () => c.startNextWave(),
    setSpeed: (speed) => c.setSpeed(Math.min(3, Math.max(1, Math.round(speed))) as GameSpeed),
    stats,
  };
  window.__LDTD__ = api;
  return api;
}
