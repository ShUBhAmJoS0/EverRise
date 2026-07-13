import Audio from './AudioManager.js';
import { impactSparks } from './fx.js';
import { eatYarsagumba } from '../entities/pickups/Yarsagumba.js';

// The hero's pocket: stored Yarsagumba kept for later. Count lives in the
// registry ('yarsaPocket') so it survives a death/restart and carries between
// stages. Tab opens the pocket; E eats one. Call update(player) each frame.

const KEY = 'yarsaPocket';

export function createPocket(scene) {
  const W = scene.scale.width, H = scene.scale.height;
  const get = () => scene.registry.get(KEY) || 0;

  // Persistent badge under the HP bar (only shown when carrying at least one).
  const bx = 32, by = 68;
  const icon = scene.add.image(bx, by, 'yarsagumba').setScrollFactor(0).setDepth(45).setOrigin(0, 0.5).setScale(0.55);
  const label = scene.add.text(bx + 30, by, '', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffe9a0', stroke: '#000000', strokeThickness: 3,
  }).setScrollFactor(0).setDepth(45).setOrigin(0, 0.5);

  // Open panel (center of screen), hidden until Tab.
  const panel = scene.add.rectangle(W / 2, H / 2, 380, 156, 0x0a0703, 0.92)
    .setScrollFactor(0).setDepth(64).setStrokeStyle(2, 0xf4c542, 0.85).setVisible(false);
  const title = scene.add.text(W / 2, H / 2 - 52, 'POCKET', {
    fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f4c542', fontStyle: 'bold',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(65).setVisible(false);
  const pIcon = scene.add.image(W / 2 - 44, H / 2 + 4, 'yarsagumba').setScrollFactor(0).setDepth(65).setScale(1.0).setVisible(false);
  const pCount = scene.add.text(W / 2 + 6, H / 2 + 4, '', {
    fontFamily: 'Georgia, serif', fontSize: '28px', color: '#f3e7cb', fontStyle: 'bold',
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(65).setVisible(false);
  const pHint = scene.add.text(W / 2, H / 2 + 52, 'E · Eat one      Tab · Close', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#cdb98f',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(65).setVisible(false);
  const panelObjs = [panel, title, pIcon, pCount, pHint];

  let open = false;
  const setOpen = (v) => { open = v; panelObjs.forEach((o) => o.setVisible(v)); };

  const refresh = () => {
    const n = get();
    icon.setVisible(n > 0);
    label.setVisible(n > 0).setText(`× ${n}    [Tab]`);
    pCount.setText(`× ${n}`);
  };
  refresh();

  return {
    get open() { return open; },
    update(player) {
      refresh();
      if (player.inputLocked) { if (open) setOpen(false); return; }

      if (player.controls.pocketPressed) { setOpen(!open); Audio.play('menuMove'); }

      if (open && player.controls.interactPressed && get() > 0) {
        scene.registry.set(KEY, get() - 1);
        eatYarsagumba(scene, player);
        impactSparks(scene, player.x, player.y - 30, 0x9fe6a0, 12);
        refresh();
        if (get() === 0) setOpen(false);
      }
    },
    destroy() { [icon, label, ...panelObjs].forEach((o) => o.destroy()); },
  };
}
