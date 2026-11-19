import Phaser from 'phaser';
import type { DifficultyDef } from '../sim/types';
import type { SimSnapshot } from '../sim/snapshot';
import { GameSim } from '../sim/GameSim';
import { DIFFICULTIES } from '../data/difficulty';
import { MAPS, getMap } from '../data/maps';
import { SPRITE_ART, artEntries, loadArt } from '../data/loadArt';
import { WorldRenderer } from '../render/WorldRenderer';
import type { ParticleQuality } from '../render/quality';
import { GameController, MAX_FRAME_DT } from './game/GameController';
import { GameInput } from './game/GameInput';
import { GameHotkeys } from './game/GameHotkeys';
import { debugEnabled, installDebugApi, type DebugApi } from './game/debugApi';
import { stressWaves } from './game/stress';
import { AudioDirector } from './game/AudioDirector';
import { SaveDirector } from './game/SaveDirector';
import { AudioService } from '../services/AudioService';
import { getSaveService } from '../services/SaveService';

/** What a game is started with. */
export interface GameSceneData {
  mapId: string;
  difficulty: DifficultyDef['id'];
  /** Resume from a between-waves save. */
  save?: SimSnapshot;
  /** Debug only: replace the waves with one wave of this many enemies (perf checks). */
  stress?: number;
}

const DEFAULT_DATA: GameSceneData = { mapId: 'green-valley', difficulty: 'normal' };

/**
 * One running game: owns the sim (through a GameController), the world renderer and field
 * input. The HUD (a separate scene) reaches the controller via `scene.get('GameScene').controller`.
 */
export class GameScene extends Phaser.Scene {
  /** Valid after `create`; the HUD's single entry point. */
  controller!: GameController;
  private world!: WorldRenderer;
  private gameInput!: GameInput;
  private hotkeys!: GameHotkeys;
  private debug: DebugApi | null = null;
  /** Audio cues and autosave (no saves in stress mode). */
  private directors: { destroy(): void }[] = [];
  private params: GameSceneData = DEFAULT_DATA;
  /** Smoothed CPU time of `update` (sim + view sync), excluding WebGL drawing. */
  private updateMs = 0;

  constructor() {
    super('GameScene');
  }

  init(data: Partial<GameSceneData>): void {
    this.params = { ...DEFAULT_DATA, ...data };
  }

  preload(): void {
    const map = this.resolveMap();
    loadArt(this.load, this.textures, [...SPRITE_ART, ...artEntries([map.background])]);
  }

  create(): void {
    const map = this.resolveMap();
    const difficulty = DIFFICULTIES[this.params.difficulty] ?? DIFFICULTIES.normal;
    const save = this.params.save;
    const debug = debugEnabled();
    const stress = debug ? (this.params.stress ?? 0) : 0;
    const sim = new GameSim({
      map,
      difficulty,
      seed: save?.seed ?? (Math.random() * 2 ** 31) >>> 0,
      save,
      ...(stress > 0 ? { waves: stressWaves(stress, map.paths.length) } : {}),
    });
    if (stress > 0) sim.grantMoney(1_000_000);
    this.controller = new GameController(sim);
    this.world = new WorldRenderer(this, sim);
    const c = this.controller;
    c.events.on('sim', (e) => this.world.handle(e));
    c.events.on('selectionChanged', ({ uid }) => this.world.setSelection(uid));
    this.gameInput = new GameInput(this, c, this.world);
    this.hotkeys = new GameHotkeys(this.input.keyboard, c);
    this.directors = [new AudioDirector(c, AudioService.install(this.game)), ...(stress > 0 ? [] : [new SaveDirector(c, getSaveService())])];
    this.debug = debug
      ? installDebugApi(c, () => ({
        fps: Math.round(this.game.loop.actualFps),
        updateMs: Math.round(this.updateMs * 100) / 100,
        ...this.world.stats(),
      }), (mapId) => this.scene.restart({ ...this.params, ...(mapId ? { mapId } : {}) }))
      : null;
    this.cameras.main.fadeIn(350, 13, 17, 23);
    this.scene.launch('HudScene');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  update(): void {
    const t0 = performance.now();
    // Raw delta: Phaser's smoothed delta is capped at 60 fps for the first frames after start,
    // which would run the game in slow motion on slow devices. MAX_FRAME_DT clamps spikes.
    const dt = Math.min(this.game.loop.rawDelta / 1000, MAX_FRAME_DT);
    const c = this.controller;
    c.update(dt);
    const gameDt = c.paused ? 0 : dt * c.speed;
    this.gameInput.update();
    this.world.update(gameDt, dt, c.selectedTower());
    this.updateMs += (performance.now() - t0 - this.updateMs) * 0.05;
    if (this.debug && !this.debug.ready) this.debug.ready = true;
  }

  /** Particle detail level (for the settings screen). */
  setParticleQuality(quality: ParticleQuality): void {
    this.world.setQuality(quality);
  }

  private resolveMap() {
    const map = getMap(this.params.mapId) ?? MAPS[1] ?? MAPS[0];
    if (!map) throw new Error('No maps defined');
    return map;
  }

  private teardown(): void {
    this.scene.stop('HudScene');
    this.gameInput.destroy();
    this.hotkeys.destroy();
    for (const d of this.directors) d.destroy();
    this.controller.destroy();
    if (this.debug && window.__LDTD__ === this.debug) delete window.__LDTD__;
    this.debug = null;
    // A 1540×1080 map is several MB of GPU memory: free it so maps never stack up on phones.
    // Restarting the same map reloads it from the browser cache.
    const key = this.world.background.texture.key;
    this.world.background.destroy();
    this.textures.remove(key);
  }
}
