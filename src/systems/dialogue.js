import Phaser from 'phaser';
import Audio from './AudioManager.js';

// Story presentation:
//   storyTitle(scene, title, subtitle)  — cinematic chapter card (fades in/out).
//   runDialogue(scene, lines)           — letterbox conversation panel with a
//                                         typewriter; E / Enter advances. Lines
//                                         may be strings or { speaker, text } for
//                                         back-and-forth. Returns a Promise.
//   itemReward(scene, { name, desc })   — a glowing "item obtained" flourish.
//   say(scene, target, text, ms)        — floating combat one-liner over a sprite.

const FONT = 'Georgia, "Times New Roman", serif';
const PANEL_STYLE = {
  fontFamily: FONT, fontSize: '21px', color: '#f3e7cb', stroke: '#000000', strokeThickness: 2,
};

// ── Cinematic chapter title card ──────────────────────────────────────────────
export function storyTitle(scene, title, subtitle = '', holdMs = 1400) {
  return new Promise((resolve) => {
    const W = scene.scale.width, H = scene.scale.height;
    const veil = scene.add.rectangle(W / 2, H / 2, W, H, 0x05060a, 0.82)
      .setScrollFactor(0).setDepth(70).setAlpha(0);
    const t = scene.add.text(W / 2, H / 2 - 12, title, {
      fontFamily: FONT, fontSize: '50px', color: '#f6ecd2', stroke: '#000000', strokeThickness: 5, fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(72).setAlpha(0);
    const rule = scene.add.rectangle(W / 2, H / 2 + 22, 460, 2, 0xf4c542, 1)
      .setScrollFactor(0).setDepth(72).setAlpha(0).setScale(0.02, 1);
    const s = scene.add.text(W / 2, H / 2 + 42, subtitle, {
      fontFamily: FONT, fontSize: '23px', color: '#e6bd4a', fontStyle: 'italic',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(72).setAlpha(0);
    const objs = [veil, t, rule, s];

    Audio.play('menuSelect');
    scene.tweens.add({ targets: veil, alpha: 1, duration: 300 });
    scene.tweens.add({ targets: [t, s], alpha: 1, duration: 500, delay: 150 });
    scene.tweens.add({ targets: t, y: H / 2 - 16, duration: 700, delay: 150, ease: 'Sine.out' });
    scene.tweens.add({ targets: rule, scaleX: 1, alpha: 1, duration: 600, delay: 300, ease: 'Sine.out' });

    let done = false;
    const close = () => {
      if (done) return; done = true;
      scene.tweens.add({ targets: objs, alpha: 0, duration: 400, onComplete: () => { objs.forEach((o) => o.destroy()); resolve(); } });
    };
    scene.time.delayedCall(holdMs + 800, close);
    scene.events.once('shutdown', () => { if (!done) { objs.forEach((o) => o.destroy()); resolve(); } });
  });
}

// ── Conversation panel (letterbox + typewriter, multi-speaker) ────────────────
export function runDialogue(scene, lines, { speaker = 'THE GUARDIAN' } = {}) {
  const seq = lines.map((l) => (typeof l === 'string' ? { speaker, text: l } : { speaker: l.speaker ?? speaker, text: l.text }));
  return new Promise((resolve) => {
    const W = scene.scale.width, H = scene.scale.height;

    // Cinematic letterbox bars slide in.
    const BAR = 46;
    const topBar = scene.add.rectangle(W / 2, -BAR / 2, W, BAR, 0x000000, 0.92).setScrollFactor(0).setDepth(58);
    const botBar = scene.add.rectangle(W / 2, H + BAR / 2, W, BAR, 0x000000, 0.92).setScrollFactor(0).setDepth(58);
    scene.tweens.add({ targets: topBar, y: BAR / 2, duration: 350, ease: 'Sine.out' });
    scene.tweens.add({ targets: botBar, y: H - BAR / 2, duration: 350, ease: 'Sine.out' });

    const panelW = W - 220, panelX = W / 2, panelY = H - 96;
    const veil = scene.add.rectangle(panelX, panelY, panelW, 128, 0x0a0703, 0.9)
      .setScrollFactor(0).setDepth(60).setStrokeStyle(2, 0xf4c542, 0.8);
    const emblem = scene.add.star(panelX - panelW / 2 + 20, panelY - 45, 4, 4, 9, 0xf4c542)
      .setScrollFactor(0).setDepth(61);
    const name = scene.add.text(panelX - panelW / 2 + 36, panelY - 52, '', {
      ...PANEL_STYLE, fontSize: '15px', color: '#f4c542', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(61);
    const txt = scene.add.text(panelX - panelW / 2 + 20, panelY - 26, '', {
      ...PANEL_STYLE, wordWrap: { width: panelW - 40 },
    }).setScrollFactor(0).setDepth(61);
    const hint = scene.add.text(panelX + panelW / 2 - 16, panelY + 44, 'E ▸', {
      ...PANEL_STYLE, fontSize: '15px', color: '#cdb98f',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(61);
    const objs = [topBar, botBar, veil, emblem, name, txt, hint];
    scene.tweens.add({ targets: hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });

    let lineIdx = 0, typing = false, typeTimer = null, finished = false;

    const startLine = () => {
      typing = true;
      const line = seq[lineIdx];
      name.setText(line.speaker);
      txt.setText('');
      const full = line.text;
      let ci = 0;
      typeTimer = scene.time.addEvent({
        delay: 22, repeat: full.length - 1,
        callback: () => { txt.setText(full.slice(0, ++ci)); if (ci >= full.length) typing = false; },
      });
    };

    const advance = () => {
      Audio.play('menuMove');
      if (typing) { typeTimer?.remove(); txt.setText(seq[lineIdx].text); typing = false; }
      else if (++lineIdx >= seq.length) finish();
      else startLine();
    };

    const finish = () => {
      if (finished) return; finished = true;
      scene.input.keyboard.off('keydown-E', advance);
      scene.input.keyboard.off('keydown-ENTER', advance);
      typeTimer?.remove();
      scene.tweens.add({ targets: [veil, emblem, name, txt, hint], alpha: 0, duration: 250 });
      scene.tweens.add({ targets: topBar, y: -BAR / 2, duration: 300 });
      scene.tweens.add({ targets: botBar, y: H + BAR / 2, duration: 300 });
      scene.time.delayedCall(320, () => { objs.forEach((o) => o.destroy()); resolve(); });
    };

    scene.input.keyboard.on('keydown-E', advance);
    scene.input.keyboard.on('keydown-ENTER', advance);
    scene.events.once('shutdown', () => {
      if (finished) return; finished = true;
      scene.input.keyboard.off('keydown-E', advance);
      scene.input.keyboard.off('keydown-ENTER', advance);
      typeTimer?.remove();
      objs.forEach((o) => o.destroy());
      resolve();
    });
    startLine();
  });
}

// ── "Item obtained" flourish (pendant, Heart of Sagarmatha, …) ────────────────
export function itemReward(scene, { name, desc, color = 0xffe9a0 } = {}, holdMs = 2100) {
  return new Promise((resolve) => {
    const W = scene.scale.width, H = scene.scale.height, cx = W / 2, cy = H / 2 - 26;
    const veil = scene.add.rectangle(W / 2, H / 2, W, H, 0x05060a, 0.76).setScrollFactor(0).setDepth(70).setAlpha(0);
    const glow = scene.add.circle(cx, cy, 70, color, 0.3).setScrollFactor(0).setDepth(71).setAlpha(0);
    const gem  = scene.add.rectangle(cx, cy, 46, 46, color, 1)
      .setScrollFactor(0).setDepth(72).setAngle(45).setAlpha(0).setStrokeStyle(3, 0xffffff, 0.75);
    const label = scene.add.text(cx, cy + 74, name || '', {
      fontFamily: FONT, fontSize: '26px', color: '#f6ecd2', stroke: '#000000', strokeThickness: 4, fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(72).setAlpha(0);
    const sub = scene.add.text(cx, cy + 108, desc || '', {
      fontFamily: FONT, fontSize: '17px', color: '#e6bd4a', fontStyle: 'italic',
      wordWrap: { width: W - 340 }, align: 'center',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(72).setAlpha(0);
    const objs = [veil, glow, gem, label, sub];

    Audio.play('pickup');
    scene.tweens.add({ targets: veil, alpha: 1, duration: 300 });
    scene.tweens.add({ targets: [glow, gem, label, sub], alpha: 1, duration: 400, delay: 150 });
    scene.tweens.add({ targets: gem, angle: 405, duration: 1500, delay: 150, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: glow, scale: 1.15, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });

    if (scene.textures.exists('spark')) {
      const p = scene.add.particles(cx, cy, 'spark', {
        speed: { min: 30, max: 95 }, lifespan: 900, scale: { start: 0.7, end: 0 },
        alpha: { start: 0.9, end: 0 }, tint: color, frequency: 70, quantity: 1,
      }).setScrollFactor(0).setDepth(71);
      objs.push(p);
    }

    let done = false;
    const clear = () => { objs.forEach((o) => { o.stop?.(); o.destroy(); }); };
    const close = () => {
      if (done) return; done = true;
      scene.tweens.add({ targets: objs, alpha: 0, duration: 400, onComplete: () => { clear(); resolve(); } });
    };
    scene.time.delayedCall(holdMs + 700, close);
    scene.events.once('shutdown', () => { if (!done) { done = true; clear(); resolve(); } });
  });
}

// ── Floating combat one-liner above a sprite (non-blocking) ───────────────────
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
