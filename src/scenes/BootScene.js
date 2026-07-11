import Phaser from 'phaser';
import { ANIM_CONFIG } from '../config/animations.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // ── Background & Platform ──────────────────────────────────────────────
    this.load.image('stage1-bg', 'assets/backgrounds/stage1/stage1_backgroundddd.png');
    this.load.image('stage1-platform', 'assets/platforms/stage1/stage1_platform.png');

    this.load.image('stage2-bg', 'assets/backgrounds/stage2/stage2_backgroundd.png');
    this.load.image('stage2-platform', 'assets/platforms/stage2/stage2_platformm.png');

    this.load.image('stage3-bg', 'assets/backgrounds/stage3/stage3_background.png');
    this.load.image('stage3-platform', 'assets/platforms/stage3/stage3_platform.png');

    // ── Cave entrances / exits (themed per biome) ───────────────────────────
    // -out = left-facing mouth (walk OUT of it, stage start); -in = right-facing
    // mouth (walk INTO it, stage end).
    this.load.image('cave-stage1',     'assets/cave/stage1/right_facing_cave_stage1.png');
    this.load.image('cave-stage2-in',  'assets/cave/stage2/right_facing_cave_stage2.png');
    this.load.image('cave-stage2-out', 'assets/cave/stage2/left_facing_cave_stage2.png');
    this.load.image('cave-stage3',     'assets/cave/stage3/right_facing_cave_stage3.png');

    // ── Main Character ─────────────────────────────────────────────────────────
    const FRAME = { frameWidth: 256, frameHeight: 256 };
    this.load.spritesheet('player-idle',   'assets/characters/main-character/idle.png',         FRAME);
    this.load.spritesheet('player-run',    'assets/characters/main-character/run.png',          FRAME);
    this.load.spritesheet('player-attack', 'assets/characters/main-character/basic-attack.png', FRAME);
    this.load.spritesheet('player-jump',   'assets/characters/main-character/jump.png',         FRAME);
    // Guleli (slingshot) ranged weapon + its stone projectile.
    this.load.spritesheet('player-guleli', 'assets/characters/main-character/gulle-gulle.png',   FRAME);
    this.load.spritesheet('stone', 'assets/characters/main-character/stone_projectile_spritesheet.png',
      { frameWidth: 64, frameHeight: 64 });

    // ── Corrupted Wolf ─────────────────────────────────────────────────────
    this.load.spritesheet('wolf-bite',   'assets/goons/corrupted-wolf/bite.png',   FRAME);
    this.load.spritesheet('wolf-pounce', 'assets/goons/corrupted-wolf/pounce.png', FRAME);
    this.load.spritesheet('wolf-death',  'assets/goons/corrupted-wolf/death.png',  FRAME);

    // ── Forest Witch ───────────────────────────────────────────────────────
    // Only a run sheet exists. Attack stand-in uses the same sheet (see animations.js).
    this.load.spritesheet('witch-run', 'assets/characters/forest-witch/run.png', FRAME);
    this.load.spritesheet('witch-rangeattack', 'assets/characters/forest-witch/rangeattack.png', FRAME);

    // ── Witch Projectile ───────────────────────────────────────────────────
    // 1408×128 → 11 frames of 128×128. Frames 0–5 float/travel, 6–10 impact.
    this.load.spritesheet('projectile', 'assets/characters/forest-witch/projectile.png',
      { frameWidth: 128, frameHeight: 128 });

    // ── Corrupted Monk (Stage 2 final boss) ─────────────────────────────────
    this.load.spritesheet('monk-idle',        'assets/characters/corrupted-monk/idle.png',         FRAME);
    this.load.spritesheet('monk-rangeattack',  'assets/characters/corrupted-monk/range-attack.png', FRAME);

    // ── Narapichas (Stage 2 goon) ────────────────────────────────────────────
    this.load.spritesheet('narapichas-run',    'assets/goons/narapichas/narapichasrun.png', FRAME);
    this.load.spritesheet('narapichas-attack', 'assets/goons/narapichas/narapichas.png',    FRAME);
    // Purple orb: 1408×128 → 11 frames of 128×128. Frames 0–6 travel, 8–10 impact.
    this.load.spritesheet('purple-projectile', 'assets/characters/corrupted-monk/purple_projectile_spritesheet.png',
      { frameWidth: 128, frameHeight: 128 });

    // ── Corrupted Snow Leopard (Stage 3 goon) ────────────────────────────────
    this.load.spritesheet('leopard-run',   'assets/goons/corrupted-snow-leopard/run.png',  FRAME);
    this.load.spritesheet('leopard-bite',  'assets/goons/corrupted-snow-leopard/bite.png', FRAME);

    // ── Yeti King (Stage 3 final boss) ───────────────────────────────────────
    // range-attack.png supplies both the idle (its calm opening frames) and
    // the ground-slam blizzard cast. normal-attack.png is the close-range
    // swing. run.png is the lumbering-approach animation.
    this.load.spritesheet('yeti-rangeattack', 'assets/characters/yeti/range-attack.png',  FRAME);
    this.load.spritesheet('yeti-attack',      'assets/characters/yeti/normal-attack.png', FRAME);
    this.load.spritesheet('yeti-run',         'assets/characters/yeti/run.png',           FRAME);

    this.load.on('progress', (v) => {
      // Future: show loading bar here
    });
  }

  create() {
    this._makeTextures();
    this._registerAnimations();

    // Default flow goes to the main menu. A URL param still deep-links a stage
    // for quick testing, e.g. ?stage=3 → Stage3Scene.
    const stage = new URLSearchParams(window.location.search).get('stage');
    const startScene = { '1': 'Stage1Scene', '2': 'Stage2Scene', '3': 'Stage3Scene' }[stage] || 'MainMenuScene';
    this.scene.start(startScene);
  }

  // Generate procedural textures (no art files): the particle dot + the snake.
  _makeTextures() {
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(6, 6, 6);
      g.generateTexture('spark', 12, 12);
      g.destroy();
    }
    if (!this.textures.exists('snake')) this._makeSnakeTexture();
    if (!this.textures.exists('yarsagumba')) this._makeYarsagumbaTexture();
  }

  // Yarsagumba — the sacred Himalayan caterpillar-fungus: an amber, segmented
  // caterpillar body lying on the ground with a slender dark fungal stalk
  // curving up out of its head.
  _makeYarsagumbaTexture() {
    const W = 56, H = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // fungal stalk: dark brown curve rising from the head (right side)
    g.lineStyle(4, 0x4a3320, 1);
    g.beginPath();
    g.moveTo(40, 50);
    g.lineTo(43, 36);
    g.lineTo(40, 22);
    g.lineTo(44, 10);
    g.strokePath();
    g.fillStyle(0x5a4128, 1); g.fillEllipse(44, 8, 8, 12);   // stalk tip (club)

    // caterpillar body: overlapping amber segments lying along the ground
    const segX = [10, 17, 24, 31, 38];
    g.fillStyle(0x7a4f22, 1);
    segX.forEach((x) => g.fillCircle(x, 54, 8));             // dark under-shadow
    g.fillStyle(0xc98a3c, 1);
    segX.forEach((x) => g.fillCircle(x, 52, 7));             // amber segments
    g.fillStyle(0x8a5a26, 0.9);
    segX.slice(0, 4).forEach((x) => g.fillCircle(x + 3.5, 52, 2.2)); // segment rings
    g.fillStyle(0xe8b76a, 0.8);
    segX.forEach((x) => g.fillCircle(x - 1, 49.5, 2.6));     // top highlight
    // head (right end, where the stalk grows out)
    g.fillStyle(0xa96a28, 1); g.fillCircle(42, 51, 6);
    g.fillStyle(0x2a1c0c, 1); g.fillCircle(44, 50, 1.6);     // eye dot

    g.generateTexture('yarsagumba', W, H);
    g.destroy();
  }

  // A realistic jungle pit-viper facing right: a thick, countershaded body coiled
  // in a natural S, tapering to a fine tail and a constricted neck, then a broad
  // wedge-shaped head with a heat-pit, amber slit-pupil eye and a flicking forked
  // tongue. Dark-olive dorsal / pale belly so it reads against the forest. Flip
  // for left. Texture dims kept (184×96) so Snake.js body tuning is unchanged.
  _makeSnakeTexture() {
    const W = 184, H = 96, midY = 60;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const segs = 150, x0 = 12, len = 122;   // leaves room at right for the head + tongue
    const px = (t) => x0 + len * t;

    // Serpentine spine: two humps that grow toward the head, which lifts up.
    const spineY = (t) =>
      midY + Math.sin(t * Math.PI * 2.2) * 12 * (0.4 + 0.6 * t) - Math.pow(t, 2.6) * 30;
    // Thickest through the mid-body, tapering to a thin tail (t→0) AND a pinched
    // neck (t→~0.9) so the broad head reads as separate — real snake silhouette.
    const bodyR = (t) => 2.4 + 10.5 * Math.pow(Math.sin(Math.min(t, 0.92) * Math.PI), 0.62);

    const band = (rFn, color, alpha = 1, dyFn = null) => {
      g.fillStyle(color, alpha);
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        g.fillCircle(px(t), spineY(t) + (dyFn ? dyFn(t) : 0), rFn(t));
      }
    };

    // Layered, countershaded body.
    band((t) => bodyR(t) + 2,    0x121c0b);                             // dark outline
    band((t) => bodyR(t),        0x5a7233);                             // olive base
    band((t) => bodyR(t) * 0.66, 0x39501e, 1, (t) => -bodyR(t) * 0.42); // dark dorsal (top)
    band((t) => bodyR(t) * 0.40, 0xa4b56e, 0.9, (t) => bodyR(t) * 0.52);// pale belly (bottom)

    // Dorsal saddle blotches — dark hourglass markings marching down the spine.
    for (let i = 9; i <= segs - 14; i += 12) {
      const t = i / segs, r = bodyR(t), cx = px(t), cy = spineY(t);
      g.fillStyle(0x223212, 0.95); g.fillEllipse(cx, cy - r * 0.32, r * 1.25, r * 0.78);
      g.fillStyle(0x0f180a, 0.5);  g.fillEllipse(cx, cy - r * 0.32, r * 1.25, r * 0.82); // dark edge hint
      g.fillStyle(0x223212, 1);    g.fillEllipse(cx, cy - r * 0.30, r * 1.0,  r * 0.62);
    }
    // Keeled-scale sheen — a fine highlight running along the upper back.
    g.fillStyle(0xcad98c, 0.45);
    for (let i = 5; i <= segs - 10; i += 4) {
      const t = i / segs;
      g.fillCircle(px(t), spineY(t) - bodyR(t) * 0.5, 0.9);
    }

    // ── Head: broad viper wedge, raised at the right ──────────────────────────
    const hx = px(1), hy = spineY(1);
    g.fillStyle(0x121c0b, 1); g.fillEllipse(hx + 7,  hy - 2, 42, 27);   // outline
    g.fillStyle(0x5a7233, 1); g.fillEllipse(hx + 6,  hy - 2, 36, 22);   // head base
    g.fillStyle(0x39501e, 1); g.fillEllipse(hx + 2,  hy - 7, 28, 11);   // dark crown
    g.fillStyle(0xa4b56e, 0.85); g.fillEllipse(hx + 10, hy + 6, 26, 8); // pale lip/jaw line
    // snout tip
    g.fillStyle(0x121c0b, 1); g.fillEllipse(hx + 21, hy - 1, 13, 12);
    g.fillStyle(0x5a7233, 1); g.fillEllipse(hx + 20, hy - 1, 9,  8);
    g.fillStyle(0x1a1206, 1); g.fillCircle(hx + 25, hy - 2, 1.1);       // nostril
    g.fillStyle(0x2a1c0a, 0.9); g.fillEllipse(hx + 16, hy + 1, 4, 2.4); // heat-pit
    // eye: amber with vertical slit pupil, brow ridge + catchlight
    g.fillStyle(0x223212, 1);  g.fillEllipse(hx + 9,  hy - 9, 10, 6);   // brow ridge
    g.fillStyle(0xd6a12b, 1);  g.fillEllipse(hx + 10, hy - 5, 7,  6);   // amber eye
    g.fillStyle(0x120c03, 1);  g.fillEllipse(hx + 11, hy - 5, 1.7, 5);  // slit pupil
    g.fillStyle(0xffeaa6, 0.9); g.fillCircle(hx + 8.2, hy - 6.6, 1);    // catchlight
    // flicking forked tongue
    g.lineStyle(2, 0xc0352a, 1);
    g.beginPath();
    g.moveTo(hx + 26, hy + 1); g.lineTo(hx + 38, hy - 3);   // stem
    g.moveTo(hx + 38, hy - 3); g.lineTo(hx + 46, hy - 7);   // upper fork
    g.moveTo(hx + 38, hy - 3); g.lineTo(hx + 46, hy + 1);   // lower fork
    g.strokePath();

    g.generateTexture('snake', W, H);
    g.destroy();
  }

  _registerAnimations() {
    const anims = this.anims;

    for (const [character, states] of Object.entries(ANIM_CONFIG)) {
      for (const [state, cfg] of Object.entries(states)) {
        const key = `${character}-${state}`;

        // Skip if already registered (hot-reload guard)
        if (anims.exists(key)) continue;

        anims.create({
          key,
          frames: cfg.frames.map((f) => ({ key: cfg.sheet, frame: f })),
          frameRate: cfg.frameRate,
          repeat: cfg.loop ? -1 : 0,
        });
      }
    }
  }
}
