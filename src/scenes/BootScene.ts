import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_H, GAME_W } from '../config';

declare global {
  interface Window {
    /** Test hook: set once the first scene has finished creating. */
    __LDTD__?: { ready: boolean };
  }
}

/** Placeholder boot scene; later replaced by the branded loader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.add
      .text(GAME_W / 2, GAME_H / 2, 'LegallyDistinctTD', {
        fontFamily: FONT_FAMILY,
        fontSize: '96px',
        fontStyle: 'bold',
        color: COLORS.accent,
      })
      .setOrigin(0.5);
    window.__LDTD__ = { ready: true };
  }
}
