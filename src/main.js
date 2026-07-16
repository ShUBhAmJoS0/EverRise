import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import ControlsScene from './scenes/ControlsScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import CreditsScene from './scenes/CreditsScene.js';
import PauseScene from './scenes/PauseScene.js';
import Stage1Scene from './scenes/Stage1Scene.js';
import Stage2Scene from './scenes/Stage2Scene.js';
import Stage3Scene from './scenes/Stage3Scene.js';
import UIScene from './scenes/UIScene.js';
import StageCompleteScene from './scenes/StageCompleteScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  // Responsive: keep the 16:9 design resolution but scale to fit any window,
  // letterboxing as needed and centering. The game logic still runs at 1280×720.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  render: {
    pixelArt: false,
    antialias: true,
    // roundPixels OFF: with a smooth (eased) camera, snapping positions to whole
    // pixels made crisp-edged props (e.g. caves) visibly jitter and the scrolling
    // background shimmer. Sub-pixel rendering keeps the motion fluid for this
    // painted (non-pixel-art) look.
    roundPixels: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    MainMenuScene, LevelSelectScene, ControlsScene, SettingsScene, CreditsScene,
    Stage1Scene, Stage2Scene, Stage3Scene, UIScene, PauseScene, StageCompleteScene,
  ],
};

const game = new Phaser.Game(config);

// Expose the instance for dev tooling / automated smoke tests (harmless in prod).
// import.meta.env is a Vite-only feature — it's simply absent when the game is
// served directly by a plain static server (e.g. VS Code Live Server), which
// this project explicitly supports via index.html's import map. Fall back to
// always exposing it in that case rather than silently skipping.
if (import.meta.env?.DEV ?? true) window.__EVERRISE__ = game;
