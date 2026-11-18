import Phaser from 'phaser';
import type { TowerDef, Vec2 } from '../../sim/types';
import { TOWERS } from '../../data/towers';
import { FIELD_W, GAME_H, TOPBAR_H } from '../../config';
import type { WorldRenderer } from '../../render/WorldRenderer';
import type { GameController } from './GameController';

/** Pointer travel (px) below which a press counts as a tap. */
const TAP_SLOP = 14;
/** On touch, a dragged ghost floats this far above the finger so it stays visible. */
const TOUCH_LIFT = 70;

/**
 * Field pointer and keyboard handling: placement ghost (mouse hover, or touch drag-and-release /
 * tap), tower selection, right-click / Esc cancel, Shift to keep placing.
 */
export class GameInput {
  private downX = 0;
  private downY = 0;
  private down = false;
  private dragged = false;
  private touch = false;
  /** Last pointer position on the field, or null when the pointer is elsewhere. */
  private hover: Vec2 | null = null;
  private readonly hoverPos: Vec2 = { x: 0, y: 0 };
  private readonly ghostPos: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly controller: GameController,
    private readonly world: WorldRenderer,
  ) {
    const input = scene.input;
    input.mouse?.disableContextMenu();
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    input.keyboard?.on('keydown-ESC', this.onEscape, this);
    controller.events.on('placementChanged', ({ towerId }) => {
      if (towerId === null) this.world.ghost.hide();
      else if (this.touch && !this.down) this.hover = null;
    });
  }

  /** Refresh the ghost every frame (money and towers change validity even when idle). */
  update(): void {
    const id = this.controller.pendingTowerId;
    const def = id === null ? undefined : (TOWERS[id as keyof typeof TOWERS] as TowerDef | undefined);
    if (!def || !this.hover) {
      this.world.ghost.hide();
      return;
    }
    const check = this.controller.resolvePlacement(this.hover.x, this.hover.y, this.ghostPos);
    const range = def.stats.buff?.radius ?? def.stats.range;
    this.world.ghost.show(def, this.ghostPos.x, this.ghostPos.y, check.ok, range);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    input.keyboard?.off('keydown-ESC', this.onEscape, this);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.touch = p.wasTouch;
    if (p.rightButtonDown()) return;
    if (this.blocked(p.x, p.y)) return;
    this.down = true;
    this.dragged = false;
    this.downX = p.x;
    this.downY = p.y;
    this.track(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    this.touch = p.wasTouch;
    if (this.down && Math.hypot(p.x - this.downX, p.y - this.downY) > TAP_SLOP) this.dragged = true;
    if (this.touch && !p.isDown) return;
    this.track(p);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const c = this.controller;
    const wasDown = this.down;
    this.down = false;
    if (p.rightButtonReleased()) {
      if (c.pendingTowerId !== null) c.cancelPlacement();
      else c.select(null);
      return;
    }
    if (this.blocked(p.x, p.y)) {
      if (this.touch) this.hover = null;
      return;
    }
    this.track(p);
    if (c.pendingTowerId !== null) {
      // A press that started on the HUD (drag from a tower card) has no matching down here.
      const pos = this.hover ?? this.hoverPos;
      const keep = isShift(p);
      const placed = c.placeAt(pos.x, pos.y, keep);
      if (placed && this.touch && c.pendingTowerId === null) this.hover = null;
      return;
    }
    if (!wasDown || this.dragged) return;
    const t = c.towerAt(p.x, p.y);
    c.select(t ? t.uid : null);
  }

  private onOut(): void {
    if (!this.touch) this.hover = null;
  }

  private onEscape(): void {
    const c = this.controller;
    if (c.pendingTowerId !== null) c.cancelPlacement();
    else c.select(null);
  }

  /** Remember the pointer as a field position (lifted above the finger while touch-dragging). */
  private track(p: Phaser.Input.Pointer): void {
    if (this.blocked(p.x, p.y) && !(this.touch && this.down)) {
      this.hover = null;
      return;
    }
    const lift = this.touch && this.dragged ? TOUCH_LIFT : 0;
    this.hoverPos.x = p.x;
    this.hoverPos.y = p.y - lift;
    this.hover = this.hoverPos;
  }

  /** Outside the play field, or over HUD elements the controller was told about. */
  private blocked(x: number, y: number): boolean {
    if (x < 0 || x >= FIELD_W || y < TOPBAR_H || y >= GAME_H) return true;
    return this.controller.pointerBlocker?.(x, y) ?? false;
  }
}

function isShift(p: Phaser.Input.Pointer): boolean {
  const ev = p.event as { shiftKey?: boolean } | undefined;
  return ev?.shiftKey === true;
}
