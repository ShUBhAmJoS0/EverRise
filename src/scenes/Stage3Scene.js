import Phaser from 'phaser';
import Player from '../entities/Player.js';
import SnowLeopard from '../entities/enemies/SnowLeopard.js';
import YetiKing from '../entities/bosses/YetiKing.js';
import { STAGE3_WAVES } from '../config/waves3.js';
import { setCameraBounds, followPlayerAhead } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';
import { addStartCave, emergeFromCave } from '../systems/caves.js';
import { runDialogue, storyTitle } from '../systems/dialogue.js';
import Audio from '../systems/AudioManager.js';
import Yarsagumba from '../entities/pickups/Yarsagumba.js';
import { createPocket } from '../systems/pocket.js';

// ── Story (Ch. III) — Sagarmatha. The corrupted lake at its heart is the source
// of it all; the Yeti King guards the way. With the Heart of Sagarmatha, the hero
// can finally end the corruption.
const INTRO_LINES = [
  { speaker: 'THE GUARDIAN', text: 'Sagarmatha. At its heart lies the corrupted lake — the source of it all.' },
  { speaker: 'THE GUARDIAN', text: 'The Yeti King guards the way. With the Heart, I can end this. One last battle.' },
];

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
    this._waveIndex   = 0;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    this._player = new Player(this, 150, FLOOR_Y - 73);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    followPlayerAhead(this, this._player);
    this.cameras.main.fadeIn(500, 0, 0, 0);   // smooth blend in from Stage 2

    // The hero walks OUT of the glacier cave into the final frozen stage. Seated
    // low so the visible rock beds into the ice deck (~32px clear PNG padding
    // otherwise reads as "hanging in the air").
    const startCave = addStartCave(this, 'cave-stage3', 110, FLOOR_Y + 135, { scale: 1.0 });

    // Chapter intro on the first visit: title card, emerge, then the dialogue.
    if (!this.registry.get('introSeen:Stage3')) {
      this.registry.set('introSeen:Stage3', true);
      this._player.enterCutscene();
      storyTitle(this, 'CHAPTER III', 'Sagarmatha').then(() => {
        emergeFromCave(this, this._player, startCave, {
          onDone: () => runDialogue(this, INTRO_LINES)
            .then(() => { if (this._player.active) this._player.exitCutscene(); }),
        });
      });
    } else {
      emergeFromCave(this, this._player, startCave);
    }

    // Pocket HUD + Yarsagumba: none at the spawn — a single herb drops only after
    // the first wave is beaten.
    this._pocket = createPocket(this);
    this._yarsas = [];

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

    // _clampToFloor() is also wired into Enemy.preUpdate (runs for every
    // active enemy automatically), but that path depends on Phaser's Update
    // List timing/gating, which is hard to guarantee from outside the engine.
    // Calling it again here piggybacks on this loop, which we know fires
    // every frame for every active enemy (it's how their AI/movement already
    // works) — belt and suspenders against the floating bug recurring.
    this._enemies.forEach((e) => { if (e.active) { e.updateBehavior(this._player, delta); e._clampToFloor(); } });
    this._pocket.update(this._player);
    // Don't trigger waves / pick up herbs during a story beat or with the pocket open.
    if (!this._player.inputLocked && !this._pocket.open) {
      this._yarsas.forEach((y) => y.update(this._player));
      this._checkTriggers();
    }
    this._cullDeadEnemies();

    // Spawn the final boss once both Leopard waves are cleared and the player
    // reaches the far end of the glacier.
    if (!this._player.inputLocked && !this._pocket.open && !this._bossSpawned && this._waveIndex >= STAGE3_WAVES.length && this._player.x >= BOSS_TRIGGER_X) {
      this._spawnBoss();
    }

    if (this._boss && this._boss.active) {
      this._boss.updateBehavior(this._player, delta);
      this._boss._clampToFloor();
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
      case 'leopard': enemy = new SnowLeopard(this, x, y); break;
      default: console.warn(`Unknown enemy type: ${type}`); return null;
    }
    enemy.floorY = FLOOR_Y;
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
    const cleared = STAGE3_WAVES[this._waveIndex];
    this._enemies = [];
    this._waveActive = false;
    this._waveIndex++;
    this.events.emit('waveCleared', this._waveIndex);

    // A single Yarsagumba drops only after the first wave is cleared.
    if (cleared?.id === 'wave1') this._maybeSpawnYarsa('yarsa:Stage3:1', 2050);
  }

  // Spawn a Yarsagumba once (registry flag marks it taken so it doesn't respawn
  // on a death-restart once eaten/stored).
  _maybeSpawnYarsa(key, x) {
    if (this.registry.get(key)) return;
    this._yarsas.push(new Yarsagumba(this, x, FLOOR_Y + 33, key));
  }

  _spawnBoss() {
    this._bossSpawned = true;
    // Spawn a bit above the floor and let gravity settle him onto the floor
    // collider — same pattern as every other enemy in this stage (Narapichas,
    // SnowLeopard, CorruptedMonk), rather than a hand-picked "final" Y.
    this._boss = new YetiKing(this, BOSS_SPAWN_X, FLOOR_Y - 150);
    this._boss.floorY = FLOOR_Y;
    this.physics.add.collider(this._boss, this._floor);
    // No player↔boss collider: the player can slip behind the Yeti King to flank.
    this.events.emit('waveStarted', TOTAL_WAVE_COUNT, TOTAL_WAVE_COUNT);   // shows the BOSS banner
  }

  _onBossDefeated() {
    if (this._stageComplete) return;
    this._stageComplete = true;
    // Story finale: the hero returns the Heart of Sagarmatha to the corrupted
    // lake, cleansing the mountains — then the credits roll.
    this.time.delayedCall(1400, () => {
      if (!this._player.active) { this._toCredits(); return; }
      this._player.enterCutscene();
      runDialogue(this, [
        { speaker: 'THE GUARDIAN', text: 'It is over, great one. Rest now.' },
        { speaker: 'THE GUARDIAN', text: 'The Heart of Sagarmatha — returned to the lake. Let the mountains be cleansed.' },
      ]).then(() => this._purifyAndFinish());
    });
  }

  // The Heart falls into the corrupted lake and a wave of purifying light spreads
  // across the peak, lifting the corruption — the visual payoff of the whole story.
  _purifyAndFinish() {
    const px = this._player.x, py = FLOOR_Y + 40;
    const heart = this.add.rectangle(this._player.x, this._player.y - 30, 26, 26, 0x6fe0ff, 1)
      .setAngle(45).setDepth(50).setStrokeStyle(3, 0xffffff, 0.85);
    this.tweens.add({
      targets: heart, y: py, angle: 405, duration: 850, ease: 'Sine.in',
      onComplete: () => {
        heart.destroy();
        Audio.play('shieldBreak');
        this.cameras.main.flash(600, 200, 245, 255);
        for (let i = 0; i < 3; i++) {
          const ring = this.add.circle(px, py, 18, 0x9ff0ff, 0).setStrokeStyle(5, 0x9ff0ff, 0.9).setDepth(49);
          this.tweens.add({
            targets: ring, radius: 720, alpha: 0, duration: 1400, delay: i * 220, ease: 'Sine.out',
            onComplete: () => ring.destroy(),
          });
        }
        if (this.textures.exists('spark')) {
          const p = this.add.particles(px, py, 'spark', {
            speed: { min: 120, max: 430 }, angle: { min: 190, max: 350 }, lifespan: 1600,
            scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: 0xbff4ff, emitting: false,
          }).setDepth(49);
          p.explode(130);
          this.time.delayedCall(1800, () => p.destroy());
        }
        this.time.delayedCall(1700, () => this._toCredits());
      },
    });
  }

  _toCredits() {
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('UIScene');
      this.scene.start('CreditsScene');
    });
  }

  _buildBackground() {
    const tilesNeeded = Math.ceil(LEVEL_WIDTH / BG_TILE_W) + 1;
    for (let i = 0; i < tilesNeeded; i++) {
      // Mirror alternate copies so the repeat seam disappears (see Stage1Scene).
      this.add.image(i * BG_TILE_W + BG_TILE_W / 2, GAME_HEIGHT / 2, 'stage3-bg')
        .setDisplaySize(BG_TILE_W + 2, GAME_HEIGHT)
        .setFlipX(i % 2 === 1)
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
