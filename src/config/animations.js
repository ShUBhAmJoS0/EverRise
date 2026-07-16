// Animation configs for all Stage 1 characters.
//
// Frame indices are EXPLICIT arrays rather than start/end ranges because
// the AI-generated sprite sheets may have duplicate/out-of-order frames.
// Tune these arrays by watching the animation in-game, not by assuming
// 0–24 is correct.
//
// Each entry: { sheet, frames, frameRate, loop }
//   sheet     — Phaser texture key (must match BootScene.load calls)
//   frames    — ordered array of frame indices to use
//   frameRate — frames per second
//   loop      — whether the animation repeats

export const ANIM_CONFIG = {

  // ── Main Character ──────────────────────────────────────────────────────
  player: {
    idle: {
      sheet: 'player-idle',
      frames: [0, 1, 2, 3, 4],
      frameRate: 6,
      loop: true,
    },
    run: {
      sheet: 'player-run',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      frameRate: 14,
      loop: true,
    },
    attack: {
      sheet: 'player-attack',
      // Trimmed to the active swing: skip the slow ready-stance (0–3) and the
      // long follow-through (15+). Blade connects ~index 8 (orig frame 12).
      frames: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      frameRate: 26,
      loop: false,
    },
    // Single jump: a quick launch + rise. One-shot; the last frame holds in the
    // air until landing. (Was using the full sheet, which read like a flip.)
    jump: {
      sheet: 'player-jump',
      frames: [ 3, 4, 5, 6, 7],
      frameRate: 22,
      loop: false,
    },
    // Double (air) jump: the fuller, more dynamic mid-air frames for the 2nd jump.
    doublejump: {
      sheet: 'player-jump',
      frames: [8, 9, 10, 11, 12, 13, 14, 15, 16],
      frameRate: 22,
      loop: false,
    },
    // Guleli (slingshot). Split into a DRAW (windup — holds on its last frame
    // while the player charges by holding Right Ctrl) and a RELEASE (the throw +
    // follow-through, played when the key is let go or full charge is reached).
    'guleli-draw': {
      sheet: 'player-guleli',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      frameRate: 30,
      loop: false,
    },
    'guleli-release': {
      sheet: 'player-guleli',
      frames: [16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 22,
      loop: false,
    },
    // Block/guard stance: raises the khukuri into a guard and holds it. The sheet's
    // last frame (9) is a stray/mistaken pose, so it's excluded — the guard holds
    // on frame 8.
    block: {
      sheet: 'player-block',
      frames: [0, 1, 2, 3, 4, 5, 6],
      frameRate: 22,
      loop: false,
    },
  },

  // ── Budo Khate (village elder, Stage 1 Guleli gift cutscene) ────────────────
  // Full 25-frame walk cycle. Slow frameRate — he's old and leans on a cane.
  budo: {
    walk: {
      sheet: 'budo-walk',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 12,
      loop: true,
    },
  },

  // ── Guleli stone projectile ──────────────────────────────────────────────────
  // 704×64 → 11 frames of 64×64. Travel spins/flies (0–5 looped); impact bursts (6–10).
  stone: {
    travel: {
      sheet: 'stone',
      frames: [0, 1, 2, 3, 4, 5],
      frameRate: 16,
      loop: true,
    },
    impact: {
      sheet: 'stone',
      frames: [6, 7, 8, 9, 10],
      frameRate: 18,
      loop: false,
    },
  },

  // ── Corrupted Wolf ───────────────────────────────────────────────────────
  // run    → grounded approach (bite sheet looped — paws stay on the ground)
  // pounce → leap at player (pounce sheet one-shot — airborne by design)
  // bite   → damage chomp after landing (bite sheet one-shot)
  wolf: {
    run: {
      sheet: 'wolf-bite',
      frames: [0, 1, 2, 3, 4, 5],
      frameRate: 10,
      loop: true,
    },
    pounce: {
      sheet: 'wolf-pounce',
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameRate: 14,
      loop: false,
    },
    bite: {
      sheet: 'wolf-bite',
      frames: [0, 1, 2, 3, 4, 5],
      frameRate: 10,
      loop: false,
    },
    death: {
      sheet: 'wolf-death',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      frameRate: 10,
      loop: false,
    },
  },

  // ── Forest Witch (Stage 1 Boss) ──────────────────────────────────────────
  // NOTE: Only a "run" sheet exists. No idle or attack animation supplied.
  // "run" is used for both movement and as a stand-in for the attack.
  // Replace the "attack" entry with a dedicated cast/attack sheet when available.
  witch: {
    run: {
      sheet: 'witch-run',
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      frameRate: 10,
      loop: true,
    },
    // Idle: the first four frames of the range-attack sheet (witch holding the orb).
    idle: {
      sheet: 'witch-rangeattack',
      frames: [0, 1, 2, 3],
      frameRate: 6,
      loop: true,
    },
    // Ranged cast: full 25-frame sheet. Projectile is released on frame 18
    // (index 17) — handled in ForestWitch via the animationupdate event.
    rangeattack: {
      sheet: 'witch-rangeattack',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 18,
      loop: false,
    },
  },

  // ── Witch Projectile ───────────────────────────────────────────────────────
  // travel → floating orb while flying (frames 0–5, looped)
  // impact → burst when it hits the player (frames 6–10, one-shot)
  projectile: {
    travel: {
      sheet: 'projectile',
      frames: [0, 1, 2, 3, 4, 5],
      frameRate: 12,
      loop: true,
    },
    impact: {
      sheet: 'projectile',
      frames: [6, 7, 8, 9, 10],
      frameRate: 15,
      loop: false,
    },
  },

  // ── Corrupted Monk (Stage 2 final boss) ─────────────────────────────────────
  monk: {
    // Idle: first four frames of the idle sheet.
    idle: {
      sheet: 'monk-idle',
      frames: [0, 1, 2, 3],
      frameRate: 6,
      loop: true,
    },
    // Ranged cast: full 25-frame sheet. The purple orb is released on frame 13
    // (handled in CorruptedMonk via the animationupdate event).
    rangeattack: {
      sheet: 'monk-rangeattack',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 18,
      loop: false,
    },
  },

  // ── Narapichas (Stage 2 goon) ─────────────────────────────────────────────
  // run    → polearm-in-hand sprint (full 25-frame sheet)
  // attack → thrust/swing sheet: rows 1-2 (0-9) are the windup/ready stance,
  //          rows 3-5 (10-24) are the actual axe/spear swing — trimmed to that.
  narapichas: {
    run: {
      sheet: 'narapichas-run',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 16,
      loop: true,
    },
    attack: {
      sheet: 'narapichas-attack',
      frames: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      frameRate: 24,
      loop: false,
    },
  },

  // ── Corrupted Snow Leopard (Stage 3 goon) ───────────────────────────────────
  // run  → frames 5-24 only: a consistent crouched-sprint cycle with real
  //        stride variation. Frames 0-4 are an almost-static standing pose —
  //        including them caused a visible "pop" every loop, so they're cut.
  // bite → frames 0-9 only: a clean snarl-and-chomp. Frames 10-24 have a
  //        doubled/ghosted render artifact from the sheet generation — skipped.
  leopard: {
    run: {
      sheet: 'leopard-run',
      frames: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 20,
      loop: true,
    },
    bite: {
      sheet: 'leopard-bite',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      frameRate: 26,
      loop: false,
    },
  },

  // ── Yeti King (Stage 3 final boss) ──────────────────────────────────────────
  // idle        → full 25-frame dedicated idle.png loop (calm staff-planted
  //               stance with subtle sway/breathing between frames).
  // run         → full 25-frame lumbering-approach cycle.
  // rangeattack → full 25-frame ground-slam. The frost burst first appears at
  //               frame 5, which is where the blizzard triggers (see YetiKing.js).
  // attack      → normal-attack.png, trimmed to the active swing (same reason
  //               as the player's attack above): sheet frames 0-4 are a
  //               ready-stance that barely differs from idle, and 23-24 repeat
  //               the settled hold, so both ends are dropped. What's left:
  //               windup(5-7) → flourish cleave away from the target(8-11) →
  //               mace comes overhead(12-17) → finishing blow whips out, mace
  //               fully extended with the head glowing(18-19) → follow-through
  //               settle(20-22). The mace CONNECTS on sheet frame 19; see
  //               YETI_MELEE_HIT_FRAME in YetiKing.js, which is that frame's
  //               1-based position in this array and must stay in sync with it.
  yeti: {
    idle: {
      sheet: 'yeti-idle',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 6,
      loop: true,
    },
    run: {
      sheet: 'yeti-run',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 20,
      loop: true,
    },
    rangeattack: {
      sheet: 'yeti-rangeattack',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      frameRate: 19,
      loop: false,
    },
    attack: {
      sheet: 'yeti-attack',
      frames: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      frameRate: 30,
      loop: false,
    },
  },

  // ── Purple Projectile (Monk's orb) ──────────────────────────────────────────
  // travel → 7 frames (0–6) looped; impact → frames 8,9,10 one-shot.
  purple: {
    travel: {
      sheet: 'purple-projectile',
      frames: [0, 1, 2, 3, 4, 5, 6],
      frameRate: 14,
      loop: true,
    },
    impact: {
      sheet: 'purple-projectile',
      frames: [8, 9, 10],
      frameRate: 14,
      loop: false,
    },
  },
};
