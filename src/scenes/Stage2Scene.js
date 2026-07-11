import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Narapichas from '../entities/enemies/Narapichas.js';
import CorruptedMonk from '../entities/bosses/CorruptedMonk.js';
import Projectile from '../entities/Projectile.js';
import { STAGE2_WAVES } from '../config/waves2.js';
import { setCameraBounds, followPlayerAhead } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';
import { addStartCave, addEndCave, emergeFromCave } from '../systems/caves.js';
import { say, runDialogue, storyTitle, itemReward } from '../systems/dialogue.js';

// ── Story (Ch. II) — the hero reaches the Himalayas; the corruption is worse and
// even the mountain beasts have turned. The Corrupted Monk holds the Heart of
// Sagarmatha, the sacred relic that can cleanse the corruption at its source.
const INTRO_LINES = [
  { speaker: 'THE GUARDIAN', text: 'The Himalayas at last. The corruption is stronger here — even the mountain beasts have turned.' },
  { speaker: 'THE GUARDIAN', text: 'A monk has fallen to it, deep in these ruins. He may know where it all began.' },
];

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

// UIScene shows "BOSS FIGHT" when waveNum === total, so the boss counts as
// one extra "wave" beyond the Narapichas waves for banner numbering.
const TOTAL_WAVE_COUNT = STAGE2_WAVES.length + 1;

export default class Stage2Scene extends Phaser.Scene {
  constructor() {
    super('Stage2Scene');
  }

  create() {
    this._boss        = null;
    this._bossSpawned = false;

    this._enemies     = [];
    this._waveActive  = false;
    this._waveBarrier = null;
    this._waveIndex   = 0;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    this._player = new Player(this, 150, FLOOR_Y - 73);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    followPlayerAhead(this, this._player);
    this.cameras.main.fadeIn(500, 0, 0, 0);   // smooth blend in from Stage 1

    // Caves: the hero walks OUT of the mountain cave to open the stage, and the
    // exit cave on the platform at the far end leads onward to Stage 3. Seated so
    // the visible rock beds into the platform (~32px clear PNG padding otherwise
    // reads as "hanging in the air").
    const CAVE_Y = FLOOR_Y + 135;
    const startCave = addStartCave(this, 'cave-stage2-out', 110, CAVE_Y, { scale: 1.0 });
    this._endCave = addEndCave(this, 'cave-stage2-in', 4900, CAVE_Y, {
      scale: 1.0,
      onEnter: () => this._enterEndCave(),
    });

    // Chapter intro on the first visit: title card, hero walks out of the cave,
    // then the arrival dialogue. On a death-restart he just walks out.
    if (!this.registry.get('introSeen:Stage2')) {
      this.registry.set('introSeen:Stage2', true);
      this._player.enterCutscene();
      storyTitle(this, 'CHAPTER II', 'The Himalayas').then(() => {
        emergeFromCave(this, this._player, startCave, {
          onDone: () => runDialogue(this, INTRO_LINES)
            .then(() => { if (this._player.active) this._player.exitCutscene(); }),
        });
      });
    } else {
      emergeFromCave(this, this._player, startCave);
    }

    this._triggers = STAGE2_WAVES.map((wave) =>
      this.add.zone(wave.triggerX, GAME_HEIGHT / 2, 10, GAME_HEIGHT)
    );

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

    const liveEnemies = this._enemies.filter((e) => e.alive);
    const targets = this._boss && this._boss.alive ? [...liveEnemies, this._boss] : liveEnemies;
    this._player.update(delta, targets);

    this._enemies.forEach((e) => { if (e.active) e.updateBehavior(this._player, delta); });
    // Don't trigger new waves during a story beat (intro emergence / boss beat).
    if (!this._player.inputLocked) this._checkTriggers();
    this._cullDeadEnemies();

    // Spawn the final boss once the player reaches the end of the bridge.
    if (!this._player.inputLocked && !this._bossSpawned && this._player.x >= BOSS_TRIGGER_X) {
      this._spawnBoss();
    }

    if (this._boss && this._boss.active) {
      this._boss.updateBehavior(this._player, delta);
    }

    this._endCave?.update(this._player);
  }

  _checkTriggers() {
    if (this._waveActive || this._waveIndex >= STAGE2_WAVES.length) return;
    const trigger = this._triggers[this._waveIndex];
    if (!trigger?.active) return;
    if (this._player.x >= trigger.x) {
      trigger.destroy();
      this._activateWave(this._waveIndex);
    }
  }

  _activateWave(index) {
    this._waveActive = true;
    const waveDef    = STAGE2_WAVES[index];

    // Seal the arena PAST the rightmost enemy so the player can flank them.
    const rightmost = Math.max(...waveDef.enemies.map((e) => e.x));
    const barrierX = rightmost + 320;
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
      case 'narapichas': enemy = new Narapichas(this, x, y); break;
      default: console.warn(`Unknown enemy type: ${type}`); return null;
    }
    this.physics.add.collider(enemy, this._floor);
    // No player↔enemy collider: the player can pass THROUGH/behind enemies to
    // flank them (the wave barrier still seals the arena).
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
  }

  _spawnBoss() {
    this._bossSpawned = true;
    this._boss = new CorruptedMonk(this, BOSS_SPAWN_X, FLOOR_Y - 55);
    this.physics.add.collider(this._boss, this._floor);
    this.events.emit('waveStarted', TOTAL_WAVE_COUNT, TOTAL_WAVE_COUNT);   // shows the BOSS banner in the HUD
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
    // Story: the fallen monk drops the Heart of Sagarmatha — the relic that can
    // cleanse the corruption. The hero takes it and presses on to the frozen peak.
    this.time.delayedCall(1300, () => {
      if (!this._player.active) return;
      this._player.enterCutscene();
      runDialogue(this, [
        { speaker: 'CORRUPTED MONK', text: 'Forgive me... the Heart of Sagarmatha... it was meant to protect us all...' },
      ])
        .then(() => itemReward(this, {
          name: 'Heart of Sagarmatha',
          desc: 'A sacred relic. Its light may cleanse the corruption at its source.',
          color: 0x6fe0ff,
        }))
        .then(() => runDialogue(this, [
          { speaker: 'THE GUARDIAN', text: 'So this is the key. The frozen peak — and its master — lie beyond.' },
        ]))
        .then(() => {
          if (!this._player.active) return;
          this._player.exitCutscene();
          this._endCave.arm();
          say(this, this._player, 'The glacier awaits. Let this end.', 3600);
        });
    });
  }

  _enterEndCave() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('UIScene');
      this.scene.start('Stage3Scene');
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
