import Phaser from 'phaser';
import Audio from '../../systems/AudioManager.js';
import { impactSparks } from '../../systems/fx.js';

// The sacred Himalayan herb. Walk close → "E · Eat / R · Store".
//   Eat   → +25 max HP (and a heal), now — persisted in registry 'hpBonus'.
//   Store → tucked into the pocket (registry 'yarsaPocket') to eat later via Tab.
// The registryKey marks it "taken" so it doesn't respawn on a death-restart.

const PICKUP_RANGE = 80;
const MAX_HP_BONUS = 25;
const HEAL_BONUS   = 25;

// Shared: eating a herb (from the ground OR the pocket) grants the bonus and
// records it so it survives a death/restart.
export function eatYarsagumba(scene, player) {
  player.increaseMaxHp(MAX_HP_BONUS, HEAL_BONUS);
  scene.registry.set('hpBonus', (scene.registry.get('hpBonus') || 0) + MAX_HP_BONUS);
  Audio.play('pickup');
}

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

    this._prompt = scene.add.text(x, y - 58, 'E · Eat     R · Store', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffe9a0',
      backgroundColor: 'rgba(10,7,3,0.75)', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(30).setVisible(false);
  }

  // Call from the scene's update with the player.
  update(player) {
    if (!this.active) return;
    const near = Math.abs(player.x - this.x) < PICKUP_RANGE && Math.abs(player.y - this.y) < 130;
    this._prompt.setVisible(near);
    if (!near) return;
    if (player.controls.interactPressed)   this._consume(player);
    else if (player.controls.storePressed) this._store(player);
  }

  _consume(player) {
    if (this._registryKey) this.scene.registry.set(this._registryKey, true);
    eatYarsagumba(this.scene, player);
    impactSparks(this.scene, this.x, this.y - 20, 0x9fe6a0, 14);
    this._floatText(`MAX HP +${MAX_HP_BONUS}`, '#9fe6a0');
    this._cleanup();
  }

  _store(player) {
    if (this._registryKey) this.scene.registry.set(this._registryKey, true);
    this.scene.registry.set('yarsaPocket', (this.scene.registry.get('yarsaPocket') || 0) + 1);
    Audio.play('menuSelect');
    impactSparks(this.scene, this.x, this.y - 20, 0xffe9a0, 8);
    this._floatText('Stored  [Tab]', '#ffe9a0');
    this._cleanup();
  }

  _floatText(msg, color) {
    const t = this.scene.add.text(this.x, this.y - 46, msg, {
      fontFamily: 'Georgia, serif', fontSize: '18px', color,
      stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: t, y: t.y - 44, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }

  _cleanup() {
    this._sparkle?.remove();
    this._prompt?.destroy();
    this.destroy();
  }

  destroy(fromScene) {
    this._sparkle?.remove();
    this._prompt?.destroy();
    super.destroy(fromScene);
  }
}
