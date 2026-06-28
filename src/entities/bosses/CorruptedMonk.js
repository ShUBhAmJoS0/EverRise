import Phaser from 'phaser';
import Enemy from '../Enemy.js';

const MONK_HP            = 220;
const MONK_SPEED         = 70;
const MONK_ATTACK_RANGE  = 520;   // ranged caster — engages from far away
const MONK_ATTACK_COOLDOWN = 2600; // ms between casts
const MONK_RELEASE_FRAME  = 13;   // 1-based frame where the purple orb leaves the staff

// Stage 2 final boss. Charges a purple orb (13 frames of windup), launches it on
// frame 13, then recovers through the rest of the range-attack sheet.
export default class CorruptedMonk extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'monk-idle', MONK_HP);

    this.setScale(1.2);
    this.body.setCollideWorldBounds(true);
    // True foot-mass row ~202 (ignoring the staff/robe tatters that hang lower).
    // To rest his feet on the deck (FLOOR_Y + 33 at scale 1.2), the body bottom
    // must sit ~28 texture-px above the feet: offsetY+sizeHeight = 174.
    this.body.setSize(170, 144);
    this.body.setOffset(55, 30);

    this._attackCooldown = 0;
    this._attacking = false;
    this._dying = false;

    this.isBoss   = true;
    this.bossName = 'The Corrupted Monk';
    scene.events.emit('bossSpawned', this.bossName, this.hp, this.maxHp);
  }

  setupAnimations() {
    this.play('monk-idle');
  }

  updateBehavior(player, delta) {
    if (!this.alive || this._dying || this._attacking) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this._attackCooldown -= delta;

    if (dist <= MONK_ATTACK_RANGE && this._attackCooldown <= 0) {
      this._startRangeAttack(player);
    } else if (dist > MONK_ATTACK_RANGE) {
      // Drift toward the player until within casting range.
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      this.body.setVelocityX(dir * MONK_SPEED);
      if (this.anims.currentAnim?.key !== 'monk-idle') this.play('monk-idle', true);
    } else {
      // In range, cooling down — hold and idle.
      this.body.setVelocityX(0);
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      if (this.anims.currentAnim?.key !== 'monk-idle') this.play('monk-idle', true);
    }
  }

  _startRangeAttack(player) {
    this._attacking      = true;
    this._attackCooldown = MONK_ATTACK_COOLDOWN;
    this._fired          = false;
    this.body.setVelocityX(0);

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    this.play('monk-rangeattack', true);

    // Release the purple orb when the cast reaches frame 13.
    const onUpdate = (anim, frame) => {
      if (!this._fired && frame.index >= MONK_RELEASE_FRAME) {
        this._fired = true;
        this._fireProjectile(dir);
      }
    };
    this.on('animationupdate', onUpdate);

    this.once('animationcomplete-monk-rangeattack', () => {
      this.off('animationupdate', onUpdate);
      this._attacking = false;
      if (this.alive) this.play('monk-idle', true);
    });
  }

  _fireProjectile(dir) {
    const x = this.x + dir * 80;
    const y = this.y - 40;
    this.scene.spawnMonkProjectile(x, y, dir);
  }

  onDeath() {
    this._dying = true;
    this.body.setVelocityX(0);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1400,
      onComplete: () => {
        // Emit BEFORE destroy — destroy() nulls this.scene.
        this.scene.events.emit('bossDefeated');
        this.destroy();
      },
    });
  }
}
