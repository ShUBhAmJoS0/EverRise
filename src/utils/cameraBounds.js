// Clamp the main camera to the world/background bounds.
// Call once after scene create() to prevent the camera from
// showing empty space past the left/right edges of the background.
//
// bgWidth  — total width of the level in world pixels
// bgHeight — total height of the level in world pixels (use scene height for single-screen height)

export function setCameraBounds(scene, bgWidth, bgHeight) {
  scene.cameras.main.setBounds(0, 0, bgWidth, bgHeight);
}
