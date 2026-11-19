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
  /** Restart the game scene (same map unless `mapId` is given); exercises teardown. */
  restart(mapId?: string): void;
  /** Set by the HUD scene while it runs: where its controls are, for driving them with real input. */
  hud?: HudDebug;
}

/** HUD geometry hooks (game px, 1920×1080) for the e2e test. */
export interface HudDebug {
  /** Current scroll offset of the tower list. */
  listOffset(): number;
  /** True while the tower list is still animating (inertia, wheel easing, bounce). */
  listMoving(): boolean;
  /** Centre of the card of `towerId` when fully visible in the list, else null. */
  cardCenter(towerId: string): { x: number; y: number } | null;
  /** Centre of a named control ('next', 'speed', 'pause', 'auto', 'upgrade0', 'upgrade1', 'sell', 'target-<mode>'), or null when hidden. */
  control(name: string): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __LDTD__?: DebugApi;
  }
}

/**
 * Debug hooks (`window.__LDTD__`, `?stress=N`) are on in dev builds and when the page URL has
 * `?e2e` (the smoke test); production players never get them.
 */
export function debugEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('e2e');
}

/** Install the debug hooks for a running game. */
export function installDebugApi(
  c: GameController, stats: () => DebugStats, restart: (mapId?: string) => void,
): DebugApi {
  const api: DebugApi = {
    ready: false,
    scene: 'game',
    get sim(): ReadonlySim { return c.sim; },
    controller: c,
    placeTower: (id, x, y) => c.placeTower(id, x, y)?.uid ?? null,
    startWave: () => c.startNextWave(),
    setSpeed: (speed) => c.setSpeed(Math.min(3, Math.max(1, Math.round(speed))) as GameSpeed),
    stats,
    restart,
  };
  window.__LDTD__ = api;
  return api;
}
