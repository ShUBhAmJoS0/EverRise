import Phaser from 'phaser';

// Centralized input layer. Maps physical keys to *semantic actions* so the rest
// of the game never hard-codes a key. Swap bindings here (or later from a
// settings menu) without touching entity code.
//
// Usage:
//   this.input = new InputManager(scene);
//   this.input.update();                 // call once at the top of each frame
//   if (this.input.left)            { ... }       // held
//   if (this.input.jumpPressed)     { ... }       // edge (this frame only)
//
// Edge actions (…Pressed) are latched in update() so multiple reads in the same
// frame are consistent and each press fires exactly once.

export default class InputManager {
  constructor(scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;

    // Held-state keys (Phaser Key objects).
    this.keys = kb.addKeys({
      left:   Phaser.Input.Keyboard.KeyCodes.LEFT,
      a:      Phaser.Input.Keyboard.KeyCodes.A,
      right:  Phaser.Input.Keyboard.KeyCodes.RIGHT,
      d:      Phaser.Input.Keyboard.KeyCodes.D,
      up:     Phaser.Input.Keyboard.KeyCodes.UP,
      w:      Phaser.Input.Keyboard.KeyCodes.W,
      down:   Phaser.Input.Keyboard.KeyCodes.DOWN,
      s:      Phaser.Input.Keyboard.KeyCodes.S,
      space:  Phaser.Input.Keyboard.KeyCodes.SPACE,
      enter:  Phaser.Input.Keyboard.KeyCodes.ENTER,
      z:      Phaser.Input.Keyboard.KeyCodes.Z,
      q:      Phaser.Input.Keyboard.KeyCodes.Q,
      e:      Phaser.Input.Keyboard.KeyCodes.E,
      x:      Phaser.Input.Keyboard.KeyCodes.X,      // block (also right-mouse)
      r:      Phaser.Input.Keyboard.KeyCodes.R,      // store the Yarsagumba
      tab:    Phaser.Input.Keyboard.KeyCodes.TAB,    // open the pocket
      esc:    Phaser.Input.Keyboard.KeyCodes.ESC,
    });

    // Mouse: left = attack, right = block. Stop the right-click context menu and
    // keep Tab from moving browser focus.
    scene.input.mouse?.disableContextMenu();
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.TAB]);
    this._lmbWasDown = false;   // for left-click attack edge detection
    this._mmbWasDown = false;   // for middle-click Guleli edge detection

    // Stop the middle-mouse "autoscroll" cursor so it can be used as Guleli.
    this._preventMiddle = (e) => { if (e.button === 1) e.preventDefault(); };
    scene.game.canvas?.addEventListener('mousedown', this._preventMiddle);

    // Left/Right Shift and Left/Right Ctrl can't be told apart by Phaser KeyCodes
    // (both map to the generic modifier), so track them from the raw DOM event.code.
    this._sprintHeld   = false;   // Left Shift  held → sprint
    this._comboQueued  = false;   // Right Shift edge → combo attack (consumed each frame)
    this._guleliQueued = false;   // Right Ctrl  edge → start charging the Guleli
    this._guleliHeld   = false;   // Right Ctrl  held → keep charging

    this._onKeyDown = (e) => {
      if (e.code === 'ShiftLeft')   this._sprintHeld   = true;
      if (e.code === 'ShiftRight')  this._comboQueued  = true;
      if (e.code === 'ControlRight') { this._guleliQueued = true; this._guleliHeld = true; }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'ShiftLeft')    this._sprintHeld = false;
      if (e.code === 'ControlRight') this._guleliHeld = false;
    };
    kb.on('keydown', this._onKeyDown);
    kb.on('keyup',   this._onKeyUp);

    // Latched per-frame snapshot (filled by update()).
    this.left = this.right = this.up = this.down = false;
    this.sprintHeld = false;
    this.jumpPressed = this.attackPressed = this.comboPressed = false;
    this.dodgePressed = this.pausePressed = this.guleliPressed = false;
    this.interactPressed = this.storePressed = this.pocketPressed = false;
    this.blockHeld = false;
    this.guleliDown = false;

    scene.events.once('shutdown', this.destroy, this);
    scene.events.once('destroy',  this.destroy, this);
  }

  // Returns true if ANY of the given Phaser keys went down this frame.
  // Evaluates every key (no short-circuit) so JustDown latches reset cleanly.
  _anyJustDown(...keys) {
    let hit = false;
    for (const k of keys) {
      if (Phaser.Input.Keyboard.JustDown(k)) hit = true;
    }
    return hit;
  }

  update() {
    const k = this.keys;

    // Held directions.
    this.left  = k.left.isDown  || k.a.isDown;
    this.right = k.right.isDown || k.d.isDown;
    this.up    = k.up.isDown    || k.w.isDown;
    this.down  = k.down.isDown  || k.s.isDown;
    this.sprintHeld = this._sprintHeld;

    // Held state for variable jump height (release early = shorter hop).
    this.jumpHeld = k.space.isDown || k.w.isDown || k.up.isDown;

    // Mouse buttons (activePointer tracks held state; clicks need an edge).
    const p   = this.scene.input.activePointer;
    const lmb = p ? p.leftButtonDown()   : false;
    const rmb = p ? p.rightButtonDown()  : false;
    const mmb = p ? p.middleButtonDown() : false;   // middle button = Guleli

    // Edge actions (fire once per press).
    this.jumpPressed     = this._anyJustDown(k.space, k.w, k.up);
    this.attackPressed   = this._anyJustDown(k.enter, k.z) || (lmb && !this._lmbWasDown);
    this.dodgePressed    = this._anyJustDown(k.q);
    this.interactPressed = this._anyJustDown(k.e);
    this.storePressed    = this._anyJustDown(k.r);
    this.pocketPressed   = this._anyJustDown(k.tab);
    this.pausePressed    = this._anyJustDown(k.esc);

    // Held: block on X or right-mouse.
    this.blockHeld    = k.x.isDown || rmb;
    this._lmbWasDown  = lmb;

    // Right Shift combo (latched from the DOM listener).
    this.comboPressed  = this._comboQueued;
    this._comboQueued  = false;

    // Guleli: hold Right Ctrl OR the middle mouse button to charge, release to fire.
    this.guleliPressed = this._guleliQueued || (mmb && !this._mmbWasDown);
    this._guleliQueued = false;
    this.guleliDown    = this._guleliHeld || mmb;
    this._mmbWasDown   = mmb;
  }

  destroy() {
    const kb = this.scene?.input?.keyboard;
    if (kb) {
      kb.off('keydown', this._onKeyDown);
      kb.off('keyup',   this._onKeyUp);
    }
    this.scene?.game?.canvas?.removeEventListener('mousedown', this._preventMiddle);
  }
}
