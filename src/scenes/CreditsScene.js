import Phaser from 'phaser';
import { addBackdrop, titleStyle, bodyStyle, hintStyle, THEME } from '../ui/menuKit.js';

const LINES = [
  ['EVERRISE', 'title'],
  ['', ''],
  ['A Himalayan action-platformer', 'sub'],
  ['', ''],
  ['Design & Direction', 'head'],
  ['The EverRise Team', 'body'],
  ['', ''],
  ['Programming', 'head'],
  ['Built on Phaser 3', 'body'],
  ['', ''],
  ['Art & Animation', 'head'],
  ['Original character, enemy & environment art', 'body'],
  ['', ''],
  ['Inspired by', 'head'],
  ['The mountains, temples & legends of Nepal', 'body'],
  ['', ''],
  ['Khukuri & Guleli — traditional Nepali arms', 'body'],
];

export default class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create() {
    const { width: w, height: h } = this.scale;
    addBackdrop(this, { texture: 'stage3-bg' });

    const container = this.add.container(0, 0).setDepth(5);
    let y = h + 40;
    for (const [text, kind] of LINES) {
      let style = bodyStyle;
      if (kind === 'title') style = { ...titleStyle, fontSize: '54px' };
      else if (kind === 'sub') style = { ...bodyStyle, fontStyle: 'italic', color: THEME.cream };
      else if (kind === 'head') style = { ...bodyStyle, color: THEME.gold, fontStyle: 'bold' };
      const t = this.add.text(w / 2, y, text, style).setOrigin(0.5);
      container.add(t);
      y += (kind === 'title' ? 70 : 38);
    }

    // Slow auto-scroll, then loop.
    const totalHeight = y - h;
    this.tweens.add({
      targets: container, y: -(totalHeight + 80),
      duration: 14000, ease: 'Linear', repeat: -1,
    });

    this.add.text(w / 2, h - 28, 'Esc / Enter to return', hintStyle).setOrigin(0.5).setDepth(6);
    this.input.keyboard.on('keydown-ESC',   () => this.scene.start('MainMenuScene'));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('MainMenuScene'));
  }
}
