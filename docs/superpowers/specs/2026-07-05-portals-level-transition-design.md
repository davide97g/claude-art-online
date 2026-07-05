# Portals & Level Transition — Design

**Date:** 2026-07-05
**Status:** approved, pre-implementation

## Goal

After a floor's boss is defeated, its forward portal activates. Walking to a
portal and pressing **E** plays a transition animation, then loads the target
floor via the existing Link-start loading screen. Portals are two-way: every
floor has a **+1** (forward) and **−1** (back) portal, except Floor 1 (+1 only)
and Floor 5 (−1 only).

## Current state (what exists)

- One sealed gate at `GATE_POS (0,0,-120)` built inline in `src/world/floor.js`;
  `floor.openGate()` recolors it and spins the ring faster; `floor.gatePos`
  drives a proximity HUD hint; `floor.update(t)` animates it.
- Only Floor 1 defines `biome.boss`. `boss.onDeath` → `floor.openGate()` +
  `hud.setGateOpen()` + `hud.showClear()` + `progression.clearFloor(id)`.
- Levels load by reloading the page with `?level=N`; the "Link start" overlay
  **is** the loading screen (per-floor preview stack + progress bar).
  `progression` is localStorage-backed and survives reload; `isCleared(id)`
  tracks beaten floors.
- Player spawns at origin facing `+Z`; town sits at `+Z`; spawn plaza and the
  gate corridor are kept clear by `world/town.js`.

## Design

### 1. Two portals in `world/floor.js`

Refactor the inline gate mesh into a local `makePortal(pos, glowColor)` that
builds one portal group (two pillars + torus ring + translucent disc), grounded
via `terrainHeight`.

Build up to two portals from the biome id:

- **Forward (+1)** at `FORWARD_POS = GATE_POS (0,0,-120)`. Exists when
  `biome.id < 5`. `targetLevel = id + 1`. Starts **sealed** (`active = false`).
- **Back (−1)** at `BACK_POS = (-12, 0, 6)` (inside the always-clear spawn
  plaza, offset from the gate corridor and from the exact spawn point). Exists
  when `biome.id > 1`. `targetLevel = id - 1`. Starts **active** (`active =
  true`) — the way back is already cleared.

`createFloor(scene, biome)` returns:

```js
{
  portals: [ /* { dir: +1|-1, targetLevel, pos: Vector3, active: bool, _mesh } */ ],
  openForward(),   // set forward portal active=true + recolor/spin + ring pulse
  update(t),       // animate every portal (spin + shimmer; open=faster+gold) and floaters/water
}
```

The old `gatePos` / `openGate` exports are removed; `main.js` is the only
caller and is updated to the new shape. Existing sky/water/floater code in
`createFloor` is unchanged.

**Activation flourish:** `openForward()` keeps the current color-swap +
faster-spin, and adds one expanding-ring pulse (a torus that scales up and
fades over ~0.6s using the real clock passed into `update`).

### 2. Bosses on floors 2–4 (`world/biomes.js`)

Add `boss: { x: 0, z: -112 }` to floors **2, 3, 4** (same slot as Floor 1).
`main.js` already instantiates `KoboldLord` with `biome.enemyTint`, so each
floor's boss is retinted automatically. Floor 5 gets **no** boss and **no**
forward portal (last floor).

### 3. Wiring in `main.js`

- Replace `const floor = createFloor(...)` usage of `gatePos`/`openGate`.
- **On load:** if `progression.isCleared(biome.id)`, call `floor.openForward()`
  so a re-visited cleared floor has its forward portal already open.
- **On boss death:** `floor.openForward()` + `hud.showClear(...)` +
  `progression.clearFloor(id)` + a HUD "portal activated" line.
- **Each tick:** find the nearest portal within `PORTAL_RADIUS` (~6 units).
  - Active portal near → `hud.showPortalPrompt('Press E · Floor N')`.
  - Sealed forward portal near → `hud.showPortalPrompt('Defeat the boss')`.
  - None near → `hud.showPortalPrompt(null)`.
- **Travel:** on `keydown` `KeyE` while near an active portal, and not already
  transitioning, start the transition to that portal's `targetLevel`.
  A module-level `transitioning` guard ensures it fires once.

### 4. Transition animation → loading screen

State lives in `main.js` (`transitioning`, `transT`, `transPortal`,
`transTarget`). When triggered:

1. Set `transitioning = true`; ignore further input (skip
   `player.update` / `blade.update`, drop buffered attacks — mirrors the
   `bossIntro.blocking` branch).
2. Over ~1.1s of **real `dt`**: ease `camera.position` toward the portal's
   `pos` and raise `camera.fov` (`updateProjectionMatrix`) for a dolly-in feel.
3. A CSS overlay `#portal-fade` (added to `index.html`) transitions from
   transparent to the portal's glow color with a radial-bloom + blur,
   triggered by adding a `.go` class at step 1.
4. When `transT` elapses → `location.assign('?level=' + transTarget)`.

The reload shows the existing Link-start loading screen with the target floor's
preview; the player clicks "Enter Aincrad" to spawn (which also re-acquires the
required pointer-lock gesture). No new loading-screen code.

`#portal-fade` CSS goes in the same stylesheet as the loading overlay
(`index.html` inline styles): a fixed full-screen div, `opacity:0` →
`.go` animates `opacity:1` + a `radial-gradient` glow scaling up, ~1.1s ease.

### 5. HUD (`ui/hud.js`)

Add `showPortalPrompt(text | null)`: sets the existing `#gate-msg` element's
text + fades it in/out (opacity 1 when text, 0 when null). Remove the now-unused
`setGateNear`/`setGateOpen` (replaced by `showPortalPrompt` and the flourish).
`showClear` is unchanged.

### 6. Version

Minor bump in `package.json` (`0.10.0` → `0.11.0`) — new system — in the same
commit as the work. `main.js` renders it automatically.

## Out of scope (YAGNI, add if play reveals need)

- In-place scene swap (no reload) — reload reuses the whole loading screen.
- Spawning next to the arrival portal — always spawn at origin.
- Per-biome portal-position config — module-level `FORWARD_POS`/`BACK_POS`
  defaults are fine; both are in always-clear zones.
- Floor 5 finale boss — Floor 5 is currently a dead-end terminus.

## Verification

No test runner. After implementing:

1. `bun run typecheck` clean.
2. `bun run dev`, load `?level=2`: back portal present + active near spawn;
   forward portal sealed until the boss dies.
3. Kill the boss → forward portal recolors/pulses; HUD shows the prompt near it.
4. Press E at the forward portal → transition plays → reload shows Floor 3's
   loading screen. Press E at the back portal → Floor 1.
5. `?level=1`: no back portal. `?level=5`: no forward portal, no boss.
6. Re-visit a cleared floor (`isCleared`) → forward portal already open.
