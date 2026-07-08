# citadel: court + lawns + White Tree, Hall of Kings, White Tower of Ecthelion,
# guard statues + kings of old + furnishings — see PART CONTRACT in minas_build.py.
# Top tier: r=15, center (0, cy), floor z=cz. City faces -Y (prow/front at -Y),
# so lawns + entrance sit toward -Y, the hall sits behind at +Y.
# MAX pass: radial sunburst paving, majestic asymmetric White Tree + garden fence,
# raised clerestoried Hall of Kings w/ turrets + grand stair + niches, twin-balcony
# ringed White Tower, benches/sundial/lamps, guard figures, rear kitchen annex.
cr, cy, cz = tiers[-1][0], tiers[-1][1], tiers[-1][2]
zb = cz + 1.0                                                    # paving surface (=49)

# =====================================================================
# court paving — pale disk + a couple guide rings + RADIAL SUNBURST
# =====================================================================
add(cyl(cr, cr, 1.0, (0, cy, cz + 0.5), WHITE()))               # pale paving disk
for rr, mm, dz in ((12.5, CREAM(), 0.05), (6.5, WHITE(), 0.11)):
    add(tube(rr, 0.3, (0, cy, zb + dz), mm, verts=28))
# radial sunburst — thin CREAM wedge spokes fanning out from the fountain
sbX, sbY = 0.0, cy - 6.0                                        # fountain centre (=8)
sb_in, sb_out = 2.7, 9.6
sb_len = sb_out - sb_in
for a in range(16):
    ang = math.radians(360 / 16 * a)
    rmid = sb_in + sb_len / 2
    add(box(0.34, sb_len, 0.10,
            (sbX + rmid * math.cos(ang), sbY + rmid * math.sin(ang), zb + 0.07),
            CREAM(), rot=(0, 0, ang - math.radians(90))))
# slim CREAM processional path: front rim -> fountain, fountain -> tower door
add(box(1.8, 6.0, 0.22, (0, 2.5, zb + 0.30), CREAM()))
add(box(1.6, 1.8, 0.22, (0, 11.2, zb + 0.30), CREAM()))

# =====================================================================
# front lawns (toward -Y): two GREEN quadrants split by the central path
# =====================================================================
lawn_y = cy - 6.0                                               # ~8, front half
add(cyl(4.2, 4.2, 0.5, (-4.6, lawn_y, zb + 0.25), GREEN(), verts=20))
add(cyl(4.2, 4.2, 0.5, ( 4.6, lawn_y, zb + 0.25), GREEN(), verts=20))
for sx in (-1, 1):
    add(box(0.5, 6.4, 0.7, (sx * 1.1, lawn_y, zb + 0.55), GREEN()))       # inner hedge
    add(box(6.0, 0.5, 0.7, (sx * 4.6, lawn_y - 3.9, zb + 0.55), GREEN())) # front hedge

# =====================================================================
# White Tree of Gondor + fountain — majestic, asymmetric crown, garden fence
# =====================================================================
tX, tY = 0.0, lawn_y
add(tube(2.4, 0.6, (tX, tY, zb + 0.3), WHITE(), verts=18))      # fountain basin
add(tube(1.7, 0.5, (tX, tY, zb + 0.45), VERDI(), verts=16))     # inner water ring
add(ico(0.35, (tX, tY, zb + 0.9), VERDI(), sub=0))             # tiny jet finial
# ring of 4 tiny WHITE guard-post pillars around the fountain
for a in range(4):
    ang = math.radians(45 + 90 * a)
    gx, gy = tX + 2.9 * math.cos(ang), tY + 2.9 * math.sin(ang)
    add(tube(0.16, 1.4, (gx, gy, zb + 0.7), WHITE(), verts=6))
    add(ico(0.22, (gx, gy, zb + 1.5), WHITE(), sub=0))
# low WHITE garden fence ring around the tree lawn (10 posts + thin rails)
fr = 3.75
for a in range(10):
    ang = math.radians(36 * a)
    fx, fy = tX + fr * math.cos(ang), tY + fr * math.sin(ang)
    add(tube(0.10, 1.1, (fx, fy, zb + 0.55), WHITE(), verts=6))       # post
    mang = math.radians(36 * a + 18)                                 # rail to next post
    chord = 2 * fr * math.sin(math.radians(18))
    mx, my = tX + fr * math.cos(mang), tY + fr * math.sin(mang)
    add(box(chord, 0.07, 0.14, (mx, my, zb + 0.85), WHITE(),
            rot=(0, 0, mang + math.radians(90))))
# tall tapered trunk (to ~z 58) + drooping/reaching branches
trunk_top = zb + 9.0                                           # ~58
add(cyl(0.55, 0.24, 9.0, (tX, tY, zb + 4.5), TREE(), verts=8))
branches = [                                                   # (loc, rot, len)
    ((tX + 0.9, tY, trunk_top - 2.4), (0, math.radians(58), 0), 3.4),
    ((tX - 1.0, tY, trunk_top - 2.7), (0, math.radians(-52), 0), 3.1),
    ((tX, tY + 0.9, trunk_top - 2.2), (math.radians(-54), 0, 0), 3.2),
    ((tX, tY - 0.85, trunk_top - 2.9), (math.radians(52), 0, 0), 2.8),
    ((tX + 0.4, tY - 0.3, trunk_top - 0.3), (math.radians(20), 0, math.radians(-14)), 2.8),
    ((tX - 0.5, tY + 0.3, trunk_top - 0.6), (math.radians(-18), 0, math.radians(16)), 2.6),
]
for loc, rot, ln in branches:
    add(tube(0.14, ln, loc, TREE(), verts=6, rot=rot))
# drooping outer twigs (thin, low verts)
for dx, dy, dz, rx, ry in ((2.0, 0, -0.4, 0, math.radians(96)),
                           (-1.9, 0, -0.5, 0, math.radians(-100)),
                           (0, 1.9, -0.3, math.radians(-98), 0),
                           (0.3, -1.8, -0.6, math.radians(100), 0)):
    add(tube(0.09, 1.6, (tX + dx, tY + dy, trunk_top + dz), TREE(), verts=5,
             rot=(rx, ry, 0)))
# asymmetric crown — 3 large white clusters at varied offsets + tiny blossoms
crown = [((tX - 0.4, tY - 0.2, trunk_top + 1.2), 1.9, (1.05, 1.0, 0.85)),
         ((tX + 1.5, tY + 0.4, trunk_top + 0.4), 1.35, (1.0, 1.0, 0.95)),
         ((tX - 0.3, tY + 1.4, trunk_top + 0.7), 1.2, (1.0, 1.0, 0.9)),
         ((tX + 0.5, tY - 1.2, trunk_top + 0.2), 1.0, None)]
for c, r, sc in crown:
    add(ico(r, c, WHITE(), sub=1, scale=sc))
# tiny WHITE blossom icos scattered IN the canopy (sub=0, cheap)
rng2 = random.Random(1313)
for _ in range(11):
    a = rng2.uniform(0, 6.283); rr = rng2.uniform(0.6, 2.2)
    bx = tX + rr * math.cos(a) * 0.9
    by = tY + rr * math.sin(a) * 0.7
    bz = trunk_top + rng2.uniform(-0.4, 2.0)
    add(ico(rng2.uniform(0.16, 0.28), (bx, by, bz), TREE(), sub=0))

# =====================================================================
# Hall of Kings (behind the tower, +Y): raised ribbed body, apse, porch,
# clerestory, stepped cornice, twin turrets, grand stair, statue niches
# =====================================================================
hy = cy + 7.0                                                 # ~21, back half
hL, hW, hH = 9.0, 6.4, 7.0                                    # raised slightly (was 6.0)
add(box(hW, hL, hH, (0, hy, zb + hH / 2), WHITE()))           # hall body
yF, yBk = hy - hL / 2, hy + hL / 2                            # 16.5 / 25.5 walls
# WOOD double door (court side, -Y) with WHITE frame + arch head
add(box(2.2, 0.3, 4.2, (0, yF + 0.1, zb + 2.1), WHITE()))     # frame
add(box(0.8, 0.45, 3.4, (-0.5, yF - 0.05, zb + 1.7), WOOD())) # leaf L
add(box(0.8, 0.45, 3.4, ( 0.5, yF - 0.05, zb + 1.7), WOOD())) # leaf R
add(cyl(1.0, 1.0, 0.4, (0, yF + 0.02, zb + 3.5), WOOD(), verts=14, rot=(math.radians(90), 0, 0)))
# statue niches flanking the door: shallow DARK inset + tiny WHITE statue stub
for sx in (-1, 1):
    add(box(0.85, 0.25, 2.6, (sx * 1.7, yF + 0.08, zb + 2.3), DARK()))
    add(box(0.34, 0.28, 1.7, (sx * 1.7, yF - 0.05, zb + 1.75), WHITE()))
    add(ico(0.24, (sx * 1.7, yF - 0.05, zb + 2.8), WHITE(), sub=0))
# main DARK window slots + WHITE buttress ribs per long side
for sx in (-1, 1):
    for wy in (18.5, 20.5, 22.5, 24.5):
        add(box(0.25, 0.75, 2.4, (sx * 3.25, wy, zb + 3.2), DARK()))
    for by in (19.5, 21.5, 23.5):
        add(box(0.45, 0.4, 6.2, (sx * 3.4, by, zb + 3.0), WHITE()))       # buttress rib
    # clerestory: a smaller second row of DARK windows above the first
    for wy in (18.5, 20.5, 22.5, 24.5):
        add(box(0.22, 0.55, 1.0, (sx * 3.24, wy, zb + 5.4), DARK()))
# stepped WHITE cornice line at the eaves (two slightly-offset tiers)
ez = zb + hH
add(box(hW + 0.9, hL + 0.9, 0.35, (0, hy, ez - 0.6), WHITE()))   # lower step
add(box(hW + 0.5, hL + 0.5, 0.30, (0, hy, ez - 0.25), WHITE()))  # upper step
# twin VERDI-capped turrets at the front corners
for sx in (-1, 1):
    tx = sx * (hW / 2 - 0.1)
    add(tube(0.6, hH + 1.4, (tx, yF + 0.2, zb + (hH + 1.4) / 2), WALL(), verts=10))
    add(cyl(0.9, 0.04, 1.8, (tx, yF + 0.2, ez + 1.4 + 0.9), VERDI(), verts=10))
    add(tube(0.72, 0.3, (tx, yF + 0.2, ez + 1.4), CREAM(), verts=10))     # turret cornice
# rear apse (half-sunk drum into +Y wall) + VERDI dome
apse_y = yBk + 0.2
add(tube(2.9, hH, (0, apse_y, zb + hH / 2), WHITE(), verts=16))
add(ico(2.9, (0, apse_y, zb + hH), VERDI(), sub=1, scale=(1.0, 1.0, 0.55)))
# gable slate roof (triangular prism), ridge running along Y
gz = ez
rz = gz + 3.2
yFe, yBe = yF - 0.2, yBk + 0.2
xE = hW / 2 + 0.3
gverts = [(-xE, yFe, gz), (xE, yFe, gz), (0, yFe, rz),
          (-xE, yBe, gz), (xE, yBe, gz), (0, yBe, rz)]
gfaces = [(0, 1, 2), (5, 4, 3), (0, 2, 5, 3), (1, 4, 5, 2)]
add(poly(gverts, gfaces, ROOF()))
add(cyl(0.55, 0.03, 1.8, (0, yBe - 0.4, rz + 0.9), VERDI(), verts=8))     # ridge finial
# columned porch across the court-facing (-Y) front of the hall
py = yF - 1.4
for cxo in (-2.6, -1.3, 0.0, 1.3, 2.6):
    add(tube(0.36, 5.6, (cxo, py, zb + 2.8), WALL(), verts=8))
add(box(hW, 1.8, 0.7, (0, py, zb + 5.8), WHITE()))                        # porch lintel
# grand staircase up to the porch (5 broadening steps, court side)
for i in range(5):
    w = 4.4 + i * 0.5
    add(box(w, 0.6, 0.24, (0, py - 1.9 + i * 0.42, zb + 0.12 + i * 0.24), WHITE()))

# =====================================================================
# White Tower of Ecthelion — tapered stack, string courses, twin balconies,
# arched drum openings, ringed spire, pennant chain
# =====================================================================
wX, wY = 0.0, cy + 1.5                                        # between court and hall
d_h, s_h = 6.0, 14.0
drum_top = zb + d_h                                           # 55
shaft_top = drum_top + s_h                                   # 69
add(cyl(3.6, 3.2, d_h, (wX, wY, zb + d_h / 2), WALL(), verts=18))        # wide base drum
add(cyl(2.7, 2.5, s_h, (wX, wY, drum_top + s_h / 2), WALL(), verts=18))  # shaft
add(tube(3.35, 0.45, (wX, wY, drum_top), CREAM(), verts=18))            # string courses
add(tube(2.7,  0.4,  (wX, wY, drum_top + 6.0), CREAM(), verts=18))
add(tube(2.6,  0.4,  (wX, wY, shaft_top - 2.0), CREAM(), verts=18))
# arched WOOD door + WHITE frame + 3 shallow steps at the tower base (front, -Y)
dyf = wY - 3.55
add(box(2.0, 0.25, 3.6, (wX, dyf + 0.12, zb + 1.8), WHITE()))
add(box(1.3, 0.35, 3.0, (wX, dyf, zb + 1.5), WOOD()))
add(cyl(0.75, 0.75, 0.4, (wX, dyf + 0.05, zb + 3.0), WOOD(), verts=12, rot=(math.radians(90), 0, 0)))
for i, sw in enumerate((2.6, 2.2, 1.8)):
    add(box(sw, 0.6, 0.22, (wX, dyf - 0.7 + i * 0.35, zb + 0.15 + i * 0.24), WHITE()))
# 2 stacked DARK window slots on the shaft (front + two sides)
for (sx, sy, rz2) in ((0, -1, 0), (-1, 0, math.radians(90)), (1, 0, math.radians(90))):
    for wz in (drum_top + 3.0, drum_top + 8.0):
        add(box(0.7, 0.25, 2.0, (wX + sx * 2.6, wY + sy * 2.6, wz), DARK(), rot=(0, 0, rz2)))
# 8 slender arched openings (DARK slivers) around the drum just below the balcony
for a in range(8):
    ang = math.radians(22.5 + 45 * a)
    ox, oy = wX + 2.62 * math.cos(ang), wY + 2.62 * math.sin(ang)
    add(box(0.55, 0.22, 1.7, (ox, oy, shaft_top - 3.4), DARK(), rot=(0, 0, ang)))
# main balcony ring + 8 tiny merlon blocks
add(tube(3.5, 1.4, (wX, wY, shaft_top - 0.7), WHITE(), verts=18))
for a in range(8):
    ang = math.radians(22.5 + 45 * a)
    add(box(0.5, 0.5, 0.7, (wX + 3.35 * math.cos(ang), wY + 3.35 * math.sin(ang),
                            shaft_top + 0.35), WHITE(), rot=(0, 0, ang)))
# 4 corner pinnacles with VERDI caps, around the shaft top
for sx in (-1, 1):
    for sy in (-1, 1):
        px, pyv = wX + sx * 2.55, wY + sy * 2.55
        add(tube(0.5, 6.0, (px, pyv, shaft_top - 1.0), WALL(), verts=8))
        add(cyl(0.85, 0.03, 2.4, (px, pyv, shaft_top + 3.2), VERDI(), verts=8))
# central tapered spire
spire_base = shaft_top
spire_h = 11.0
spire_top = spire_base + spire_h                             # 80
add(cyl(2.4, 0.06, spire_h, (wX, wY, spire_base + spire_h / 2), WHITE(), verts=18))
# second, smaller balcony ring higher up (at the spire foot)
add(tube(2.1, 0.9, (wX, wY, spire_base + 1.2), WHITE(), verts=16))
for a in range(6):
    ang = math.radians(30 + 60 * a)
    add(box(0.34, 0.34, 0.5, (wX + 2.0 * math.cos(ang), wY + 2.0 * math.sin(ang),
                              spire_base + 1.95), WHITE(), rot=(0, 0, ang)))
# thin CREAM rings banding the spire (radius follows the taper)
for hh in (3.0, 6.0, 9.0):
    sr = 2.4 * (1 - hh / spire_h)
    add(tube(sr + 0.12, 0.28, (wX, wY, spire_base + hh), CREAM(), verts=14))

# =====================================================================
# banner flags — spire (+ pennant chain), hall gable, tower balcony
# =====================================================================
def flag(fx, fy, fz_base, pole_h, bw, bh):
    add(tube(0.08, pole_h, (fx, fy, fz_base + pole_h / 2), WHITE(), verts=6))
    add(box(bw, 0.08, bh, (fx + bw / 2 + 0.05, fy, fz_base + pole_h - bh / 2 - 0.3), BANNER()))

flag(wX, wY, spire_top - 0.3, 4.5, 2.2, 1.3)                 # atop the spire
# tiny BANNER pennant chain — 2 small banners strung below the top flag
for pz, pb in ((spire_top + 2.6, 0.7), (spire_top + 1.4, 0.55)):
    add(box(pb, 0.06, 0.45, (wX + 0.35, wY, pz), BANNER()))
flag(0, yFe, rz, 3.0, 1.6, 1.0)                              # hall front gable
flag(wX, wY + 3.0, shaft_top, 3.2, 1.4, 0.9)                 # tower balcony (back)

# =====================================================================
# court furnishings — benches, sundial, lamp posts
# =====================================================================
# 2 stone benches (thin WHITE boxes) flanking the path, facing the lawns
for sx in (-1, 1):
    add(box(2.0, 0.5, 0.18, (sx * 1.9, lawn_y, zb + 0.55), WHITE()))     # seat
    add(box(2.0, 0.18, 0.6, (sx * 1.9, lawn_y + sx * 0.28, zb + 0.75), WHITE()))  # back
    for lx in (-0.85, 0.85):
        add(box(0.16, 0.4, 0.5, (sx * 1.9 + lx, lawn_y, zb + 0.3), WHITE()))      # legs
# small sundial on the +X side of the court (drum plinth + gnomon wedge)
sdX, sdY = 9.5, 8.0
add(tube(0.7, 1.0, (sdX, sdY, zb + 0.5), WHITE(), verts=14))            # drum
add(tube(0.75, 0.15, (sdX, sdY, zb + 1.0), CREAM(), verts=14))         # dial plate
add(box(0.12, 0.9, 0.9, (sdX, sdY, zb + 1.4), DARK(), rot=(math.radians(38), 0, 0)))  # gnomon
# 4 lamp posts along the processional path (WOOD pole + CREAM ico lamp)
for lx, ly in ((-2.4, 3.0), (2.4, 3.0), (-2.4, 11.2), (2.4, 11.2)):
    add(tube(0.11, 3.2, (lx, ly, zb + 1.6), WOOD(), verts=6))
    add(ico(0.32, (lx, ly, zb + 3.4), CREAM(), sub=0))

# =====================================================================
# guard figures — 4 tiny sentries (box body + ico head + thin spear)
# =====================================================================
def guard(gx, gy, face):                                      # face: +1 spear on +X
    add(box(0.36, 0.34, 0.62, (gx, gy, zb + 0.31), WHITE()))  # body
    add(ico(0.17, (gx, gy, zb + 0.74), WHITE(), sub=0))       # head
    add(tube(0.05, 1.5, (gx + face * 0.28, gy, zb + 0.75), DARK(), verts=5))  # spear
    add(ico(0.09, (gx + face * 0.28, gy, zb + 1.5), CREAM(), sub=0))          # spear tip
guard(-3.1, 2.6, -1); guard(3.1, 2.6, 1)                      # court entrance
guard(-2.1, 12.5, -1); guard(2.1, 12.5, 1)                    # near the hall/tower

# =====================================================================
# statues — kings of old flanking the court, slightly varied heights
# =====================================================================
for gx, gyk, th in ((-8.5, 5.0, 3.4), (8.5, 5.0, 3.6),
                    (-9.0, 10.5, 3.2), (9.0, 10.5, 3.5)):
    add(box(1.5, 1.5, 0.8, (gx, gyk, zb + 0.4), WHITE()))     # plinth
    add(box(1.0, 0.9, th, (gx, gyk, zb + 0.8 + th / 2), WHITE()))  # torso
    add(ico(0.55, (gx, gyk, zb + 0.8 + th + 0.4), WHITE(), sub=0)) # head

# =====================================================================
# rear service annex (kitchens) — L-shaped block on the +Y rim + chimney
# =====================================================================
anz = zb + 1.6
add(box(3.4, 2.2, 3.2, (2.0, 25.8, anz), CREAM()))            # long wing
add(box(2.0, 2.6, 2.8, (3.6, 24.2, anz - 0.2), CREAM()))      # short wing (L)
add(box(3.8, 2.6, 0.4, (2.0, 25.8, zb + 3.3), ROOF()))        # lean roof slab
add(box(2.4, 3.0, 0.4, (3.6, 24.2, zb + 2.9), ROOF()))
add(box(0.5, 0.5, 1.8, (0.9, 26.4, zb + 4.0), CREAM()))       # chimney
add(box(0.62, 0.62, 0.22, (0.9, 26.4, zb + 4.9), WHITE()))    # chimney cap
add(ico(0.14, (0.9, 26.4, zb + 5.1), DARK(), sub=0))          # flue mouth

# =====================================================================
# perimeter — low inner parapet ring (open at the front) + 2 beacon braziers
# =====================================================================
pr = 13.7
for a in range(24):
    ang = math.radians(15 * a)
    if math.sin(ang) < -0.5:                                  # ~120deg gap at the front
        continue
    add(box(3.9, 0.5, 1.0, (pr * math.cos(ang), cy + pr * math.sin(ang), zb + 0.5),
            WHITE(), rot=(0, 0, ang + math.radians(90))))
for bx in (-5.0, 5.0):
    add(tube(0.35, 1.8, (bx, 0.5, zb + 0.9), WOOD(), verts=8))
    add(ico(0.55, (bx, 0.5, zb + 2.05), CREAM(), sub=0))
