import Phaser from 'phaser';
import SaveManager from '../systems/SaveManager.js';
import { addBackdrop, verticalMenu, titleStyle, hintStyle } from '../ui/menuKit.js';

const STAGES = [
  { key: 'Stage1Scene', name: 'I · Whispering Forest' },
  { key: 'Stage2Scene', name: 'II · Frozen Mountain Ruins' },
  { key: 'Stage3Scene', name: 'III · Glacier of the Ancients' },
];

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    const { width: w, height: h } = this.scale;
    addBackdrop(this, { texture: 'stage2-bg' });
    this.add.text(w / 2, 110, 'LEVEL SELECT', titleStyle).setOrigin(0.5).setDepth(5);

    const reached = SaveManager.progress.stageReached;
    const items = STAGES.map((s, i) => ({
      label: i + 1 <= reached ? s.name : `${s.name}  🔒`,
      enabled: i + 1 <= reached,
      onSelect: () => this._go(s.key),
    }));
    items.push({ label: '‹ Back', onSelect: () => this.scene.start('MainMenuScene') });

    verticalMenu(this, w / 2, 240, items);

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
    this.add.text(w / 2, h - 34, 'Esc to go back', hintStyle).setOrigin(0.5).setDepth(5);
  }

  _go(key) {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
  }
}
