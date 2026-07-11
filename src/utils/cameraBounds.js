// Clamp the main camera to the world/background bounds.
// Call once after scene create() to prevent the camera from
// showing empty space past the left/right edges of the background.
//
// bgWidth  — total width of the level in world pixels
// bgHeight — total height of the level in world pixels (use scene height for single-screen height)

export function setCameraBounds(scene, bgWidth, bgHeight) {
  scene.cameras.main.setBounds(0, 0, bgWidth, bgHeight);
}

// Follow the player with a forward lead: since the hero runs left→right, sit him
// at ~30% from the left edge so ~70% of the level ahead is visible (a negative
// follow-offset shifts the camera forward). A tight horizontal deadzone keeps him
// pinned there without micro-jitter; a taller vertical band avoids bob on jumps.
export function followPlayerAhead(scene, player) {
  const cam   = scene.cameras.main;
  const leadX = -Math.round(cam.width * 0.20);   // player rests at 30% from left
  cam.startFollow(player, true, 0.12, 0.1, leadX, 0);
  cam.setDeadzone(40, 150);
}
