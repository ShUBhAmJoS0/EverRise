import Phaser from 'phaser';
import Audio from './AudioManager.js';

// Cave props + transition cutscenes. A stage's EXIT cave is the one the hero
// walks into to travel onward (triggering the next stage); the next stage's
// ENTRANCE cave is the one he emerges from. The little scripted walk-in /
// walk-out sells the journey between biomes.

// Caves render BEHIND the characters (depth 3 < the player's 10) so the hero
// always stands clearly IN FRONT of the cave — he emerges from / enters it via
// an alpha fade rather than being hidden behind the rock.
const CAVE_DEPTH = 3;

// Decorative entrance, placed at the far left of a stage. Pair with
// emergeFromCave() to have the hero walk out of its mouth at the stage start.
export function addStartCave(scene, texture, x, groundY, { scale = 1, flip = false } = {}) {
  const img = scene.add.image(x, groundY, texture)
    .setOrigin(0.5, 1).setDepth(CAVE_DEPTH).setScale(scale);
  if (flip) img.setFlipX(true);
  return img;
}

// Opening cutscene: the hero steps out of the entrance cave into the stage,
// fading in from the dark and walking until he's clear of the rock (derived from
// the cave's real width so it works at any scale). Input is locked until he's out;
// pass onDone to keep it locked and run a story beat before handing back control.
export function emergeFromCave(scene, player, cave, { extra = 55, onDone } = {}) {
  const outX = cave.x + cave.displayWidth * 0.5 + extra;
  player.setX(cave.x);
  player.setFlipX(false);
  player.setAlpha(0);
  scene.tweens.add({ targets: player, alpha: 1, duration: 550, ease: 'Sine.out' });
  player.startScriptedWalk(outX, () => {
    if (onDone) onDone();
    else player.inputLocked = false;
  });
}

// Exit cave near the stage end. Once armed (boss cleared), reaching the mouth
// walks the hero in — fading out behind the rock — then runs onEnter() once.
// Returns { img, arm(), update(player) }.
export function addEndCave(scene, texture, x, groundY, { scale = 1, flip = false, onEnter } = {}) {
  const img = scene.add.image(x, groundY, texture)
    .setOrigin(0.5, 1).setDepth(CAVE_DEPTH).setScale(scale);
  if (flip) img.setFlipX(true);

  // Soft darkness in the mouth so the beckon glow reads once armed.
  const mouth = scene.add.rectangle(x, groundY - img.displayHeight * 0.42, 70, 90, 0x000000, 0.0)
    .setDepth(CAVE_DEPTH - 1);

  const prompt = scene.add.text(x, groundY - img.displayHeight - 8, '→ Enter the cave', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ffe9a0',
    backgroundColor: 'rgba(10,7,3,0.72)', padding: { x: 9, y: 5 },
  }).setOrigin(0.5).setDepth(30).setVisible(false);

  let armed = false, entering = false, glow = null;

  return {
    img,
    arm() {
      if (armed) return;
      armed = true;
      // beckoning glow at the mouth to pull the player onward
      glow = scene.tweens.add({ targets: mouth, fillAlpha: 0.55, yoyo: true, repeat: -1, duration: 800 });
    },
    update(player) {
      if (!armed || entering) return;
      const dx = Math.abs(player.x - x);
      prompt.setVisible(dx < 260 && Math.abs(player.y - groundY) < 240);
      if (dx < 120) {                       // reached the mouth — walk him in
        entering = true;
        prompt.destroy();
        glow?.stop();
        Audio.play('menuSelect');
        // The last steps into the dark: fade out behind the rock, then transition.
        scene.tweens.add({ targets: player, alpha: 0, duration: 650, ease: 'Sine.in' });
        player.startScriptedWalk(x + 15, () => onEnter?.());
      }
    },
  };
}
