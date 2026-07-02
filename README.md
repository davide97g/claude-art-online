# Claude Art Online

3D browser action game inspired by SAO's Aincrad. See [VISION.md](./VISION.md).

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL. Pick a floor (or append `?level=N`, 1-3) and click "Link start".

## Floors

Three selectable floors, chosen via `?level=N` on the loading screen:

1. **Verdant Town** — the starting village: warm sun, green terrain, full KayKit town.
2. **Frostbound** — snowfield: cool palette, drifting snow, a sparse hamlet, and sunk/tilted castle ruins.
3. **Storm Peaks** — jagged highlands at sunset: dramatic orange-and-purple palette, low blazing sun, blowing wind (no rain), a small outpost, and the heaviest ruin clusters.

Each floor tints its terrain, lighting, fog, settlement, and the golem enemies to match (moss on Floor 1, frost-blue on Floor 2, dusk-mauve on Floor 3).

## Controls

- WASD — move, Shift — sprint
- Mouse — look
- Left-click — attack; click again mid-swing to chain the combo (each swing is a random slash)
- M — mute music, Esc — pause / free the mouse

## Structure

- `src/main.js` — renderer, input, game loop, hit-stop, `?level=N` floor selection
- `src/world/biomes.js` — per-floor data (palette, weather, terrain, settlement, ruins, enemies, named places)
- `src/world/weather.js` — player-following particles: snow / rain+lightning / wind
- `src/world/floor.js` — terrain (analytic height), boss gate, sky/tower — parameterized by biome
- `src/world/town.js` — populates a floor from its biome config: KayKit town, forest, rocks, distant hills, props, Kenney Castle Kit ruins
- `src/player/controller.js` — third-person movement + camera, knight GLB loader
- `src/combat/blade.js` — swipe detection, swing, trail, hit resolution
- `src/combat/dummy.js` — training dummies
- `src/combat/golem.js` — golem enemy, tinted per biome
- `src/ui/hud.js` — damage numbers, kill counter, gate message, floor label, place-of-interest badges
- `public/assets/models/` — GLB models (CC0 + our Blender exports)
- `public/assets/castle/` — Kenney Castle Kit ruin GLBs (CC0), used on Floors 2-3
- `blender/` — Blender scripts Claude writes; exports land in public/assets/models

## Asset credits

- Knight character: [KayKit Adventurers](https://github.com/KayLousberg/KayKit-Adventurers) by Kay Lousberg — CC0
- Town, nature & props: [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) by Kay Lousberg — CC0 (`public/assets/kaykit/`)
- Ruins (Floors 2-3): [Castle Kit](https://kenney.nl/assets/castle-kit) by Kenney — CC0 (`public/assets/castle/`)
- Music: [Medieval: The Bard's Tale](https://opengameart.org/content/medieval-the-bards-tale) by RandomMind — CC0 (`public/assets/audio/`)
