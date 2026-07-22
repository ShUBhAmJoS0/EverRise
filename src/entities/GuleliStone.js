import Phaser from 'phaser';
import { shake, hitStop, impactSparks } from '../systems/fx.js';
import Audio from '../systems/AudioManager.js';

// The Guleli's stone shot. Unlike the casters' straight-flying orbs, this is a
// real physics projectile: it's launched with an initial velocity and arcs under
// gravity, rotating to face its travel direction. Bursts on an enemy, the ground,
// or after its lifetime.

const SPEED_X   = 560;   // horizontal launch speed (px/s)
const ARC_BASE  = 150;   // default upward toss so a "straight" shot still arcs
const AIM_UP    = 260;   // extra upward velocity when aiming up (W / ↑)
const AIM_DOWN  = 170;   // downward velocity when aiming down (S / ↓)
// EFFECTIVE downward accel (px/s²) we want the stone to fly under. A full charge
// is light (long, floaty arc → far); a weak tap is heavy (drops quickly → near).
const GRAV_FULL = 300;
const GRAV_WEAK = 760;
const DAMAGE    = 65;
const KNOCKBACK = 240;
const LIFE_MS   = 2600;

export default class GuleliStone extends Phaser.Physics.Arcade.Sprite {
  // dir: -1 left / +1 right.  aim: -1 up, 0 level, +1 down.
  // power: 0..1 charge — scales speed (range), flight time, and damage.
  constructor(scene, x, y, dir, aim = 0, power = 1) {
    super(scene, x, y, 'stone');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.alive   = true;
    this.damage  = Math.round(DAMAGE * (0.6 + 0.8 * power));
    this._dir    = dir;

    this.setDepth(11);
    this.setScale(0.8 + 0.35 * power);   // a fuller charge throws a bigger stone
    this.body.setSize(40, 40);
    this.body.setAllowGravity(true);

    // A full charge is launched fast, in a higher arc, under lighter effective
    // gravity, so it sails far; a weak tap is slow, flat, and drops near.
    // NOTE: Arcade ADDS the world gravity to the body's, so subtract it to hit
    // the effective value we actually want.
    const worldG    = this.scene.physics.world.gravity.y || 0;
    const effective = GRAV_WEAK + (GRAV_FULL - GRAV_WEAK) * power;  // 760..300
    this.body.setGravityY(effective - worldG);

    const speed = SPEED_X  * (0.5 + power);         // ~0.95×..1.5×
    const arc   = ARC_BASE * (0.6 + 1.2 * power);   // bigger upward launch at full charge

    let vy = -arc;
    if (aim < 0) vy = -arc - AIM_UP;
    else if (aim > 0) vy = AIM_DOWN;
    this.body.setVelocity(dir * speed, vy);

    this.play('stone-travel');

    // Burst on the stage floor if the scene exposes one.
    if (scene._floor) {
      this._floorCollider = scene.physics.add.collider(this, scene._floor, () => this.burst());
    }
    // Longer hold → much longer flight before it auto-despawns (more range).
    this._life = scene.time.delayedCall(LIFE_MS * (0.5 + power), () => this.burst());
  }

  // Rotate to follow the arc while flying.
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.alive && this.body) {
      this.rotation = Math.atan2(this.body.velocity.y, this.body.velocity.x);
    }
  }

  hitEnemy(enemy) {
    if (!this.alive) return;
    enemy.takeDamage(this.damage, this._dir * KNOCKBACK);
    impactSparks(this.scene, enemy.x, enemy.y - 10, 0xffe08a);
    hitStop(this.scene, 45);
    shake(this.scene, 60, 0.003);
    Audio.play('enemyHit');
    this.burst();
  }

  burst() {
    if (!this.alive) return;
    this.alive = false;
    this.rotation = 0;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this._life?.remove();
    this._floorCollider?.destroy();

    this.play('stone-impact', true);
    this.once('animationcomplete-stone-impact', () => this.destroy());
    // Safety net if the impact animation never completes.
    this.scene?.time.delayedCall(500, () => { if (this.active) this.destroy(); });
  }
}
