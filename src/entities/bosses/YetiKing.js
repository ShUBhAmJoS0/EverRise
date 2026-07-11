import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import Audio from '../../systems/AudioManager.js';
import { shake } from '../../systems/fx.js';

const YETI_SCALE = 1.3;
const YETI_HP    = 520;
const YETI_SPEED = 115;         // heavy, but closes the gap with purpose
const YETI_STOP_RANGE = 220;    // holds this distance once close enough to cast

// Close-range staff swing. Player+enemy bodies collide (see
// Stage3Scene._spawnBoss), which keeps their centers at least ~half-widths
// apart (~125px at this scale) — the range must clear that gap or the swing
// can never trigger.
const YETI_MELEE_RANGE     = 170;
const YETI_MELEE_DMG       = 28;
const YETI_MELEE_COOLDOWN  = 1300;
const YETI_MELEE_HIT_FRAME = 6;   // local index in the trimmed attack clip

// The ground-slam blizzard — a screen-wide AOE cast on a fixed clock. Deals
// only a little damage; the drama is the storm covering the whole screen.
const YETI_BLIZZARD_COOLDOWN      = 3200;
const YETI_BLIZZARD_DMG           = 16;
const YETI_BLIZZARD_TRIGGER_FRAME = 5;   // where the frost burst first appears

// The yeti sheets are NOT drawn with a consistent default facing (they're
// AI-generated, not hand-authored — this project has hit the same issue with
// other enemies' sheets too). idle and rangeattack (both from
// range-attack.png) face LEFT by default — confirmed empirically in play.
// run.png was visually compared frame-by-frame against range-attack.png
// (leading leg + torso lean) and does NOT match — it faces RIGHT by default,
// confirmed by inspecting the sheet directly (leading leg/staff both point
// right, opposite of range-attack.png's left-facing pose).
// normal-attack.png was visually compared against it and appears mirrored
// (facing RIGHT) — inferred, not yet play-confirmed; if the melee swing
// still faces the wrong way in testing, flip this single entry.
const LEFT_FACING_ANIMS = new Set(['yeti-idle', 'yeti-rangeattack']);

// The Yeti King lumbers toward the player when far away, then holds his
// ground: swings his staff in melee at close range, or slams it down for a
// screen-wide blizzard on a longer clock — same shape as CorruptedMonk
// (Stage 2's boss) with an extra close-range option.
export default class YetiKing extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'yeti-rangeattack', YETI_HP);

    this.setScale(YETI_SCALE);
    this.body.setCollideWorldBounds(true);
    // NOTE: do NOT setImmovable here. Phaser's static floor collider is
    // ALWAYS immovable (Phaser.Physics.Arcade.StaticBody hard-codes
    // `immovable = true`), and SeparateX/SeparateY both skip separation
    // entirely when BOTH colliding bodies are immovable ("Can't separate two
    // immovable bodies"). Marking the boss immovable too made gravity pull
    // him straight through the floor with no push-back, so he only stopped
    // at the world bounds far below the platform — that was the vertical
    // alignment bug. No other enemy in this codebase uses setImmovable.
    //
    // Feet contact the ground at ~row 218 of the 256px frame (the deeper
    // pixels in the slam frames are the ice-splash VFX, not feet). Stage3's
    // floor collider top (FLOOR_Y) sits 33 world-px ABOVE the visible ice
    // deck, so the body bottom must be 33/scale ≈ 25 texture-px above the
    // feet → texture row ~193 (offsetY + sizeH = 193). Gravity (inherited
    // from Enemy) settles him onto the floor collider exactly like every
    // other enemy in this stage — no hand-picked spawn Y needed.
    this.body.setSize(140, 138);
    this.body.setOffset(60, 55);
    // `pushable`, unlike `immovable`, only affects the velocity/position
    // exchange in dynamic-vs-dynamic separation (player collider) — it
    // doesn't touch the dynamic-vs-static floor collider, so it doesn't
    // trigger the immovable-vs-immovable deadlock described above. Result:
    // the player still collides with him (can't walk through) but can't
    // shove him around.
    this.body.pushable = false;

    this._meleeCooldown    = 0;
    this._blizzardCooldown = YETI_BLIZZARD_COOLDOWN * 0.5;   // shorter first wait
    this._attacking = false;
    this._dying = false;

    this.isBoss   = true;
    this.bossName = 'The Yeti King';
    scene.events.emit('bossSpawned', this.bossName, this.hp, this.maxHp);
  }

  setupAnimations() {
    this.play('yeti-idle');
  }

  // Face the player, accounting for the CURRENT clip's default direction
  // (see LEFT_FACING_ANIMS above — the sheets don't agree with each other).
  _faceTowardPlayer(player) {
    const playerOnLeft = player.x < this.x;
    const artFacesLeft = LEFT_FACING_ANIMS.has(this.anims.currentAnim?.key);
    this.setFlipX(artFacesLeft ? !playerOnLeft : playerOnLeft);
  }

  // Victory pose: once the killing blow lands, stop tracking the fallen
  // player (Stage3Scene halts all updates the instant the player dies, so
  // this is the last facing that will ever render) and turn to face right.
  _faceRight() {
    const artFacesLeft = LEFT_FACING_ANIMS.has(this.anims.currentAnim?.key);
    this.setFlipX(artFacesLeft);
  }

  updateBehavior(player, delta) {
    if (!this.alive || this._dying) return;

    // Facing is set once when an attack starts (see _startMelee/_startBlizzard)
    // and held for its duration — re-facing every frame here would spin the
    // sprite mid-swing/mid-cast if the player crosses to the other side.
    if (this._attacking) return;

    this._faceTowardPlayer(player);

    this._meleeCooldown    -= delta;
    this._blizzardCooldown -= delta;

    if (this._blizzardCooldown <= 0) {
      this.body.setVelocityX(0);
      this._startBlizzard(player);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    let walking = false;

    if (dist <= YETI_MELEE_RANGE) {
      this.body.setVelocityX(0);
      if (this._meleeCooldown <= 0) {
        this._startMelee(player);
        return;
      }
    } else if (dist > YETI_STOP_RANGE) {
      // Lumber toward the player until within range, same pattern as
      // CorruptedMonk's approach — otherwise he'd just stand wherever he
      // spawned until his first attack.
      const dir = player.x < this.x ? -1 : 1;
      this.body.setVelocityX(dir * YETI_SPEED);
      walking = true;
    } else {
      this.body.setVelocityX(0);
    }

    // Play the run cycle while actually moving, idle otherwise — previously
    // this always forced 'yeti-idle' even while setVelocityX() was moving
    // him, so he visually slid across the ice instead of walking.
    const anim = walking ? 'yeti-run' : 'yeti-idle';
    if (this.anims.currentAnim?.key !== anim) this.play(anim, true);
  }

  _startMelee(player) {
    this._attacking     = true;
    this._meleeCooldown = YETI_MELEE_COOLDOWN;

    const dir = player.x < this.x ? -1 : 1;
    this.play('yeti-attack', true);
    this._faceTowardPlayer(player);   // re-face now the (possibly mirrored) attack clip is active

    this.scene.time.delayedCall((1000 / 16) * YETI_MELEE_HIT_FRAME, () => {
      if (!this.alive) return;
      const dx = player.x - this.x;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      const inFront = dir > 0 ? dx > -20 : dx < 20;
      if (inFront && dist <= YETI_MELEE_RANGE) {
        player.takeDamage(YETI_MELEE_DMG);
        shake(this.scene, 110, 0.005);
        Audio.play('hit');
        if (!player.alive) this._faceRight();
      }
    });

    this.once('animationcomplete-yeti-attack', () => {
      this._attacking = false;
      if (this.alive) this.play('yeti-idle', true);
    });
  }

  _startBlizzard(player) {
    this._attacking        = true;
    this._blizzardCooldown = YETI_BLIZZARD_COOLDOWN;
    this._fired            = false;
    this.body.setVelocityX(0);

    this.play('yeti-rangeattack', true);
    this._faceTowardPlayer(player);   // re-face now that facing is frozen for the cast's duration

    // Unleash the storm when the cast reaches the frost-burst frame.
    const onUpdate = (anim, frame) => {
      if (!this._fired && frame.index >= YETI_BLIZZARD_TRIGGER_FRAME) {
        this._fired = true;
        this._unleashBlizzard(player);
      }
    };
    this.on('animationupdate', onUpdate);

    this.once('animationcomplete-yeti-rangeattack', () => {
      this.off('animationupdate', onUpdate);
      this._attacking = false;
      if (this.alive) this.play('yeti-idle', true);
    });
  }

  // Slams the staff into the ground: the whole screen is scoured by a driving
  // blizzard — wind-blown snow streaking sideways — for a couple seconds.
  _unleashBlizzard(player) {
    // Guard against a killing blow landing mid-windup: the animationupdate
    // listener that calls this isn't stopped on death (see onDeath), so
    // without this check a dead boss could still land the AOE hit.
    if (!this.alive) return;
    player.takeDamage(YETI_BLIZZARD_DMG);
    if (!player.alive) this._faceRight();
    shake(this.scene, 350, 0.01);
    Audio.play('hurt');
    this.scene.cameras.main.flash(220, 225, 240, 255);

    const cam = this.scene.cameras.main;
    const w = cam.width, h = cam.height;
    const BLIZZARD_MS = 2200;
    const dir = Math.random() < 0.5 ? 1 : -1;   // gust direction varies per cast

    // Flickering whiteout haze — visibility dropping in and out reads as a
    // storm rather than a static fog.
    const haze = this.scene.add.rectangle(w / 2, h / 2, w, h, 0xdff2ff, 0.3)
      .setScrollFactor(0).setDepth(8).setAlpha(0);
    this.scene.tweens.add({
      targets: haze, alpha: 1, duration: 180,
      yoyo: true, repeat: 6,
      onComplete: () => haze.destroy(),
    });

    let gusts = [];
    if (this.scene.textures.exists('spark')) {
      // Instant full-screen burst so every corner is covered immediately,
      // before the continuous streaming layers take over.
      const burst = this.scene.add.particles(0, 0, 'spark', {
        x: { min: 0, max: w }, y: { min: 0, max: h },
        lifespan: 900,
        speedX: { min: dir * 250, max: dir * 650 },
        speedY: { min: 40, max: 220 },
        scale: { start: 1.3, end: 0.3 },
        alpha: { start: 0.9, end: 0.1 },
        tint: 0xf4fbff,
        emitting: false,
      }).setScrollFactor(0).setDepth(9);
      burst.explode(140);
      this.scene.time.delayedCall(950, () => burst.destroy());

      // Foreground: fast, elongated streaks driven hard sideways across the
      // whole screen — the "blowing snow" look.
      const fast = this.scene.add.particles(0, 0, 'spark', {
        x: { min: -50, max: w + 50 }, y: { min: 0, max: h },
        lifespan: 650,
        speedX: { min: dir * 850, max: dir * 1150 },
        speedY: { min: -60, max: 140 },
        scaleX: { start: 2.6, end: 1.6 },
        scaleY: { start: 0.35, end: 0.2 },
        rotate: dir > 0 ? 0 : 180,
        alpha: { start: 0.95, end: 0.1 },
        tint: 0xf4fbff,
        quantity: 6, frequency: 8,
      }).setScrollFactor(0).setDepth(9);

      // Background: smaller, slower flakes tumbling behind for depth.
      const slow = this.scene.add.particles(0, 0, 'spark', {
        x: { min: 0, max: w }, y: { min: -20, max: h },
        lifespan: 1100,
        speedX: { min: dir * 180, max: dir * 340 },
        speedY: { min: 120, max: 260 },
        scale: { start: 0.9, end: 0.3 },
        alpha: { start: 0.7, end: 0.1 },
        tint: 0xdcecf7,
        quantity: 5, frequency: 14,
      }).setScrollFactor(0).setDepth(9);

      gusts = [fast, slow];
    }

    this.scene.time.delayedCall(BLIZZARD_MS, () => {
      gusts.forEach((g) => {
        g.stop();
        this.scene.time.delayedCall(1100, () => g.destroy());
      });
    });
  }

  onDeath() {
    this._dying = true;
    this.body.setVelocityX(0);
    // Stop mid-cast so a queued blizzard/melee animationupdate or
    // animationcomplete callback can't fire after death.
    this.anims.stop();
    this.removeAllListeners('animationupdate');

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1600,
      onComplete: () => {
        // Emit BEFORE destroy — destroy() nulls this.scene.
        this.scene.events.emit('bossDefeated');
        this.destroy();
      },
    });
  }
}
