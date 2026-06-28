import Phaser from 'phaser';
import { addBackdrop, titleStyle, bodyStyle, hintStyle, THEME } from '../ui/menuKit.js';

const BINDINGS = [
  ['W A S D  /  Arrows', 'Move'],
  ['Left Shift',         'Sprint'],
  ['Space  (or W / ↑)',  'Jump  •  press again to Double Jump'],
  ['Q',                  'Dodge roll (brief invulnerability)'],
  ['Enter  (or Z)',      'Khukuri — standard attack'],
  ['Right Shift',        'Khukuri — combo attack'],
  ['Right Ctrl',         'Guleli — ranged stone  (hold W/S to aim up/down)'],
  ['E',                  'Interact — eat herbs, advance story'],
  ['Esc',                'Pause menu'],
  ['F1',                 'Toggle debug overlay (dev)'],
];

export default class ControlsScene extends Phaser.Scene {
  constructor() {
    super('ControlsScene');
  }

  create(data) {
    const { width: w, height: h } = this.scale;
    this._from = data?.from || 'MainMenuScene';
    this._gameplayKey = data?.gameplayKey;

    addBackdrop(this, { texture: 'stage3-bg' });
    this.add.text(w / 2, 84, 'CONTROLS', titleStyle).setOrigin(0.5).setDepth(5);

    // Two-column "key → action" table on a parchment panel.
    const panelW = 900, panelH = 470;
    this.add.rectangle(w / 2, 380, panelW, panelH, 0x140d05, 0.66)
      .setStrokeStyle(2, THEME.goldHex, 0.7).setDepth(4);

    const keyX = w / 2 - panelW / 2 + 48;
    const actX = w / 2 - 60;
    let y = 190;
    for (const [key, action] of BINDINGS) {
      this.add.text(keyX, y, key, { ...bodyStyle, color: THEME.gold, fontStyle: 'bold' })
        .setOrigin(0, 0.5).setDepth(5);
      this.add.text(actX, y, action, bodyStyle).setOrigin(0, 0.5).setDepth(5);
      y += 46;
    }

    const back = this.add.text(w / 2, h - 56, '‹ Back', { ...bodyStyle, color: THEME.gold })
      .setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setScale(1.12));
    back.on('pointerout',  () => back.setScale(1));
    back.on('pointerdown', () => this._back());
    this.input.keyboard.on('keydown-ESC',   () => this._back());
    this.input.keyboard.on('keydown-ENTER', () => this._back());

    this.add.text(w / 2, h - 26, 'Esc / Enter to go back', hintStyle).setOrigin(0.5).setDepth(5);
  }

  _back() { this.scene.start(this._from, { gameplayKey: this._gameplayKey }); }
}
