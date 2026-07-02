# Claude Art Online (CAO)

A single-player 3D browser game inspired by Sword Art Online's Aincrad arc.
Built with Three.js. Models made in Blender (Claude scripts, Davide follows along).

## Theme

You are a lone swordsman trapped in a floating castle of stacked floors.
Each floor is an open zone — a town, wilderness, a dungeon — sealed by a boss.
Kill the boss, the gate opens, the tower reveals its next layer.
No party, no respawn hand-holding: the tension comes from climbing.

Tone: wonder first, danger underneath. Aincrad is beautiful — the dread is
that something this beautiful wants to kill you.

## Style

Reference: Echoes of Aincrad (Steam, Bandai Namco 2026) for *mood* —
vibrant anime fantasy, serene plains, floating castle vistas — but NOT for
fidelity. We can't match a AAA pipeline and shouldn't try.

Our art direction: **low-poly stylized, flat-shaded, strong silhouettes.**

- Palette per floor: Floor 1 = warm greens/gold (Town of Beginnings vibe),
  saturated sky, soft fog hiding the floor's edge.
- Geometry: chunky, faceted. No PBR textures — vertex colors / flat materials.
- The tower is always visible in the skybox above you: cheap, huge payoff.
- Combat readability over realism: glowing blade trails, hit-stop, damage
  numbers, telegraphed enemy wind-ups.

Why low-poly: it's scriptable in Blender Python, exports tiny GLBs,
looks intentional rather than "budget realistic", and runs at 60fps in a browser.

## Gameplay pillars

1. **Swipe swordplay** — hold RMB to enter blade stance: mouse movement drives
   the slash direction (Pointer Lock API). Gestures = sword skills.
   This is the make-or-break mechanic. Prototyped gray-box FIRST.
2. **Open floors, not open world** — each floor is a bounded ~300–400m diorama
   with fog-veiled edges. Explore, fight mobs, find the boss gate.
3. **Boss as gate** — each floor's boss is a puzzle of patterns.
   Beating it is the only way up. Floor count target: 3. Not 100. Three.
4. **Feel over content** — one enemy that's satisfying to fight beats ten that aren't.

## Tech stack

- Runtime: Three.js + Vite (vanilla JS, ES modules)
- Models: Blender → glTF/GLB (Claude drives Blender via scripts/MCP)
- Animations: Mixamo/CC0 for humanoids; simple rigs scripted for monsters
- Pre-existing assets wherever possible (CC0: Kenney, Quaternius) —
  custom modeling reserved for hero pieces (the sword, the boss, the gate)
- Physics: none/minimal — capsule vs. heightfield + simple colliders

## Scope ladder (ship each rung before climbing)

1. Gray-box: capsule player, third-person camera, swipe combat vs. dummy
2. Floor 1 terrain + town shell from CC0 kit, tower skybox
3. One mob type with wind-up/attack/death states
4. Floor 1 boss + gate → floor 2 stub
5. Polish pass: trails, hit-stop, damage numbers, sound

## Non-goals

Multiplayer. Inventory systems. Quests/NPC dialogue trees. Character creator.
Realistic graphics. 100 floors. If it's not on the scope ladder, it waits.
