# EverRise — Rebuild & Architecture Plan

> Status: **DRAFT for approval** · Author: engineering pass 2026-06-29
> Goal: evolve the current vertical slice into a polished, complete 2D action-platformer
> **without ever leaving the game in a broken state** (incremental refactor, not big-bang rewrite).

---

## 1. Where we are today (honest baseline)

A Phaser 3.80 side-scroller. Clean, readable code; data-driven waves and animations. But functionally it's **one finished stage** (Stage 1) plus two empty corridors.

**What works**
- Stage 1 full loop: 3 waves (wolf → 3 wolves → Forest Witch) → StageComplete.
- Data-driven animation registry (`src/config/animations.js`) and wave defs (`src/config/waves.js`).
- Sensible entity hierarchy: `Enemy` base → `Wolf`, `ForestWitch`, `CorruptedMonk`.
- Scrolling camera with follow + deadzone; HUD as a parallel scene.

**Structural problems we will fix**
- **No ending.** Stage 3 has zero enemies / no win condition (`Stage3Scene.update` passes `[]`).
- **Not a platformer.** Single flat invisible floor — no gaps, ledges, verticality, parallax.
- **No game feel.** No audio, screenshake, particles, knockback, hit-stop, or damage numbers.
- **No game shell.** No title / pause / settings / game-over; death = full stage restart.
- **Shallow combat.** One attack, center-distance hit detection that ignores facing.
- **Heavy duplication.** Stage 1/2/3 copy background/platform/floor/camera/debug setup.
- **Inconsistent engine wiring.** Phaser via CDN while the npm `phaser` dep goes unused.
- **Not responsive.** Hardcoded 1280×720, no Scale Manager; keyboard-only input.

Concrete bugs are tracked in §11.

---

## 2. Vision & design pillars

**EverRise** — a momentum-driven side-scrolling action-platformer. You *rise* through corrupted
elemental realms (Forest → Frozen Ruins → Glacier → …), each ending in a boss, growing stronger
each run. Tight, juicy melee combat is the core verb; platforming connects the fights.

Four pillars every decision is measured against:

1. **Responsive & juicy** — sub-100ms input feel; every hit has screenshake, particles, hit-stop, knockback, sound.
2. **Readable combat** — telegraphed enemy attacks, clear hurt/hit windows, fair i-frames.
3. **Always-rising progression** — the "EverRise" hook: permanent + per-run upgrades so each attempt feels like growth.
4. **Complete & winnable** — a real beginning (title) and end (final boss → victory), saveable.

---

## 3. Target architecture (the big picture)

```
                ┌─────────────────────────────────────────────┐
   Phaser.Game  │  Boot → Preload → MainMenu → Stage(s) ↔ UI   │
   (single)     │            ↘ Pause ↘ GameOver ↘ Victory      │
                └─────────────────────────────────────────────┘
                                  │ uses
        ┌──────────┬──────────┬───┴───────┬───────────┬──────────────┐
     Audio      Input       Save        VFX/Juice   GameState     EventBus
    Manager    Manager     Manager       Manager     (RunState)   (typed)
```

**Engine wiring**
- **Drop the CDN.** `import Phaser from 'phaser'` and let Vite bundle it → offline dev, version-locked, tree-shakeable.
- **Scale Manager:** `scale: { mode: Phaser.Scale.FIT, autoCenter: CENTER_BOTH }` → responsive on any screen, keeps 16:9.
- **Single source of truth for balance** in `src/config/` (player, enemies, combat, progression).

**Scene flow**
`BootScene` (tiny, sets scale/registry) → `PreloadScene` (real loading bar; loads only what the next area needs) → `MainMenuScene` → `StageScene` (one parameterized class, see §4) running with `HudScene` overlay → `PauseScene` / `GameOverScene` / `StageCompleteScene` / `VictoryScene`.

**Core systems (new `src/systems/`)**
| System | Responsibility |
|---|---|
| `AudioManager` | SFX bus + music bus, per-channel volume, ducking, mute persistence |
| `InputManager` | Maps physical keys/gamepad → semantic actions (`jump`,`attack`,`dodge`); remappable; buffering |
| `SaveManager` | `localStorage` (versioned schema): settings, unlocks, best run, checkpoint |
| `JuiceManager` | screenshake, hit-stop (global time-freeze frames), particle presets, damage-number pool |
| `GameState` / `RunState` | current stage, lives, currency, acquired upgrades — survives scene restarts |
| `EventBus` | typed game-wide events (decouples HUD/audio/VFX from entities) |

---

## 4. Scenes: kill the duplication

Replace `Stage1/2/3Scene` with **one `StageScene`** driven by a per-stage data file:

```
src/config/stages/stage1.js  → { bg, platform, parallaxLayers, tilemap,
                                  waves, boss, music, ambient, palette }
```

`StageScene` handles background/parallax tiling, tilemap collision, camera, wave runner,
boss trigger, and the debug toggle **once**. Adding a stage becomes "write a data file +
drop a Tiled map," not "copy a 140-line scene." This alone removes ~60% of scene code and
is the precondition for filling Stages 2 & 3 cheaply.

---

## 5. Combat system (the core verb)

Move from "distance circle" to a real **hitbox / hurtbox** model:

- Each combatant owns a **hurtbox** (Arcade body) and spawns transient **hitboxes** (zones) during attack active-frames, offset by facing. Overlap → damage. *Fixes the "hit enemies behind you" bug structurally.*
- **Player FSM:** `Idle · Run · Jump · Fall · Attack(1→2→3 combo) · Dodge · Hurt · Dead`. One place owns transitions → no more scattered `_isAttacking` flags.
- **Feel mechanics:** coyote time, jump buffering, variable jump height (release = shorter hop), dodge-roll with i-frames, attack-cancel windows.
- **On every hit:** knockback impulse + hit-stop (2–4 frames) + screenshake + particles + SFX + floating damage number. Centralized in `JuiceManager.onHit()`.
- **Animation fix:** all sheets are 1280×1280 = **25 frames**; configs currently use only ~16. Re-time attacks/casts to use the full sheet (see §11.7).

---

## 6. Platforming & levels

- **Tiled (`.tmj`) tilemaps** for real geometry: ground, gaps, one-way platforms, ledges, moving platforms, hazards (spikes/pits), and object layers for spawns/triggers/collectibles.
- **Parallax**: 2–3 background layers per stage with `scrollFactor` depth (the art already supports distinct bg vs platform layers).
- Fall-out-of-world → damage/respawn at last checkpoint, not full restart.

---

## 7. Enemies & AI

- Shared **enemy FSM**: `Patrol → (sees player) → Chase → Telegraph → Attack → Recover`, with line-of-sight + ledge detection (don't walk off cliffs), and enemy↔enemy separation (fixes the wolf-stacking bug).
- **Use the orphaned art** — give roles to the three unused packs:
  | Pack | Proposed role |
  |---|---|
  | `corrupted-snow-leopard` | fast lunger, Stage 3 |
  | `yeti` | heavy bruiser / Stage 3 mini-boss |
  | `narapichas` | swarm/ranged goon, Stage 2 bridge |
- Telegraph every attack (wind-up flash/anticipation) so damage is always fair.

---

## 8. Progression — the "EverRise" hook

- **Per-run:** currency (essence) from kills → spend at between-stage altars on temporary upgrades (damage, max HP, dodge cooldown, new attack).
- **Meta (persistent via SaveManager):** permanent unlocks that make each new run start stronger — the "ever rise."
- **HUD additions:** combo counter, essence, stage/boss health bar.
- *Scope note:* full roguelite is optional; even a linear "3 upgrades between stages" delivers the fantasy. Flagged as an open decision (§13).

---

## 9. UX, audio, accessibility

- **Menus:** Title (Play / Continue / Settings), Pause (Resume / Settings / Quit), Settings (master/music/SFX volume, key remap, screenshake toggle), Game Over (Retry / Menu), Victory.
- **Audio:** per-stage music + a core SFX set (jump, land, swing, hit, hurt, enemy death, boss roar, UI). All routed through `AudioManager`.
- **Accessibility:** WASD + arrows + gamepad, remappable; FIT scaling; screenshake/flash toggles; colorblind-safe HUD.

---

## 10. Proposed project structure

```
src/
  main.js                 # Game config, Scale Manager, scene list
  scenes/  Boot, Preload, MainMenu, Stage, Hud, Pause, GameOver, StageComplete, Victory
  systems/ AudioManager, InputManager, SaveManager, JuiceManager, EventBus, GameState
  entities/
    Player.js  (+ states/  FSM states)
    enemies/   Enemy.js, Wolf.js, SnowLeopard.js, Yeti.js, Narapichas.js
    bosses/    ForestWitch.js, CorruptedMonk.js, GlacierBoss.js
    Projectile.js, Hitbox.js
  components/  Health.js, StateMachine.js, Hurtbox.js
  config/
    balance.js, animations.js
    stages/ stage1.js, stage2.js, stage3.js
  utils/
docs/  REBUILD_PLAN.md (this file)
assets/ (unchanged; + audio/)
```

---

## 11. Bug ledger (fold into Milestone 0)

| # | Bug | Location | Fix |
|---|---|---|---|
| 1 | Attacks hit enemies behind player | `Player.js:91-97` | facing-aware hitbox |
| 2 | HP bar not reset after death/restart | `Player.js:124`, `UIScene.js:49` | emit health on (re)spawn |
| 3 | Death = full stage restart, no lives | `Player.js:118-126` | checkpoints + GameOver scene |
| 4 | No knockback / hit-stop | `Player.js:106` | `JuiceManager.onHit()` |
| 5 | Wolves stack into one point | `Stage1Scene.js:133` | enemy↔enemy separation |
| 6 | Projectile overlap colliders leak | `Stage1Scene.js:140` | shared group + auto-cleanup |
| 7 | ~9 of 25 animation frames unused | `animations.js:33` (+casts) | re-time to full 25-frame sheets |
| 8 | Blank screen while loading | `BootScene.js:48-50` | PreloadScene loading bar |
| 9 | 3 enemy art packs unused | `assets/` | wire up in §7 |

---

## 12. Milestones (incremental — game is playable after each)

- **M0 — Foundation & bug-fix (small):** npm-bundle Phaser, Scale Manager, `EventBus`, fix bugs #1,2,4,5,6,7,8. *Outcome: Stage 1 feels markedly tighter.*
- **M1 — Juice & audio:** `JuiceManager` + `AudioManager` (screenshake, particles, hit-stop, damage numbers, SFX/music). *Outcome: the biggest perceived-quality jump.*
- **M2 — Game shell:** Preload/MainMenu/Pause/GameOver/Settings/Victory + `SaveManager` + lives/checkpoints. *Outcome: a complete loop with a title and an end.*
- **M3 — `StageScene` refactor + fill content:** collapse 3 scenes into one data-driven class; populate Stages 2 & 3 with the unused enemies and a Stage 3 final boss. *Outcome: the game is winnable start→finish.*
- **M4 — Combat & platforming depth:** player FSM, combos, dodge-roll, coyote/jump-buffer, Tiled tilemaps, enemy FSM + telegraphs.
- **M5 — Progression & polish:** essence/upgrades, meta-unlocks, combo HUD, balance pass, parallax, gamepad.

---

## 13. Decisions (LOCKED — 2026-06-29)

1. **Language → TypeScript.** Migrate lazily during M0 (Vite already supports TS zero-config; add `tsconfig.json`, rename files to `.ts` as each is touched, `strict: true`). New files in §10 use `.ts`.
2. **Target platform → Web only.** Browser, keyboard + gamepad, `Scale.FIT`. No Electron/touch scope for now (architecture stays portable to add later).
3. **Progression → Light.** Between-stage **altar**: pick 1 of 3 offered upgrades (damage / max-HP / dodge / new attack). No currency or random pools in M5 (kept behind a flag so it can grow into the roguelite loop later).
4. **Assets → Existing art + free audio.** Use current sprites incl. the 3 unused packs (§7); source CC0/free SFX & music into `assets/audio/`. No external art dependency; placeholder only where a sheet is truly missing (e.g. boss death anims).
5. **Approach → Incremental refactor** (confirmed) over clean-room rewrite — game stays playable after every milestone.

---

## 14. Risks
- Sprite sheets are AI-generated with irregular frames — animation re-timing (M0.7) is empirical, needs in-game tuning.
- Tiled migration (M4) is the largest single lift; can be deferred if we keep curated invisible-collider platforms short-term.
- Scope creep on progression (M5) — keep it behind a feature flag until core loop is fun.
