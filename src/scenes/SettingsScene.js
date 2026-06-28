import Phaser from 'phaser';
import SaveManager from '../systems/SaveManager.js';
import { addBackdrop, titleStyle, itemStyle, bodyStyle, hintStyle, THEME } from '../ui/menuKit.js';

// Rows: volume sliders (apply once audio lands in a later milestone) + a live
// screen-shake toggle. ←/→ adjust, ↑/↓ move, Enter on Back returns.
export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create(data) {
    const { width: w, height: h } = this.scale;
    this._from = data?.from || 'MainMenuScene';
    this._gameplayKey = data?.gameplayKey;
    addBackdrop(this, { texture: 'stage2-bg' });
    this.add.text(w / 2, 96, 'SETTINGS', titleStyle).setOrigin(0.5).setDepth(5);

    const s = SaveManager.settings;
    this._rows = [
      { kind: 'slider', key: 'masterVolume', label: 'Master Volume' },
      { kind: 'slider', key: 'musicVolume',  label: 'Music Volume' },
      { kind: 'slider', key: 'sfxVolume',    label: 'SFX Volume' },
      { kind: 'toggle', key: 'screenShake',  label: 'Screen Shake' },
      { kind: 'back',   label: '‹ Back' },
    ];
    this._index = 0;

    const startY = 200, gap = 64, labelX = w / 2 - 250, valueX = w / 2 + 80;
    this._rows.forEach((row, i) => {
      row.labelText = this.add.text(labelX, startY + i * gap, row.label, itemStyle).setOrigin(0, 0.5).setDepth(5);
      if (row.kind !== 'back') {
        row.valueText = this.add.text(valueX, startY + i * gap, '', { ...itemStyle, color: THEME.gold })
          .setOrigin(0, 0.5).setDepth(5);
      }
      row.labelText.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this._index = i; this._refresh(); })
        .on('pointerdown', () => { this._index = i; this._activate(); });
    });

    this.add.text(w / 2, h - 56, '← →  adjust    ↑ ↓  move    Enter  select', hintStyle).setOrigin(0.5).setDepth(5);
    this.add.text(w / 2, h - 30, 'Audio sliders are saved and apply when sound is added', { ...hintStyle, fontSize: '15px' })
      .setOrigin(0.5).setDepth(5);

    const kb = this.input.keyboard;
    kb.on('keydown-UP',    () => this._moveSel(-1));
    kb.on('keydown-W',     () => this._moveSel(-1));
    kb.on('keydown-DOWN',  () => this._moveSel(1));
    kb.on('keydown-S',     () => this._moveSel(1));
    kb.on('keydown-LEFT',  () => this._adjust(-1));
    kb.on('keydown-A',     () => this._adjust(-1));
    kb.on('keydown-RIGHT', () => this._adjust(1));
    kb.on('keydown-D',     () => this._adjust(1));
    kb.on('keydown-ENTER', () => this._activate());
    kb.on('keydown-SPACE', () => this._activate());
    kb.on('keydown-ESC',   () => this._back());

    this._refresh();
  }

  _moveSel(dir) {
    this._index = (this._index + dir + this._rows.length) % this._rows.length;
    this._refresh();
  }

  _adjust(dir) {
    const row = this._rows[this._index];
    const s = SaveManager.settings;
    if (row.kind === 'slider') {
      const v = Phaser.Math.Clamp(Math.round((s[row.key] + dir * 0.1) * 10) / 10, 0, 1);
      SaveManager.setSetting(row.key, v);
    } else if (row.kind === 'toggle') {
      SaveManager.setSetting(row.key, !s[row.key]);
      if (row.key === 'screenShake' && s.screenShake) this.cameras.main.shake(120, 0.006);
    }
    this._refresh();
  }

  _activate() {
    const row = this._rows[this._index];
    if (row.kind === 'back') this._back();
    else if (row.kind === 'toggle') this._adjust(1);
  }

  _refresh() {
    const s = SaveManager.settings;
    this._rows.forEach((row, i) => {
      const sel = i === this._index;
      row.labelText.setColor(sel ? THEME.gold : THEME.cream).setScale(sel ? 1.08 : 1);
      if (row.kind === 'slider') {
        const filled = Math.round(s[row.key] * 10);
        row.valueText.setText('█'.repeat(filled) + '░'.repeat(10 - filled) + `  ${Math.round(s[row.key] * 100)}%`);
      } else if (row.kind === 'toggle') {
        row.valueText.setText(s[row.key] ? 'ON' : 'OFF').setColor(s[row.key] ? '#7CFC8A' : '#d98b8b');
      }
    });
  }

  _back() { this.scene.start(this._from, { gameplayKey: this._gameplayKey }); }
}
