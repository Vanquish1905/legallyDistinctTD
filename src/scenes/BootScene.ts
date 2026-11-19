import Phaser from 'phaser';
import { COLORS, COLORS_NUM, FONT_FAMILY, GAME_H, GAME_W } from '../config';
import { SPRITE_ART, artEntries, loadArt } from '../data/loadArt';
import { getMap } from '../data/maps';
import { DIFFICULTY_ORDER } from '../data/difficulty';
import type { GameSceneData } from './GameScene';
import { debugEnabled } from './game/debugApi';
import { AudioService } from '../services/AudioService';

const BAR_W = 720;
const BAR_H = 18;
const FONT_WAIT_MS = 1200;

const STATUS = [
  'Oiling the turrets',
  'Counting larvae',
  'Calibrating the railgun',
  'Untangling tesla coils',
  'Bribing the helicopter pilot',
  'Polishing spikes',
];

/**
 * Branded loader: shows the logo and a progress bar while every sprite texture (and the first
 * map) loads, then fades into the game. Query parameters `map`, `difficulty` and `stress`
 * choose what to start (until the main menu exists).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    loadArt(this.load, this.textures, artEntries(['logo']));
    // Sound effects decode in the background and the first song is fetched on demand: boot never waits for audio.
    AudioService.install(this.game).loadBootAudio('game');
  }

  create(): void {
    const start = startData();
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.drawBackdrop();
    const logo = this.add.image(cx, cy - 110, 'logo').setScale(0.82).setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, y: cy - 130, duration: 600, ease: 'Cubic.easeOut' });

    const barY = cy + 150;
    const frame = this.add.graphics();
    frame.fillStyle(COLORS_NUM.panel, 0.92).fillRoundedRect(cx - BAR_W / 2 - 6, barY - BAR_H / 2 - 6, BAR_W + 12, BAR_H + 12, 14);
    frame.lineStyle(1, COLORS_NUM.panelBorder, 1).strokeRoundedRect(cx - BAR_W / 2 - 6, barY - BAR_H / 2 - 6, BAR_W + 12, BAR_H + 12, 14);
    const fill = this.add.graphics();
    const drawFill = (p: number): void => {
      const w = Math.max(BAR_H, BAR_W * p);
      fill.clear();
      fill.fillStyle(COLORS_NUM.accent, 0.25).fillRoundedRect(cx - BAR_W / 2 - 2, barY - BAR_H / 2 - 2, w + 4, BAR_H + 4, 10);
      fill.fillStyle(COLORS_NUM.accent, 1).fillRoundedRect(cx - BAR_W / 2, barY - BAR_H / 2, w, BAR_H, 9);
      fill.fillStyle(0xffffff, 0.3).fillRoundedRect(cx - BAR_W / 2 + 4, barY - BAR_H / 2 + 3, Math.max(0, w - 8), 4, 2);
    };
    drawFill(0);

    const status = this.add
      .text(cx, barY + 46, '', { fontFamily: FONT_FAMILY, fontSize: '26px', color: COLORS.textDim })
      .setOrigin(0.5);
    const pct = this.add
      .text(cx + BAR_W / 2, barY - 34, '0%', { fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold', color: COLORS.accent })
      .setOrigin(1, 0.5);
    let progress = 0;
    const setStatus = (): void => {
      const line = STATUS[Math.min(STATUS.length - 1, Math.floor(progress * STATUS.length))] ?? '';
      status.setText(`${line}...`);
    };
    setStatus();

    const map = getMap(start.mapId);
    loadArt(this.load, this.textures, [...SPRITE_ART, ...(map ? artEntries([map.background]) : [])]);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      progress = p;
      drawFill(p);
      pct.setText(`${Math.round(p * 100)}%`);
      setStatus();
    });
    let loaded = false;
    let fontsReady = false;
    const proceed = (): void => {
      if (!loaded || !fontsReady) return;
      this.cameras.main.fadeOut(300, 13, 17, 23);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene', start));
    };
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      loaded = true;
      drawFill(1);
      pct.setText('100%');
      status.setText('Ready');
      proceed();
    });
    waitForFonts().then(() => {
      fontsReady = true;
      // Re-render the texts now that Rubik is (probably) available.
      status.style.update(true);
      pct.style.update(true);
      proceed();
    });
    this.load.start();
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x111a2c, 0x111a2c, 0x0d1117, 0x0d1117, 1).fillRect(0, 0, GAME_W, GAME_H);
    g.lineStyle(1, 0x1c2638, 0.6);
    for (let x = 0; x <= GAME_W; x += 64) g.lineBetween(x, 0, x, GAME_H);
    for (let y = 0; y <= GAME_H; y += 64) g.lineBetween(0, y, GAME_W, y);
  }
}

/** Game start parameters from the page URL (defaults: Green Valley on Normal). */
function startData(): GameSceneData {
  const q = new URLSearchParams(window.location.search);
  const mapId = q.get('map') ?? 'green-valley';
  const diff = q.get('difficulty');
  const difficulty = DIFFICULTY_ORDER.find((d) => d === diff) ?? 'normal';
  const stress = debugEnabled() ? Number(q.get('stress') ?? 0) : 0;
  return {
    mapId: getMap(mapId) ? mapId : 'green-valley',
    difficulty,
    ...(stress > 0 ? { stress: Math.min(1000, Math.floor(stress)) } : {}),
  };
}

/** Resolve when the UI font is ready or after a short timeout (offline, blocked fonts). */
function waitForFonts(): Promise<void> {
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  const fonts = document.fonts?.load(`700 32px Rubik`).then(() => undefined, () => undefined) ?? Promise.resolve();
  return Promise.race([fonts, timeout]);
}
