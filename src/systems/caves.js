import Phaser from 'phaser';
import Audio from './AudioManager.js';

// Cave props: the entrance the hero emerges from at a stage's start, and the
// exit they walk into at a stage's end (which triggers the next stage).

// Decorative entrance placed at the far left; the hero starts just outside it.
export function addStartCave(scene, texture, x, groundY, scale = 1) {
  return scene.add.image(x, groundY, texture)
    .setOrigin(0.5, 1).setDepth(2).setScale(scale);
}

// Exit cave near the stage end. Once armed (boss cleared), walking into its mouth
// runs onEnter() exactly once. Returns { img, arm(), update(player) }.
export function addEndCave(scene, texture, x, groundY, { scale = 1, flip = false, onEnter } = {}) {
  const img = scene.add.image(x, groundY, texture)
    .setOrigin(0.5, 1).setDepth(2).setScale(scale);
  if (flip) img.setFlipX(true);

  // Soft darkness in the mouth so "walking in" reads.
  const mouth = scene.add.rectangle(x, groundY - img.displayHeight * 0.42, 70, 90, 0x000000, 0.0)
    .setDepth(3);

  const prompt = scene.add.text(x, groundY - img.displayHeight - 8, '→ Enter the cave', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ffe9a0',
    backgroundColor: 'rgba(10,7,3,0.72)', padding: { x: 9, y: 5 },
  }).setOrigin(0.5).setDepth(30).setVisible(false);

  let armed = false, triggered = false, glow = null;

  return {
    img,
    arm() {
      if (armed) return;
      armed = true;
      // beckoning glow at the mouth to pull the player onward
      glow = scene.tweens.add({ targets: mouth, fillAlpha: 0.55, yoyo: true, repeat: -1, duration: 800 });
    },
    update(player) {
      if (!armed || triggered) return;
      const dx = Math.abs(player.x - x);
      prompt.setVisible(dx < 250 && Math.abs(player.y - groundY) < 220);
      if (dx < 52) {                       // walked into the mouth
        triggered = true;
        prompt.destroy();
        glow?.stop();
        Audio.play('menuSelect');
        onEnter?.();
      }
    },
  };
}
