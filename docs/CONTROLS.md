# EverRise — Controls

All bindings live in one place: [`src/systems/InputManager.js`](../src/systems/InputManager.js).
Change a key there (or, later, from a settings menu) without touching gameplay code.

## Implemented now

| Action | Keys | Notes |
|---|---|---|
| Move | **A / D** or **← / →** | |
| Sprint | **Left Shift** (hold) | 1.6× move speed |
| Jump / Double jump | **Space** (also **W / ↑**) | 2nd press in the air = double jump |
| Standard attack (Khukuri) | **Enter** (also **Z**) | single swing + slash trail |
| Combo attack (Khukuri) | **Right Shift** | two-hit chain, stronger 2nd hit |
| Guleli (ranged stone) | **Right Ctrl** | **hold to charge** (longer = faster, farther, stronger), release to fire; **hold W/S** to aim up/down |
| Dodge roll | **Q** | quick dash with i-frames (brief cooldown) |
| Interact | **E** | eat Yarsagumba, advance story dialogue |
| Pause menu | **Esc** | Resume / Controls / Settings / Restart / Quit |
| Toggle physics debug | **F1** | dev-only collision-box overlay |

## Reserved / deferred (need supporting systems first)

These come from your proposed scheme. They're great targets — each is parked
against the milestone that builds the system it needs, so the binding does
something real when it lands rather than being a dead key.

| Action | Proposed key | Blocked on (milestone) |
|---|---|---|
| Heavy attack / special | **X** | Combat depth — M4 |
| Block / guard | **Left Ctrl** | Combat depth — M4 |
| Crouch | **C** | Platforming + crouch states — M4 |
| Pick up loot | **F** | Needs item drops — M5 |
| Inventory | **Tab** | Needs inventory system — M5 |
| Heal / potion | **R** | Needs consumables — M5 |
| Switch weapon (1 / 2) | **1 / 2** | Not needed for now — Khukuri *and* Guleli are both always available on their own keys |

## Combat-feel suggestions (recommended additions when we reach M4)

- **Jump buffering + coyote time** — press jump slightly before landing / just after
  leaving a ledge and it still fires. Makes platforming feel forgiving and pro.
- **Attack-move cancelling** — let the first hit of a combo cancel into a dodge,
  so combat flows instead of locking you in place.
- **Directional dodge i-frames already in** — pair with enemy *telegraphs* (wind-up
  flashes) so dodging well feels skillful and fair.
- **Charge attack** — hold **X** to charge the heavy for a knockback finisher.
- **Guleli (ranged)** — the name fits a slingshot secondary; **2** to swap, aim with
  movement facing, reuse the existing projectile system.
- **Hitstop on heavy hits** — a 2–4 frame freeze on the combo's second hit (lands in M1
  with the JuiceManager) makes strikes feel meaty.
