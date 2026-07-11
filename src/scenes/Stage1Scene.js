import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Wolf from '../entities/enemies/Wolf.js';
import Snake from '../entities/enemies/Snake.js';
import Enemy from '../entities/Enemy.js';
import ForestWitch from '../entities/bosses/ForestWitch.js';
import Projectile from '../entities/Projectile.js';
import { STAGE1_WAVES, LEVEL_WIDTH, FLOOR_Y } from '../config/waves.js';
import { setCameraBounds, followPlayerAhead } from '../utils/cameraBounds.js';
import { setupPause } from '../systems/pause.js';
import SaveManager from '../systems/SaveManager.js';
import { runDialogue, say, storyTitle, itemReward } from '../systems/dialogue.js';
import { addEndCave } from '../systems/caves.js';
import { impactSparks } from '../systems/fx.js';
import Audio from '../systems/AudioManager.js';
import Yarsagumba from '../entities/pickups/Yarsagumba.js';

const GAME_HEIGHT    = 720;
const PLATFORM_IMG_W = 677;

// Background native 1774×887 → scaled to fill the 720px-tall view, then tiled at
// exactly that scaled width so consecutive copies butt together with no gap
// (same pattern as Stage2Scene/Stage3Scene).
const BG_SCALE       = GAME_HEIGHT / 887;
const BG_TILE_WIDTH  = 1774 * BG_SCALE;

const YARSA_KEY = 'yarsa:Stage1';   // registry flag: herb already eaten this run
const YARSA_X   = 3380;             // where it lies in the grass, before the witch

// ── Story (simple + clear, told across all three stages) ─────────────────────
// Ch. I: a corrupted wolf attacks the village. The hero and villagers beat it
// back; the elder then sends the hero to find the corruption's source in the
// Himalayas, and gives him a lucky pendant for the road.
const INTRO_LINES = [
  { speaker: 'ELDER', text: 'Guardian! A corrupted wolf has come down from the mountains — it is attacking our village!' },
  { speaker: 'THE GUARDIAN', text: 'Stay behind me, elder. Together with the villagers, we will drive it back.' },
];

const PENDANT_LINES = [
  { speaker: 'ELDER', text: 'The beast is beaten. But this corruption came from the Himalayas — you must find its source.' },
  { speaker: 'ELDER', text: 'Take this lucky pendant. May it keep you safe on the mountain path.' },
  { speaker: 'THE GUARDIAN', text: 'I will not fail you. For the village — for the mountains.' },
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

    // Expand physics world to match the full scrolling level.
    // Without this the player hits an invisible wall at x=1280 (the default game width).
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);

    this._buildBackground();
    this._buildPlatforms();   // sets this._floor

    this._player = new Player(this, 150, FLOOR_Y - 65);
    this._player.floorY = FLOOR_Y;
    this.physics.add.collider(this._player, this._floor);

    setCameraBounds(this, LEVEL_WIDTH, GAME_HEIGHT);
    followPlayerAhead(this, this._player);
    this.cameras.main.fadeIn(500, 0, 0, 0);   // smooth entry / stage-to-stage blend

    // Exit cave: the forest cave on the platform at the far end is the way onward
    // to Stage 2 — the hero walks into it once the witch falls. Seated so its
    // visible base beds into the platform (the PNG has ~32px of clear bottom
    // padding, so a modest float would read as "hanging in the air").
    const CAVE_Y = FLOOR_Y + 135;
    this._endCave = addEndCave(this, 'cave-stage1', 4820, CAVE_Y, {
      scale: 1.0,
      onEnter: () => this._enterEndCave(),
    });

    this._triggers = STAGE1_WAVES.map((wave) =>
      this.add.zone(wave.triggerX, GAME_HEIGHT / 2, 10, GAME_HEIGHT)
    );

    this.events.once('bossDefeated', this._onBossDefeated, this);

    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');

    setupPause(this);
    SaveManager.recordStageReached(1);

    // Yarsagumba (sacred herb): ALWAYS available. It waits in the grass from the
    // start of the stage — unless it's already been eaten this run, in which case
    // keep the max-HP bonus through a death instead of respawning it.
    if (this.registry.get(YARSA_KEY)) {
      this._player.increaseMaxHp(25, 0);
    } else {
      this._spawnYarsagumba();
    }

    // Opening story beat — chapter card, then the wolf-attack intro. Plays once
    // per playthrough (flag cleared on the menu) so a death-restart doesn't replay.
    if (!this.registry.get('introSeen:Stage1')) {
      this.registry.set('introSeen:Stage1', true);
      this._player.enterCutscene();
      storyTitle(this, 'CHAPTER I', 'The Village')
        .then(() => runDialogue(this, INTRO_LINES))
        .then(() => { if (this._player.active) this._player.exitCutscene(); });
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
    this._endCave?.update(this._player);
    // Pause pickups + wave triggers during a story beat (input locked) so a
    // dialogue's E-press can't eat the herb and no new wave spawns mid-cutscene.
    if (!this._player.inputLocked) {
      this._yarsa?.update(this._player);
      this._checkTriggers();
      this._checkTransientAdvance();
    }
    this._cullDeadEnemies();
  }

  _spawnYarsagumba() {
    // Fixed, guaranteed spot in the grass past the serpent groves and before the
    // witch — the player always walks over it on the way to the boss.
    this._yarsa = new Yarsagumba(this, YARSA_X, FLOOR_Y + 30, YARSA_KEY);
  }

  // ── The witch's magic shield: a curved wall of energy bowed toward the player ─
  _createShield(x) {
    this._shieldX     = x;
    this._shieldBulge = 80;   // how far the arc bows toward the player (left)

    const g = this.add.graphics().setDepth(9);
    const paint = (alpha) => {
      g.clear();
      g.lineStyle(30, 0x7a2bd8, 0.16 * alpha); this._shieldArc(g);   // outer glow
      g.lineStyle(14, 0x9a5cff, 0.40 * alpha); this._shieldArc(g);   // body
      g.lineStyle(4,  0xe4c6ff, 0.75 * alpha); this._shieldArc(g);   // bright core
    };
    paint(1);

    // Pulse the whole barrier by repainting at a breathing alpha.
    const pulse = { a: 1 };
    this._shieldTween = this.tweens.add({
      targets: pulse, a: 0.5, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut',
      onUpdate: () => paint(pulse.a),
    });

    // Motes drifting up the face of the curve.
    const motes = this.add.particles(x - this._shieldBulge * 0.4, GAME_HEIGHT / 2, 'spark', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-14, -GAME_HEIGHT / 2, 28, GAME_HEIGHT) },
      speedY: { min: -28, max: -8 }, lifespan: 1400, scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 }, tint: 0xc98aff, frequency: 80,
    }).setDepth(9);

    this._shieldFx = [g, motes];
  }

  // Stroke one quadratic arc from top to bottom, bowing left (toward the player)
  // by _shieldBulge at mid-height.
  _shieldArc(g) {
    const x = this._shieldX, H = GAME_HEIGHT, cpx = x - this._shieldBulge;
    g.beginPath();
    g.moveTo(x, 0);
    const N = 22;
    for (let i = 1; i <= N; i++) {
      const t = i / N, mt = 1 - t;
      const px = mt * mt * x + 2 * mt * t * cpx + t * t * x;
      const py = mt * mt * 0 + 2 * mt * t * (H / 2) + t * t * H;
      g.lineTo(px, py);
    }
    g.strokePath();
  }

  _destroyShield() {
    if (!this._shieldFx) return;
    const x = this._shieldX;
    for (let y = 120; y < GAME_HEIGHT; y += 130) impactSparks(this, x - this._shieldBulge * 0.5, y, 0xc98aff, 8);
    Audio.play('shieldBreak');
    this.cameras.main.flash(220, 160, 100, 255);
    this._shieldTween?.stop();
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

  // Static painted backdrop tiled across the level; it scrolls with the world at
  // the default scrollFactor so the hero reads as travelling through the scene.
  _buildBackground() {
    const tilesNeeded = Math.ceil(LEVEL_WIDTH / BG_TILE_WIDTH) + 1;
    for (let i = 0; i < tilesNeeded; i++) {
      this.add.image(i * BG_TILE_WIDTH + BG_TILE_WIDTH / 2, GAME_HEIGHT / 2, 'stage1-bg')
        .setDisplaySize(BG_TILE_WIDTH, GAME_HEIGHT)
        .setDepth(0);
    }
  }

  _buildPlatforms() {
    // The platform image (677×369) has its flat walkable surface at row ~96.
    // The player's body bottom rests at FLOOR_Y but his visible feet sit ~33px
    // lower; place the walkable surface at that foot line:
    //   image top = (FLOOR_Y + PLAYER_SINK) - SURFACE_OFFSET.
    const SURFACE_OFFSET = 96;
    const PLAYER_SINK    = 25;
    const platformTopY   = FLOOR_Y + PLAYER_SINK - SURFACE_OFFSET;
    const numTiles = Math.ceil(LEVEL_WIDTH / PLATFORM_IMG_W) + 1;
    for (let i = 0; i < numTiles; i++) {
      this.add.image(i * PLATFORM_IMG_W + PLATFORM_IMG_W / 2, platformTopY, 'stage1-platform')
        .setOrigin(0.5, 0).setDepth(1);
    }

    // Solid invisible floor: one continuous static body across the whole level.
    // Its TOP edge sits at FLOOR_Y so character feet (body bottoms) rest on the
    // visible surface. Thick so a fast landing can't tunnel through.
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
      let barrierX;
      if (waveDef.shield) {
        // Boss arena: the witch's shield seals the path IN FRONT of her. She
        // lurks safely behind it and sallies across the line to strike — the
        // player fights her on this side of the shield.
        barrierX = Math.min(...waveDef.enemies.map((e) => e.x)) - 240;
      } else {
        // Seal the arena PAST the rightmost enemy (not in front of them), so the
        // player can move among and BEHIND the enemies to flank — while still
        // being unable to leave until the wave is cleared.
        barrierX = Math.max(...waveDef.enemies.map((e) => e.x)) + 320;
      }
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
  spawnWitchProjectile(x, y, dir, speed) {
    const orb = new Projectile(this, x, y, dir, speed ? { speed } : {});
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

    // Story: the corrupted wolf is beaten — the elder sends the hero onward and
    // gives him the lucky pendant. Plays once per playthrough.
    if (cleared?.id === 'wave2' && !this.registry.get('pendantGiven:Stage1')) {
      this.registry.set('pendantGiven:Stage1', true);
      this._player.enterCutscene();
      runDialogue(this, PENDANT_LINES)
        .then(() => itemReward(this, {
          name: 'Lucky Pendant',
          desc: 'A charm from the elder — it steels your heart against the corruption.',
          color: 0xf4c542,
        }))
        .then(() => { if (this._player.active) this._player.exitCutscene(); });
    }
  }

  _onBossDefeated() {
    // The witch has fallen — the mountain cave beyond now beckons. Instead of an
    // instant cut, the player walks into the cave to travel onward.
    this.time.delayedCall(1400, () => {
      if (!this._player.active) return;
      this._endCave.arm();
      say(this, this._player, 'The forest is cleansed. Now — onward to the Himalayas.', 3600);
    });
  }

  _enterEndCave() {
    this.registry.remove(YARSA_KEY);   // fresh herb next playthrough
    // Flow straight into Stage 2 (no "Stage Complete" screen) so the journey from
    // the forest cave into the mountains reads as one continuous story beat.
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('UIScene');
      this.scene.start('Stage2Scene');
    });
  }
}
