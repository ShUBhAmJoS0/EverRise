import Phaser from 'phaser';
import Player from '../entities/Player.js';
import SnowLeopard from '../entities/enemies/SnowLeopard.js';
import YetiKing from '../entities/bosses/YetiKing.js';
import { STAGE3_WAVES } from '../config/waves3.js';
import { setCameraBounds } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';
import { addStartCave } from '../systems/caves.js';

// ── Stage 3: Frozen Glacier ──────────────────────────────────────────────────
// Scrolling icy background + seamless ice-shelf platform with a walkable player.
// Snow Leopard waves guard the glacier (1, then 3 — mirrors Stage 1/2), then the
// Yeti King — EverRise's final boss — casts blizzards at the far end.

const GAME_HEIGHT  = 720;
const LEVEL_WIDTH  = 5120;

// Walkable surface (world y) where character feet rest.
const FLOOR_Y      = 520;

// Background native 1694×928 → scaled to fill the 720px-tall view.
const BG_SCALE     = GAME_HEIGHT / 928;           // 0.776
const BG_TILE_W    = 1694 * BG_SCALE;             // ~1314

// Platform native 1536×1024 (measured from the PNG's alpha channel), walkable
// ice deck at row ~416 — opaque edge-to-edge, so tiles of exactly PLAT_TILE_W
// butt seamlessly with no gap.
const PLAT_SCALE   = 0.9;
const PLAT_TILE_W  = 1536 * PLAT_SCALE;           // ~1382
const PLAT_SURFACE = 416 * PLAT_SCALE;            // ~374px from image top to deck

// Player feet rest ~33px below FLOOR_Y; place the deck at that foot line.
const PLAYER_SINK  = 33;
const DECK_Y       = FLOOR_Y + PLAYER_SINK;

// UIScene shows "BOSS FIGHT" when waveNum === total, so the boss counts as one
// extra "wave" beyond the Snow Leopard waves for banner numbering.
const TOTAL_WAVE_COUNT = STAGE3_WAVES.length + 1;

// World-x where the Yeti King (final boss) appears, past both Leopard waves.
const BOSS_TRIGGER_X = 4200;
const BOSS_SPAWN_X   = 4700;

export default class Stage3Scene extends Phaser.Scene {
  constructor() {
    super('Stage3Scene');
  }

  create() {
    this._boss        = null;
    this._bossSpawned = false;

    this._enemies     = [];
    this._waveActive  = false;
    this._waveBarrier = null;
    this._stageComplete = false;

    // Resume from the last cleared wave after a death (registry survives the
    // scene.restart) — cleared waves' enemies never respawn.
    this._checkpoint = this.registry.get('checkpoint:Stage3Scene') || null;
    this._waveIndex  = this._checkpoint ? this._checkpoint.waveIndex : 0;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    const spawnX = this._checkpoint ? this._checkpoint.x : 150;
    this._player = new Player(this, spawnX, FLOOR_Y - 73);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this._player, true, 0.1, 0.05);
    this.cameras.main.setDeadzone(80, 120);

    // The hero emerges from the glacier cave into the final frozen stage.
    addStartCave(this, 'cave-stage3', 95, FLOOR_Y + 60, 1.0);

    this._triggers = STAGE3_WAVES.map((wave) =>
      this.add.zone(wave.triggerX, GAME_HEIGHT / 2, 10, GAME_HEIGHT)
    );

    this.events.once('bossDefeated', this._onBossDefeated, this);

    this.scene.launch('UIScene', { gameplayKey: 'Stage3Scene' });
    this.scene.bringToTop('UIScene');

    setupPause(this);
    SaveManager.recordStageReached(3);

    // F1 toggles the physics debug overlay (D is now "move right").
    this.input.keyboard.on('keydown-F1', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    });
  }

  update(time, delta) {
    if (!this._player.alive) return;

    const liveEnemies = this._enemies.filter((e) => e.alive);
    const targets = this._boss && this._boss.alive ? [...liveEnemies, this._boss] : liveEnemies;
    this._player.update(delta, targets);

    this._enemies.forEach((e) => { if (e.active) e.updateBehavior(this._player, delta); });
    this._checkTriggers();
    this._cullDeadEnemies();

    // Spawn the final boss once both Leopard waves are cleared and the player
    // reaches the far end of the glacier.
    if (!this._bossSpawned && this._waveIndex >= STAGE3_WAVES.length && this._player.x >= BOSS_TRIGGER_X) {
      this._spawnBoss();
    }

    if (this._boss && this._boss.active) {
      this._boss.updateBehavior(this._player, delta);
    }
  }

  _checkTriggers() {
    if (this._waveActive || this._waveIndex >= STAGE3_WAVES.length) return;
    const trigger = this._triggers[this._waveIndex];
    if (!trigger?.active) return;
    if (this._player.x >= trigger.x) {
      trigger.destroy();
      this._activateWave(this._waveIndex);
    }
  }

  _activateWave(index) {
    this._waveActive = true;
    const waveDef    = STAGE3_WAVES[index];

    const barrierX = waveDef.triggerX + 200;
    this._waveBarrier = this.add.zone(barrierX, GAME_HEIGHT / 2, 20, GAME_HEIGHT);
    this.physics.add.existing(this._waveBarrier, true);
    this.physics.add.collider(this._player, this._waveBarrier);

    waveDef.enemies.forEach(({ type, x, y }) => {
      const enemy = this._spawnEnemy(type, x, y);
      if (enemy) this._enemies.push(enemy);
    });

    this.events.emit('waveStarted', index + 1, TOTAL_WAVE_COUNT);
  }

  _spawnEnemy(type, x, y) {
    let enemy;
    switch (type) {
      case 'leopard': enemy = new SnowLeopard(this, x, y); break;
      default: console.warn(`Unknown enemy type: ${type}`); return null;
    }
    this.physics.add.collider(enemy, this._floor);
    this.physics.add.collider(this._player, enemy);
    return enemy;
  }

  _cullDeadEnemies() {
    if (!this._waveActive) return;
    const allDead = this._enemies.every((e) => !e.alive);
    if (!allDead) return;

    if (this._waveBarrier) { this._waveBarrier.destroy(); this._waveBarrier = null; }
    this._enemies = [];
    this._waveActive = false;
    this._waveIndex++;
    this.events.emit('waveCleared', this._waveIndex);

    // Checkpoint: a death now respawns here, not at the stage start — and the
    // Snow Leopards from cleared waves never spawn again. (Clearing the final
    // wave doesn't end the stage — the Yeti King fight still lies ahead.)
    this.registry.set('checkpoint:Stage3Scene', {
      waveIndex: this._waveIndex,
      x: Phaser.Math.Clamp(this._player.x, 150, LEVEL_WIDTH - 300),
    });
    this.events.emit('checkpoint');
  }

  _spawnBoss() {
    this._bossSpawned = true;
    // Spawn a bit above the floor and let gravity settle him onto the floor
    // collider — same pattern as every other enemy in this stage (Narapichas,
    // SnowLeopard, CorruptedMonk), rather than a hand-picked "final" Y.
    this._boss = new YetiKing(this, BOSS_SPAWN_X, FLOOR_Y - 150);
    this.physics.add.collider(this._boss, this._floor);
    this.physics.add.collider(this._player, this._boss);
    this.events.emit('waveStarted', TOTAL_WAVE_COUNT, TOTAL_WAVE_COUNT);   // shows the BOSS banner
    this.registry.set('checkpoint:Stage3Scene', { waveIndex: this._waveIndex, x: BOSS_TRIGGER_X - 200 });
    this.events.emit('checkpoint');
  }

  _onBossDefeated() {
    if (this._stageComplete) return;
    this._stageComplete = true;
    this.registry.remove('checkpoint:Stage3Scene');
    // The Yeti King is EverRise's final boss — fade out to the credits roll.
    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('CreditsScene');
      });
    });
  }

  _buildBackground() {
    const tilesNeeded = Math.ceil(LEVEL_WIDTH / BG_TILE_W) + 1;
    for (let i = 0; i < tilesNeeded; i++) {
      this.add.image(i * BG_TILE_W + BG_TILE_W / 2, GAME_HEIGHT / 2, 'stage3-bg')
        .setDisplaySize(BG_TILE_W, GAME_HEIGHT)
        .setDepth(0);
    }
  }

  _buildPlatforms() {
    // Tile the ice shelf so its deck (row 416) sits at the player's foot line:
    // image top = DECK_Y - PLAT_SURFACE. Tiles butt together with no gap.
    const numTiles = Math.ceil(LEVEL_WIDTH / PLAT_TILE_W) + 1;
    for (let i = 0; i < numTiles; i++) {
      this.add.image(i * PLAT_TILE_W + PLAT_TILE_W / 2, DECK_Y - PLAT_SURFACE, 'stage3-platform')
        .setOrigin(0.5, 0)
        .setScale(PLAT_SCALE)
        .setDepth(1);
    }

    // Solid invisible floor whose top edge sits exactly at FLOOR_Y.
    const FLOOR_THICKNESS = 500;   // thick so a fast landing can't tunnel through
    this._floor = this.physics.add.staticImage(0, 0, '__WHITE')
      .setOrigin(0, 0)
      .setDisplaySize(LEVEL_WIDTH, FLOOR_THICKNESS)
      .setPosition(0, FLOOR_Y)
      .setAlpha(0)
      .refreshBody();
  }
}
