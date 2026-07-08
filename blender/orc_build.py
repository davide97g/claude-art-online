# Orc build — run stages in order via: python3 blender/blender_client.py exec <stage-file>
# VARIANT = "A" (grey brute -> orc.glb) or "B" (warpainted Lurtz -> orc2.glb):
# flip the VARIANT line in each stage, rerun all three stages.
# Rig contract (used by src/combat/orc.ts): BodyPivot, HeadPivot, ArmL, ArmR, LegL, LegR.
# ============ STAGE 1: head sculpt ============
import bpy, math, bmesh
VARIANT = "A"
CFG = {
    # A: grey/mottled (first ref) - B: Lurtz, red-brown skin + white warpaint, yellow eyes
    "A": dict(skin=(0.34, 0.29, 0.28), bruise=(0.30, 0.24, 0.30), eye=(0.55, 0.28, 0.06), paint=False),
    "B": dict(skin=(0.30, 0.13, 0.09), bruise=(0.16, 0.06, 0.06), eye=(0.52, 0.46, 0.14), paint=True),
}[VARIANT]

import numpy as np

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/b3e5cfa5-42f9-4fa5-a495-7483359f0139/scratchpad"

old = bpy.data.scenes.get("OrcBuild")
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("OrcBuild")
bpy.context.window.scene = sc

def link(o):
    sc.collection.objects.link(o)
    return o

def node_mat(name, rgb, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m

# ---------- script-sculpt engine ----------
# gaussian push: verts near `center` (anisotropic radius `rad` per axis)
# move by `offset`. neg offsets carve. Everything stays one smooth surface.
def sculpt(V, center, rad, offset, falloff=2.2):
    c = np.array(center); r = np.array(rad); o = np.array(offset)
    d2 = (((V - c) / r) ** 2).sum(axis=1)
    w = np.exp(-d2 * falloff)
    w[w < 0.01] = 0
    return V + np.outer(w, o)

def skin_vcol_mat():
    m = bpy.data.materials.new("OrcSkin")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.62
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], b.inputs["Base Color"])
    return m

# base egg (head facing -Y, +Z up), centered at origin
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=72, radius=1.0)
me = bpy.data.meshes.new("Head")
bm.to_mesh(me); bm.free()
n = len(me.vertices)
V = np.empty(n * 3)
me.vertices.foreach_get("co", V)
V = V.reshape(-1, 3)
V *= np.array([0.285, 0.295, 0.315])   # egg: wide, deep, shorter face

OPS = [
    # cranium: fill the back, slight peak at top-back, flatten forehead slope
    ((0, 0.16, 0.08),  (0.30, 0.25, 0.28), (0, 0.055, 0.02)),
    ((0, 0.10, 0.28),  (0.22, 0.22, 0.15), (0, 0.02, 0.035)),
    # brow ridge: heavy bar, hard overhang
    ((0, -0.27, 0.05), (0.21, 0.10, 0.062), (0, -0.13, 0.015)),
    ((-0.10, -0.29, 0.045), (0.09, 0.07, 0.05), (0, -0.05, 0.01)),
    (( 0.10, -0.29, 0.045), (0.09, 0.07, 0.05), (0, -0.05, 0.01)),
    # deep eye sockets carved back under it
    ((-0.105, -0.30, -0.02), (0.075, 0.10, 0.058), (0, 0.10, -0.012)),
    (( 0.105, -0.30, -0.02), (0.075, 0.10, 0.058), (0, 0.10, -0.012)),
    # upper lids drooping over the eyes (sinister half-closed look)
    ((-0.105, -0.315, 0.025), (0.075, 0.05, 0.030), (0, -0.02, -0.022)),
    (( 0.105, -0.315, 0.025), (0.075, 0.05, 0.030), (0, -0.02, -0.022)),
    # cheekbones out + forward
    ((-0.20, -0.17, -0.07), (0.10, 0.11, 0.10), (-0.06, -0.035, 0)),
    (( 0.20, -0.17, -0.07), (0.10, 0.11, 0.10), ( 0.06, -0.035, 0)),
    # broad flat nose
    ((0, -0.32, -0.08), (0.07, 0.075, 0.09), (0, -0.10, -0.02)),
    ((-0.05, -0.315, -0.11), (0.045, 0.05, 0.045), (-0.035, -0.02, 0)),
    (( 0.05, -0.315, -0.11), (0.045, 0.05, 0.045), ( 0.035, -0.02, 0)),
    # philtrum/upper-lip mass
    ((0, -0.31, -0.165), (0.10, 0.06, 0.05), (0, -0.05, 0)),
    # mouth: wide snarl slit carved deep
    ((0, -0.345, -0.205), (0.135, 0.08, 0.042), (0, 0.13, 0)),
    # lower lip + chin, short and massive
    ((0, -0.27, -0.27), (0.13, 0.08, 0.05), (0, -0.04, -0.015)),
    # jaw corners flare wide
    ((-0.17, -0.10, -0.22), (0.11, 0.13, 0.11), (-0.07, -0.015, -0.02)),
    (( 0.17, -0.10, -0.22), (0.11, 0.13, 0.11), ( 0.07, -0.015, -0.02)),
    # temple hollows
    ((-0.24, -0.10, 0.10), (0.08, 0.11, 0.10), (0.02, 0.008, 0)),
    (( 0.24, -0.10, 0.10), (0.08, 0.11, 0.10), (-0.02, 0.008, 0)),
    # jowls
    ((-0.14, -0.21, -0.19), (0.07, 0.07, 0.07), (-0.02, -0.02, -0.02)),
    (( 0.14, -0.21, -0.19), (0.07, 0.07, 0.07), ( 0.02, -0.02, -0.02)),
    # low flat crown (orc skull, not egghead)
    ((0, 0.02, 0.32), (0.35, 0.35, 0.16), (0, 0, -0.075)),
    ((-0.26, 0.04, 0.14), (0.10, 0.20, 0.16), (0.028, 0, 0)),
    (( 0.26, 0.04, 0.14), (0.10, 0.20, 0.16), (-0.028, 0, 0)),
    # forehead furrows: three shallow horizontal creases
    ((0, -0.285, 0.135), (0.15, 0.05, 0.016), (0, 0.018, 0)),
    ((0, -0.27, 0.175), (0.14, 0.05, 0.016), (0, 0.016, 0)),
    ((0, -0.25, 0.215), (0.12, 0.05, 0.016), (0, 0.014, 0)),
    # frown lines between the brows
    ((-0.035, -0.335, 0.06), (0.014, 0.04, 0.045), (0, 0.02, 0)),
    (( 0.035, -0.335, 0.06), (0.014, 0.04, 0.045), (0, 0.02, 0)),
    # nasolabial folds nostril->mouth corner
    ((-0.095, -0.33, -0.155), (0.022, 0.05, 0.055), (0, 0.022, 0)),
    (( 0.095, -0.33, -0.155), (0.022, 0.05, 0.055), (0, 0.022, 0)),
    # mouth carve, second harder pass (guarantee the slit reads)
    ((0, -0.36, -0.20), (0.12, 0.06, 0.030), (0, 0.09, 0)),
    # snarl: upper lip pulled up at the corners
    ((-0.09, -0.345, -0.175), (0.045, 0.04, 0.028), (0, 0.015, 0.014)),
    (( 0.09, -0.345, -0.175), (0.045, 0.04, 0.028), (0, 0.015, 0.014)),
]
for c, r, o in OPS:
    V = sculpt(V, c, r, o)

# ---- sample real surface depth at the mouth so parts sit IN the slit ----
mzone = (np.abs(V[:, 0]) < 0.03) & (V[:, 2] > -0.225) & (V[:, 2] < -0.185)
mouthY = V[mzone, 1].min()  # front-most point of the mouth band

# final mouth slit carve, centered exactly on the surface
V = sculpt(V, (0, mouthY, -0.205), (0.125, 0.05, 0.036), (0, 0.075, 0))

# ---- craggy skin: multi-octave noise along normals ----
from mathutils import noise as _noise
me.vertices.foreach_set("co", V.ravel())
me.update()
N = np.empty(len(me.vertices) * 3)
me.vertices.foreach_get("normal", N)
N = N.reshape(-1, 3)
bump = np.array([
    _noise.noise(tuple(v * 16)) * 0.55
    + _noise.noise(tuple(v * 42)) * 0.30
    + _noise.noise(tuple(v * 90)) * 0.15
    for v in V
])
V = V + N * bump[:, None] * 0.0075

# ---- mottled skin vertex colors (ref: pale grey, dark blotches, bruised shadows) ----
base = np.array(CFG['skin'])
dark = np.array([0.10, 0.08, 0.10])
bruise = np.array(CFG['bruise'])
blotch = np.array([(_noise.noise(tuple(v * 7)) + 1) / 2 for v in V])
fine = np.array([(_noise.noise(tuple(v * 28)) + 1) / 2 for v in V])
col = base[None, :] * (0.35 + 0.75 * blotch[:, None])
col = col * (1 - 0.65 * (fine[:, None] ** 2))
# bruise the eye sockets / temples / brow underside
for cx in (-0.105, 0.105):
    d = np.linalg.norm((V - np.array([cx, -0.30, -0.01])) / np.array([0.10, 0.12, 0.09]), axis=1)
    m = np.exp(-d ** 2 * 1.8)
    col = col * (1 - 0.5 * m[:, None]) + bruise[None, :] * 0.35 * m[:, None]
# darken inside the mouth slit and the creases
d = np.linalg.norm((V - np.array([0, mouthY + 0.02, -0.205])) / np.array([0.12, 0.05, 0.03]), axis=1)
m = np.exp(-d ** 2 * 2.5)
col = col * (1 - 0.85 * m[:, None])
if CFG['paint']:
    # white warpaint: forehead patch + streaks dragged down brow/nose/cheeks
    white = np.array([0.80, 0.76, 0.68])
    pm = np.zeros(len(V))
    d = np.linalg.norm((V - np.array([0, -0.24, 0.16])) / np.array([0.20, 0.14, 0.13]), axis=1)
    pm = np.maximum(pm, np.exp(-d ** 2 * 1.6))                      # forehead
    for cx in (-0.115, -0.045, 0.045, 0.115):
        d = np.linalg.norm((V - np.array([cx, -0.315, -0.07])) / np.array([0.020, 0.09, 0.17]), axis=1)
        pm = np.maximum(pm, 0.9 * np.exp(-d ** 2 * 1.8))            # face streaks
    edge = np.array([(_noise.noise(tuple(v * 22)) + 1) / 2 for v in V])
    pm = np.clip(pm * (0.65 + 0.7 * edge), 0, 1)                    # ragged hand-smeared edge
    col = col * (1 - pm[:, None]) + white[None, :] * pm[:, None]
col = np.clip(col, 0.02, 1.0)

ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
cols4 = np.concatenate([col, np.ones((len(col), 1))], axis=1)
ca.data.foreach_set("color", cols4.ravel())

me.vertices.foreach_set("co", V.ravel())
me.update()
for p in me.polygons:
    p.use_smooth = True
head = link(bpy.data.objects.new("Head", me))
head.data.materials.append(skin_vcol_mat())

# eyes, tucked into the sockets
eye_mat = node_mat("EyeTmp", CFG["eye"], 0.3)
for sx, nm in ((-0.105, "EyeL"), (0.105, "EyeR")):
    m = bpy.data.meshes.new(nm)
    b2 = bmesh.new()
    bmesh.ops.create_uvsphere(b2, u_segments=16, v_segments=12, radius=0.030)
    b2.to_mesh(m); b2.free()
    for p in m.polygons: p.use_smooth = True
    eo = link(bpy.data.objects.new(nm, m))
    eo.location = (sx, -0.258, -0.025)
    m.materials.append(eye_mat)



pup_mat = node_mat("PupilTmp", (0.01, 0.008, 0.005), 0.4)
for sx in (-0.105, 0.105):
    pm = bpy.data.meshes.new("Pupil")
    b7 = bmesh.new()
    bmesh.ops.create_uvsphere(b7, u_segments=12, v_segments=8, radius=0.011)
    b7.to_mesh(pm); b7.free()
    for p in pm.polygons: p.use_smooth = True
    po = link(bpy.data.objects.new("Pupil", pm))
    po.location = (sx, -0.258 - 0.0265, -0.028)
    pm.materials.append(pup_mat)

# dark mouth interior: squashed sphere tucked behind the lip slit
mi = bpy.data.meshes.new("MouthIn")
b4 = bmesh.new()
bmesh.ops.create_uvsphere(b4, u_segments=20, v_segments=10, radius=1.0)
b4.to_mesh(mi); b4.free()
for p in mi.polygons: p.use_smooth = True
mo = link(bpy.data.objects.new("MouthIn", mi))
mo.scale = (0.10, 0.05, 0.026)
mo.location = (0, float(mouthY) + 0.055, -0.203)
mi.materials.append(node_mat("MouthTmp", (0.02, 0.005, 0.005), 0.75))

# teeth: irregular yellowed row along the upper edge of the slit
tooth_mat = node_mat("TeethTmp", (0.62, 0.55, 0.34), 0.45)
import random as _r
_r.seed(7)
for i in range(8):
    t = (i - 3.5) / 3.5          # -1..1 across the mouth
    ang = t * 0.9
    tx = math.sin(ang) * 0.095
    ty = float(mouthY) + 0.042 - math.cos(ang) * 0.024
    tm = bpy.data.meshes.new(f"Tooth{i}")
    b5 = bmesh.new()
    bmesh.ops.create_cube(b5, size=1.0)
    b5.to_mesh(tm); b5.free()
    to = link(bpy.data.objects.new(f"Tooth{i}", tm))
    s = 0.011 + _r.random() * 0.005
    to.scale = (s, 0.010, 0.016 + _r.random() * 0.007)
    to.location = (tx, ty, -0.193 - _r.random() * 0.004)
    to.rotation_euler = (0, _r.uniform(-0.15, 0.15), ang)
    tm.materials.append(tooth_mat)

# ears: pointed flaps, swept back (mostly hidden by hair later)
for sx in (-1, 1):
    em = bpy.data.meshes.new("Ear")
    b6 = bmesh.new()
    bmesh.ops.create_uvsphere(b6, u_segments=16, v_segments=10, radius=1.0)
    b6.to_mesh(em); b6.free()
    ev = np.empty(len(em.vertices) * 3)
    em.vertices.foreach_get("co", ev)
    ev = ev.reshape(-1, 3) * np.array([0.018, 0.045, 0.07])
    # drag the top into a point
    w = np.clip(ev[:, 2] / 0.07, 0, 1) ** 2
    ev[:, 2] += w * 0.05
    ev[:, 1] += w * 0.03
    em.vertices.foreach_set("co", ev.ravel())
    em.update()
    for p in em.polygons: p.use_smooth = True
    eo2 = link(bpy.data.objects.new("Ear", em))
    eo2.location = (sx * 0.272, 0.015, -0.055)
    eo2.rotation_euler = (math.radians(-30), math.radians(sx * 22), 0)
    em.materials.append(node_mat("EarTmp", (0.30, 0.26, 0.25), 0.7))

# neck stub so the head doesn't float
b3 = bmesh.new()
bmesh.ops.create_cone(b3, cap_ends=True, segments=24, radius1=0.16, radius2=0.20, depth=0.35)
nm2 = bpy.data.meshes.new("Neck")
b3.to_mesh(nm2); b3.free()
for p in nm2.polygons: p.use_smooth = True
neck = link(bpy.data.objects.new("Neck", nm2))
neck.location = (0, 0.05, -0.40)
nm2.materials.append(node_mat("NeckTmp", (0.30, 0.26, 0.25), 0.7))

# camera + lights
tgt = link(bpy.data.objects.new("CamTarget", None)); tgt.location = (0, 0, -0.05)
cam_d = bpy.data.cameras.new("OrcCam"); cam_d.lens = 85
cam = link(bpy.data.objects.new("OrcCam", cam_d))
cam.location = (0.75, -2.15, 0.3)
cam.constraints.new('TRACK_TO').target = tgt
sc.camera = cam
for nm3, en, szl, loc in (("Key", 110, 2, (1.3, -1.5, 1.0)), ("Fill", 30, 3, (-1.6, -1.3, 0.2)), ("Rim", 90, 1, (-0.5, 1.5, 0.8))):
    L = link(bpy.data.objects.new(nm3, bpy.data.lights.new(nm3, 'AREA')))
    L.data.energy = en; L.data.size = szl; L.location = loc
    L.constraints.new('TRACK_TO').target = tgt
w = bpy.data.worlds.new("OrcWorld"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.04, 0.04, 0.045, 1)
sc.world = w

sc.render.engine = 'BLENDER_EEVEE'
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 768; sc.render.resolution_y = 900
sc.render.filepath = SCRATCH + "/orc_head.png"
bpy.ops.render.render(write_still=True)

# second angle: straight front
cam.location = (0.0, -2.25, 0.05)
sc.render.filepath = SCRATCH + "/orc_head_front.png"
bpy.ops.render.render(write_still=True)
result = {"verts": n}

# ============ STAGE 2: body / armor / hair ============
import bpy, math, bmesh, random
VARIANT = "A"
CFG = {
    "A": dict(skin=(0.24, 0.20, 0.20), leather=(0.050, 0.043, 0.043), strap=(0.055, 0.042, 0.032),
              hair=(0.32, 0.27, 0.19), hairN=90, hairBand=2.0, hairLen=(0.55, 0.85), hairZ=(0.02, 0.22)),
    # B: Lurtz - olive-brown leather, long dark mane over the crown
    "B": dict(skin=(0.26, 0.12, 0.09), leather=(0.088, 0.072, 0.050), strap=(0.070, 0.054, 0.036),
              hair=(0.11, 0.072, 0.045), hairN=160, hairBand=2.6, hairLen=(0.70, 1.05), hairZ=(0.02, 0.30)),
}[VARIANT]

import numpy as np
from mathutils import noise as mnoise, Vector, Euler

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/b3e5cfa5-42f9-4fa5-a495-7483359f0139/scratchpad"
sc = bpy.data.scenes["OrcBuild"]
bpy.context.window.scene = sc
random.seed(42)

def link(o):
    sc.collection.objects.link(o)
    return o

def node_mat(name, rgb, rough=0.7):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m

def vcol_mat(name, rough):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], b.inputs["Base Color"])
    return m

SKIN_M = vcol_mat("OrcSkinBody" + VARIANT, 0.62)
LEATHER_M = vcol_mat("OrcLeather" + VARIANT, 0.80)
STRAP_M = node_mat("OrcStrap" + VARIANT, CFG["strap"], 0.85)
HAIR_M = node_mat("OrcHair" + VARIANT, CFG["hair"], 0.9)

# noise vertex colors: `base` tinted darker in blotches -> worn leather / mottled skin
def add_vcol(me, base, contrast=0.6, scale=6.0, seed=0.0):
    n = len(me.vertices)
    V = np.empty(n * 3)
    me.vertices.foreach_get("co", V)
    V = V.reshape(-1, 3)
    t = np.array([(mnoise.noise((v[0]*scale+seed, v[1]*scale+seed, v[2]*scale)) + 1) / 2 for v in V])
    f = np.array([(mnoise.noise((v[0]*scale*4, v[1]*scale*4, v[2]*scale*4+seed)) + 1) / 2 for v in V])
    col = np.array(base)[None, :] * ((1 - contrast) + contrast * t[:, None])
    col *= (1 - 0.35 * (f[:, None] ** 2))
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set("color", np.concatenate([col, np.ones((n, 1))], axis=1).ravel())

def sculpt(V, center, rad, offset, falloff=2.2):
    c = np.array(center); r = np.array(rad); o = np.array(offset)
    d2 = (((V - c) / r) ** 2).sum(axis=1)
    w = np.exp(-d2 * falloff)
    w[w < 0.01] = 0
    return V + np.outer(w, o)

def new_sphere(name, useg=32, vseg=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=useg, v_segments=vseg, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    return me

def get_np(me):
    n = len(me.vertices)
    V = np.empty(n * 3)
    me.vertices.foreach_get("co", V)
    return V.reshape(-1, 3)

def set_np(me, V):
    me.vertices.foreach_set("co", V.ravel())
    me.update()

def bump(me, amp=0.01, scale=10.0):
    V = get_np(me)
    N = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", N)
    N = N.reshape(-1, 3)
    b = np.array([mnoise.noise(tuple(v * scale)) for v in V])
    set_np(me, V + N * b[:, None] * amp)

# drop old body parts if re-running
for o in list(sc.objects):
    if o.name.split('.')[0] in ("Torso", "Pauldron", "Plate", "Belt", "Tasset", "ArmL", "ArmR",
                                 "UpperArm", "Forearm", "Fist", "StrapRing", "Leg", "Boot", "Hair",
                                 "Collar", "Neck2", "Lace"):
        bpy.data.objects.remove(o, do_unlink=True)

# ---------------- torso ----------------
# hulking barrel: shoulders z-0.62, waist z-1.5, hunched (top leans -Y a touch)
tme = new_sphere("Torso", 48, 36)
V = get_np(tme)
V *= np.array([0.52, 0.34, 0.62])
V[:, 2] -= 0.0
# widen the shoulder line, narrow the waist
V = sculpt(V, (0, 0, 0.45), (0.7, 0.5, 0.35), (0, 0, 0.10))
V = sculpt(V, (-0.5, 0, 0.30), (0.25, 0.4, 0.35), (-0.10, 0, 0.05))
V = sculpt(V, (0.5, 0, 0.30), (0.25, 0.4, 0.35), (0.10, 0, 0.05))
V = sculpt(V, (0, 0, -0.55), (0.7, 0.5, 0.30), (0, 0, -0.05))
V[:, 0] *= (1 - 0.22 * np.clip((-V[:, 2] + 0.1) / 0.7, 0, 1))   # taper to waist
V[:, 1] += V[:, 2] * -0.18   # hunch: lean top forward
set_np(tme, V)
bump(tme, 0.008, 8)
add_vcol(tme, CFG['skin'], 0.6, 5.0, 3.3)   # skin peeks between plates
torso = link(bpy.data.objects.new("Torso", tme))
torso.location = (0, 0.06, -0.96)

# thick neck replacing the stub (skin)
old_neck = sc.objects.get("Neck")
if old_neck: bpy.data.objects.remove(old_neck, do_unlink=True)
nme = new_sphere("Neck2", 24, 16)
Vn = get_np(nme) * np.array([0.21, 0.25, 0.24])
set_np(nme, Vn)
bump(nme, 0.006, 10)
add_vcol(nme, CFG['skin'], 0.6, 6.0, 7.7)
neck = link(bpy.data.objects.new("Neck2", nme))
neck.location = (0, 0.05, -0.36)
neck.data.materials.append(SKIN_M)
tme.materials.append(SKIN_M)

# ---------------- armor plates ----------------
def shell(name, loc, scale, rot=(0, 0, 0), mat=LEATHER_M, seed=1.0, amp=0.012):
    me = new_sphere(name, 28, 20)
    Vv = get_np(me) * np.array(scale)
    set_np(me, Vv)
    bump(me, amp, 6)
    add_vcol(me, CFG['leather'], 0.65, 4.0, seed)
    me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    ob.rotation_euler = Euler((rot[0], rot[1], rot[2]))
    return ob

# chest plates: three overlapping horizontal bands, laced front
shell("Plate", (0, -0.04, -0.62), (0.54, 0.31, 0.26), (math.radians(-10), 0, 0), seed=1.1)
shell("Plate", (0, -0.01, -0.92), (0.50, 0.29, 0.24), (math.radians(-5), 0, 0), seed=2.2)
shell("Plate", (0, 0.03, -1.20), (0.46, 0.27, 0.22), (0, 0, 0), seed=3.3)
shell("Plate", (0, 0.05, -1.42), (0.42, 0.26, 0.18), (math.radians(4), 0, 0), seed=3.9)
# high back-collar rising behind the head (ref: big leather collar)
shell("Collar", (0, 0.26, -0.52), (0.34, 0.14, 0.26), (math.radians(15), 0, 0), seed=4.4)

# lacing down the sternum (ref: laced-up front)
lace_mat = node_mat("OrcLace" + VARIANT, (0.08, 0.06, 0.045), 0.9)
for k in range(5):
    for sgn in (-1, 1):
        cme = bpy.data.meshes.new("Lace")
        bmc = bmesh.new()
        bmesh.ops.create_cone(bmc, cap_ends=True, segments=8, radius1=0.012, radius2=0.012, depth=0.16)
        bmc.to_mesh(cme); bmc.free()
        for p in cme.polygons: p.use_smooth = True
        cme.materials.append(lace_mat)
        co2 = link(bpy.data.objects.new("Lace", cme))
        co2.location = (0, -0.375 - k * 0.008, -0.62 - k * 0.115)
        co2.rotation_euler = (math.radians(90), math.radians(sgn * 55), 0)

# pauldrons: stacked shells on each shoulder
for sx in (-1, 1):
    shell("Pauldron", (sx * 0.60, 0.02, -0.62), (0.20, 0.22, 0.13), (0, math.radians(sx * 18), math.radians(sx * -16)), seed=5.0 + sx)
    shell("Pauldron", (sx * 0.66, 0.02, -0.74), (0.17, 0.19, 0.11), (0, math.radians(sx * 22), math.radians(sx * -24)), seed=6.0 + sx)
# belt
belt = shell("Belt", (0, 0.05, -1.56), (0.40, 0.30, 0.10), mat=STRAP_M, seed=7.7, amp=0.006)
# tassets: leather strips hanging off the belt
for i in range(7):
    a = (i - 3) * 0.38
    tx = math.sin(a) * 0.34
    ty = 0.05 - math.cos(a) * 0.26
    tme2 = bpy.data.meshes.new("Tasset")
    bmt = bmesh.new()
    bmesh.ops.create_cube(bmt, size=1.0)
    bmt.to_mesh(tme2); bmt.free()
    tme2.materials.append(LEATHER_M)
    add_vcol(tme2, CFG['leather'], 0.6, 5.0, 8.0 + i)
    to = link(bpy.data.objects.new("Tasset", tme2))
    to.scale = (0.11, 0.03, 0.24)
    to.location = (tx, ty, -1.76)
    to.rotation_euler = (random.uniform(-0.06, 0.06), 0, a * 0.7)

# ---------------- arms (named pivots: game rotates these on X) ----------------
def build_arm(side):  # side -1 = left (+x is right in blender, but names per game view)
    sx = side
    pivot = link(bpy.data.objects.new("ArmL" if side < 0 else "ArmR", None))
    pivot.location = (sx * 0.58, 0.02, -0.66)   # shoulder
    up = new_sphere("UpperArm", 24, 16)
    Vu = get_np(up) * np.array([0.15, 0.16, 0.34])
    Vu = sculpt(Vu, (0, 0, 0.1), (0.2, 0.25, 0.2), (0, -0.02, 0))  # biceps
    set_np(up, Vu)
    bump(up, 0.007, 9)
    add_vcol(up, CFG['skin'], 0.6, 6.0, 9.0 + sx)
    up.materials.append(SKIN_M)
    uo = link(bpy.data.objects.new("UpperArm", up))
    uo.parent = pivot
    uo.location = (sx * 0.05, 0, -0.28)
    uo.rotation_euler = (0, math.radians(sx * 10), 0)
    fo_ = new_sphere("Forearm", 24, 16)
    Vf = get_np(fo_) * np.array([0.13, 0.14, 0.30])
    set_np(fo_, Vf)
    bump(fo_, 0.006, 9)
    add_vcol(fo_, CFG['leather'], 0.6, 5.0, 10.0 + sx)  # leather bracer
    fo_.materials.append(LEATHER_M)
    fro = link(bpy.data.objects.new("Forearm", fo_))
    fro.parent = pivot
    fro.location = (sx * 0.10, -0.06, -0.78)
    fro.rotation_euler = (math.radians(12), math.radians(sx * 6), 0)
    # strap rings on the forearm
    for k in range(3):
        rme = bpy.data.meshes.new("StrapRing")
        bmr = bmesh.new()
        bmesh.ops.create_cone(bmr, cap_ends=False, segments=16, radius1=0.145 - k*0.008, radius2=0.14 - k*0.008, depth=0.05)
        bmr.to_mesh(rme); bmr.free()
        for p in rme.polygons: p.use_smooth = True
        rme.materials.append(STRAP_M)
        ro = link(bpy.data.objects.new("StrapRing", rme))
        ro.parent = pivot
        ro.location = (sx * 0.10, -0.065 - k*0.01, -0.68 - k * 0.10)
        ro.rotation_euler = (math.radians(12), math.radians(sx * 6), 0)
    fi = new_sphere("Fist", 20, 14)
    Vfi = get_np(fi) * np.array([0.12, 0.14, 0.15])
    set_np(fi, Vfi)
    bump(fi, 0.008, 10)
    add_vcol(fi, (CFG['skin'][0]*0.95, CFG['skin'][1]*0.95, CFG['skin'][2]*0.95), 0.6, 7.0, 11.0 + sx)
    fi.materials.append(SKIN_M)
    fio = link(bpy.data.objects.new("Fist", fi))
    fio.parent = pivot
    fio.location = (sx * 0.12, -0.10, -1.06)
    return pivot

build_arm(-1)
build_arm(1)

# ---------------- legs + boots ----------------
for sx in (-1, 1):
    lme = new_sphere("Leg", 24, 18)
    Vl = get_np(lme) * np.array([0.21, 0.24, 0.55])
    Vl = sculpt(Vl, (0, 0, 0.35), (0.25, 0.3, 0.3), (0, 0, 0.05))  # thigh mass
    set_np(lme, Vl)
    bump(lme, 0.008, 7)
    add_vcol(lme, CFG['leather'], 0.55, 4.5, 12.0 + sx)  # dark trousers
    lme.materials.append(LEATHER_M)
    lo = link(bpy.data.objects.new("Leg", lme))
    lo.location = (sx * 0.24, 0.05, -2.15)
    bme = new_sphere("Boot", 20, 14)
    Vb = get_np(bme) * np.array([0.19, 0.30, 0.18])
    Vb = sculpt(Vb, (0, -0.2, 0), (0.2, 0.2, 0.2), (0, -0.05, 0))  # toe
    set_np(bme, Vb)
    bump(bme, 0.006, 8)
    add_vcol(bme, (CFG['leather'][0]*0.8, CFG['leather'][1]*0.8, CFG['leather'][2]*0.8), 0.6, 5.0, 13.0 + sx)
    bme.materials.append(LEATHER_M)
    bo = link(bpy.data.objects.new("Boot", bme))
    bo.location = (sx * 0.24, -0.02, -2.72)

# ---------------- hair: stringy strands, bald crown ----------------
hair_meshes = []
deps = bpy.context.evaluated_depsgraph_get()
for i in range(CFG['hairN']):
    # scalp band: sides + back only (front stays bald)
    ang = random.uniform(-CFG['hairBand'], CFG['hairBand'])  # radians around +Y (back); face stays clear
    zs = random.uniform(*CFG['hairZ'])
    rr = 0.325 - zs * 0.22
    px, py = math.sin(ang) * rr * 0.95, math.cos(ang) * rr
    cu = bpy.data.curves.new("HairC", 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = random.uniform(0.004, 0.007)
    cu.bevel_resolution = 2
    cu.resolution_u = 6
    sp = cu.splines.new('NURBS')
    sp.points.add(3)
    L = random.uniform(*CFG['hairLen'])
    ox, oy = math.sin(ang), math.cos(ang)
    sway = random.uniform(-0.08, 0.08)
    pts = [
        (px, py, zs, 1.0),
        (px + ox * 0.045, py + oy * 0.045 + 0.02, zs - L * 0.3, 0.85),
        (px + ox * 0.06 + sway, py + oy * 0.06 + 0.05, zs - L * 0.7, 0.5),
        (px + ox * 0.05 + sway * 2, py + oy * 0.09 + 0.09, zs - L, 0.12),
    ]
    for p_, pt in zip(sp.points, pts):
        p_.co = (pt[0], pt[1], pt[2], 1.0)
        p_.radius = pt[3]
    sp.use_endpoint_u = True
    co = bpy.data.objects.new("HairC", cu)
    sc.collection.objects.link(co)
    deps.update()
    hm = bpy.data.meshes.new_from_object(co.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(co, do_unlink=True)
    bpy.data.curves.remove(cu)
    for p in hm.polygons: p.use_smooth = True
    hm.materials.append(HAIR_M)
    ho = link(bpy.data.objects.new("Hair", hm))
    hair_meshes.append(ho)

# ---------------- render full body ----------------
tgt = sc.objects["CamTarget"]
tgt.location = (0, 0, -1.30)
cam = sc.objects["OrcCam"]
cam.location = (2.4, -7.0, -0.8)
sc.render.filepath = SCRATCH + "/orc_body.png"
bpy.ops.render.render(write_still=True)
cam.location = (0.5, -1.9, 0.15)
tgt.location = (0, 0, -0.15)
sc.render.filepath = SCRATCH + "/orc_bust.png"
bpy.ops.render.render(write_still=True)
result = {"objects": len(sc.objects)}

# ============ STAGE 3: rig pivots + export GLB ============
import bpy
from mathutils import Vector

VARIANT = "A"
OUT = "/Users/davideghiotto/Desktop/projects/claude-art-online/public/assets/models/" + ("orc.glb" if VARIANT == "A" else "orc2.glb")
sc = bpy.data.scenes["OrcBuild"]
bpy.context.window.scene = sc

SKIP = {"OrcCam", "Key", "Fill", "Rim", "CamTarget"}

def join_group(pred, out_name):
    group = [o for o in sc.objects if pred(o) and o.type == 'MESH']
    if not group: return None
    if len(group) > 1:
        with bpy.context.temp_override(active_object=group[0], selected_editable_objects=group,
                                       selected_objects=group, scene=sc):
            bpy.ops.object.join()
    group[0].name = out_name
    return group[0]

join_group(lambda o: o.name.split('.')[0] == "Hair", "OrcHair")
join_group(lambda o: o.name.startswith("Tooth"), "Teeth")
join_group(lambda o: o.name.split('.')[0] == "Lace", "Lacing")

# ---- animation pivots (game contract: rotate these by name) ----
def pivot(name, loc):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.location = loc
    return e

def reparent(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()



headP = pivot("HeadPivot", (0, 0.04, -0.32))          # neck base
bodyP = pivot("BodyPivot", (0, 0.05, -1.55))          # hips: lean/bob from here
legL = pivot("LegL", (-0.24, 0.05, -1.72))
legR = pivot("LegR", (0.24, 0.05, -1.72))
bpy.context.view_layer.update()  # empties were just created: matrix_world is stale
                                 # until evaluated, and reparent() relies on it

HEAD_PARTS = {"Head", "EyeL", "EyeR", "Pupil", "MouthIn", "Teeth", "Ear", "OrcHair"}
LEG_PARTS = {"Leg", "Boot"}
for o in list(sc.objects):
    base = o.name.split('.')[0]
    if o.type == 'EMPTY' or base in SKIP or o.parent is not None:
        continue  # arm pivots' children stay put; empties are the rig
    if base in HEAD_PARTS:
        reparent(o, headP)
    elif base in LEG_PARTS:
        reparent(o, legL if (o.matrix_world.translation.x < 0) else legR)
    elif base in ("ArmL", "ArmR"):
        pass
    else:
        reparent(o, bodyP)
# arms + head hang off the body so torso lean carries them
for nm in ("ArmL", "ArmR"):
    ob = sc.objects.get(nm)
    if ob and ob.parent is None:
        reparent(ob, bodyP)
reparent(headP, bodyP)
bpy.context.view_layer.update()  # re-evaluate child world matrices before measuring

# ---- ground to feet + scale to 2.1 game units ----
zs = []
for o in sc.objects:
    if o.type != 'MESH' or o.name.split('.')[0] in SKIP: continue
    for c in o.bound_box:
        zs.append((o.matrix_world @ Vector(c)).z)
minz, maxz = min(zs), max(zs)
s = 2.1 / (maxz - minz)
for o in (bodyP, legL, legR):
    o.location.z -= minz
    o.location *= s
    o.scale *= s

# ---- export ----
for o in sc.objects:
    o.select_set(o.name.split('.')[0] not in SKIP)
with bpy.context.temp_override(scene=sc, selected_objects=[o for o in sc.objects if o.select_get()]):
    bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format='GLB')

# post-check: feet must sit at z=0, head near 2.1
bpy.context.view_layer.update()
zs2 = []
for o in sc.objects:
    if o.type != 'MESH' or o.name.split('.')[0] in SKIP: continue
    for c in o.bound_box:
        zs2.append((o.matrix_world @ Vector(c)).z)
import os
result = {"file": OUT, "size_kb": round(os.path.getsize(OUT) / 1024), "scale": round(s, 3),
          "ground_min_z": round(min(zs2), 3), "top_z": round(max(zs2), 3)}
