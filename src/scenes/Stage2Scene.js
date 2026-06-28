import Phaser from 'phaser';
import Player from '../entities/Player.js';
import CorruptedMonk from '../entities/bosses/CorruptedMonk.js';
import Projectile from '../entities/Projectile.js';
import { setCameraBounds } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';

// ── Stage 2: Frozen Mountain Ruins ──────────────────────────────────────────
// For now this scene sets up the scrolling background and the stone-bridge
// platform with a walkable player. Enemies/waves come later.

const GAME_HEIGHT  = 720;
const LEVEL_WIDTH  = 5120;

// Walkable surface (world y) where character feet rest.
const FLOOR_Y      = 520;

// Background native 1774×887 → scaled to fill the 720px-tall view.
const BG_SCALE     = GAME_HEIGHT / 887;           // 0.812
const BG_TILE_W    = 1774 * BG_SCALE;             // ~1440

// Platform native 949×1024, walkable bridge deck at row ~367.
// The deck is opaque edge-to-edge, so tiles of exactly PLAT_TILE_W butt together
// seamlessly with no gap.
const PLAT_SCALE   = 0.65;
const PLAT_TILE_W  = 949 * PLAT_SCALE;            // ~617
const PLAT_SURFACE = 367 * PLAT_SCALE;            // ~239px from image top to deck

// The player's body bottom (collider rest) rests at FLOOR_Y; his visible feet
// (foot mass, not the sword tip) sit ~33px lower. Put the deck at that foot line.
const PLAYER_SINK  = 33;
const DECK_Y       = FLOOR_Y + PLAYER_SINK;

// World-x where the Corrupted Monk (final boss) appears.
const BOSS_TRIGGER_X = 3600;
const BOSS_SPAWN_X   = 4400;

export default class Stage2Scene extends Phaser.Scene {
  constructor() {
    super('Stage2Scene');
  }

  create() {
    this._boss        = null;
    this._bossSpawned = false;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    // Respawn at the bridge's end after dying to the boss (registry survives restart).
    const cp = this.registry.get('checkpoint:Stage2Scene');
    this._player = new Player(this, cp ? cp.x : 150, FLOOR_Y - 73);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this._player, true, 0.1, 0.05);
    this.cameras.main.setDeadzone(80, 120);

    this.events.once('bossDefeated', this._onBossDefeated, this);

    this.scene.launch('UIScene', { gameplayKey: 'Stage2Scene' });
    this.scene.bringToTop('UIScene');

    setupPause(this);
    SaveManager.recordStageReached(2);

    // F1 toggles the physics debug overlay (D is now "move right").
    this.input.keyboard.on('keydown-F1', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) this.physics.world.debugGraphic?.clear();
    });
  }

  update(time, delta) {
    if (!this._player.alive) return;
    this._player.update(delta, this._boss && this._boss.alive ? [this._boss] : []);

    // Spawn the final boss once the player reaches the end of the bridge.
    if (!this._bossSpawned && this._player.x >= BOSS_TRIGGER_X) {
      this._spawnBoss();
    }

    if (this._boss && this._boss.active) {
      this._boss.updateBehavior(this._player, delta);
    }
  }

  _spawnBoss() {
    this._bossSpawned = true;
    this._boss = new CorruptedMonk(this, BOSS_SPAWN_X, FLOOR_Y - 55);
    this.physics.add.collider(this._boss, this._floor);
    this.events.emit('waveStarted', 1, 1);   // shows the BOSS banner in the HUD
    this.registry.set('checkpoint:Stage2Scene', { x: BOSS_TRIGGER_X - 200 });
    this.events.emit('checkpoint');
  }

  // Called by CorruptedMonk when its cast reaches the release frame.
  spawnMonkProjectile(x, y, dir) {
    const orb = new Projectile(this, x, y, dir, {
      texture:    'purple-projectile',
      travelAnim: 'purple-travel',
      impactAnim: 'purple-impact',
      damage:     25,
      speed:      300,
    });
    this.physics.add.overlap(this._player, orb, () => orb.hit(this._player));
    return orb;
  }

  _onBossDefeated() {
    this.registry.remove('checkpoint:Stage2Scene');
    // Brief fade, then advance to Stage 3.
    this.time.delayedCall(1200, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('Stage3Scene');
      });
    });
  }

  _buildBackground() {
    const tilesNeeded = Math.ceil(LEVEL_WIDTH / BG_TILE_W) + 1;
    for (let i = 0; i < tilesNeeded; i++) {
      this.add.image(i * BG_TILE_W + BG_TILE_W / 2, GAME_HEIGHT / 2, 'stage2-bg')
        .setDisplaySize(BG_TILE_W, GAME_HEIGHT)
        .setDepth(0);
    }
  }

  _buildPlatforms() {
    // Tile the bridge so its deck (row 367) sits at the player's foot line (DECK_Y):
    // image top = DECK_Y - PLAT_SURFACE. Tiles butt together with no gap.
    const numTiles = Math.ceil(LEVEL_WIDTH / PLAT_TILE_W) + 1;
    for (let i = 0; i < numTiles; i++) {
      this.add.image(i * PLAT_TILE_W + PLAT_TILE_W / 2, DECK_Y - PLAT_SURFACE, 'stage2-platform')
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
