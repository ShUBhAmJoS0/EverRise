import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import Audio from '../../systems/AudioManager.js';
import { shake, impactSparks } from '../../systems/fx.js';

const YETI_SCALE = 1.3;
const YETI_HP    = 760;          // EverRise's strongest foe — a long, punishing fight
const YETI_SPEED = 205;          // relentless: sprints the player down between casts
const YETI_FOLLOW_RANGE = 90;    // hounds the player this close, mace ready

// He has two attacks, and they answer to DIFFERENT defences — that split is the
// whole rhythm of the fight: parry the mace, dodge the blizzard.
//
// The ground-slam blizzard is a screen-wide frozen HAZARD, not a blow, so a
// raised guard can't parry it (dodge it instead). Fires on a fixed 6s clock and
// always chunks 15% of the player's MAX HP.
const YETI_BLIZZARD_COOLDOWN      = 4800;  // faster storms as the finale demands
const YETI_BLIZZARD_PCT           = 0.15;  // 15% of the player's max HP
const YETI_BLIZZARD_TRIGGER_FRAME = 5;     // where the frost burst first appears

// The mace swing is an ordinary melee blow — the heaviest in the game, but a
// raised guard parries it outright (Player.takeDamage's default). Swung on its
// own shorter clock at anyone who stays inside his reach between casts.
const YETI_MELEE_DMG        = 32;
const YETI_MELEE_RANGE      = 155;   // reach of the mace, measured center-to-center
const YETI_MELEE_COOLDOWN   = 1050;  // hammers back-to-back (was 1600)
// 1-based index into the trimmed yeti-attack frame list (see ANIM_CONFIG.yeti.attack):
// the finishing blow, mace fully extended with the head glowing. Keep the two in sync.
const YETI_MELEE_HIT_FRAME  = 15;

// The yeti sheets are NOT drawn with a consistent default facing (they're
// AI-generated, not hand-authored — this project has hit the same issue with
// other enemies' sheets too). idle.png and range-attack.png both face LEFT
// by default — confirmed by inspecting the sheets directly (staff/weapon
// held on the character's left, same calm-stance pose in both).
// run.png was visually compared frame-by-frame against range-attack.png
// (leading leg + torso lean) and does NOT match — it faces RIGHT by default,
// confirmed by inspecting the sheet directly (leading leg/staff both point
// right, opposite of range-attack.png's left-facing pose).
// normal-attack.png draws the torso front-on/3-quarter, so its STANCE has no
// clean left/right profile to read like the other three sheets — but the SWING
// does: the finishing blow (sheet frame 19) whips the mace out to the LEFT.
// That's what has to point at the player, so the sheet belongs in this set —
// otherwise the killing blow lands on the boss's empty side.
const LEFT_FACING_ANIMS = new Set(['yeti-idle', 'yeti-rangeattack', 'yeti-attack']);

// The Yeti King lumbers toward the player when far away, then holds his
// ground: swings his mace in melee at close range, or slams it down for a
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
    // deck. Gravity (inherited from Enemy) settles him onto the floor collider
    // exactly like every other enemy in this stage — no hand-picked spawn Y.
    //
    // Like SnowLeopard, the derived rest line still left him hovering above the
    // ice, so drop the sprite ~7% of its height by lowering offset.y (55 → 37,
    // an 18 texture-px = 23 world-px drop at scale 1.3). _clampToFloor pins
    // body.bottom to FLOOR_Y, so the world hitbox is independent of offset.y —
    // this shifts ONLY the visual down; hitbox + death landing are unchanged.
    this.body.setSize(140, 138);
    this.body.setOffset(60, 37);
    // `pushable`, unlike `immovable`, only affects the velocity/position
    // exchange in dynamic-vs-dynamic separation (player collider) — it
    // doesn't touch the dynamic-vs-static floor collider, so it doesn't
    // trigger the immovable-vs-immovable deadlock described above. Result:
    // the player still collides with him (can't walk through) but can't
    // shove him around.
    this.body.pushable = false;

    this._blizzardCooldown = YETI_BLIZZARD_COOLDOWN * 0.4;   // shorter first wait
    this._meleeCooldown = 0;
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

    // Facing is set once when a swing or cast starts (see _startMelee /
    // _startBlizzard) and held for its duration — re-facing every frame here
    // would spin the sprite mid-swing/mid-cast if the player crosses sides.
    if (this._attacking) return;

    this._faceTowardPlayer(player);
    this._blizzardCooldown -= delta;
    this._meleeCooldown    -= delta;

    // The blizzard's fixed clock outranks the mace: when the cast comes due it
    // interrupts the melee rhythm rather than queueing behind it.
    if (this._blizzardCooldown <= 0) {
      this.body.setVelocityX(0);
      this._startBlizzard(player);
      return;
    }

    // Between casts he hounds the player relentlessly, staying right on top of
    // them — and anyone who lingers inside his reach eats the mace.
    const dist = Math.abs(player.x - this.x);

    if (dist <= YETI_MELEE_RANGE && this._meleeCooldown <= 0) {
      this.body.setVelocityX(0);
      this._startMelee(player);
      return;
    }

    let walking = false;
    if (dist > YETI_FOLLOW_RANGE) {
      const dir = player.x < this.x ? -1 : 1;
      this.body.setVelocityX(dir * YETI_SPEED);
      walking = true;
    } else {
      this.body.setVelocityX(0);
    }

    const anim = walking ? 'yeti-run' : 'yeti-idle';
    if (this.anims.currentAnim?.key !== anim) this.play(anim, true);
  }

  _startMelee(player) {
    this._attacking     = true;
    this._meleeCooldown = YETI_MELEE_COOLDOWN;
    this._swung         = false;
    this.body.setVelocityX(0);

    this.play('yeti-attack', true);
    this._faceTowardPlayer(player);   // re-face now that facing is frozen for the swing's duration
    Audio.play('swing');

    // Which way the mace travels in world space, locked in at the swing's start.
    // The player can still slip behind him during the long windup, and a blow
    // that started on the other side must not connect (SnowLeopard's bite has
    // the same rule) — so remember the side he committed to.
    const dir = player.x < this.x ? -1 : 1;

    const onUpdate = (anim, frame) => {
      if (!this._swung && frame.index >= YETI_MELEE_HIT_FRAME) {
        this._swung = true;
        this._landMeleeHit(player, dir);
      }
    };
    this.on('animationupdate', onUpdate);

    this.once('animationcomplete-yeti-attack', () => {
      this.off('animationupdate', onUpdate);
      this._attacking = false;
      if (this.alive) this.play('yeti-idle', true);
    });
  }

  // The mace connects. Unlike the blizzard this is an ordinary blow, so it goes
  // through Player.takeDamage's normal path: a raised guard parries it outright.
  _landMeleeHit(player, dir) {
    // Same guard as _unleashBlizzard: a killing blow can land mid-swing without
    // stopping this listener (see onDeath), so a dead boss must not still hit.
    if (!this.alive) return;

    const dx = player.x - this.x;
    const inFront = dir > 0 ? dx > -20 : dx < 20;
    if (!inFront || Math.abs(dx) > YETI_MELEE_RANGE) return;   // they slipped the swing

    // Only dress the hit if HP actually moved — takeDamage bails out on a parry,
    // a dodge, or leftover i-frames, and each of those already plays its own cue.
    const hpBefore = player.hp;
    player.takeDamage(YETI_MELEE_DMG);
    if (player.hp === hpBefore) return;

    if (!player.alive) this._faceRight();
    impactSparks(this.scene, player.x, player.y - 20, 0xbfe4ff, 12);
    shake(this.scene, 160, 0.007);
    Audio.play('hit');
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
    // A frozen hazard, not a blow — unblockable (dodge it), and always 15% of the
    // player's max HP so it stays dangerous no matter how many herbs they've eaten.
    player.takeDamage(Math.max(1, Math.ceil(player.maxHp * YETI_BLIZZARD_PCT)), true);
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
