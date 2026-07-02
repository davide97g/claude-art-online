# Blender workshop

This folder holds the Python scripts Claude writes to generate/edit models.
Davide follows along in the Blender UI (MCP add-on connected when possible).

Workflow per asset:
1. Describe the asset ("a chipped longsword with a glowing edge")
2. Claude scripts it (`bpy`), renders a thumbnail, we critique
3. Export GLB → `../public/assets/models/`
4. Wire it into the game

Rules: low-poly, flat-shaded, vertex colors or flat materials, no textures.
Hero pieces only — everything generic comes from CC0 packs.

First planned piece: the player's sword (replaces the gray-box placeholder in
`src/combat/blade.js`).
