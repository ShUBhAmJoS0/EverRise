import Phaser from 'phaser';
import InputManager from '../systems/InputManager.js';
import GuleliStone from './GuleliStone.js';
import { shake, hitStop, dustBurst, impactSparks, slashArc } from '../systems/fx.js';
import Audio from '../systems/AudioManager.js';

// ── Tunables ────────────────────────────────────────────────────────────────
const PLAYER_MAX_HP     = 100;
const PLAYER_SCALE      = 1.08;   // slightly larger than before so he reads as the hero
const PLAYER_BRIGHTNESS = 1.35;   // lift the (slightly dull) main sheets to read brighter

// Collision body, in 256px source-frame pixels (measured from the idle sprite:
// figure centred at x≈128, feet sole at row≈201, grass surface sits 25px below
// the floor collision line). The body bottom is placed so the visible feet land
// exactly on the grass — no sink, no float — and the body is centred on the
// figure (not the sword).
const BODY_W  = 64;
const BODY_H  = 150;
const BODY_OX = 96;    // centred on x≈128
const BODY_OY = 0;     // body bottom = 150 → feet sit ~15px lower, walking ON the path
const PLAYER_SPEED      = 230;
const SPRINT_MULT       = 1.6;    // Left Shift while moving
const PLAYER_JUMP_VEL   = -680;   // strong initial pop for a snappy launch
const DOUBLE_JUMP_VEL   = -620;   // second (air) jump, a touch weaker
const MAX_JUMPS         = 2;

// Snappy, responsive arc (not floaty): world gravity is 800, and the player adds
// this on top. Falling faster than the rise is the standard platformer trick that
// makes the jump feel quick and weighty. Total air time ≈ 0.75s (was ~1.05s).
const JUMP_RISE_GRAVITY = 900;    // + world 800 → 1700 while going up
const JUMP_FALL_GRAVITY = 1300;   // + world 800 → 2100 while coming down

// Jump feel (the "trinity"):
// - Coyote time: you can still jump for a moment after walking off an edge.
// - Jump buffer: pressing jump slightly before landing still fires on touchdown.
// - Variable height: releasing jump while rising cuts the arc into a short hop.
const COYOTE_MS         = 100;
const JUMP_BUFFER_MS    = 130;
const JUMP_CUT_MULT     = 0.45;   // velocity multiplier when jump is released early
const JUMP_CUT_MIN_VY   = -160;   // only cut while still rising faster than this

// Melee (Khukuri). Trimmed to the swing (no slow ready-stance / long follow-
// through) and sped up, then the player snaps back to idle shortly after the
// hit so attacks chain quickly into combos.
const ATTACK_DMG        = 25;
const ATTACK_RANGE      = 185;    // px in front of the player
const ATTACK_VERT       = 150;    // vertical reach (enemies roughly same height)
const ATTACK_KNOCKBACK  = 220;
const ATTACK_COOLDOWN   = 170;    // ms between standard swings
const HIT_FRAME         = 8;      // index in the trimmed sheet where the blade connects
const ATTACK_FPS        = 26;
const ATTACK_RECOVER    = 90;     // ms after the hit before returning to idle (cuts follow-through)

// Combo (Right Shift): two-hit chain, second hit stronger
const COMBO_DMG_2       = 38;
const COMBO_RANGE_2     = 215;
const COMBO_KNOCKBACK_2 = 320;
const COMBO_COOLDOWN    = 720;

// Dodge (Q): quick i-frame dash
const DODGE_SPEED       = 560;
const DODGE_TIME        = 240;    // ms of dash + invulnerability
const DODGE_COOLDOWN    = 600;

// Guleli (Right Ctrl): ranged slingshot. HOLD to charge (longer = faster/farther/
// stronger stone), release to fire. Aim up/down with W·↑ / S·↓.
const GULELI_COOLDOWN      = 650;
const GULELI_MAX_CHARGE_MS = 900;   // hold time for a full-power shot
const GULELI_MIN_POWER     = 0.18;  // a quick tap fires a weak, short-range shot
// The Guleli sheet draws the figure ~21% bigger than the other animations
// (≈178px vs the idle's 147px), so render it smaller to keep a constant on-screen
// size: PLAYER_SCALE × 147/178 ≈ 0.89.
const GULELI_SCALE         = PLAYER_SCALE * (147 / 178);

const DAMAGE_COOLDOWN   = 800;    // i-frames after taking a hit

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player-idle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = PLAYER_MAX_HP;
    this.hp    = PLAYER_MAX_HP;
    this.alive = true;

    // Permanent HP from herbs eaten this run persists across a death/restart.
    const hpBonus = scene.registry.get('hpBonus') || 0;
    if (hpBonus > 0) { this.maxHp += hpBonus; this.hp = this.maxHp; }

    this.setScale(PLAYER_SCALE);
    this.setDepth(10);

    // Collision body sized so its BOTTOM sits exactly at the character's feet, so
    // resting the body on the floor puts the feet on the platform surface (no
    // sink, no clip). Keep the player locked inside the playable area.
    this.body.setCollideWorldBounds(true);
    this.body.setGravityY(JUMP_RISE_GRAVITY);
    this.body.setSize(BODY_W, BODY_H);
    this.body.setOffset(BODY_OX, BODY_OY);

    // Floor safety: scenes set this to their FLOOR_Y. If the player ever ends up
    // below the floor (e.g. a physics hiccup), they're snapped straight back —
    // they can never fall through the stage.
    this.floorY = null;
    this._spawnY = y;

    // ── State ────────────────────────────────────────────────────────────────
    this._attackCooldown = 0;
    this._dodgeCooldown  = 0;
    this._guleliCooldown = 0;
    this._damageCooldown = 0;
    this._isAttacking    = false;
    this._isDodging      = false;
    this._isCharging     = false;
    this._isBlocking     = false;
    this._chargeStart    = 0;
    this._chargeDir      = 1;
    this._chargeMaxed    = false;
    this._jumpsUsed      = 0;
    this._coyoteTimer    = 0;
    this._jumpBufferTimer = 0;
    this._jumpCutDone    = true;
    this._wasOnGround    = true;
    this._healthEmitted  = false;
    this.inputLocked     = false;   // true during story dialogue — stand still
    this._scriptTargetX  = null;    // set during cave walk-in/out cutscenes
    this._scriptOnArrive = null;
    this._timers         = [];
    this._stones         = [];
    // The Guleli is LOCKED until a grateful villager gifts it at the end of
    // Stage 1 (registry flag, so it stays unlocked across stages/restarts).
    this._guleliUnlocked = !!scene.registry.get('guleliUnlocked');

    this.controls = new InputManager(scene);

    this._applyBrightness();
    this.play('player-idle');
  }

  // Uniform brightness lift so the character reads bright/vibrant (not a glow,
  // outline, or bloom — just a colour-matrix brightness on the sprite itself).
  _applyBrightness() {
    try { this.preFX?.addColorMatrix().brightness(PLAYER_BRIGHTNESS); } catch (_) { /* canvas: skip */ }
  }

  update(delta, enemies) {
    if (!this.alive) return;
    this.controls.update();

    // Broadcast starting HP once, after the HUD has had a frame to subscribe.
    if (!this._healthEmitted) {
      this._healthEmitted = true;
      this.scene.events.emit('playerHealthChanged', this.hp, this.maxHp);
    }

    this._attackCooldown -= delta;
    this._dodgeCooldown  -= delta;
    this._guleliCooldown -= delta;
    this._damageCooldown -= delta;

    // Snappier jump: come down faster than you went up (kills the floaty feel).
    this.body.setGravityY(this.body.velocity.y < 0 ? JUMP_RISE_GRAVITY : JUMP_FALL_GRAVITY);

    const onGround = this.body.blocked.down;
    if (onGround) {
      if (!this._wasOnGround) this._onLand();
      this._jumpsUsed = 0;
      this._coyoteTimer = COYOTE_MS;
      // Stop any residual gravity/downward velocity the instant we land so the
      // feet stay planted on the surface (no sink, no jitter).
      if (this.body.velocity.y > 0) this.body.setVelocityY(0);
    } else {
      this._coyoteTimer -= delta;
      // Coyote expired without jumping → the ground jump is spent; only the
      // air jump remains (walking off a ledge shouldn't grant two jumps).
      if (this._coyoteTimer <= 0 && this._jumpsUsed === 0) this._jumpsUsed = 1;
    }
    this._wasOnGround = onGround;

    // Buffer a jump press so landing within the window still fires it.
    if (this.controls.jumpPressed) this._jumpBufferTimer = JUMP_BUFFER_MS;
    else this._jumpBufferTimer -= delta;

    // Variable jump height: releasing jump while still rising cuts the arc.
    if (!this._jumpCutDone && !this.controls.jumpHeld && this.body.velocity.y < JUMP_CUT_MIN_VY) {
      this.body.setVelocityY(this.body.velocity.y * JUMP_CUT_MULT);
      this._jumpCutDone = true;
    }

    // Scripted cutscene walk (cave entrance/exit): drive movement, ignore input.
    if (this._scriptTargetX !== null) {
      this._updateScriptedWalk();
      this._updateStones(enemies);
      this._clampToFloor();
      return;
    }

    // Story dialogue: stand still and listen (physics/anims keep running).
    if (this.inputLocked) {
      this.body.setVelocityX(0);
      if (onGround) this._playAnim('player-idle');
      this._updateStones(enemies);
      this._clampToFloor();
      return;
    }

    if (this._isCharging) this._updateCharge();

    // Block (hold X / right-mouse): raise the guard, root in place, take reduced
    // damage. Only on the ground and when not already committed to another action.
    if (this.controls.blockHeld && onGround && !this._isAttacking && !this._isDodging && !this._isCharging) {
      this._enterBlock();
      this._updateStones(enemies);
      this._clampToFloor();
      return;
    }
    if (this._isBlocking) this._exitBlock();

    this._handleDodge(onGround);
    if (!this._isDodging) {
      this._handleMovement(onGround);
      this._handleJump(onGround);
      this._handleAttacks(enemies);
    }

    this._updateStones(enemies);
    this._clampToFloor();
  }

  // ── Block / guard (hold X or right-mouse) ────────────────────────────────────
  _enterBlock() {
    this.body.setVelocityX(0);
    if (!this._isBlocking) {
      this._isBlocking = true;
      this.play('player-block', true);   // raises the guard, holds on the last frame
    }
  }

  _exitBlock() {
    this._isBlocking = false;
    this._playAnim('player-idle');
  }

  // Hard guarantee: the player can never be below the grass line. The grounded
  // sprite.y is floorY - GROUND_OFFSET; if they ever drop past it (physics
  // hiccup, fast landing), they're snapped straight back onto the surface.
  _clampToFloor() {
    if (this.floorY === null) return;
    // Grounded position depends on the current scale (the Guleli renders smaller),
    // so derive it live instead of from a fixed offset.
    const restY = this.floorY - (BODY_OY + BODY_H - 128) * this.scaleY;
    if (this.y > restY) {
      this.setY(restY);
      if (this.body.velocity.y > 0) this.body.setVelocityY(0);
    }
  }

  // ── Movement ───────────────────────────────────────────────────────────────
  _handleMovement(onGround) {
    if (this._isAttacking) {
      if (onGround) this.body.setVelocityX(0);   // root grounded swings; keep air momentum
      return;
    }

    const sprint = this.controls.sprintHeld ? SPRINT_MULT : 1;
    const speed  = PLAYER_SPEED * sprint;

    if (this.controls.left) {
      this.body.setVelocityX(-speed);
      this.setFlipX(true);
      if (onGround) this._playAnim('player-run');
    } else if (this.controls.right) {
      this.body.setVelocityX(speed);
      this.setFlipX(false);
      if (onGround) this._playAnim('player-run');
    } else {
      this.body.setVelocityX(0);
      if (onGround) this._playAnim('player-idle');
    }
  }

  // ── Jump / double jump ───────────────────────────────────────────────────────
  _handleJump(onGround) {
    if (this._isAttacking) return;

    // Ground jump: consumes the buffered press, works during coyote time.
    if (this._jumpBufferTimer > 0 && this._coyoteTimer > 0 && this._jumpsUsed === 0) {
      this._doJump(PLAYER_JUMP_VEL, 'player-jump', 'jump');
      this._jumpsUsed = 1;
      this._coyoteTimer = 0;
      this._jumpBufferTimer = 0;
      return;
    }

    // Air (double) jump: requires a fresh press, not a stale buffer.
    if (this.controls.jumpPressed && this._jumpsUsed > 0 && this._jumpsUsed < MAX_JUMPS) {
      this._doJump(DOUBLE_JUMP_VEL, 'player-doublejump', 'doubleJump');
      this._jumpsUsed = MAX_JUMPS;
      this._jumpBufferTimer = 0;
    }
  }

  _doJump(vel, anim, sound) {
    this.body.setVelocityY(vel);
    this._jumpCutDone = false;   // arm the early-release height cut
    this.play(anim, true);
    Audio.play(sound);
  }

  _onLand() {
    // A small puff of dust on landing (no scale tween — keeps the body stable
    // and the feet planted).
    dustBurst(this.scene, this.x, this.body.bottom);
    Audio.play('land');
  }

  // ── Dodge roll (Q) ───────────────────────────────────────────────────────────
  _handleDodge(onGround) {
    if (this._isDodging) return;
    if (!this.controls.dodgePressed || this._dodgeCooldown > 0 || this._isAttacking) return;

    this._isDodging      = true;
    this._dodgeCooldown  = DODGE_COOLDOWN;
    this._damageCooldown = DODGE_TIME;   // i-frames for the duration of the dash

    // Dash toward held direction, else current facing.
    const dir = this.controls.left ? -1 : this.controls.right ? 1 : (this.flipX ? -1 : 1);
    this.setFlipX(dir < 0);
    this.body.setVelocityX(dir * DODGE_SPEED);
    this._playAnim('player-run');
    this.setAlpha(0.55);
    this.setTint(0x66ddff);

    this._delay(DODGE_TIME, () => {
      this._isDodging = false;
      this.clearTint();
      this.setAlpha(1);
      this.body.setVelocityX(0);
    });
  }

  // ── Attacks: melee (Enter/Z), combo (Right Shift), Guleli (Right Ctrl) ────────
  _handleAttacks(enemies) {
    if (this._isAttacking) return;

    // Guleli has its own cooldown so it can be used between melee swings — but
    // only once it's been gifted (locked through all of Stage 1).
    if (this._guleliUnlocked && this.controls.guleliPressed && this._guleliCooldown <= 0) {
      this._startGuleli();
      return;
    }
    if (this._attackCooldown > 0) return;

    if (this.controls.comboPressed) {
      this._startCombo(enemies);
    } else if (this.controls.attackPressed) {
      this._startAttack(enemies);
    }
  }

  // ── Guleli (slingshot): hold Right Ctrl to charge, release to fire ────────────
  _startGuleli() {
    this._isAttacking = true;
    this._isCharging  = true;
    this._chargeMaxed = false;
    this._chargeStart = this.scene.time.now;
    this.body.setVelocityX(0);
    this.setScale(GULELI_SCALE);   // keep the slingshot at the normal on-screen size

    // Lock facing for the shot; aim is read at release.
    this._chargeDir = this.controls.left ? -1 : this.controls.right ? 1 : (this.flipX ? -1 : 1);
    this.setFlipX(this._chargeDir < 0);

    this.play('player-guleli-draw', true);   // windup; holds on its last frame
    Audio.play('jump');                       // soft pull-back cue
  }

  // Called each frame while charging: fires on release or when fully charged.
  _updateCharge() {
    const elapsed = this.scene.time.now - this._chargeStart;
    if (!this._chargeMaxed && elapsed >= GULELI_MAX_CHARGE_MS) {
      this._chargeMaxed = true;
      impactSparks(this.scene, this.x + this._chargeDir * 60, this.y - 20, 0xffe27a, 6);  // "fully drawn" cue
      Audio.play('menuSelect');
    }
    if (!this.controls.guleliDown || elapsed >= GULELI_MAX_CHARGE_MS) {
      this._releaseGuleli(elapsed);
    }
  }

  _releaseGuleli(elapsed) {
    this._isCharging     = false;
    this._guleliCooldown = GULELI_COOLDOWN;

    const charge = Phaser.Math.Clamp(elapsed / GULELI_MAX_CHARGE_MS, 0, 1);
    const power  = GULELI_MIN_POWER + (1 - GULELI_MIN_POWER) * charge;
    const aim    = this.controls.up ? -1 : this.controls.down ? 1 : 0;

    this.play('player-guleli-release', true);
    this._delay(60, () => this._fireStone(this._chargeDir, aim, power));

    this.once('animationcomplete-player-guleli-release', () => {
      this.setScale(PLAYER_SCALE);   // restore normal scale after the slingshot
      if (!this.alive) return;
      this._isAttacking = false;
      this._playAnim('player-idle');
    });
  }

  _fireStone(dir, aim, power = 1) {
    const x = this.x + dir * 70;
    const y = this.y - 20;
    const stone = new GuleliStone(this.scene, x, y, dir, aim, power);
    this._stones.push(stone);
    Audio.play('guleli');
  }

  // Manual AABB check of live stones against enemies (stones arc independently).
  _updateStones(enemies) {
    if (this._stones.length === 0) return;
    this._stones = this._stones.filter((s) => s.active);
    for (const s of this._stones) {
      if (!s.alive) continue;
      for (const e of enemies) {
        if (!e.alive || !e.body) continue;
        const hit = s.body.right > e.body.x && s.body.x < e.body.right &&
                    s.body.bottom > e.body.y && s.body.y < e.body.bottom;
        if (hit) { s.hitEnemy(e); break; }
      }
    }
  }

  _startAttack(enemies) {
    this._isAttacking    = true;
    this._attackCooldown = ATTACK_COOLDOWN;
    this.play('player-attack', true);

    const hitDelay = (1000 / ATTACK_FPS) * HIT_FRAME;
    this._delay(hitDelay, () => {
      this._swingTrail();
      this._applyHit(enemies, ATTACK_DMG, ATTACK_RANGE, ATTACK_KNOCKBACK);
    });

    // Snap back to idle shortly after the hit (don't wait out the follow-through)
    // so the next swing / combo can start almost immediately.
    this._delay(hitDelay + ATTACK_RECOVER, () => {
      if (!this.alive) return;
      this._isAttacking = false;
      this._playAnim('player-idle');
    });
  }

  // Two-hit Khukuri combo: a normal swing, then a stronger follow-up swing.
  _startCombo(enemies) {
    this._isAttacking    = true;
    this._attackCooldown = COMBO_COOLDOWN;
    this.play('player-attack', true);

    const swing = (1000 / ATTACK_FPS) * HIT_FRAME;

    // Hit 1
    this._delay(swing, () => { this._swingTrail(); this._applyHit(enemies, ATTACK_DMG, ATTACK_RANGE, ATTACK_KNOCKBACK); });
    // Quick replay for the second, stronger swing
    this._delay(swing + 70, () => { if (this.alive) this.play('player-attack', true); });
    this._delay(swing + 70 + swing, () => {
      this._swingTrail();
      this._applyHit(enemies, COMBO_DMG_2, COMBO_RANGE_2, COMBO_KNOCKBACK_2);
      this._delay(ATTACK_RECOVER, () => {
        if (!this.alive) return;
        this._isAttacking = false;
        this._playAnim('player-idle');
      });
    });
  }

  _swingTrail() {
    const facing = this.flipX ? -1 : 1;
    slashArc(this.scene, this.x + facing * 60, this.y - 10, facing);
    Audio.play('swing');
  }

  // Facing-aware melee: only enemies in FRONT of the player, within reach, get hit.
  _applyHit(enemies, damage, range, knockback) {
    if (!this.alive) return;
    const facing = this.flipX ? -1 : 1;
    let landed = false;

    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const dx = enemy.x - this.x;
      const dy = Math.abs(enemy.y - this.y);
      const inFront = facing > 0 ? dx > -30 : dx < 30;  // small grace so point-blank still hits
      if (inFront && Math.abs(dx) <= range && dy <= ATTACK_VERT) {
        enemy.takeDamage(damage, facing * knockback);
        impactSparks(this.scene, enemy.x, enemy.y - 10);
        landed = true;
      }
    });

    if (landed) { hitStop(this.scene, 55); shake(this.scene, 70, 0.0035); Audio.play('hit'); }
  }

  // ── Scripted walk (cave entrance/exit cutscenes) ─────────────────────────────
  // Drive the hero on a scripted walk to targetX, ignoring player input;
  // onArrive() fires once when he reaches it.
  startScriptedWalk(targetX, onArrive = null) {
    this._scriptTargetX  = targetX;
    this._scriptOnArrive = onArrive;
    this.inputLocked     = true;
  }

  _updateScriptedWalk() {
    const remaining = this._scriptTargetX - this.x;
    if (Math.abs(remaining) <= 5) {
      this.body.setVelocityX(0);
      this._playAnim('player-idle');
      const cb = this._scriptOnArrive;
      this._scriptTargetX  = null;
      this._scriptOnArrive = null;
      cb?.();
      return;
    }
    const dir = remaining < 0 ? -1 : 1;
    this.setFlipX(dir < 0);
    this.body.setVelocityX(dir * PLAYER_SPEED * 0.8);
    this._playAnim('player-run');
  }

  // Freeze cleanly for a story beat. Cancels any in-progress action first so that
  // locking input mid-attack or mid-Guleli-charge can't leave the hero stuck
  // (frozen, or shrunk at the Guleli scale). Call in place of `inputLocked = true`.
  enterCutscene() {
    this._clearTimers();
    this._isAttacking = false;
    this._isCharging  = false;
    this._isDodging   = false;
    this._isBlocking  = false;
    this._chargeMaxed = false;
    this.setScale(PLAYER_SCALE);
    this.clearTint();
    this.setAlpha(1);
    if (this.body) this.body.setVelocity(0, 0);
    this.inputLocked = true;
    this._playAnim('player-idle');
  }

  // Hand control back after a story beat.
  exitCutscene() {
    this.inputLocked = false;
  }

  // Permanent growth (e.g. eating Yarsagumba): raise the cap and heal.
  increaseMaxHp(amount, heal = 0) {
    this.maxHp += amount;
    this.hp = Math.min(this.maxHp, this.hp + amount + heal);
    this.scene.events.emit('playerHealthChanged', this.hp, this.maxHp);
  }

  // Grant the Guleli (the villager's Stage-1 gift). Persisted so it stays
  // unlocked across stage transitions and death-restarts.
  unlockGuleli() {
    this._guleliUnlocked = true;
    this.scene.registry.set('guleliUnlocked', true);
  }

  // ── Damage / death ───────────────────────────────────────────────────────────
  // unblockable: the attacker strikes THROUGH a raised guard (only the wolf does).
  takeDamage(amount, unblockable = false) {
    if (!this.alive || this._damageCooldown > 0 || this._isDodging) return;

    // A raised guard fully parries the blow — with a shield spark and brief
    // i-frames, no HP lost. The corrupted wolf is the exception: it strikes
    // straight through the block for full damage.
    if (this._isBlocking && !unblockable) {
      this._damageCooldown = DAMAGE_COOLDOWN * 0.4;
      const facing = this.flipX ? -1 : 1;
      impactSparks(this.scene, this.x + facing * 46, this.y - 34, 0xbfe4ff, 10);
      Audio.play('shieldBreak');
      shake(this.scene, 55, 0.003);
      return;   // parried — no damage
    }

    // A guard broken by the wolf gets a sharper "pierced" cue over the normal hit.
    if (this._isBlocking && unblockable) {
      impactSparks(this.scene, this.x, this.y - 30, 0xff8844, 10);
    }

    this._damageCooldown = DAMAGE_COOLDOWN;
    this.hp -= amount;
    this.setTint(0xff0000);
    this._delay(200, () => { if (this.alive) this.clearTint(); });

    shake(this.scene, 140, 0.006);
    Audio.play('hurt');
    this.scene.events.emit('playerHealthChanged', this.hp, this.maxHp);

    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.scene.events.emit('playerDied');   // HUD hides the boss bar so it can't linger
    this._clearTimers();
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.setTint(0x888888);
    this.scene.time.delayedCall(1500, () => this.scene.scene.restart());
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  _playAnim(key) {
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
  }

  _delay(ms, fn) {
    const t = this.scene.time.delayedCall(ms, () => {
      if (this.alive || this.active) fn();
    });
    this._timers.push(t);
    return t;
  }

  _clearTimers() {
    this._timers.forEach((t) => t?.remove());
    this._timers = [];
  }

  destroy(fromScene) {
    this.controls?.destroy();
    super.destroy(fromScene);
  }
}
