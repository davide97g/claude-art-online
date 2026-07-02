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
- `src/world/floor.js` — Floor 1 terrain, trees/rocks, boss gate, sky
- `src/player/controller.js` — third-person movement + camera, knight GLB loader
- `src/combat/blade.js` — swipe detection, swing, trail, hit resolution
- `src/combat/dummy.js` — training dummies
- `src/ui/hud.js` — damage numbers, kill counter, gate message
- `public/assets/models/` — GLB models (CC0 + our Blender exports)
- `blender/` — Blender scripts Claude writes; exports land in public/assets/models

## Asset credits

- Knight character: [KayKit Adventurers](https://github.com/KayLousberg/KayKit-Adventurers) by Kay Lousberg — CC0
