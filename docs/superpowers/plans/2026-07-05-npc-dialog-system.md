# NPC Dialog System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add talkable NPCs to Floor 1 — 5 named story characters with branching dialogue trees plus a one-liner for every other villager — presented in an SAO-glass panel with an over-shoulder two-shot camera where both figures keep idling.

**Architecture:** One new pure-data module (`dialogue.js`) holds the trees and crowd lines. One new UI class (`ui/dialog.js`) owns the panel DOM, the conversation state machine, its own keydown listener, and the two-shot camera (ease-in → hold → ease-back, mirroring `combat/cutscene.ts`). Three existing systems get small edits: `controller.js` gains a `talking` freeze that skips its camera block, `npc.js` spawns the named NPCs and exposes `nearestTalkable`, and `main.js` wires the E key, freezes the blade during talk, and drives the dialog camera.

**Tech Stack:** Three.js (vanilla JS ES modules), Vite, bun. No test runner — `node test/*.mjs` for pure logic, `bun run typecheck` for static checking, manual browser verification for runtime.

## Global Constraints

- **Bump `package.json` `version` `0.14.1` → `0.15.0`** in the final task's commit (new feature → minor).
- **Graceful degradation:** every GLB load must keep a gray-box fallback; the game is fully playable with zero models. Named NPCs reuse the existing archetype-fallback path.
- **`sdt` vs `dt`:** gameplay/animation timers that must freeze under hit-stop use `sdt`; camera/cosmetic easing uses real `dt`. Dialog camera and typewriter use `dt`.
- **Cel shading:** never `new THREE.MeshLambertMaterial`; loaded GLBs go through `toonifyObject`. (No new 3D materials in this feature — UI is DOM/CSS.)
- **Pointer lock stays engaged during dialog** — all dialog input is keyboard; no cursor.
- **`dialogue.js` must have zero imports** so `node test/dialogue.mjs` can load it directly.
- Runtime logs prefixed `[CAO]`.

---

### Task 1: Dialogue data module + integrity test

**Files:**
- Create: `src/world/dialogue.js`
- Test: `test/dialogue.mjs`

**Interfaces:**
- Produces:
  - `export const NAMED_BY_FLOOR` — `{ [floorId: number]: Array<{ name: string, tag: string, model: string, pos: {x:number,z:number}, root: string, nodes: { [key:string]: { text: string, choices: Array<{ label: string, to: string|null }> } } }> }`. `model` is a key into `NPC_MODELS` in `npc.js`. `to` is a node key in the same NPC's `nodes`, or `null` to end.
  - `export const CROWD_LINES` — `string[]`.

- [ ] **Step 1: Write the failing test**

Create `test/dialogue.mjs`:

```js
import assert from 'node:assert/strict';
import { NAMED_BY_FLOOR, CROWD_LINES } from '../src/world/dialogue.js';

// model keys that exist in src/world/npc.js NPC_MODELS
const MODELS = new Set([
  'worker_male', 'worker_female', 'oldclassy_male', 'oldclassy_female', 'chef_male',
  'elf', 'casual_male', 'casual_female', 'viking_male', 'kimono_female', 'rpg_monk',
  'knight_male', 'rpg_warrior', 'rpg_rogue', 'rpg_ranger', 'rpg_cleric', 'witch',
  'wizard', 'knight_golden_female',
]);

assert.ok(Array.isArray(CROWD_LINES) && CROWD_LINES.length >= 6, 'crowd lines present');
for (const l of CROWD_LINES) assert.equal(typeof l, 'string', 'crowd line is a string');

let npcCount = 0;
for (const [floor, list] of Object.entries(NAMED_BY_FLOOR)) {
  for (const npc of list) {
    npcCount++;
    assert.ok(npc.name && npc.tag, `floor ${floor}: name+tag`);
    assert.ok(MODELS.has(npc.model), `floor ${floor} ${npc.name}: model "${npc.model}" exists in NPC_MODELS`);
    assert.ok(npc.nodes[npc.root], `${npc.name}: root "${npc.root}" is a real node`);
    for (const [key, node] of Object.entries(npc.nodes)) {
      assert.ok(typeof node.text === 'string' && node.text.length, `${npc.name}.${key}: has text`);
      assert.ok(node.choices.length >= 1, `${npc.name}.${key}: has choices`);
      for (const c of node.choices) {
        assert.ok(c.label, `${npc.name}.${key}: choice label`);
        assert.ok(c.to === null || npc.nodes[c.to], `${npc.name}.${key}: choice.to "${c.to}" is null or a real node`);
      }
    }
    // every non-root node must be reachable from root
    const seen = new Set(), stack = [npc.root];
    while (stack.length) {
      const k = stack.pop();
      if (seen.has(k)) continue;
      seen.add(k);
      for (const c of npc.nodes[k].choices) if (c.to) stack.push(c.to);
    }
    for (const k of Object.keys(npc.nodes)) assert.ok(seen.has(k), `${npc.name}: node "${k}" reachable from root`);
  }
}
assert.ok(npcCount >= 5, 'at least 5 named NPCs');
console.log(`OK — ${npcCount} named NPCs, ${CROWD_LINES.length} crowd lines`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/dialogue.mjs`
Expected: FAIL — `Cannot find module '../src/world/dialogue.js'`.

- [ ] **Step 3: Write the data module**

Create `src/world/dialogue.js`:

```js
// NPC dialogue data — PURE DATA, NO IMPORTS (so test/dialogue.mjs runs under node).
//
// Named story NPCs per floor: each has a branching tree. A node is
// { text, choices: [{ label, to }] } where `to` is another node key in the SAME
// NPC, or null to end the conversation. `model` is a key into NPC_MODELS (npc.js);
// `pos` is a fixed town post (grounded on load; push-out resolves any overlap).
// Generic villagers speak one CROWD_LINES entry, chosen by their index (stable).

export const NAMED_BY_FLOOR = {
  1: [
    {
      name: 'Argo', tag: 'Information Broker', model: 'rpg_rogue',
      pos: { x: 5, z: 15 }, root: 'start',
      nodes: {
        start: {
          text: "Heehee. Name's Argo — the Rat, if you're rude about it. I trade in whispers. What're you after, friend?",
          choices: [
            { label: 'Any rumors worth hearing?', to: 'rumors' },
            { label: 'What about the gate?', to: 'gate' },
            { label: 'Just passing through.', to: null },
          ],
        },
        rumors: {
          text: "The moss golems on the gate road telegraph before they swing — watch the eyes. Free tip. The rest'll cost you Col.",
          choices: [
            { label: 'And the boss?', to: 'gate' },
            { label: 'Thanks, Argo.', to: null },
          ],
        },
        gate: {
          text: "Rendfang holds the gate to Floor Two. Clear the field first — nobody solos that thing cold. Come back sharper.",
          choices: [{ label: 'Got it.', to: null }],
        },
      },
    },
    {
      name: 'Klein', tag: 'Hot-Blooded Swordsman', model: 'knight_male',
      pos: { x: -8, z: 14 }, root: 'start',
      nodes: {
        start: {
          text: "Hah! A fresh face on Floor One! Klein's the name. Don't rush the gate, rookie — grind the boars, get a feel for the blade.",
          choices: [
            { label: 'Any combat advice?', to: 'tips' },
            { label: "Not clearing it yourself?", to: 'guild' },
            { label: 'See you around.', to: null },
          ],
        },
        tips: {
          text: "Land a clean hit and time slows for a beat — that's your cue. Left-click again mid-swing and it chains. Flow, don't flail!",
          choices: [{ label: 'Nice. Thanks.', to: null }],
        },
        guild: {
          text: "Got my guildmates to keep alive first — we move together. You look like the solo type. Respect. Just don't die out there.",
          choices: [{ label: 'No promises.', to: null }],
        },
      },
    },
    {
      name: 'Sister Sasha', tag: 'Keeper of the Chapel', model: 'rpg_cleric',
      pos: { x: -20, z: 30 }, root: 'start',
      nodes: {
        start: {
          text: "Welcome, traveler. The chapel shelters those the floors have worn thin. Rest here whenever the road turns cruel.",
          choices: [
            { label: 'Who do you shelter?', to: 'orphans' },
            { label: 'Any words before I fight?', to: 'blessing' },
            { label: 'Thank you, Sister.', to: null },
          ],
        },
        orphans: {
          text: "Children, mostly — the kin of cleared players, the lost, the frightened. This game took much from them. Kindness costs nothing.",
          choices: [
            { label: 'A blessing, then?', to: 'blessing' },
            { label: "I'll remember that.", to: null },
          ],
        },
        blessing: {
          text: "May your hand be steady and your retreat be swift. Living to fight again is not cowardice — it is wisdom.",
          choices: [{ label: 'Amen.', to: null }],
        },
      },
    },
    {
      name: 'Bahr', tag: 'Town Blacksmith', model: 'worker_male',
      pos: { x: -14, z: 8 }, root: 'start',
      nodes: {
        start: {
          text: "Mind the sparks. I'm Bahr — I keep the town's steel honest. That blade of yours seen a whetstone lately?",
          choices: [
            { label: 'Tell me about my sword.', to: 'sword' },
            { label: 'Seen anything strange?', to: 'strange' },
            { label: 'Later, smith.', to: null },
          ],
        },
        sword: {
          text: "A clean edge bites deeper — every level you earn, your swings land heavier. Keep killing, keep growing. The steel follows.",
          choices: [{ label: 'Good to know.', to: null }],
        },
        strange: {
          text: "The golems past the fields — their cores glow like my forge when they wind up to strike. Unnatural. Watch that glow.",
          choices: [{ label: "I'll watch for it.", to: null }],
        },
      },
    },
    {
      name: 'The Hooded One', tag: 'Keeper of Secrets', model: 'wizard',
      pos: { x: 3, z: 48 }, root: 'start',
      nodes: {
        start: {
          text: "...You climb. They all climb. One hundred floors stacked toward a sky that isn't real. Do you know what waits at the top?",
          choices: [
            { label: 'What waits at the top?', to: 'top' },
            { label: 'How do I get out?', to: 'out' },
            { label: 'You talk in riddles.', to: null },
          ],
        },
        top: {
          text: "Freedom, or its shadow. Clear every floor and the cage opens. But the tower counts its dead, and it is patient. Climb anyway.",
          choices: [
            { label: 'And if I fall?', to: 'out' },
            { label: 'Then I climb.', to: null },
          ],
        },
        out: {
          text: "There is no logout. There is only up. Reach the summit — or make peace with the floors. Those are the only doors that open.",
          choices: [{ label: '...', to: null }],
        },
      },
    },
  ],
};

export const CROWD_LINES = [
  'Another climber, huh? Stay sharp out there.',
  'Heard the boars are thick on the gate road today.',
  'I sell nothing and know less. Good day.',
  'You cleared for the front line? Rather you than me.',
  "The chapel's the one safe place left. Sister Sasha keeps it so.",
  "Watch the golems. My cousin didn't, and he... well.",
  'Two years trapped and I still miss real bread.',
  'Link start, they said. Best day of our lives, they said.',
  "You've got that 'gonna clear it' look. Good luck.",
  "I'll buy you a drink at the tavern if you make it back.",
  "Keep your blade up. This floor's kinder than the ones above.",
  'Mind the well — the kids keep dropping things down it.',
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/dialogue.mjs`
Expected: PASS — `OK — 5 named NPCs, 12 crowd lines`.

- [ ] **Step 5: Commit**

```bash
git add src/world/dialogue.js test/dialogue.mjs
git commit -m "feat(npc): dialogue data — 5 named NPCs + crowd lines, integrity test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Player talking-freeze in the controller

**Files:**
- Modify: `src/player/controller.js` (constructor ~line 20; `update` ~line 170)

**Interfaces:**
- Produces: `player.talking: boolean` (default `false`) and `player.faceTarget: THREE.Vector3|null` (default `null`). When `talking` is true, `player.update(dt, sdt)` holds position, turns the model toward `faceTarget`, keeps the idle animation ticking, and **does not write the camera** (the Dialog owns it).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Add the fields to the constructor**

In `src/player/controller.js`, find the camera-zoom fields in the constructor (the block with `this.camDist = 5.4;`) and add after `this.camDistMax = 11;`:

```js
    // dialogue: while talking, movement + camera-orbit freeze and the Dialog
    // system owns the camera (see ui/dialog.js). faceTarget = who to look at.
    this.talking = false;
    this.faceTarget = null;
```

- [ ] **Step 2: Add the freeze branch at the top of `update`**

In `update(dt, sdt)`, immediately after the `if (this.dead) { ... }` block and before the `// camera orbit` comment, insert:

```js
    // dialogue freeze: hold ground, face the speaker, keep idling. Returns before
    // the camera block so ui/dialog.js can own the camera for the two-shot.
    if (this.talking) {
      this.speedNow = 0;
      if (this.faceTarget) {
        const ty = Math.atan2(this.faceTarget.x - this.pos.x, this.faceTarget.z - this.pos.z);
        let d = ty - this.group.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.group.rotation.y += d * Math.min(1, dt * 8);
      }
      this.group.position.copy(this.pos);
      if (this.mixer) { this.fade('idle'); this.mixer.update(sdt); }
      return;
    }
```

- [ ] **Step 3: Verify the static check passes**

Run: `bun run typecheck`
Expected: no errors (controller.js is `.js`, `checkJs:false` — this confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add src/player/controller.js
git commit -m "feat(player): talking freeze — hold + face target, idle, yield camera

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Named NPCs + `nearestTalkable` in `npc.js`

**Files:**
- Modify: `src/world/npc.js` (imports; `Villagers` constructor; `update`)

**Interfaces:**
- Consumes: `NAMED_BY_FLOOR`, `CROWD_LINES` from `src/world/dialogue.js` (Task 1). `player.talking`/`faceTarget` are unrelated here.
- Produces:
  - `villagers.talkingWith: person|null` — set by main.js; that person stops strolling and faces the player.
  - `villagers.nearestTalkable(pos: THREE.Vector3|{x,z}, range: number)` → `{ person, identity }` or `null`. For named NPCs `identity = { name, tag, tree: { root, nodes } }`; for generic villagers `identity = { name: 'Villager', line: string }`.
  - `villagers.update(dt, playerPos)` — new second param (the player world position, used to face `talkingWith`).
  - Each `person` object gains optional `static: boolean` and `identity` (named only; generic stays absent/`undefined`).

- [ ] **Step 1: Add the import**

At the top of `src/world/npc.js`, below the existing imports, add:

```js
import { NAMED_BY_FLOOR, CROWD_LINES } from './dialogue.js';
```

- [ ] **Step 2: Initialize `talkingWith` in the constructor**

In the `Villagers` constructor, find `this.people = [];` and add right after it:

```js
    this.talkingWith = null; // set by main.js while a conversation is open
```

- [ ] **Step 3: Spawn the named NPCs**

In the constructor, find the line `if (NPC_MODELS.length) this.loadModels();` (end of constructor). Immediately BEFORE it, insert:

```js
    // named story NPCs for this floor: fixed posts, no strolling, real identities.
    // modelIdx points at their chosen model so loadModels() upgrades them like anyone else.
    for (const d of (NAMED_BY_FLOOR[biome.id] || [])) {
      const modelIdx = MODEL_INDEX[d.model];
      if (modelIdx === undefined) continue;
      const g = makePerson(ARCHETYPES[NPC_MODELS[modelIdx].fb]);
      g.position.set(d.pos.x, getHeight(d.pos.x, d.pos.z), d.pos.z);
      g.rotation.y = Math.PI; // face -Z, toward the spawn plaza
      scene.add(g);
      this.people.push({
        g, modelIdx, home: { x: d.pos.x, z: d.pos.z }, tx: d.pos.x, tz: d.pos.z,
        wait: 0, speed: 0, static: true,
        identity: { name: d.name, tag: d.tag, tree: { root: d.root, nodes: d.nodes } },
        mixer: null, actions: null, current: null,
      });
    }
```

- [ ] **Step 4: Add `nearestTalkable`**

In the `Villagers` class, add this method (e.g. right after `inCollider`):

```js
  // closest person within `range` of `pos`, with an identity to talk to.
  // named NPCs carry their own; everyone else gets a stable crowd one-liner.
  nearestTalkable(pos, range) {
    let best = null, bestIdx = -1, bestD = range;
    this.people.forEach((p, i) => {
      const d = Math.hypot(p.g.position.x - pos.x, p.g.position.z - pos.z);
      if (d < bestD) { bestD = d; best = p; bestIdx = i; }
    });
    if (!best) return null;
    const identity = best.identity
      || { name: 'Villager', line: CROWD_LINES[bestIdx % CROWD_LINES.length] };
    return { person: best, identity };
  }
```

- [ ] **Step 5: Rework `update` to honour `talkingWith` and `static`**

Replace the entire `update(dt) { ... }` method with:

```js
  // dt (real time) — ambient life ignores hit-stop, like the weather/camera.
  // playerPos lets the person we're talking to turn and face the player.
  update(dt, playerPos) {
    for (const p of this.people) {
      const g = p.g;
      let moving = false;

      if (p === this.talkingWith) {
        // frozen in conversation: face the player, hold idle
        if (playerPos) {
          const ty = Math.atan2(playerPos.x - g.position.x, playerPos.z - g.position.z);
          let d = ty - g.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          g.rotation.y += d * Math.min(1, dt * 8);
        }
      } else if (!p.static) {
        const dx = p.tx - g.position.x, dz = p.tz - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) {
          p.wait -= dt;
          if (p.wait <= 0) { // pick a new stroll target near home
            const a = Math.random() * Math.PI * 2, r = Math.random() * 5;
            p.tx = p.home.x + Math.cos(a) * r;
            p.tz = p.home.z + Math.sin(a) * r;
            p.wait = 1.5 + Math.random() * 3;
          }
        } else {
          moving = true;
          const step = Math.min(d, p.speed * dt);
          g.position.x += (dx / d) * step;
          g.position.z += (dz / d) * step;
          const yaw = Math.atan2(dx, dz);
          let diff = yaw - g.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          g.rotation.y += diff * Math.min(1, dt * 6);
        }
      }

      // shared push-out keeps them out of buildings/trees
      const out = resolvePushOut(g.position.x, g.position.z, 0.3, this.colliders);
      g.position.set(out.x, this.getHeight(out.x, out.z), out.z);

      // animation (GLB people only): crossfade idle <-> walk
      if (p.mixer) {
        const want = (moving && p.actions.walk) ? p.actions.walk : (p.actions.idle || p.actions.walk);
        if (want && want !== p.current) {
          want.reset().fadeIn(0.2).play();
          if (p.current) p.current.fadeOut(0.2);
          p.current = want;
        }
        p.mixer.update(dt);
      }
    }
  }
```

- [ ] **Step 6: Verify the data test still passes and typecheck is clean**

Run: `node test/dialogue.mjs && bun run typecheck`
Expected: `OK — 5 named NPCs, 12 crowd lines` then no typecheck errors.

- [ ] **Step 7: Commit**

```bash
git add src/world/npc.js
git commit -m "feat(npc): spawn named NPCs + nearestTalkable + talk-freeze

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Dialog UI — panel, state machine, two-shot camera

**Files:**
- Create: `src/ui/dialog.js`
- Modify: `index.html` (add `#dialog` DOM inside `#hud`; add CSS in the `<style>` block)

**Interfaces:**
- Consumes: `player` (`.pos`, `.talking`, `.faceTarget`), `villagers` (`.talkingWith`), `camera` (Task 2/3). Identity shape from `nearestTalkable` (Task 3): `{ name, tag?, tree? , line? }`.
- Produces:
  - `new Dialog({ player, villagers, camera })`
  - `dialog.open(identity, person)` — opens the panel + starts the camera ease-in.
  - `dialog.close()` — begins the ease-back (also safe to call externally, e.g. on pointer-unlock).
  - `dialog.updateCamera(dt)` — call every frame AFTER `player.update`; drives typewriter + camera.
  - `dialog.active` (getter) — `true` while `open` or `closing`.

- [ ] **Step 1: Add the panel DOM**

In `index.html`, inside `<div id="hud">`, add just before `<div id="version"></div>`:

```html
    <div id="dialog">
      <div id="dlg-head"><span id="dlg-name"></span><span id="dlg-tag"></span></div>
      <div id="dlg-text"></div>
      <div id="dlg-choices"></div>
    </div>
```

- [ ] **Step 2: Add the CSS**

In `index.html`, inside the `<style>` block, add before the `/* --- loading screen --- */` comment:

```css
    /* --- NPC dialogue panel (SAO glass) --- */
    #dialog { position: absolute; left: 50%; bottom: 40px; transform: translate(-50%, 12px); width: min(680px, 88vw); padding: 18px 22px 20px; border-radius: 12px; background: linear-gradient(135deg, rgba(8,12,20,0.9), rgba(8,12,20,0.62)); border: 1px solid rgba(127,212,255,0.22); border-left: 2px solid rgba(127,212,255,0.7); backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px); box-shadow: 0 10px 34px rgba(0,0,0,0.5); opacity: 0; pointer-events: none; transition: opacity 0.32s ease, transform 0.32s ease; z-index: 7; }
    #dialog.show { opacity: 1; transform: translate(-50%, 0); }
    #dlg-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
    #dlg-name { font-size: 17px; font-weight: 700; letter-spacing: 0.1em; color: #eaf6ff; text-transform: uppercase; }
    #dlg-tag { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #7fd4ff; opacity: 0.85; }
    #dlg-text { font-size: 15px; line-height: 1.55; color: #dbe8f7; min-height: 46px; text-shadow: 0 1px 4px rgba(0,0,0,0.6); }
    #dlg-choices { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
    .dlg-choice { padding: 8px 14px; border: 1px solid rgba(127,212,255,0.28); border-radius: 6px; color: #cfe6ff; font-size: 13px; letter-spacing: 0.04em; transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
    .dlg-choice.selected { border-color: #7fd4ff; background: rgba(127,212,255,0.16); color: #eaf6ff; transform: translateX(3px); box-shadow: 0 0 0 1px rgba(127,212,255,0.4); }
```

- [ ] **Step 3: Write the Dialog class**

Create `src/ui/dialog.js`:

```js
import * as THREE from 'three';

// SAO-style branching dialogue. Owns the panel DOM, the conversation state
// machine, its own keydown listener (pointer lock stays on — keyboard only),
// and the over-shoulder two-shot camera (ease-in -> hold -> ease-back, the same
// smoothstep pattern as combat/cutscene.ts). Camera/typewriter run on real dt.

const INTRO = 0.5;   // camera ease-in seconds
const OUTRO = 0.4;   // camera ease-back seconds
const TYPE_SPEED = 45; // characters per second

function smooth(k) { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); }

export class Dialog {
  constructor({ player, villagers, camera }) {
    this.player = player;
    this.villagers = villagers;
    this.camera = camera;
    this.phase = 'idle'; // idle -> open -> closing -> idle

    this.el = document.getElementById('dialog');
    this.nameEl = document.getElementById('dlg-name');
    this.tagEl = document.getElementById('dlg-tag');
    this.textEl = document.getElementById('dlg-text');
    this.choicesEl = document.getElementById('dlg-choices');

    // conversation state
    this.tree = null;   // { root, nodes } for named NPCs; null for a one-liner
    this.node = null;   // current node { text, choices }
    this.sel = 0;       // highlighted choice
    this.full = '';     // full current line
    this.typed = 0;     // chars revealed
    this.typing = false;
    this._justOpened = false;

    // camera scratch
    this.t = 0;
    this.startPos = new THREE.Vector3();
    this.startQuat = new THREE.Quaternion();
    this.targetPos = new THREE.Vector3();
    this.targetLook = new THREE.Vector3();
    this.npcPos = new THREE.Vector3();
    this.heldPos = new THREE.Vector3();
    this.heldQuat = new THREE.Quaternion();
    this._tmp = new THREE.Object3D();

    this._onKey = (e) => this.onKey(e);
  }

  get active() { return this.phase === 'open' || this.phase === 'closing'; }

  open(identity, person) {
    if (this.phase !== 'idle') return;
    this.phase = 'open';
    this.t = 0;
    this.person = person;
    this.npcPos.copy(person.g.position);

    // freeze both actors; dialog owns the camera from here
    this.player.talking = true;
    this.player.faceTarget = this.npcPos.clone();
    this.villagers.talkingWith = person;

    this.startPos.copy(this.camera.position);
    this.startQuat.copy(this.camera.quaternion);

    this.nameEl.textContent = identity.name;
    this.tagEl.textContent = identity.tag || '';
    this.tagEl.style.display = identity.tag ? '' : 'none';

    if (identity.tree) {
      this.tree = identity.tree;
      this.goto(identity.tree.root);
    } else {
      this.tree = null;
      this.node = { text: identity.line, choices: [{ label: 'Farewell.', to: null }] };
      this.render();
    }

    this.el.classList.add('show');
    this._justOpened = true;
    setTimeout(() => { this._justOpened = false; }, 200);
    window.addEventListener('keydown', this._onKey);
    console.log('[CAO] talk:', identity.name);
  }

  goto(key) {
    if (!key || !this.tree.nodes[key]) { this.close(); return; }
    this.node = this.tree.nodes[key];
    this.render();
  }

  render() {
    this.sel = 0;
    this.full = this.node.text;
    this.typed = 0;
    this.typing = true;
    this.textEl.textContent = '';
    this.renderChoices();
  }

  renderChoices() {
    this.choicesEl.innerHTML = '';
    if (this.typing) return; // choices appear once the line finishes typing
    this.node.choices.forEach((c, i) => {
      const b = document.createElement('div');
      b.className = 'dlg-choice' + (i === this.sel ? ' selected' : '');
      b.textContent = `${i + 1}. ${c.label}`;
      this.choicesEl.appendChild(b);
    });
  }

  onKey(e) {
    if (this.phase !== 'open') return;
    if (e.repeat) return;
    e.preventDefault();

    // any key completes an in-progress reveal instead of acting
    if (this.typing) {
      this.typed = this.full.length;
      this.textEl.textContent = this.full;
      this.typing = false;
      this.renderChoices();
      return;
    }
    // the E/Enter/Space that opened the panel must not immediately advance it
    if (this._justOpened && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) return;

    if (e.code === 'Escape' || e.code === 'KeyQ') { this.close(); return; }
    const n = this.node.choices.length;
    if (e.code === 'ArrowDown') { this.sel = (this.sel + 1) % n; this.renderChoices(); return; }
    if (e.code === 'ArrowUp') { this.sel = (this.sel - 1 + n) % n; this.renderChoices(); return; }
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      const i = e.code.charCodeAt(5) - 49; // 'Digit1' -> 0
      if (i < n) this.choose(i);
      return;
    }
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') this.choose(this.sel);
  }

  choose(i) {
    const c = this.node.choices[i];
    if (!c) return;
    if (this.tree && c.to) this.goto(c.to);
    else this.close();
  }

  close() {
    if (this.phase !== 'open') return;
    window.removeEventListener('keydown', this._onKey);
    this.el.classList.remove('show');
    this.phase = 'closing';
    this.t = 0;
    this.heldPos.copy(this.camera.position);
    this.heldQuat.copy(this.camera.quaternion);
    this.player.talking = false;
    this.player.faceTarget = null;
    this.villagers.talkingWith = null;
  }

  // typewriter — real dt, only while open
  updateText(dt) {
    if (!this.typing) return;
    this.typed = Math.min(this.full.length, this.typed + dt * TYPE_SPEED);
    this.textEl.textContent = this.full.slice(0, Math.floor(this.typed));
    if (this.typed >= this.full.length) { this.typing = false; this.renderChoices(); }
  }

  computeTarget() {
    const P = this.player.pos, N = this.npcPos;
    const toN = new THREE.Vector3(N.x - P.x, 0, N.z - P.z);
    if (toN.lengthSq() < 1e-4) toN.set(0, 0, 1); else toN.normalize();
    const right = new THREE.Vector3(toN.z, 0, -toN.x); // over-the-shoulder offset
    this.targetPos.set(
      P.x - toN.x * 2.4 + right.x * 1.4,
      P.y + 1.8,
      P.z - toN.z * 2.4 + right.z * 1.4,
    );
    this.targetLook.set(
      P.x + (N.x - P.x) * 0.62,
      P.y + 1.35,
      P.z + (N.z - P.z) * 0.62, // bias the look toward the NPC
    );
  }

  // call every frame AFTER player.update. While open, dialog owns the camera
  // (player.update skipped it). While closing, player.update wrote the live
  // orbit pose — blend the held two-shot back into it.
  updateCamera(dt) {
    if (this.phase === 'open') {
      this.updateText(dt);
      this.t = Math.min(INTRO, this.t + dt);
      this.computeTarget();
      this._tmp.position.copy(this.targetPos);
      this._tmp.lookAt(this.targetLook);
      const k = smooth(this.t / INTRO);
      this.camera.position.lerpVectors(this.startPos, this.targetPos, k);
      this.camera.quaternion.copy(this.startQuat).slerp(this._tmp.quaternion, k);
    } else if (this.phase === 'closing') {
      this.t = Math.min(OUTRO, this.t + dt);
      const k = smooth(this.t / OUTRO);
      const livePos = this.camera.position.clone();   // orbit pose from player.update
      const liveQuat = this.camera.quaternion.clone();
      this.camera.position.copy(this.heldPos).lerp(livePos, k);
      this.camera.quaternion.copy(this.heldQuat).slerp(liveQuat, k);
      if (this.t >= OUTRO) this.phase = 'idle';
    }
  }
}
```

- [ ] **Step 4: Verify typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dialog.js index.html
git commit -m "feat(ui): dialogue panel + branching state machine + two-shot camera

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire into main.js, bump version, update docs

**Files:**
- Modify: `src/main.js` (import; instantiate Dialog; `tick` update block + interaction; pointerlock safety)
- Modify: `package.json` (version)
- Modify: `CLAUDE.md` (architecture note)

**Interfaces:**
- Consumes: `Dialog` (Task 4), `villagers.nearestTalkable` / `villagers.update(dt, playerPos)` (Task 3), `player.talking` (Task 2).
- Produces: the running feature.

- [ ] **Step 1: Import Dialog**

In `src/main.js`, with the other UI import (`import { HUD } from './ui/hud.js';`), add:

```js
import { Dialog } from './ui/dialog.js';
```

- [ ] **Step 2: Instantiate Dialog**

Find `window.CAO = { player, enemies, progression };` and add right after it:

```js
const dialog = new Dialog({ player, villagers, camera });
```

- [ ] **Step 3: Close the dialog if pointer lock is lost mid-conversation**

Find the `pointerlockchange` handler (`document.addEventListener('pointerlockchange', ...)`). Inside it, after `overlay.classList.toggle('hidden', input.locked);`, add:

```js
  if (!input.locked && dialog.active) dialog.close(); // Esc/blur mid-talk → resolve state
```

Note: `dialog` is declared later in the file, but this handler only runs on a user event long after module init, so the reference resolves. (This matches how the existing wheel/keydown handlers reference `player` declared below them.)

- [ ] **Step 4: Update the update block in `tick`**

Replace this existing block:

```js
  if (bossIntro && bossIntro.blocking) {
    bossIntro.update(dt);          // cutscene owns the camera; watch-only
    input.attackQueued = false;    // drop clicks buffered during the scene
  } else {
    player.update(dt, sdt);
    blade.update(sdt, dt, input, enemies, camera);
  }
  for (const e of enemies) e.update(sdt, camera);
  villagers.update(dt);
  floor.update(elapsed);
  weather.update(dt, player.pos);
```

with:

```js
  if (bossIntro && bossIntro.blocking) {
    bossIntro.update(dt);          // cutscene owns the camera; watch-only
    input.attackQueued = false;    // drop clicks buffered during the scene
  } else if (dialog.active) {
    player.update(dt, sdt);        // idle + faces the NPC; skips its own camera
    input.attackQueued = false;    // no swinging mid-conversation
  } else {
    player.update(dt, sdt);
    blade.update(sdt, dt, input, enemies, camera);
  }
  for (const e of enemies) e.update(sdt, camera);
  villagers.update(dt, player.pos);
  dialog.updateCamera(dt);         // after player.update: owns cam (open) / eases back (closing)
  floor.update(elapsed);
  weather.update(dt, player.pos);
```

- [ ] **Step 5: Wire the talk prompt + E key**

Replace this existing block:

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

with:

```js
  // talkable NPC in reach takes priority over the portal prompt
  const talkable = (dialog.active || !input.locked) ? null : villagers.nearestTalkable(player.pos, 2.6);

  let nearPortal = null, nearDist = Infinity;
  for (const P of floor.portals) {
    const d = player.pos.distanceTo(P.pos);
    if (d < PORTAL_RADIUS && d < nearDist) { nearDist = d; nearPortal = P; }
  }

  if (talkable) hud.showPortalPrompt(`Press E · Talk to ${talkable.identity.name}`);
  else if (!nearPortal) hud.showPortalPrompt(null);
  else if (nearPortal.active) hud.showPortalPrompt(`Press E · Floor ${nearPortal.targetLevel}`);
  else hud.showPortalPrompt('Defeat the boss');

  if (input.interact && !transitioning && !dialog.active) {
    if (talkable && !player.dead) dialog.open(talkable.identity, talkable.person);
    else if (nearPortal && nearPortal.active) startTransition(nearPortal);
  }
  input.interact = false;
```

- [ ] **Step 6: Bump the version**

In `package.json`, change `"version": "0.14.1"` to `"version": "0.15.0"`.

- [ ] **Step 7: Update CLAUDE.md**

In `CLAUDE.md`, in the "Three.js architecture (the parts that span files)" section, add a new paragraph after the "Floor population lives in `world/town.js`" paragraph:

```markdown
**NPC dialogue is data + one UI class.** `world/dialogue.js` (pure data, zero imports so `node test/dialogue.mjs` can load it) holds `NAMED_BY_FLOOR` — per-floor named NPCs with branching trees (`node = { text, choices:[{label, to}] }`, `to` = another node key or `null` to end) — and `CROWD_LINES` for everyone else. `world/npc.js` spawns the named NPCs as `static` (non-strolling) people at fixed posts and exposes `nearestTalkable(pos, range)`; `ui/dialog.js` owns the panel DOM (`#dialog` in `index.html`), the conversation state machine, its own keydown listener (keyboard-only — pointer lock stays on), and the over-shoulder two-shot camera. During a conversation `main.js` sets `player.talking` (controller freezes + yields the camera), skips `blade.update`, and calls `dialog.updateCamera(dt)` after `player.update`. Keys: E/Enter/Space or 1/2/3 pick a choice, ↑/↓ move the highlight, Q/Esc leaves (Esc also pauses via native pointer-lock exit).
```

- [ ] **Step 8: Verify everything**

Run: `node test/dialogue.mjs && bun run typecheck`
Expected: `OK — 5 named NPCs, 12 crowd lines` then no typecheck errors.

- [ ] **Step 9: Manual browser check (Davide)**

Run `bun run dev`, open the printed URL, Link start (Floor 1). Verify:
- Walking near Argo/Klein/Sasha/Bahr/The Hooded One shows `Press E · Talk to <name>`.
- E opens the panel; camera swings to an over-shoulder two-shot; both player and NPC keep idling.
- Text types out; a key completes it early; choices appear numbered; 1/2/3 and ↑/↓+E work; branches navigate; a `to:null` choice and Q both ease the camera back to the orbit.
- A non-named villager shows one line and a single "Farewell." exit.
- Portal E still works at the gate (away from NPCs); combat, boss, and floor travel unaffected.
- Console shows `[CAO] talk: <name>` on open, no errors.

- [ ] **Step 10: Commit**

```bash
git add src/main.js package.json CLAUDE.md
git commit -m "feat(npc): wire dialogue into main + two-shot camera (v0.15.0)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 5 named NPCs w/ name + personality tag + branching tree → Task 1 (data), Task 3 (spawn), Task 4 (panel). ✓
- Generic crowd one-liners → Task 1 (`CROWD_LINES`), Task 3 (`nearestTalkable` fallback), Task 4 (single-choice path). ✓
- Over-shoulder two-shot, both idling → Task 2 (player idle-freeze, yields camera), Task 3 (`talkingWith` NPC idle+face), Task 4 (`computeTarget`/`updateCamera`). ✓
- SAO-glass UI, keyboard-driven, pointer lock kept → Task 4 (CSS + own keydown listener). ✓
- Camera ease-in/hold/ease-back → Task 4 `updateCamera` (`open`/`closing`). ✓
- E priority over portals, guards (locked/alive/not-transitioning/no cutscene) → Task 5 Step 5 + the `dialog.active` branch. ✓
- Degradation (no GLB) → named NPCs use the archetype fallback via `makePerson`/`modelIdx` (Task 3). ✓
- Test (`choice.to` valid, root exists) → Task 1 `test/dialogue.mjs`. ✓
- Version bump + doc-drift update → Task 5 Steps 6–7. ✓

**Placeholder scan:** none — every code step has complete code; no TBD/TODO/"handle edge cases".

**Type consistency:** `identity` shape (`{name, tag?, tree?, line?}`) is produced by `nearestTalkable` (Task 3) and consumed by `open` (Task 4) identically. `tree = {root, nodes}` built in Task 3 matches `this.tree.nodes[key]` use in Task 4. `villagers.talkingWith`, `player.talking`, `player.faceTarget` set in Task 4, honoured in Tasks 2/3. `update(dt, playerPos)` signature defined in Task 3, called in Task 5. Consistent.
