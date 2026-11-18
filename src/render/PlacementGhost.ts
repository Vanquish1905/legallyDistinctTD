import type Phaser from 'phaser';
import type { TowerDef } from '../sim/types';
import { DEPTH } from './layers';
import { RANGE_BAD, RANGE_PLACE_OK, RangeIndicator } from './RangeIndicator';
import { towerScale } from './sizes';

const BAD_TINT = 0xff6b81;

/** Translucent preview of the tower being placed, with its range and a validity colour. */
export class PlacementGhost {
  private readonly base: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private readonly footprint: Phaser.GameObjects.Graphics;
  private readonly range: RangeIndicator;
  private def: TowerDef | null = null;
  private ok: boolean | null = null;
  private time = 0;

  constructor(scene: Phaser.Scene) {
    this.range = new RangeIndicator(scene, DEPTH.ghost - 1);
    this.footprint = scene.add.graphics().setDepth(DEPTH.ghost - 0.5).setVisible(false);
    this.base = scene.add.image(0, 0, 'tower-blaster-base').setDepth(DEPTH.ghost).setVisible(false);
    this.turret = scene.add.image(0, 0, 'tower-blaster-turret').setDepth(DEPTH.ghost + 0.1).setVisible(false);
  }

  /** Show `def` at (x, y); `range` is its current range (0 for none). */
  show(def: TowerDef, x: number, y: number, ok: boolean, range: number): void {
    if (def !== this.def) {
      this.def = def;
      this.ok = null;
      const s = towerScale(def.footprint);
      this.base.setTexture(def.sprite.base).setScale(s);
      this.turret.setTexture(def.sprite.turret ?? def.sprite.base).setScale(s).setRotation(-Math.PI / 2);
    }
    if (ok !== this.ok) {
      this.ok = ok;
      for (const img of [this.base, this.turret]) {
        if (ok) img.clearTint();
        else img.setTint(BAD_TINT);
      }
      const color = ok ? RANGE_PLACE_OK : RANGE_BAD;
      this.footprint.clear().lineStyle(3, color, 0.95).strokeCircle(0, 0, def.footprint);
      this.footprint.fillStyle(color, 0.18).fillCircle(0, 0, def.footprint);
    }
    const color = ok ? RANGE_PLACE_OK : RANGE_BAD;
    this.range.show(x, y, range, color);
    this.footprint.setPosition(x, y).setVisible(true);
    this.base.setPosition(x, y).setVisible(true).setAlpha(ok ? 0.85 : 0.6);
    this.turret.setPosition(x, y).setVisible(true).setAlpha(ok ? 0.9 : 0.6);
  }

  /** Gentle breathing of the ghost while visible. */
  update(dt: number): void {
    if (!this.base.visible) return;
    this.time += dt;
    this.footprint.setAlpha(0.75 + 0.25 * Math.sin(this.time * 6));
  }

  hide(): void {
    this.def = null;
    this.base.setVisible(false);
    this.turret.setVisible(false);
    this.footprint.setVisible(false);
    this.range.hide();
  }

  get visible(): boolean {
    return this.base.visible;
  }
}
