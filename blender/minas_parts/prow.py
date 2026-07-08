# The great stone keel jutting from the city front — see PART CONTRACT.
# A sculpted, hewn-rock wedge (poly loft): a sharp vertical nose edge at -Y with
# a slight forward overhang up top (like a ship's prow), sheer flat sides that
# batter inward toward a walkable WHITE ridge walkway, sediment-layer rock
# strata with dark crack seams, a white lookout deck (semicircular balcony rim +
# flanking statues + banner & pennant) at the tip, white buttress collars where
# the keel punches each tier ring wall, a rock talus fan and a dark arched gate
# recess hint at the base.
NOSE_Y, BACK_Y = -46.0, 10.0
Z0, Z1 = 2.0, 49.0
MAXPUSH  = 1.5     # nose forward overhang at the very top (y -> -47.5)

# nose -> back (14 stations, clustered toward the nose for detail)
STATIONS = [-46.0, -43.0, -40.0, -36.0, -32.0, -28.0, -24.0, -20.0,
            -15.0, -10.0, -5.0, 0.0, 5.0, 10.0]
# base -> top ridge (9 z-bands)
ZBANDS   = [2.0, 8.0, 14.0, 21.0, 28.0, 35.0, 41.0, 46.0, 49.0]
NS, NZ   = len(STATIONS), len(ZBANDS)

# z-band-driven strata: which side-face rows read as the lighter ROCK2 sediment
LIGHT_BANDS = {2, 3, 6}

def _halfw(y, z):
    t  = (y - NOSE_Y) / (BACK_Y - NOSE_Y)              # 0 nose .. 1 back
    wb = 0.4 + 3.6 * t                                 # base half-width ~4 @back
    wt = 0.3 + 2.2 * t                                 # top  half-width ~2.5 @back
    zf = (z - Z0) / (Z1 - Z0)
    return wb + (wt - wb) * zf                          # narrower higher up = batter

def _push(y, z):
    # forward (-Y) overhang concentrated at the nose, growing with height
    p = max(0.0, min(1.0, (-30.0 - y) / (-30.0 - NOSE_Y)))   # 1 at nose .. 0 by y=-30
    h = max(0.0, min(1.0, (z - Z0) / (Z1 - Z0)))             # 0 base .. 1 top
    return -MAXPUSH * p * h

# ---- lofted skin vertex grid: idx[(station, zband, side)]  side 0=-x 1=+x ----
V = []
idx = {}
for si, ys in enumerate(STATIONS):
    for zi, z in enumerate(ZBANDS):
        w  = _halfw(ys, z)
        yv = ys + _push(ys, z)                          # forward-lean the nose top
        clean = (si == 0) or (zi == 0) or (zi == NZ - 1) # keep nose edge, base, ridge crisp
        j  = 0.0 if clean else rng.uniform(-0.40, 0.40)  # symmetric hewn swell/pinch
        for side in (0, 1):
            a = 0.0 if clean else rng.uniform(-0.16, 0.16)  # subtle per-side asymmetry
            idx[(si, zi, side)] = len(V)
            xw = w + j + a
            V.append((-xw if side == 0 else xw, yv, z))

def _q2t(f, quad):
    """append a quad as two winding-preserving tris (keeps flat normals clean)."""
    a, b, c, d = quad
    f.append((a, b, c)); f.append((a, c, d))

rock_f, rock2_f = [], []

# side skins — horizontal sediment strata (ROCK / ROCK2 by z-band row)
for si in range(NS - 1):
    for zi in range(NZ - 1):
        R = [idx[(si, zi, 1)], idx[(si + 1, zi, 1)], idx[(si + 1, zi + 1, 1)], idx[(si, zi + 1, 1)]]
        L = [idx[(si, zi, 0)], idx[(si, zi + 1, 0)], idx[(si + 1, zi + 1, 0)], idx[(si + 1, zi, 0)]]
        tgt = rock2_f if zi in LIGHT_BANDS else rock_f
        _q2t(tgt, R); _q2t(tgt, L)

# bottom (ROCK), top ridge surface (ROCK2)
for si in range(NS - 1):
    _q2t(rock_f,  [idx[(si, 0, 0)], idx[(si + 1, 0, 0)], idx[(si + 1, 0, 1)], idx[(si, 0, 1)]])
    _q2t(rock2_f, [idx[(si, NZ - 1, 0)], idx[(si, NZ - 1, 1)], idx[(si + 1, NZ - 1, 1)], idx[(si + 1, NZ - 1, 0)]])

# vertical nose cap (front, -Y; auto-slopes forward with the overhang) and back cap (+Y, buried)
for zi in range(NZ - 1):
    _q2t(rock_f, [idx[(0, zi, 0)], idx[(0, zi, 1)], idx[(0, zi + 1, 1)], idx[(0, zi + 1, 0)]])
    e = NS - 1
    _q2t(rock_f, [idx[(e, zi, 0)], idx[(e, zi + 1, 0)], idx[(e, zi + 1, 1)], idx[(e, zi, 1)]])

add(poly(V, rock_f,  ROCK()))
add(poly(V, rock2_f, ROCK2()))

# ---- angular chip ledges jutting from the sheer faces (break the billboard) ----
cv, cf = [], []
def _chip(sx, y, z):
    w = _halfw(y, z); b = len(cv)
    cv.extend([(sx * w, y - 1.3, z), (sx * w, y + 1.3, z),
               (sx * (w + 0.7), y, z + 0.9), (sx * (w + 0.7), y, z - 0.9)])
    cf.extend([(b, b + 1, b + 2), (b, b + 3, b + 1)])
for sx, y, z in [(1, -32, 16), (1, -16, 30), (1, -4, 40),
                 (-1, -26, 22), (-1, -10, 34), (-1, -38, 10)]:
    _chip(sx, y, z)
add(poly(cv, cf, ROCK2()))

# ---- thin DARK crack seams flush with the faces (vertical fissures) ----
for sx, y, z, hz in [(1, -34, 20, 3.4), (1, -18, 32, 3.0), (-1, -28, 24, 3.8),
                     (-1, -12, 30, 2.8), (1, -40, 12, 3.2)]:
    w = _halfw(y, z)
    add(box(0.06, 0.28, hz, (sx * (w + 0.03), y, z), DARK(),
            rot=(0, rng.uniform(-0.18, 0.18), 0)))

# ---- white buttress collars where the keel crosses tier ring walls (t1..t5) ----
# recomputed to hug the actual battered half-width at each crossing
for r, yc, zf in tiers[1:6]:
    y = yc - r                      # front (-Y) wall crossing point
    z = zf + WALL_H / 2.0
    if not (NOSE_Y < y < BACK_Y) or z > 47.0:
        continue
    w = _halfw(y, min(z, Z1))
    for sx in (-1, 1):
        add(box(0.9, 1.9, 3.4, (sx * (w + 0.30), y, z), WHITE()))

# =====================================================================
# top ridge WHITE walkway — a tapering thin-box chain from citadel to lookout
# =====================================================================
ZTOP = Z1                                   # ridge surface height
def _topw(y): return _halfw(y, Z1)
for si in range(NS - 1):
    y0, y1 = STATIONS[si], STATIONS[si + 1]
    ym  = 0.5 * (y0 + y1)
    seg = abs(y1 - y0)
    wwh = max(0.45, min(1.5, _topw(ym) * 0.55))     # walkway half-width, capped
    add(box(2 * wwh, seg * 0.98, 0.4, (0, ym, ZTOP + 0.25), WHITE()))

# tiny parapet posts marching along both ridge edges (7 per side)
for y in [4.0, -2.0, -8.0, -14.0, -21.0, -28.0, -34.0]:
    pw = _topw(y) + 0.15
    for sx in (-1, 1):
        add(box(0.35, 0.35, 0.85, (sx * pw, y, ZTOP + 0.45), WHITE()))

# =====================================================================
# lookout deck at the nose tip
# =====================================================================
DECK_TOP = Z1 + 0.6                                   # 49.6
# cantilevered white platform over the tip
add(box(3.4, 8.0, 0.5, (0, -43.0, DECK_TOP - 0.25), WHITE()))

# semicircular balcony rim wrapping the front (-Y) of the tip
RIM_C, RIM_R = -45.0, 2.9
for k in range(9):
    ang = math.pi + math.pi * (k / 8.0)               # 180deg .. 360deg (front arc)
    x   = RIM_R * math.cos(ang)
    y   = RIM_C + RIM_R * math.sin(ang)
    add(box(0.55, 0.55, 0.75, (x, y, DECK_TOP + 0.35), WHITE()))

# two statue stubs flanking the deck entrance (back edge, toward the city)
for sx in (-1, 1):
    bx = sx * 2.0
    add(box(0.8, 0.8, 0.8, (bx, -39.4, DECK_TOP + 0.4), WHITE()))                 # pedestal
    add(cyl(0.36, 0.24, 1.5, (bx, -39.4, DECK_TOP + 1.55), WHITE(), verts=8))     # body
    add(ico(0.26, (bx, -39.4, DECK_TOP + 2.45), WHITE(), sub=1))                  # head

# banner on a thin pole at the very tip + one smaller pennant beside it
add(tube(0.12, 6.0, (0, -43.0, DECK_TOP + 3.0), DARK(), verts=6))
add(box(1.4, 0.1, 1.1, (0.75, -43.0, DECK_TOP + 4.6), BANNER()))
add(tube(0.09, 4.2, (1.7, -40.0, DECK_TOP + 2.1), DARK(), verts=6))
add(box(0.9, 0.08, 0.7, (1.15, -40.0, DECK_TOP + 3.3), BANNER()))

# =====================================================================
# base: rock talus fan at the front + a great DARK arched gate recess hint
# =====================================================================
_talus = [(0.0,  -47.5, 1.6, 2.6, 3.0, 2.6, 0.10, ROCK()),
          (-2.4, -44.0, 1.3, 2.2, 2.6, 1.9, -0.16, ROCK2()),
          (2.6,  -43.0, 1.5, 2.0, 2.4, 2.2, 0.20, ROCK()),
          (-0.6, -40.0, 1.1, 2.4, 2.2, 1.6, -0.09, ROCK2())]
for x, y, z, sx, sy, sz, tilt, m in _talus:
    add(box(sx, sy, sz, (x, y, z), m, rot=(tilt, rng.uniform(-0.2, 0.2), 0)))

# dark arched recess hint at the prow foot, above where the gate passes under
add(box(3.0, 1.4, 4.0, (0, -45.2, 3.0), DARK()))                         # rectangular jamb
add(tube(1.5, 1.4, (0, -45.2, 5.0), DARK(), verts=16, rot=(math.pi/2, 0, 0)))  # arched head
