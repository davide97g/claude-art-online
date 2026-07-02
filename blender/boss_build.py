# Rendfang the Kobold Lord — Floor-1 boss hero piece for Claude Art Online.
# Illfang-inspired original: hulking red kobold, kangaroo build, dog muzzle,
# tall ears, thick tail, bone axe + buckler, nodachi sheathed on the back.
#
# Unlike npc_build.py this does NOT join everything: animatable parts stay
# separate named nodes under an empty BossRoot (golem.glb pattern) so
# src/combat/boss.js can pose them by name. Names + materials are load-bearing:
#   nodes: Body, Head, EyeL, EyeR, ArmL, ArmR, LegL, LegR, Tail,
#          WeaponAxe (child of ArmR), Buckler (child of ArmL),
#          WeaponNodachi (child of ArmR, code hides until phase 2),
#          NodachiBack (child of Body)
#   mats:  CAO_BossHide, CAO_BossEye (emissive), CAO_BossBone,
#          CAO_BossLeather, CAO_BossSteel
# True world scale (golem is used unscaled): ~3.3 units tall, ears to ~3.8.
# Feet at z=0, centered on x/y; faces Blender -Y (glTF exporter -> +Z, the
# game's yaw-0 forward). Flat-shaded, flat mats, no textures (VISION.md).
#
# MODE = 'preview' -> build at origin, render 3/4 + front PNGs to blender/
# MODE = 'export'  -> build + export GLB to public/assets/models/boss_kobold.glb
import os, math, mathutils

MODE = globals().get('MODE', 'preview')
REPO = "/Users/davideghiotto/Desktop/projects/claude-art-online"

# ---- named flat materials ----
# reuse-by-name: re-runs must NOT mint "CAO_BossEye.001" — the game matches
# material names exactly, a suffix silently kills the eye telegraph.
def _named_mat(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    return m

_mats = {}
def mat(name, rgb):
    if name in _mats: return _mats[name]
    m = _named_mat(name)
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = 1.0
    if "Metallic" in b.inputs: b.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0.1
    _mats[name] = m; return m

def emissive_mat(name, rgb, strength=2.0):
    if name in _mats: return _mats[name]
    m = _named_mat(name)
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (0.02, 0.01, 0.01, 1)
    b.inputs["Roughness"].default_value = 1.0
    for key in ("Emission Color", "Emission"):        # name differs across versions
        if key in b.inputs: b.inputs[key].default_value = (*rgb, 1); break
    if "Emission Strength" in b.inputs: b.inputs["Emission Strength"].default_value = strength
    _mats[name] = m; return m

HIDE    = lambda: mat("CAO_BossHide", (0.55, 0.16, 0.13))
EYE     = lambda: emissive_mat("CAO_BossEye", (1.0, 0.35, 0.1))
BONE    = lambda: mat("CAO_BossBone", (0.85, 0.80, 0.68))
LEATHER = lambda: mat("CAO_BossLeather", (0.28, 0.19, 0.12))
STEEL   = lambda: mat("CAO_BossSteel", (0.75, 0.78, 0.82))

# ---- primitive helpers (npc_build idiom, plus material arg) ----
def _fin(o, m):
    o.data.materials.append(m); return o

def cyl(r1, r2, h, loc, m, verts=10, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, location=loc, rotation=rot)
    return _fin(bpy.context.object, m)

def tube(r, h, loc, m, verts=10, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    return _fin(bpy.context.object, m)

def box(sx, sy, sz, loc, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = (sx, sy, sz)
    return _fin(o, m)

def ico(r, loc, m, sub=1, scale=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.object
    if scale: o.scale = scale
    return _fin(o, m)

def part(name, objs, pivot=None):
    """Join objs into one flat-shaded mesh named `name`, origin at `pivot`."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.name = name; o.data.name = name
    for p in o.data.polygons: p.use_smooth = False
    bpy.context.scene.cursor.location = pivot if pivot else (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.select_all(action='DESELECT')
    return o

def parent_keep(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()

def build_boss():
    root = bpy.data.objects.new("BossRoot", None)
    bpy.context.scene.collection.objects.link(root)

    # ---- Body: forward-leaning bulk + kangaroo haunches + belly plate ----
    body = part("Body", [
        cyl(0.66, 0.46, 1.35, (0, 0.02, 1.85), HIDE(), verts=12),        # torso, belly-heavy
        ico(0.44, (0.5, 0.12, 1.15), HIDE(), scale=(1, 1.15, 0.9)),      # haunch R
        ico(0.44, (-0.5, 0.12, 1.15), HIDE(), scale=(1, 1.15, 0.9)),
        ico(0.5, (0, 0.05, 2.45), HIDE(), scale=(1.25, 0.9, 0.7)),       # shoulder mass
        box(0.26, 0.05, 0.26, (0, -0.52, 1.75), BONE(), rot=(0, math.radians(45), 0)),  # belly diamonds
        box(0.2, 0.05, 0.2, (0, -0.56, 1.38), BONE(), rot=(0, math.radians(45), 0)),
    ], pivot=(0, 0, 1.2))
    parent_keep(body, root)

    # ---- Head: skull + muzzle + jaw + tall splayed ears; pivot at the neck ----
    head = part("Head", [
        box(0.46, 0.44, 0.4, (0, 0, 2.95), HIDE()),
        box(0.24, 0.34, 0.2, (0, -0.36, 2.86), HIDE()),                  # muzzle
        box(0.2, 0.26, 0.08, (0, -0.34, 2.73), HIDE()),                  # jaw
        cyl(0.13, 0.015, 0.8, (0.2, 0.06, 3.5), HIDE(), verts=8, rot=(math.radians(-12), math.radians(18), 0)),
        cyl(0.13, 0.015, 0.8, (-0.2, 0.06, 3.5), HIDE(), verts=8, rot=(math.radians(-12), math.radians(-18), 0)),
    ], pivot=(0, 0, 2.7))
    parent_keep(head, root)
    eyeL = part("EyeL", [ico(0.085, (0.15, -0.27, 2.98), EYE(), sub=1)])
    eyeR = part("EyeR", [ico(0.085, (-0.15, -0.27, 2.98), EYE(), sub=1)])
    parent_keep(eyeL, head); parent_keep(eyeR, head)

    # ---- Legs: thick digitigrade + big feet (toes at -Y) ----
    for sx, nm in ((1, "LegL"), (-1, "LegR")):
        leg = part(nm, [
            tube(0.2, 1.0, (sx * 0.46, 0.08, 0.62), HIDE(), verts=10, rot=(math.radians(8), 0, 0)),
            box(0.26, 0.52, 0.18, (sx * 0.46, -0.1, 0.09), HIDE()),
        ], pivot=(sx * 0.46, 0.08, 1.1))
        parent_keep(leg, root)

    # ---- Arms: pivot at the shoulder so rotation.x raises them naturally ----
    for sx, nm in ((1, "ArmL"), (-1, "ArmR")):
        arm = part(nm, [
            tube(0.17, 0.95, (sx * 0.78, -0.02, 1.95), HIDE(), verts=10, rot=(0, sx * math.radians(6), 0)),
            box(0.2, 0.24, 0.2, (sx * 0.84, -0.06, 1.42), HIDE()),       # paw
        ], pivot=(sx * 0.75, -0.02, 2.42))
        parent_keep(arm, root)
    armL = bpy.data.objects["ArmL"]; armR = bpy.data.objects["ArmR"]

    # ---- Tail: thick, angled down-back; pivot at the base ----
    tail = part("Tail", [
        cyl(0.3, 0.05, 1.7, (0, 1.05, 0.85), HIDE(), verts=9, rot=(math.radians(115), 0, 0)),
    ], pivot=(0, 0.45, 1.15))
    parent_keep(tail, root)

    # ---- Phase-1 weapons: bone axe (ArmR paw) + leather buckler (ArmL forearm) ----
    axe = part("WeaponAxe", [
        tube(0.06, 1.25, (-0.84, -0.06, 1.85), BONE(), verts=8),
        box(0.1, 0.55, 0.6, (-0.84, -0.36, 2.25), BONE()),               # big blade wedge
        box(0.1, 0.18, 0.26, (-0.84, 0.14, 2.25), BONE()),               # back spike
    ], pivot=(-0.84, -0.06, 1.42))
    parent_keep(axe, armR)
    buckler = part("Buckler", [
        tube(0.4, 0.08, (0.98, -0.02, 1.75), LEATHER(), verts=12, rot=(0, math.radians(90), 0)),
        ico(0.09, (1.05, -0.02, 1.75), BONE()),                          # boss
    ], pivot=(0.9, -0.02, 1.75))
    parent_keep(buckler, armL)

    # ---- Phase-2 nodachi: in-paw (code hides until the switch) + back sheath ----
    nodachi = part("WeaponNodachi", [
        box(0.03, 0.12, 2.1, (-0.84, -0.06, 2.6), STEEL()),              # long blade
        box(0.06, 0.06, 0.44, (-0.84, -0.06, 1.32), STEEL()),            # grip
        box(0.14, 0.2, 0.05, (-0.84, -0.06, 1.56), STEEL()),             # guard
    ], pivot=(-0.84, -0.06, 1.42))
    parent_keep(nodachi, armR)
    sheath = part("NodachiBack", [
        box(0.08, 0.07, 2.3, (0, 0.62, 2.2), LEATHER(), rot=(0, math.radians(38), 0)),
        box(0.06, 0.06, 0.4, (-0.75, 0.62, 3.15), LEATHER(), rot=(0, math.radians(38), 0)),  # protruding grip
    ], pivot=(0, 0.62, 2.2))
    parent_keep(sheath, root)

    return root

# ---- scene helpers (npc_build idiom) ----
def wipe():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    bpy.data.orphans_purge(do_recursive=True)  # stale mats would suffix-rename on rebuild

def add_cam_sun(height, dist, look_z, angle_deg):
    a = math.radians(angle_deg)
    cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (math.sin(a) * dist, -math.cos(a) * dist, height)
    d = mathutils.Vector((0, 0, look_z)) - mathutils.Vector(cam.location)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    if "Sun" not in bpy.data.objects:
        s = bpy.data.lights.new("Sun", 'SUN'); s.energy = 3.2
        so = bpy.data.objects.new("Sun", s); bpy.context.scene.collection.objects.link(so)
        so.rotation_euler = (math.radians(52), 0, math.radians(40))
    w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.28, 0.30, 0.33, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.6

def render(path, rx, ry):
    sc = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    for want in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
        if want in engines: sc.render.engine = want; break
    sc.render.resolution_x = rx; sc.render.resolution_y = ry
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

if MODE == 'preview':
    wipe()
    root = build_boss()
    out34 = os.path.join(REPO, "blender", "boss_preview.png")
    outF = os.path.join(REPO, "blender", "boss_front.png")
    add_cam_sun(height=2.6, dist=7.2, look_z=1.9, angle_deg=35)
    render(out34, 1100, 900)
    add_cam_sun(height=2.2, dist=7.2, look_z=1.9, angle_deg=0)
    render(outF, 1100, 900)
    names = sorted(o.name for o in bpy.data.objects if o.parent or o.name == 'BossRoot')
    h = max((o.matrix_world.translation.z + o.dimensions.z / 2) for o in bpy.data.objects if o.type == 'MESH')
    result = {"nodes": names, "approx_top_z": round(h, 2), "previews": [out34, outF]}

elif MODE == 'export':
    wipe()
    root = build_boss()
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in root.children_recursive: o.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(REPO, "public", "assets", "models", "boss_kobold.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True)
    result = {"glb": path, "bytes": os.path.getsize(path)}
