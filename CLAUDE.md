# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-player 3D browser action game inspired by Sword Art Online's Aincrad. Read `VISION.md` for tone/art-direction/scope; it is the design contract. Core rule from it: **ship a rung of the scope ladder before climbing** — 3 floors, not 100; one satisfying enemy beats ten mediocre ones.

## Implementation

**`src/` — Three.js + Vite (vanilla JS + TypeScript, ES modules).** This is what `package.json`/`index.html` run. (A Unity 6.x gray-box port lived in `unity/` earlier; it was dropped — the Three.js version is the game.)

## Commands

Package manager is **bun** (`bun.lock` is the committed lockfile; `npm` also works — scripts are runtime-agnostic):

```bash
bun install
bun run dev       # vite dev server; open the printed localhost URL, click "Link start"
bun run build     # vite build → dist/
bun run preview   # serve the built dist/
```

No test runner, no linter. `bun run typecheck` (`tsc --noEmit`) is the one static check — Vite transpiles TS but does **not** typecheck, so run this yourself before claiming a change is sound. `tsconfig.json` has `allowJs: true` / `checkJs: false`: existing `.js` runs untouched, new `.ts` files get strict checking, migrate file-by-file. Verify runtime changes by loading the dev server and watching the browser console (all runtime logs are prefixed `[CAO]`). The `src/combat/` actors are TypeScript (`.ts`) and share the `Enemy` contract in `combat/types.ts`; the rest of `src/` is still `.js`, migrating file-by-file.

## Versioning — bump on every commit

`package.json` `version` is the single source of truth for the game version. `main.js` imports it and renders it as a small `v0.1.0` hint at the bottom-left of the HUD (`#version` in `index.html`). **Before committing any work — large or small — bump the version** (edit `package.json`, no tooling needed), choosing the semver level by what changed:
- **patch** (`0.1.0` → `0.1.1`) — fixes, tweaks, docs, small polish.
- **minor** (`0.1.0` → `0.2.0`) — a new feature, floor, enemy, or system.
- **major** (`0.1.0` → `1.0.0`) — a big milestone or breaking rework of the game.

The bump goes in the same commit as the work, so the on-screen version always matches what's running.

## Three.js architecture (the parts that span files)

`src/main.js` is the only orchestrator: it builds the renderer/scene/lights, owns the input object and the game loop, and wires every system together. Everything else is a class it instantiates.

**Hit-stop is a shared clock, and `sdt` vs `dt` is load-bearing.** `main.js` owns a `world` object with `timeScale` (dips to 0.07 on impact via `world.hitStop(dur)`, eases back to 1). Each frame it computes `sdt = dt * world.timeScale` and passes **both** to actors:
- `sdt` (scaled) drives **gameplay** — movement, swing progress, enemy state timers. Freezes during hit-stop → that's the game-feel punch.
- `dt` (real) drives things that must ignore hit-stop — camera easing, animation-mixer updates, cosmetic decays.
Mixing these up silently breaks hit-stop or desyncs the camera. When adding an actor, mirror the existing `update(sdt, dt, ...)` signatures.

**Enemy contract.** Every enemy (`combat/dummy.ts`, `combat/golem.ts`) implements the `Enemy` interface in `combat/types.ts`: `pos` (Vector3), `alive` (boolean), `update(sdt, camera)`, and `takeHit(dmg, dir)`. `Blade.resolveHit` iterates the `enemies` array from `main.js` and calls `takeHit`; enemies that attack call `player.takeDamage(dmg, dir)` back. To add an enemy type, implement that shape and push it into the `enemies` array in `main.js`. Golem is the reference for stateful AI (idle→chase→windup→strike→recover→stagger, animated by rotating named model parts, not a skeleton).

**Terrain is analytic, not raycast.** `world/floor.js` exports `terrainHeight(x, z)` — a pure function. The ground mesh, the player, every enemy, and every scattered prop all call it to sit on the ground. There is no physics/raycasting. If you change the height function, everything follows automatically; never hardcode Y positions for grounded things.

**GLB loading degrades gracefully — never assume a model is present.** Every `GLTFLoader.load` has an error callback that logs `[CAO] ... missing` and continues with a gray-box primitive (capsule player, icosahedron golem, box sword). The game is fully playable with zero GLBs. Preserve this: new model loads must keep a working fallback and must not block the loop on `await`.

**Floor population lives in `world/town.js`, not `floor.js`.** `floor.js` now owns terrain + two travel portals (forward `+1` sealed until the boss dies, back `-1` open) + sky; `town.js` places everything on top of it (KayKit town buildings, instanced forest, rocks, distant hill/mountain silhouettes, props, flags) and is called from `main.js` right after `createFloor`. It loads the **KayKit Medieval Hexagon Pack** from `public/assets/kaykit/` — these are `.gltf` (+ `.bin` + a co-located `hexagons_medieval.png` atlas per folder), *not* the self-contained `.glb`s in `models/`, so keep each `.gltf` beside its texture when moving files. KayKit hex units are tiny (a house ≈0.9 tall); `town.js`'s `SCALE` (~4.2) brings them to the player's world scale, and model origins sit at the base so placing at `terrainHeight(x,z)` grounds them. Layout uses a seeded RNG (stable across reloads) and keeps the spawn plaza + gate corridor clear via `blocked()`. Note: the player spawns facing **+Z (into the town)**; the sealed gate is behind them at `-Z` (the `floor.js` comment saying "face −Z" predates this — `forward()` at `yaw=π` is `+Z`).

**Biomes are data, not code forks.** The 12 floors (Verdant Town / Frostbound / Storm Peaks / The Elderwood / Craghold, then 7 real-world-inspired floors: Cliffhold=Civita, The Bastion=Carcassonne, Rivenbend=Český Krumlov, The Silent City=Mdina, Sanctuary Rise=Rocamadour, Tidewatch Abbey=Mont-Saint-Michel, Stillmere=Hallstatt) are configs in `world/biomes.js` (`getBiome`), selected via `?level=N` on the loading screen (`index.html` `#floor-select` lists them). `terrainHeight` (`floor.js`) switches on `terrain.shape` (`rolling` default, `valley`, `crag` — crags double as vertical cliff-village layouts by placing settlements at rising z); an optional `biome.river` carves a channel and `floor.js` lays an animated water ribbon (also used as lake/moat rings, e.g. Stillmere/Tidewatch); an optional `biome.city` drives the `world/citylayout.js` generator, which switches on `city.layout` for per-town topology (`spine` default/Royal Mile, `rings` for concentric wards, `cluster` for packed disks, `terraces`/`spiral` for cliff-climbing towns, `shore` for lakeside rows — all keep the spawn corridor clear except spine; `node test/citylayout.mjs` checks it). NPCs (`world/npc.js`): `biome.npc` (number) overrides crowd size, `biome.npcRoster` (array of model keys from `NPC_MODELS`) picks the per-floor cast, and the crowd spawns near `city.center` (or the plaza/spine) so it lands where the buildings are. Weather (snow / rain+lightning / wind / pollen) lives in `world/weather.js`, driven by real `dt`; foggy floors just crank `biome.fog`. Per-floor music is one loop hard-coded in `main.js` (`bards_tale.mp3` placeholder); the per-floor score design (mood/style/Suno prompts + intended `public/assets/audio/floorN_*.mp3` filenames, wired by `biome.id`) lives in `SOUNDTRACK.md`.

## Asset ↔ code coupling (easy to break silently)

Code reaches into GLBs by **node name and material name**. Changing these in Blender without updating code breaks features with no error:
- `knight.glb`: player keeps node `1H_Sword` in-hand and hides a named armory list (`2H_Sword`, shields, etc.); animation clips are matched by regex on clip name (`idle`, `running_a`, `1h*slice_horizontal/diagonal`, `1h*chop`).
- `golem.glb`: code animates parts named `Body`/`ArmL`/`ArmR`; eyes must use material named **`CAO_GolemEye`** (code flares its `emissiveIntensity` as the attack telegraph).
- custom `sword.glb`: the glowing edge must use material named **`CAO_EdgeGlow`**.
- landmark trees: root child named `TreeRoot*` gets its offset zeroed on load.

## Blender workflow

`blender/` holds Python (`bpy`) scripts Claude writes to generate hero-piece models; Davide follows in the Blender UI (MCP add-on when connected). Art rules (from `VISION.md`/`blender/README.md`): **low-poly, flat-shaded, vertex colors or flat materials, no PBR textures.** Custom modeling is reserved for hero pieces (sword, boss, gate); everything generic comes from CC0 packs (Kenney/Quaternius/KayKit). Export GLB → `public/assets/models/`, then wire it in (respecting the naming coupling above).

**Driving Blender from Claude Code (no MCP tool needed).** Davide runs the **official Blender MCP extension** ("MCP" by Blender Lab, v1.0.0) — it listens on a TCP socket at `localhost:9876`, *not* the ahujasid add-on in `blender/blender_mcp_addon.py` (that one is a different protocol and unused). Claude Code doesn't have this server registered as an MCP tool, so talk to the socket directly from Bash with a tiny Python client. Wire protocol: **null-byte-terminated JSON**, request `{"type":"execute","code":"<python>","strict_json":false}\0`. The code runs in a namespace preloaded with only `result = {}` — **you must `import bpy` yourself** (it is *not* injected) — set `result` to a JSON-serializable dict and/or `print()` (captured as `stdout`). Response is null-terminated JSON: `{"status":"ok","result":...,"stdout":...}` or `{"status":"error","message":<traceback>,...}`. There is **no** `get_viewport_screenshot`/`get_scene_info` command — everything goes through `execute`, so screenshot by running bpy that renders to a PNG file, then read that file. Requirement: Blender must be running with the extension's **"Server is running"** (Preferences → Add-ons → MCP; Auto Start on). The reusable client is committed at `blender/blender_client.py` (`python3 blender/blender_client.py exec <script.py>`), and the parametric townsfolk builder + its plan live at `blender/npc_build.py` / `blender/NPC_PLAN.md`.

## Doc drift — code is the source of truth

The Three.js combat has moved past what `README.md`/`VISION.md` describe. Those still say "RMB blade stance + mouse-swipe to slash" (Pointer Lock swipe gestures). The **actual `src/` combat is left-click slash** with a random swing variation and buffered clicks that chain into combos (`combat/blade.ts`, `index.html` hint). If you touch combat, trust the code over the prose, and update the docs in the same change.
