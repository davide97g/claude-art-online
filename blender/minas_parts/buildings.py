# houses + towers + domes + civic anchors on every tier ring — see PART CONTRACT
# in minas_build.py.  DENSITY PASS: the real city packs every tier wall-to-wall,
# so we (a) roughly double the count, (b) grow row-house terraces that share
# walls, (c) plant one big civic anchor (basilica / domed temple) per tier, (d)
# lavish window/door/eave detail only on the large + visible buildings, (e) vary
# the roofscape (gable / hip / flat / dormer), (f) give towers merlon rims and
# bell openings, (g) carve a few radial ALLEYS so streets read from above, and
# (h) sprinkle courtyard props between houses.
#
# CRITICAL invariants preserved from the last fix:
#   - `z = z + 2.5 if i == 0 else z`  (tier-0 ground is the plinth top)
#   - next-tier-drum rejection + prow-lane rejection (|x|<5 on the -Y side)
#   - outward-wound gable/hip normals (game culls backfaces)
# Walls are hollow, so building bases ARE visible from above — they sit on the
# tier floor (z), never at world 0.

def _face(bx, by, rz, ox, oy):
    """world point of a local offset (ox,oy) on a body rotated rz about z."""
    c, s = math.cos(rz), math.sin(rz)
    return (bx + ox * c - oy * s, by + ox * s + oy * c)

def _gable(bx, by, base_z, w, d, rh, m, rz):
    """triangular-prism roof, ridge along local x, slight overhang. Wound OUT."""
    hw, hd = w * 0.56, d * 0.56
    c, s = math.cos(rz), math.sin(rz)
    def R(x, y, z):
        return (bx + x * c - y * s, by + x * s + y * c, base_z + z)
    v = [R(-hw, -hd, 0), R(hw, -hd, 0), R(hw, hd, 0), R(-hw, hd, 0),
         R(-hw, 0, rh), R(hw, 0, rh)]
    f = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]
    return add(poly(v, f, m))

def _hip(bx, by, base_z, w, d, rh, m, rz):
    """4-sided hipped pyramid roof (apex centred). Faces wound OUTWARD."""
    hw, hd = w * 0.56, d * 0.56
    c, s = math.cos(rz), math.sin(rz)
    def R(x, y, z):
        return (bx + x * c - y * s, by + x * s + y * c, base_z + z)
    v = [R(-hw, -hd, 0), R(hw, -hd, 0), R(hw, hd, 0), R(-hw, hd, 0), R(0, 0, rh)]
    f = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]
    return add(poly(v, f, m))

def _in_alley(a, alleys):
    """True if angle a falls inside one of the reserved radial street gaps."""
    for ac, aw in alleys:
        if abs(((a - ac + math.pi) % (2 * math.pi)) - math.pi) < aw:
            return True
    return False

def _house_detail(bx, by, z, w, d, bh, rz, big, tall):
    """WOOD door + DARK window row + eave-shadow sliver on a large house."""
    if big:                                            # door on the inward (-Y) face
        dx, dy = _face(bx, by, rz, 0, -d / 2 - 0.06)
        add(box(min(1.0, w * 0.42), 0.16, 1.5, (dx, dy, z + 0.75), WOOD(), rot=(0, 0, rz)))
        ex, ey = _face(bx, by, rz, 0, d * 0.56)        # eave shadow under the roof edge
        add(box(w * 1.02, 0.08, 0.16, (ex, ey, z + bh - 0.02), DARK(), rot=(0, 0, rz)))
    if tall:                                           # 2-3 window slots on the outward face
        nw = rng.randint(2, 3)
        span = w * 0.62
        for k in range(nw):
            fx = (-span / 2 + span * k / (nw - 1)) if nw > 1 else 0.0
            wx, wy = _face(bx, by, rz, fx, d / 2 + 0.05)
            add(box(0.34, 0.12, 0.52, (wx, wy, z + bh * 0.55), DARK(), rot=(0, 0, rz)))
    if big and tall and rng.random() < 0.22:           # occasional WOOD balcony stub
        bxo, byo = _face(bx, by, rz, 0, d / 2 + 0.16)
        add(box(w * 0.6, 0.5, 0.14, (bxo, byo, z + bh * 0.6), WOOD(), rot=(0, 0, rz)))

def _terrace(bx, by, z, rz, count, wall, bh, rh, hmax):
    """row of `count` houses sharing walls, running along local +X (the tangent)
    so it reads as a curved street terrace with a continuous ridgeline."""
    c, s = math.cos(rz), math.sin(rz)
    ws = [rng.uniform(2.4, 3.4) for _ in range(count)]
    d = rng.uniform(2.6, 3.8)
    cursor = -sum(ws) / 2.0
    for k in range(count):
        w = ws[k]
        cx = cursor + w / 2.0
        cursor += w
        wx, wy = bx + cx * c, by + cx * s
        add(box(w + 0.03, d, bh, (wx, wy, z + bh / 2), wall, rot=(0, 0, rz)))  # +.03 kiss
        _gable(wx, wy, z + bh, w, d, rh, ROOF(), rz)
        if rng.random() < 0.6:                          # a lit window on the outward face
            wwx, wwy = _face(wx, wy, rz, 0, d / 2 + 0.04)
            add(box(0.3, 0.1, 0.5, (wwx, wwy, z + bh * 0.55), DARK(), rot=(0, 0, rz)))
    dx, dy = _face(bx, by, rz, 0, -d / 2 - 0.05)        # one shared street door
    add(box(0.9, 0.14, 1.5, (dx, dy, z + 0.75), WOOD(), rot=(0, 0, rz)))

def _prop(bx, by, z, rz):
    """tiny courtyard filler dropped in the gap beside a house."""
    if rng.random() < 0.5:                              # WOOD crate (sometimes a pair)
        add(box(0.8, 0.8, 0.8, (bx, by, z + 0.4), WOOD(), rot=(0, 0, rz)))
        if rng.random() < 0.5:
            px, py = _face(bx, by, rz, 0.7, 0)
            add(box(0.6, 0.6, 0.55, (px, py, z + 0.28), WOOD(), rot=(0, 0, rz)))
    else:                                               # GREEN courtyard-garden patch
        add(box(1.7, 1.7, 0.14, (bx, by, z + 0.07), GREEN(), rot=(0, 0, rz)))

# =====================================================================
# civic anchors — one prominent public building per tier
# =====================================================================
def _basilica(cx, cy, z, rz, hmax):
    """long gabled hall + apse + campanile + columned porch (wide lower tiers)."""
    bw, bL, bH = 4.4, 11.0, hmax + 2.2                  # radial thickness, length, height
    add(box(bw, bL, bH, (cx, cy, z + bH / 2), WHITE(), rot=(0, 0, rz)))
    _gable(cx, cy, z + bH, bL, bw, 3.0, ROOF(), rz)     # long ridge along local X
    add(box(bL + 0.2, bw + 0.2, 0.32, (cx, cy, z + bH * 0.72), CREAM(), rot=(0, 0, rz)))  # string course
    # apse: half-round end + verdigris half-dome, at the +X end
    ax, ay = _face(cx, cy, rz, bL / 2 + 0.1, 0)
    add(tube(bw * 0.55, bH, (ax, ay, z + bH / 2), WHITE(), verts=12, rot=(0, 0, rz)))
    add(ico(bw * 0.55, (ax, ay, z + bH), VERDI(), sub=0, scale=(1, 1, 0.6)))
    # campanile (bell tower) at the -X end
    tx, ty = _face(cx, cy, rz, -bL / 2 - 0.7, 0)
    tH = bH + 5.5
    add(box(2.4, 2.4, tH, (tx, ty, z + tH / 2), WHITE(), rot=(0, 0, rz)))
    for sy in (-1, 1):
        wx, wy = _face(tx, ty, rz, 0, sy * 1.25)
        add(box(1.1, 0.15, 1.7, (wx, wy, z + tH - 2.4), DARK(), rot=(0, 0, rz)))
    add(cyl(1.7, 0.05, 2.6, (tx, ty, z + tH + 1.3), ROOF(), verts=8))
    # windows on the outward long face + columned porch on the inward face
    for cxo in (-3.6, -1.2, 1.2, 3.6):
        wx, wy = _face(cx, cy, rz, cxo, bw / 2 + 0.05)
        add(box(0.8, 0.12, 2.2, (wx, wy, z + bH * 0.55), DARK(), rot=(0, 0, rz)))
    po = -(bw / 2 + 1.2)
    for cxo in (-3.5, -1.75, 0.0, 1.75, 3.5):
        px, py = _face(cx, cy, rz, cxo, po)
        add(tube(0.3, bH * 0.8, (px, py, z + bH * 0.4), WALL(), verts=6))
    lx, ly = _face(cx, cy, rz, 0, po)
    add(box(bL * 0.78, 1.2, 0.6, (lx, ly, z + bH * 0.8), WHITE(), rot=(0, 0, rz)))

def _temple(cx, cy, z, rz, hmax):
    """compact verdigris-domed rotunda + columned porch (narrow upper tiers)."""
    dr, base_h = 2.6, 0.8
    dH = hmax + 1.0
    add(tube(dr + 0.6, base_h, (cx, cy, z + base_h / 2), WHITE(), verts=16))      # stepped base
    add(tube(dr, dH, (cx, cy, z + base_h + dH / 2), WALL(), verts=12))            # drum
    add(ico(dr * 1.02, (cx, cy, z + base_h + dH), VERDI(), sub=1, scale=(1, 1, 0.7)))  # dome
    lz = z + base_h + dH + dr * 0.7
    add(tube(0.5, 1.4, (cx, cy, lz + 0.5), WALL(), verts=8))                      # lantern
    add(ico(0.55, (cx, cy, lz + 1.5), VERDI(), sub=0))
    for cxo in (-1.6, -0.53, 0.53, 1.6):                                          # porch columns (inward)
        px, py = _face(cx, cy, rz, cxo, -(dr + 0.7))
        add(tube(0.26, dH * 0.8, (px, py, z + base_h + dH * 0.4), WALL(), verts=6))
    lx, ly = _face(cx, cy, rz, 0, -(dr + 0.7))
    add(box(dr * 2.2, 1.0, 0.5, (lx, ly, z + base_h + dH * 0.8), WHITE(), rot=(0, 0, rz)))
    for k in range(4):                                                           # drum windows
        aa = rz + math.radians(45 + 90 * k)
        wx, wy = cx + math.cos(aa) * (dr + 0.02), cy + math.sin(aa) * (dr + 0.02)
        add(box(0.3, 0.5, 1.4, (wx, wy, z + base_h + dH * 0.55), DARK(), rot=(0, 0, aa)))

# =====================================================================
for i, (r, y, z) in enumerate(tiers[:-1]):
    nr, ny = tiers[i + 1][0], tiers[i + 1][1]
    z = z + 2.5 if i == 0 else z          # tier-0 ground is the plinth top, not z=0
    hmax = 8.2 - i * 0.85                 # slightly taller overall, esp. tiers 0-2

    # radial street gaps (alleys): skip a few angular wedges so lanes read from above
    alleys = []
    for _ in range(2 + (i % 2)):
        alleys.append((rng.uniform(-math.pi, math.pi), rng.uniform(0.10, 0.16)))

    # ---- civic anchor: one per tier, sited mid-band away from prow + alleys ----
    arr = (nr + r) * 0.5
    cxx = cyy = None
    for _t in range(24):
        aa = rng.uniform(-math.pi, math.pi)
        if _in_alley(aa, alleys):
            continue
        px, py = math.sin(aa) * arr, y - math.cos(aa) * arr
        if abs(px) < 9.0 and py < y:
            continue
        if math.hypot(px, py - ny) < nr + 3.0:
            continue
        cxx, cyy = px, py
        break
    if cxx is not None:
        rzc = math.atan2(-cxx, cyy - y)   # local +Y points radially outward
        if i < 3:
            _basilica(cxx, cyy, z, rzc, hmax)
        else:
            _temple(cxx, cyy, z, rzc, hmax)
    anchor_clear = 7.5 if i < 3 else 5.0

    # ---- packed houses / terraces / towers ----
    n_b = max(16, int(r * 2.5))
    placed, tries, since_prop = 0, 0, 0
    while placed < n_b and tries < n_b * 7:
        tries += 1
        a = rng.uniform(-math.pi, math.pi)
        if _in_alley(a, alleys):
            continue
        rr = rng.uniform(nr + 2.2, r - 1.8)
        bx = math.sin(a) * rr
        by = y - math.cos(a) * rr
        if math.hypot(bx, by - ny) < nr + 2.0:          # outside next tier's drum
            continue
        if abs(bx) < 5.0 and by < y:                     # clear of the -Y prow lane
            continue
        if cxx is not None and math.hypot(bx - cxx, by - cyy) < anchor_clear:
            continue

        wall = CREAM() if rng.random() < 0.30 else WHITE()
        bh = rng.uniform(2.8, max(3.6, hmax))
        rz = a + rng.uniform(-0.10, 0.10)               # small tangent-aligned jitter
        rz_h = rng.uniform(-0.45, 0.45)                 # free jitter for lone houses
        k = rng.random()

        if k < 0.50:
            # (a) TERRACE — 2-3 row houses sharing walls along the tangent
            cnt = rng.randint(2, 3) if i < 3 else 2
            _terrace(bx, by, z, rz, cnt, wall, bh, rng.uniform(1.0, 1.6), hmax)
            placed += cnt
        elif k < 0.72:
            # (b) gabled house (+ detail if large, + dormer / chimney)
            w = rng.uniform(2.4, 4.3)
            d = rng.uniform(2.4, 4.3)
            add(box(w, d, bh, (bx, by, z + bh / 2), wall, rot=(0, 0, rz_h)))
            rh = rng.uniform(1.1, 1.9)
            _gable(bx, by, z + bh, w, d, rh, ROOF(), rz_h)
            big, tall = (bh > 4.4 and w > 3.0), (bh > 4.8)
            _house_detail(bx, by, z, w, d, bh, rz_h, big, tall)
            if big and rng.random() < 0.30:             # attic dormer on the outward slope
                dmx, dmy = _face(bx, by, rz_h, rng.uniform(-w * 0.2, w * 0.2), d * 0.28)
                add(box(0.8, 0.7, 0.8, (dmx, dmy, z + bh + rh * 0.3 + 0.3), wall, rot=(0, 0, rz_h)))
            elif rng.random() < 0.20:                   # or a chimney
                cx, cy = _face(bx, by, rz_h, rng.uniform(-w * 0.3, w * 0.3), 0)
                add(box(0.4, 0.4, 1.3, (cx, cy, z + bh + rh * 0.4 + 0.65), WHITE(), rot=(0, 0, rz_h)))
            placed += 1
        elif k < 0.80:
            # (c) hipped-roof house (pyramid cap)
            w = rng.uniform(2.6, 4.0)
            d = rng.uniform(2.6, 4.0)
            add(box(w, d, bh, (bx, by, z + bh / 2), wall, rot=(0, 0, rz_h)))
            _hip(bx, by, z + bh, w, d, rng.uniform(1.4, 2.2), ROOF(), rz_h)
            _house_detail(bx, by, z, w, d, bh, rz_h, (bh > 4.4 and w > 3.0), bh > 4.8)
            placed += 1
        elif k < 0.87:
            # (d) flat-roof house with a parapet lip
            w = rng.uniform(2.4, 4.0)
            d = rng.uniform(2.4, 4.0)
            add(box(w, d, bh, (bx, by, z + bh / 2), wall, rot=(0, 0, rz_h)))
            add(box(w * 1.05, d * 1.05, 0.5, (bx, by, z + bh + 0.15), wall, rot=(0, 0, rz_h)))
            _house_detail(bx, by, z, w, d, bh, rz_h, False, bh > 4.8)
            placed += 1
        elif k < 0.94:
            # (e) round tower — cone cap / merlon rim / bell-tower variants
            tr = rng.uniform(1.2, 2.0)
            th = bh + rng.uniform(2.0, 5.0)
            add(tube(tr, th, (bx, by, z + th / 2), wall, verts=8, rot=(0, 0, rz_h)))
            tk = rng.random()
            if tk < 0.40:
                cap = rng.uniform(2.0, 3.2)
                add(cyl(tr * 1.15, 0.05, cap, (bx, by, z + th + cap / 2), ROOF(), verts=8))
            elif tk < 0.75:
                nm = rng.randint(4, 6)                  # merlon crown
                for mm in range(nm):
                    aa = rz_h + 2 * math.pi * mm / nm
                    add(box(0.6, 0.6, 0.9, (bx + math.cos(aa) * tr, by + math.sin(aa) * tr,
                            z + th + 0.35), wall, rot=(0, 0, aa)))
            else:
                add(cyl(tr * 1.1, 0.05, 1.6, (bx, by, z + th + 0.8), VERDI(), verts=8))
                for sy in (-1, 1):                      # bell openings near the top
                    wx, wy = _face(bx, by, rz_h, 0, sy * tr)
                    add(box(0.8, 0.15, 1.5, (wx, wy, z + th - 1.6), DARK(), rot=(0, 0, rz_h)))
            placed += 1
        else:
            # (f) small verdigris-dome building
            tr = rng.uniform(1.6, 2.4)
            th = bh * 0.9
            add(tube(tr, th, (bx, by, z + th / 2), wall, verts=8, rot=(0, 0, rz_h)))
            add(ico(tr * 1.02, (bx, by, z + th), VERDI(), sub=0, scale=(1, 1, 0.7)))
            placed += 1

        # sprinkle a courtyard prop (~1 per 6 placements) in the adjacent gap
        since_prop += 1
        if since_prop >= 6 and rng.random() < 0.6:
            since_prop = 0
            gx, gy = _face(bx, by, rz_h, rng.uniform(2.2, 3.2), rng.uniform(-1.0, 1.0))
            if not (abs(gx) < 5.0 and gy < y) and math.hypot(gx, gy - ny) > nr + 1.5:
                _prop(gx, gy, z, rz_h)

    # a few slender watchtowers per tier (kept from baseline)
    for _ in range(3):
        a = rng.uniform(-math.pi, math.pi)
        rr = r - 1.8
        bx, by = math.sin(a) * rr, y - math.cos(a) * rr
        if math.hypot(bx, by - ny) < nr + 1.5:
            continue
        if abs(bx) < 5.0 and by < y:
            continue
        th = rng.uniform(7, 10)
        add(tube(1.1, th, (bx, by, z + th / 2), WALL(), verts=8))
        add(cyl(1.5, 0.05, 2.6, (bx, by, z + th + 1.3), ROOF(), verts=8))
