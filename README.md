# Claude Art Online

3D browser action game inspired by SAO's Aincrad. See [VISION.md](./VISION.md).

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL. Click "Link start".

## Controls

- WASD — move, Shift — sprint
- Mouse — camera
- Hold right mouse button — blade stance (camera locks)
- Swipe the mouse while in stance — slash in that direction. Faster swipe = more damage.

## Structure

- `src/main.js` — renderer, input, game loop, hit-stop
- `src/world/floor.js` — Floor 1 terrain, boss gate, sky/tower
- `src/world/town.js` — populates Floor 1: KayKit town, forest, rocks, distant hills, props
- `src/player/controller.js` — third-person movement + camera, knight GLB loader
- `src/combat/blade.js` — swipe detection, swing, trail, hit resolution
- `src/combat/dummy.js` — training dummies
- `src/ui/hud.js` — damage numbers, kill counter, gate message
- `public/assets/models/` — GLB models (CC0 + our Blender exports)
- `blender/` — Blender scripts Claude writes; exports land in public/assets/models

## Asset credits

- Knight character: [KayKit Adventurers](https://github.com/KayLousberg/KayKit-Adventurers) by Kay Lousberg — CC0
- Town, nature & props: [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) by Kay Lousberg — CC0 (`public/assets/kaykit/`)
- Music: [Medieval: The Bard's Tale](https://opengameart.org/content/medieval-the-bards-tale) by RandomMind — CC0 (`public/assets/audio/`)
