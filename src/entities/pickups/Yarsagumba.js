import Phaser from 'phaser';
import Audio from '../../systems/AudioManager.js';
import { impactSparks } from '../../systems/fx.js';

// The sacred Himalayan herb, left in the grass after the snake ambush.
// Walk close → "E · Eat" prompt → +25 max HP (and a heal). One per stage,
// remembered in the registry so it doesn't respawn after being eaten.

const PICKUP_RANGE = 80;
const MAX_HP_BONUS = 25;
const HEAL_BONUS   = 25;

export default class Yarsagumba extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, registryKey) {
    super(scene, x, y, 'yarsagumba');
    scene.add.existing(this);

    this._registryKey = registryKey;
    this.setOrigin(0.5, 1);
    this.setDepth(9);

    // gentle glow-pulse so it catches the eye without a UI marker
    scene.tweens.add({ targets: this, scaleX: 1.12, scaleY: 1.12, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    this._sparkle = scene.time.addEvent({
      delay: 700, loop: true,
      callback: () => { if (this.active) impactSparks(scene, this.x, this.y - 22, 0xffe9a0, 2); },
    });

    this._prompt = scene.add.text(x, y - 58, 'E · Eat the Yarsagumba', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffe9a0',
      backgroundColor: 'rgba(10,7,3,0.75)', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(30).setVisible(false);
  }

  // Call from the scene's update with the player.
  update(player) {
    if (!this.active) return;
    const near = Math.abs(player.x - this.x) < PICKUP_RANGE && Math.abs(player.y - this.y) < 130;
    this._prompt.setVisible(near);
    if (near && player.controls.interactPressed) this._consume(player);
  }

  _consume(player) {
    this.scene.registry.set(this._registryKey, true);
    player.increaseMaxHp(MAX_HP_BONUS, HEAL_BONUS);
    Audio.play('pickup');
    impactSparks(this.scene, this.x, this.y - 20, 0x9fe6a0, 14);

    // floating reward text
    const t = this.scene.add.text(this.x, this.y - 46, `MAX HP +${MAX_HP_BONUS}`, {
      fontFamily: 'Georgia, serif', fontSize: '19px', color: '#9fe6a0',
      stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 1300, onComplete: () => t.destroy() });

    this._sparkle.remove();
    this._prompt.destroy();
    this.destroy();
  }

  destroy(fromScene) {
    this._sparkle?.remove();
    this._prompt?.destroy();
    super.destroy(fromScene);
  }
}
