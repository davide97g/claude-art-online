# Dragon build plan — Smaug-inspired hero piece

Target: `public/assets/models/dragon.glb`. Build via `dragon_build.py` stages,
run with `python3 blender/blender_client.py exec <stage>`. Own scene
(`DragonBuild`), never touches Davide's open scene objects.

Goal is **maximum realism achievable from a bpy script** (no manual sculpt):
dense script-sculpted mesh (orc_build.py gaussian engine), layered vertex
color + baked procedural scale textures, emission ember glow. "Cinema
realistic" is the north star; the ceiling is what procedural + GLB/Three.js
allows — no Cycles shaders survive export, so realism must live in geometry,
baked maps, and vertex color.

## Anatomy — Smaug (film design, 2013 wyvern revision)

- **Build**: wyvern. Two hind legs; forelimbs ARE the wings (wing-arm with
  clawed "thumb" used as front foot when walking, bat-style quadrupedal gait).
- **Proportions** (film Smaug ~130m long; ours normalized): body ~1 unit chest
  radius; neck ~2.2× body length, serpentine, thick at shoulders tapering to
  head; tail ~3× body, tapers to blade tip. Total nose→tail ≈ 8–9 body radii.
- **Head**: long angular wedge, crocodilian jaw with lip curl, teeth exposed.
  Broad flat cranium, prominent brow ridges shading recessed cat-slit amber
  eyes (forward-set, expressive — this sells the character). Chin spikes.
- **Horns**: two big backswept main horns off the rear skull, plus graduated
  crown of smaller horn spikes framing the jaw/cheek and continuing as a
  dorsal spine row down neck→back→tail.
- **Wings**: enormous — span ≈ 2× body length. Arm (humerus/radius) + 3–4
  elongated finger bones supporting membrane; clawed thumb at wrist wrist-joint.
  Membrane attaches along torso down to hip. Ragged trailing edge.
- **Scales**: large angular plates on head/back/limbs, finer overlapping rows
  on neck; broad segmented belly plates (pale). Battle scars; the famous
  missing-scale bare patch on left breast.
- **Color**: red-gold body (deep crimson base, gold-orange highlights on scale
  edges), pale gold-cream underbelly, amber eyes. **Ember glow**: chest/throat
  fire-glow from within — cracks between chest plates emit orange
  (material `CAO_DragonEmber`, emission — Three.js picks up emissive from GLB;
  code can pulse `emissiveIntensity` like `CAO_GolemEye`).

## Build stages (orc_build.py house pattern)

1. **Stage 1 — core body**: metaball-or-curve-lofted body/neck/tail as one
   smooth mesh (bmesh loft along spine curve, radius profile per segment),
   then gaussian sculpt passes: chest keel, shoulder mass, haunches, neck
   musculature. Hind legs + wing-arms as script-sculpted limbs, boolean-free
   (separate meshes, joined visually).
2. **Stage 2 — head sculpt**: dense uv-sphere → egg → ~40 gaussian OPS
   (crocodile wedge, brow, sockets, jaw, nostrils, lip curl). Teeth (cones),
   horns (tapered curved cones w/ ridge rings), eye spheres (amber emissive
   `CAO_DragonEye`).
3. **Stage 3 — wings**: armature-less: bone chain as tapered cylinders, membrane
   as subdivided grid shrink-fit between finger curves, slight catenary sag +
   noise ripple; ragged trailing edge via vertex displacement.
4. **Stage 4 — surface detail + materials**: dorsal spike row (instanced
   tapered pyramids along spine, size graded), belly plates (inset loops or
   displaced bands), procedural scale relief via Voronoi-driven displacement
   baked into mesh (apply modifier — geometry survives GLB), vertex-color
   paint (crimson→gold gradient by curvature/height, pale belly by -Z facing),
   ember emission plates in chest cracks, missing-scale patch.
5. **Stage 5 — pose + export**: perched/guarding pose (or neutral T for later
   rigging — decide with Davide), pivots if it becomes an in-game actor
   (`BodyPivot`, `HeadPivot`, `NeckPivot`, `WingL/R`, `TailPivot`, `JawPivot`
   — mirror orc rig contract style), GLB export, tri budget check.

## Material name contract (code couplings, match existing convention)

- `CAO_DragonEye` — amber eyes, emissive (telegraph flare like golem)
- `CAO_DragonEmber` — chest/throat glow plates, emissive (fire-breath windup)
- Body materials vertex-colored; **realism confirmed (Davide 2026-07-07): do
  NOT toonify this model** — wire-in must skip `toonifyObject` for dragon.glb.

## Research findings (deep-research 2026-07-07; claims unverified — verify
## pass hit rate limits — but consistent with known sources: artofvfx.com
## Saindon interview, fxguide "Meet Smaug", monsterlegacy.net)

- **No usable free base mesh.** Best candidate (Sketchfab "Tarisland Dragon
  High Poly", 40.4k tris, rigged, 27 anims) is CC-BY-labeled but is ripped
  Tencent IP (uploader's own description: all rights reserved, non-commercial).
  Do NOT use. Full procedural build it is.
- **Weta design facts to honor**: wyvern redesign was specifically so wings
  double as arms for gesturing → make wing-fingers read as hands. Crocodile
  snout, no humanoid mouth shapes; stiff bony plates + flesh zones on face
  with "nose wrinkler" region. Horn crest = many flexible spikes (mood rig)
  — keep spikes as separate graded cones so a future rig can splay them.
  Scales zoned: back = hard tortoise-shell plates, belly = small snake scales
  (snake/iguana reference). Fire = internal glow starting deep in chest/
  throat → ember emission should sit deepest at sternum, fading up the throat.
  Film scale ~2× a 747 (~140m), ~1M scales, 300 bones — aspirational only.
- Poly budget: film numbers irrelevant; Three.js hero target stays ~80–150k
  tris, scale detail via displaced geometry + vertex color, not textures-only.
