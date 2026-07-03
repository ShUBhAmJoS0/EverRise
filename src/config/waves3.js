// Stage 3 wave definitions — mirrors Stage 1/2's wave structure:
// wave 1 is a single enemy, wave 2 is a group of three.
// triggerX — player's world-x that activates the wave.
// enemies  — array of { type, x, y } spawn descriptors.

// Snow Leopard body bottom = center+18 (paw row 179, shortened 33px to match
// Stage3's floor-to-deck sink) → spawn at FLOOR_Y-18 so they land already
// planted on the visible ice.
export const STAGE3_WAVES = [
  {
    id: 'wave1',
    triggerX: 1500,
    enemies: [
      { type: 'leopard', x: 1800, y: 502 },
    ],
  },
  {
    id: 'wave2',
    triggerX: 2600,
    enemies: [
      { type: 'leopard', x: 2900, y: 502 },
      { type: 'leopard', x: 3050, y: 502 },
      { type: 'leopard', x: 3200, y: 502 },
    ],
  },
];
