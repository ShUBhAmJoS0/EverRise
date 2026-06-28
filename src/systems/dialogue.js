import Phaser from 'phaser';
import Audio from './AudioManager.js';

// Story presentation, two flavors:
//   runDialogue(scene, lines)      — blocking letterbox panel with typewriter
//                                    text; E / Enter advances. Returns a Promise.
//   say(scene, target, text, ms)   — non-blocking speech line floating above a
//                                    sprite (combat one-liners); follows it.

const PANEL_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '21px',
  color: '#f3e7cb',
  stroke: '#000000',
  strokeThickness: 2,
};

export function runDialogue(scene, lines, { speaker = 'THE GUARDIAN' } = {}) {
  return new Promise((resolve) => {
    const W = scene.scale.width, H = scene.scale.height;
    const panelW = W - 220, panelX = W / 2, panelY = H - 92;
    const objs = [];

    const veil = scene.add.rectangle(panelX, panelY, panelW, 128, 0x0a0703, 0.85)
      .setScrollFactor(0).setDepth(60).setStrokeStyle(2, 0xf4c542, 0.75);
    const name = scene.add.text(panelX - panelW / 2 + 20, panelY - 52, speaker, {
      ...PANEL_STYLE, fontSize: '15px', color: '#f4c542', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(61);
    const txt = scene.add.text(panelX - panelW / 2 + 20, panelY - 28, '', {
      ...PANEL_STYLE, wordWrap: { width: panelW - 40 },
    }).setScrollFactor(0).setDepth(61);
    const hint = scene.add.text(panelX + panelW / 2 - 16, panelY + 44, 'E ▸', {
      ...PANEL_STYLE, fontSize: '15px', color: '#cdb98f',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(61);
    objs.push(veil, name, txt, hint);
    scene.tweens.add({ targets: hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });

    let lineIdx = 0, typing = false, typeTimer = null;

    const startLine = () => {
      typing = true;
      txt.setText('');
      const full = lines[lineIdx];
      let ci = 0;
      typeTimer = scene.time.addEvent({
        delay: 22,
        repeat: full.length - 1,
        callback: () => {
          txt.setText(full.slice(0, ++ci));
          if (ci >= full.length) typing = false;
        },
      });
    };

    const advance = () => {
      Audio.play('menuMove');
      if (typing) {                      // first press: reveal the whole line
        typeTimer?.remove();
        txt.setText(lines[lineIdx]);
        typing = false;
      } else if (++lineIdx >= lines.length) {
        finish();
      } else {
        startLine();
      }
    };

    const finish = () => {
      scene.input.keyboard.off('keydown-E', advance);
      scene.input.keyboard.off('keydown-ENTER', advance);
      typeTimer?.remove();
      objs.forEach((o) => o.destroy());
      resolve();
    };

    scene.input.keyboard.on('keydown-E', advance);
    scene.input.keyboard.on('keydown-ENTER', advance);
    scene.events.once('shutdown', finish);
    startLine();
  });
}

// Floating one-liner above a sprite; follows it, then fades. Non-blocking.
export function say(scene, target, text, holdMs = 2800) {
  const bubble = scene.add.text(target.x, target.y - 120, text, {
    ...PANEL_STYLE, fontSize: '17px', fontStyle: 'italic',
    backgroundColor: 'rgba(10,7,3,0.72)', padding: { x: 10, y: 6 },
  }).setOrigin(0.5, 1).setDepth(40);

  const follow = () => {
    if (bubble.active && target.active) bubble.setPosition(target.x, target.y - 120);
  };
  scene.events.on('update', follow);

  scene.time.delayedCall(holdMs, () => {
    scene.tweens.add({
      targets: bubble, alpha: 0, y: bubble.y - 14, duration: 400,
      onComplete: () => { scene.events.off('update', follow); bubble.destroy(); },
    });
  });
  return bubble;
}
