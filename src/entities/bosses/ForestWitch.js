import Phaser from 'phaser';
import Enemy from '../Enemy.js';

// She seals the path with a magic shield, so she's built to feel like a real
// boss: she RUNS at the player, hits harder on the clock, and takes a beating.
const WITCH_HP           = 280;
const WITCH_SPEED        = 175;  // comes running fast
const WITCH_ATTACK_RANGE = 330;  // closes in before casting
const WITCH_ATTACK_COOLDOWN = 2200; // ms between casts
const WITCH_RELEASE_FRAME = 18;  // 1-based frame index where the orb leaves the hand

export default class ForestWitch extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'witch-run', WITCH_HP);

    this.setScale(1.1);
    this.body.setCollideWorldBounds(true);
    // Match the player's visual footing (feet ~47px below FLOOR_Y). At scale 1.1
    // the body bottom must sit ~43px (texture px) above the feet (row 216):
    // offsetY+sizeHeight = 216-43 = 173.
    this.body.setSize(180, 143);
    this.body.setOffset(50, 30);

    this._attackCooldown = 0;
    this._attacking = false;
    this._dying = false;

    this.isBoss   = true;
    this.bossName = 'The Forest Witch';
    scene.events.emit('bossSpawned', this.bossName, this.hp, this.maxHp);
  }

  setupAnimations() {
    this.play('witch-run');
  }

  updateBehavior(player, delta) {
    if (!this.alive || this._dying || this._attacking) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this._attackCooldown -= delta;

    if (dist <= WITCH_ATTACK_RANGE && this._attackCooldown <= 0) {
      this._startRangeAttack(player);
    } else if (dist > WITCH_ATTACK_RANGE) {
      // Approach until the player is within casting range.
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      this.body.setVelocityX(dir * WITCH_SPEED);

      if (this.anims.currentAnim?.key !== 'witch-run') {
        this.play('witch-run', true);
      }
    } else {
      // In range but cooling down — hold position and play idle.
      this.body.setVelocityX(0);
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      if (this.anims.currentAnim?.key !== 'witch-idle') {
        this.play('witch-idle', true);
      }
    }
  }

  _startRangeAttack(player) {
    this._attacking      = true;
    this._attackCooldown = WITCH_ATTACK_COOLDOWN;
    this._fired          = false;
    this.body.setVelocityX(0);

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    this.play('witch-rangeattack', true);

    // Release the orb exactly when the cast reaches frame 18.
    const onUpdate = (anim, frame) => {
      if (!this._fired && frame.index >= WITCH_RELEASE_FRAME) {
        this._fired = true;
        this._fireProjectile(dir);
      }
    };
    this.on('animationupdate', onUpdate);

    this.once('animationcomplete-witch-rangeattack', () => {
      this.off('animationupdate', onUpdate);
      this._attacking = false;
      if (this.alive) this.play('witch-run', true);
    });
  }

  _fireProjectile(dir) {
    // Spawn from the witch's casting hand: forward + slightly above center.
    const x = this.x + dir * 70;
    const y = this.y - 25;
    this.scene.spawnWitchProjectile(x, y, dir);
  }

  onDeath() {
    this._dying = true;
    this.body.setVelocityX(0);

    // No death animation exists — fade out as stand-in.
    // NEEDS REPLACEMENT with a real death sheet when supplied.
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1200,
      onComplete: () => {
        // Emit BEFORE destroy — destroy() nulls this.scene, so emitting after
        // it would throw and the stage-complete transition would never fire.
        this.scene.events.emit('bossDefeated');
        this.destroy();
      },
    });
  }
}
