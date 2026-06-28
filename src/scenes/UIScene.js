// HUD overlay — runs in parallel with Stage1Scene via scene.launch().
// Listens to Stage1Scene events to update health/wave display.
import Phaser from 'phaser';

const BAR_X      = 30;
const BAR_Y      = 30;
const BAR_W      = 200;
const BAR_H      = 20;
const BAR_BORDER = 2;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create(data) {
    // Listen to whichever gameplay scene launched us (Stage1Scene by default).
    this._stage1 = this.scene.get(data?.gameplayKey || 'Stage1Scene');

    // ── Player health bar ─────────────────────────────────────────────────
    this.add.rectangle(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, BAR_W + BAR_BORDER * 2, BAR_H + BAR_BORDER * 2, 0x222222)
      .setScrollFactor(0).setDepth(10);

    this._hpBarBg = this.add.rectangle(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, BAR_W, BAR_H, 0x550000)
      .setScrollFactor(0).setDepth(11);

    this._hpBar = this.add.rectangle(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, BAR_W, BAR_H, 0xee3333)
      .setScrollFactor(0).setDepth(12);

    this.add.text(BAR_X, BAR_Y - 18, 'HP', { fontSize: '14px', fill: '#ffffff', fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(12);

    // ── Wave indicator ────────────────────────────────────────────────────
    this._waveText = this.add.text(this.scale.width / 2, 30, '', {
      fontSize: '22px',
      fill: '#ffdd44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(12).setAlpha(0);

    // ── Event listeners ───────────────────────────────────────────────────
    // ── Boss health bar (bottom-center, hidden until a boss spawns) ───────────
    const bw = 520, bh = 16, bx = this.scale.width / 2, by = this.scale.height - 48;
    this._bossName = this.add.text(bx, by - 22, '', {
      fontSize: '18px', fill: '#ffccbb', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(12).setVisible(false);
    this._bossBarBorder = this.add.rectangle(bx, by, bw + 4, bh + 4, 0x222222)
      .setScrollFactor(0).setDepth(10).setVisible(false);
    this._bossBarBg = this.add.rectangle(bx, by, bw, bh, 0x3a1020)
      .setScrollFactor(0).setDepth(11).setVisible(false);
    this._bossBar = this.add.rectangle(bx, by, bw, bh, 0xc02040)
      .setScrollFactor(0).setDepth(12).setVisible(false);
    this._bossBarW = bw;
    this._bossBarX = bx;

    // ── Checkpoint toast ───────────────────────────────────────────────────────
    this._checkpointText = this.add.text(this.scale.width / 2, 74, '✓ Checkpoint', {
      fontSize: '17px', fill: '#9fe6a0', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(12).setAlpha(0);

    this._stage1.events.on('playerHealthChanged', this._updateHealthBar, this);
    this._stage1.events.on('waveStarted', this._showWaveLabel, this);
    this._stage1.events.on('waveCleared', this._onWaveCleared, this);
    this._stage1.events.on('ambush', this._showAmbush, this);
    this._stage1.events.on('bossSpawned', this._showBossBar, this);
    this._stage1.events.on('bossHealthChanged', this._updateBossBar, this);
    this._stage1.events.on('checkpoint', this._showCheckpoint, this);

    // Seed the bar from the live player so it's correct on the very first frame.
    const p = this._stage1?._player;
    if (p) this._updateHealthBar(p.hp, p.maxHp);

    this.events.on('shutdown', this._cleanup, this);
  }

  _updateHealthBar(hp, maxHp) {
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this._hpBar.setDisplaySize(BAR_W * frac, BAR_H);
    // Re-anchor left edge so it shrinks from the right.
    this._hpBar.x = BAR_X + (BAR_W * frac) / 2;
  }

  _showWaveLabel(waveNum, total) {
    const isBoss = waveNum === total;
    const label  = isBoss ? '⚡ BOSS FIGHT ⚡' : `Wave ${waveNum} / ${total}`;
    this._waveText.setText(label).setColor('#ffdd44').setScale(1).setAlpha(1);

    // Fade out after 2.5 s.
    this.tweens.add({
      targets: this._waveText,
      alpha: 0,
      delay: 2500,
      duration: 800,
    });
  }

  _onWaveCleared(nextWaveIndex) {
    // Nothing extra needed for now — wave label fades on its own.
  }

  _showBossBar(name, hp, maxHp) {
    this._bossName.setText(name).setVisible(true);
    [this._bossBarBorder, this._bossBarBg, this._bossBar].forEach((r) => r.setVisible(true));
    this._updateBossBar(hp, maxHp);
  }

  _updateBossBar(hp, maxHp) {
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this._bossBar.setDisplaySize(Math.max(1, this._bossBarW * frac), 16);
    this._bossBar.x = this._bossBarX - this._bossBarW / 2 + (this._bossBarW * frac) / 2;
    if (frac <= 0) {
      // Boss down — fade the bar away.
      this.tweens.add({
        targets: [this._bossName, this._bossBarBorder, this._bossBarBg, this._bossBar],
        alpha: 0, delay: 400, duration: 700,
        onComplete: () => [this._bossName, this._bossBarBorder, this._bossBarBg, this._bossBar]
          .forEach((r) => r.setVisible(false).setAlpha(1)),
      });
    }
  }

  _showCheckpoint() {
    this._checkpointText.setAlpha(1).setScale(1.15);
    this.tweens.add({ targets: this._checkpointText, scale: 1, duration: 200 });
    this.tweens.add({ targets: this._checkpointText, alpha: 0, delay: 1300, duration: 500 });
  }

  // Sudden red flash for a snake ambush (no calm "Wave X" banner).
  _showAmbush() {
    this._waveText.setText('⚠ SNAKES! ⚠')
      .setColor('#ff5544').setScale(1.4).setAlpha(1);
    this.tweens.add({ targets: this._waveText, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this._waveText, alpha: 0, delay: 1400, duration: 600 });
    // quick red vignette flash on the gameplay camera
    this._stage1.cameras.main.flash(180, 120, 0, 0);
  }

  _cleanup() {
    if (this._stage1?.events) {
      this._stage1.events.off('playerHealthChanged', this._updateHealthBar, this);
      this._stage1.events.off('waveStarted', this._showWaveLabel, this);
      this._stage1.events.off('waveCleared', this._onWaveCleared, this);
      this._stage1.events.off('ambush', this._showAmbush, this);
      this._stage1.events.off('bossSpawned', this._showBossBar, this);
      this._stage1.events.off('bossHealthChanged', this._updateBossBar, this);
      this._stage1.events.off('checkpoint', this._showCheckpoint, this);
    }
  }
}
