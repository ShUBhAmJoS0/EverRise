import Phaser from 'phaser';

// Generic ranged orb. Travels horizontally toward the player, plays a looping
// travel animation, and on contact deals damage + plays an impact burst.
// Used by both the Forest Witch (green) and the Corrupted Monk (purple).

const DEFAULTS = {
  texture:    'projectile',
  travelAnim: 'projectile-travel',
  impactAnim: 'projectile-impact',
  speed:      320,   // px/s
  damage:     20,
  scale:      0.7,
  bodySize:   70,    // square hitbox, tighter than the 128px frame
  life:       4000,  // ms before auto-despawn if it never hits
};

export default class Projectile extends Phaser.Physics.Arcade.Sprite {
  // dir: -1 = travelling left, +1 = travelling right
  // opts: override any of DEFAULTS (texture/anims/speed/damage/scale/...)
  constructor(scene, x, y, dir, opts = {}) {
    const cfg = { ...DEFAULTS, ...opts };
    super(scene, x, y, cfg.texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this._impactAnim = cfg.impactAnim;
    this._damage     = cfg.damage;

    this.alive = true;
    this.setDepth(11);                 // above characters (depth 10)
    this.setScale(cfg.scale);
    this.body.setAllowGravity(false);
    this.body.setSize(cfg.bodySize, cfg.bodySize);
    this.setFlipX(dir < 0);
    this.body.setVelocityX(dir * cfg.speed);

    this.play(cfg.travelAnim);

    this._life = scene.time.delayedCall(cfg.life, () => {
      if (this.active) this.destroy();
    });
  }

  // Called by the scene's overlap handler when it touches the player.
  hit(target) {
    if (!this.alive) return;
    this.alive = false;
    this.body.setVelocity(0, 0);
    this._life?.remove();

    if (target?.takeDamage) target.takeDamage(this._damage);

    this.play(this._impactAnim, true);
    this.once(`animationcomplete-${this._impactAnim}`, () => this.destroy());
  }
}
