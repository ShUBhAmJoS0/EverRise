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

  // A muted jungle snake (olive/dark-green with darker bands) facing right: a
  // mostly low, slithering body with a slightly raised head, amber eye and a
  // forked tongue. Tones picked to sit naturally against the forest. Flip for left.
  _makeSnakeTexture() {
    const W = 184, H = 96, midY = 60;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const segs = 96, x0 = 14, len = 142;
    // Low slither with a gentle rise into the head at the right.
    const pathY = (t) => midY + Math.sin(t * Math.PI * 2.3) * 11 * (1 - t * 0.45) - Math.pow(t, 2.6) * 26;
    const rad   = (t) => 2.5 + 9.5 * Math.pow(t, 0.8);   // smooth taper, thicker sooner
    const px    = (t) => x0 + len * t;
    const draw = (rFn, color, alpha = 1, dy = 0) => {
      g.fillStyle(color, alpha);
      for (let i = 0; i <= segs; i++) { const t = i / segs; g.fillCircle(px(t), pathY(t) + dy, rFn(t)); }
    };
    draw((t) => rad(t) + 1.6, 0x232d14);                       // dark outline
    draw((t) => rad(t),       0x5d6b32);                       // olive body
    draw((t) => rad(t) * 0.62, 0x46531f, 1, -1.5);             // darker dorsal (top) tone
    draw((t) => rad(t) * 0.42, 0x93a35c, 0.7, 2.5);            // pale ventral (belly) tone
    // dorsal diamond markings down the spine
    g.fillStyle(0x2c3a16, 0.95);
    for (let i = 6; i <= segs - 6; i += 8) {
      const t = i / segs;
      g.fillEllipse(px(t), pathY(t) - rad(t) * 0.35, rad(t) * 1.05, rad(t) * 0.6);
    }
    g.fillStyle(0xb9c37c, 0.5);
    for (let i = 10; i <= segs - 6; i += 8) {
      const t = i / segs;
      g.fillCircle(px(t), pathY(t) - rad(t) * 0.15, 1.3);      // scale glints
    }
    // Head: rounded skull flowing into a snout, brow ridge, slit eye, tongue
    const hx = px(1), hy = pathY(1);
    g.fillStyle(0x232d14, 1); g.fillEllipse(hx + 5, hy, 34, 22);
    g.fillStyle(0x5d6b32, 1); g.fillEllipse(hx + 4, hy, 29, 18);
    g.fillStyle(0x46531f, 1); g.fillEllipse(hx + 2, hy - 4, 24, 9);    // darker crown
    g.fillStyle(0x93a35c, 0.8); g.fillEllipse(hx + 8, hy + 6, 22, 6);  // pale jaw
    g.fillStyle(0x232d14, 1); g.fillEllipse(hx + 17, hy + 1, 10, 9);   // snout
    g.fillStyle(0x5d6b32, 1); g.fillEllipse(hx + 16, hy + 1, 7, 6);
    g.fillStyle(0xd8b23e, 1); g.fillEllipse(hx + 9, hy - 4, 6, 5);     // amber eye
    g.fillStyle(0x1a1206, 1); g.fillEllipse(hx + 10, hy - 4, 1.6, 4);  // vertical slit pupil
    g.lineStyle(2, 0xa83028, 1);                                       // forked tongue
    g.beginPath();
    g.moveTo(hx + 21, hy + 2); g.lineTo(hx + 36, hy - 2);
    g.moveTo(hx + 30, hy + 0.8); g.lineTo(hx + 36, hy + 5);
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
