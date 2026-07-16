import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import Audio from '../../systems/AudioManager.js';
import { shake, impactSparks, dustBurst } from '../../systems/fx.js';

// A corrupted snow leopard — fast, low-slung predator that stalks the player
// across the glacier and lunges in with a snarling bite at close range.

// Stage 3 tops the curve: tougher than the Narapichas (Stage 2, HP 175) and
// still the fastest thing on four legs — a tanky, relentless glacier predator.
const LEOPARD_HP              = 205;
const LEOPARD_SPEED           = 235;
const LEOPARD_ATTACK_DMG      = 26;
// Player+enemy bodies collide (see Stage3Scene._spawnEnemy), which keeps their
// centers at least ~half-widths apart (~135px) — the range must clear that
// gap or the bite can never trigger.
const LEOPARD_ATTACK_RANGE    = 170;
const LEOPARD_ATTACK_COOLDOWN = 800;
const LEOPARD_LUNGE_SPEED     = 340;   // snap forward off the crouch, not rooted in place
const LEOPARD_LUNGE_MS        = 120;

export default class SnowLeopard extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'leopard-run', LEOPARD_HP);

    // Measured from the run sheet: paws contact the ground at ~row 179 of the
    // 256px frame (51px below the 128px center). Stage3's floor collider rests
    // 33px ABOVE the visible ice deck (see Stage3Scene's PLAYER_SINK) — every
    // character's body must be shortened by that same 33px so it lands on the
    // visible ice, not on the invisible physics line above it.
    //
    // The derived rest line still left the paws hovering slightly above the ice
    // in play, so drop the sprite ~7% of its height (256*0.07 ≈ 18px) by lowering
    // offset.y (48 → 30). Because _clampToFloor pins body.bottom to FLOOR_Y, the
    // world hitbox is [FLOOR_Y - sourceHeight*scaleY, FLOOR_Y] regardless of
    // offset.y — so this shifts ONLY the visual down; hitbox + death landing are
    // unchanged.
    this.body.setSize(200, 98);
    this.body.setOffset(20, 30);

    this._attackCooldown = 0;
    this._attacking = false;
    this._dying = false;
  }

  setupAnimations() {
    this.play('leopard-run');
  }

  updateBehavior(player, delta) {
    if (!this.alive || this._dying || this._attacking) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this._attackCooldown -= delta;

    if (dist <= LEOPARD_ATTACK_RANGE) {
      this.body.setVelocityX(0);

      if (this._attackCooldown <= 0) {
        this._attack(player);
      }
    } else {
      const dir = player.x < this.x ? -1 : 1;
      this.setFlipX(dir < 0);
      this.body.setVelocityX(dir * LEOPARD_SPEED);

      if (this.anims.currentAnim?.key !== 'leopard-run') {
        this.play('leopard-run', true);
      }
    }
  }

  _attack(player) {
    this._attacking = true;
    this._attackCooldown = LEOPARD_ATTACK_COOLDOWN;

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    // A real bite snaps the body forward off the crouch, rather than landing
    // rooted in place — a quick lunge pulse toward the player.
    this.body.setVelocityX(dir * LEOPARD_LUNGE_SPEED);
    this.scene.time.delayedCall(LEOPARD_LUNGE_MS, () => {
      if (this.alive) this.body.setVelocityX(0);
    });

    this.play('leopard-bite', true);

    // Bite lands mid-snarl rather than on the first frame.
    this.scene.time.delayedCall((1000 / 26) * 5, () => {
      if (!this.alive) return;
      const dx = player.x - this.x;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      // Only a genuine front-on snap connects — a player who's slipped behind
      // during the windup shouldn't get bitten from the wrong side.
      const inFront = dir > 0 ? dx > -20 : dx < 20;
      if (inFront && dist <= LEOPARD_ATTACK_RANGE) {
        player.takeDamage(LEOPARD_ATTACK_DMG);
        impactSparks(this.scene, player.x, player.y - 20, 0x7fffd4, 8);
        shake(this.scene, 90, 0.004);
        Audio.play('snakeBite');
      }
    });

    this.once('animationcomplete-leopard-bite', () => {
      this._attacking = false;
      if (this.alive) this.play('leopard-run', true);
    });
  }

  onDeath() {
    this._dying = true;

    // No death sheet — instead of hanging weightless mid-tip, give the kill
    // some physicality: Enemy.die() just disabled gravity, so turn it back
    // on and knock the body backward off its feet (away from whichever way
    // it was facing) to let it drop onto the floor collider like a real
    // carcass, then settle and fade. No rotation — any tilt/spin here
    // reads as the body flipping upside down, which looks wrong.
    this.body.setAllowGravity(true);
    const knockDir = this.flipX ? 1 : -1;
    this.body.setVelocity(knockDir * 110, -210);

    this.scene.time.delayedCall(450, () => {
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
