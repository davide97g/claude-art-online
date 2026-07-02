# Floors 4 & 5 — The Elderwood & Craghold

**Date:** 2026-07-02
**Status:** Design — awaiting review

## Goal

Add two floors to the biome ladder (currently 3), staying inside the "biomes are
data, not code forks" architecture:

- **Floor 4 — The Elderwood:** a deep, ancient forest — dense multi-species trees,
  mountains ringing the map, a river cutting through the valley floor.
- **Floor 5 — Craghold:** a vibrant, huge medieval city inspired by Edinburgh — a
  castle on a rock crag, a central "Royal Mile" spine street lined with dense
  tenement buildings.

## Scope decisions (recommended defaults; confirm on review)

1. **Reuse the packs already on disk.** KayKit Medieval Hexagon (two tree families
   in three sizes, mountains, hills, five rock types, the full medieval building
   set in three palettes) + Kenney Castle Kit cover the brief. No new downloads,
   no custom modeling. The only genuinely-new code is per-biome terrain shapes and
   a water surface for the river.
2. **Both floors are combat floors** keeping the existing convention: a sealed boss
   gate at `z = -120` and tinted golems in the `-Z` corridor. The city/forest is the
   hub you spawn into at `+Z`.
3. **Rivers get a real water surface:** the terrain height function carves a channel;
   `floor.js` lays a translucent, gently-animated water ribbon in it.

## Architecture — what changes and why

The biome system already routes all per-floor variation through data read by
`floor.js`, `town.js`, `weather.js`, and `main.js`. Four small seams are added so
floors 4 & 5 can be expressed as data too.

### 1. `world/biomes.js`
- Two new config objects (`id: 4`, `id: 5`) appended to `BIOMES`.
- `getBiome` clamp changes from hard-coded `3` to `BIOMES.length`:
  ```js
  const n = Math.min(BIOMES.length, Math.max(1, parseInt(param, 10) || 1));
  ```
- New optional config fields (all ignored by floors 1-3, which omit them):
  - `terrain.shape`: `'rolling'` (default) | `'valley'` | `'crag'`
  - `terrain.crag`: `{ x, z, height, radius }` (crag shape only)
  - `river`: `{ path: [{x,z}, ...], width, depth, level, color }`
  - `city`: `{ spineZ: [z0,z1], halfWidth, step, rows, jitter, palette, types, castle }`
  - `flags`: extended from `false|true` to also accept `'spine'`

### 2. `world/floor.js` — terrain shapes + water
`terrainHeight(x, z)` stays a pure export used by player/enemies/props. The
module-level `PROFILE` gains `shape` and `crag`; a module-level `RIVER` holds the
carve data (same mutable-module-state pattern already used for amp/freq — one
level per page load).

```
h = baseSine(x,z) * flatAroundSpawn * amp        // unchanged floors 1-3
shape 'valley':  h += smoothstep(30, 90, |x|) * 22      // side mountain walls, walkable floor
shape 'crag':    h += crag.height * exp(-dc² / 2·radius²)  // Gaussian bump at castle
river (any):     h -= riverDepth(x,z)            // trench along the polyline
```

`riverDepth` = distance to the nearest river segment, `smoothstep`ed from `width`
(→0) to `width*0.35` (→full `depth`). Segment count is small (≤8), so the per-vertex
cost at mesh build and per-frame grounding cost stay negligible.

`createFloor` builds the **water ribbon** when `biome.river` is present: for each
polyline segment, two edge vertices offset ±`width/2` perpendicular, at constant
`y = river.level`. Translucent `MeshBasicMaterial` (blue-green, `depthWrite:false`),
plus a small repeating ripple `CanvasTexture` whose `offset` scrolls along flow in
`floor.update` for a gentle current. Returned from `createFloor` and animated with
real `t` (cosmetic, like the portal ring).

> ponytail: constant water `level` across the ribbon — correct on the near-flat
> valley floor; would need per-segment levels if a river ran over steep terrain.

### 3. `world/town.js` — city street generator
When `biome.city` is present, place buildings along the spine instead of relying
only on hand-placed `settlement`:

- Two rows per side (inner `x = ±halfWidth`, outer `x = ±(halfWidth+8)`), stepping
  every `step` units from `spineZ[0]` to `spineZ[1]`, with `±jitter` seeded offset.
- Each building: random `type` from `city.types` and `color` from `city.palette`
  (three palettes mixed → the "vibrant" look), faced toward the street center
  (`x = 0`) via the existing `facePlaza`-style helper.
- The castle: `city.castle` placed on the crag (`terrainHeight` lifts it), extra sink.
- `flags: 'spine'` routes the existing banner logic along the +Z spine center.

`settlement`, `props`, `ruins`, `trees`, `rocks`, `mountains`, `clouds` continue to
work unchanged — floor 4 uses `settlement`/`ruins` for a small overgrown camp; floor
5 leaves `settlement` empty and lets `city` do the placement.

### 4. `world/weather.js` — pollen
One new row in the `TYPES` table:
```js
pollen: { count: 500, color: 0xd8c079, size: 0.13, fall: 1.2, drift: 3, sway: 1.4, swayAxis: 0, lightning: false },
```
Slow golden motes drifting — sells "ancient forest air". Reuses the existing
player-following particle box; driven by real `dt` like the other types.

### 5. `main.js` + `index.html` — level select
- `index.html`: add two `<a class="floor" data-level="4|5">` rows (roman `IV`, `V`)
  to `#floor-select`.
- `main.js`: extend the preload / tagline loops from `[1,2,3]` to `[1,2,3,4,5]`.
- Loading-screen preview JPGs for floors 4/5 (`public/assets/loading/floor4|5/*.jpg`)
  do not exist yet. The Ken Burns background simply stays blank for those until the
  existing trailer/loading capture harness generates them — no error, fully playable.

## Floor 4 — The Elderwood (concrete config)

| Field | Value |
|---|---|
| name / place0 | `The Elderwood` / `Heart of the ancient wood` |
| background | `0x2f4a3a` deep misty green |
| fog | `{ color: 0x35513f, near: 26, far: 105 }` — tight, dense canopy |
| hemi | `{ sky: 0x9fc7a0, ground: 0x24301f, intensity: 0.7 }` |
| sun | `{ color: 0xffe6a8, intensity: 0.95, pos: [50, 70, -40] }` — warm, low, dappled |
| terrain | `{ lo: 0x2c3d24, hi: 0x5f8544, amp: 1.6, freq: 1.2, shape: 'valley' }` |
| sky | `{ ceiling: 0x3a5240, core: 0x557a4f }` |
| tint / enemyTint | `0x8fae86` mossy / `0x6f9e5a` |
| weather | `pollen` |
| mountains | `mountain_A/B/C_grass_trees`, `hills_A/B_trees` (tree-clad) |

**Trees (dense, ~280 instanced):** `trees_A_large` 40, `trees_B_large` 40,
`trees_A_medium` 55, `trees_B_medium` 55, `tree_single_A` 45, `tree_single_B` 45 —
both families at multiple sizes gives species variety.

**Rocks:** `rock_single_A` 30, `rock_single_C` 25 (mossy, tinted).

**River:** one S-curve polyline crossing the valley floor and avoiding the spawn
plaza + gate corridor, e.g. `[(-60,42),(-24,20),(8,-12),(-4,-52),(26,-96)]`,
`width: 7, depth: 3, level: -0.6, color: 0x3f6b6a`.

**Settlement (small overgrown woodcutter's camp, mossy-tinted):** `lumbermill`,
two `home_A/B`, a `well` — a handful, not a town.

**Ruins:** 2-3 Kenney `wall` / `wall-corner` pieces, sunk and overgrown.

**Places:** `The Elderwood` (spawn), `Mistfen Hollow`, `The Old River`, `The Sealed Gate`.

**Enemies:** tinted golems in the `-Z` corridor, mirroring floor 3's layout.

## Floor 5 — Craghold (concrete config)

| Field | Value |
|---|---|
| name / place0 | `Craghold` / `Gates of the high city` |
| background | `0x9fc8ea` bright blue |
| fog | `{ color: 0xbcd4ea, near: 70, far: 220 }` — open, see the whole city |
| hemi | `{ sky: 0xdcecff, ground: 0x6b6152, intensity: 1.0 }` |
| sun | `{ color: 0xfff3d6, intensity: 1.3, pos: [70, 95, 40] }` — bright midday |
| terrain | `{ lo: 0x6f6656, hi: 0xb8ae95, amp: 1.0, freq: 1.0, shape: 'crag', crag: { x: 0, z: 95, height: 20, radius: 26 } }` |
| sky | `{ ceiling: 0x8aa6c8, core: 0xa8c0dc }` |
| tint / enemyTint | `null` (vibrant, no wash) / `0x9aa0a8` stony |
| weather | `null` |
| mountains | `mountain_A/B/C`, `hills_A/B` (bare rocky ring) |

**City block:**
```js
city: {
  spineZ: [16, 82], halfWidth: 11, step: 7, rows: 2, jitter: 2.2,
  palette: ['green', 'red', 'yellow'],
  types: ['home_A', 'home_B', 'tavern', 'market', 'blacksmith', 'church', 'barracks', 'tower_A', 'tower_B'],
  castle: { type: 'castle', color: 'yellow', x: 0, z: 95 },
}
```
≈ 9 steps × 2 sides × 2 rows ≈ 36 buildings + the castle on the crag.

**Trees:** sparse ornamental only — `tree_single_A` 12, `tree_single_B` 10 around
the outskirts.

**Rocks:** `rock_single_A/B` at the crag base (18) to seat the castle rock.

**Props:** market `crate_A_big`, `barrel`, `weaponrack`, `target`, a `well` along the mile.

**Flags:** `'spine'` — banners down the Royal Mile.

**Places:** `Grassmarket` (spawn plaza), `The Royal Mile`, `Castle Rock`, `The Sealed Gate`.

**Enemies:** tinted golems in the `-Z` corridor, per convention.

## What is deliberately NOT in scope

- No new enemy type — golems reuse the per-biome tint path (consistent with floors 2-3).
- No custom-modeled hero pieces (castle/ancient tree) — composed from packs.
- No per-segment river water levels, no water shader — flat translucent ribbon + UV scroll.
- No loading-screen preview capture — the harness does that separately; blank until then.

## Verification plan

- `bun run typecheck` clean.
- `bun run dev`, load `?level=4` and `?level=5`; watch `[CAO]` console for missing-model
  fallbacks (should be none for on-disk assets).
- Floor 4: river reads as water in a channel; forest is dense; pollen drifts; golems fight.
- Floor 5: castle sits on the crag; Royal Mile is lined and faced inward; palettes mixed;
  gate + golems present.
- Confirm floors 1-3 are visually unchanged (shape defaults to `'rolling'`, no river/city).
