// Stage 1 wave definitions.
// All spawn positions are in world-space x/y (pixels from level origin).
// triggerX — player's world-x that activates the wave.
// enemies  — array of { type, x, y } spawn descriptors.
//
// Tune wolfCount and positions here during playtesting without touching entity code.

// Spawn y = each character's resting sprite-center so they appear already planted
// (matching the player's footing, feet ~47px below FLOOR_Y).
// Wolf rests at sprite.y = 500; Witch (scale 1.1) rests at sprite.y = 440.
export const STAGE1_WAVES = [
  {
    id: 'wave1',
    triggerX: 1000,
    enemies: [
      { type: 'wolf', x: 1300, y: 500 },
    ],
  },
  {
    id: 'wave2',
    triggerX: 2200,
    wolfCount: 3,
    enemies: [
      { type: 'wolf', x: 2500, y: 500 },
      { type: 'wolf', x: 2700, y: 500 },
      { type: 'wolf', x: 2900, y: 500 },
    ],
  },
  {
    // Sudden jungle ambush — snakes erupt from the grass around the player,
    // including one from behind. Non-blocking (transient): you can fight them or
    // push on toward the witch, where any stragglers slink away.
    id: 'snakes',
    triggerX: 3000,
    ambush: true,
    transient: true,
    enemies: [
      { type: 'snake', x: 3120, y: 522 },
      { type: 'snake', x: 3260, y: 522 },
      { type: 'snake', x: 2960, y: 522 },   // just behind the player
      { type: 'snake', x: 3340, y: 522 },
    ],
  },
  {
    // Boss: the witch seals the path with a visible magic shield (so the wave
    // barrier reads as HER doing, not an invisible wall). Breaks when she falls.
    id: 'wave3',
    triggerX: 3600,
    shield: true,
    enemies: [
      { type: 'witch', x: 4000, y: 440 },
    ],
  },
];

// Total level width (pixels). Camera clamps to this.
// Should match or slightly exceed the background repeat width.
export const LEVEL_WIDTH = 5120;

// Ground/floor y position in world space.
// Set so the platform's brown-soil section is clearly visible above the screen bottom.
export const FLOOR_Y = 490;
