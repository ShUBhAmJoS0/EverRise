import Phaser from 'phaser';
import { verticalMenu, titleStyle, hintStyle, THEME } from '../ui/menuKit.js';

// Overlay shown above a paused gameplay scene (the frozen frame stays visible).
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create(data) {
    const { width: w, height: h } = this.scale;
    this._gameplayKey = data?.gameplayKey || 'Stage1Scene';

    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setDepth(0);
    this.add.text(w / 2, 150, 'PAUSED', titleStyle).setOrigin(0.5).setDepth(5);

    verticalMenu(this, w / 2, 280, [
      { label: 'Resume',        onSelect: () => this._resume() },
      { label: 'Controls',      onSelect: () => this.scene.start('ControlsScene', { from: 'PauseScene', gameplayKey: this._gameplayKey }) },
      { label: 'Settings',      onSelect: () => this.scene.start('SettingsScene', { from: 'PauseScene', gameplayKey: this._gameplayKey }) },
      { label: 'Restart Stage', onSelect: () => this._restart() },
      { label: 'Quit to Menu',  onSelect: () => this._quit() },
    ]);

    this.add.text(w / 2, h - 40, 'Esc or Enter on Resume to continue', hintStyle).setOrigin(0.5).setDepth(5);
    this.input.keyboard.on('keydown-ESC', () => this._resume());
  }

  _resume() {
    this.scene.resume(this._gameplayKey);
    if (this.scene.get('UIScene')) this.scene.resume('UIScene');
    this.scene.stop();
  }

  _restart() {
    this.scene.stop('UIScene');
    this.scene.stop(this._gameplayKey);
    this.scene.stop();
    this.scene.start(this._gameplayKey);
  }

  _quit() {
    this.scene.stop('UIScene');
    this.scene.stop(this._gameplayKey);
    this.scene.stop();
    this.scene.start('MainMenuScene');
  }
}
