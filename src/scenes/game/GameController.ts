import type { GameSim, SimPhase } from '../../sim/GameSim';
import type { SimEvent } from '../../sim/events';
import type { TowerState } from '../../sim/TowerState';
import type { PlacementResult } from '../../sim/placement';
import type { TargetMode, TowerDef, Vec2 } from '../../sim/types';
import { TARGET_MODES } from '../../sim/targeting';
import { TOWERS } from '../../data/towers';
import { closestPointOnPaths } from '../../render/math';
import { TypedEmitter } from './TypedEmitter';

/** Simulation speed multiplier. */
export type GameSpeed = 1 | 2 | 3;

/** Longest real frame time simulated in one update (s); longer frames are clamped. */
export const MAX_FRAME_DT = 0.1;

/** A path tower snaps to the path centre when the pointer is within pathWidth/2 + this (px). */
const PATH_SNAP_MARGIN = 40;

/** Extra px around a tower's footprint that still counts as clicking it. */
const PICK_SLOP = 8;

/** What changed about a tower in a `towerChanged` event. */
export type TowerChange = 'placed' | 'upgraded' | 'sold' | 'expired' | 'targetMode' | 'patrol';

/** Events the controller emits for the HUD and the renderer. */
export interface GameEvents {
  /** The selected tower changed (null = nothing selected). */
  selectionChanged: { uid: number | null };
  /** A tower is now pending placement (null = placement ended). */
  placementChanged: { towerId: string | null };
  /** A placement or purchase attempt failed. */
  placementRejected: { towerId: string; reason: string };
  moneyChanged: { money: number; delta: number };
  livesChanged: { lives: number; delta: number };
  /** Wave number or phase changed (wave start, wave clear, build/wave/won/lost transitions). */
  waveChanged: { wave: number; total: number; phase: SimPhase; freeplay: boolean };
  /** A tower was placed, upgraded, sold, expired or retargeted. */
  towerChanged: { uid: number; change: TowerChange };
  speedChanged: { speed: GameSpeed };
  pauseChanged: { paused: boolean };
  autoStartChanged: { autoStart: boolean };
  bossSpawned: { uid: number; enemyId: string; name: string; maxHp: number };
  bossPhase: { uid: number; enemyId: string; phase: number; name: string };
  /** The game ended. */
  gameOver: { won: boolean; wave: number };
  /** Every raw sim event, after the typed events above were emitted for it. */
  sim: SimEvent;
}

/**
 * The one object UI code talks to during a game. Wraps the `GameSim` with player-facing state
 * (speed, pause, selection, pending placement), turns sim events into typed UI events and
 * steps the sim each frame. Pure TypeScript: no Phaser, so it can be unit tested.
 */
export class GameController {
  readonly events = new TypedEmitter<GameEvents>();
  /**
   * Set by the HUD: returns true when a field point is covered by UI, so taps there neither
   * place nor select.
   */
  pointerBlocker: ((x: number, y: number) => boolean) | null = null;
  private _speed: GameSpeed = 1;
  private _paused = false;
  private _selected: number | null = null;
  private _pending: string | null = null;
  private lastPhase: SimPhase;
  private pumping = false;
  private lastWave: number;
  private readonly snapScratch: Vec2 = { x: 0, y: 0 };

  constructor(readonly sim: GameSim) {
    this.lastPhase = sim.phase;
    this.lastWave = sim.wave;
  }

  // ---- state ------------------------------------------------------------------------------

  get speed(): GameSpeed { return this._speed; }
  get paused(): boolean { return this._paused; }
  /** Uid of the selected tower, or null. */
  get selectedUid(): number | null { return this._selected; }
  /** Tower id waiting to be placed, or null. */
  get pendingTowerId(): string | null { return this._pending; }
  get gameOver(): boolean { return this.sim.phase === 'won' || this.sim.phase === 'lost'; }

  /** The selected tower's live state. */
  selectedTower(): TowerState | undefined {
    return this._selected === null ? undefined : this.towerByUid(this._selected);
  }

  /** Live state of a placed tower. */
  towerByUid(uid: number): TowerState | undefined {
    return this.sim.getTower(uid);
  }

  /** The tower under field point (x, y), if any. */
  towerAt(x: number, y: number): TowerState | undefined {
    let best: TowerState | undefined;
    let bestD = Infinity;
    for (const t of this.sim.towers) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= t.def.footprint + PICK_SLOP && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  // ---- placement --------------------------------------------------------------------------

  /** Start placing `towerId` (cancels any selection). False for unknown or unaffordable towers. */
  beginPlacement(towerId: string): boolean {
    const cost = this.sim.towerCost(towerId);
    if (cost === undefined || this.gameOver) return false;
    if (cost > this.sim.money) {
      this.events.emit('placementRejected', { towerId, reason: 'Not enough money' });
      return false;
    }
    this.select(null);
    if (this._pending === towerId) return true;
    this._pending = towerId;
    this.events.emit('placementChanged', { towerId });
    return true;
  }

  /** Stop placing (no-op when nothing is pending). */
  cancelPlacement(): void {
    if (this._pending === null) return;
    this._pending = null;
    this.events.emit('placementChanged', { towerId: null });
  }

  /**
   * Where the pending tower would go for pointer (x, y): path towers snap onto a nearby path
   * centre line. Writes the position into `out` and returns the sim's verdict.
   */
  resolvePlacement(x: number, y: number, out: Vec2): PlacementResult {
    out.x = x;
    out.y = y;
    const id = this._pending;
    if (id === null) return { ok: false, reason: 'Nothing to place' };
    const def = TOWERS[id as keyof typeof TOWERS] as TowerDef | undefined;
    if (def?.placement === 'path') {
      const map = this.sim.map;
      const d = closestPointOnPaths(map.paths, x, y, this.snapScratch);
      if (d <= map.pathWidth / 2 + PATH_SNAP_MARGIN) {
        out.x = Math.round(this.snapScratch.x);
        out.y = Math.round(this.snapScratch.y);
      }
    }
    return this.sim.canPlace(id, out.x, out.y);
  }

  /**
   * Place the pending tower at pointer (x, y) (snapped like `resolvePlacement`). With `keep`
   * (Shift held) placement stays active for another copy when money allows.
   */
  placeAt(x: number, y: number, keep = false): TowerState | null {
    const id = this._pending;
    if (id === null) return null;
    const pos = { x: 0, y: 0 };
    const check = this.resolvePlacement(x, y, pos);
    if (!check.ok) {
      this.events.emit('placementRejected', { towerId: id, reason: check.reason ?? 'Cannot place here' });
      return null;
    }
    const tower = this.sim.placeTower(id, pos.x, pos.y);
    if (!tower) return null;
    const cost = this.sim.towerCost(id) ?? Infinity;
    if (!keep || cost > this.sim.money) this.cancelPlacement();
    this.pump();
    return tower;
  }

  /** Place a tower directly (debug/tests), bypassing the pending state. */
  placeTower(towerId: string, x: number, y: number): TowerState | null {
    const t = this.sim.placeTower(towerId, x, y);
    this.pump();
    return t;
  }

  // ---- selected tower ---------------------------------------------------------------------

  /** Select a placed tower (null deselects). Cancels a pending placement. */
  select(uid: number | null): void {
    if (uid !== null && !this.towerByUid(uid)) uid = null;
    if (uid !== null) this.cancelPlacement();
    if (uid === this._selected) return;
    this._selected = uid;
    this.events.emit('selectionChanged', { uid });
  }

  /** Buy the next tier on `path`. */
  upgrade(uid: number, path: 0 | 1): boolean {
    const ok = this.sim.upgradeTower(uid, path);
    this.pump();
    return ok;
  }

  /** Sell a tower; returns the refund. Deselects it. */
  sell(uid: number): number {
    const refund = this.sim.sellTower(uid);
    this.pump();
    return refund;
  }

  /** Send a Heli Pad's helicopter to guard `point` (null = back to its pad). False when not allowed. */
  setHeliTarget(uid: number, point: Vec2 | null): boolean {
    const ok = this.sim.setHeliTarget(uid, point);
    if (ok) this.events.emit('towerChanged', { uid, change: 'patrol' });
    return ok;
  }

  /** Change a tower's target mode. */
  setTargetMode(uid: number, mode: TargetMode): void {
    const t = this.towerByUid(uid);
    if (!t || t.targetMode === mode) return;
    this.sim.setTargetMode(uid, mode);
    this.events.emit('towerChanged', { uid, change: 'targetMode' });
  }

  /** Switch a tower to the next target mode (first → last → strong → close). */
  cycleTargetMode(uid: number): void {
    const t = this.towerByUid(uid);
    if (!t) return;
    const i = TARGET_MODES.indexOf(t.targetMode);
    this.setTargetMode(uid, TARGET_MODES[(i + 1) % TARGET_MODES.length] as TargetMode);
  }

  // ---- flow -------------------------------------------------------------------------------

  /** Start the next wave (early starts pay a bonus). */
  startNextWave(): void {
    this.sim.startNextWave();
    this.pump();
  }

  setSpeed(speed: GameSpeed): void {
    if (speed === this._speed) return;
    this._speed = speed;
    this.events.emit('speedChanged', { speed });
  }

  /** 1× → 2× → 3× → 1×. */
  cycleSpeed(): void {
    this.setSpeed(this._speed === 3 ? 1 : ((this._speed + 1) as GameSpeed));
  }

  setPaused(paused: boolean): void {
    if (paused === this._paused) return;
    this._paused = paused;
    this.events.emit('pauseChanged', { paused });
  }

  togglePause(): void {
    this.setPaused(!this._paused);
  }

  setAutoStart(autoStart: boolean): void {
    if (this.sim.autoStart === autoStart) return;
    this.sim.autoStart = autoStart;
    this.events.emit('autoStartChanged', { autoStart });
  }

  /** After a win, keep playing endless waves. */
  enterFreeplay(): void {
    this.sim.enterFreeplay();
    this.pump();
  }

  /**
   * Advance the game by one rendered frame of `dt` real seconds (clamped to MAX_FRAME_DT, scaled
   * by speed; nothing happens while paused) and dispatch the resulting events.
   */
  update(dt: number): void {
    if (!this._paused) this.sim.step(Math.min(Math.max(dt, 0), MAX_FRAME_DT) * this._speed);
    this.pump();
  }

  /** Drain the sim's events and emit them (called by `update` and after every command). */
  pump(): void {
    // Handlers may call commands that pump again; the outer call keeps draining instead, so the
    // array being iterated is never invalidated by a nested drain and no event is dropped.
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.sim.events.size > 0) {
        const list = this.sim.events.drain();
        for (let i = 0; i < list.length; i++) this.dispatch(list[i] as SimEvent);
      }
    } finally {
      this.pumping = false;
    }
    const sim = this.sim;
    if (sim.phase !== this.lastPhase || sim.wave !== this.lastWave) {
      this.lastPhase = sim.phase;
      this.lastWave = sim.wave;
      this.events.emit('waveChanged', {
        wave: sim.wave, total: sim.difficulty.waves, phase: sim.phase, freeplay: sim.freeplay,
      });
    }
  }

  /** Unsubscribe everything (scene shutdown). */
  destroy(): void {
    this.events.removeAll();
  }

  private dispatch(e: SimEvent): void {
    const ev = this.events;
    switch (e.type) {
      case 'moneyChanged':
        ev.emit('moneyChanged', { money: e.money, delta: e.delta });
        break;
      case 'livesChanged':
        ev.emit('livesChanged', { lives: e.lives, delta: e.delta });
        break;
      case 'towerPlaced':
        ev.emit('towerChanged', { uid: e.uid, change: 'placed' });
        break;
      case 'towerUpgraded':
        ev.emit('towerChanged', { uid: e.uid, change: 'upgraded' });
        break;
      case 'towerSold':
      case 'towerExpired':
        if (this._selected === e.uid) this.select(null);
        ev.emit('towerChanged', { uid: e.uid, change: e.type === 'towerSold' ? 'sold' : 'expired' });
        break;
      case 'bossSpawn':
        ev.emit('bossSpawned', { uid: e.uid, enemyId: e.enemyId, name: e.name, maxHp: e.maxHp });
        break;
      case 'bossPhase':
        ev.emit('bossPhase', { uid: e.uid, enemyId: e.enemyId, phase: e.phase, name: e.name });
        break;
      case 'gameWon':
      case 'gameLost':
        this.cancelPlacement();
        ev.emit('gameOver', { won: e.type === 'gameWon', wave: e.wave });
        break;
      default:
        break;
    }
    ev.emit('sim', e);
  }
}
