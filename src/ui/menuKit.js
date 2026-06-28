import Phaser from 'phaser';
import Audio from '../systems/AudioManager.js';

// Shared look-and-feel + widgets for all menu screens, themed around a warm
// Himalayan / Nepali palette (gold, crimson, parchment on deep ink).

export const THEME = {
  gold:    '#f4c542',
  goldHex: 0xf4c542,
  crimson: '#dc2438',
  cream:   '#f3e7cb',
  dim:     '#cdb98f',
};

const SERIF = 'Georgia, "Times New Roman", serif';

export const titleStyle = {
  fontFamily: SERIF, fontSize: '76px', color: THEME.gold,
  fontStyle: 'bold', stroke: '#2a1606', strokeThickness: 10,
};
export const subtitleStyle = {
  fontFamily: SERIF, fontSize: '22px', color: THEME.cream,
  fontStyle: 'italic', stroke: '#000000', strokeThickness: 3,
};
export const itemStyle = {
  fontFamily: SERIF, fontSize: '32px', color: THEME.cream,
  stroke: '#000000', strokeThickness: 4,
};
export const bodyStyle = {
  fontFamily: SERIF, fontSize: '22px', color: THEME.cream,
  stroke: '#000000', strokeThickness: 3,
};
export const hintStyle = {
  fontFamily: SERIF, fontSize: '18px', color: '#cdb98f',
};

// Full-screen themed backdrop: stage art (if loaded) under a dark veil + a
// crimson banner strip, so every menu feels part of the same world.
export function addBackdrop(scene, { texture = 'stage1-bg' } = {}) {
  const { width: w, height: h } = scene.scale;
  if (scene.textures.exists(texture)) {
    scene.add.image(w / 2, h / 2, texture).setDisplaySize(w, h).setDepth(0).setTint(0x8090a0);
  } else {
    scene.add.rectangle(w / 2, h / 2, w, h, 0x12100c).setDepth(0);
  }
  scene.add.rectangle(w / 2, h / 2, w, h, 0x0a0703, 0.62).setDepth(1);
  // top + bottom crimson rule for a "framed" feel
  scene.add.rectangle(w / 2, 6, w, 4, 0x8a1a26).setDepth(1);
  scene.add.rectangle(w / 2, h - 6, w, 4, 0x8a1a26).setDepth(1);
}

// A keyboard- and mouse-navigable vertical list of options.
// items: [{ label, onSelect, enabled=true }]
// Returns a controller with destroy().
export function verticalMenu(scene, centerX, startY, items, { gap = 56 } = {}) {
  let index = items.findIndex((i) => i.enabled !== false);
  if (index < 0) index = 0;

  const rows = items.map((item, i) => {
    const enabled = item.enabled !== false;
    const t = scene.add.text(centerX, startY + i * gap, item.label, {
      ...itemStyle,
      color: enabled ? itemStyle.color : '#6d6453',
    }).setOrigin(0.5).setDepth(5);

    if (enabled) {
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { index = i; refresh(); });
      t.on('pointerdown', () => select());
    }
    return { t, enabled };
  });

  // Gold caret that marks the current row.
  const caret = scene.add.text(0, 0, '▶', { ...itemStyle, color: THEME.gold }).setOrigin(0.5).setDepth(5);

  function refresh() {
    rows.forEach((r, i) => {
      const on = i === index;
      r.t.setColor(!r.enabled ? '#6d6453' : on ? THEME.gold : THEME.cream);
      r.t.setScale(on ? 1.12 : 1);
    });
    const cur = rows[index];
    caret.setPosition(cur.t.x - cur.t.displayWidth / 2 - 28, cur.t.y).setVisible(true);
  }

  function move(dir) {
    const n = rows.length;
    for (let step = 0; step < n; step++) {
      index = (index + dir + n) % n;
      if (rows[index].enabled) break;
    }
    Audio.play('menuMove');
    refresh();
  }

  function select() {
    const item = items[index];
    if (item && item.enabled !== false) {
      Audio.play('menuSelect');
      scene.cameras.main.flash(120, 244, 197, 66);
      item.onSelect();
    }
  }

  const kb = scene.input.keyboard;
  const onUp = () => move(-1), onDown = () => move(1), onSel = () => select();
  kb.on('keydown-UP', onUp);   kb.on('keydown-W', onUp);
  kb.on('keydown-DOWN', onDown); kb.on('keydown-S', onDown);
  kb.on('keydown-ENTER', onSel); kb.on('keydown-SPACE', onSel);

  refresh();

  const ctrl = {
    destroy() {
      kb.off('keydown-UP', onUp);   kb.off('keydown-W', onUp);
      kb.off('keydown-DOWN', onDown); kb.off('keydown-S', onDown);
      kb.off('keydown-ENTER', onSel); kb.off('keydown-SPACE', onSel);
    },
  };
  scene.events.once('shutdown', ctrl.destroy);
  return ctrl;
}
