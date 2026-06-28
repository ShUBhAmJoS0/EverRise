// Tiny versioned localStorage wrapper for settings + progress. All access goes
// through here so the schema lives in one place and a bad/old blob can't crash
// the game (every read falls back to a default).

const KEY     = 'everrise.save.v1';
const DEFAULTS = {
  settings: {
    masterVolume: 0.8,
    musicVolume:  0.7,
    sfxVolume:    0.9,
    screenShake:  true,
  },
  progress: {
    stageReached: 1,   // highest stage unlocked (1..3)
  },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    // Shallow-merge so missing keys pick up new defaults.
    return {
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
      progress: { ...DEFAULTS.progress, ...(data.progress || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode / quota */ }
}

const SaveManager = {
  _data: load(),

  get settings() { return this._data.settings; },
  get progress() { return this._data.progress; },

  setSetting(key, value) {
    this._data.settings[key] = value;
    save(this._data);
  },

  // Record that the player reached a stage (never lowers the high-water mark).
  recordStageReached(stage) {
    if (stage > this._data.progress.stageReached) {
      this._data.progress.stageReached = stage;
      save(this._data);
    }
  },

  hasProgress() { return this._data.progress.stageReached > 1; },

  reset() {
    this._data = structuredClone(DEFAULTS);
    save(this._data);
  },
};

export default SaveManager;
