import Phaser from 'phaser';
import { addBackdrop, titleStyle, bodyStyle, hintStyle, THEME } from '../ui/menuKit.js';

const LINES = [
  ['EVERRISE', 'title'],
  ['', ''],
  ['A Himalayan action-platformer', 'sub'],
  ['', ''],
  ['The EverRise Team', 'head'],
  ['', ''],
  ['', ''],

  ['Game Concept & Design', 'head'],
  ['Asim Ghimire   &   Shubham Joshi', 'body'],
  ['', ''],

  ['Gamification Implementation', 'head'],
  ['Asim Ghimire', 'body'],
  ['', ''],

  ['Game Script & Story', 'head'],
  ['Shubham Joshi', 'body'],
  ['', ''],
  ['', ''],

  ['—  Stage Design  —', 'sub'],
  ['', ''],

  ['Stage I · Onboarding & Reward Loop', 'head'],
  ['Asim Ghimire', 'body'],
  ['Storyline, the Guleli gift, Yarsagumba rewards & progression', 'sub'],
  ['', ''],

  ['Stage II · Challenge & Progression', 'head'],
  ['Prabin Giri', 'body'],
  ['Difficulty curve, enemy encounters & exploration rewards', 'sub'],
  ['', ''],

  ['Stage II · Risk & Discovery', 'head'],
  ['Rasrim Sigdel', 'body'],
  ['Hidden paths, risk-vs-reward, dynamic obstacles & testing', 'sub'],
  ['', ''],

  ['Stage III · Mastery & Boss Encounter', 'head'],
  ['Shubham Joshi', 'body'],
  ['Advanced combat, enemy AI, the Yeti King & achievements', 'sub'],
  ['', ''],
  ['', ''],

  ['Environmental & Puzzle Design', 'head'],
  ['Prabin Giri', 'body'],
  ['', ''],

  ['Level Testing & Balancing', 'head'],
  ['Rasrim Sigdel', 'body'],
  ['', ''],

  ['Assets', 'head'],
  ['Prabin Giri   ·   Rasrim Sigdel   ·   Shubham Joshi', 'body'],
  ['', ''],

  ['Animation & Sound', 'head'],
  ['Asim Ghimire', 'body'],
  ['', ''],

  ['Programming', 'head'],
  ['Built on Phaser 3', 'body'],
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
    this.input.setDefaultCursor('default');   // cursor visible on the end screen
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

    // Slow auto-scroll, then loop. Duration scales with the reel length so the
    // scroll SPEED stays constant (and readable) no matter how many credits.
    const totalHeight = y - h;
    const travel = totalHeight + 80;
    this.tweens.add({
      targets: container, y: -travel,
      duration: Math.round(travel / 0.07),   // ~70 px/s
      ease: 'Linear', repeat: -1,
    });

    this.add.text(w / 2, h - 28, 'Esc / Enter to return', hintStyle).setOrigin(0.5).setDepth(6);
    this.input.keyboard.on('keydown-ESC',   () => this.scene.start('MainMenuScene'));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('MainMenuScene'));
  }
}
