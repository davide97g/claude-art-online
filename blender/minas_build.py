# The White City — Minas Tirith-inspired hero piece, Floor 13 landmark.
# v2 architecture: this file owns palette + helpers + tier math + join/render;
# each visual chunk lives in blender/minas_parts/*.py and is exec'd inline in
# this namespace (so parts use the helpers directly, no imports).
#
# PART CONTRACT (for anyone editing minas_parts/*.py):
#   - top-level statements only; every created object goes through add(...)
#   - use ONLY these helpers: mat/cyl/tube/box/ico/poly/add + rng + constants
#     (tiers, RADII, TIER_H, WALL_H, WALL_T, NT). bpy/mathutils/math available.
#   - no bpy.ops besides what helpers wrap; no join, no render, no scene setup
#   - flat colors only, names CAO_*; reuse palette below before minting new
#   - city faces -Y (front gate at -Y); mountain behind at +Y; ground z=0
#
# MODE = 'preview' -> build at origin, render 3/4 + front PNG to blender/
# Run: python3 blender/blender_client.py exec blender/minas_build.py
import os, math, random

MODE = globals().get('MODE', 'preview')
REPO = "/Users/davideghiotto/Desktop/projects/claude-art-online"
PARTS_DIR = os.path.join(REPO, "blender", "minas_parts")
rng = random.Random(78)

# ---- fresh scene ----
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for me in list(bpy.data.meshes):
    if me.users == 0: bpy.data.meshes.remove(me)

# ---- flat named materials (reuse-by-name, boss_build idiom) ----
_mats = {}
def mat(name, rgb):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = 1.0
    if "Metallic" in b.inputs: b.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0.1
    _mats[name] = m; return m

# palette — warm white city against grey rock, verdigris + slate accents
WHITE  = lambda: mat("CAO_WhiteStone", (0.84, 0.83, 0.80))   # warm structural stone
WALL   = lambda: mat("CAO_WhiteWall",  (0.93, 0.92, 0.88))   # bright rampart white
CREAM  = lambda: mat("CAO_CreamWall",  (0.88, 0.84, 0.74))   # house variation
ROCK   = lambda: mat("CAO_GreyRock",   (0.36, 0.35, 0.38))   # prow / mountain
ROCK2  = lambda: mat("CAO_GreyRock2",  (0.45, 0.43, 0.43))   # lighter rock facets
SNOW   = lambda: mat("CAO_SnowCap",    (0.95, 0.96, 0.98))
ROOF   = lambda: mat("CAO_SlateRoof",  (0.32, 0.35, 0.44))   # blue-grey slate
VERDI  = lambda: mat("CAO_Verdigris",  (0.42, 0.63, 0.55))   # oxidized copper domes
WOOD   = lambda: mat("CAO_GateWood",   (0.38, 0.27, 0.17))   # gates/doors
DARK   = lambda: mat("CAO_GateDark",   (0.10, 0.10, 0.12))   # window/arch shadow
GREEN  = lambda: mat("CAO_CourtGreen", (0.47, 0.64, 0.35))   # lawns
GRASS  = lambda: mat("CAO_FieldGrass", (0.55, 0.66, 0.38))   # pelennor fields
BANNER = lambda: mat("CAO_BannerBlue", (0.22, 0.32, 0.55))   # gondor banners
TREE   = lambda: mat("CAO_WhiteTree",  (0.97, 0.97, 0.94))   # the white tree

def _fin(o, m):
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = False
    return o

def cyl(r1, r2, h, loc, m, verts=28, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, location=loc, rotation=rot)
    return _fin(bpy.context.object, m)

def tube(r, h, loc, m, verts=28, rot=(0,0,0)):
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

def poly(vlist, flist, m, loc=(0, 0, 0)):
    """Custom flat-shaded mesh from vertex/face lists (for wedges, gables...)."""
    me = bpy.data.meshes.new("p"); me.from_pydata(vlist, [], flist); me.update()
    o = bpy.data.objects.new("p", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return _fin(o, m)

parts = []
def add(o): parts.append(o); return o

# =====================================================================
# tier math — shared by every part
# =====================================================================
RADII  = [55, 45, 37, 30, 24, 19, 15]
TIER_H = 8.0
WALL_H, WALL_T = 5.5, 1.2
NT = len(RADII)

tiers = []   # (r, ycenter, zfloor)
for i, r in enumerate(RADII):
    t = i / (NT - 1)
    tiers.append((r, 14.0 * t, i * TIER_H))

# =====================================================================
# parts (each file exec'd in this namespace)
# =====================================================================
# ground.py is preview-only dressing (the game supplies its own terrain/fields)
_active = ("tiers.py", "prow.py", "buildings.py", "citadel.py", "mountain.py")
if MODE == 'preview':
    _active = ("ground.py",) + _active
for _part in _active:
    _path = os.path.join(PARTS_DIR, _part)
    if os.path.exists(_path):
        exec(compile(open(_path).read(), _path, 'exec'))

# ---- join into one landmark mesh ----
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
city = bpy.context.object
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
city.name = "MinasCity"; city.data.name = "MinasCity"

# =====================================================================
# preview render
# =====================================================================
if MODE == 'preview':
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE'
    scn.view_settings.view_transform = 'Standard'    # AgX desaturates the flat palette
    scn.render.resolution_x, scn.render.resolution_y = 1100, 850
    scn.world = scn.world or bpy.data.worlds.new("W")
    scn.world.use_nodes = True
    bg = scn.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.55, 0.65, 0.78, 1)
        bg.inputs[1].default_value = 0.35            # keep ambient from washing out the palette

    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", 'SUN'))
    sun.data.energy = 5.5
    sun.rotation_euler = (math.radians(55), 0, math.radians(-35))
    scn.collection.objects.link(sun)
    fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", 'SUN'))
    fill.data.energy = 1.2
    fill.rotation_euler = (math.radians(70), 0, math.radians(140))
    scn.collection.objects.link(fill)

    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scn.collection.objects.link(cam)
    scn.camera = cam

    def shoot(loc, look, path):
        cam.location = loc
        d = mathutils.Vector(look) - mathutils.Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = path
        bpy.ops.render.render(write_still=True)

    shoot((-200, -230, 130), (0, 20, 45), os.path.join(REPO, "blender", "minas_34.png"))
    shoot((0, -300, 70),  (0, 20, 48), os.path.join(REPO, "blender", "minas_front.png"))
    shoot((-38, -42, 105), (0, 16, 52), os.path.join(REPO, "blender", "minas_citadel.png"))
    result = {"built": True, "verts": len(city.data.vertices)}

elif MODE == 'export':
    bpy.ops.object.select_all(action='DESELECT')
    city.select_set(True)
    bpy.context.view_layer.objects.active = city
    path = os.path.join(REPO, "public", "assets", "models", "minas_city.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True)
    result = {"glb": path, "bytes": os.path.getsize(path), "verts": len(city.data.vertices)}
