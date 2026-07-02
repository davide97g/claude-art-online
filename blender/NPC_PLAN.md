# NPC townsfolk — build plan

Populate **Floor 1 (Verdant Town)** and **Floor 5 (Craghold city / Royal Mile)** with
believable, varied townsfolk — real GLB models built in Blender, replacing the
runtime gray-box archetypes currently in `src/world/npc.js`. No CC0 character pack
matched the KayKit look closely enough (and none was curl-able), so we model our own.

## Design contract

- **Style:** low-poly, flat-shaded, **flat-color materials, no textures** (per `VISION.md`).
  Silhouette-first — read at a distance, coherent with the KayKit knight.
- **Scale / origin:** ~1.75 Blender units tall (≈ the knight, so `NPC_MODELS` scale ≈ 1).
  Feet centered at local origin `(0,0,0)` so `terrainHeight()` grounds them, and the
  gltf exporter's Y-up conversion stands them up in Three.js.
- **Graceful fallback preserved:** if a GLB is missing, `npc.js` keeps its primitive
  archetype. The game must stay playable with zero character GLBs.
- **Variety axes:** gender, age (child → elder), build/stature, clothing class
  (peasant / worker / merchant / noble / guard-civilian), hair, hat, beard, cape.

## Pipeline (all driven from Claude Code, no MCP tool)

1. Blender runs the **official "MCP" extension** (Blender Lab) — TCP socket `localhost:9876`,
   null-byte-delimited JSON `{"type":"execute","code":...,"strict_json":false}`. See CLAUDE.md.
2. `blender/blender_client.py` — the shell client. `python3 blender/blender_client.py exec <file>`.
3. `blender/npc_build.py` — the parametric builder. `MODE='preview'` renders a contact sheet;
   `MODE='export'` writes one GLB per character.
4. Export GLB → `public/assets/models/npc/<name>.glb`.
5. Wire filenames into `NPC_MODELS` in `src/world/npc.js`; the crowd swaps from fallback to
   the real models on load. Verify in-game on Floor 1 and Floor 5.

## Roster (12)

| # | name | who | lower body | distinguishing |
|---|------|-----|-----------|----------------|
| 1 | peasant_man | working adult male | trousers+shoes | brown tunic, short hair, beard, belt |
| 2 | peasant_woman | working adult female | long skirt | maroon dress, headscarf, long hair |
| 3 | elder_man | old male | trousers | gray hair+beard, muted green, slight stoop (0.96) |
| 4 | elder_woman | old female | skirt | gray bun, dark shawl (cape), 0.93 |
| 5 | merchant | prosperous male | trousers | blue tunic, brimmed hat, cape, belt, 1.03 |
| 6 | noble_woman | high-status female | gown | purple, blonde long hair, rich cape, 1.04 |
| 7 | child_boy | kid | short trousers | green tunic, 0.62 scale |
| 8 | child_girl | kid | little dress | pink dress, long hair, 0.60 scale |
| 9 | worker | laborer | trousers | tan/apron tone, bald, belt, broad, 1.02 |
| 10 | young_woman | youth female | skirt | teal dress, red hair bun, 0.98 |
| 11 | young_man | youth male | trousers | red tunic, cloth cap (cone) |
| 12 | guard_civ | tall civilian/watch | trousers | dark, brimmed hat, belt, 1.08 |

**Known gaps (honest):** true child & elder anatomy is faked via scale + gray hair + stoop,
not real proportions — acceptable at this fidelity. Facial detail is a nose only.

## Milestones — proceed a bit at a time

- [x] M0 — prove the pipeline: socket exec + EEVEE render round-trip.
- [x] M1 — parametric builder + full contact-sheet render (`blender/npc_contact.png`).
- [x] M2 — refined proportions: killed the lampshade-torso flare, fixed mis-oriented capes,
      pulled arms in, orthographic contact-sheet framing.
- [x] M3 — exported all 12 GLBs to `public/assets/models/npc/` (validated glTF 2.0).
- [x] M4 — wired `NPC_MODELS` (order = ARCHETYPES) + π facing fix. **In-browser check pending**
      (Chrome extension was disconnected this session — load `bun run dev`, Floor 1 & `?level=5`).
- [ ] M5 *(later, optional)* — rig + `idle`/`walk` clips (Quaternius Universal Animation
      Library retarget, or hand keyframes). Until then GLBs are static and wander via `npc.js`.

## Placement (already coded in `npc.js` `crowdSpec`, data-driven)

- `biome.city` (Floor 5) → 34 people lining the Royal Mile spine (+Z, z∈18..78) + entry plaza.
- `biome.flags === true` (Floor 1) → 22 people around the plaza (center ≈ (0,22)).
- otherwise → 6 around the plaza.
- Every spawn/wander target rejects building/tree colliders (shared `resolvePushOut`).
