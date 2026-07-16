import Phaser from 'phaser';
import SaveManager from '../systems/SaveManager.js';
import { addBackdrop, verticalMenu, titleStyle, subtitleStyle, hintStyle } from '../ui/menuKit.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    this.input.setDefaultCursor('default');   // cursor visible in menus
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
    // Fresh run: drop pickups and every story flag from a previous attempt so the
    // whole story (chapter cards, intros, the pendant beat) plays again.
    [
      'yarsa:Stage1', 'yarsa:Stage2:1', 'yarsa:Stage2:2',
      'yarsa:Stage3:0', 'yarsa:Stage3:1', 'yarsa:Stage3:2',
      'pendantGiven:Stage1', 'hpBonus', 'yarsaPocket', 'guleliUnlocked',
      'introSeen:Stage1', 'introSeen:Stage2', 'introSeen:Stage3',
    ].forEach((k) => this.registry.remove(k));
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
