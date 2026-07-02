# Floors 4 & 5 — The Elderwood & Craghold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two data-driven floors — a deep ancient forest with mountains and a river (Floor 4), and an Edinburgh-style medieval city with a castle crag and a lined central street (Floor 5).

**Architecture:** Both floors are new config objects in `world/biomes.js`. Four small engine seams let those configs express new terrain: `terrainHeight` gains per-biome shapes (`valley`/`crag`) and a river carve; `floor.js` lays an animated water ribbon; `town.js` runs a pure `cityLayout` street generator; `weather.js` gains a `pollen` type. Floors 1-3 are untouched because every new field defaults off.

**Tech Stack:** Three.js (vanilla JS, ES modules), Vite, bun. Node-runnable `assert` self-checks for the pure math (no test framework in this repo).

## Global Constraints

- Package manager **bun**; `package.json` is `"type": "module"` (so `.js`/`.mjs` imports run as ESM under `node`).
- The only static check is `bun run typecheck` (`tsc --noEmit`). New files stay `.js` (`checkJs:false` → not typechecked). Run typecheck before claiming a task sound.
- **Floors 1-3 must render identically.** New config fields (`terrain.shape`, `terrain.crag`, `river`, `city`, `flags:'spine'`) are all optional; absence = current behavior.
- **GLB/GLTF loads degrade gracefully** — never `await`-block the loop, always keep the gray-box fallback (already handled by `proto()`/`place()` in `town.js`).
- `sdt` vs `dt`: water and weather are cosmetic → driven by **real `dt`/`t`**, never `sdt`.
- Runtime logs are prefixed `[CAO]`. Verify runtime changes on the dev server and watch the browser console.
- Reuse on-disk assets only (KayKit Medieval Hexagon at `public/assets/kaykit/`, Kenney Castle Kit at `public/assets/castle/`). No downloads, no custom modeling.
- Commits: stage only the files a task touches (never `git add -A` — the repo is edited live).

---

## File Structure

- **Create** `test/terrain.mjs` — node assert check for terrain shapes + river carve.
- **Create** `test/biomes.mjs` — node assert check for `getBiome` clamp + new configs.
- **Create** `src/world/citylayout.js` — pure `cityLayout(city, rng)`; no THREE, no DOM.
- **Create** `test/citylayout.mjs` — node assert check for the city layout.
- **Modify** `src/world/floor.js` — `configureTerrain`, terrain shapes, river carve, water ribbon.
- **Modify** `src/world/biomes.js` — two configs + `getBiome` clamp.
- **Modify** `src/world/weather.js` — `pollen` type.
- **Modify** `src/world/town.js` — consume `cityLayout`, `flags:'spine'`.
- **Modify** `index.html` — two `#floor-select` rows.
- **Modify** `src/main.js` — extend preload array to `[1,2,3,4,5]`.

---

## Task 1: Terrain shapes + river carve (`floor.js`)

**Files:**
- Modify: `src/world/floor.js` (the `PROFILE` const + `terrainHeight` + top of `createFloor`)
- Test: `test/terrain.mjs`

**Interfaces:**
- Produces: `configureTerrain(biome)` — sets module terrain profile + river from a biome; called by `createFloor` and by tests. `terrainHeight(x, z)` — unchanged signature, now shape/river aware.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test** — create `test/terrain.mjs`:

```js
import assert from 'node:assert/strict';
import { configureTerrain, terrainHeight } from '../src/world/floor.js';

// Reference "rolling" formula = the pre-change floors 1-3 behaviour.
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function oldHeight(x, z, amp = 1, freq = 1) {
  const flat = smoothstep(8, 40, Math.hypot(x, z));
  const h = Math.sin(x * 0.05 * freq) * Math.cos(z * 0.045 * freq) * 2.2
          + Math.sin(x * 0.13 * freq + 1.7) * Math.sin(z * 0.11 * freq) * 0.8;
  return h * flat * amp;
}

// 1. rolling with no shape/river must match the old formula exactly (regression guard).
configureTerrain({ terrain: { amp: 1, freq: 1 } });
for (const [x, z] of [[10, 10], [50, -30], [-70, 80], [0, 0]]) {
  assert.ok(Math.abs(terrainHeight(x, z) - oldHeight(x, z)) < 1e-9, `rolling regression at ${x},${z}`);
}

// 2. valley raises the sides well above the centre floor.
configureTerrain({ terrain: { amp: 1, freq: 1, shape: 'valley' } });
assert.ok(terrainHeight(90, 0) - terrainHeight(0, 60) > 15, 'valley walls should tower over the floor');

// 3. crag bumps up near its centre by ~height.
configureTerrain({ terrain: { amp: 1, freq: 1, shape: 'crag', crag: { x: 0, z: 95, height: 20, radius: 26 } } });
assert.ok(terrainHeight(0, 95) - terrainHeight(0, 20) > 15, 'crag should rise ~20 at its centre');

// 4. river carves a channel: a point on the centreline sits ~depth below an off-river point.
configureTerrain({ terrain: { amp: 1, freq: 1 }, river: { path: [{ x: -40, z: 0 }, { x: 40, z: 0 }], width: 7, depth: 3 } });
assert.ok(terrainHeight(0, 0) < terrainHeight(0, 20) - 2, 'river centreline should be carved down');
assert.ok(Math.abs(terrainHeight(0, 20) - oldHeight(0, 20)) < 1e-9, 'off-river terrain unchanged');

console.log('terrain.mjs OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/terrain.mjs`
Expected: FAIL — `configureTerrain` is not an export yet (`SyntaxError: ... does not provide an export named 'configureTerrain'`).

- [ ] **Step 3: Implement** — in `src/world/floor.js`, replace the `PROFILE` line:

```js
const PROFILE = { amp: 1.0, freq: 1.0 };
```

with the profile + river state and helpers (place directly under the `smoothstep` function, above `terrainHeight`):

```js
// ponytail: module-level terrain profile + river, set once per page load by
// configureTerrain. One level per load, so mutable module state is safe and keeps
// terrainHeight a pure-signature export the player/enemies/town import directly.
const PROFILE = { amp: 1.0, freq: 1.0, shape: 'rolling', crag: null };
let RIVER = null; // { segs: [{ ax, az, bx, bz }], width, depth }

// distance from point (px,pz) to segment (ax,az)-(bx,bz)
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function riverDepth(x, z) {
  if (!RIVER) return 0;
  let best = Infinity;
  for (const s of RIVER.segs) { const d = distSeg(x, z, s.ax, s.az, s.bx, s.bz); if (d < best) best = d; }
  // 0 outside the width, ramps to full depth toward the centreline
  return smoothstep(RIVER.width, RIVER.width * 0.35, best) * RIVER.depth;
}

// Set the terrain profile + river from a biome. Called by createFloor and by tests.
export function configureTerrain(biome) {
  PROFILE.amp = biome.terrain.amp;
  PROFILE.freq = biome.terrain.freq;
  PROFILE.shape = biome.terrain.shape || 'rolling';
  PROFILE.crag = biome.terrain.crag || null;
  if (biome.river) {
    const p = biome.river.path, segs = [];
    for (let i = 0; i < p.length - 1; i++) segs.push({ ax: p[i].x, az: p[i].z, bx: p[i + 1].x, bz: p[i + 1].z });
    RIVER = { segs, width: biome.river.width, depth: biome.river.depth };
  } else {
    RIVER = null;
  }
}
```

Then replace the body of `terrainHeight`:

```js
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(8, 40, d);
  const f = PROFILE.freq;
  let h = (Math.sin(x * 0.05 * f) * Math.cos(z * 0.045 * f) * 2.2 +
           Math.sin(x * 0.13 * f + 1.7) * Math.sin(z * 0.11 * f) * 0.8) * flat * PROFILE.amp;
  if (PROFILE.shape === 'valley') {
    h += smoothstep(30, 90, Math.abs(x)) * 22;              // side mountain walls, flat floor
  } else if (PROFILE.shape === 'crag' && PROFILE.crag) {
    const c = PROFILE.crag;
    const dc = Math.hypot(x - c.x, z - c.z);
    h += c.height * Math.exp(-(dc * dc) / (2 * c.radius * c.radius)); // Gaussian crag
  }
  return h - riverDepth(x, z);
}
```

Finally, in `createFloor`, replace the two lines:

```js
  PROFILE.amp = biome.terrain.amp;
  PROFILE.freq = biome.terrain.freq;
```

with:

```js
  configureTerrain(biome);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/terrain.mjs`
Expected: `terrain.mjs OK`

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/world/floor.js test/terrain.mjs
git commit -m "feat(floor): per-biome terrain shapes (valley/crag) + river carve"
```

---

## Task 2: Floor 4 & 5 biome configs + `getBiome` clamp (`biomes.js`)

**Files:**
- Modify: `src/world/biomes.js` (append two configs to `BIOMES`; change the `getBiome` clamp)
- Test: `test/biomes.mjs`

**Interfaces:**
- Consumes: the config field shapes read by `floor.js` (`terrain.shape`, `terrain.crag`, `river`), `town.js` (`city`, `flags`), `weather.js` (`weather`).
- Produces: `BIOMES` now length 5; `getBiome(param)` clamps to `1..BIOMES.length`.

- [ ] **Step 1: Write the failing test** — create `test/biomes.mjs`:

```js
import assert from 'node:assert/strict';
import { BIOMES, getBiome } from '../src/world/biomes.js';

assert.equal(BIOMES.length, 5, 'expected 5 floors');
assert.equal(getBiome('4').id, 4);
assert.equal(getBiome('5').id, 5);
assert.equal(getBiome('0').id, 1, 'clamp low');
assert.equal(getBiome('9').id, 5, 'clamp high');
assert.equal(getBiome(null).id, 1, 'default');

const f4 = getBiome('4');
assert.equal(f4.terrain.shape, 'valley');
assert.ok(f4.river && Array.isArray(f4.river.path) && f4.river.path.length >= 2, 'floor 4 has a river path');
assert.ok(f4.trees.length >= 4, 'floor 4 forest is dense / multi-species');

const f5 = getBiome('5');
assert.equal(f5.terrain.shape, 'crag');
assert.ok(f5.terrain.crag && f5.city && f5.city.castle, 'floor 5 has a crag + city + castle');

console.log('biomes.mjs OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/biomes.mjs`
Expected: FAIL — `AssertionError: expected 5 floors` (currently 3).

- [ ] **Step 3: Implement** — in `src/world/biomes.js`, append these two objects inside the `BIOMES` array (after the Floor 3 object, before the closing `];`):

```js
  { // ---------- Floor 4: The Elderwood (deep ancient forest) ----------
    id: 4,
    name: 'The Elderwood',
    place0: 'Heart of the ancient wood',
    background: 0x2f4a3a,
    fog: { color: 0x35513f, near: 26, far: 105 },
    hemi: { sky: 0x9fc7a0, ground: 0x24301f, intensity: 0.7 },
    sun: { color: 0xffe6a8, intensity: 0.95, pos: [50, 70, -40] },
    terrain: { lo: 0x2c3d24, hi: 0x5f8544, amp: 1.6, freq: 1.2, shape: 'valley' },
    sky: { ceiling: 0x3a5240, core: 0x557a4f },
    tint: 0x8fae86,
    enemyTint: 0x6f9e5a,
    weather: 'pollen',
    river: { path: [{ x: -60, z: 42 }, { x: -24, z: 20 }, { x: 8, z: -12 }, { x: -4, z: -52 }, { x: 26, z: -96 }], width: 7, depth: 3, level: -0.6, color: 0x3f6b6a },
    trees: [
      { path: 'decoration/nature/trees_A_large', count: 40, sMin: 1.0, sMax: 1.6 },
      { path: 'decoration/nature/trees_B_large', count: 40, sMin: 1.0, sMax: 1.6 },
      { path: 'decoration/nature/trees_A_medium', count: 55, sMin: 0.9, sMax: 1.4 },
      { path: 'decoration/nature/trees_B_medium', count: 55, sMin: 0.9, sMax: 1.4 },
      { path: 'decoration/nature/tree_single_A', count: 45, sMin: 0.8, sMax: 1.3 },
      { path: 'decoration/nature/tree_single_B', count: 45, sMin: 0.8, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 30, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 25, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees', 'hills_A_trees', 'hills_B_trees'],
    clouds: 3,
    settlement: [ // small overgrown woodcutter's camp
      ['lumbermill', 'green', 10, 30], ['home_A', 'green', -12, 34], ['home_B', 'green', 16, 40], ['well', 'green', 0, 30],
    ],
    props: [
      ['crate_A_big', 6, 28], ['barrel', -6, 32], ['resource_lumber', 14, 34], ['weaponrack', -10, 30],
    ],
    flags: false,
    ruins: [
      { name: 'wall', x: -30, z: -18 }, { name: 'wall-corner', x: -34, z: -22 }, { name: 'wall-half', x: 22, z: -60 },
    ],
    places: [
      { name: 'The Elderwood', x: 0, z: 30, r: 26 },
      { name: 'Mistfen Hollow', x: 0, z: -44, r: 34 },
      { name: 'The Old River', x: 8, z: -12, r: 24 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -24 }, { type: 'golem', x: -16, z: -44 },
      { type: 'golem', x: 8, z: -68 }, { type: 'golem', x: -10, z: -92 },
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },

  { // ---------- Floor 5: Craghold (Edinburgh-inspired medieval city) ----------
    id: 5,
    name: 'Craghold',
    place0: 'Gates of the high city',
    background: 0x9fc8ea,
    fog: { color: 0xbcd4ea, near: 70, far: 220 },
    hemi: { sky: 0xdcecff, ground: 0x6b6152, intensity: 1.0 },
    sun: { color: 0xfff3d6, intensity: 1.3, pos: [70, 95, 40] },
    terrain: { lo: 0x6f6656, hi: 0xb8ae95, amp: 1.0, freq: 1.0, shape: 'crag', crag: { x: 0, z: 95, height: 20, radius: 26 } },
    sky: { ceiling: 0x8aa6c8, core: 0xa8c0dc },
    tint: null,
    enemyTint: 0x9aa0a8,
    weather: null,
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 12, sMin: 0.8, sMax: 1.2 },
      { path: 'decoration/nature/tree_single_B', count: 10, sMin: 0.8, sMax: 1.2 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 10, sMin: 3, sMax: 7 },
      { path: 'decoration/nature/rock_single_B', count: 8, sMin: 3, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B'],
    clouds: 5,
    city: {
      spineZ: [16, 82], halfWidth: 11, step: 7, jitter: 2.2,
      palette: ['green', 'red', 'yellow'],
      types: ['home_A', 'home_B', 'tavern', 'market', 'blacksmith', 'church', 'barracks', 'tower_A', 'tower_B'],
      castle: { type: 'castle', color: 'yellow', x: 0, z: 95 },
    },
    settlement: [],
    props: [
      ['crate_A_big', 5, 24], ['barrel', -5, 26], ['weaponrack', 6, 50], ['target', -7, 54], ['crate_open', 0, 20],
    ],
    flags: 'spine',
    ruins: [],
    places: [
      { name: 'Grassmarket', x: 0, z: 22, r: 22 },
      { name: 'The Royal Mile', x: 0, z: 50, r: 30 },
      { name: 'Castle Rock', x: 0, z: 95, r: 26 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -24 }, { type: 'golem', x: -16, z: -44 },
      { type: 'golem', x: 8, z: -68 }, { type: 'golem', x: -10, z: -92 },
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },
```

Then change the clamp in `getBiome`:

```js
export function getBiome(param) {
  const n = Math.min(BIOMES.length, Math.max(1, parseInt(param, 10) || 1));
  return BIOMES[n - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/biomes.mjs`
Expected: `biomes.mjs OK`

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/world/biomes.js test/biomes.mjs
git commit -m "feat(biomes): add Floor 4 (Elderwood) & Floor 5 (Craghold) configs"
```

---

## Task 3: Level-select wiring (`index.html` + `main.js`)

**Files:**
- Modify: `index.html:82-86` (`#floor-select`)
- Modify: `src/main.js:62` (preload array)

**Interfaces:**
- Consumes: `getBiome` clamp from Task 2 (so `?level=4|5` resolve).
- Produces: two selectable floor rows; preloader covers floors 1-5.

- [ ] **Step 1: Add the two rows** — in `index.html`, after the Floor 3 `<a>` (line 85), add:

```html
        <a class="floor" data-level="4" href="?level=4"><b>IV</b> The Elderwood</a>
        <a class="floor" data-level="5" href="?level=5"><b>V</b> Craghold</a>
```

- [ ] **Step 2: Extend the preload array** — in `src/main.js`, change:

```js
[1, 2, 3].forEach((id) => floorShots(id).forEach((src) => { new Image().src = src; })); // preload → instant swaps
```

to:

```js
[1, 2, 3, 4, 5].forEach((id) => floorShots(id).forEach((src) => { new Image().src = src; })); // preload → instant swaps
```

- [ ] **Step 3: Verify in the browser**

Run: `bun run dev`, open the printed URL.
Expected: the loading screen shows 5 floor buttons; hovering IV/V swaps the tagline to `Floor 4 · The Elderwood` / `Floor 5 · Craghold` (preview images are blank — see note below — that is fine). Clicking IV navigates to `?level=4` and clicking **Link start** loads the floor with no `[CAO] model missing` spam for on-disk assets.

> Note: `public/assets/loading/floor4|5/*.jpg` don't exist yet. `new Image().src` and the CSS `background-image` fail silently → blank Ken Burns panel. The loading-screen/trailer capture harness generates those separately; the game is fully playable without them.

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.js
git commit -m "feat(ui): add Floor 4 & 5 to the loading-screen level select"
```

---

## Task 4: River water ribbon (`floor.js`)

**Files:**
- Modify: `src/world/floor.js` (`createFloor` body + returned `update`)

**Interfaces:**
- Consumes: `biome.river` (`{ path, width, level, color }`) from Task 2; the carved channel from Task 1.
- Produces: a `water` mesh added to the scene; its texture scrolls in `floor.update(t)` via real `t`.

- [ ] **Step 1: Build the ribbon** — in `src/world/floor.js`, inside `createFloor`, after the `gate` block and before the `return {`, add:

```js
  // --- river water: a translucent ribbon following the carved channel (cosmetic, real t) ---
  let water = null;
  if (biome.river) {
    const p = biome.river.path, half = biome.river.width * 0.5;
    const verts = [], uvs = [], idx = [];
    let along = 0;
    for (let i = 0; i < p.length; i++) {
      const prev = p[Math.max(0, i - 1)], next = p[Math.min(p.length - 1, i + 1)];
      const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len; // left normal to the flow
      verts.push(p[i].x + nx * half, biome.river.level, p[i].z + nz * half);
      verts.push(p[i].x - nx * half, biome.river.level, p[i].z - nz * half);
      if (i > 0) along += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
      uvs.push(0, along * 0.15, 1, along * 0.15);
    }
    for (let i = 0; i < p.length - 1; i++) {
      const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wg.setIndex(idx);
    wg.computeVertexNormals();
    // cheap procedural ripple: soft blue-green noise, tiled + scrolled for flow
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 64;
    const cx = cvs.getContext('2d');
    for (let i = 0; i < 64 * 64; i++) {
      const v = 150 + Math.floor(Math.random() * 60);
      cx.fillStyle = `rgb(${v},${v + 20},${v + 30})`;
      cx.fillRect(i % 64, Math.floor(i / 64), 1, 1);
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 6);
    water = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({
      color: biome.river.color, map: tex, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
    }));
    water.renderOrder = 1;
    scene.add(water);
  }
```

- [ ] **Step 2: Scroll it in `update`** — in the returned object's `update(t)`, add as the last line of the function body:

```js
      if (water) water.material.map.offset.y = -t * 0.06;
```

- [ ] **Step 3: Verify in the browser**

Run: `bun run dev`, open `?level=4`, click **Link start**.
Expected: a blue-green river ribbon sits in a visible channel across the valley floor and its surface texture drifts slowly along the flow. Walking into it dips the player into the channel. No console errors.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/world/floor.js
git commit -m "feat(floor): animated water ribbon for river biomes"
```

---

## Task 5: Pollen weather type (`weather.js`)

**Files:**
- Modify: `src/world/weather.js` (the `TYPES` table)

**Interfaces:**
- Consumes: `biome.weather === 'pollen'` (Floor 4, from Task 2).
- Produces: a new entry in `TYPES`; no signature change.

- [ ] **Step 1: Add the type** — in `src/world/weather.js`, add this line to the `TYPES` object (after the `wind` entry):

```js
  pollen: { count: 500, color: 0xd8c079, size: 0.13, fall: 1.2, drift: 3, sway: 1.4, swayAxis: 0, lightning: false },
```

- [ ] **Step 2: Verify in the browser**

Run: `bun run dev`, open `?level=4`, click **Link start**.
Expected: slow golden motes drift and sway through the forest air (much slower than snow, gentle sideways drift). No console errors.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/world/weather.js
git commit -m "feat(weather): pollen motes for the Elderwood"
```

---

## Task 6: City street generator (`citylayout.js` + `town.js`)

**Files:**
- Create: `src/world/citylayout.js`
- Modify: `src/world/town.js` (import + a `biome.city` branch + `flags:'spine'` branch)
- Test: `test/citylayout.mjs`

**Interfaces:**
- Consumes: `biome.city` (`{ spineZ, halfWidth, step, jitter, palette, types, castle }`) from Task 2; the seeded `rng` already created in `createTown`; the existing `place`, `bp`, `tintObject`, `SCALE`, `getHeight` in `town.js`.
- Produces: `cityLayout(city, rng)` → `Array<{ type, color, x, z, yaw, castle? }>` (pure, no THREE/DOM).

- [ ] **Step 1: Write the failing test** — create `test/citylayout.mjs`:

```js
import assert from 'node:assert/strict';
import { cityLayout } from '../src/world/citylayout.js';

// deterministic rng (same mulberry32 town.js uses)
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const city = {
  spineZ: [16, 82], halfWidth: 11, step: 7, jitter: 2.2,
  palette: ['green', 'red', 'yellow'],
  types: ['home_A', 'home_B', 'tavern'],
  castle: { type: 'castle', color: 'yellow', x: 0, z: 95 },
};
const out = cityLayout(city, mulberry32(1337));

// z-steps 16,23,...,79 = 10 rows; 2 sides x 2 depth-rows = 4 per step = 40 + 1 castle
const steps = Math.floor((82 - 16) / 7) + 1;
assert.equal(out.length, steps * 4 + 1, 'building count');

const castle = out.find((b) => b.castle);
assert.ok(castle && castle.x === 0 && castle.z === 95, 'castle on the crag');

for (const b of out) {
  if (b.castle) continue;
  assert.ok(Math.abs(b.x) >= 11 - 2.2 && Math.abs(b.x) <= 19 + 2.2, `x in tenement rows: ${b.x}`);
  assert.ok(b.z >= 16 - 2.2 && b.z <= 82 + 2.2, `z on the spine: ${b.z}`);
  // +x side faces -x (yaw < 0), -x side faces +x (yaw > 0)
  assert.ok(b.x > 0 ? b.yaw < 0 : b.yaw > 0, 'faces the street');
  assert.ok(city.types.includes(b.type) && city.palette.includes(b.color), 'valid type/color');
}

console.log('citylayout.mjs OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/citylayout.mjs`
Expected: FAIL — `Cannot find module '../src/world/citylayout.js'`.

- [ ] **Step 3: Create `src/world/citylayout.js`:**

```js
// Pure city-street layout for Craghold (Floor 5). Given a `city` config and a
// seeded rng, return building placement specs the town builder turns into models.
// No THREE, no async, no DOM — kept pure so `node test/citylayout.mjs` can check it.

// face the street centreline (x=0): +x buildings turn to -x and vice-versa.
const faceStreet = (x) => Math.atan2(-x, 0.0001);

export function cityLayout(city, rng) {
  const { spineZ, halfWidth, step, palette, types, castle, jitter = 0 } = city;
  const rows = [halfWidth, halfWidth + 8]; // inner + outer tenement rows
  const out = [];
  for (let z = spineZ[0]; z <= spineZ[1]; z += step) {
    for (const side of [1, -1]) {
      for (const rx of rows) {
        const x = side * rx + (rng() - 0.5) * 2 * jitter;
        const zz = z + (rng() - 0.5) * 2 * jitter;
        const type = types[Math.floor(rng() * types.length)];
        const color = palette[Math.floor(rng() * palette.length)];
        out.push({ type, color, x, z: zz, yaw: faceStreet(x) });
      }
    }
  }
  out.push({ type: castle.type, color: castle.color, x: castle.x, z: castle.z, yaw: 0, castle: true });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/citylayout.mjs`
Expected: `citylayout.mjs OK`

- [ ] **Step 5: Wire it into `town.js`** — add the import at the top of `src/world/town.js` (after the existing imports):

```js
import { cityLayout } from './citylayout.js';
```

Then, inside `createTown`, immediately after the `settlement` placement loop (the `for (const [type, color, x, z] of biome.settlement)` block), add:

```js
  // --- dense city (Floor 5): buildings lining the Royal Mile spine + castle on the crag ---
  if (biome.city) {
    for (const b of cityLayout(biome.city, rng)) {
      place(root, bp(b.type, b.color), b.x, b.z, getHeight,
        { yaw: b.yaw, sink: b.castle ? 0.6 : 0.15, scale: b.castle ? SCALE * 1.6 : SCALE })
        .then((m) => { if (m) tintObject(m, tint); });
    }
  }
```

Finally, extend the flags block. Replace:

```js
  if (biome.flags) {
    const flags = ['flag_green', 'flag_yellow', 'flag_red'];
    [6, -8, -22, -36, -50].forEach((z, i) => {
      for (const x of [-7.5, 7.5]) {
        place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
      }
    });
  }
```

with:

```js
  const flags = ['flag_green', 'flag_yellow', 'flag_red'];
  if (biome.flags === true) {
    // Floor 1: bannered lane from the plaza toward the boss gate (−Z)
    [6, -8, -22, -36, -50].forEach((z, i) => {
      for (const x of [-7.5, 7.5]) {
        place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
      }
    });
  } else if (biome.flags === 'spine') {
    // Floor 5: banners down the Royal Mile (+Z)
    let i = 0;
    for (let z = 20; z <= 78; z += 12, i++) {
      for (const x of [-4.5, 4.5]) {
        place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
      }
    }
  }
```

- [ ] **Step 6: Verify in the browser**

Run: `bun run dev`, open `?level=5`, click **Link start**.
Expected: a dense street of mixed green/red/yellow-roofed buildings lines both sides of the +Z spine, all faced inward toward the centre; the castle sits raised on the crag ahead (z≈95); banners run down the middle; golems + the sealed gate are behind you in the −Z corridor. No `[CAO] model missing` for on-disk buildings.

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/world/citylayout.js src/world/town.js test/citylayout.mjs
git commit -m "feat(town): Craghold city street generator + Royal Mile banners"
```

---

## Task 7: Docs — update CLAUDE.md biome count

**Files:**
- Modify: `CLAUDE.md` (the "Biomes are data" paragraph)

**Interfaces:** none (docs only).

- [ ] **Step 1: Update the biome paragraph** — in `CLAUDE.md`, change the sentence beginning "The 3 floors (Verdant Town / Frostbound / Storm Peaks)…" to:

```
**Biomes are data, not code forks.** The 5 floors (Verdant Town / Frostbound / Storm Peaks / The Elderwood / Craghold) are configs in `world/biomes.js` (`getBiome`), selected via `?level=N` on the loading screen. `terrainHeight` (`floor.js`) switches on `terrain.shape` (`rolling` default, `valley`, `crag`); an optional `biome.river` carves a channel and `floor.js` lays an animated water ribbon; an optional `biome.city` drives the `world/citylayout.js` street generator (Craghold's Royal Mile). Weather (snow / rain+lightning / wind / pollen) lives in `world/weather.js`, driven by real `dt`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — 5 floors, terrain shapes, river, city generator"
```

---

## Self-Review

**Spec coverage:**
- Reuse packs, minimal new code → Tasks 1/4/6 add only terrain math, a ribbon, and a pure generator; everything else is data (Task 2). ✓
- Both floors are combat floors (gate + tinted golems) → `enemies`/`enemyTint` in both configs (Task 2). ✓
- Real animated water → Task 4 (ribbon + scrolling texture). ✓
- Per-biome terrain shapes (valley/crag) → Task 1. ✓
- Dense multi-species forest → Task 2 Floor 4 `trees` (both families × 3 sizes, ~280). ✓
- River → Tasks 1 (carve) + 4 (water) + Floor 4 `river` data. ✓
- Edinburgh city: castle crag + Royal Mile spine + dense lined buildings → Task 1 crag, Task 6 generator, Floor 5 `city`/`flags:'spine'`. ✓
- `pollen` weather → Task 5. ✓
- Level-select entries + clamp → Tasks 2 & 3. ✓
- Loading-screen preview JPGs deliberately out of scope → noted in Task 3. ✓
- Floors 1-3 unchanged → Task 1 regression assert + all new fields optional. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command has expected output. ✓

**Type consistency:** `configureTerrain(biome)` / `terrainHeight(x,z)` (Tasks 1,4); `cityLayout(city, rng)` returns `{type,color,x,z,yaw,castle?}` consumed identically in Task 6; `bp(type,color)` → `buildings/${color}/building_${type}_${color}` matches on-disk names (`building_home_A_green.gltf`, `building_castle_yellow.gltf`). `getBiome` clamp uses `BIOMES.length`. ✓
