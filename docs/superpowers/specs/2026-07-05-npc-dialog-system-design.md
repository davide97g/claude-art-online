# NPC Dialog System — design

_Floor-1 conversations: named story NPCs with branching trees, generic crowd one-liners, an over-shoulder two-shot camera, SAO-glass UI._

## Goal & scope

Give the town life you can talk to. One rung of the ladder (VISION: ship a rung before climbing):

- **5 named story NPCs** on Floor 1 — each has a name, a personality tag, and a small **branching** dialogue tree.
- **Every other villager** gives one generic one-liner (same panel, same camera, no choices).
- **Over-shoulder two-shot** camera on talk: eases in, holds, eases back. Both player and NPC keep their **idle** animation.
- **SAO aesthetic** panel (translucent dark glass + cyan), matching the existing HUD. Keyboard-driven so pointer lock stays engaged.

Explicitly out of scope (add later, the data model already leaves room):

- Portraits (2D or live-rendered).
- Named casts on Floors 2–12 (`NAMED_BY_FLOOR` is keyed by floor; only `1` is populated now).
- Quests, dialogue state persistence, shop/inventory hooks.

## Architecture

Five touch points. Two new files (one data, one UI/behaviour); three small edits to existing systems.

### 1. `src/world/dialogue.js` (new — pure data)

```js
export const NAMED_BY_FLOOR = {
  1: [
    {
      name: 'Argo', tag: 'Information Broker',
      model: 'rpg_rogue',        // key into NPC_MODELS (npc.js)
      pos: { x, z },             // fixed post near the plaza (z ~ 22)
      root: 'start',
      nodes: {
        start: { text: '…', choices: [ { label: '…', to: 'rumors' }, { label: 'Later.', to: null } ] },
        rumors: { text: '…', choices: [ { label: '…', to: null } ] },
      },
    },
    // Klein, Sister Sasha, the Smith, a hooded lorekeeper
  ],
};

export const CROWD_LINES = [ /* ~12 one-liners */ ];
```

- A `node` is `{ text, choices: [{ label, to }] }`. `to` is another node key or `null` (ends the conversation).
- ~3–6 nodes per named NPC; trees may loop back (a `to` can point to an already-visited node).
- `CROWD_LINES` picked by villager index (stable across the session so a given villager always says the same thing).

### 2. `src/ui/dialog.js` (new — the Dialog class)

Owns the panel DOM, the conversation state machine, its own input listener, and the two-shot camera.

- **Phases:** `idle → open → closing → idle`.
  - `active` getter = `open || closing` — main.js uses this to freeze the player and skip the blade.
  - `interactive` = `open` — accepts choice input, panel visible.
- **`open(identity, npcPos, playerPos)`**: shows the panel at the identity's root node (or the single generic line), attaches its keydown listener, captures the current camera pose as the ease-in start, sets `player.talking` / `faceTarget` and `villagers.talkingWith` via callbacks passed from main.js.
- **Typewriter reveal** of node text. Any key while typing completes the reveal instead of acting.
- **Choice input** (listener active only while `open`): `1/2/3` pick+confirm; `↑/↓` move the highlight; `E`/`Enter`/`Space` confirm the highlight; `Esc` closes. Guards: ignore `e.repeat`; a 200 ms open-guard so the same `E` press that opened the panel can't immediately advance it.
- **`updateCamera(dt)`** (called from the loop after `player.update`):
  - `open`: ease-in `t` climbs to 1 over ~0.5 s (`smoothstep`); `camera.position = lerp(startPos, targetPos)`, orientation via a scratch `Object3D.lookAt(targetLook)` → slerp. Once eased, hold. Player skipped the camera block this frame, so the dialog fully owns it.
    - `targetPos = playerPos + up*1.8 − toNpc*2.4 + right*1.4` (behind + over the shoulder), `right = (toNpc.z,0,−toNpc.x)`.
    - `targetLook = lerp(playerHead, npcHead, 0.62)` (biased toward the NPC).
  - `closing`: `player.talking` is already false, so `player.update` wrote the live orbit camera; blend from the held pose → that orbit over ~0.4 s (mirrors `BossIntro.postCamera`), then `idle` and release all talk state.

### 3. `index.html` (DOM + CSS)

`#dialog` panel: `#dlg-name`, `#dlg-tag`, `#dlg-text`, `#dlg-choices` (numbered buttons, one `.selected`). Styling reuses the HUD's glass/cyan tokens. Hidden by default; shown while `interactive`.

### 4. `src/player/controller.js`

Add `this.talking = false` and `this.faceTarget = null`. At the top of `update(dt, sdt)`, when `talking`:

- `speedNow = 0`; no WASD, no mouse-orbit (`yaw/pitch` unchanged).
- Turn `group.rotation.y` toward `faceTarget` (same eased-turn as movement facing).
- Keep the idle animation alive: `fade('idle')` + `mixer.update(sdt)`.
- Keep `group.position` on the ground it already stands on; **return before the camera block** so the dialog owns the camera.

### 5. `src/world/npc.js`

- On construct, spawn `NAMED_BY_FLOOR[biome.id] ?? []` as extra people: `p.static = true` (no strolling), `p.identity = { name, tag, tree }`, `modelIdx = MODEL_INDEX[data.model]` (so the existing `loadModels` upgrade swaps in the right GLB automatically), placed at `data.pos` grounded via `getHeight`, initial yaw facing the plaza.
- Generic people keep `identity = null` (resolved lazily to `{ name:'Villager', line: CROWD_LINES[idx % len] }`).
- **`nearestTalkable(pos, range)`** → `{ person, identity }` or `null`. Resolves generic identities on demand.
- `update(dt, playerPos)`: if `person === this.talkingWith`, hold idle + face `playerPos` + skip strolling; if `person.static`, skip strolling (idle in place). `talkingWith` is set/cleared by main.js.

### 6. `src/main.js`

- Instantiate `const dialog = new Dialog({ player, villagers, camera })`.
- Each frame: `const talkable = dialog.active ? null : villagers.nearestTalkable(player.pos, 2.5)`.
  - If `talkable`, show `Press E · Talk to ${identity.name}` on the existing prompt element (priority over the portal prompt).
  - On `input.interact`: if `talkable` and locked/alive/not-transitioning and no boss cutscene → `dialog.open(...)`; else fall through to the existing portal logic.
- While `dialog.active`: skip `blade.update`; set `player.talking = true` (or leave false in `closing`); still run `player.update`, `villagers.update`, `floor.update`, `weather.update`; then `dialog.updateCamera(dt)`.
- Bump `package.json` `0.14.1 → 0.15.0` (new feature → minor).
- Update the doc-drift note in `CLAUDE.md` with a one-paragraph dialogue-system entry.

## Data flow

```
E pressed near NPC
  main.js: input.interact → villagers.nearestTalkable() → dialog.open(identity, npcPos, playerPos)
    dialog: panel shown, listener attached, camera start captured
            player.talking = true, player.faceTarget = npcPos, villagers.talkingWith = person
  loop while active:
    player.update  → idle, faces NPC, skips camera
    villagers.update(dt, playerPos) → talkingWith idles + faces player
    dialog.updateCamera(dt) → ease-in two-shot, then hold
  choice.to === null OR Esc:
    dialog → phase 'closing', capture held camera, player.talking = false, clear faceTarget/talkingWith
  loop while closing:
    player.update writes orbit camera; dialog.updateCamera blends held → orbit; then 'idle'
```

## Error handling / degradation

- No GLBs: named NPCs fall back to their archetype gray-box (existing `fb` path) — fully playable, per the project rule.
- Missing/`null` identity or empty range: `nearestTalkable` returns `null`, no prompt, E falls through to portals.
- A choice whose `to` node is absent: treated as end-of-conversation (defensive), and caught by the test below.

## Testing

- `test/dialogue.mjs` (new, matches `test/citylayout.mjs` / `test/terrain.mjs` convention): import `NAMED_BY_FLOOR`, assert every node's every `choice.to` is `null` or an existing node key in the same NPC, and that each NPC's `root` exists. Run with `node test/dialogue.mjs`.
- `bun run typecheck` stays green (new files are `.js`; `allowJs`/`checkJs:false`).
- Manual (Davide tests in-browser): E near a named NPC opens the two-shot, choices branch, Esc/`to:null` eases back to orbit; a generic villager shows one line; both keep idling; portal E still works away from NPCs.
