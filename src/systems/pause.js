// Wires Esc → pause for a gameplay scene. Pauses the scene + its HUD and lays
// the PauseScene over the frozen frame. Call once from a stage scene's create().
export function setupPause(scene) {
  // Hide the mouse cursor during gameplay (it's keyboard/mouse-button driven, no
  // pointer aiming). The pause/menu scenes bring it back; re-hide on resume.
  scene.input.setDefaultCursor('none');
  scene.events.on('resume', () => scene.input.setDefaultCursor('none'));

  scene.input.keyboard.on('keydown-ESC', () => {
    if (scene.scene.isPaused(scene.scene.key)) return;
    scene.scene.pause();
    if (scene.scene.isActive('UIScene')) scene.scene.pause('UIScene');
    scene.scene.launch('PauseScene', { gameplayKey: scene.scene.key });
    scene.scene.bringToTop('PauseScene');
  });
}
