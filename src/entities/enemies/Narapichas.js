import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { dustBurst } from '../../systems/fx.js';

// A Corrupted Monk's foot soldier — a spear/axe-wielding warrior that sprints
// at the player and swings its polearm at close range.

const NARAPICHAS_HP              = 140;
const NARAPICHAS_SPEED           = 185;
const NARAPICHAS_ATTACK_DMG      = 22;
const NARAPICHAS_ATTACK_RANGE    = 155;   // reach of the polearm swing
const NARAPICHAS_ATTACK_COOLDOWN = 950;   // ms between swings

export default class Narapichas extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'narapichas-run', NARAPICHAS_HP);

    // Same robed-humanoid frame layout and body tuning as CorruptedMonk
    // (this stage's other 256px goon sheet) — no scale, so used as-is.
    this.body.setSize(170, 144);
    this.body.setOffset(55, 30);

    this._attackCooldown = 0;
    this._attacking = false;
    this._dying = false;
  }

  setupAnimations() {
    this.play('narapichas-run');
  }

  updateBehavior(player, delta) {
    if (!this.alive || this._dying || this._attacking) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this._attackCooldown -= delta;

    if (dist <= NARAPICHAS_ATTACK_RANGE) {
      this.body.setVelocityX(0);

      if (this._attackCooldown <= 0) {
        this._attack(player);
      }
    } else {
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      this.body.setVelocityX(dir * NARAPICHAS_SPEED);

      if (this.anims.currentAnim?.key !== 'narapichas-run') {
        this.play('narapichas-run', true);
      }
    }
  }

  _attack(player) {
    this._attacking = true;
    this._attackCooldown = NARAPICHAS_ATTACK_COOLDOWN;
    this.body.setVelocityX(0);

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);
    this.play('narapichas-attack', true);

    // Deal damage mid-swing rather than on the first frame.
    this.scene.time.delayedCall((1000 / 24) * 5, () => {
      if (!this.alive) return;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist <= NARAPICHAS_ATTACK_RANGE) player.takeDamage(NARAPICHAS_ATTACK_DMG);
    });

    this.once('animationcomplete-narapichas-attack', () => {
      this._attacking = false;
      if (this.alive) this.play('narapichas-run', true);
    });
  }

  onDeath() {
    this._dying = true;

    // No death sheet — a real collapse instead of hanging weightless mid-tip:
    // Enemy.die() disables gravity, so turn it back on and let the knees
    // buckle backward under it onto the floor collider. No rotation of the
    // whole sprite — a full-body spin reads as flipping upside down rather
    // than a fall (see SnowLeopard's death, which had the same problem).
    this.body.setAllowGravity(true);
    const knockDir = this.flipX ? 1 : -1;
    this.body.setVelocity(knockDir * 90, -180);

    // Crumple slightly as it drops — a stiff sprite just falling straight
    // down doesn't read as a body giving out.
    this.scene.tweens.add({
      targets: this, scaleY: this.scaleY * 0.85, duration: 350, ease: 'Sine.easeIn',
    });

    this.scene.time.delayedCall(420, () => {
      if (!this.scene) return;
      this.body.setVelocity(0, 0);
      dustBurst(this.scene, this.x, this.body.bottom);

      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 350,
        onComplete: () => this.destroy(),
      });
    });
  }
}
