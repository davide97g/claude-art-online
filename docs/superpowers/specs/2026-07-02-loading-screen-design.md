# Loading screen — design (2026-07-02)

Elden-Ring-style start/loading screen for the Three.js game: Ken Burns background,
rotating gameplay tips, and an **honest** progress bar that gates entry.

## Problem

17MB of assets stream in with per-subsystem `GLTFLoader`s and gray-box fallbacks; the
game loop runs from frame 1 and nothing waits. The existing `#lock-overlay` ("Link
start") is only a pointer-lock/fullscreen gate — no loading feedback. We want a
polished loading screen with real progress before the player enters.

## Design

**1. Progress source — one shared `LoadingManager`.**
New `src/loading.js` exports a single `THREE.LoadingManager` and a preconfigured
`GLTFLoader` bound to it. Call sites swap `new GLTFLoader()` → the shared loader:
`player/controller.js` (×2 loads), `combat/golem.js`, `world/town.js`.
- `manager.onProgress(url, loaded, total)` → set bar width + `%`.
- `manager.onLoad` → enable the "Link start" button.
- `manager.onError` → already survivable (gray-box fallbacks); manager still resolves.

**2. Behavior: build immediately (unchanged).**
World builds and `tick()` renders behind the overlay from frame 1 — that is what
generates progress. Only new gate: the button is disabled until `onLoad`.

**3. Overlay becomes the loading screen** (`index.html` markup + CSS, logic in `main.js`):
- Background: 3 captured JPGs stacked, each a slow CSS Ken Burns keyframe
  (scale 1→1.12 + drift), crossfading every ~7s.
- Foreground: title, one rotating gameplay-tip line (swap ~5s), progress bar + `%`.
- Palette: existing cyan-on-navy (`#7fd4ff` / `#eaf2ff` / dark scrim).

**4. Screenshots.**
Capture 3 vantage points from the running game via Chrome (spawn→town vista, gate
approach, a golem), downsize to ~1280px JPGs (~150KB each) → `public/assets/loading/`.
Preload first (tiny) so only a <0.5s navy scrim precedes the first image.

## Files

- `index.html` — loading-screen markup + CSS (Ken Burns, bar, tip line).
- `src/loading.js` — NEW; shared manager + loader.
- `src/main.js` — manager wiring, bar/tip/button behavior.
- `src/player/controller.js`, `src/combat/golem.js`, `src/world/town.js` — one-line loader swaps.
- `public/assets/loading/*.jpg` — NEW; 3 captured shots.

## Deliberately skipped (ponytail)

- Tracking `bards_tale.mp3` (3.6MB) in the bar — loads via HTMLAudio, outside the manager.
  Bar tracks geometry only. Add if the bar reads dishonest.
- Asset-manifest / retry / preload-priority system.
- In-game loading spinner for streamed-post-entry assets (none remain once gated).

## Success check

Dev server: navy scrim → first screenshot within ~0.5s → bar climbs 0→100% as GLBs
load → tip line rotates → Ken Burns pans → button enables at 100% → click enters
pointer lock and plays. `bun run typecheck` clean.
