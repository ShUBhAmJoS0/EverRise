import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import Audio from '../../systems/AudioManager.js';
import { shake, groundBurst } from '../../systems/fx.js';

// A jungle snake that rises UP OUT OF THE GROUND (dirt burst + hiss), slithers
// along the grass at the player, rears up and lunges to bite, then recoils.
// It's a ground creature: no gravity — it stays on the grass line.

const SNAKE_HP          = 40;
const SNAKE_SPEED       = 118;
const SNAKE_LUNGE_RANGE = 150;
const SNAKE_BITE_DMG    = 12;
const SNAKE_BITE_REACH  = 155;
const SNAKE_COOLDOWN    = 1500;

export default class Snake extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'snake', SNAKE_HP);

    this.setDepth(11);
    this.setScale(0.9);
    this.body.setAllowGravity(false);     // ground creature — no falling from the sky
    this.body.setSize(100, 36);
    this.body.setOffset(42, 40);

    this._restY        = y;               // the grass line it slithers on
    this._biteCooldown = 0;
    this._lunging = false;
    this._dying   = false;
    this._emerged = false;

    // Start buried below the grass, hidden; rise after a short stagger.
    this.setAlpha(0);
    this.setPosition(x, y + 48);
    this.scene.time.delayedCall(Phaser.Math.Between(0, 850), () => {
      if (this.alive && !this._dying) this._emerge();
    });
  }

  setupAnimations() { /* single texture — animated via tweens */ }

  // Erupt upward out of the soil: dirt/grass burst + hiss + a rise into place.
  _emerge() {
    this._emerged = true;
    Audio.play('hiss');
    shake(this.scene, 120, 0.004);
    groundBurst(this.scene, this.x, this._restY + 26);
    this.scene.tweens.add({ targets: this, y: this._restY, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this._wobble = this.scene.tweens.add({
      targets: this, angle: { from: -5, to: 5 }, yoyo: true, repeat: -1, duration: 320, ease: 'Sine.easeInOut',
    });
  }

  updateBehavior(player, delta) {
    if (!this._emerged || !this.alive || this._dying || this._lunging) return;
    this._biteCooldown -= delta;

    // pin to the grass line (no vertical drift)
    this.setY(this._restY);
    this.body.setVelocityY(0);

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const dir  = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    if (dist <= SNAKE_LUNGE_RANGE && this._biteCooldown <= 0) {
      this._lunge(player, dir);
    } else if (dist > SNAKE_LUNGE_RANGE) {
      this.body.setVelocityX(dir * SNAKE_SPEED);
    } else {
      this.body.setVelocityX(0);
    }
  }

  _lunge(player, dir) {
    this._lunging = true;
    this._biteCooldown = SNAKE_COOLDOWN;
    this._wobble?.pause();
    this.body.setVelocityX(0);

    // TELEGRAPH: rear up + hiss + red flash for a beat before striking, so the
    // bite is readable and can be dodged.
    this.setTint(0xff7766);
    Audio.play('hiss');
    this.scene.tweens.add({ targets: this, angle: -22 * dir, duration: 180 });

    this.scene.time.delayedCall(240, () => {
      if (!this.alive) return;
      this.clearTint();
      this.body.setVelocityX(dir * 430);   // dart forward

      this.scene.time.delayedCall(150, () => {
        if (!this.alive) return;
        const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (d <= SNAKE_BITE_REACH) {
          player.takeDamage(SNAKE_BITE_DMG);
          Audio.play('snakeBite');
          shake(this.scene, 100, 0.005);
        }
        this.body.setVelocityX(-dir * 200);   // recoil
        this.scene.time.delayedCall(250, () => {
          this._lunging = false;
          // The wobble tween is destroyed on death — never touch it afterwards.
          if (!this.alive || this._dying) return;
          this._wobble?.resume();
          this.body.setVelocityX(0);
          this.setAngle(0);
        });
      });
    });
  }

  onDeath() {
    this._dying = true;
    this._wobble?.stop();
    this._wobble = null;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    Audio.play('enemyHit');
    this.scene.tweens.add({
      targets: this, scale: 0, alpha: 0, angle: 110, duration: 300,
      onComplete: () => this.destroy(),
    });
  }
}
