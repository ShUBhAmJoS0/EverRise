import Phaser from 'phaser';

export default class StageCompleteScene extends Phaser.Scene {
  constructor() {
    super('StageCompleteScene');
  }

  create() {
    const cx = this.scale.width  / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.75);

    this.add.text(cx, cy - 80, 'STAGE 1 COMPLETE', {
      fontSize: '52px',
      fill: '#ffdd44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, cy, 'The Forest Witch has been defeated.', {
      fontSize: '22px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const nextBtn = this.add.text(cx, cy + 100, '[ Press ENTER to continue to Stage 2 ]', {
      fontSize: '20px',
      fill: '#aaffaa',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    nextBtn.on('pointerover', () => nextBtn.setFill('#ffffff'));
    nextBtn.on('pointerout',  () => nextBtn.setFill('#aaffaa'));
    nextBtn.on('pointerdown', () => this._next());

    this.input.keyboard.once('keydown-ENTER', () => this._next());
  }

  _next() {
    this.scene.start('Stage2Scene');
  }
}
