import Phaser from 'phaser';
import Player from '../entities/Player.js';
import { setCameraBounds } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';

// ── Stage 3: Frozen Glacier ──────────────────────────────────────────────────
// Scrolling icy background + seamless ice-shelf platform with a walkable player.
// Enemies/boss come later.

const GAME_HEIGHT  = 720;
const LEVEL_WIDTH  = 5120;

// Walkable surface (world y) where character feet rest.
const FLOOR_Y      = 520;

// Background native 1408×768 → scaled to fill the 720px-tall view.
const BG_SCALE     = GAME_HEIGHT / 768;           // 0.9375
const BG_TILE_W    = 1408 * BG_SCALE;             // ~1320

// Platform native 1408×768, walkable ice deck at row ~296.
// Deck is opaque edge-to-edge, so tiles of exactly PLAT_TILE_W butt seamlessly.
const PLAT_SCALE   = 0.9;
const PLAT_TILE_W  = 1408 * PLAT_SCALE;           // ~1267
const PLAT_SURFACE = 296 * PLAT_SCALE;            // ~266px from image top to deck

// Player feet rest ~33px below FLOOR_Y; place the deck at that foot line.
const PLAYER_SINK  = 33;
const DECK_Y       = FLOOR_Y + PLAYER_SINK;

export default class Stage3Scene extends Phaser.Scene {
  constructor() {
    super('Stage3Scene');
  }

  create() {
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    this._player = new Player(this, 150, FLOOR_Y - 73);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this._player, true, 0.1, 0.05);
    this.cameras.main.setDeadzone(80, 120);

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
    this._player.update(delta, []);
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
    // Tile the ice shelf so its deck (row 296) sits at the player's foot line:
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
