import type Phaser from 'phaser';
import { COLORS, FIELD_W, FONT_FAMILY, GAME_H, GAME_W } from '../../config';
import { DEPTH } from '../../render/layers';
import type { GameController } from './GameController';

const HELP = [
  'Keys',
  '1-9, 0  pick a tower',
  'Shift   keep placing',
  'Esc / right-click  cancel',
  'U / I   upgrade path 1 / 2',
  'S / Del sell',
  'Tab     target mode',
  'Space   next wave',
  'F speed   P pause',
].join('\n');

/**
 * Stand-in sidebar until the real HUD lands: a status readout fed by controller events and a
 * key list. Exists to make the scene playable and to exercise the controller API.
 */
export class DevOverlay {
  private readonly status: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly c: GameController) {
    const x = FIELD_W;
    scene.add.rectangle(x, 0, GAME_W - FIELD_W, GAME_H, 0x121826, 0.96).setOrigin(0, 0).setDepth(DEPTH.ui);
    scene.add.rectangle(x, 0, 1, GAME_H, 0x2f3b55).setOrigin(0, 0).setDepth(DEPTH.ui);
    const style = { fontFamily: FONT_FAMILY, fontSize: '26px', color: COLORS.text, lineSpacing: 10 };
    this.status = scene.add.text(x + 28, 32, '', style).setDepth(DEPTH.ui);
    scene.add
      .text(x + 28, GAME_H - 380, HELP, { ...style, fontSize: '21px', color: COLORS.textDim })
      .setDepth(DEPTH.ui);
    const refresh = (): void => this.refresh();
    for (const ev of ['moneyChanged', 'livesChanged', 'waveChanged', 'speedChanged', 'pauseChanged', 'selectionChanged', 'placementChanged', 'towerChanged'] as const) {
      c.events.on(ev, refresh);
    }
    this.refresh();
  }

  private refresh(): void {
    const c = this.c;
    const sim = c.sim;
    const sel = c.selectedTower();
    const lines = [
      `Money   ${sim.money}`,
      `Lives   ${sim.lives}`,
      `Wave    ${sim.wave} / ${sim.difficulty.waves}`,
      `Speed   ${c.speed}x${c.paused ? '  (paused)' : ''}`,
      `Phase   ${sim.phase}`,
      '',
      c.pendingTowerId ? `Placing ${c.pendingTowerId}` : sel ? `${sel.def.name}  ${sel.tiers[0]}/${sel.tiers[1]}  [${sel.targetMode}]` : '',
    ];
    this.status.setText(lines.join('\n'));
  }
}
