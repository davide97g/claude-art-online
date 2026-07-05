# Portals & Level Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a floor's boss dies its forward portal activates; walking to a portal and pressing E plays a transition animation, then reloads into the target floor via the existing loading screen. Portals are two-way (+1 / −1) per floor, except Floor 1 (+1 only) and Floor 5 (−1 only).

**Architecture:** `world/floor.js` builds up to two portal meshes and owns their state/animation. `main.js` wires boss-death → open forward, per-frame portal proximity → HUD prompt, E-key → a CSS+camera transition that ends in `location.assign('?level=N')`. `biomes.js` gives floors 2–4 a boss. The existing `?level=N` reload path is the loading screen — no new loading code.

**Tech Stack:** Three.js (vanilla JS ES modules), Vite, bun. No test runner — verification is `bun run typecheck` + dev-server playtest (project convention; see CLAUDE.md and memory "No browser testing").

## Global Constraints

- **Version bump every commit** — `package.json` `version` is the on-screen version. This feature = **minor** bump (`0.10.0` → `0.11.0`), in the work commit.
- **GLB/degrade rule** — portals are primitive meshes (no GLB), so no fallback concern, but never `await`-block the loop.
- **`sdt` vs `dt`** — the transition animation eases the camera and must use **real `dt`** (ignores hit-stop), like `bossIntro`.
- **No new dependencies.** Three.js primitives only.
- **`[CAO]` log prefix** for any new console logs.
- **Isolated commits** — `git add` only the files each task lists; never `git add -A` (memory: parallel-editing-workflow).

---

### Task 1: HUD prompt method + transition overlay + input flag

Standalone, no behavior change on its own. Adds the `#portal-fade` overlay, the `hud.showPortalPrompt` method, and an `interact` input flag that Task 2 consumes.

**Files:**
- Modify: `index.html` (add `#portal-fade` CSS + div)
- Modify: `src/ui/hud.js` (add `showPortalPrompt`, remove `setGateNear`/`setGateOpen`)

**Interfaces:**
- Produces: `hud.showPortalPrompt(text | null)` — sets `#gate-msg` text + fades in when `text` is truthy, fades out when `null`.
- Produces: `#portal-fade` div with a `.go` class that blooms it over ~1.1s.

- [ ] **Step 1: Add the transition overlay CSS to `index.html`**

Find the `#lock-overlay` style rule (around line 56, inside `<style>`) and add this rule immediately after it:

```css
    #portal-fade { position: fixed; inset: 0; z-index: 20; pointer-events: none; opacity: 0; transform: scale(0.2); background: radial-gradient(circle at 50% 45%, rgba(255,240,180,0.95), rgba(120,200,255,0.6) 40%, rgba(5,8,15,0.97) 100%); transition: opacity 1s ease, transform 1.1s ease; }
    #portal-fade.go { opacity: 1; transform: scale(3); }
```

- [ ] **Step 2: Add the overlay div to `index.html`**

Find `<div id="lock-overlay">` (around line 109) and add this line immediately **before** it:

```html
  <div id="portal-fade"></div>
```

- [ ] **Step 3: Add `showPortalPrompt` to `src/ui/hud.js`**

Replace the `setGateOpen` method (lines ~111-114):

```js
  setGateOpen() {
    this.gateEl.textContent = 'Gate open · floor cleared';
    this.gateEl.style.color = '#ffd34d';
  }
```

with:

```js
  // Travel prompt on the gate-msg element: `text` shown+faded-in, null = hidden.
  showPortalPrompt(text) {
    if (text) { this.gateEl.textContent = text; this.gateEl.style.opacity = 1; }
    else this.gateEl.style.opacity = 0;
  }
```

- [ ] **Step 4: Remove the now-dead `setGateNear` from `src/ui/hud.js`**

Delete the `setGateNear` method (lines ~129-131):

```js
  setGateNear(near) {
    this.gateEl.style.opacity = near ? 1 : 0;
  }
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors. (Task 2 removes the last callers of the deleted methods; typecheck passes now because these are dynamic property accesses on a class — but load-check happens in Task 2.)

- [ ] **Step 6: Commit**

```bash
git add index.html src/ui/hud.js
git commit -m "feat(portal): HUD travel prompt + transition overlay scaffold"
```

---

### Task 2: Two-portal floor + main.js wiring + transition

The core. Refactors the single gate into up to two portals, rewires `main.js` to the new interface, and implements the E-to-travel transition. Depends on Task 1 (`showPortalPrompt`, `#portal-fade`, `interact` flag added here).

**Files:**
- Modify: `src/world/floor.js` (gate → two-portal builder + new return interface)
- Modify: `src/main.js` (portal proximity, E-travel, transition, open-on-cleared, boss.onDeath)

**Interfaces:**
- Consumes: `hud.showPortalPrompt(text|null)` (Task 1); `#portal-fade` overlay (Task 1); `progression.isCleared(id)`, `progression.clearFloor(id)`, `hud.showClear(name)` (existing).
- Produces (from `createFloor`): `{ portals, openForward(), update(t) }` where `portals` is an array of `{ dir: 1|-1, targetLevel: number, pos: THREE.Vector3, active: boolean }` (plus private `_` fields). Removes the old `gatePos` and `openGate` exports.

- [ ] **Step 1: Replace the gate build + gate-open state + return in `src/world/floor.js`**

In `src/world/floor.js`, keep `export const GATE_POS = new THREE.Vector3(0, 0, -120);` (line 63). Add a back-portal constant directly under it:

```js
export const GATE_POS = new THREE.Vector3(0, 0, -120);
export const BACK_POS = new THREE.Vector3(-12, 0, 6); // spawn-plaza (always clear), offset from gate corridor
```

Delete the entire `// --- boss gate (sealed) ---` block (lines ~95-115, from the `const gate = new THREE.Group();` down to and including `scene.add(gate);`). Replace it with a reusable portal builder — put this near the top of `createFloor` is not required; place the block where the old gate block was:

```js
  // --- portals: forward (+1) at the sealed gate, back (-1) near spawn ---
  // Reusable builder: two pillars, a spinning ring, a translucent disc, and a
  // hidden pulse ring that fires once on activation.
  function makePortal(pos) {
    const g = new THREE.Group();
    const pillarGeo = new THREE.BoxGeometry(1.3, 8, 1.3);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x545c6e, flatShading: true });
    const p1 = new THREE.Mesh(pillarGeo, pillarMat); p1.position.set(-3.2, 4, 0);
    const p2 = new THREE.Mesh(pillarGeo, pillarMat); p2.position.set(3.2, 4, 0);
    p1.castShadow = p2.castShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.22, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x66d9ff })
    );
    ring.position.y = 4.4;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.85, 40),
      new THREE.MeshBasicMaterial({ color: 0x1a3d5c, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    disc.position.y = 4.4;
    const pulse = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.3, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0 })
    );
    pulse.position.y = 4.4; pulse.visible = false;
    g.add(p1, p2, ring, disc, pulse);
    g.position.set(pos.x, terrainHeight(pos.x, pos.z), pos.z);
    scene.add(g);
    return { ring, disc, pulse };
  }

  // gold ring + bright disc = the "open/active" look
  function setActiveLook(mesh) {
    mesh.ring.material.color.setHex(0xffd34d);
    mesh.disc.material.color.setHex(0x9fd8ff);
  }

  const portals = [];
  if (biome.id < 5) { // forward portal, sealed until the boss dies
    const pos = new THREE.Vector3(GATE_POS.x, terrainHeight(GATE_POS.x, GATE_POS.z), GATE_POS.z);
    portals.push({ dir: 1, targetLevel: biome.id + 1, pos, active: false, _bias: 0, _pulse: null, _m: makePortal(GATE_POS) });
  }
  if (biome.id > 1) { // back portal, always open (the way here is already cleared)
    const pos = new THREE.Vector3(BACK_POS.x, terrainHeight(BACK_POS.x, BACK_POS.z), BACK_POS.z);
    const m = makePortal(BACK_POS);
    setActiveLook(m);
    portals.push({ dir: -1, targetLevel: biome.id - 1, pos, active: true, _bias: 0, _pulse: null, _m: m });
  }
```

- [ ] **Step 2: Replace the gate-open state + return block in `src/world/floor.js`**

Delete the `// gate-open state:` comment + `let gateOpen = false, spinBias = 0, lastT = 0;` line (~189-191) and the whole `return { gatePos, openGate, update } ...` object (~193-210). Replace with:

```js
  // portal animation state; lastT lets openForward keep the ring spin continuous.
  let lastT = 0;

  return {
    portals,
    // Called on boss death (and on load for a cleared floor): activate the forward portal.
    openForward() {
      const P = portals.find((p) => p.dir === 1);
      if (!P || P.active) return;
      P.active = true;
      P._bias = lastT * (0.4 - 1.6); // keep ring.rotation.z continuous across the speed jump
      setActiveLook(P._m);
      P._pulse = lastT; // fire the activation pulse
    },
    update(t) {
      lastT = t;
      for (const P of portals) {
        const m = P._m;
        m.ring.rotation.z = P.active ? t * 1.6 + P._bias : t * 0.4;
        m.disc.material.opacity = P.active ? 0.75 + Math.sin(t * 3) * 0.15 : 0.65 + Math.sin(t * 1.6) * 0.1;
        if (P._pulse != null) { // expanding-ring activation flourish (~0.6s)
          const e = t - P._pulse;
          if (e < 0.6) { m.pulse.visible = true; m.pulse.scale.setScalar(1 + (e / 0.6) * 2); m.pulse.material.opacity = 0.8 * (1 - e / 0.6); }
          else { m.pulse.visible = false; P._pulse = null; }
        }
      }
      for (const r of floaters) r.position.y = r.userData.baseY + Math.sin(t * 0.3 + r.userData.phase) * 2.5;
      if (water) water.material.map.offset.y = -t * 0.06;
    },
  };
```

- [ ] **Step 3: Add the `interact` input flag + E keybind in `src/main.js`**

Change the input object (line 50):

```js
const input = { keys: {}, dx: 0, dy: 0, attackQueued: false, locked: false };
```

to:

```js
const input = { keys: {}, dx: 0, dy: 0, attackQueued: false, interact: false, locked: false };
```

In the `keydown` listener (lines ~172-175), add the E binding. Change:

```js
document.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyM') music.muted = !music.muted; // toggle background music
});
```

to:

```js
document.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyM') music.muted = !music.muted; // toggle background music
  if (e.code === 'KeyE' && input.locked) input.interact = true; // consumed once in the loop
});
```

- [ ] **Step 4: Add transition state + open-on-cleared in `src/main.js`**

Immediately after `const floor = createFloor(scene, biome);` (line 189), add:

```js
if (progression.isCleared(biome.id)) floor.openForward(); // re-visit a cleared floor → portal already open
```

After the `world` object definition (after line 183, the `};` closing `world`), add the transition state and helper:

```js
// --- level transition (portal → animated wipe → reload into the loading screen) ---
const PORTAL_RADIUS = 6;
const TRANS_DUR = 1.1;
const fadeEl = document.getElementById('portal-fade');
const camStart = new THREE.Vector3();
let transitioning = false, transT = 0, transPortal = null, transTarget = 0;
function startTransition(P) {
  transitioning = true; transT = 0; transPortal = P; transTarget = P.targetLevel;
  camStart.copy(camera.position);
  input.attackQueued = false; input.interact = false;
  fadeEl.classList.add('go');
  console.log('[CAO] portal → floor', transTarget);
}
```

Note: `camera` is defined (line 36) and `input` (line 50) before this point; `player`/`floor` are used only inside `tick`, so referencing them is fine.

- [ ] **Step 5: Rewire boss.onDeath in `src/main.js`**

Change the boss.onDeath block (lines ~235-240):

```js
  boss.onDeath = () => {
    floor.openGate();
    hud.setGateOpen();
    hud.showClear(`Floor ${biome.id}`);
    progression.clearFloor(biome.id);
  };
```

to:

```js
  boss.onDeath = () => {
    floor.openForward();
    hud.showClear(`Floor ${biome.id}`);
    progression.clearFloor(biome.id);
  };
```

- [ ] **Step 6: Add the transition early-branch + portal proximity in the loop (`src/main.js`)**

In `tick()`, right after `const sdt = dt * world.timeScale;` (line 260), add the transition branch:

```js
  if (transitioning) {
    transT += dt;
    const k = Math.min(1, transT / TRANS_DUR);
    camera.position.lerpVectors(camStart, transPortal.pos, k * 0.6);
    camera.lookAt(transPortal.pos.x, transPortal.pos.y + 4.4, transPortal.pos.z);
    camera.fov = 62 + k * 20; camera.updateProjectionMatrix();
    floor.update(elapsed);
    weather.update(dt, player.pos);
    renderer.render(scene, camera);
    if (k >= 1) location.assign('?level=' + transTarget);
    return; // raf already scheduled at top of tick
  }
```

Then replace the gate-near line (line ~274):

```js
  hud.setGateNear(player.pos.distanceTo(floor.gatePos) < 14);
```

with portal proximity + E-travel:

```js
  let nearPortal = null, nearDist = Infinity;
  for (const P of floor.portals) {
    const d = player.pos.distanceTo(P.pos);
    if (d < PORTAL_RADIUS && d < nearDist) { nearDist = d; nearPortal = P; }
  }
  if (!nearPortal) hud.showPortalPrompt(null);
  else if (nearPortal.active) hud.showPortalPrompt(`Press E · Floor ${nearPortal.targetLevel}`);
  else hud.showPortalPrompt('Defeat the boss');
  if (input.interact && nearPortal && nearPortal.active && !transitioning) startTransition(nearPortal);
  input.interact = false;
```

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: no errors. If it flags `floor.gatePos` or `openGate` anywhere, grep for stragglers: `grep -rn "gatePos\|openGate\|setGateNear\|setGateOpen" src` should return nothing.

- [ ] **Step 8: Dev-server playtest**

Run: `bun run dev`, open the printed URL.
- `?level=2`: back portal (gold ring) visible near spawn at `(-12,·,6)`; forward portal at the gate is sealed (cyan, slow spin). Console: `[CAO] progress loaded…`.
- Walk to the back portal → HUD shows `Press E · Floor 1`. Press E → overlay blooms ~1.1s, camera dollies in, then reloads to Floor 1's loading screen. Click "Enter Aincrad" — spawns on Floor 1.
- Approach the sealed forward portal → HUD shows `Defeat the boss`; E does nothing.
- Kill the boss (`window.CAO.enemies` in console, or fight it) → forward ring turns gold, a pulse ring expands once, spin speeds up. Walk to it → `Press E · Floor 3` → travels.

- [ ] **Step 9: Commit**

```bash
git add src/world/floor.js src/main.js
git commit -m "feat(portal): two-way portals + E-to-travel transition to next/prev floor"
```

---

### Task 3: Bosses guard the forward portal on floors 2–4

Adds `boss` to floors 2, 3, 4 so their forward portal is boss-gated like Floor 1. Floor 5 stays boss-less (dead-end terminus).

**Files:**
- Modify: `src/world/biomes.js` (add `boss` field to floors 2, 3, 4)

**Interfaces:**
- Consumes: the existing `if (biome.boss)` branch in `main.js` (unchanged) that instantiates `KoboldLord` and hooks `onDeath`/`onWake`.
- Produces: `biome.boss = { x, z }` on floors 2, 3, 4.

- [ ] **Step 1: Add boss to Floor 2**

In `src/world/biomes.js`, find (the Floor 2 enemies close, just before Floor 3's header):

```js
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },

  { // ---------- Floor 3: Storm Peaks ----------
```

Replace with:

```js
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
    boss: { x: 0, z: -112 },
  },

  { // ---------- Floor 3: Storm Peaks ----------
```

- [ ] **Step 2: Add boss to Floor 3**

Find (Floor 3 enemies close, just before Floor 4's header):

```js
      { type: 'golem', x: 30, z: -50 },
    ],
  },

  { // ---------- Floor 4: The Elderwood (deep ancient forest) ----------
```

Replace with:

```js
      { type: 'golem', x: 30, z: -50 },
    ],
    boss: { x: 0, z: -112 },
  },

  { // ---------- Floor 4: The Elderwood (deep ancient forest) ----------
```

- [ ] **Step 3: Add boss to Floor 4**

Find (Floor 4 enemies close, just before Floor 5's header):

```js
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },

  { // ---------- Floor 5: Craghold (Edinburgh-inspired medieval city) ----------
```

Replace with:

```js
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
    boss: { x: 0, z: -112 },
  },

  { // ---------- Floor 5: Craghold (Edinburgh-inspired medieval city) ----------
```

- [ ] **Step 4: Typecheck + dev-server check**

Run: `bun run typecheck` → no errors.
Run `bun run dev`, load `?level=3` → the Kobold Lord boss is present at the gate (intro cutscene on wake); killing it opens the forward portal. Load `?level=5` → no boss, no forward portal, only the back portal to Floor 4.

- [ ] **Step 5: Commit**

```bash
git add src/world/biomes.js
git commit -m "feat(portal): bosses guard the forward portal on floors 2-4"
```

> **Note (skipped, YAGNI):** the boss is not retinted per biome — `KoboldLord`'s constructor takes no tint and `main.js` doesn't pass `biome.enemyTint` to it (only golems are tinted). Every floor's boss looks identical. Add a tint param to `KoboldLord` later if the sameness reads poorly.

---

### Task 4: Version bump + doc drift

**Files:**
- Modify: `package.json` (version)
- Modify: `CLAUDE.md` (gate → portals note)

**Interfaces:** none.

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "0.10.0"` to `"version": "0.11.0"`.

- [ ] **Step 2: Update the CLAUDE.md gate note**

In `CLAUDE.md`, the "Floor population" / floor.js paragraph and the `floor.js` description say it owns the sealed gate. Update the sentence describing `floor.js` (currently "floor.js now owns only terrain + gate + sky") to reflect two portals. Find:

```
`floor.js` now owns only terrain + gate + sky;
```

Replace with:

```
`floor.js` now owns terrain + two travel portals (forward `+1` sealed until the boss dies, back `-1` open) + sky;
```

Also update the gate-open sentence near the end of the Three.js architecture section if present; search `openGate` in CLAUDE.md and, if found, replace mentions of `openGate`/single gate with `openForward` and the two-portal model. If no such mention exists, skip.

- [ ] **Step 3: Typecheck + verify version renders**

Run: `bun run typecheck` → no errors.
Run `bun run dev` → bottom-left HUD shows `v0.11.0`.

- [ ] **Step 4: Commit**

```bash
git add package.json CLAUDE.md
git commit -m "chore: bump to v0.11.0; doc portals in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- Two portals per floor, F1 +1-only / F5 −1-only → Task 2 Step 1 (`biome.id < 5` / `> 1` guards). ✓
- Forward sealed until boss, open-on-cleared → Task 2 Steps 1,4,5. ✓
- Bosses on 2–4 → Task 3. ✓
- E-to-travel + prompt → Task 2 Steps 3,6. ✓
- Transition animation → Task 1 (overlay) + Task 2 Step 6 (camera dolly + navigate). ✓
- Loading screen reuse → `location.assign('?level=N')` (no new code). ✓
- HUD `showPortalPrompt` replaces `setGateNear`/`setGateOpen` → Task 1 Steps 3,4; callers removed Task 2. ✓
- Activation flourish (pulse) → Task 2 Steps 1,2. ✓
- Version minor bump + doc drift → Task 4. ✓

**Placeholder scan:** none — all steps show full code/anchors.

**Type consistency:** `openForward()`, `portals` (array of `{dir,targetLevel,pos,active,_bias,_pulse,_m}`), `showPortalPrompt(text)`, `input.interact`, `startTransition(P)` are named identically across tasks. Removed exports `gatePos`/`openGate`/`setGateNear`/`setGateOpen` have no remaining callers (verified by the grep in Task 2 Step 7).
