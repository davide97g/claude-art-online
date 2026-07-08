# Pelennor fields around the city — see PART CONTRACT in minas_build.py
# Preview-only dressing (the game supplies its own terrainHeight): a big grass
# disk, a winding stone causeway from the field edge up to the front gate, a
# quilt of farm patches, and a few outlying farmhouses along the road.
# Everything is thin and stacked at slightly different z so nothing z-fights.

# ---- grass disk (top at z=0, nudged -Y so it reaches toward the viewer) ----
add(tube(170, 1.0, (0, -20, -0.5), GRASS(), verts=44))

# ---- winding stone causeway: field edge (y=-150) -> front gate (0,-57) ----
_road = [(18, -150), (9, -128), (15, -106), (2, -84), (7, -66), (0, -57)]
for i in range(len(_road) - 1):
    (x0, y0), (x1, y1) = _road[i], _road[i + 1]
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    seg = math.hypot(x1 - x0, y1 - y0)
    yaw = math.atan2(y1 - y0, x1 - x0)
    z = 0.15 + i * 0.05                                   # stagger to avoid z-fight
    add(box(seg + 2.0, 9.0, 0.6, (mx, my, z),
            (WHITE if i % 2 == 0 else ROCK2)(), rot=(0, 0, yaw)))

# ---- farmland quilt: thin tinted patches, all well clear of the city ----
for i in range(8):
    for _ in range(24):                                   # rejection-sample clear ground
        ang = rng.uniform(0, 2 * math.pi)
        dist = rng.uniform(78, 150)
        px, py = math.cos(ang) * dist, math.sin(ang) * dist - 20
        clear_city = math.hypot(px, py) > 74               # spec: dist from origin > 70
        off_road = not (abs(px) < 14 and py < -55)         # keep the causeway open
        in_plains = py < 40                                # not buried in the rear massif
        if clear_city and off_road and in_plains:
            break
    z = 0.25 + i * 0.05
    add(box(rng.uniform(12, 20), rng.uniform(14, 24), 0.3,
            (px, py, z), (GREEN if i % 2 == 0 else CREAM)(),
            rot=(0, 0, rng.uniform(0, math.pi))))

# ---- tiny outlying farmhouses along the causeway (dist from origin > 70) ----
def farmhouse(x, y, yaw):
    bw, bd, bh = rng.uniform(4, 6), rng.uniform(4, 6), rng.uniform(3.5, 5)
    add(box(bw, bd, bh, (x, y, bh / 2 + 0.1), CREAM(), rot=(0, 0, yaw)))
    add(box(bw * 1.28, bd * 1.28, 0.8, (x, y, bh + 0.5), ROOF(), rot=(0, 0, yaw)))

farmhouse(34, -118, 0.4)
farmhouse(-22, -104, -0.5)
farmhouse(28, -142, 0.2)
farmhouse(-30, -133, 0.9)
