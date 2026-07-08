# tier drums, wall rings, crenellations, gates, buttresses — see PART CONTRACT in minas_build.py
# convention: city faces -Y. angle th measured from front (-Y): a point on a tier
# rim sits at ( sin(th)*R, ycenter - cos(th)*R ); box rot=(0,0,-th) aligns its
# local +X with the tangent and +Y with the outward radial. Reused everywhere below.

# ---- platform drums (each drops to the previous floor -> masonry cliffs) ----
for i, (r, y, z) in enumerate(tiers):
    h = TIER_H if i else 2.5
    add(cyl(r, r, h, (0, y, z - h/2 + (0 if i else 1.25)), WHITE()))

# ---- radial buttresses: ribs down each drum's outer face (skip the low plinth) ----
for i, (r, y, z) in enumerate(tiers):
    if i == 0:
        continue
    R = r + 0.4                                   # sit just proud of the drum face
    n = max(10, int(2*math.pi*r/9.0))
    for k in range(n):
        th = 2*math.pi*k/n
        bx = math.sin(th) * R
        by = y - math.cos(th) * R
        add(box(1.4, 1.2, TIER_H + 1.0, (bx, by, z - TIER_H/2 + 0.5), WHITE(), rot=(0, 0, -th)))

# ---- wall ring per tier: a real hollow annulus (a solid tube would cap the
# tier and bury the courtyards/buildings under its top face). Wound CCW from
# outside so Three.js front-face culling keeps every face visible in-game.
# cap_bottom adds a downward-facing underside (for protruding lips/ledges). ----
def _ring(Ro, Ri, h, cx, cyy, z0, m, n=28, cap_bottom=False):
    vs, fs = [], []
    for k in range(n):
        a = 2 * math.pi * k / n
        ca, sa = math.cos(a), math.sin(a)
        vs += [(cx + Ro*ca, cyy + Ro*sa, z0), (cx + Ro*ca, cyy + Ro*sa, z0 + h),
               (cx + Ri*ca, cyy + Ri*sa, z0), (cx + Ri*ca, cyy + Ri*sa, z0 + h)]
    for k in range(n):
        b, c = 4*k, 4*((k + 1) % n)
        fs += [(b, c, c + 1, b + 1),          # outer face (normal out)
               (b + 2, b + 3, c + 3, c + 2),  # inner face (normal in)
               (b + 1, c + 1, c + 3, b + 3)]  # top cap (normal up)
        if cap_bottom:
            fs += [(b, b + 2, c + 2, c)]       # bottom cap (normal down)
    return add(poly(vs, fs, m))

# ---- outward-facing semicircular arch head (fan disc), normal along +radial ----
def _arch(a, y, R, springz, radius, m, segs=8):
    tan = (math.cos(a), math.sin(a))
    cx, cy = math.sin(a) * R, y - math.cos(a) * R
    vs = [(cx, cy, springz)]
    for j in range(segs + 1):
        ang = math.pi * j / segs
        u, v = radius * math.cos(ang), radius * math.sin(ang)
        vs.append((cx + u*tan[0], cy + u*tan[1], springz + v))
    fs = [(0, 1 + j, 2 + j) for j in range(segs)]   # CCW in (tan,up) -> normal +rad
    return add(poly(vs, fs, m))

def _adiff(x, g):
    return abs(((x - g + math.pi) % (2*math.pi)) - math.pi)

# gate angle per tier (front for tier 0, alternating ±35° elsewhere)
def _gate_angle(i):
    return 0.0 if i == 0 else (math.radians(35) if i % 2 else -math.radians(35))

# ---- wall ring + a ROCK2 footing ledge seating the base + a CREAM mid belt ----
for i, (r, y, z) in enumerate(tiers):
    _ring(r + WALL_T, r - 0.6, WALL_H, 0, y, z, WALL())
    _ring(r + WALL_T + 0.9, r + WALL_T - 0.2, 1.1, 0, y, z, ROCK2())   # footing ledge
    if i in (2, 4, 6):
        add(tube(r + WALL_T + 0.15, 0.9, (0, y, z + 0.6), CREAM()))    # mid-wall belt

# ---- machicolation lip: a thin protruding ring under the battlements ----
for i, (r, y, z) in enumerate(tiers):
    _ring(r + WALL_T + 0.55, r + WALL_T - 0.3, 0.55, 0, y, z + WALL_H - 0.65,
          CREAM(), cap_bottom=True)

# ---- crenellated battlements: individual merlons, every 5th slightly taller ----
for i, (r, y, z) in enumerate(tiers):
    R = r + WALL_T
    top = z + WALL_H
    n = max(12, int(2*math.pi*R/4.5))             # ~4.5u pitch -> ~2u merlon + gap
    for k in range(n):
        th = 2*math.pi*k/n
        mx = math.sin(th) * R
        my = y - math.cos(th) * R
        mh = 2.2 if k % 5 == 0 else 1.5           # every 5th merlon taller
        add(box(2.0, 1.1, mh, (mx, my, top + mh/2), WALL(), rot=(0, 0, -th)))

# ---- arrow slits: sparse DARK slivers on the outer wall face (skip near gates) ----
for i, (r, y, z) in enumerate(tiers):
    R = r + WALL_T + 0.05
    ag = _gate_angle(i)
    ns = 6
    for k in range(ns):
        th = 2*math.pi*k/ns + math.pi/ns
        if _adiff(th, ag) < math.radians(24):
            continue
        sx = math.sin(th) * R
        sy = y - math.cos(th) * R
        add(box(0.25, 0.35, 1.6, (sx, sy, z + WALL_H*0.55), DARK(), rot=(0, 0, -th)))

# ---- bastion towers: round drums along each rim, protruding half out of the
# wall line, taller than the battlement; a couple per tier get VERDI cone caps,
# the rest get a flat cap + a little merlon ring. (skip near the gate) ----
for i, (r, y, z) in enumerate(tiers):
    R = r + WALL_T + 0.3                           # centre on the wall line (half out)
    ag = _gate_angle(i)
    ntow = min(6, max(4, int(r/9.0)))
    rt = 2.0 if i < 3 else 1.6
    if i >= 5:                                     # top rings are small — fewer,
        ntow, rt = 3, 1.25                         # slimmer turrets or they clutter
    Hs = WALL_H + 3.0
    for k in range(ntow):
        th = 2*math.pi*k/ntow + math.pi/ntow       # offset so none sit dead-front
        if _adiff(th, ag) < math.radians(22):
            continue
        tx = math.sin(th) * R
        ty = y - math.cos(th) * R
        add(tube(rt, Hs + 1.0, (tx, ty, z + Hs/2 - 0.5), WALL(), verts=12))
        capz = z + Hs - 0.5
        if k % 3 == 0 or i >= 5:                   # VERDI cone caps (always up top — cleaner)
            add(cyl(rt + 0.4, 0.1, 2.6, (tx, ty, capz + 1.3), VERDI(), verts=12))
        else:                                      # flat cap + merlon ring
            add(tube(rt + 0.35, 0.5, (tx, ty, capz + 0.25), WALL(), verts=12))
            for j in range(6):
                mth = 2*math.pi*j/6
                mmx = tx + math.sin(mth) * (rt + 0.1)
                mmy = ty - math.cos(mth) * (rt + 0.1)
                add(box(0.7, 0.5, 0.9, (mmx, mmy, capz + 0.9), WALL(), rot=(0, 0, -mth)))

# ---- stairways: a few visible runs of steps climbing the drum faces near gates
# so the tiers read as connected (thin ROCK2 boxes stepping up the cliff) ----
for i in (1, 3, 5):
    r, y, z = tiers[i]
    phi = _gate_angle(i) + math.radians(28)        # beside the gate, not through it
    steps = 9
    for s in range(steps):
        frac = (s + 0.5) / steps
        zz = z - TIER_H + frac * TIER_H
        Rs = r + 0.7                               # protrude from the drum face
        adv = (s - steps/2) * 1.15                 # slide along the tangent -> a run
        sx = math.sin(phi) * Rs + adv * math.cos(phi)
        sy = y - math.cos(phi) * Rs + adv * math.sin(phi)
        add(box(1.6, 2.2, 0.5, (sx, sy, zz), ROCK2(), rot=(0, 0, -phi)))

# ---- gates: tier 0 = big barbican at front (-Y); others alternate ±35° ----
for i, (r, y, z) in enumerate(tiers):
    main = (i == 0)
    a = _gate_angle(i)
    R = r + WALL_T
    tan = (math.cos(a),  math.sin(a))             # rim tangent unit
    dw = 4.0 if main else 2.6                     # door width
    dh = 6.0 if main else 4.0                     # door height

    # white stone frame, protruding proud of the wall
    Rf = R + 0.3
    fx, fy = math.sin(a) * Rf, y - math.cos(a) * Rf
    fh = dh + 1.8
    add(box(dw + 1.6, 2.2, fh, (fx, fy, z + fh/2 - 0.4), WHITE(), rot=(0, 0, -a)))

    # DARK reveal recessed behind the opening (depth to the arch)
    Rr = Rf - 0.6
    rx, ry = math.sin(a) * Rr, y - math.cos(a) * Rr
    add(box(dw * 0.85, 0.6, dh, (rx, ry, z + dh/2), DARK(), rot=(0, 0, -a)))

    # WOOD door panel on the frame's front face
    Rd = Rf + 1.5
    dx, dy = math.sin(a) * Rd, y - math.cos(a) * Rd
    add(box(dw, 0.5, dh, (dx, dy, z + dh/2), WOOD(), rot=(0, 0, -a)))

    # recessed DARK semicircular arch head over the door
    _arch(a, y, Rf + 0.05, z + dh - 0.5, dw/2, DARK())

    if main:
        # --- barbican: twin drum towers flanking the gate, VERDI-capped ---
        for s in (-1, 1):
            off = s * (dw/2 + 3.2)
            tx = fx + off * tan[0]
            ty = fy + off * tan[1]
            add(tube(2.8, 17.0, (tx, ty, z + 8.5), WALL(), verts=14))
            add(cyl(3.3, 0.12, 3.4, (tx, ty, z + 18.2), VERDI(), verts=14))
            for j in range(8):                     # crenel ring around each drum
                mth = 2*math.pi*j/8
                mmx = tx + math.sin(mth) * 2.9
                mmy = ty - math.cos(mth) * 2.9
                add(box(0.9, 0.6, 1.2, (mmx, mmy, z + 17.3), WALL(), rot=(0, 0, -mth)))
        # bridge lintel spanning the two towers above the gate
        add(box(dw + 5.5, 2.6, 2.2, (fx, fy, z + dh + 2.2), WHITE(), rot=(0, 0, -a)))
        # portcullis hint: DARK vertical slats in the opening
        for sc in (-1.1, 0.0, 1.1):
            px = dx + sc * tan[0]
            py = dy + sc * tan[1]
            add(box(0.35, 0.3, dh * 0.92, (px, py, z + dh*0.46), DARK(), rot=(0, 0, -a)))
        # short crenellated forewall stubs splaying out from the gate
        for s in (-1, 1):
            fa = a + s * math.radians(14)
            Rw = R + 4.0
            wx = math.sin(fa) * Rw
            wy = y - math.cos(fa) * Rw
            phi = fa - s * math.radians(35)        # splay the wall outward
            dirv = (math.cos(phi), math.sin(phi))  # local +X of rot=(0,0,-phi)
            add(box(9.0, 1.4, 4.0, (wx, wy, z + 2.0), WALL(), rot=(0, 0, -phi)))
            for t in (-3, -1, 1, 3):
                mmx = wx + dirv[0] * t * 1.9
                mmy = wy + dirv[1] * t * 1.9
                add(box(1.4, 1.5, 1.4, (mmx, mmy, z + 4.6), WALL(), rot=(0, 0, -phi)))
