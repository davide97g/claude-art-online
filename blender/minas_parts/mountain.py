# Mindolluin massif behind the city — see PART CONTRACT in minas_build.py
# One continuous jagged ridge of grey rock, not a row of separate cones. Each
# peak = a primary spire + 2-3 tilted sub-cones (ROCK/ROCK2 alternation) + ridge
# wedges; the two tallest carry sunk SNOW caps with streaks running down the
# face, horizontal ROCK2 cliff bands reading as strata, and ROCK2 scree fans
# spilling toward the city's rear walls. A low ROCK spur reaches out to the rear
# tiers so the city grows OUT of the mountain. All mass stays behind y>~40 (the
# connecting spur alone dips to y~36) so it never swallows the citadel from the
# -Y front camera; the tallest peak flanks the citadel rather than centering it.

def _rockwedge(x, y, z, w, d, h, m, yaw=0.0):
    """Triangular ridge prism: w(x) x d(y) base rising to a ridge line at +h."""
    c, s = math.cos(yaw), math.sin(yaw)
    def r(px, py): return (x + px * c - py * s, y + px * s + py * c)
    b0 = r(-w / 2, -d / 2); b1 = r(w / 2, -d / 2)
    b2 = r(w / 2,  d / 2); b3 = r(-w / 2,  d / 2)
    rk0 = r(-w / 2, 0.0);  rk1 = r(w / 2, 0.0)
    v = [(*b0, z), (*b1, z), (*b2, z), (*b3, z), (*rk0, z + h), (*rk1, z + h)]
    f = [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 4, 3), (1, 2, 5)]
    return poly(v, f, m)

def _cliffband(cx, cy, base_r, h, f, az):
    """A flattened tilted ROCK2 ledge hugging the cone face at height fraction f
    on the camera-facing azimuth az — reads as a horizontal strata band."""
    cr = base_r * (1.0 - f)                     # cone radius at this height
    z = h * f
    rx = cx + math.cos(az) * cr * 0.60
    ry = cy + math.sin(az) * cr * 0.60
    ln = cr * 1.25                              # wrap along the tangent
    add(box(ln, 2.8, 1.5, (rx, ry, z), ROCK2(), rot=(0.14, 0, az + math.pi / 2)))

def _screefan(cx, cy, base_r, az):
    """A flat splayed ROCK2 wedge at the peak base, spilling downhill toward the
    city. Flat triangle: inner apex up the slope, wide base low on the plain."""
    er = (math.cos(az), math.sin(az))           # radial (outward toward city)
    et = (-math.sin(az), math.cos(az))          # tangent
    sp = base_r * rng.uniform(0.5, 0.8)         # tangential spread at the foot
    ap = base_r * rng.uniform(0.82, 0.95)       # inner apex radius (up the slope)
    fo = base_r * rng.uniform(1.4, 1.9)         # outer foot radius
    P0 = (cx + er[0] * ap, cy + er[1] * ap, base_r * 0.10 + 1.5)
    P1 = (cx + er[0] * fo - et[0] * sp, cy + er[1] * fo - et[1] * sp, 0.3)
    P2 = (cx + er[0] * fo + et[0] * sp, cy + er[1] * fo + et[1] * sp, 0.3)
    add(poly([P0, P1, P2], [(0, 1, 2)], ROCK2()))   # winding -> normal out+up

def _snowstreak(cx, cy, base_r, h, az):
    """A thin SNOW triangle down the cone face from below the summit cap."""
    er = (math.cos(az), math.sin(az)); et = (-math.sin(az), math.cos(az))
    ft, fb = rng.uniform(0.62, 0.72), rng.uniform(0.24, 0.34)
    # 0.88 pulls the streak into the cone body so it can't float off the face
    crt, crb = base_r * (1 - ft) * 0.88, base_r * (1 - fb) * 0.88
    s = base_r * rng.uniform(0.06, 0.11)
    P0 = (cx + er[0] * crt, cy + er[1] * crt, h * ft)
    P1 = (cx + er[0] * crb - et[0] * s, cy + er[1] * crb - et[1] * s, h * fb)
    P2 = (cx + er[0] * crb + et[0] * s, cy + er[1] * crb + et[1] * s, h * fb)
    add(poly([P0, P1, P2], [(0, 1, 2)], SNOW()))    # winding -> normal out+up

def crag(cx, cy, base_r, h, snow=False, bands=0, scree=0, streaks=0):
    """A cluster of overlapping rock cones forming one craggy peak."""
    # primary spire — z-rotation only so a snow cap can sit true on the apex
    prim = cyl(base_r, 0.4, h, (cx, cy, h / 2), ROCK(), verts=8)
    prim.rotation_euler = (0, 0, rng.uniform(0, math.pi))
    add(prim)
    # 2-3 tilted sub-cones, ROCK2/ROCK alternation for facet shading
    for i in range(rng.randint(2, 3)):
        ang = rng.uniform(0, 2 * math.pi)
        dist = base_r * rng.uniform(0.42, 0.82)
        sx = cx + math.cos(ang) * dist
        sy = max(cy + math.sin(ang) * dist, 43.0)   # never creep in front of city
        sh = h * rng.uniform(0.55, 0.88)
        sr = base_r * rng.uniform(0.44, 0.72)
        sm = (ROCK2 if i % 2 == 0 else ROCK)()
        sub = cyl(sr, 0.4, sh, (sx, sy, sh / 2), sm, verts=7)
        tilt = rng.uniform(0.06, 0.22); ta = rng.uniform(0, 2 * math.pi)
        sub.rotation_euler = (math.sin(ta) * tilt, math.cos(ta) * tilt, rng.uniform(0, math.pi))
        add(sub)
    # a couple of jutting ridge wedges low on the flanks
    for _ in range(rng.randint(1, 2)):
        wa = rng.uniform(0, 2 * math.pi)
        wd = base_r * rng.uniform(0.5, 0.9)
        wx = cx + math.cos(wa) * wd
        wy = max(cy + math.sin(wa) * wd, 44.0)
        add(_rockwedge(wx, wy, h * rng.uniform(0.02, 0.12),
                       base_r * rng.uniform(0.35, 0.6), base_r * rng.uniform(0.5, 0.8),
                       h * rng.uniform(0.22, 0.4), (ROCK2 if rng.random() < 0.5 else ROCK)(),
                       yaw=rng.uniform(0, math.pi)))
    # horizontal strata bands on the front-facing slope of big peaks
    for i in range(bands):
        f = 0.30 + 0.20 * i + rng.uniform(-0.04, 0.04)     # rising ledges
        az = -math.pi + rng.uniform(0.6, 2.3)              # front hemisphere (-Y / -X)
        _cliffband(cx, cy, base_r, h, min(f, 0.82), az)
    # scree fans spilling toward the city (rear walls sit at -Y of the peak)
    for _ in range(scree):
        az = -math.pi / 2 + rng.uniform(-0.7, 0.7)         # face the city
        _screefan(cx, cy, base_r, az)
    if snow:  # snow cone sunk into the summit so it hugs the rock
        caph = h * 0.22
        add(cyl(base_r * 0.26, 0.2, caph, (cx, cy, h - caph * 0.62), SNOW(), verts=8))
        for _ in range(streaks):
            az = -math.pi / 2 + rng.uniform(-0.9, 0.9)
            _snowstreak(cx, cy, base_r, h, az)

# ---- the ridge: two hero peaks + fillers merging into one continuous wall ----
# (cx, cy, base_r, h, snow, bands, scree, streaks)
crag(12,  92, 50, 98, snow=True, bands=3, scree=3, streaks=3)   # hero peak, flanks citadel
crag(-32, 78, 40, 74, snow=True, bands=2, scree=2, streaks=3)   # second summit
crag(-60, 68, 30, 54, bands=1, scree=1)                         # far-left shoulder
crag(-46, 60, 24, 42, scree=1)                                  # left low ridge
crag(-10, 66, 30, 60, bands=1)                                  # gap filler between heroes
crag(34,  80, 34, 66, bands=2, scree=1)                         # right of hero
crag(56,  68, 30, 50, bands=1, scree=1)                         # right shoulder
crag(72,  60, 24, 40)                                           # far-right shoulder
crag(20,  56, 24, 36, scree=1)                                  # low front filler
crag(-20, 52, 22, 34, scree=1)                                  # low front-left filler
# back layer for depth — sits further behind, jags the skyline higher up
crag(-42, 96, 26, 60)
crag(42,  98, 26, 58)

# ---- shoulder spur: a low ROCK ridge reaching from the massif out to the rear
# tiers (y~36, meeting z of tiers 4-5) so the city visibly grows from the rock.
def _spur(mx, my, cx2, cy2, hw0, hw1, ztop0, ztop1, zb0, zb1, m):
    # mountain-end cross-section (L,R,ridge) then city-end cross-section
    v = [(-hw0 + mx, my, zb0), (hw0 + mx, my, zb0), (mx, my, ztop0),      # 0,1,2
         (-hw1 + cx2, cy2, zb1), (hw1 + cx2, cy2, zb1), (cx2, cy2, ztop1)] # 3,4,5
    f = [(0, 3, 5, 2),   # left slope (normal -X)
         (1, 2, 5, 4),   # right slope (normal +X)
         (0, 1, 4, 3),   # underside
         (0, 2, 1),      # mountain-end cap (+Y, away from cam)
         (3, 4, 5)]      # city-end cap (-Y, toward cam)
    return poly(v, f, m)
add(_spur(2, 54, 4, 36, 17, 11, 44, 30, 15, 11, ROCK()))
add(_spur(-24, 56, -14, 40, 12, 8, 34, 26, 12, 10, ROCK2()))   # a second, thinner spur left of center
