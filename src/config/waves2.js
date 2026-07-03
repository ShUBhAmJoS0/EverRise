// Stage 2 wave definitions — mirrors Stage 1's wave structure:
// wave 1 is a single enemy, wave 2 is a group of three.
// triggerX — player's world-x that activates the wave.
// enemies  — array of { type, x, y } spawn descriptors.

// Narapichas body bottom = center+46 (matches CorruptedMonk's tuning) →
// spawn at FLOOR_Y-46 so they land already planted on the bridge deck.
export const STAGE2_WAVES = [
  {
    id: 'wave1',
    triggerX: 1500,
    enemies: [
      { type: 'narapichas', x: 1800, y: 474 },
    ],
  },
  {
    id: 'wave2',
    triggerX: 2400,
    enemies: [
      { type: 'narapichas', x: 2750, y: 474 },
      { type: 'narapichas', x: 2900, y: 474 },
      { type: 'narapichas', x: 3050, y: 474 },
    ],
  },
];
