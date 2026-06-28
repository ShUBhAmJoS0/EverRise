import Phaser from 'phaser';
import SaveManager from '../systems/SaveManager.js';
import { addBackdrop, verticalMenu, titleStyle, subtitleStyle, hintStyle } from '../ui/menuKit.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const { width: w, height: h } = this.scale;
    addBackdrop(this, { texture: 'stage1-bg' });

    // ── Title ──────────────────────────────────────────────────────────────────
    const title = this.add.text(w / 2, 130, 'EVERRISE', titleStyle).setOrigin(0.5).setDepth(5);
    this.add.text(w / 2, 188, 'A Himalayan Ascension', subtitleStyle).setOrigin(0.5).setDepth(5);
    // gentle breathing glow on the title
    this.tweens.add({ targets: title, scale: 1.03, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.inOut' });

    const canContinue = SaveManager.hasProgress();

    verticalMenu(this, w / 2, 290, [
      { label: 'Start Game', onSelect: () => this._startNew() },
      { label: canContinue ? 'Continue' : 'Continue (no save)', enabled: canContinue, onSelect: () => this._continue() },
      { label: 'Level Select', onSelect: () => this.scene.start('LevelSelectScene') },
      { label: 'Controls',     onSelect: () => this.scene.start('ControlsScene', { from: 'MainMenuScene' }) },
      { label: 'Settings',     onSelect: () => this.scene.start('SettingsScene', { from: 'MainMenuScene' }) },
      { label: 'Credits',      onSelect: () => this.scene.start('CreditsScene') },
    ]);

    this.add.text(w / 2, h - 34, '↑ ↓ / W S to choose   •   Enter to select', hintStyle)
      .setOrigin(0.5).setDepth(5);
  }

  _startNew() {
    // Fresh run: drop any mid-stage checkpoints/pickups from a previous attempt.
    this.registry.remove('checkpoint:Stage1Scene');
    this.registry.remove('checkpoint:Stage2Scene');
    this.registry.remove('yarsa:Stage1');
    SaveManager.recordStageReached(1);
    this._launchStage('Stage1Scene');
  }

  _continue() {
    const stage = SaveManager.progress.stageReached;
    this._launchStage({ 1: 'Stage1Scene', 2: 'Stage2Scene', 3: 'Stage3Scene' }[stage] || 'Stage1Scene');
  }

  _launchStage(key) {
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
  }
}
