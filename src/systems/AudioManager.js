import SaveManager from './SaveManager.js';

// Procedural placeholder SFX synthesized with the Web Audio API — no asset files
// needed. Every sound is generated on the fly and scaled by the master × SFX
// volume from Settings. When real audio files arrive, swap the bodies of play()
// for sample playback; the call sites won't change.
//
// All synthesis is wrapped in try/catch so audio can never break gameplay
// (e.g. before the first user gesture, or in environments with no audio device).

class AudioManager {
  constructor() {
    this._ctx = null;
  }

  _ensure() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this._ctx = new AC();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  _gain() {
    const s = SaveManager.settings;
    return Phaser_clamp(s.masterVolume) * Phaser_clamp(s.sfxVolume);
  }

  // A pitched blip with an exponential volume decay; optional frequency slide.
  _tone(freq, dur, { type = 'square', vol = 0.3, slideTo = null } = {}) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    const peak = Math.max(0.0001, vol * this._gain());
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // Short filtered noise burst (swings, whooshes, impacts).
  _noise(dur, { vol = 0.3, filter = 1400, type = 'lowpass' } = {}) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol * this._gain()), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + dur);
  }

  // A vocal "effort" grunt (Temple-Run style): a breath transient + a voiced
  // vowel made from a sawtooth (rich harmonics) shaped by a formant band-pass,
  // with a pitch + amplitude envelope. f0 ~200–300Hz reads as a young human.
  _grunt(f0Start, f0End, formant, dur, vol = 0.3) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const g0 = this._gain();

    // breath onset ('h')
    this._noise(0.045, { vol: vol * 0.35, filter: 1800, type: 'highpass' });

    // voiced vowel
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0Start, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f0End), t + dur);

    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = formant; f1.Q.value = 7;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = formant * 2.2; f2.Q.value = 5;

    const g = ctx.createGain();
    const peak = Math.max(0.0001, vol * g0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(f1); osc.connect(f2); f1.connect(g); f2.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  play(name) {
    try {
      switch (name) {
        // Human effort grunts (Temple-Run style)
        case 'jump':       this._grunt(235, 175, 900, 0.24, 0.32); break;          // "hup!"
        case 'doubleJump': this._grunt(275, 205, 1000, 0.22, 0.32); break;         // higher "hyup!"
        case 'land':       this._grunt(150, 110, 650, 0.16, 0.26);                 // exhale "huh"
                           this._noise(0.07, { vol: 0.12, filter: 600 }); break;
        case 'swing':      this._grunt(300, 190, 1150, 0.18, 0.32);                // effort "hah!"
                           this._noise(0.12, { vol: 0.16, filter: 2000, type: 'bandpass' }); break;  // blade whoosh
        case 'hiss':       this._noise(0.42, { vol: 0.3, filter: 6500, type: 'highpass' }); break;    // snake "sssss"
        case 'snakeBite':  this._noise(0.06, { vol: 0.3, filter: 3000 });
                           this._noise(0.3, { vol: 0.22, filter: 6500, type: 'highpass' }); break;
        case 'hit':        this._tone(180, 0.1, { slideTo: 90, vol: 0.32 });
                           this._noise(0.08, { vol: 0.16, filter: 2200 }); break;
        case 'hurt':       this._tone(320, 0.28, { type: 'sawtooth', slideTo: 110, vol: 0.32 }); break;
        case 'guleli':     this._noise(0.18, { vol: 0.2, filter: 2400, type: 'bandpass' });
                           this._tone(700, 0.12, { slideTo: 1200, vol: 0.15 }); break;
        case 'enemyHit':   this._tone(240, 0.09, { slideTo: 120, vol: 0.26 }); break;
        case 'menuMove':   this._tone(520, 0.05, { vol: 0.16 }); break;
        case 'menuSelect': this._tone(720, 0.13, { slideTo: 1040, vol: 0.22 }); break;
        case 'pickup':     this._tone(660, 0.09, { type: 'triangle', vol: 0.22 });
                           this._tone(990, 0.18, { type: 'triangle', slideTo: 1320, vol: 0.2 }); break;
        case 'shieldBreak': this._noise(0.35, { vol: 0.28, filter: 4200, type: 'highpass' });
                           this._tone(900, 0.4, { type: 'sawtooth', slideTo: 160, vol: 0.24 }); break;
        default: break;
      }
    } catch (_) { /* never let audio break the game */ }
  }
}

function Phaser_clamp(v) { return Math.max(0, Math.min(1, v ?? 0)); }

// Single shared instance.
export default new AudioManager();
