import Phaser from 'phaser';
import SaveManager from './SaveManager.js';

// Lightweight juice helpers shared across entities. All particle helpers rely on
// the generated 'spark' texture (see BootScene._makeTextures) and no-op safely
// if it isn't present.

export function shake(scene, duration, intensity) {
  if (SaveManager.settings.screenShake) scene.cameras.main.shake(duration, intensity);
}

// Hit-stop: freeze physics + animations for a few frames on a meaty hit. The
// scene clock keeps running, so gameplay timers resume everything safely.
export function hitStop(scene, ms = 60) {
  if (scene._hitStopActive) return;
  scene._hitStopActive = true;
  scene.physics.world.pause();
  scene.anims.pauseAll();
  scene.time.delayedCall(ms, () => {
    scene._hitStopActive = false;
    scene.physics.world.resume();
    scene.anims.resumeAll();
  });
}

// Soft kicked-up dust, e.g. on landing.
export function dustBurst(scene, x, y, count = 8) {
  if (!scene.textures.exists('spark')) return;
  const p = scene.add.particles(x, y, 'spark', {
    speed: { min: 30, max: 100 }, angle: { min: 200, max: 340 },
    lifespan: 380, scale: { start: 1.3, end: 0 }, alpha: { start: 0.8, end: 0 },
    tint: 0xcdb38a, gravityY: 240, emitting: false,
  }).setDepth(9);
  p.explode(count);
  scene.time.delayedCall(450, () => p.destroy());
}

// Bright radial sparks on a successful hit.
export function impactSparks(scene, x, y, tint = 0xffd766, count = 10) {
  if (!scene.textures.exists('spark')) return;
  const p = scene.add.particles(x, y, 'spark', {
    speed: { min: 90, max: 220 }, lifespan: 300,
    scale: { start: 1.1, end: 0 }, tint, emitting: false,
  }).setDepth(12);
  p.explode(count);
  scene.time.delayedCall(350, () => p.destroy());
}

// Dirt + grass kicked up where something bursts out of the ground.
export function groundBurst(scene, x, y) {
  if (!scene.textures.exists('spark')) return;
  const p = scene.add.particles(x, y, 'spark', {
    speed: { min: 50, max: 150 }, angle: { min: 235, max: 305 },
    lifespan: 430, scale: { start: 1.5, end: 0 },
    tint: [0x6b4a2a, 0x4a7a30, 0x395a22, 0x8a5a30], gravityY: 320,
    emitting: false,
  }).setDepth(10);
  p.explode(14);
  scene.time.delayedCall(500, () => p.destroy());
}

// A quick crescent "swing trail" in front of a melee attack.
export function slashArc(scene, x, y, facing) {
  const g = scene.add.graphics({ x, y }).setDepth(11);
  g.lineStyle(6, 0xfff2c0, 0.9);
  g.beginPath();
  g.arc(0, 0, 66, Phaser.Math.DegToRad(-58), Phaser.Math.DegToRad(58), false);
  g.strokePath();
  g.setScale(facing, 1);
  scene.tweens.add({
    targets: g, alpha: 0, scaleX: facing * 1.4, scaleY: 1.4,
    duration: 190, onComplete: () => g.destroy(),
  });
}
