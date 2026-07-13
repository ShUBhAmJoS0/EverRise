import Phaser from 'phaser';

// Base class shared by all enemies.
// Subclasses must implement: setupAnimations(), updateBehavior(player, delta)

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  // Keep enemies from stacking into one sprite: nudge overlapping pairs apart.
  // Call once per frame from the scene with the live enemy list. Attacking/
  // lunging enemies are left alone so strikes aren't disrupted.
  static separate(enemies, minDist = 78) {
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        if (Math.abs(dx) >= minDist || Math.abs(b.y - a.y) > 60) continue;
        // Attacking/lunging enemies get a gentler push so strikes aren't disrupted.
        const busy = a._attacking || a._lunging || b._attacking || b._lunging;
        const maxPush = busy ? 1.2 : 3;
        const push = Math.min((minDist - Math.abs(dx)) / 2, maxPush);
        const dir  = dx >= 0 ? 1 : -1;   // b is right of a (ties break right)
        a.x -= dir * push;
        b.x += dir * push;
      }
    }
  }

  constructor(scene, x, y, texture, maxHp) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = maxHp;
    this.hp    = maxHp;
    this.alive = true;

    this.body.setCollideWorldBounds(false);
    this.body.setGravityY(200);
    this.setDepth(10);   // above platform (depth 1)

    // Floor safety, same fallback Player relies on (see Player._clampToFloor):
    // scenes that set this to their FLOOR_Y guarantee the enemy's feet land
    // exactly on the platform even if the floor collider ever misses a frame
    // (fast fall, spawn-above-floor drop, etc). Left null (no-op) unless a
    // scene opts in.
    this.floorY = null;

    this.setupAnimations();
  }

  // Subclasses override this to play their idle/run animation on spawn.
  setupAnimations() {}

  // Subclasses override this for per-frame AI logic.
  updateBehavior(player, delta) {}

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this._clampToFloor();
  }

  // Ground-enemies-only lock (none of them jump/fly): while alive, pin the
  // enemy to its resting Y every frame rather than only catching it when it
  // sinks below — the floor collider alone wasn't reliably grounding enemies
  // (see Stage3Scene's YetiKing/SnowLeopard, which visibly hovered above the
  // ice even after spawning with a matching Y, i.e. stuck ABOVE the resting
  // line, which a "only correct downward" clamp can't fix). onDeath's
  // knockback pop (SnowLeopard/Narapichas) runs after `alive` is already
  // false, so it's unaffected.
  // Resting Y is derived from this enemy's own body offset/height (set
  // per-subclass via setSize/setOffset) rather than a hardcoded constant, so
  // it works for any enemy's body — just set `enemy.floorY` at spawn time.
  _clampToFloor() {
    if (this.floorY === null || !this.body || !this.alive) return;
    const restY = this.floorY - (this.body.offset.y + this.body.sourceHeight - 128) * this.scaleY;
    if (this.y !== restY) {
      this.setY(restY);
      if (this.body.velocity.y !== 0) this.body.setVelocityY(0);
    }
  }

  takeDamage(amount, knockbackX = 0) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.isBoss) this.scene.events.emit('bossHealthChanged', this.hp, this.maxHp);
    this.setTint(0xff4444);
    this.scene.time.delayedCall(120, () => {
      if (this.alive) this.clearTint();
    });

    // Light knockback pop on hit (gives weight; AI resumes next frame).
    if (knockbackX && this.body) {
      this.body.setVelocityX(knockbackX);
      if (this.body.blocked.down) this.body.setVelocityY(-160);
    }

    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);

    this.onDeath();
  }

  // Subclasses override for custom death animation/cleanup.
  onDeath() {
    this.destroy();
  }
}
