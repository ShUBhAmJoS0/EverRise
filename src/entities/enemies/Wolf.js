import Phaser from 'phaser';
import Enemy from '../Enemy.js';

const WOLF_HP        = 150;
const WOLF_SPEED     = 200;
const WOLF_ATTACK_DMG = 18;
const WOLF_ATTACK_RANGE = 90;   // px: wolf walks up close before pouncing (no body collider to stop it)
const WOLF_ATTACK_COOLDOWN = 850; // ms between bites

export default class Wolf extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'wolf-pounce', WOLF_HP);

    // Match the player's visual footing: the player rests with feet ~47px below
    // FLOOR_Y (settled into the platform). To match, the wolf's body bottom must
    // sit 47px above its feet (texture feet row 165): offsetY+sizeHeight = 165-47 = 118.
    this.body.setSize(180, 98);
    this.body.setOffset(20, 20);

    this._attackCooldown = 0;
    this._attacking = false;
    this._dying = false;
  }

  setupAnimations() {
    this.play('wolf-run');
  }

  updateBehavior(player, delta) {
    if (!this.alive || this._dying || this._attacking) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this._attackCooldown -= delta;

    if (dist <= WOLF_ATTACK_RANGE && this._attackCooldown <= 0) {
      this._attacking = true;
      this._attackCooldown = WOLF_ATTACK_COOLDOWN;
      this.body.setVelocityX(0);

      // TELEGRAPH: crouch + red flash for a beat so the pounce is readable
      // (and dodgeable) instead of instant.
      this.setTint(0xff6666);
      this.scene.tweens.add({ targets: this, scaleY: 0.88, duration: 120, yoyo: true });
      this.scene.time.delayedCall(280, () => {
        if (!this.alive) { return; }
        this.clearTint();

        // Step 1: pounce leap
        this.play('wolf-pounce', true);
        this.once('animationcomplete-wolf-pounce', () => {
          if (!this.alive) return;
          // Step 2: bite — only lands if the player is still in reach
          this.play('wolf-bite', true);
          const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
          if (d <= WOLF_ATTACK_RANGE + 40) player.takeDamage(WOLF_ATTACK_DMG);
          this.once('animationcomplete-wolf-bite', () => {
            this._attacking = false;
            if (this.alive) this.play('wolf-run', true);
          });
        });
      });
    } else if (dist > WOLF_ATTACK_RANGE) {
      // Approach using looping run animation.
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      this.body.setVelocityX(dir * WOLF_SPEED);

      if (this.anims.currentAnim?.key !== 'wolf-run') {
        this.play('wolf-run', true);
      }
    } else {
      // In range but cooldown not ready — hold position.
      this.body.setVelocityX(0);
    }
  }

  onDeath() {
    this._dying = true;
    this.body.setVelocityX(0);
    this.play('wolf-death', true);

    this.once('animationcomplete-wolf-death', () => {
      this.destroy();
    });

    // Safety fallback: destroy if animation never fires complete event.
    this.scene.time.delayedCall(2000, () => {
      if (this.active) this.destroy();
    });
  }
}
