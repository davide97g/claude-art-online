# Game Trailer — Capture Harness + Remotion Edit

**Date:** 2026-07-02
**Goal:** Produce an epic, cinematic ~60s trailer of *Claude Art Online* for a live demo tonight. Showcase: character movement across the map, dummy combat, the golem fight (hero moment), and the three biomes. Alternating live-capture ↔ animated text cards, fade + ease-in-out.

## Decisions (locked / defaulted)

| Decision | Choice | Notes |
|---|---|---|
| Who drives gameplay | **Hybrid** | Davide plays the fights live (real combat feel); I script the cinematic camera pans/vistas; I do all capture + edit. |
| Length | **~60s** (default, unconfirmed) | ~5–6 clips + ~4–5 text cards. |
| Music | **Reuse game bgm** (default, unconfirmed) | `public/assets/audio/bards_tale.mp3` (CC0). Added in Remotion, not captured in-game. |
| Resolution / fps | **1920×1080, 16:9, 60fps** source → mp4 | Final render can drop to 30fps if size matters. |
| Compositor | **Remotion** | Explicitly requested. Isolated in `trailer/` with its own `package.json` — game bundle untouched. |
| In-game audio in clips | **None captured** | Combat is silent (no SFX in code); music is the only audio. Capture video-only; all audio added in Remotion. |

## Architecture — three isolated pieces

### 1. In-game capture harness (`src/trailer/capture.js`) — dev-only, query-gated
Loaded by `main.js` **only** when the URL has `?rec` or `?cam=…`, so normal play and `vite build` are unaffected.

- **Record toggle.** A key (`Backquote` / `` ` ``) starts/stops recording.
  - Start: `renderer.domElement.captureStream(60)` → `MediaRecorder(stream, {mimeType:'video/webm;codecs=vp9', videoBitsPerSecond: 25_000_000})`, collect chunks.
  - Stop: assemble `Blob` → auto-download `cao-<label>-<n>.webm`.
  - Small on-screen `● REC` indicator (fixed div) so Davide knows it's rolling. Hidden from the captured frame is impossible (it's DOM, not canvas) — but capture is canvas-only, so the DOM indicator is **not** in the recording. 
  - Video-only stream (no audio track).
- **What it depends on:** `renderer.domElement` (passed in from `main.js`). Nothing else.

### 2. Scripted cinematic camera (`src/trailer/cinecam.js`) — dev-only, query-gated
Activated by `?cam=<preset>`. Runs **after** `player.update()` in the loop and overwrites `camera.position` + `camera.lookAt(...)`, so it cleanly overrides the behind-shoulder camera without touching `controller.js`.

- Presets (keyframed position + lookAt target, eased with smoothstep):
  - `orbit` — slow orbit around the player/knight (hero shot).
  - `reveal` — low push-in toward the sealed gate, rising.
  - `dolly` — slow lateral drift across the town plaza.
  - `flyover` — high slow pan across the biome terrain.
- **Tunable params** (URL): `?cam=orbit&dur=8&r=9&h=3&speed=1` etc. Sensible defaults per preset.
- Optionally scripts a gentle player idle/walk; combat stays human-driven.
- **Depends on:** `camera`, `player` (for `pos`), `terrainHeight` (keep flyover above ground).

### 3. Remotion project (`trailer/`) — isolated sub-project
Own `package.json` + `node_modules`; does not touch the game's deps.

- `trailer/src/Trailer.tsx` — root composition, 1920×1080 @ 60fps.
- `<Sequence>` per clip; `<OffthreadVideo>` for footage (mp4, transcoded from webm via ffmpeg).
- Text cards: `interpolate`/`spring` for fade + ease-in-out; cross-dissolves between clips.
- `<Audio src={bards_tale}>` bed; cuts aligned to its phrasing.
- Render: `bunx remotion render Trailer out/trailer.mp4`.

## Data flow

```
[game ?rec / ?cam] --captureStream--> MediaRecorder --> cao-*.webm (Downloads)
        |                                                     |
   Davide plays fights                              I move to trailer/clips/
   I run scripted cam                                        |
                                                   ffmpeg webm->mp4 (+ trim)
                                                             |
                                              trailer/clips/*.mp4
                                                             |
                                    Remotion (<OffthreadVideo> + text + <Audio>)
                                                             |
                                              bunx remotion render
                                                             |
                                              trailer/out/trailer.mp4
```

## Shot list (source clips for a 60s cut)

| # | Clip | How | ~len |
|---|---|---|---|
| 1 | Cold open — gate/town at rest | scripted `?cam=reveal` | 6s |
| 2 | Movement — sprint through town toward gate | Davide plays (or `?cam=dolly`) | 6s |
| 3 | Dummy combat — slash, hit-stop, combo chain | Davide plays | 8s |
| 4 | **Golem fight** — telegraph→dodge→combo→stagger→kill | Davide plays (multiple takes) | 12s |
| 5 | Biome flashes — Frostbound `?level=2`, Storm Peaks `?level=3` | Davide or `?cam=flyover` | 2s ea |
| 6 | Hero orbit around the knight | scripted `?cam=orbit` | 5s |

Extra takes are cheap — capture generously, cut in Remotion.

## Text / copy (draft — Davide to tweak)

1. `CLAUDE ART ONLINE`
2. `Floor 1. The gate is sealed.`
3. `One blade.`
4. `A clean hit slows time.`
5. `Break the golem.`
6. `Three floors. One way through.`
7. logo + `Link start.`

## Timeline (60s cut, approximate)

```
0:00  title card (fade up over cold-open clip 1)
0:05  movement + vista (clip 2)     card: "Floor 1. The gate is sealed."
0:15  dummy combat (clip 3)         card: "One blade."
0:25  card: "A clean hit slows time." over combat slow-mo
0:30  golem fight (clip 4) — hero   card: "Break the golem."
0:48  biome flashes (clip 5)        card: "Three floors. One way through."
0:54  hero orbit (clip 6) → logo + "Link start."
1:00  end
```

## Non-goals / YAGNI

- No capture UI beyond a toggle key + REC dot.
- No in-engine video export/encoding beyond MediaRecorder.
- No audio capture from the game (added in Remotion).
- Capture harness never ships in production build (query-gated, dev-only).
- No custom fonts unless a system font looks weak on the demo screen.

## Risks

- MediaRecorder is real-time — fine for short clips.
- WebM→mp4 transcode needed for reliable Remotion seeking (ffmpeg present).
- Golem fight is the hero moment — budget several takes.
- Remotion install is a large dep subtree; isolated in `trailer/` so it can't break the game.
