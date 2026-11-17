import Phaser from 'phaser';
import { COLORS, FIELD_W, FONT_FAMILY, GAME_H, GAME_W } from '../config';
import { ART_MANIFEST } from '../data/artManifest';
import { MAPS } from '../data/maps';
import { TOWER_ORDER_PREVIEW, ENEMY_PREVIEW } from './bootPreview';

declare global {
  interface Window {
    /** Test hook: set once the first scene has finished creating. */
    __LDTD__?: { ready: boolean; textures?: number };
  }
}

/**
 * Loads every generated texture with a branded progress bar, then shows a
 * preview of the new art: a map background, parasites marching along its path
 * and the tower line-up. The playable scenes plug in after this one.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const barW = 640;
    const x = (GAME_W - barW) / 2;
    const y = GAME_H / 2 + 60;
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, 'LegallyDistinctTD', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        fontStyle: 'bold',
        color: COLORS.accent,
      })
      .setOrigin(0.5);
    this.add.rectangle(x, y, barW, 14, 0x121826).setOrigin(0, 0.5).setStrokeStyle(1, 0x2f3b55);
    const fill = this.add.rectangle(x + 2, y, 0, 10, 0x38bdf8).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => fill.setSize((barW - 4) * p, 10));

    for (const e of ART_MANIFEST) {
      this.load.svg(e.key, e.path, { width: e.width, height: e.height });
    }
  }

  create(): void {
    this.children.removeAll(true);
    const map = MAPS.find((m) => m.id === 'green-valley') ?? MAPS[0];
    if (!map) throw new Error('No maps defined');

    this.add.image(0, 0, map.background).setOrigin(0, 0);
    this.add.rectangle(FIELD_W, 0, GAME_W - FIELD_W, GAME_H, 0x0d1117).setOrigin(0, 0);

    this.marchParasites(map.paths[0] ?? []);
    this.showTowerLineup();

    this.add.image(FIELD_W / 2, 190, 'logo').setScale(0.55);
    this.add
      .text(FIELD_W / 2, GAME_H - 48, 'New engine under construction: the full game is coming together', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: '#e2e8f0',
        backgroundColor: '#121826dd',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);

    window.__LDTD__ = { ready: true, textures: ART_MANIFEST.length };
  }

  /** Sends a looping parade of enemies along the path polyline. */
  private marchParasites(path: ReadonlyArray<{ x: number; y: number }>): void {
    if (path.length < 2) return;
    const curve = new Phaser.Curves.Path(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) curve.lineTo(path[i]!.x, path[i]!.y);
    const length = curve.getLength();

    ENEMY_PREVIEW.forEach((key, i) => {
      const sprite = this.add.image(0, 0, key).setScale(0.7);
      const state = { t: 0 };
      this.tweens.add({
        targets: state,
        t: 1,
        duration: (length / 90) * 1000,
        delay: i * 900,
        repeat: -1,
        onUpdate: () => {
          const p = curve.getPoint(state.t);
          const ahead = curve.getPoint(Math.min(1, state.t + 0.002));
          sprite.setPosition(p.x, p.y);
          sprite.setRotation(Phaser.Math.Angle.Between(p.x, p.y, ahead.x, ahead.y));
        },
      });
    });
  }

  /** Lists every tower (base + turret) in the sidebar area. */
  private showTowerLineup(): void {
    const cols = 3;
    const cell = 118;
    const x0 = FIELD_W + (GAME_W - FIELD_W - cols * cell) / 2 + cell / 2;
    TOWER_ORDER_PREVIEW.forEach((id, i) => {
      const x = x0 + (i % cols) * cell;
      const y = 80 + Math.floor(i / cols) * cell;
      this.add.image(x, y, `tower-${id}-base`).setScale(0.75);
      const turret = this.add.image(x, y, `tower-${id}-turret`).setScale(0.75);
      this.tweens.add({ targets: turret, angle: 360, duration: 6000 + i * 250, repeat: -1 });
    });
  }
}
