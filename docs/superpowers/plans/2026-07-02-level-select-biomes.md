# Level Select + Biomes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-floor level picker and turn Floors 2 and 3 into distinct, recognizable biomes (frostbound snowfield, storm peaks) — each with its own palette, weather, sparse settlement, ruins, and named places that announce on arrival.

**Architecture:** A biome is a **data config**, not a code fork. One new `biomes.js` drives the existing terrain/town/lighting machinery, which becomes parameterized. Floor is chosen via `?level=N` (picking reloads — no scene teardown). Two new files (`biomes.js`, `weather.js`), five edited (`floor.js`, `town.js`, `main.js`, `hud.js`, `index.html`).

**Tech Stack:** Three.js + Vite, vanilla ES modules, `bun`. Shared `GLTFLoader` via `src/loading.js`. KayKit `.gltf` assets + Kenney Castle Kit `.glb` for ruins.

## Global Constraints

- **No test runner / no linter exists.** The one static check is `bun run typecheck` (`tsc --noEmit`) — run it after every task. Runtime verification is `bun run dev` + loading the printed localhost URL + watching the browser console (all runtime logs prefixed `[CAO]`). Adapt the TDD "test" steps below to: implement → typecheck → dev-server visual/console check → commit.
- **GLB/GLTF loads must degrade gracefully** — every `.load` keeps an error callback that logs `[CAO] ... missing` and continues; the game must be fully playable with zero models present. Never `await`-block the loop on a model.
- **`sdt` vs `dt`:** gameplay uses scaled `sdt`; cosmetic/camera-tier things use real `dt`. **Weather uses `dt`** (ignores hit-stop, like the camera).
- **Terrain is analytic:** everything grounded calls `terrainHeight(x,z)`. Never hardcode Y for grounded objects.
- **Art direction:** low-poly, flat-shaded, vertex colors / flat materials, no PBR. Keep silhouettes coherent; recolor via material color-multiply.
- **Player spawns at `(0,0,8)` facing +Z** (town side); gate is behind at `z=-120`. `blocked()` in `town.js` keeps `|x|<9 && z<14` (spawn + gate corridor) clear — every biome must keep the spawn plaza clear of geometry.
- **Commit only these changes per task** with the exact `git add` paths shown. Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/world/biomes.js` (new) | Pure data: 3 biome configs + `getBiome(param)`. Single source of per-floor truth. |
| `src/world/weather.js` (new) | Player-following particle weather (snow / rain+lightning); no-op for null. |
| `src/world/floor.js` (edit) | `createFloor(scene, biome)`; module `PROFILE` so `terrainHeight` varies amp/freq per biome; palette + sky tints from biome. |
| `src/world/town.js` (edit) | `createTown(scene, getHeight, biome)`: generic renderer of settlement / props / flags / scatter / ruins / mountains / clouds from biome config; per-biome tint; Kenney `.glb` ruins loader; `placeRuin()`. |
| `src/main.js` (edit) | Read `?level=N` → biome; apply bg/fog/hemi/sun; build enemies from `biome.enemies`; drive weather + place detection; wire loading-screen selector. |
| `src/ui/hud.js` (edit) | `setFloor(floorName, place0)` + `enterPlace(name)` (top-left label + bottom badge). |
| `index.html` (edit) | `#place-badge` element + CSS; floor selector row in the loading overlay + CSS. |
| `public/assets/castle/` (new) | Kenney Castle Kit `.glb` ruin pieces (CC0) + `KENNEY_LICENSE.txt`. |

---

## Task 1: Biome config + parameterized terrain, lighting & enemy roster

**Files:**
- Create: `src/world/biomes.js`
- Modify: `src/world/floor.js` (terrain profile + `createFloor` signature)
- Modify: `src/main.js:19-34` (bg/fog/hemi/sun), `:135-152` (build from biome)

**Interfaces:**
- Produces: `BIOMES` (array, index 0..2), `getBiome(param) → biome`. Biome shape (all fields defined now, some consumed by later tasks):
  `{ id, name, place0, background, fog:{color,near,far}, hemi:{sky,ground,intensity}, sun:{color,intensity,pos:[x,y,z]}, terrain:{lo,hi,amp,freq}, sky:{ceiling,core}, tint, weather, trees:[{path,count,sMin,sMax}], rocks:[{path,count,sMin,sMax}], mountains:[names], clouds, settlement:[[type,color,x,z]], props:[[name,x,z]], flags:bool, ruins:[{name,x,z}], places:[{name,x,z,r}], enemies:[{type,x,z}] }`
- Produces: `createFloor(scene, biome)` (was `createFloor(scene)`); `terrainHeight(x,z)` signature unchanged.
- Consumes: nothing (first task).

- [ ] **Step 1: Create `src/world/biomes.js`**

```js
// Per-floor biome configs. A biome is DATA, not a code fork: floor.js, town.js and
// main.js read these to build terrain, lighting, weather, settlements, ruins and
// named places. Add a floor by adding a config — no new code paths.

export const BIOMES = [
  { // ---------- Floor 1: Verdant Town (the existing world, unchanged) ----------
    id: 1,
    name: 'Verdant Town',
    place0: 'Starting town outskirts',
    background: 0x9dc2ec,
    fog: { color: 0x9db8d9, near: 60, far: 175 },
    hemi: { sky: 0xcfe5ff, ground: 0x5b7a4a, intensity: 0.95 },
    sun: { color: 0xfff1d6, intensity: 1.25, pos: [60, 90, 30] },
    terrain: { lo: 0x4e8c4a, hi: 0x8cc063, amp: 1.0, freq: 1.0 },
    sky: { ceiling: 0x7e94b5, core: 0x93a7c4 },
    tint: null,
    weather: null,
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 120, sMin: 0.8, sMax: 1.5 },
      { path: 'decoration/nature/tree_single_B', count: 100, sMin: 0.8, sMax: 1.5 },
      { path: 'decoration/nature/trees_A_large', count: 18, sMin: 0.9, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 40, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 25, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees',
      'hills_A_trees', 'hills_B_trees', 'hills_C_trees'],
    clouds: 6,
    settlement: [
      ['church', 'green', -24, 27], ['tower_A', 'red', 0, 52], ['tavern', 'yellow', 23, 14],
      ['market', 'red', 15, 8], ['blacksmith', 'green', -18, 10], ['well', 'green', -6, 20],
      ['home_A', 'red', -12, 25], ['home_B', 'yellow', -23, 39], ['home_A', 'green', 13, 27],
      ['home_B', 'red', 21, 35], ['home_A', 'yellow', -31, 21], ['home_B', 'green', 27, 24],
      ['windmill', 'green', 33, 43], ['watermill', 'yellow', -34, 44], ['barracks', 'red', -17, 48],
    ],
    props: [
      ['barrel', -16, 12], ['barrel', -19, 13], ['bucket_water', -7, 17], ['sack', 2, 24],
      ['sack', -3, 26], ['crate_A_big', 13, 11], ['crate_B_small', 16, 10], ['crate_open', 12, 6],
      ['weaponrack', -15, 46], ['target', -20, 49], ['wheelbarrow', 5, 18], ['tent', 29, 30],
      ['tent', -29, 33], ['resource_lumber', -36, 47], ['resource_stone', 36, 40], ['ladder', 25, 20],
    ],
    flags: true,
    ruins: [],
    places: [
      { name: 'Town of Beginnings', x: 0, z: 22, r: 24 },
      { name: 'Elderwood Edge', x: 0, z: 72, r: 26 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'dummy', x: 5, z: -9 }, { type: 'dummy', x: -7, z: -14 },
      { type: 'golem', x: 14, z: -28 }, { type: 'golem', x: -18, z: -42 },
      { type: 'golem', x: 8, z: -66 }, { type: 'golem', x: -10, z: -88 },
      { type: 'golem', x: 20, z: -102 },
    ],
  },

  { // ---------- Floor 2: Frostbound (snowfield) ----------
    id: 2,
    name: 'Frostbound',
    place0: 'The frozen reaches',
    background: 0xcdd9e8,
    fog: { color: 0xbcccdd, near: 45, far: 150 },
    hemi: { sky: 0xdfeaf5, ground: 0x8a97a5, intensity: 0.85 },
    sun: { color: 0xd6e2f0, intensity: 0.9, pos: [40, 80, 40] },
    terrain: { lo: 0x9fb2c4, hi: 0xeaf1f7, amp: 1.3, freq: 1.0 },
    sky: { ceiling: 0x9fb0c4, core: 0xb8c6d8 },
    tint: 0xcfd8e2,
    weather: 'snow',
    trees: [
      { path: 'decoration/nature/tree_single_A_cut', count: 40, sMin: 0.8, sMax: 1.3 },
      { path: 'decoration/nature/tree_single_B_cut', count: 30, sMin: 0.8, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 55, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 35, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B', 'hills_C'],
    clouds: 4,
    settlement: [
      ['home_A', 'red', 10, 30], ['home_B', 'green', -12, 34], ['tavern', 'yellow', 18, 42],
      ['well', 'green', -4, 26], ['church', 'green', -20, 46],
    ],
    props: [
      ['barrel', 8, 28], ['crate_A_big', -10, 30], ['tent', 20, 38], ['resource_lumber', -18, 42],
    ],
    flags: false,
    ruins: [ // Kenney Castle Kit piece names — reconcile with actual filenames in Task 4
      { name: 'wall', x: 34, z: -8 }, { name: 'wall-corner', x: 38, z: -4 },
      { name: 'tower', x: -40, z: -20 }, { name: 'wall', x: -36, z: -24 },
      { name: 'gate', x: 12, z: -70 }, { name: 'tower', x: -22, z: -95 },
    ],
    places: [
      { name: 'Frosthollow', x: 6, z: 34, r: 26 },
      { name: 'The Frozen Wastes', x: 0, z: -40, r: 34 },
      { name: 'Rime Ruins', x: 36, z: -6, r: 22 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -22 }, { type: 'golem', x: -16, z: -40 },
      { type: 'golem', x: 6, z: -64 }, { type: 'golem', x: -8, z: -90 },
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },

  { // ---------- Floor 3: Storm Peaks ----------
    id: 3,
    name: 'Storm Peaks',
    place0: 'Storm-wracked heights',
    background: 0x3f4654,
    fog: { color: 0x4a5260, near: 35, far: 130 },
    hemi: { sky: 0x5a6472, ground: 0x2e333c, intensity: 0.6 },
    sun: { color: 0x9fb0c4, intensity: 0.7, pos: [20, 70, 50] },
    terrain: { lo: 0x4a4f57, hi: 0x7b8087, amp: 2.6, freq: 1.6 },
    sky: { ceiling: 0x3a414e, core: 0x525b6a },
    tint: 0x6b7280,
    weather: 'rain',
    trees: [
      { path: 'decoration/nature/tree_single_A_cut', count: 24, sMin: 0.7, sMax: 1.1 },
      { path: 'decoration/nature/tree_single_B_cut', count: 20, sMin: 0.7, sMax: 1.1 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 60, sMin: 2, sMax: 7 },
      { path: 'decoration/nature/rock_single_C', count: 40, sMin: 2, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B', 'hills_C'],
    clouds: 8,
    settlement: [
      ['tower_A', 'red', 8, 32], ['barracks', 'green', -14, 36], ['home_A', 'red', 16, 40],
      ['well', 'green', -4, 28],
    ],
    props: [
      ['weaponrack', 6, 30], ['target', -10, 34], ['crate_A_big', 14, 38], ['barrel', -6, 30],
    ],
    flags: false,
    ruins: [ // mostly ruins on the top floor
      { name: 'wall', x: 30, z: -6 }, { name: 'wall-corner', x: 34, z: -2 },
      { name: 'tower', x: 26, z: -12 }, { name: 'wall', x: -32, z: -18 },
      { name: 'tower', x: -36, z: -22 }, { name: 'gate', x: -28, z: -14 },
      { name: 'wall', x: 8, z: -56 }, { name: 'tower', x: -10, z: -78 },
      { name: 'wall-corner', x: 18, z: -94 }, { name: 'wall', x: -20, z: -100 },
      { name: 'tower', x: 24, z: -108 }, { name: 'gate', x: 0, z: -70 },
    ],
    places: [
      { name: 'Stormwatch', x: 6, z: 34, r: 24 },
      { name: 'The Thunder Reach', x: 0, z: -44, r: 36 },
      { name: 'The Fallen Bastion', x: 30, z: -8, r: 24 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -24 }, { type: 'golem', x: -16, z: -44 },
      { type: 'golem', x: 8, z: -68 }, { type: 'golem', x: -10, z: -92 },
      { type: 'golem', x: 22, z: -106 }, { type: 'golem', x: -26, z: -74 },
      { type: 'golem', x: 30, z: -50 },
    ],
  },
];

// Parse ?level=N (1..3), clamp, return the biome. Defaults to Floor 1.
export function getBiome(param) {
  const n = Math.min(3, Math.max(1, parseInt(param, 10) || 1));
  return BIOMES[n - 1];
}
```

- [ ] **Step 2: Edit `src/world/floor.js` — add terrain profile + biome-driven `createFloor`**

Replace the top of the file (the `terrainHeight` block) so a module-scoped profile drives amp/freq:

```js
import * as THREE from 'three';

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ponytail: module-level terrain profile, set once by createFloor. One level per
// page load, so mutable module state is safe and keeps terrainHeight a pure-signature
// export that player/enemies/town import directly.
const PROFILE = { amp: 1.0, freq: 1.0 };

// Analytic terrain height — shared by the mesh and the player, no raycasts needed.
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(8, 40, d); // flat area around spawn
  const f = PROFILE.freq;
  const h =
    Math.sin(x * 0.05 * f) * Math.cos(z * 0.045 * f) * 2.2 +
    Math.sin(x * 0.13 * f + 1.7) * Math.sin(z * 0.11 * f) * 0.8;
  return h * flat * PROFILE.amp;
}

export const GATE_POS = new THREE.Vector3(0, 0, -120);
```

Change the `createFloor` signature and use the biome. Replace `export function createFloor(scene) {` with:

```js
export function createFloor(scene, biome) {
  PROFILE.amp = biome.terrain.amp;
  PROFILE.freq = biome.terrain.freq;
```

In the ground-color loop, replace the hardcoded `lo`/`hi` colors with biome values:

```js
  const lo = new THREE.Color(biome.terrain.lo), hi = new THREE.Color(biome.terrain.hi), c = new THREE.Color();
```

Replace the ceiling material color `0x7e94b5` with `biome.sky.ceiling`, and the core material color `0x93a7c4` with `biome.sky.core`:

```js
    new THREE.MeshBasicMaterial({ color: biome.sky.ceiling, fog: false, side: THREE.DoubleSide })
```
```js
    new THREE.MeshBasicMaterial({ color: biome.sky.core, fog: false })
```

(Leave the floating-rock `chunkMat` `0x9db3d1` and gate colors as-is — cheap shared sky detail; fine across biomes.)

- [ ] **Step 3: Edit `src/main.js` — apply biome to scene, lights, and build enemies from config**

Add imports after line 9:

```js
import { getBiome } from './world/biomes.js';
```

Add right after (before the renderer block, so `biome` is in scope everywhere):

```js
const biome = getBiome(new URLSearchParams(location.search).get('level'));
```

Replace lines 19-21 (scene background + fog):

```js
const scene = new THREE.Scene();
scene.background = new THREE.Color(biome.background);
scene.fog = new THREE.Fog(biome.fog.color, biome.fog.near, biome.fog.far);
```

Replace lines 25-27 (hemi + sun creation) — keep the shadow setup below unchanged:

```js
const hemi = new THREE.HemisphereLight(biome.hemi.sky, biome.hemi.ground, biome.hemi.intensity);
scene.add(hemi);
const sun = new THREE.DirectionalLight(biome.sun.color, biome.sun.intensity);
sun.position.set(biome.sun.pos[0], biome.sun.pos[1], biome.sun.pos[2]);
```

Replace `const floor = createFloor(scene);` with:

```js
const floor = createFloor(scene, biome);
```

Replace the `const enemies = [ ... ];` block (lines 142-152) with a config-driven build:

```js
const enemies = biome.enemies.map((e) =>
  e.type === 'dummy'
    ? new Dummy(scene, e.x, e.z, terrainHeight, hud)
    : new Golem(scene, e.x, e.z, terrainHeight, hud, player, world));
```

(Leave `createTown(scene, terrainHeight);` unchanged for now — Task 4 makes it biome-aware. On F2/F3 it renders the F1 village as a temporary intermediate; terrain/light/fog/enemies are already biome-correct.)

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Verify in browser**

Run: `bun run dev`, then open the printed URL three times: `?level=1`, `?level=2`, `?level=3`.
Expected:
- F1 looks exactly as before (green terrain, warm light, town, 2 dummies + 5 golems).
- F2: pale blue-white terrain, cooler/dimmer light, tighter blue fog; golems placed; (village still green — expected until Task 4).
- F3: dark grey jagged terrain (visibly more rugged), dark overcast fog/light.
- Console shows only expected `[CAO] ... missing` lines; no errors.

- [ ] **Step 6: Commit**

```bash
git add src/world/biomes.js src/world/floor.js src/main.js
git commit -m "feat: biome configs + parameterized terrain, lighting, enemy roster"
```

---

## Task 2: Weather system (snow / rain + lightning)

**Files:**
- Create: `src/world/weather.js`
- Modify: `src/main.js` (instantiate + update in loop)

**Interfaces:**
- Consumes: `biome.weather` (`'snow'|'rain'|null`), `sun`/`hemi` lights, `scene`, `player.pos`.
- Produces: `createWeather(scene, type, { sun, hemi }) → { update(dt, playerPos) }`.

- [ ] **Step 1: Create `src/world/weather.js`**

```js
import * as THREE from 'three';

// Cheap weather as a player-following particle box. Snow drifts slowly; rain falls
// fast with periodic lightning that briefly flashes the sky + sun/hemi. Uses REAL dt
// (cosmetic — ignores hit-stop, like the camera). null/unknown type → no-op.

const BOX = 70;   // particle field extent; recentered on the player each frame
const TOP = 40;   // recycle height above the player
const WHITE = new THREE.Color(0xffffff);

function field(count, color, size) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) p[i] = (Math.random() - 0.5) * BOX;
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

export function createWeather(scene, type, lights = {}) {
  if (type !== 'snow' && type !== 'rain') return { update() {} };

  const isSnow = type === 'snow';
  const count = isSnow ? 800 : 1200;
  const pts = field(count, isSnow ? 0xffffff : 0xafc2d6, isSnow ? 0.22 : 0.16);
  scene.add(pts);
  const arr = pts.geometry.attributes.position.array;
  const fall = isSnow ? 6 : 34;   // units/sec
  const sway = isSnow ? 1.2 : 0;

  const { sun, hemi } = lights;
  const sunBase = sun ? sun.intensity : 0;
  const hemiBase = hemi ? hemi.intensity : 0;
  const bgBase = scene.background ? scene.background.clone() : null;
  let strikeT = 3;  // seconds to next lightning
  let flash = 0;    // current flash, 1 → 0
  let acc = 0;

  return {
    update(dt, playerPos) {
      const cx = playerPos.x, cz = playerPos.z, cy = playerPos.y;
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        arr[j + 1] -= fall * dt;
        if (sway) arr[j] += Math.sin(acc * 2 + i) * sway * dt;
        if (arr[j + 1] < cy - 4) arr[j + 1] = cy + TOP;
        if (arr[j] < cx - BOX / 2) arr[j] += BOX; else if (arr[j] > cx + BOX / 2) arr[j] -= BOX;
        if (arr[j + 2] < cz - BOX / 2) arr[j + 2] += BOX; else if (arr[j + 2] > cz + BOX / 2) arr[j + 2] -= BOX;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      acc += dt;

      if (!isSnow) {
        strikeT -= dt;
        if (strikeT <= 0) { flash = 1; strikeT = 4 + (Math.sin(acc * 13.1) * 0.5 + 0.5) * 6; } // 4–10s
        if (flash > 0) {
          flash = Math.max(0, flash - dt * 3.2);
          if (sun) sun.intensity = sunBase + flash * 2.2;
          if (hemi) hemi.intensity = hemiBase + flash * 1.5;
          if (bgBase && scene.background) scene.background.copy(bgBase).lerp(WHITE, flash * 0.5);
        }
      }
    },
  };
}
```

- [ ] **Step 2: Edit `src/main.js` — instantiate and drive weather**

Add import after the `getBiome` import:

```js
import { createWeather } from './world/weather.js';
```

Add after the `blade` line (`const blade = new Blade(...)`), before `const enemies`:

```js
const weather = createWeather(scene, biome.weather, { sun, hemi });
```

In `tick()`, add after `floor.update(elapsed);`:

```js
  weather.update(dt, player.pos);
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify in browser**

Run: `bun run dev`.
Expected:
- `?level=1`: no particles.
- `?level=2`: white snow drifting down around the player wherever they walk.
- `?level=3`: fast rain; every ~4–10s a brief bright lightning flash (sky + light spike) that eases back.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/world/weather.js src/main.js
git commit -m "feat: player-following snow/rain weather with lightning"
```

---

## Task 3: Floor selector on the loading screen

**Files:**
- Modify: `index.html` (selector markup + CSS)
- Modify: `src/main.js` (highlight current floor, update tagline)

**Interfaces:**
- Consumes: `biome.id`, `biome.name`.
- Produces: user-visible floor picker; clicking a non-current floor navigates to `?level=N` (reload).

- [ ] **Step 1: Edit `index.html` — add selector markup**

Inside `#lock-foot` (between `#load-status` and `#lock-go`), add:

```html
      <div id="floor-select">
        <a class="floor" data-level="1" href="?level=1"><b>I</b> Verdant Town</a>
        <a class="floor" data-level="2" href="?level=2"><b>II</b> Frostbound</a>
        <a class="floor" data-level="3" href="?level=3"><b>III</b> Storm Peaks</a>
      </div>
```

- [ ] **Step 2: Edit `index.html` — add selector CSS**

Add before the closing `</style>`:

```css
    #floor-select { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    #floor-select .floor { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border: 1px solid rgba(127,212,255,0.35); border-radius: 4px; color: #cfe6ff; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; opacity: 0.7; transition: opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease; }
    #floor-select .floor b { color: #7fd4ff; font-weight: 700; }
    #floor-select .floor:hover { opacity: 1; background: rgba(127,212,255,0.1); }
    #floor-select .floor.current { opacity: 1; border-color: #7fd4ff; background: rgba(127,212,255,0.18); pointer-events: none; cursor: default; }
```

- [ ] **Step 3: Edit `src/main.js` — highlight current floor + set tagline**

Add near the top after `const biome = getBiome(...)` line (needs the DOM, so keep it with the other overlay wiring — place it just after `const goBtn = ...` line, around line 39):

```js
// mark the picked floor in the loading-screen selector; the others are reload links
const curFloor = document.querySelector(`#floor-select .floor[data-level="${biome.id}"]`);
if (curFloor) curFloor.classList.add('current');
const taglineEl = document.querySelector('#lock-content .tagline');
if (taglineEl) taglineEl.textContent = `Floor ${biome.id} · ${biome.name}`;
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Verify in browser**

Run: `bun run dev`.
Expected:
- Loading screen shows three floor pills; the one matching the URL is highlighted and non-clickable.
- Tagline reads e.g. "Floor 2 · Frostbound".
- Clicking another pill reloads into that floor. "Link start" still enters the current floor once loaded.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.js
git commit -m "feat: floor selector on the loading screen"
```

---

## Task 4: Settlements, ruins & biome scatter in town.js (+ Kenney Castle Kit)

**Files:**
- Create: `public/assets/castle/` (Kenney Castle Kit `.glb` + `KENNEY_LICENSE.txt`)
- Modify: `src/world/town.js` (generic biome renderer + ruins + tint)
- Modify: `src/main.js:138` (pass biome to `createTown`)

**Interfaces:**
- Consumes: `biome.{trees,rocks,mountains,clouds,settlement,props,flags,ruins,tint}`.
- Produces: `createTown(scene, getHeight, biome)` (was `createTown(scene, getHeight)`).

- [ ] **Step 1: Download the Kenney Castle Kit (CC0) into `public/assets/castle/`**

The direct zip URL isn't stable, so resolve it at execution time. From the repo root:

```bash
mkdir -p public/assets/castle
# Find the current download URL from the asset page, then fetch it:
#   open https://kenney.nl/assets/castle-kit and copy the "Download" link, OR
curl -sL https://kenney.nl/assets/castle-kit | grep -oE 'https://[^" ]+castle-kit[^" ]+\.zip' | head -1
```

Download and extract the GLB pieces:

```bash
curl -L -o /tmp/castle-kit.zip "<ZIP_URL_FROM_ABOVE>"
unzip -o /tmp/castle-kit.zip -d /tmp/castle-kit
# copy just the GLBs (Kenney ships Models/GLB/*.glb or similar) into public/assets/castle/
find /tmp/castle-kit -iname '*.glb' -exec cp {} public/assets/castle/ \;
ls public/assets/castle/
```

Add the license file:

```bash
find /tmp/castle-kit -iname 'License*' -exec cp {} public/assets/castle/KENNEY_LICENSE.txt \;
```

- [ ] **Step 2: Reconcile ruin piece names with the actual files**

Run: `ls public/assets/castle/*.glb`
Then edit `src/world/biomes.js`: in the `ruins` arrays of Floor 2 and Floor 3, set each `name` to a real basename (no `.glb`) of a broken-wall / wall / wall-corner / tower / gate piece from the listing. If a name doesn't exist, the loader skips it gracefully (verified in Step 6), so prefer damaged/broken variants where present. Keep ~6 pieces on F2 and ~12 on F3.

- [ ] **Step 3: Edit `src/world/town.js` — generalize the loader and add ruins support**

Replace the `proto(path)` helper so it can load both KayKit `.gltf` (default) and Kenney `.glb` from a second base:

```js
const BASE = '/assets/kaykit';
const CASTLE = '/assets/castle';
const SCALE = 4.2;

// ...mulberry32 unchanged...

// load once, cache the prepped prototype scene (shadows enabled).
// ext/base let us load KayKit .gltf and Kenney Castle Kit .glb through one path.
const cache = new Map();
function proto(path, base = BASE, ext = 'gltf') {
  const key = `${base}/${path}.${ext}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      loader.load(key,
        (g) => {
          g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          resolve(g.scene);
        },
        undefined,
        () => { console.log(`[CAO] model missing: ${key}`); resolve(null); });
    }));
  }
  return cache.get(key);
}
```

Add a tint helper and a `placeRuin` near `place()`:

```js
// multiply a cloned material's color toward `hex` so shared KayKit greenery reads
// as snowy / stormy per biome. Cloning avoids mutating the cached prototype material.
function tintObject(obj, hex) {
  if (hex == null) return;
  const c = new THREE.Color(hex);
  obj.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => { const n = m.clone(); n.color.multiply(c); return n; });
    if (!Array.isArray(o.material)) o.material = o.material[0];
  });
}

// Kenney Castle Kit ruin: sunk + tilted + darkened, dropped on the terrain.
async function placeRuin(parent, name, x, z, getHeight, rng, tint) {
  const s = await proto(name, CASTLE, 'glb');
  if (!s) return null;
  const m = s.clone(true);
  m.position.set(x, getHeight(x, z) - 0.4, z);          // sink into the ground
  m.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3); // tilt + yaw
  m.scale.setScalar(SCALE * 1.4);                        // Kenney pieces read larger than KayKit hex
  tintObject(m, tint == null ? 0x8a8f96 : tint);         // always darken ruins a touch
  parent.add(m);
  return m;
}
```

- [ ] **Step 4: Edit `src/world/town.js` — make `createTown` a biome-driven renderer**

Replace the entire `export function createTown(scene, getHeight) { ... }` body with:

```js
export function createTown(scene, getHeight, biome) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(1337);
  const tint = biome.tint;

  // --- settlement: hand-placed buildings, faced toward the cluster center ---
  for (const [type, color, x, z] of biome.settlement) {
    place(root, bp(type, color), x, z, getHeight, { yaw: facePlaza(x, z) })
      .then((m) => { if (m) tintObject(m, tint); });
  }

  // --- props ---
  for (const [name, x, z] of biome.props) {
    place(root, `decoration/props/${name}`, x, z, getHeight, { yaw: rng() * Math.PI * 2, sink: 0 })
      .then((m) => { if (m) tintObject(m, tint); });
  }

  // --- bannered lane (Floor 1 only) ---
  if (biome.flags) {
    const flags = ['flag_green', 'flag_yellow', 'flag_red'];
    [6, -8, -22, -36, -50].forEach((z, i) => {
      for (const x of [-7.5, 7.5]) {
        place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
      }
    });
  }

  // --- ruins (Kenney Castle Kit) ---
  for (const { name, x, z } of biome.ruins) {
    placeRuin(root, name, x, z, getHeight, rng, tint);
  }

  // --- forest (instanced), tinted per biome ---
  for (const t of biome.trees) {
    scatterTinted(root, t.path,
      scatterRing(rng, t.count, 46, 118, getHeight, SCALE * t.sMin, SCALE * t.sMax, { skipTown: true }), tint);
  }

  // --- rocks / boulders ---
  for (const r of biome.rocks) {
    scatterTinted(root, r.path,
      scatterRing(rng, r.count, 30, 120, getHeight, SCALE * r.sMin, SCALE * r.sMax, { skipTown: true }), tint);
  }

  // --- distant hills & mountains ---
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
    const r = 132 + rng() * 20;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const name = biome.mountains[Math.floor(rng() * biome.mountains.length)];
    place(root, `decoration/nature/${name}`, x, z, getHeight,
      { yaw: rng() * Math.PI * 2, scale: SCALE * (2.5 + rng() * 2), sink: 1 })
      .then((m) => { if (m) tintObject(m, tint); });
  }

  // --- clouds ---
  for (let i = 0; i < biome.clouds; i++) {
    const a = rng() * Math.PI * 2, r = 30 + rng() * 90;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const name = rng() > 0.5 ? 'cloud_big' : 'cloud_small';
    proto(`decoration/nature/${name}`).then((s) => {
      if (!s) return;
      const c = s.clone(true);
      c.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      c.position.set(x, 42 + rng() * 26, z);
      c.scale.setScalar(SCALE * (1.5 + rng()));
      c.rotation.y = rng() * Math.PI * 2;
      tintObject(c, tint);
      root.add(c);
    });
  }

  return root;
}
```

Add a tint-aware scatter helper next to `scatter()` (instanced meshes need the material cloned+tinted once):

```js
// scatter(), but tint the shared instanced material toward the biome color.
async function scatterTinted(parent, path, transforms, tint) {
  if (tint == null) return scatter(parent, path, transforms);
  const s = await proto(path);
  if (!s || !transforms.length) return;
  const c = new THREE.Color(tint);
  const meshes = [];
  s.updateWorldMatrix(true, true);
  s.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const m = new THREE.Matrix4();
  for (const mesh of meshes) {
    const mat = mesh.material.clone();
    mat.color.multiply(c);
    const inst = new THREE.InstancedMesh(mesh.geometry, mat, transforms.length);
    inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false;
    transforms.forEach((t, i) => { m.compose(t.pos, t.quat, t.scl).multiply(mesh.matrixWorld); inst.setMatrixAt(i, m); });
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
  }
}
```

> The old hardcoded `TOWN`, `PROPS`, forest/rock/mountain/cloud blocks are all removed — they now live in `biomes.js`. Keep `mulberry32`, `bp`, `place`, `scatter`, `blocked`, `scatterRing`, `facePlaza`, `CENTER`, `_v`.

- [ ] **Step 5: Edit `src/main.js` — pass biome to `createTown`**

Replace `createTown(scene, terrainHeight);` with:

```js
createTown(scene, terrainHeight, biome);
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Verify in browser**

Run: `bun run dev`.
Expected:
- `?level=1`: identical village to before (same buildings, props, flags, forest, rocks, mountains, clouds).
- `?level=2`: small snowy hamlet (~5 buildings, cool-tinted), bare trees, extra rocks, snow mountains; Kenney ruin pieces standing sunk/tilted at the ruin coords.
- `?level=3`: small storm-grey outpost + many dark ruin clusters; sparse dark trees.
- Temporarily rename `public/assets/castle/` and reload F3: game still runs, console logs `[CAO] model missing: ...`, no crash. Restore the folder.
- Player never spawns inside a building (spawn plaza clear).

- [ ] **Step 8: Commit**

```bash
git add public/assets/castle src/world/town.js src/world/biomes.js src/main.js
git commit -m "feat: biome-driven settlements, ruins (Kenney Castle Kit) and tinted scatter"
```

---

## Task 5: Place-of-interest badges (HUD + proximity detection)

**Files:**
- Modify: `index.html` (`#place-badge` element + CSS)
- Modify: `src/ui/hud.js` (`setFloor`, `enterPlace`)
- Modify: `src/main.js` (set floor label + per-frame place detection)

**Interfaces:**
- Consumes: `biome.{id,place0,places}`, `player.pos`.
- Produces: `hud.setFloor(floorName, place0)`, `hud.enterPlace(name)` (name may be `null` → revert label, no badge).

- [ ] **Step 1: Edit `index.html` — add the badge element**

Inside `#hud`, after `#hint`, add:

```html
    <div id="place-badge"></div>
```

- [ ] **Step 2: Edit `index.html` — add badge CSS**

Add before the loading-screen CSS comment (`/* --- loading screen --- */`):

```css
    #place-badge { position: absolute; bottom: 62px; width: 100%; text-align: center; font-size: 22px; letter-spacing: 0.34em; text-transform: uppercase; color: #eaf2ff; text-shadow: 0 2px 18px rgba(0,0,0,0.85); opacity: 0; transform: translateY(8px); transition: opacity 0.6s ease, transform 0.6s ease; }
    #place-badge.show { opacity: 0.95; transform: translateY(0); }
```

- [ ] **Step 3: Edit `src/ui/hud.js` — grab elements + add methods**

In the constructor, after `this.deathEl = ...`, add:

```js
    this.floorLabelEl = document.getElementById('floor-label');
    this.badgeEl = document.getElementById('place-badge');
    this.floorName = '';
    this.place0 = '';
    this._badgeT = 0;
```

Add these methods to the class (after `setGateNear`):

```js
  setFloor(floorName, place0) {
    this.floorName = floorName;
    this.place0 = place0;
    this.floorLabelEl.textContent = `${floorName} · ${place0}`;
  }

  enterPlace(name) {
    this.floorLabelEl.textContent = `${this.floorName} · ${name || this.place0}`;
    if (!name) return;                 // left all zones → label reverts, no badge
    this.badgeEl.textContent = name;
    this.badgeEl.classList.add('show');
    clearTimeout(this._badgeT);
    this._badgeT = setTimeout(() => this.badgeEl.classList.remove('show'), 3500);
  }
```

- [ ] **Step 4: Edit `src/main.js` — set floor label and detect places each frame**

After `player.hud = hud;`, add:

```js
hud.setFloor(`Floor ${biome.id}`, biome.place0);
let currentPlace = null;
function nearestPlace(p) {
  let best = null, bestD = Infinity;
  for (const pl of biome.places) {
    const d = Math.hypot(p.x - pl.x, p.z - pl.z);
    if (d < pl.r && d < bestD) { bestD = d; best = pl; }
  }
  return best;
}
```

In `tick()`, after `hud.setGateNear(...)`, add:

```js
  const place = nearestPlace(player.pos);
  const placeName = place ? place.name : null;
  if (placeName !== currentPlace) { currentPlace = placeName; hud.enterPlace(placeName); }
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Verify in browser**

Run: `bun run dev`, `?level=2`.
Expected:
- Top-left starts `FLOOR 2 · THE FROZEN REACHES`.
- Walking into Frosthollow updates top-left to `FLOOR 2 · FROSTHOLLOW` and pops the bottom badge "FROSTHOLLOW", which fades out after ~3.5s.
- Walking out and back in re-fires the badge; staying inside does not repeatedly re-fire.
- The Sealed Gate zone triggers its badge (and the separate `gate-msg` "sealed" still shows independently).
- No console errors.

- [ ] **Step 7: Commit**

```bash
git add index.html src/ui/hud.js src/main.js
git commit -m "feat: named place-of-interest badges + top-left label updates"
```

---

## Task 6: Per-biome enemy tint + doc update

**Files:**
- Modify: `src/combat/golem.js` (optional tint)
- Modify: `src/main.js` (pass tint), `src/world/biomes.js` (`enemyTint` per biome)
- Modify: `README.md`, `VISION.md`, `CLAUDE.md` (floor descriptions / level select)

**Interfaces:**
- Consumes: `biome.enemyTint` (hex or null).
- Produces: `new Golem(scene, x, z, getHeight, hud, player, world, tint)` (added trailing optional arg, default `null`).

- [ ] **Step 1: Edit `src/world/biomes.js` — add `enemyTint` to each biome**

Add a field to each config: Floor 1 `enemyTint: null`, Floor 2 `enemyTint: 0x9fc4e0` (frost blue), Floor 3 `enemyTint: 0x6f7684` (storm grey).

- [ ] **Step 2: Edit `src/combat/golem.js` — accept and apply a tint**

Change the constructor signature:

```js
  constructor(scene, x, z, getHeight, hud, player, world, tint = null) {
```

Store it after `this.world = world;`:

```js
    this.tint = tint;
```

In `useModel()`, inside the `model.traverse` callback, after `o.material = o.material.clone();`, add:

```js
      if (this.tint != null) o.material.color.multiply(new THREE.Color(this.tint));
```

- [ ] **Step 3: Edit `src/main.js` — pass the biome enemy tint**

Update the enemy build map (from Task 1) to pass the tint to golems:

```js
const enemies = biome.enemies.map((e) =>
  e.type === 'dummy'
    ? new Dummy(scene, e.x, e.z, terrainHeight, hud)
    : new Golem(scene, e.x, e.z, terrainHeight, hud, player, world, biome.enemyTint));
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Verify in browser**

Run: `bun run dev`.
Expected: F1 golems unchanged (moss); F2 golems read cooler/frost-blue; F3 golems read storm-grey. Behavior (chase/windup/strike) unchanged on all floors.

- [ ] **Step 6: Update docs**

- `README.md` / `VISION.md`: note the 3 selectable floors and their biomes; replace any "floor 2 stub" wording. Keep it factual to the code.
- `CLAUDE.md`: under Three.js architecture, add one line that biomes are data in `world/biomes.js`, floor chosen via `?level=N`, weather in `world/weather.js`, and ruins use the Kenney Castle Kit in `public/assets/castle/`.

- [ ] **Step 7: Commit**

```bash
git add src/combat/golem.js src/main.js src/world/biomes.js README.md VISION.md CLAUDE.md
git commit -m "feat: per-biome enemy tint; docs for level select + biomes"
```

---

## Self-Review

**Spec coverage:**
- Level picker 1/2/3 → Task 1 (`?level` + `getBiome`) + Task 3 (UI). ✅
- F2 frostbound / F3 storm distinct biomes → Task 1 (palette/light/fog/terrain) + Task 2 (weather) + Task 4 (settlements/ruins/scatter/tint). ✅
- Weather (snow / rain+lightning) → Task 2. ✅
- Small sparse settlements + ruins on F2/F3 → Task 4 (settlement lists + Kenney ruins). ✅
- Real CC0 ruins pack downloaded → Task 4 Step 1 (Kenney Castle Kit). ✅
- Place proximity → top-left update + non-invasive bottom badge → Task 5. ✅
- Per-biome enemies + docs → Task 6. ✅

**Placeholder scan:** ruin piece `name`s in `biomes.js` are provisional Kenney names; Task 4 Step 2 explicitly reconciles them against the actual download and the loader skips unknowns gracefully — this is discovery, not an unfilled placeholder.

**Type consistency:** `createFloor(scene, biome)`, `createTown(scene, getHeight, biome)`, `createWeather(scene, type, {sun,hemi}) → {update(dt,playerPos)}`, `getBiome(param)`, `hud.setFloor(name, place0)`, `hud.enterPlace(name)`, `Golem(..., tint=null)` — all referenced consistently across tasks. `terrainHeight` signature unchanged everywhere.

**Risks:** F3 `amp:2.6/freq:1.6` may make slopes steep enough to trap the height-following player/golems — if movement feels sticky, lower `amp` (no physics to fight). Kenney silhouette drift vs KayKit → Blender re-shade fallback (out of this plan's scope; flagged in spec).
