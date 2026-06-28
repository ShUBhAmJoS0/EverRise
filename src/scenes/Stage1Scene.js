import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Wolf from '../entities/enemies/Wolf.js';
import Snake from '../entities/enemies/Snake.js';
import Enemy from '../entities/Enemy.js';
import ForestWitch from '../entities/bosses/ForestWitch.js';
import Projectile from '../entities/Projectile.js';
import { STAGE1_WAVES, LEVEL_WIDTH, FLOOR_Y } from '../config/waves.js';
import { setCameraBounds } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';
import { runDialogue, say } from '../systems/dialogue.js';
import { impactSparks } from '../systems/fx.js';
import Audio from '../systems/AudioManager.js';
import Yarsagumba from '../entities/pickups/Yarsagumba.js';

const BG_TILE_WIDTH  = 1376;
const GAME_HEIGHT    = 720;
const PLATFORM_IMG_W = 677;

const YARSA_KEY = 'yarsa:Stage1';   // registry flag: herb already eaten this run
const YARSA_X   = 3380;             // where it lies in the grass, before the witch

const INTRO_LINES = [
  'This forest... my homeland. The corruption spreads deeper every day.',
  'Wolves twisted by dark magic. Serpents in the sacred groves. And whispers of a witch by the old temple...',
  'I am the guardian of these hills. I must conquer this darkness — for Nepal, for the mountains, for all who live beneath them.',
  'Let the journey begin.',
];

export default class Stage1Scene extends Phaser.Scene {
  constructor() {
    super('Stage1Scene');
  }

  create() {
    this._enemies     = [];
    this._waveIndex   = 0;
    this._waveActive  = false;
    this._waveBarrier = null;

    // Resume from the last cleared wave after a death (registry survives the
    // scene.restart), instead of replaying the whole stage.
    this._checkpoint = this.registry.get('checkpoint:Stage1Scene') || null;
    if (this._checkpoint) this._waveIndex = this._checkpoint.waveIndex;

    // Expand physics world to match the full scrolling level.
    // Without this the player hits an invisible wall at x=1280 (the default game width).
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    const spawnX = this._checkpoint ? this._checkpoint.x : 150;
    this._player = new Player(this, spawnX, FLOOR_Y - 65);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this._player, true, 0.1, 0.05);
    this.cameras.main.setDeadzone(80, 120);

    this._triggers = STAGE1_WAVES.map((wave) =>
      this.add.zone(wave.triggerX, GAME_HEIGHT / 2, 10, GAME_HEIGHT)
    );

    this.events.once('bossDefeated', this._onBossDefeated, this);

    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');

    setupPause(this);
    SaveManager.recordStageReached(1);

    // If the herb was already eaten this run, keep its max-HP bonus after death;
    // if the snakes were cleared but it wasn't eaten, put it back in the grass.
    if (this.registry.get(YARSA_KEY)) {
      this._player.increaseMaxHp(25, 0);
    } else if (this._waveIndex >= 3) {
      this._spawnYarsagumba();
    }

    // Opening story beat — only on a fresh visit, not on checkpoint respawns.
    if (!this._checkpoint) {
      this._player.inputLocked = true;
      runDialogue(this, INTRO_LINES).then(() => {
        if (this._player.active) this._player.inputLocked = false;
      });
    }

    // F1 toggles the physics debug overlay (D is now "move right").
    this.input.keyboard.on('keydown-F1', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    });
  }

  update(time, delta) {
    if (!this._player.alive) return;
    this._player.update(delta, this._enemies.filter((e) => e.alive));
    this._enemies.forEach((e) => { if (e.active) e.updateBehavior(this._player, delta); });
    Enemy.separate(this._enemies);
    this._yarsa?.update(this._player);
    this._checkTriggers();
    this._checkTransientAdvance();
    this._cullDeadEnemies();
  }

  _spawnYarsagumba() {
    this._yarsa = new Yarsagumba(this, YARSA_X, FLOOR_Y + 30, YARSA_KEY);
  }

  // ── The witch's magic shield wall ────────────────────────────────────────────
  _createShield(x) {
    const wall = this.add.rectangle(x, GAME_HEIGHT / 2, 30, GAME_HEIGHT, 0x7a2bd8, 0.20).setDepth(9);
    const core = this.add.rectangle(x, GAME_HEIGHT / 2, 10, GAME_HEIGHT, 0xc98aff, 0.45).setDepth(9);
    this.tweens.add({ targets: [wall, core], alpha: { from: 0.9, to: 0.45 }, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    // slow drifting motes inside the wall
    const motes = this.add.particles(x, GAME_HEIGHT / 2, 'spark', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-12, -GAME_HEIGHT / 2, 24, GAME_HEIGHT) },
      speedY: { min: -28, max: -8 }, lifespan: 1400, scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 }, tint: 0xc98aff, frequency: 90,
    }).setDepth(9);
    this._shieldFx = [wall, core, motes];
  }

  _destroyShield() {
    if (!this._shieldFx) return;
    const x = this._shieldFx[0].x;
    for (let y = 120; y < GAME_HEIGHT; y += 130) impactSparks(this, x, y, 0xc98aff, 8);
    Audio.play('shieldBreak');
    this.cameras.main.flash(220, 160, 100, 255);
    this._shieldFx.forEach((o) => o.destroy());
    this._shieldFx = null;
    say(this, this._player, 'The shield is broken — the path is clear!');
  }

  // For a transient wave (snake ambush): if the player pushes on toward the next
  // wave, any remaining enemies slink away so the player is never stuck.
  _checkTransientAdvance() {
    if (!this._waveActive) return;
    const wave = STAGE1_WAVES[this._waveIndex];
    if (!wave?.transient) return;
    const next = STAGE1_WAVES[this._waveIndex + 1];
    const advanceX = next ? next.triggerX - 100 : wave.triggerX + 600;
    if (this._player.x >= advanceX) {
      this._enemies.forEach((e) => { if (e.alive) e.die(); });
    }
  }

  _buildBackground() {
    const tilesNeeded = Math.ceil(LEVEL_WIDTH / BG_TILE_WIDTH) + 1;
    for (let i = 0; i < tilesNeeded; i++) {
      this.add.image(i * BG_TILE_WIDTH + BG_TILE_WIDTH / 2, GAME_HEIGHT / 2, 'stage1-bg');
    }
  }

  _buildPlatforms() {
    // The platform image (677×369) has its flat walkable surface at row ~96.
    // The player's body bottom rests at FLOOR_Y but his visible feet (foot mass,
    // not the sword tip) sit ~33px lower. Place the walkable surface at that foot
    // line so the character runs directly on the platform surface:
    //   image top = (FLOOR_Y + PLAYER_SINK) - SURFACE_OFFSET.
    const SURFACE_OFFSET = 96;
    const PLAYER_SINK    = 25;
    const platformTopY   = FLOOR_Y + PLAYER_SINK - SURFACE_OFFSET;
    const numTiles = Math.ceil(LEVEL_WIDTH / PLATFORM_IMG_W) + 1;
    for (let i = 0; i < numTiles; i++) {
      this.add.image(
        i * PLATFORM_IMG_W + PLATFORM_IMG_W / 2,
        platformTopY,
        'stage1-platform'
      ).setOrigin(0.5, 0).setDepth(1);
    }

    // Solid invisible floor: one continuous static body across the whole level
    // (no gaps, no floating platforms). Its TOP edge sits at FLOOR_Y so character
    // feet (body bottoms) rest on the visible surface. Made very thick so a fast
    // landing can never penetrate past half and get pushed out the bottom.
    const FLOOR_THICKNESS = 500;
    this._floor = this.physics.add.staticImage(0, 0, '__WHITE')
      .setOrigin(0, 0)
      .setDisplaySize(LEVEL_WIDTH, FLOOR_THICKNESS)
      .setPosition(0, FLOOR_Y)
      .setAlpha(0)
      .refreshBody();
  }

  _checkTriggers() {
    if (this._waveActive || this._waveIndex >= STAGE1_WAVES.length) return;
    const trigger = this._triggers[this._waveIndex];
    if (!trigger?.active) return;
    if (this._player.x >= trigger.x) {
      trigger.destroy();
      this._activateWave(this._waveIndex);
    }
  }

  _activateWave(index) {
    this._waveActive = true;
    const waveDef    = STAGE1_WAVES[index];

    // Transient ambushes (snakes) don't trap the player behind a barrier.
    if (!waveDef.transient) {
      const barrierX = waveDef.triggerX + 200;
      this._waveBarrier = this.add.zone(barrierX, GAME_HEIGHT / 2, 20, GAME_HEIGHT);
      this.physics.add.existing(this._waveBarrier, true);
      this.physics.add.collider(this._player, this._waveBarrier);

      // The witch SEALS the path with a visible magic wall, so the blocked
      // barrier reads as her doing — not an invisible wall.
      if (waveDef.shield) {
        this._createShield(barrierX);
        say(this, this._player, 'Dark magic seals the path... only her fall will break it!');
      }
    }

    waveDef.enemies.forEach(({ type, x, y }) => {
      const enemy = this._spawnEnemy(type, x, y);
      if (enemy) this._enemies.push(enemy);
    });

    // Ambush waves get a sudden warning flash instead of a normal wave banner.
    if (waveDef.ambush) this.events.emit('ambush');
    else this.events.emit('waveStarted', index + 1, STAGE1_WAVES.length);
  }

  _spawnEnemy(type, x, y) {
    let enemy;
    switch (type) {
      case 'wolf':  enemy = new Wolf(this, x, y);        break;
      case 'snake': enemy = new Snake(this, x, y);       break;
      case 'witch': enemy = new ForestWitch(this, x, y); break;
      default: console.warn(`Unknown enemy type: ${type}`); return null;
    }
    this.physics.add.collider(enemy, this._floor);
    return enemy;
  }

  // Called by ForestWitch when its cast reaches the release frame.
  spawnWitchProjectile(x, y, dir) {
    const orb = new Projectile(this, x, y, dir);
    this.physics.add.overlap(this._player, orb, () => orb.hit(this._player));
    return orb;
  }

  _cullDeadEnemies() {
    if (!this._waveActive) return;
    const allDead = this._enemies.every((e) => !e.alive);
    if (!allDead) return;

    if (this._waveBarrier) { this._waveBarrier.destroy(); this._waveBarrier = null; }
    const cleared = STAGE1_WAVES[this._waveIndex];
    this._enemies = [];
    this._waveActive = false;
    this._waveIndex++;
    this.events.emit('waveCleared', this._waveIndex);

    if (cleared?.shield) this._destroyShield();

    // The serpents guarded something: the sacred herb appears in the grass.
    if (cleared?.id === 'snakes' && !this.registry.get(YARSA_KEY)) {
      this._spawnYarsagumba();
      say(this, this._player, 'Yarsagumba... the sacred herb of the mountains!');
    }

    // Checkpoint: a death now respawns here, not at the stage start.
    this.registry.set('checkpoint:Stage1Scene', {
      waveIndex: this._waveIndex,
      x: Phaser.Math.Clamp(this._player.x, 150, LEVEL_WIDTH - 300),
    });
    this.events.emit('checkpoint');
  }

  _onBossDefeated() {
    this.registry.remove('checkpoint:Stage1Scene');   // fresh start next visit
    this.registry.remove(YARSA_KEY);
    this.time.delayedCall(1500, () => {
      this.scene.stop('UIScene');
      this.scene.start('StageCompleteScene');
    });
  }
}
