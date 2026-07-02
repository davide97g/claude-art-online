# Level Select + Biomes — Design

Date: 2026-07-02
Scope: Three.js `src/` version only (not Unity).

## Goal

Add a 3-floor level selector and turn Floors 2 and 3 into distinct, recognizable
biomes that still read as the same low-poly game: a **frostbound snowfield** (F2)
and **storm-wracked peaks** (F3). Each floor has a small sparse settlement plus
ruins, weather, and named places that announce themselves as the player arrives.

## Non-goals

- Boss / gate-clear progression (no boss exists yet — picker is free-choice).
- In-place level rebuild / scene teardown (switching floors reloads the page).
- New enemy *types* (Golem is retinted per biome; behavior unchanged).
- Multiplayer, saves, inventory (out of VISION scope).

## Core idea

A **biome is a config object**, not a code fork. One `biomes.js` data module drives
the existing terrain / town / lighting machinery. The world-build code stays single
and parameterized. Two new files, four edited.

```
NEW  src/world/biomes.js    — 3 biome config objects (pure data)
NEW  src/world/weather.js   — snow / rain+lightning particle layer
EDIT src/world/floor.js     — createFloor(scene, biome); terrain palette + amp from biome
EDIT src/world/town.js      — createTown(scene, getHeight, biome); settlement+ruins+scatter from biome
EDIT src/main.js            — read ?level=N → biome; apply lights/fog/bg; build enemies; drive weather + places
EDIT src/ui/hud.js          — enterPlace(name): update top-left + fire bottom badge
EDIT index.html             — 3-floor selector on start overlay; #place-badge element + CSS
NEW  public/assets/castle/  — Kenney Castle Kit GLBs (CC0) for ruins
```

## Biome config shape

```js
{
  id: 2,
  name: 'Floor 2',
  place0: 'Frosthollow',          // initial top-left subtitle + overlay label
  background: 0xcdd9e8,           // scene.background
  fog: { color: 0xbcccdd, near: 45, far: 150 },
  hemi: { sky: 0xdfeaf5, ground: 0x8a97a5, intensity: 0.85 },
  sun:  { color: 0xd6e2f0, intensity: 0.9, pos: [40, 80, 40] },
  terrain: { lo: 0x9fb2c4, hi: 0xeaf1f7, amp: 1.3, freq: 1.0 }, // vertex colors + height ruggedness
  sky: { ceiling: 0x9fb0c4, core: 0xb8c6d8 },
  tint: 0xcfd8e2,                 // multiply color applied to KayKit meshes (null = none)
  weather: 'snow',               // 'snow' | 'rain' | null
  trees: { style: 'bare', count: 90 }, // 'green' | 'bare' | 'dark'; scatter count
  rocks: { count: 90 },
  mountains: { count: 16 },
  settlement: [ ['home_A','green',6,26], ... ],   // [type,color,x,z] intact buildings
  ruins: [ ['wall_broken', 18, 40], ... ],        // Kenney pieces; placed sunk+tilted+dark
  places: [ { name:'Frosthollow', x:0, z:22, r:22 }, ... ],
  enemies: [ { type:'golem', x:14, z:-28 }, ... ], // dummies only on F1
}
```

`terrainHeight(x, z)` stays a **pure-signature export** but reads a module-scoped
`profile` (`{amp, freq}`) set once by `createFloor`. Single level per page load, so
module-level state is safe and keeps player/enemy/town callers unchanged.
`// ponytail: module-level profile, one level per page load`.

## The three biomes

| | **F1 Verdant Town** | **F2 Frostbound** | **F3 Storm Peaks** |
|---|---|---|---|
| Terrain color | greens `0x4e8c4a→0x8cc063` | blue-grey→snow `0x9fb2c4→0xeaf1f7` | dark stone→grey `0x4a4f57→0x7b8087` |
| Terrain amp/freq | 1.0 / 1.0 (rolling) | 1.3 / 1.0 (rolling drifts) | 2.6 / 1.6 (jagged peaks) |
| Background / fog | warm blue, soft far | pale icy blue, tighter | dark overcast, heavy near |
| Sun | warm `0xfff1d6` @1.25 | cool `0xd6e2f0` @0.9 | dim `0x9fb0c4` @0.7 |
| Mesh tint | none | cool desaturate `0xcfd8e2` | grey-dark `0x6b7280` |
| Weather | none | falling snow | rain + lightning flashes |
| Trees | green (A/B + clumps) | bare/cut, sparse | dark, wind-tinted, sparse |
| Settlement | full 15-bldg village | ~5-bldg hamlet | ~4-bldg outpost |
| Ruins | none | a few clusters | many (mostly ruins) |
| Enemies | 2 dummies + 5 golems | frost-tinted golems | storm-tinted golems |

Values are starting points; tuned live in the browser.

## Level selection (`?level=N` + overlay)

- `main.js` reads `?level=N` (default 1) → looks up biome → builds that world at load,
  exactly as today, just parameterized. No teardown.
- Start overlay (`index.html`) gains a **3-floor selector row**. Each floor is a small
  card/button showing its number + name. The **current** floor is highlighted and acts
  as "Link start" (locks pointer, starts music/fullscreen). The **other** floors are
  `<a href="?level=N">` — clicking reloads into that world.
- Picking a floor mid-game: press Esc (overlay returns), click a different floor → reload.

## Weather (`src/world/weather.js`)

`createWeather(scene, type, { sun, hemi })` → `{ update(dt, playerPos) }`.

- **snow** — ~800 `THREE.Points`, white, slow downward drift + slight sway. The particle
  box (~60³) recenters on the player's XZ each frame so a small buffer covers the whole map.
- **rain** — ~1200 points, elongated/fast downward. Plus **lightning**: on a periodic
  timer (driven off accumulated `dt`, not `Date.now`), briefly spike `scene.background`
  toward white and bump `sun.intensity`/`hemi.intensity` for a few frames, then ease back.
- **null** — no-op update.

Weather uses **real `dt`** (cosmetic, ignores hit-stop), consistent with the camera.
No audio (skipped; add later with the sound pass).

## Settlements + ruins (`town.js`)

- `createTown(scene, getHeight, biome)`:
  - Places `biome.settlement` intact buildings (KayKit), faced toward the cluster center.
  - Places `biome.ruins` via a new `placeRuin()` — extra sink + small random X/Z tilt +
    dark tint, ringed with a couple of rubble rocks — using **Kenney Castle Kit** pieces
    (broken walls, half towers, gates) from `public/assets/castle/`.
  - Scatters biome nature (`biome.trees`/`rocks`/`mountains`) with the existing instanced
    `scatter()` / `scatterRing()`, applying `biome.tint`.
  - `blocked()` / spawn-plaza clearing still applies so the player never spawns inside geometry.
- Tint is applied by cloning a mesh's material before multiplying `material.color`
  (avoids mutating the shared cached prototype — matters if we ever preview two biomes).
- `place()` gains an optional `tilt` param (radians on X/Z) used by `placeRuin()`.

### Asset acquisition — Kenney Castle Kit (CC0)

- Source: <https://kenney.nl/assets/castle-kit> — 75 models, **CC0**, GLB provided.
- During implementation: download the ZIP, copy the GLB(s) for broken walls / half towers /
  gate pieces into `public/assets/castle/`, add the license text (`KENNEY_LICENSE.txt`),
  and wire piece names into each biome's `ruins` list.
- Different artist than KayKit (Kay Lousberg), so silhouettes may drift. Both are flat-shaded
  low-poly; if the drift reads badly, **adapt in Blender** (re-flat-shade / recolor to the
  KayKit palette) per the `blender/` workflow. Loads degrade gracefully (log + skip) like all GLBs.

## Place-of-interest system

- Each biome has `places: [{ name, x, z, r }]` — named zones with a trigger radius.
- `main.js` loop: each frame, find the nearest place whose distance < its `r`. Track the
  active place; when it **changes**, call `hud.enterPlace(name)` (fires on transition only,
  never repeatedly while inside). Leaving all zones clears back to the biome's `place0`.
- Gate keeps its own separate "sealed" message (`setGateNear`) — the gate is also a named
  place ("The Sealed Gate") for the badge, but the two messages don't conflict.

Default place names:
- **F1**: Town of Beginnings · Elderwood Edge · The Sealed Gate
- **F2**: Frosthollow · The Frozen Wastes · Rime Ruins · The Sealed Gate
- **F3**: Stormwatch · The Thunder Reach · The Fallen Bastion · The Sealed Gate

### HUD (`hud.js` + `index.html`)

- **Top-left** (`#floor-label`): subtitle segment updates to the current place →
  `FLOOR 2 · FROSTHOLLOW`.
- **Bottom badge** (`#place-badge`, new): centered just above the control hint. Hidden by
  default. `enterPlace(name)` sets the text and adds a `.show` class → CSS opacity fades
  in, holds ~3.5s (JS timer), fades out. Style: letter-spaced uppercase, faint text glow,
  **no opaque background box** → non-invasive MMO zone-title feel. Re-entering the same
  zone does not re-trigger (guarded by the change check in `main.js`).

## Enemies

Reuse `Golem` with a per-biome tint (traverse + multiply emissive/base color) and biome
spawn positions; rename flavor only ("frost golem" / "storm golem"). F1 keeps the current
2 dummies + 5 golems. No new enemy class.

## Verification

No test runner. Verify by:
1. `bun run typecheck` clean.
2. `bun run dev`, load each of `?level=1`, `?level=2`, `?level=3`:
   - Correct palette / fog / lighting / weather for the floor.
   - Settlement + ruins present; player spawns clear of geometry.
   - Walking into each named zone updates the top-left label and pops the bottom badge
     once; badge fades out; re-entering the same zone from outside re-fires.
   - Selector row switches floors (reload) and highlights the current one.
   - Browser console clean apart from expected `[CAO] ... missing` fallbacks.
3. Confirm the game still runs with `public/assets/castle/` absent (graceful fallback).

## Open items / risks

- **Ruin style drift** (Kenney vs KayKit) → Blender re-shade fallback, decided after we see it.
- Terrain `amp/freq` for F3 peaks may need clamping so the player/enemies don't get stuck
  on steep faces (no physics — movement is height-follow). Tune live; cap slope if needed.
- Doc drift: update `README.md` / `VISION.md` floor descriptions in the same change.
