import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { impactSparks } from '../../systems/fx.js';

// She starts BEHIND her magic shield lobbing a few orbs over it, then comes OUT
// to engage — and stays out, chasing the player and casting. She does NOT retreat
// back behind the shield. Every wound is answered with a short fast barrage.
const WITCH_HP            = 340;
const WITCH_MOVE_SPEED    = 210;  // chase speed once engaged
const WITCH_ENGAGE_RANGE  = 300;  // casts from here; chases if the player is farther
const WITCH_CAST_CD       = 1100; // ms between casts while engaged
const WITCH_LURK_MS       = 1400; // brief opening dwell behind the shield
const WITCH_LURK_CAST_MS  = 900;  // cadence of pot-shots during the opening lurk
const WITCH_RELEASE_FRAME = 18;   // 1-based frame where the orb leaves the hand

// Retaliation: a wound triggers a short fast burst of orbs — but only after a
// wind-up, so the player has time to raise a guard or dodge instead of being hit
// the instant they swing.
const WITCH_RETALIATE_DELAY = 1500;  // wind-up before the barrage fires
const WITCH_RETALIATE_CD    = 2200;  // min gap between retaliation bursts
const WITCH_BURST_COUNT     = 2;     // orbs per retaliation
const WITCH_BURST_SPEED     = 560;   // fast orbs
const WITCH_NORMAL_SPEED    = 340;

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

    this._homeX       = x;        // her opening spot BEHIND the shield
    this._state       = 'lurk';   // 'lurk' → 'engage' (never returns to lurk)
    this._stateTimer  = WITCH_LURK_MS;
    this._lurkCastCd  = WITCH_LURK_CAST_MS;
    this._castCd      = 0;
    this._retaliateCd = 0;
    this._attacking   = false;
    this._dying       = false;

    this.isBoss   = true;
    this.bossName = 'The Forest Witch';
    scene.events.emit('bossSpawned', this.bossName, this.hp, this.maxHp);
  }

  setupAnimations() {
    this.play('witch-run');
  }

  updateBehavior(player, delta) {
    // Keep a live player reference + tick the retaliation clock even mid-cast,
    // so a wound can always be answered (see takeDamage below).
    this._lastPlayer = player;
    this._retaliateCd -= delta;
    if (!this.alive || this._dying || this._attacking) return;

    if (this._state === 'lurk') this._lurk(player, delta);
    else                        this._engage(player, delta);
  }

  // Opening beat: hold behind the shield, facing the player, lobbing a couple of
  // orbs over it — then commit to the fight and come out (permanently).
  _lurk(player, delta) {
    this.setFlipX(player.x < this.x);
    const dx = this._homeX - this.x;
    this.body.setVelocityX(Math.abs(dx) > 6 ? Phaser.Math.Clamp(dx, -120, 120) : 0);
    if (this.anims.currentAnim?.key !== 'witch-idle') this.play('witch-idle', true);

    this._lurkCastCd -= delta;
    if (this._lurkCastCd <= 0) {
      this._lurkCastCd = WITCH_LURK_CAST_MS;
      this._startCast(player, WITCH_NORMAL_SPEED);
      return;
    }

    this._stateTimer -= delta;
    if (this._stateTimer <= 0) this._state = 'engage';
  }

  // Out in the open, chasing the player and casting on a cadence. She holds this
  // stance for the rest of the fight — she never runs back behind the shield.
  _engage(player, delta) {
    const dir  = player.x < this.x ? -1 : 1;
    const dist = Math.abs(player.x - this.x);
    this.setFlipX(dir < 0);
    this._castCd -= delta;

    if (dist > WITCH_ENGAGE_RANGE) {
      // Close the gap.
      this.body.setVelocityX(dir * WITCH_MOVE_SPEED);
      if (this.anims.currentAnim?.key !== 'witch-run') this.play('witch-run', true);
    } else {
      // In range — stand and cast on the clock.
      this.body.setVelocityX(0);
      if (this._castCd <= 0) {
        this._castCd = WITCH_CAST_CD;
        this._startCast(player, WITCH_NORMAL_SPEED);
      } else if (this.anims.currentAnim?.key !== 'witch-idle') {
        this.play('witch-idle', true);
      }
    }
  }

  _startCast(player, speed = WITCH_NORMAL_SPEED, onDone = null) {
    this._attacking = true;
    this._fired     = false;
    this.body.setVelocityX(0);

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);
    this.play('witch-rangeattack', true);

    const onUpdate = (anim, frame) => {
      if (!this._fired && frame.index >= WITCH_RELEASE_FRAME) {
        this._fired = true;
        this._fireProjectile(dir, speed);
      }
    };
    this.on('animationupdate', onUpdate);

    this.once('animationcomplete-witch-rangeattack', () => {
      this.off('animationupdate', onUpdate);
      this._attacking = false;
      onDone?.();
    });
  }

  _fireProjectile(dir, speed = WITCH_NORMAL_SPEED) {
    // Spawn from the witch's casting hand: forward + slightly above center.
    const x = this.x + dir * 70;
    const y = this.y - 25;
    this.scene.spawnWitchProjectile(x, y, dir, speed);
  }

  // A wound is answered with a short fast barrage. She holds her ground — no
  // retreat — and shrugs off the knockback so she isn't juggled.
  takeDamage(amount, knockbackX = 0) {
    if (!this.alive) return;
    super.takeDamage(amount, 0);
    if (!this.alive) return;
    if (this._retaliateCd <= 0) {
      this._retaliateCd = WITCH_RETALIATE_CD;
      this._retaliate();
    }
  }

  // A wound is answered with a 2-orb burst — but after a ~1.5s wind-up (a small
  // spark tell), giving the player a window to block or dodge before it lands.
  // Direction is read at fire time so the orbs track where the player actually is.
  _retaliate() {
    impactSparks(this.scene, this.x, this.y - 25, 0xc98aff, 6);   // "charging" tell
    this.scene.time.delayedCall(WITCH_RETALIATE_DELAY, () => {
      if (!this.alive) return;
      const dir = this._lastPlayer && this._lastPlayer.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      for (let i = 0; i < WITCH_BURST_COUNT; i++) {
        this.scene.time.delayedCall(i * 110, () => {
          if (this.alive) this._fireProjectile(dir, WITCH_BURST_SPEED);
        });
      }
    });
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
