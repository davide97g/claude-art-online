# Dragon build — Smaug-inspired wyvern hero piece (see blender/DRAGON_PLAN.md).
# Run stages in order via: python3 blender/blender_client.py exec blender/dragon_build.py
# (later stages will be appended below their own STAGE markers, orc_build.py style).
#
# CONVENTIONS
#   - Dragon FACES -Y, +Z up. Units: 1.0 = chest radius. Feet grounded at z=0.
#   - Everything is built in world coordinates inside the isolated "DragonBuild"
#     scene; the user's live scene is never touched.
#   - Body/neck/tail = ONE numpy ring-loft along a Catmull-Rom spine, then
#     gaussian script-sculpt passes (orc_build.py engine).
#   - Neutral gray Principled only — materials/vertex color are Stage 4
#     (realism target: do NOT toonify this model, per DRAGON_PLAN.md).
#
# WING ROOT CONTRACT (Stage 3 attaches full wings here):
#   root (buried in shoulder): (±0.55, -1.35, 3.30)
#   elbow (humerus stub tip):  (±1.95, -0.30, 3.95)
#   humerus dir ≈ normalize(±0.75, 0.56, 0.35) — up-back-out, HIGH on the
#   shoulder so the folded wing can drop knuckles-down to the ground
#   (wing doubles as a walking arm, bat-style — Weta wyvern revision).
# STAGE 2 HEAD attaches at the nose-base stub, around (0, -5.1, 5.45),
#   local forward ≈ the stub tangent (forward and slightly down).
#
# ============ STAGE 1: core body ============
import bpy, math, bmesh
import numpy as np
from mathutils import Vector, Euler

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/5dc3834d-80e3-46f6-8b76-b0308daa5ca3/scratchpad"

# ---------- isolated scene (house pattern: never touch the live scene) ----------
old = bpy.data.scenes.get("DragonBuild")
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("DragonBuild")
bpy.context.window.scene = sc

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

GRAY = node_mat("DragonGrayTmp", (0.45, 0.44, 0.43), 0.65)

# ---------- script-sculpt engine ----------
# gaussian push: verts near `center` (anisotropic radius `rad` per axis)
# move by `offset`. neg offsets carve. Everything stays one smooth surface.
def sculpt(V, center, rad, offset, falloff=2.2):
    c = np.array(center); r = np.array(rad); o = np.array(offset)
    d2 = (((V - c) / r) ** 2).sum(axis=1)
    w = np.exp(-d2 * falloff)
    w[w < 0.01] = 0
    return V + np.outer(w, o)

def get_np(me):
    n = len(me.vertices)
    V = np.empty(n * 3)
    me.vertices.foreach_get("co", V)
    return V.reshape(-1, 3)

def set_np(me, V):
    me.vertices.foreach_set("co", V.ravel())
    me.update()

def catmull_rom(pts, samples):
    """pts rows: [x, y, z, radius, aspect]; returns (samples, 5) array."""
    P = np.array(pts, dtype=float)
    P = np.vstack([P[0] + (P[0] - P[1]), P, P[-1] + (P[-1] - P[-2])])
    nseg = len(P) - 3
    out = np.empty((samples, P.shape[1]))
    for i, t in enumerate(np.linspace(0, nseg, samples, endpoint=True)):
        seg = min(int(t), nseg - 1)
        u = t - seg
        p0, p1, p2, p3 = P[seg], P[seg + 1], P[seg + 2], P[seg + 3]
        out[i] = 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                        + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    return out

# ---------- spine: rounded nose stub -> tail tip, ONE lofted tube ----------
# columns: x, y, z, radius, aspect (vertical stretch of the ring cross-section)
SPINE_CP = [
    # nose stub points forward and slightly down off the crest
    # (striking-cobra head carriage); Stage 2 head attaches ~(0,-5.1,5.45)
    (0.00, -5.30, 5.40, 0.09, 1.00),
    (0.00, -5.18, 5.46, 0.24, 1.02),
    (0.00, -4.98, 5.55, 0.31, 1.05),
    (0.00, -4.50, 5.65, 0.38, 1.08),   # crest of the hook (highest point)
    (0.00, -3.85, 5.28, 0.42, 1.12),
    # near-vertical rise (this is what makes the S read from the side)
    (0.00, -3.45, 4.30, 0.46, 1.12),
    (0.00, -3.35, 3.30, 0.50, 1.08),
    # forward-low jut off the shoulders with a shallow throat dip
    # (kept HIGH so neck underline and belly don't merge into a slug profile)
    (0.00, -2.95, 2.65, 0.56, 1.05),
    (0.00, -2.25, 2.75, 0.64, 1.03),
    # torso: distinctly bigger barrel than the neck, proud high chest,
    # back arches down slightly toward the hips (guard stance)
    (0.00, -1.40, 2.95, 0.90, 1.05),   # shoulders
    (0.00, -0.20, 2.80, 1.00, 1.08),   # chest = unit radius
    (0.00,  1.20, 2.60, 0.78, 1.00),   # hips
    # tail: ~3 body-lengths, sinks toward ground with serpentine lateral sway
    (0.20,  2.90, 1.85, 0.52, 1.00),
    (-0.45, 4.50, 1.15, 0.36, 1.00),
    (0.45,  6.00, 0.62, 0.22, 1.00),
    (-0.30, 7.35, 0.36, 0.12, 1.00),
    (0.05,  8.60, 0.28, 0.03, 1.00),   # tail tip (blade comes in Stage 4)
]
M_ALONG, N_AROUND = 170, 64
S = catmull_rom(SPINE_CP, M_ALONG)
spine, rad, aspect = S[:, :3], S[:, 3], S[:, 4]

# frames along the spine (spine y is monotonic head->tail, so no side-flip)
T = np.gradient(spine, axis=0)
T /= np.linalg.norm(T, axis=1, keepdims=True)
Zg = np.array([0.0, 0.0, 1.0])
side = np.cross(np.broadcast_to(Zg, T.shape), T)
side /= np.linalg.norm(side, axis=1, keepdims=True)
up = np.cross(T, side)
up /= np.linalg.norm(up, axis=1, keepdims=True)

ang = np.linspace(0, 2 * np.pi, N_AROUND, endpoint=False)
ca, sa = np.cos(ang), np.sin(ang)
verts = np.empty((M_ALONG * N_AROUND, 3))
for i in range(M_ALONG):
    verts[i * N_AROUND:(i + 1) * N_AROUND] = (
        spine[i][None, :] + rad[i] * (np.outer(ca, side[i]) + aspect[i] * np.outer(sa, up[i])))

faces = []
for i in range(M_ALONG - 1):
    a, b = i * N_AROUND, (i + 1) * N_AROUND
    for j in range(N_AROUND):
        k = (j + 1) % N_AROUND
        faces.append((a + j, a + k, b + k, b + j))
head_pole = len(verts); tail_pole = len(verts) + 1
verts = np.vstack([verts, spine[0] - T[0] * rad[0] * 0.9, spine[-1] + T[-1] * rad[-1] * 0.9])
base = (M_ALONG - 1) * N_AROUND
for j in range(N_AROUND):
    k = (j + 1) % N_AROUND
    faces.append((head_pole, j, k))
    faces.append((tail_pole, base + k, base + j))

me = bpy.data.meshes.new("DragonBody")
me.from_pydata(verts.tolist(), [], faces)
for p in me.polygons: p.use_smooth = True
V = get_np(me)

# ---------- gaussian sculpt passes ----------
# belly: slightly pendulous; chest keel kept SMOOTH & slightly flattened
# (Stage 4 lays segmented snake-like belly plates here — no sharp ridge)
V = sculpt(V, (0, -0.30, 1.65), (0.95, 1.40, 0.75), (0, 0, -0.16))
V = sculpt(V, (0, 0.55, 1.80),  (0.85, 1.05, 0.65), (0, 0, -0.08))
V = sculpt(V, (-0.55, -0.30, 1.70), (0.45, 1.15, 0.60), (-0.11, 0, 0))
V = sculpt(V, ( 0.55, -0.30, 1.70), (0.45, 1.15, 0.60), ( 0.11, 0, 0))
# shoulder muscle mass where the wing-arms root
V = sculpt(V, (-0.88, -1.30, 3.30), (0.55, 0.80, 0.70), (-0.26, 0, 0.12))
V = sculpt(V, ( 0.88, -1.30, 3.30), (0.55, 0.80, 0.70), ( 0.26, 0, 0.12))
# withers hump
V = sculpt(V, (0, -1.40, 3.85), (0.80, 0.90, 0.60), (0, 0, 0.20))
# haunch mass at the hips
V = sculpt(V, (-0.72, 1.20, 2.60), (0.50, 0.85, 0.80), (-0.24, 0, 0.08))
V = sculpt(V, ( 0.72, 1.20, 2.60), (0.50, 0.85, 0.80), ( 0.24, 0, 0.08))
# throat pouch under the dip (subtle — must not sag to belly height)
V = sculpt(V, (0, -3.00, 2.10), (0.45, 0.70, 0.45), (0, -0.02, -0.10))
# proud brisket: smooth mass low on the front of the chest
V = sculpt(V, (0, -1.55, 1.95), (0.60, 0.65, 0.55), (0, -0.06, -0.08))
# neck-base musculature
V = sculpt(V, (-0.48, -2.40, 2.80), (0.34, 0.75, 0.60), (-0.11, 0, 0))
V = sculpt(V, ( 0.48, -2.40, 2.80), (0.34, 0.75, 0.60), ( 0.11, 0, 0))
# slight vertebral bumps along the dorsal line (Stage 4 adds the spike row)
for i in range(16, M_ALONG - 8, 6):
    p = spine[i] + up[i] * rad[i] * aspect[i]
    r = max(rad[i], 0.1)
    V = sculpt(V, tuple(p), (r * 0.30, r * 0.40, r * 0.30), tuple(up[i] * r * 0.09), falloff=2.8)
set_np(me, V)
me.materials.append(GRAY)
body = link(bpy.data.objects.new("DragonBody", me))

# ---------- limb helpers ----------
def blob(name, loc, scale, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=24, radius=1.0)
    m2 = bpy.data.meshes.new(name)
    bm.to_mesh(m2); bm.free()
    for p in m2.polygons: p.use_smooth = True
    set_np(m2, get_np(m2) * np.array(scale))
    m2.materials.append(GRAY)
    ob = link(bpy.data.objects.new(name, m2))
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    return ob

def muscle(name, a, b, r_side, r_fwd, overshoot=0.35):
    """ellipsoid muscle oriented along a->b (world coords)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=24, radius=1.0)
    m2 = bpy.data.meshes.new(name)
    bm.to_mesh(m2); bm.free()
    for p in m2.polygons: p.use_smooth = True
    set_np(m2, get_np(m2) * np.array([r_side, r_fwd, d.length / 2 + overshoot]))
    m2.materials.append(GRAY)
    ob = link(bpy.data.objects.new(name, m2))
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = d.to_track_quat('Z', 'Y')
    ob.location = a + d / 2
    return ob

def limb(name, a, b, r1, r2, seg=24):
    """tapered smooth cone from world point a (radius r1) to b (radius r2)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    m2 = bpy.data.meshes.new(name)
    bm.to_mesh(m2); bm.free()
    for p in m2.polygons: p.use_smooth = True
    m2.materials.append(GRAY)
    ob = link(bpy.data.objects.new(name, m2))
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = d.to_track_quat('Z', 'Y')
    ob.location = a + d / 2
    return ob

# ---------- hind legs (digitigrade: thigh -> shin -> metatarsus -> 3-toed foot) ----------
for s, tag in ((-1, "L"), (1, "R")):
    hip   = (s * 0.78, 1.25, 2.50)
    knee  = (s * 1.05, 0.45, 1.45)
    ankle = (s * 1.12, 1.45, 0.75)
    footj = (s * 1.12, 0.95, 0.18)
    # haunch: big front-to-back disc against the body — nearly chest-scale mass
    muscle(f"DragonThigh{tag}", hip, knee, 0.46, 0.85, 0.30)
    limb(f"DragonShin{tag}", knee, ankle, 0.32, 0.17)
    blob(f"DragonKnee{tag}", knee, (0.30, 0.34, 0.34))
    limb(f"DragonMeta{tag}", ankle, footj, 0.17, 0.19)
    blob(f"DragonAnkle{tag}", ankle, (0.18, 0.20, 0.20))
    blob(f"DragonFoot{tag}", footj, (0.36, 0.48, 0.17))
    for adeg in (-30, 0, 30):          # 3 toes fanned toward -Y, claws to ground
        arad = math.radians(adeg)
        dx, dy = math.sin(arad) * 0.75, -math.cos(arad) * 0.75
        tip = (footj[0] + dx, footj[1] + dy, 0.10)
        limb(f"DragonToe{tag}", (footj[0], footj[1], 0.17), tip, 0.13, 0.07, seg=16)
        ctip = (footj[0] + dx * 1.40, footj[1] + dy * 1.40, 0.0)
        limb(f"DragonClaw{tag}", tip, ctip, 0.07, 0.006, seg=12)

# ---------- wing-arm stubs (coordinates: see WING ROOT CONTRACT in header) ----------
for s, tag in ((-1, "L"), (1, "R")):
    root = (s * 0.55, -1.35, 3.30)
    elbow = (s * 1.95, -0.30, 3.95)
    # deltoid mass, mostly buried in the shoulder
    blob(f"DragonWingRoot{tag}", (s * 0.90, -1.32, 3.25), (0.42, 0.55, 0.48))
    limb(f"DragonHumerus{tag}", root, elbow, 0.40, 0.24)
    blob(f"DragonElbow{tag}", elbow, (0.26, 0.26, 0.26))

# ---------- ground feet at z=0 (matrix_world is stale without this update) ----------
bpy.context.view_layer.update()
lo = np.array([1e9, 1e9, 1e9]); hi = -lo.copy()
for ob in sc.objects:
    if ob.type != 'MESH': continue
    mw = np.array(ob.matrix_world)
    Vw = get_np(ob.data) @ mw[:3, :3].T + mw[:3, 3]
    lo = np.minimum(lo, Vw.min(axis=0)); hi = np.maximum(hi, Vw.max(axis=0))
minz = lo[2]
if abs(minz) > 1e-4:
    for ob in sc.objects:
        if ob.type == 'MESH':
            ob.location.z -= minz
lo[2] -= minz; hi[2] -= minz
ctr = (lo + hi) / 2

# ---------- ground plane (visual stance check only — not part of the export) ----------
gm = bpy.data.meshes.new("GroundPlane")
gm.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)])
gm.materials.append(node_mat("DragonGroundTmp", (0.10, 0.10, 0.11), 0.95))
link(bpy.data.objects.new("GroundPlane", gm))

# ---------- camera + 3-point lighting + preview renders ----------
tgt = link(bpy.data.objects.new("CamTarget", None)); tgt.location = (0, ctr[1], ctr[2])
cam_d = bpy.data.cameras.new("DragonCam"); cam_d.lens = 50
cam = link(bpy.data.objects.new("DragonCam", cam_d))
cam.location = (20.0, ctr[1], ctr[2] + 1.0)
cam.constraints.new('TRACK_TO').target = tgt
sc.camera = cam
for nm, en, szl, loc in (("Key", 3500, 6, (11, -10, 10)), ("Fill", 1100, 9, (-12, -7, 4)), ("Rim", 2500, 4, (-4, 13, 9))):
    L = link(bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'AREA')))
    L.data.energy = en; L.data.size = szl; L.location = loc
    L.constraints.new('TRACK_TO').target = tgt
w = bpy.data.worlds.get("DragonWorld") or bpy.data.worlds.new("DragonWorld")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.045, 0.045, 0.05, 1)
sc.world = w

try:
    sc.render.engine = 'BLENDER_EEVEE'
except Exception:
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 900; sc.render.resolution_y = 700
sc.render.filepath = SCRATCH + "/dragon_s1_side.png"
bpy.ops.render.render(write_still=True)
cam.location = (13.0, ctr[1] - 12.5, ctr[2] + 4.5)   # three-quarter front
sc.render.filepath = SCRATCH + "/dragon_s1_34.png"
bpy.ops.render.render(write_still=True)

nv = sum(len(o.data.vertices) for o in sc.objects if o.type == 'MESH')
nt = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == 'MESH')
result = {"verts": nv, "tris": nt, "minz_shift": round(float(-minz), 4),
          "bbox_lo": [round(float(x), 2) for x in lo], "bbox_hi": [round(float(x), 2) for x in hi]}

# ============ STAGE 2: head ============
# Crocodilian wedge head, ~1.6 units nose->skull-back, APPENDED onto the Stage-1
# body (never rebuilds it). Attaches at the neck nose-stub (~world 0,-5.37,5.37),
# carried level-to-slightly-down like a predator sighting prey (fixes the droop).
# Runs stand-alone too: re-fetches the DragonBuild scene, redefines its helpers,
# and wipes only prior Stage-2 objects so re-runs are idempotent.
#   Material contract: eyes use `CAO_DragonEye` (amber emissive telegraph).
#   Parts kept as separate named cones (DragonHorn*/DragonTooth*/DragonChinSpike*)
#   so a future rig can splay the crest.
SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/5dc3834d-80e3-46f6-8b76-b0308daa5ca3/scratchpad"
sc = bpy.data.scenes.get("DragonBuild")
bpy.context.window.scene = sc

def link(o):
    sc.collection.objects.link(o); return o

def node_mat(name, rgb, rough=0.7):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m

def get_np(me):
    n = len(me.vertices); V = np.empty(n * 3); me.vertices.foreach_get("co", V); return V.reshape(-1, 3)
def set_np(me, V):
    me.vertices.foreach_set("co", V.ravel()); me.update()
def sculpt(V, center, rad, offset, falloff=2.2):
    c = np.array(center); r = np.array(rad); o = np.array(offset)
    d2 = (((V - c) / r) ** 2).sum(axis=1); w = np.exp(-d2 * falloff); w[w < 0.01] = 0
    return V + np.outer(w, o)

from mathutils import Matrix

# idempotent: wipe any prior Stage-2 objects
_PREF = ("DragonHead", "DragonEye", "DragonPupil", "DragonHorn", "DragonTooth",
         "DragonChin", "DragonNostril", "DragonBrow", "HeadCam", "HeadTarget")
for o in list(sc.objects):
    if o.name.startswith(_PREF):
        bpy.data.objects.remove(o, do_unlink=True)

HEAD_GRAY = node_mat("DragonGrayTmp", (0.45, 0.44, 0.43), 0.65)
HORN  = node_mat("DragonHornGray", (0.30, 0.28, 0.27), 0.55)
TEETH = node_mat("DragonTeethGray", (0.74, 0.72, 0.67), 0.40)
PUP   = node_mat("DragonPupil", (0.02, 0.015, 0.01), 0.30)

def _eye_mat():
    m = bpy.data.materials.get("CAO_DragonEye")
    if m: return m
    m = bpy.data.materials.new("CAO_DragonEye"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    amber = (1.0, 0.52, 0.05)
    b.inputs["Base Color"].default_value = (*amber, 1)
    b.inputs["Emission Color"].default_value = (*amber, 1)
    b.inputs["Emission Strength"].default_value = 4.0
    b.inputs["Roughness"].default_value = 0.22
    return m
EYE = _eye_mat()

# ---- head attach transform (world) ----
# nose stub tip ~ (0,-5.37,5.37); head occiput overlaps the neck there, snout
# projects forward (-Y). +X pitch tips the snout gently down = predator sight.
HEAD_CENTER = (0.0, -5.85, 5.44)
HEAD_PITCH  = 0.13
HEAD_MW = Matrix.Translation(HEAD_CENTER) @ Euler((HEAD_PITCH, 0, 0)).to_matrix().to_4x4()

def _place(ob, loc=(0, 0, 0), rot=(0, 0, 0)):
    ob.matrix_world = HEAD_MW @ (Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4())
    return ob

def cone(name, base, tip, r1, r2, mat, seg=14):
    a = Vector(base); b = Vector(tip); d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    m = bpy.data.meshes.new(name); bm.to_mesh(m); bm.free()
    for p in m.polygons: p.use_smooth = True
    m.materials.append(mat)
    ob = bpy.data.objects.new(name, m); link(ob)
    ob.matrix_world = HEAD_MW @ (Matrix.Translation(a + d / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    return ob

def spike(name, base, direction, length, r1, r2=0.006, mat=HORN, seg=12):
    d = Vector(direction).normalized() * length
    return cone(name, base, tuple(Vector(base) + d), r1, r2, mat, seg)

# ---- head egg (LOCAL: -Y forward/snout, +Z up, +Y skull-back) ----
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=72, radius=1.0)
me = bpy.data.meshes.new("DragonHead"); bm.to_mesh(me); bm.free()
V = get_np(me)
V *= np.array([0.32, 0.82, 0.36])   # x half-width, y half-length, z half-height

HEAD_OPS = [
    # broad flat cranium top
    ((0, 0.30, 0.36), (0.34, 0.45, 0.12), (0, 0, -0.10)),
    # occiput: build out the back for the horn mounts
    ((0, 0.75, 0.10), (0.28, 0.18, 0.24), (0, 0.10, 0.02)),
    # taper the snout: pull the front sides inward
    ((-0.30, -0.55, 0.0), (0.16, 0.42, 0.40), ( 0.15, 0, 0)),
    (( 0.30, -0.55, 0.0), (0.16, 0.42, 0.40), (-0.15, 0, 0)),
    ((-0.20, -0.80, 0.0), (0.12, 0.20, 0.35), ( 0.10, 0, 0)),
    (( 0.20, -0.80, 0.0), (0.12, 0.20, 0.35), (-0.10, 0, 0)),
    # flatten top of snout, drop it below cranium level
    ((0, -0.55, 0.34), (0.20, 0.45, 0.12), (0, 0, -0.14)),
    # concave stop between snout and forehead
    ((0, -0.18, 0.30), (0.16, 0.08, 0.10), (0, 0, -0.06)),
    # sharp keel ridge down the top of the snout (angular, not blobby)
    ((0, -0.55, 0.30), (0.05, 0.40, 0.08), (0, 0, 0.05)),
    # HEAVY brow hood: bony mass jutting UP+FORWARD over each eye (shades it)
    ((-0.23, -0.20, 0.15), (0.12, 0.11, 0.09), (-0.02, -0.08, 0.09)),
    (( 0.23, -0.20, 0.15), (0.12, 0.11, 0.09), ( 0.02, -0.08, 0.09)),
    # hood overhang lip that casts down over the socket
    ((-0.235, -0.26, 0.09), (0.10, 0.06, 0.05), (-0.01, -0.08, -0.03)),
    (( 0.235, -0.26, 0.09), (0.10, 0.06, 0.05), ( 0.01, -0.08, -0.03)),
    # bony ridge from hood back toward the horns
    ((-0.23, 0.06, 0.24), (0.09, 0.22, 0.09), (-0.01, 0, 0.05)),
    (( 0.23, 0.06, 0.24), (0.09, 0.22, 0.09), ( 0.01, 0, 0.05)),
    # deep almond eye sockets under the hood (carve in + up-under)
    ((-0.25, -0.20, 0.01), (0.09, 0.09, 0.08), ( 0.10, 0.03, 0.01)),
    (( 0.25, -0.20, 0.01), (0.09, 0.09, 0.08), (-0.10, 0.03, 0.01)),
    # lower-lid bony ridge framing the slit from below
    ((-0.25, -0.22, -0.07), (0.09, 0.08, 0.05), (-0.03, -0.02, 0.03)),
    (( 0.25, -0.22, -0.07), (0.09, 0.08, 0.05), ( 0.03, -0.02, 0.03)),
    # cheekbone / jowl mass at the jaw hinge, flared
    ((-0.28, 0.08, -0.12), (0.13, 0.20, 0.16), (-0.06, 0, -0.02)),
    (( 0.28, 0.08, -0.12), (0.13, 0.20, 0.16), ( 0.06, 0, -0.02)),
    # strong lower jawline, closed
    ((0, -0.2, -0.36), (0.26, 0.5, 0.12), (0, 0, 0.02)),
    ((0, 0.0, -0.34), (0.24, 0.4, 0.10), (0, 0, 0.03)),
    # lip-line groove along the snout side (subtle sneer)
    ((-0.22, -0.45, -0.10), (0.05, 0.42, 0.05), ( 0.03, 0, 0)),
    (( 0.22, -0.45, -0.10), (0.05, 0.42, 0.05), (-0.03, 0, 0)),
    # lip curl: lift upper lip at the front corners to bare the teeth
    ((-0.17, -0.62, -0.06), (0.06, 0.10, 0.05), (0, 0, 0.05)),
    (( 0.17, -0.62, -0.06), (0.06, 0.10, 0.05), (0, 0, 0.05)),
    # flared nostril pads at the snout tip
    ((-0.10, -0.76, 0.08), (0.06, 0.07, 0.06), (-0.03, -0.02, 0.04)),
    (( 0.10, -0.76, 0.08), (0.06, 0.07, 0.06), ( 0.03, -0.02, 0.04)),
    # nostril holes carved into the pads
    ((-0.10, -0.80, 0.07), (0.03, 0.035, 0.035), (0.0, 0.04, -0.02)),
    (( 0.10, -0.80, 0.07), (0.03, 0.035, 0.035), (0.0, 0.04, -0.02)),
    # nose-wrinkler crease behind the nostrils
    ((0, -0.66, 0.16), (0.13, 0.03, 0.07), (0, 0.03, -0.02)),
    # square off the blunt croc snout tip
    ((0, -0.82, 0.0), (0.16, 0.06, 0.22), (0, 0.03, 0)),
]
for c, r, o in HEAD_OPS:
    V = sculpt(V, c, r, o)
set_np(me, V)
for p in me.polygons: p.use_smooth = True
me.materials.append(HEAD_GRAY)
head = bpy.data.objects.new("DragonHead", me); link(head); _place(head)
# light smoothing pass to knock down gaussian-overlap ripples (keeps big forms)
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = head; head.select_set(True)
_sm = head.modifiers.new("sm", "SMOOTH"); _sm.iterations = 2; _sm.factor = 0.45
bpy.ops.object.modifier_apply(modifier="sm")

# ---- eyes (amber emissive) + cat-slit pupils, recessed under the brow hood ----
for sx, tag in ((-0.205, "L"), (0.205, "R")):
    em = bpy.data.meshes.new(f"DragonEye{tag}")
    b2 = bmesh.new(); bmesh.ops.create_uvsphere(b2, u_segments=20, v_segments=16, radius=1.0)
    b2.to_mesh(em); b2.free()
    set_np(em, get_np(em) * np.array([0.060, 0.070, 0.055]))  # almond
    for p in em.polygons: p.use_smooth = True
    em.materials.append(EYE)
    e = bpy.data.objects.new(f"DragonEye{tag}", em); link(e); _place(e, (sx, -0.205, 0.015))
    pm = bpy.data.meshes.new(f"DragonPupil{tag}")
    b3 = bmesh.new(); bmesh.ops.create_uvsphere(b3, u_segments=12, v_segments=10, radius=1.0)
    b3.to_mesh(pm); b3.free()
    set_np(pm, get_np(pm) * np.array([0.012, 0.022, 0.050]))   # vertical slit
    for p in pm.polygons: p.use_smooth = True
    pm.materials.append(PUP)
    po = bpy.data.objects.new(f"DragonPupil{tag}", pm); link(po); _place(po, (sx * 1.10, -0.255, 0.015))

# ---- teeth: upper row (down) + a few lower fangs (up) ----
_NU = 9
for s, tag in ((-1, "L"), (1, "R")):
    for i in range(_NU):
        t = i / (_NU - 1)
        y = -0.70 + t * 0.70; x = s * (0.15 + 0.10 * t); z = -0.075
        big = 1.55 if (i in (1, 2) or i == 5) else 1.0   # front canines + a rear fang
        ln = (0.075 + 0.02 * t) * big; r1 = (0.018 + 0.006 * t) * big
        cone(f"DragonToothU{tag}{i}", (x, y, z), (x, y, z - ln), r1, 0.004, TEETH, seg=10)
    for i in range(3):
        t = i / 2.0
        y = -0.60 + t * 0.28; x = s * (0.13 + 0.05 * t); z = -0.135
        cone(f"DragonToothL{tag}{i}", (x, y, z), (x, y, z + 0.085), 0.017, 0.004, TEETH, seg=10)

# ---- chin spikes ----
for i, (x, y) in enumerate([(0, -0.36), (-0.10, -0.27), (0.10, -0.27)]):
    spike(f"DragonChinSpike{i}", (x, y, -0.33), (0, -0.4, -0.7), 0.14, 0.055, mat=HORN)

# ---- horn crest ----
for s, tag in ((-1, "L"), (1, "R")):
    # two large backswept main horns (2 segments each for a swept hook)
    b0 = (s * 0.17, 0.55, 0.28); mid = (s * 0.23, 0.82, 0.60); tip = (s * 0.19, 1.22, 0.74)
    cone(f"DragonHornMain{tag}a", b0, mid, 0.11, 0.075, HORN, seg=16)
    cone(f"DragonHornMain{tag}b", mid, tip, 0.075, 0.010, HORN, seg=16)
    # cheek row: 5 spikes framing the jaw, graded largest->smallest, swept back
    for i in range(5):
        t = i / 4.0
        bx = s * (0.29 - 0.04 * t); by = -0.06 + 0.42 * t; bz = 0.02 - 0.16 * t
        spike(f"DragonHornCheek{tag}{i}", (bx, by, bz), (s * 0.6, 0.45, 0.05), 0.32 - 0.15 * t, 0.090 - 0.042 * t, mat=HORN)
    # lower-jaw row: 3 small down-swept spikes
    for i in range(3):
        t = i / 2.0
        spike(f"DragonHornJaw{tag}{i}", (s * 0.24, -0.05 + 0.30 * t, -0.26), (s * 0.5, 0.25, -0.5), 0.16 - 0.03 * t, 0.05 - 0.012 * t, mat=HORN)

# ---- preview renders ----
htgt = bpy.data.objects.new("HeadTarget", None); link(htgt); htgt.location = (0.0, -5.95, 5.40)
hcamd = bpy.data.cameras.new("HeadCam"); hcamd.lens = 70
hcam = bpy.data.objects.new("HeadCam", hcamd); link(hcam)
hcam.constraints.new('TRACK_TO').target = htgt
sc.camera = hcam
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 900; sc.render.resolution_y = 720

def _render(loc, path):
    hcam.location = loc; bpy.context.view_layer.update()
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

_render((6.5, -5.95, 5.55), SCRATCH + "/dragon_s2_head_side.png")
_render((0.05, -11.5, 5.55), SCRATCH + "/dragon_s2_head_front.png")
_render((5.0, -10.5, 6.4),   SCRATCH + "/dragon_s2_head_34.png")

sc.camera = sc.objects["DragonCam"]
sc.objects["DragonCam"].location = (22.0, 1.5, 4.0)
sc.objects["CamTarget"].location = (0, 1.5, 3.2)
sc.render.resolution_x = 1000; sc.render.resolution_y = 680
sc.render.filepath = SCRATCH + "/dragon_s2_body_side.png"
bpy.ops.render.render(write_still=True)

_hv = len(me.vertices); _ht = sum(len(p.vertices) - 2 for p in me.polygons)
result = {"stage": 2, "head_verts": _hv, "head_tris": _ht,
          "eye_mat": "CAO_DragonEye" in [m.name for m in bpy.data.materials]}


# ============ STAGE 3: body refine + wings ============
# Fixes the orchestrator's Stage-1 critique, then adds the signature wings.
# APPENDED onto Stages 1-2; runs stand-alone too (re-fetches DragonBuild,
# redefines helpers, wipes only prior Stage-3 leg/wing objects so re-runs are
# idempotent). Body-refine is idempotent via a stored "s3_orig" vertex
# attribute (Stage-1 basis is restored before re-sculpting, never doubled).
#
# PART A body refine: (1) proud/raised torso (broad Z lift on the chest that
#   fades into neck & tail); (2) pectoral/shoulder mass anchoring the wing
#   roots (no bare tube); (3) haunch mass flowing out+down INTO the thigh
#   (kills the Stage-1 hip notch); beefier, deliberately-kinked digitigrade
#   hind legs (thigh forward-down -> shin back-down -> metatarsus forward to a
#   planted, gripping foot). Belly midline left smooth for Stage-4 plates.
# PART B wings: Weta wyvern -- the wing IS the front arm and the beast walks on
#   the wrist knuckle. Per side: humerus -> HIGH elbow (tent peak) -> radius/
#   ulna forearm -> raised WRIST knuckle with a clawed 2-joint THUMB planted on
#   the ground (front foot) -> 4 elongated fingers (finger1 longest) fanning up
#   and back to CANOPY over the spine, towering above the back. Membrane is a
#   SEPARATE mesh per side (DragonWingMembraneL/R -- Stage 4 makes it
#   translucent): webbed panels between fingers + an arm-to-body sail attaching
#   along the torso (shoulder ~(+-0.72,-1.05,3.05) to hip ~(+-0.80,1.80,2.60)),
#   with catenary sag, mild ripple, and a scalloped/torn trailing edge. Right
#   wing is a touch more folded (fold=0.90) for organic asymmetry.
#   Object names: DragonWingArm{L,R} (all bone/claw geo, one mesh per side),
#   DragonWingMembrane{L,R}. The Stage-1 stubs (DragonWingRoot/Humerus/Elbow)
#   are absorbed. Stage-3 adds ~13.7k tris (well under the 45k budget).
import bpy, math, bmesh
import numpy as np
from mathutils import Vector, Euler, Matrix

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/5dc3834d-80e3-46f6-8b76-b0308daa5ca3/scratchpad"
sc = bpy.data.scenes.get("DragonBuild")
bpy.context.window.scene = sc

def link(o):
    sc.collection.objects.link(o); return o
def node_mat(name, rgb, rough=0.7):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m
def get_np(me):
    n=len(me.vertices); V=np.empty(n*3); me.vertices.foreach_get("co",V); return V.reshape(-1,3)
def set_np(me, V):
    me.vertices.foreach_set("co", V.ravel()); me.update()
def sculpt(V, center, rad, offset, falloff=2.2):
    c=np.array(center); r=np.array(rad); o=np.array(offset)
    d2=(((V-c)/r)**2).sum(axis=1); w=np.exp(-d2*falloff); w[w<0.01]=0
    return V+np.outer(w,o)

GRAY = node_mat("DragonGrayTmp", (0.45,0.44,0.43), 0.65)
MEMB = node_mat("DragonMembraneTmp", (0.40,0.30,0.30), 0.55)

def blob(name, loc, scale, rot=(0,0,0)):
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=32,v_segments=24,radius=1.0)
    m2=bpy.data.meshes.new(name); bm.to_mesh(m2); bm.free()
    for p in m2.polygons: p.use_smooth=True
    set_np(m2, get_np(m2)*np.array(scale)); m2.materials.append(GRAY)
    ob=link(bpy.data.objects.new(name,m2)); ob.location=loc; ob.rotation_euler=Euler(rot); return ob
def muscle(name, a, b, r_side, r_fwd, overshoot=0.35):
    a,b=Vector(a),Vector(b); d=b-a
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=32,v_segments=24,radius=1.0)
    m2=bpy.data.meshes.new(name); bm.to_mesh(m2); bm.free()
    for p in m2.polygons: p.use_smooth=True
    set_np(m2, get_np(m2)*np.array([r_side,r_fwd,d.length/2+overshoot])); m2.materials.append(GRAY)
    ob=link(bpy.data.objects.new(name,m2)); ob.rotation_mode='QUATERNION'
    ob.rotation_quaternion=d.to_track_quat('Z','Y'); ob.location=a+d/2; return ob
def limb(name, a, b, r1, r2, seg=24):
    a,b=Vector(a),Vector(b); d=b-a
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=seg,radius1=r1,radius2=r2,depth=d.length)
    m2=bpy.data.meshes.new(name); bm.to_mesh(m2); bm.free()
    for p in m2.polygons: p.use_smooth=True
    m2.materials.append(GRAY)
    ob=link(bpy.data.objects.new(name,m2)); ob.rotation_mode='QUATERNION'
    ob.rotation_quaternion=d.to_track_quat('Z','Y'); ob.location=a+d/2; return ob

# ---------- geometry accumulators for the wing bone mesh ----------
def _frame(zc):
    up=np.array([0,0,1.0])
    if abs(float(zc@up))>0.98: up=np.array([0,1.0,0])
    xc=np.cross(up,zc); xc/=np.linalg.norm(xc); yc=np.cross(zc,xc); return xc,yc
def cone_geo(a,b,r1,r2,seg,V,F):
    a=np.array(a,float); b=np.array(b,float); d=b-a; L=np.linalg.norm(d)
    if L<1e-6: return
    zc=d/L; xc,yc=_frame(zc); base=len(V); ang=np.linspace(0,2*np.pi,seg,endpoint=False)
    for t in ang: V.append(a + r1*(math.cos(t)*xc+math.sin(t)*yc))
    for t in ang: V.append(b + r2*(math.cos(t)*xc+math.sin(t)*yc))
    for j in range(seg):
        k=(j+1)%seg; F.append((base+j, base+k, base+seg+k, base+seg+j))
    ca=len(V); V.append(a)
    for j in range(seg):
        k=(j+1)%seg; F.append((ca, base+k, base+j))
    cb=len(V); V.append(b)
    for j in range(seg):
        k=(j+1)%seg; F.append((cb, base+seg+j, base+seg+k))
def sphere_geo(c,r,V,F,seg=12,rings=8):
    c=np.array(c,float); base=len(V)
    for i in range(1,rings):
        phi=math.pi*i/rings; z=math.cos(phi); rr=math.sin(phi)
        for j in range(seg):
            t=2*math.pi*j/seg; V.append(c+r*np.array([rr*math.cos(t),rr*math.sin(t),z]))
    top=len(V); V.append(c+np.array([0,0,r])); bot=len(V); V.append(c+np.array([0,0,-r]))
    for j in range(seg):
        k=(j+1)%seg; F.append((top, base+k, base+j))
    for i in range(rings-2):
        for j in range(seg):
            k=(j+1)%seg; a=base+i*seg; b=base+(i+1)*seg
            F.append((a+j,a+k,b+k,b+j))
    lastrow=base+(rings-2)*seg
    for j in range(seg):
        k=(j+1)%seg; F.append((bot, lastrow+j, lastrow+k))

def bez(p0,p1,p2,n):
    p0=np.array(p0,float); p1=np.array(p1,float); p2=np.array(p2,float)
    ts=np.linspace(0,1,n)
    return np.array([(1-t)**2*p0 + 2*(1-t)*t*p1 + t*t*p2 for t in ts])
def lin(a,b,n):
    a=np.array(a,float); b=np.array(b,float)
    return np.array([a+(b-a)*t for t in np.linspace(0,1,n)])

# ---------- wipe prior Stage-3 leg/wing objects (idempotent) ----------
_WIPE = ("DragonThigh","DragonShin","DragonKnee","DragonMeta","DragonAnkle",
         "DragonFoot","DragonToe","DragonClaw","DragonHaunch",
         "DragonWing","DragonHumerus","DragonElbow","DragonPec","DragonShoulder")
for o in list(sc.objects):
    if o.name.startswith(_WIPE):
        bpy.data.objects.remove(o, do_unlink=True)

# ======================================================================
# PART A — body refinement (idempotent: restore Stage-1 basis, re-sculpt)
# ======================================================================
body = sc.objects["DragonBody"]; me = body.data
if "s3_orig" not in me.attributes:
    a = me.attributes.new("s3_orig", 'FLOAT_VECTOR', 'POINT')
    V0 = get_np(me); a.data.foreach_set("vector", V0.ravel())
else:
    a = me.attributes["s3_orig"]; buf=np.empty(len(me.vertices)*3)
    a.data.foreach_get("vector", buf); set_np(me, buf.reshape(-1,3))
V = get_np(me)
# (1) proud/raised torso: broad Z lift on the chest, fades into neck & tail
V = sculpt(V, (0, -0.6, 2.7), (1.30, 1.75, 1.30), (0, 0, 0.30), falloff=1.4)
# (2) pectoral / shoulder mass anchoring the wing roots (not a bare tube)
V = sculpt(V, (-0.95, -1.35, 3.25), (0.60, 0.95, 0.85), (-0.34, 0, 0.10))
V = sculpt(V, ( 0.95, -1.35, 3.25), (0.60, 0.95, 0.85), ( 0.34, 0, 0.10))
V = sculpt(V, (-0.90, -1.90, 2.55), (0.55, 0.70, 0.85), (-0.26, -0.05, 0))
V = sculpt(V, ( 0.90, -1.90, 2.55), (0.55, 0.70, 0.85), ( 0.26, -0.05, 0))
V = sculpt(V, (0, -2.05, 2.05), (0.62, 0.60, 0.55), (0, -0.10, -0.05))
# (3) haunch mass flowing OUT+DOWN into the thigh (kills the hip notch)
V = sculpt(V, (-0.85, 1.15, 2.55), (0.62, 0.95, 1.05), (-0.42, 0.05, -0.05), falloff=1.7)
V = sculpt(V, ( 0.85, 1.15, 2.55), (0.62, 0.95, 1.05), ( 0.42, 0.05, -0.05), falloff=1.7)
V = sculpt(V, (-0.70, 0.65, 2.95), (0.45, 0.55, 0.45), (-0.14, 0, 0.10))
V = sculpt(V, ( 0.70, 0.65, 2.95), (0.45, 0.55, 0.45), ( 0.14, 0, 0.10))
set_np(me, V)

def build_leg(s, tag):
    hip   = (s*0.80, 1.20, 2.72); knee  = (s*1.20, 0.28, 1.66)
    ankle = (s*1.26, 1.60, 0.82); footj = (s*1.20, 0.92, 0.16)
    muscle(f"DragonThigh{tag}", hip, knee, 0.56, 1.00, 0.34)
    blob(f"DragonKnee{tag}", knee, (0.34, 0.40, 0.42))
    limb(f"DragonShin{tag}", knee, ankle, 0.40, 0.26)
    blob(f"DragonAnkle{tag}", ankle, (0.27, 0.29, 0.28))
    limb(f"DragonMeta{tag}", ankle, footj, 0.25, 0.22)
    blob(f"DragonFoot{tag}", footj, (0.42, 0.56, 0.22))
    for adeg in (-34, 0, 34):
        arad=math.radians(adeg); dx,dy=math.sin(arad)*0.82, -math.cos(arad)*0.82
        tip=(footj[0]+dx, footj[1]+dy, 0.11)
        limb(f"DragonToe{tag}", (footj[0]+dx*0.15, footj[1]+dy*0.15, 0.16), tip, 0.15, 0.08, seg=16)
        ctip=(footj[0]+dx*1.42, footj[1]+dy*1.42, 0.0)
        limb(f"DragonClaw{tag}", tip, ctip, 0.08, 0.007, seg=12)
    limb(f"DragonClaw{tag}", (s*1.05, 1.55, 0.55), (s*1.10, 2.05, 0.10), 0.06, 0.006, seg=10)
for s, tag in ((-1,"L"),(1,"R")):
    build_leg(s, tag)

# ======================================================================
# PART B — wings (mantled/tented, wing doubles as planted front arm+hand)
# ======================================================================
def build_wing(s, tag, fold=1.0):
    root  = np.array([s*0.55, -1.35, 3.30])
    elbow = np.array([s*2.35, -1.05, 5.35])          # HIGH tent peak
    wrist = np.array([s*1.95, -2.45, 1.05])          # raised knuckle cluster at the front
    # fingertips fan UP and BACK over the spine; F1 longest (leading edge),
    # trailing fingers curl inward to canopy OVER the back
    tips = [np.array([s*2.40, 1.10, 6.65]),
            np.array([s*2.05, 2.55, 5.55]),
            np.array([s*1.55, 3.75, 4.25]),
            np.array([s*0.95, 4.55, 2.85])]
    # optional fold: pull tips back toward the wrist (right wing a touch more folded)
    tips = [wrist + (t-wrist)*fold for t in tips]
    # bowed finger polylines (quadratic bezier, control pushed out+up)
    NF = 22
    fingers=[]
    for i,t in enumerate(tips):
        mid=(wrist+t)/2
        ctrl=mid+np.array([s*(0.55-0.10*i), -0.35, 0.55-0.10*i])
        fingers.append(bez(wrist,ctrl,t,NF))
    # ---- bone/arm mesh (single combined object) ----
    Vb=[]; Fb=[]
    cone_geo(root, elbow, 0.40, 0.24, 16, Vb, Fb)        # humerus (thick, muscled)
    sphere_geo(elbow, 0.27, Vb, Fb)                       # elbow joint
    cone_geo(elbow, wrist, 0.26, 0.17, 16, Vb, Fb)        # radius/ulna forearm
    sphere_geo(wrist, 0.24, Vb, Fb)                        # wrist knuckle (load-bearing)
    # clawed THUMB (walks on it): distinct 2-joint digit + big claw, plants forward
    tk = np.array([s*1.80, -3.05, 0.66]); tt = np.array([s*1.66, -3.62, 0.26])
    tc = np.array([s*1.54, -4.02, 0.0])
    cone_geo(wrist, tk, 0.15, 0.11, 12, Vb, Fb)
    sphere_geo(tk, 0.115, Vb, Fb)
    cone_geo(tk, tt, 0.11, 0.075, 12, Vb, Fb)
    cone_geo(tt, tc, 0.075, 0.006, 10, Vb, Fb)            # big curved thumb claw
    # finger bones: cone segments along each bezier, tapering; knuckle at base
    for fi,fp in enumerate(fingers):
        rb = 0.135 - 0.02*fi                              # finger1 thickest
        sphere_geo(fp[0]+ (fp[1]-fp[0])*0.15, rb*1.05, Vb, Fb, seg=10, rings=6)
        for k in range(len(fp)-1):
            u0=k/(len(fp)-1); u1=(k+1)/(len(fp)-1)
            r0=rb*(1-u0)+0.02*u0 if u0>0 else rb
            r1=rb*(1-u1)+0.015
            cone_geo(fp[k], fp[k+1], max(r0,0.02), max(r1,0.012), 8, Vb, Fb)
        # small claw at each fingertip (bigger on finger 1)
        tipdir = fp[-1]-fp[-2]; tipdir=tipdir/np.linalg.norm(tipdir)
        clen = 0.30-0.05*fi
        cone_geo(fp[-1], fp[-1]+tipdir*clen, 0.035, 0.004, 8, Vb, Fb)
    mb=bpy.data.meshes.new(f"DragonWingArm{tag}")
    mb.from_pydata([v.tolist() for v in Vb], [], Fb)
    for p in mb.polygons: p.use_smooth=True
    mb.materials.append(GRAY); mb.update()
    link(bpy.data.objects.new(f"DragonWingArm{tag}", mb))

    # ---- membrane (single mesh): fan panels between fingers + arm-to-body sail ----
    shoulder_att = np.array([s*0.72, -1.05, 3.05])
    hip_att      = np.array([s*0.80, 1.80, 2.60])
    body_rail = lin(shoulder_att, hip_att, NF)
    panels = [(fingers[0],fingers[1]), (fingers[1],fingers[2]),
              (fingers[2],fingers[3]), (fingers[3], body_rail)]
    MC = 18; SAG=0.30; RIP=0.06
    rng=np.random.default_rng(7 if s<0 else 13)
    Vm=[]; Fm=[]
    for pi,(rA,rB) in enumerate(panels):
        base=len(Vm)
        plagio = (pi==3)
        for i in range(NF):
            u=i/(NF-1); A=rA[i]; B=rB[i]; span=np.linalg.norm(B-A)
            for j in range(MC):
                v=j/(MC-1)
                P=A*(1-v)+B*v
                # catenary sag toward gravity; more toward the tips (u)
                sagw = math.sin(math.pi*v)*SAG*span*(0.35+0.65*u)
                P=P.copy(); P[2]-=sagw
                # mild ripple
                P[2]+=RIP*span*math.sin(3.3*u+2.1*v)*(0.3+0.7*u)
                P[0]+=RIP*0.4*span*math.sin(2.0*u+3.0*v)*s
                Vm.append(P)
        for i in range(NF-1):
            for j in range(MC-1):
                aa=base+i*MC+j; bb=base+i*MC+(j+1); cc=base+(i+1)*MC+(j+1); dd=base+(i+1)*MC+j
                Fm.append((aa,bb,cc,dd))
        # scalloped + ragged FREE trailing edge (fingertip arc = last u row of hand panels;
        # far edge of plagio): smooth catenary droop between spars + a few torn notches.
        notch = rng.random(MC) < 0.30                            # sparse deep tears
        for j in range(MC):
            v=j/(MC-1); idx=base+(NF-1)*MC+j
            P=np.array(Vm[idx]); wr=fingers[0][0]
            drp=math.sin(math.pi*v)
            P += (wr-P)*(0.06*drp)                               # gentle concave scallop
            P[2]-=0.08*drp                                       # droop between spars
            if notch[j]:                                         # occasional torn notch
                P += (wr-P)*(0.10+0.12*rng.random())
                P += (rng.random(3)-0.5)*np.array([0.06,0.06,0.10])
            Vm[idx]=P.tolist()
    mm=bpy.data.meshes.new(f"DragonWingMembrane{tag}")
    mm.from_pydata([list(v) for v in Vm], [], Fm)
    for p in mm.polygons: p.use_smooth=True
    mm.materials.append(MEMB); mm.update()
    # recalc normals
    bm=bmesh.new(); bm.from_mesh(mm); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mm); bm.free()
    link(bpy.data.objects.new(f"DragonWingMembrane{tag}", mm))
    return {"root":root.tolist(),"elbow":elbow.tolist(),"wrist":wrist.tolist(),
            "shoulder_att":shoulder_att.tolist(),"hip_att":hip_att.tolist()}

wingL = build_wing(-1, "L", fold=1.00)
wingR = build_wing( 1, "R", fold=0.90)   # right a touch more folded (organic asymmetry)

# ---------- re-ground so lowest point (feet / planted thumb) sits at z=0 ----------
bpy.context.view_layer.update()
lo=np.array([1e9]*3); hi=-lo.copy()
for ob in sc.objects:
    if ob.type!='MESH' or ob.name=="GroundPlane": continue
    mw=np.array(ob.matrix_world); Vw=get_np(ob.data)@mw[:3,:3].T+mw[:3,3]
    lo=np.minimum(lo,Vw.min(axis=0)); hi=np.maximum(hi,Vw.max(axis=0))
minz=lo[2]
if abs(minz)>1e-4:
    for ob in sc.objects:
        if ob.type=='MESH' and ob.name!="GroundPlane": ob.location.z-=minz
    lo[2]-=minz; hi[2]-=minz

# ---------- renders: side, front, 3/4 ----------
cam=sc.objects["DragonCam"]; tgt=sc.objects["CamTarget"]
sc.camera=cam; sc.view_settings.view_transform='Standard'
tgt.location=(0, 0.8, 3.4)
sc.render.resolution_x=1000; sc.render.resolution_y=760
cam.location=(24.0, 0.8, 4.4)
sc.render.filepath=SCRATCH+"/dragon_s3_side.png"; bpy.ops.render.render(write_still=True)
cam.location=(0.5, -17.0, 4.6)
sc.render.filepath=SCRATCH+"/dragon_s3_front.png"; bpy.ops.render.render(write_still=True)
cam.location=(15.0, -13.5, 6.0)
sc.render.filepath=SCRATCH+"/dragon_s3_34.png"; bpy.ops.render.render(write_still=True)

nt=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in sc.objects if o.type=='MESH' and o.name!="GroundPlane")
result={"partB":True,"bbox_lo":[round(float(x),2) for x in lo],"bbox_hi":[round(float(x),2) for x in hi],
        "tris_total":nt, "wingL":wingL}


# ============ STAGE 3b: wing refine ============
# Orchestrator round: kill the "origami bat" — no straight scaffold cylinders.
# Replaces ONLY DragonWingArmL/R + DragonWingMembraneL/R (idempotent wipe by
# prefix; Stage-3 Part A body refine and legs are untouched). Same pose,
# same asymmetry (right wing fold=0.90), same object names.
#   1. Every bone is a parallel-transport TUBE along a bezier with a per-sample
#      radius profile: humerus bows outward-forward and swells mid-span
#      (0.42->0.48->0.26); forearm bows back-and-out and tapers (0.26->0.30->
#      0.20); fingers are bezier arcs, curvature decreasing per finger, with a
#      taper profile + knuckle/joint bulge spheres at u=0.02/0.35/0.68.
#   2. Membrane drape: global cross-wing curl (points pulled inward toward the
#      body between spars — cape, not fan), catenary sag boosted toward the
#      trailing edge (u^1.5), leading-edge skin wrap over the finger-1 bone,
#      and a root fillet that dips the body panel tangentially into the flank.
#   3. Wrist = broad flattened load-bearing pad (ell_geo floor-clamped sole at
#      z~0.035, bat walking wrist) that the forearm enters at matching radius;
#      thumb short + thick (2 joints) with 3 stout claws planted flat.
#   Wings total 15,840 tris (delta +2,160 vs Stage 3). Renders: dragon_s3b_*.
import bpy, math, bmesh
import numpy as np
from mathutils import Vector, Euler

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/5dc3834d-80e3-46f6-8b76-b0308daa5ca3/scratchpad"
sc = bpy.data.scenes.get("DragonBuild")
bpy.context.window.scene = sc

def link(o):
    sc.collection.objects.link(o); return o
def node_mat(name, rgb, rough=0.7):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m
GRAY = node_mat("DragonGrayTmp", (0.45,0.44,0.43), 0.65)
MEMB = node_mat("DragonMembraneTmp", (0.40,0.30,0.30), 0.55)

def bez(p0,p1,p2,n):
    p0=np.array(p0,float); p1=np.array(p1,float); p2=np.array(p2,float)
    ts=np.linspace(0,1,n)
    return np.array([(1-t)**2*p0 + 2*(1-t)*t*p1 + t*t*p2 for t in ts])
def lin(a,b,n):
    a=np.array(a,float); b=np.array(b,float)
    return np.array([a+(b-a)*t for t in np.linspace(0,1,n)])

# ---- parallel-transport tube along a polyline with per-sample radius ----
# (this is what kills the "scaffold pipe" look: bones bow and swell)
def tube_geo(P, R, V, F, seg=12):
    P=np.array(P,float); n=len(P)
    T=np.gradient(P,axis=0); T/=np.linalg.norm(T,axis=1,keepdims=True)
    up=np.array([0,0,1.0])
    if abs(float(T[0]@up))>0.9: up=np.array([1.0,0,0])
    N=np.cross(T[0],np.cross(up,T[0])); N/=np.linalg.norm(N)
    base=len(V); ang=np.linspace(0,2*np.pi,seg,endpoint=False)
    for i in range(n):
        if i>0:
            N=N-T[i]*float(N@T[i]); N/=np.linalg.norm(N)
        B=np.cross(T[i],N)
        for t in ang:
            V.append(P[i]+R[i]*(math.cos(t)*N+math.sin(t)*B))
    for i in range(n-1):
        for j in range(seg):
            k=(j+1)%seg; a=base+i*seg; b=base+(i+1)*seg
            F.append((a+j,a+k,b+k,b+j))
    c0=len(V); V.append(P[0]); c1=len(V); V.append(P[-1])
    last=base+(n-1)*seg
    for j in range(seg):
        k=(j+1)%seg
        F.append((c0, base+k, base+j))
        F.append((c1, last+j, last+k))

def ell_geo(c, rx, ry, rz, V, F, seg=14, rings=10, floor=None):
    """ellipsoid; optional floor clamps the sole flat (load-bearing pad)."""
    c=np.array(c,float); base=len(V)
    for i in range(1,rings):
        phi=math.pi*i/rings; z=math.cos(phi); rr=math.sin(phi)
        for j in range(seg):
            t=2*math.pi*j/seg
            p=c+np.array([rx*rr*math.cos(t), ry*rr*math.sin(t), rz*z])
            if floor is not None: p[2]=max(p[2],floor)
            V.append(p)
    top=len(V); V.append(c+np.array([0,0,rz]))
    pb=c+np.array([0,0,-rz]);
    if floor is not None: pb[2]=max(pb[2],floor)
    bot=len(V); V.append(pb)
    for j in range(seg):
        k=(j+1)%seg; F.append((top, base+k, base+j))
    for i in range(rings-2):
        for j in range(seg):
            k=(j+1)%seg; a=base+i*seg; b=base+(i+1)*seg
            F.append((a+j,a+k,b+k,b+j))
    lastrow=base+(rings-2)*seg
    for j in range(seg):
        k=(j+1)%seg; F.append((bot, lastrow+j, lastrow+k))

def cone_geo(a,b,r1,r2,seg,V,F):
    a=np.array(a,float); b=np.array(b,float)
    tube_geo(np.array([a,a+(b-a)*0.5,b]), np.array([r1,(r1+r2)/2,r2]), V, F, seg=seg)

# ---------- wipe prior wing objects only (body Part A untouched) ----------
for o in list(sc.objects):
    if o.name.startswith(("DragonWingArm","DragonWingMembrane")):
        bpy.data.objects.remove(o, do_unlink=True)

def build_wing2(s, tag, fold=1.0):
    root  = np.array([s*0.55, -1.35, 3.30])
    elbow = np.array([s*2.30, -1.05, 5.30])
    wrist = np.array([s*1.95, -2.45, 0.55])          # LOW: the beast leans on it
    fbase = np.array([s*1.95, -2.30, 0.82])          # fingers spring off the knuckle
    # fingertips: curled fan (later fingers pulled inward+down = cross-wing curl)
    tips = [np.array([s*2.40, 1.10, 6.60]),
            np.array([s*2.00, 2.55, 5.45]),
            np.array([s*1.40, 3.65, 4.05]),
            np.array([s*0.85, 4.40, 2.60])]
    tips = [wrist + (t-wrist)*fold for t in tips]

    NF=22
    fingers=[]
    for i,t in enumerate(tips):
        mid=(fbase+t)/2
        # bow: strong on finger1, decreasing curvature per finger; arcs back+down
        ctrl=mid+np.array([s*(0.60-0.14*i), -0.40+0.06*i, 0.70-0.16*i])
        fingers.append(bez(fbase,ctrl,t,NF))

    Vb=[]; Fb=[]
    # ---- humerus: bowed outward-forward, muscle swell mid-span ----
    hm=(root+elbow)/2
    hcurve=bez(root, hm+np.array([s*0.38,-0.22,0.05]), elbow, 14)
    hu=np.linspace(0,1,14)
    hr=np.interp(hu,[0,0.40,1.0],[0.42,0.48,0.26])
    tube_geo(hcurve,hr,Vb,Fb,seg=14)
    ell_geo(elbow,0.30,0.30,0.30,Vb,Fb)               # elbow joint bulge
    # ---- forearm: the big tube — now tapered, bowed back-and-out, leaning ----
    fm=(elbow+wrist)/2
    fcurve=bez(elbow, fm+np.array([s*0.30,-0.34,0.05]), wrist, 16)
    fu=np.linspace(0,1,16)
    fr=np.interp(fu,[0,0.35,1.0],[0.26,0.30,0.20])
    tube_geo(fcurve,fr,Vb,Fb,seg=14)
    # ---- wrist: broad flattened load-bearing pad (bat walking wrist);
    # forearm enters its back at matching radius so they blend, no onion ----
    pad=np.array([s*1.93,-2.58,0.28])
    ell_geo(pad,0.33,0.46,0.26,Vb,Fb,floor=0.035)
    # ---- thumb: short + thick, 2 joints, 3 stout planted claws ----
    tk=np.array([s*1.88,-3.10,0.22])
    tube_geo(np.array([pad+np.array([0,-0.15,0.04]),(pad+tk)/2+np.array([0,0,-0.02]),tk]),
             np.array([0.22,0.19,0.15]),Vb,Fb,seg=12)
    ell_geo(tk,0.16,0.16,0.14,Vb,Fb,floor=0.03)
    for adeg in (-30,0,30):
        ar=math.radians(adeg)
        tip=tk+np.array([math.sin(ar)*0.48, -math.cos(ar)*0.48, -0.18])
        tip[2]=0.02
        cone_geo(tk,tip,0.12,0.02,10,Vb,Fb)
    # ---- fingers: bezier tubes, taper + knuckle bulges at joints ----
    for fi,fp in enumerate(fingers):
        rb=0.13-0.018*fi
        fuu=np.linspace(0,1,NF)
        rr=np.interp(fuu,[0,0.35,0.68,1.0],[rb,rb*0.82,rb*0.60,0.028])
        tube_geo(fp,rr,Vb,Fb,seg=9)
        # joint bulges: base knuckle + two finger joints (sells hand anatomy)
        for uu,mult in ((0.02,1.45),(0.35,1.22),(0.68,1.18)):
            idx=int(uu*(NF-1))
            ell_geo(fp[idx],rr[idx]*mult,rr[idx]*mult,rr[idx]*mult,Vb,Fb,seg=10,rings=7)
        tipdir=fp[-1]-fp[-2]; tipdir/=np.linalg.norm(tipdir)
        cone_geo(fp[-1],fp[-1]+tipdir*(0.30-0.05*fi),0.035,0.005,8,Vb,Fb)
    mb=bpy.data.meshes.new(f"DragonWingArm{tag}")
    mb.from_pydata([list(v) for v in Vb],[],Fb)
    for p in mb.polygons: p.use_smooth=True
    mb.materials.append(GRAY); mb.update()
    link(bpy.data.objects.new(f"DragonWingArm{tag}",mb))

    # ---- membrane: draped cape, not flat fan ----
    shoulder_att=np.array([s*0.72,-1.05,3.05])
    hip_att=np.array([s*0.80,1.80,2.60])
    body_rail=lin(shoulder_att,hip_att,NF)
    panels=[(fingers[0],fingers[1]),(fingers[1],fingers[2]),
            (fingers[2],fingers[3]),(fingers[3],body_rail)]
    MC=18; SAG=0.34; RIP=0.05
    rng=np.random.default_rng(7 if s<0 else 13)
    wrapdir=np.array([0.0,-0.80,-0.60]); wrapdir/=np.linalg.norm(wrapdir)
    Vm=[]; Fm=[]
    for pi,(rA,rB) in enumerate(panels):
        base=len(Vm); plagio=(pi==3)
        for i in range(NF):
            u=i/(NF-1); A=rA[i]; B=rB[i]; span=np.linalg.norm(B-A)
            for j in range(MC):
                v=j/(MC-1)
                P=(A*(1-v)+B*v).copy()
                # catenary sag: much stronger toward the trailing edge (u^1.5)
                sagw=math.sin(math.pi*v)*SAG*span*(0.22+0.78*u**1.5)
                P[2]-=sagw
                # global inward pull toward the body between spars (cape curl)
                P[0]-=s*0.18*math.sin(math.pi*v)*span*(0.3+0.7*u)
                # mild ripple
                P[2]+=RIP*span*math.sin(3.3*u+2.1*v)*(0.3+0.7*u)
                P[0]+=RIP*0.4*span*math.sin(2.0*u+3.0*v)*s
                # leading-edge wrap: skin overlaps finger-1 bone (panel 0 only)
                if pi==0 and v<0.14:
                    P+=wrapdir*0.07*(1-v/0.14)
                # root fillet: plagio dips tangentially where it meets the flank
                if plagio and v>0.70:
                    P[2]-=0.20*((v-0.70)/0.30)**2
                Vm.append(P)
        for i in range(NF-1):
            for j in range(MC-1):
                aa=base+i*MC+j; bb=base+i*MC+(j+1); cc=base+(i+1)*MC+(j+1); dd=base+(i+1)*MC+j
                Fm.append((aa,bb,cc,dd))
        # scalloped/torn free trailing edge
        notch=rng.random(MC)<0.30
        for j in range(MC):
            v=j/(MC-1); idx=base+(NF-1)*MC+j
            P=np.array(Vm[idx]); wr=fingers[0][0]
            drp=math.sin(math.pi*v)
            P+=(wr-P)*(0.06*drp); P[2]-=0.08*drp
            if notch[j]:
                P+=(wr-P)*(0.10+0.12*rng.random())
                P+=(rng.random(3)-0.5)*np.array([0.06,0.06,0.10])
            Vm[idx]=P.tolist()
    mm=bpy.data.meshes.new(f"DragonWingMembrane{tag}")
    mm.from_pydata([list(v) for v in Vm],[],Fm)
    for p in mm.polygons: p.use_smooth=True
    mm.materials.append(MEMB); mm.update()
    bm=bmesh.new(); bm.from_mesh(mm); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(mm); bm.free()
    link(bpy.data.objects.new(f"DragonWingMembrane{tag}",mm))

build_wing2(-1,"L",fold=1.00)
build_wing2( 1,"R",fold=0.90)

# ---------- checks + renders ----------
bpy.context.view_layer.update()
def tris(o): return sum(len(p.vertices)-2 for p in o.data.polygons)
def get_np(me2):
    n=len(me2.vertices); V=np.empty(n*3); me2.vertices.foreach_get("co",V); return V.reshape(-1,3)
wminz=1e9; wt=0
for o in sc.objects:
    if o.name.startswith("DragonWing"):
        mw=np.array(o.matrix_world); W=get_np(o.data)@mw[:3,:3].T+mw[:3,3]
        wminz=min(wminz,float(W[:,2].min())); wt+=tris(o)

cam=sc.objects["DragonCam"]; tgt=sc.objects["CamTarget"]
sc.camera=cam; sc.view_settings.view_transform='Standard'
tgt.location=(0,0.8,3.4)
sc.render.resolution_x=1000; sc.render.resolution_y=760
cam.location=(24.0,0.8,4.4)
sc.render.filepath=SCRATCH+"/dragon_s3b_side.png"; bpy.ops.render.render(write_still=True)
cam.location=(0.5,-17.0,4.6)
sc.render.filepath=SCRATCH+"/dragon_s3b_front.png"; bpy.ops.render.render(write_still=True)
cam.location=(15.0,-13.5,6.0)
sc.render.filepath=SCRATCH+"/dragon_s3b_34.png"; bpy.ops.render.render(write_still=True)

nt=sum(tris(o) for o in sc.objects if o.type=='MESH' and o.name!="GroundPlane")
result={"stage":"3b","wing_tris":wt,"wing_minz":round(wminz,3),"tris_total":nt}


# ============ STAGE 4: scales + materials ============
# Turns the gray clay into SMAUG: zoned scale relief (real displaced geometry),
# a graded dorsal spike row, vertex-color paint ("Col" on every mesh), ember
# glow between the chest/throat plates, and export-safe Principled materials.
# APPENDED onto Stages 1-3b; idempotent (restores a stored displacement basis,
# wipes only its own new objects) so it re-runs cleanly. Realism deliberately
# BYPASSES the game toon pipeline (DRAGON_PLAN.md) and must survive GLB->Three:
#   - detail lives in REAL geometry (displacement) + vertex color "Col"
#   - NO procedural shader nodes: materials are Principled with plain factors,
#     Base Color read from the "Col" vertex-color attribute
#   - ember = separate emissive geometry (CAO_DragonEmber); membranes = alpha blend
# Voronoi/Worley cell noise is computed in numpy (hash-based) since shader nodes
# do not export.
import bpy, math, bmesh
import numpy as np
from mathutils import Vector, Euler

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/5dc3834d-80e3-46f6-8b76-b0308daa5ca3/scratchpad"
sc = bpy.data.scenes.get("DragonBuild")
bpy.context.window.scene = sc

def link(o):
    sc.collection.objects.link(o); return o
def get_np(me):
    n=len(me.vertices); V=np.empty(n*3); me.vertices.foreach_get("co",V); return V.reshape(-1,3)
def set_np(me, V):
    me.vertices.foreach_set("co", V.ravel()); me.update()

def vnormals(me):
    """per-vertex normals as (N,3); API first, manual numpy fallback."""
    n=len(me.vertices)
    try:
        me.update()
        buf=np.empty(n*3); me.vertex_normals.foreach_get("vector",buf)
        N=buf.reshape(-1,3)
        if np.isfinite(N).all() and np.abs(N).sum()>0: return N
    except Exception:
        pass
    V=get_np(me); N=np.zeros((n,3))
    for p in me.polygons:
        vs=list(p.vertices); nml=np.zeros(3)
        for k in range(len(vs)):
            a=V[vs[k]]; b=V[vs[(k+1)%len(vs)]]
            nml+=np.cross(a,b)
        for vi in vs: N[vi]+=nml
    ln=np.linalg.norm(N,axis=1,keepdims=True); ln[ln<1e-9]=1
    return N/ln

# ---------- hash-based Worley (Voronoi) cell noise, numpy ----------
def _hash3(ix, iy, iz, seed):
    ix=ix.astype(np.uint64); iy=iy.astype(np.uint64); iz=iz.astype(np.uint64)
    h=(ix*np.uint64(73856093))^(iy*np.uint64(19349663))^(iz*np.uint64(83492791))^np.uint64(seed*2654435761)
    def frac(mult):
        v=(h*np.uint64(mult))>>np.uint64(11)
        return (v & np.uint64(0x1FFFFF)).astype(np.float64)/2097152.0
    return frac(0x9E3779B1), frac(0x85EBCA77), frac(0xC2B2AE3D)

def worley(P, cell, seed=0):
    """returns (F1,F2) nearest / 2nd-nearest jittered-cell distances (world units)."""
    Pc=P/cell; g=np.floor(Pc).astype(np.int64); n=len(P)
    F1=np.full(n,1e18); F2=np.full(n,1e18)
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            for dz in (-1,0,1):
                cx=g[:,0]+dx; cy=g[:,1]+dy; cz=g[:,2]+dz
                jx,jy,jz=_hash3(cx,cy,cz,seed)
                fx=(cx+jx)-Pc[:,0]; fy=(cy+jy)-Pc[:,1]; fz=(cz+jz)-Pc[:,2]
                d=fx*fx+fy*fy+fz*fz
                closer=d<F1
                F2=np.where(closer,F1,np.minimum(F2,d))
                F1=np.where(closer,d,F1)
    return np.sqrt(F1)*cell, np.sqrt(F2)*cell

def vnoise(P, cell, seed=0):
    """cheap smooth-ish mottle in [0,1] from a single worley F1."""
    f1,_=worley(P,cell,seed)
    return np.clip(f1/cell,0,1)

def lerp(a,b,t):
    t=np.clip(t,0,1)[:,None] if np.ndim(t) else t
    return a*(1-t)+b*t

# ---------- colours (linear-ish; 'Standard' view transform sRGB-encodes on output) ----------
# deep blood-red Smaug, NOT copper: crimson base, oxblood shadows, thin gold rims
CRIMSON = np.array([0.175,0.017,0.013])
OXBLOOD = np.array([0.055,0.008,0.007])
GOLD    = np.array([0.66,0.30,0.040])
CREAM   = np.array([0.56,0.38,0.185])
SCARCOL = np.array([0.045,0.010,0.009])
SMOKE   = np.array([0.040,0.035,0.035])
BONE    = np.array([0.50,0.44,0.36])
IVORY   = np.array([0.80,0.75,0.63])
MEMDARK = np.array([0.135,0.018,0.017])
MEMLIT  = np.array([0.42,0.10,0.038])

# ---------- material helpers (export-safe: Principled + Vertex Color node) ----------
def _fresh(name):
    m=bpy.data.materials.get(name)
    if m: bpy.data.materials.remove(m)
    m=bpy.data.materials.new(name); m.use_nodes=True
    return m
def _principled(m): return m.node_tree.nodes["Principled BSDF"]
def _wire_col(m, layer="Col"):
    nt=m.node_tree; b=_principled(m)
    vc=nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name=layer
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    return b

def mat_vc(name, metallic, rough, emis=None, emis_str=0.0):
    m=_fresh(name); b=_wire_col(m)
    b.inputs["Metallic"].default_value=metallic
    b.inputs["Roughness"].default_value=rough
    if emis is not None:
        b.inputs["Emission Color"].default_value=(*emis,1)
        b.inputs["Emission Strength"].default_value=emis_str
    return m

def mat_membrane(name):
    m=_fresh(name); b=_wire_col(m)
    b.inputs["Metallic"].default_value=0.0
    b.inputs["Roughness"].default_value=0.5
    b.inputs["Alpha"].default_value=0.75
    b.inputs["Emission Color"].default_value=(0.5,0.10,0.04,1)  # faint backscatter
    b.inputs["Emission Strength"].default_value=0.25
    for attr,val in (("blend_method","BLEND"),("shadow_method","HASHED")):
        try: setattr(m,attr,val)
        except Exception: pass
    try: m.surface_render_method='BLENDED'
    except Exception: pass
    m.use_backface_culling=False
    try: m.show_transparent_back=True
    except Exception: pass
    return m

def mat_ember(name):
    m=_fresh(name); b=_principled(m)
    b.inputs["Base Color"].default_value=(0.03,0.006,0.0,1)
    b.inputs["Emission Color"].default_value=(1.0,0.20,0.02,1)
    b.inputs["Emission Strength"].default_value=5.5
    b.inputs["Roughness"].default_value=0.6
    return m

BODY = mat_vc("CAO_DragonBody", 0.15, 0.52)
HORN = mat_vc("CAO_DragonHorn", 0.05, 0.45)
TEETH= mat_vc("CAO_DragonTeeth",0.0, 0.35)
MEMB = mat_membrane("CAO_DragonMembrane")
EMBER= mat_ember("CAO_DragonEmber")
# keep CAO_DragonEye (amber emissive) + DragonPupil as-is

def set_mat(ob, mat):
    ob.data.materials.clear(); ob.data.materials.append(mat)

def set_col(me, cols):
    """write/overwrite POINT float-color attribute 'Col' (RGBA), set active+render."""
    ca=me.color_attributes
    ex=ca.get("Col")
    if ex: ca.remove(ex)
    at=ca.new(name="Col", type='FLOAT_COLOR', domain='POINT')
    n=len(me.vertices)
    rgba=np.ones((n,4)); rgba[:,:3]=np.clip(cols,0,1)
    at.data.foreach_set("color", rgba.ravel())
    try: ca.active_color_index=ca.find("Col") if hasattr(ca,'find') else 0
    except Exception: pass
    for nm in ("active_color_name","render_color_name"):
        try: setattr(ca, nm, "Col")
        except Exception: pass
    me.update()

def col_flat(me, rgb):
    set_col(me, np.tile(np.array(rgb),(len(me.vertices),1)))

def col_gradient(me, root_rgb, tip_rgb):
    """dark-root->light-tip along the mesh's longest local axis (base detected
    by which end has the larger cross-section spread)."""
    V=get_np(me); ext=V.max(0)-V.min(0); ax=int(np.argmax(ext))
    t=(V[:,ax]-V[:,ax].min())/max(ext[ax],1e-6)
    o=[i for i in range(3) if i!=ax]
    lo_m=t<0.25; hi_m=t>0.75
    def spread(m):
        if m.sum()<3: return 0
        return float(V[m][:,o].std())
    if spread(hi_m)>spread(lo_m): t=1-t          # ensure base(dark) at wide end
    cols=np.outer(1-t,np.array(root_rgb))+np.outer(t,np.array(tip_rgb))
    set_col(me, cols)

# ---------- idempotent wipe of prior Stage-4 additions ----------
for o in list(sc.objects):
    if o.name.startswith(("DragonSpineSpikes","DragonEmber","S4Warm","S4Rim")):
        bpy.data.objects.remove(o, do_unlink=True)

# =====================================================================
# SPINE sampling (recompute the Stage-1 control curve so spikes + ember
# can follow the true dorsal line / ventral line)
# =====================================================================
SPINE_CP = [
    (0.00,-5.30,5.40,0.09,1.00),(0.00,-5.18,5.46,0.24,1.02),(0.00,-4.98,5.55,0.31,1.05),
    (0.00,-4.50,5.65,0.38,1.08),(0.00,-3.85,5.28,0.42,1.12),(0.00,-3.45,4.30,0.46,1.12),
    (0.00,-3.35,3.30,0.50,1.08),(0.00,-2.95,2.65,0.56,1.05),(0.00,-2.25,2.75,0.64,1.03),
    (0.00,-1.40,2.95,0.90,1.05),(0.00,-0.20,2.80,1.00,1.08),(0.00, 1.20,2.60,0.78,1.00),
    (0.20, 2.90,1.85,0.52,1.00),(-0.45,4.50,1.15,0.36,1.00),(0.45, 6.00,0.62,0.22,1.00),
    (-0.30,7.35,0.36,0.12,1.00),(0.05, 8.60,0.28,0.03,1.00),
]
def catmull_rom(pts, samples):
    P=np.array(pts,float); P=np.vstack([P[0]+(P[0]-P[1]),P,P[-1]+(P[-1]-P[-2])])
    nseg=len(P)-3; out=np.empty((samples,P.shape[1]))
    for i,t in enumerate(np.linspace(0,nseg,samples,endpoint=True)):
        seg=min(int(t),nseg-1); u=t-seg; p0,p1,p2,p3=P[seg],P[seg+1],P[seg+2],P[seg+3]
        out[i]=0.5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u**3)
    return out
ZSHIFT=0.066  # Stage-1/3 grounded the whole rig by this; body verts are local
S=catmull_rom(SPINE_CP,220); spine=S[:,:3].copy(); spine[:,2]+=0  # local space

# =====================================================================
# PART A — BODY scale relief (real displacement) + vertex colour
# =====================================================================
body=sc.objects["DragonBody"]; me=body.data
# one-time: (optionally) subdivide for crisper plate creases, then store basis
if "s4_base" not in me.attributes:
    bm=bmesh.new(); bm.from_mesh(me)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=1, use_grid_fill=True)
    bm.to_mesh(me); bm.free(); me.update()
    a=me.attributes.new("s4_base",'FLOAT_VECTOR','POINT')
    a.data.foreach_set("vector", get_np(me).ravel())
else:
    a=me.attributes["s4_base"]; buf=np.empty(len(me.vertices)*3)
    a.data.foreach_get("vector",buf); set_np(me, buf.reshape(-1,3))

V=get_np(me); N=vnormals(me)
Nz=N[:,2]; Nx=N[:,0]
x=V[:,0]; y=V[:,1]; z=V[:,2]
Pw=V.copy(); Pw[:,2]+=ZSHIFT  # ~world for stable cell grid

# spine-relative ventral mask: a vertex is "belly" if it sits BELOW the local
# spine centre and faces down/forward -> scutes run the full chest->tail-base
spine_z = np.interp(y, spine[:,1], spine[:,2])
spine_x = np.interp(y, spine[:,1], spine[:,0])
below   = np.clip((spine_z - z)/0.45, 0, 1)               # 1 well under the centreline
belly_w = below * np.clip(0.40-Nz,0,1)                    # underside only (not the back)
belly_w *= np.clip((2.4-y)/0.9,0,1)                       # fade past the hips
belly_w *= np.clip((y+4.9)/0.9,0,1)                       # start below the jaw/throat
belly_w = np.clip(belly_w,0,1)
plate_w = 1.0-belly_w                                      # back + flanks get plates
neck_w  = np.clip((-2.15-y)/1.1,0,1)                       # 1 on neck, 0 on torso
tail_w  = np.clip((y-1.6)/1.2,0,1)

# --- cellular plate displacement (coarse back plates blended w/ fine neck rows) ---
f1c,f2c=worley(Pw,0.46,seed=11)              # coarse: back / flank tortoise plates
f1n,f2n=worley(Pw,0.235,seed=23)             # fine: neck rows
def plate_disp(f1,f2,cell,groove):
    e=f2-f1                                   # ~0 at cell border, large at center
    en=np.clip(e/(0.55*cell),0,1)
    face=(en-0.42)                            # centers bulge out, borders sink
    crease=np.exp(-(e/(groove*cell))**2)      # sharp sunk line right on the border
    return face-0.9*crease, en
dispC,enC=plate_disp(f1c,f2c,0.46,0.16)
dispN,enN=plate_disp(f1n,f2n,0.235,0.18)
amp_plate=0.060*(1-0.55*tail_w)               # shrink relief down the tail
disp_plate=amp_plate*(dispN*neck_w + dispC*(1-neck_w))
en_plate = enN*neck_w + enC*(1-neck_w)        # edge metric for gold tinting

# --- segmented belly scutes: transverse overlapping bands along the ventral line ---
band=y/0.50
frac=band-np.floor(band)
tri=1.0-np.abs(frac-0.40)/0.55                # asymmetric ridge (front lip steeper)
tri=np.clip(tri,0,1)
disp_belly=0.090*(tri-0.32)                   # stronger, so scutes read as bands

# --- missing-scale bare patch: LEFT breast (+X side; dragon faces -Y) ---
pc=np.array([0.66,-1.95,2.15-ZSHIFT])
pr=np.array([0.34,0.42,0.30])
patch=np.exp(-(((V-pc)/pr)**2).sum(1)*1.4)

disp = disp_plate*plate_w + disp_belly*belly_w
disp -= 0.045*patch                            # recess the bare oval
V2 = V + N*disp[:,None]
set_np(me, V2)

# --- body vertex colour ---
col=np.tile(CRIMSON,(len(me.vertices),1))
dors=np.clip(Nz,0,1)
col=lerp(col, OXBLOOD, dors*0.9)                                   # darker oxblood back
col=lerp(col, CREAM, np.clip(belly_w*(0.65+tri*0.5),0,1))          # pale belly scutes
col=lerp(col, CREAM*0.42, np.clip(belly_w*(1-tri)*0.55,0,1))       # dark scute-groove lines
gold_w=plate_w*np.exp(-((en_plate-0.20)/0.085)**2)*(1-patch)       # THIN gold on scale rims
gold_w*=np.clip(1.0-belly_w*1.3,0,1)                               # no gold on the pale belly
col=lerp(col, GOLD, np.clip(gold_w*0.42,0,1))
mott=vnoise(Pw*1.0,0.9,seed=7)                                     # subtle mottling
col*= (0.88+0.20*mott)[:,None]
# ancient battle wear: a few darker scar streaks
for (sx,sy,sz,rr) in [(-0.55,-0.6,3.4,(0.10,0.55,0.30)),
                      (0.7,0.7,2.6,(0.09,0.45,0.55)),
                      (-0.3,-2.3,3.4,(0.07,0.30,0.30))]:
    sc_w=np.exp(-(((V-np.array([sx,sy,sz-ZSHIFT]))/np.array(rr))**2).sum(1)*1.6)
    col=lerp(col, SCARCOL, sc_w*0.7)
col=lerp(col, OXBLOOD*0.7+np.array([0.02,0,0]), patch*0.85)        # bare patch = dark, no gold
set_col(me, col)
set_mat(body, BODY)

# =====================================================================
# PART B — HEAD bony-plate relief + colour (respect flesh zones)
# =====================================================================
head=sc.objects["DragonHead"]; hme=head.data
if "s4_base" not in hme.attributes:
    a=hme.attributes.new("s4_base",'FLOAT_VECTOR','POINT')
    a.data.foreach_set("vector", get_np(hme).ravel())
else:
    a=hme.attributes["s4_base"]; buf=np.empty(len(hme.vertices)*3)
    a.data.foreach_get("vector",buf); set_np(hme, buf.reshape(-1,3))
Hv=get_np(hme); Hn=vnormals(hme)
hx,hy,hz=Hv[:,0],Hv[:,1],Hv[:,2]              # local: -Y snout, +Z up, +Y back
# flesh zones: nostrils (front), eye sockets, lips get little/no plating
flesh=np.clip((-0.55-hy)/0.35,0,1)                                   # snout tip / nostrils
eye_m=np.exp(-(((Hv-np.array([-0.25,-0.20,0.0]))/np.array([0.14,0.14,0.13]))**2).sum(1)*1.2)
eye_m+=np.exp(-(((Hv-np.array([0.25,-0.20,0.0]))/np.array([0.14,0.14,0.13]))**2).sum(1)*1.2)
lip=np.exp(-((hz+0.10)/0.05)**2)*np.clip((-0.1-hy),0,1)
flesh=np.clip(flesh+eye_m+lip,0,1)
hf1,hf2=worley(Hv*np.array([1.0,1.0,1.0]),0.24,seed=31)
hdisp,hen=plate_disp(hf1,hf2,0.24,0.18)
hdisp=0.022*hdisp*(1-0.85*flesh)                                     # subtle, spare the flesh
set_np(hme, Hv+Hn*hdisp[:,None])
# colour: crimson, darker crown, gold plate rims on the cranium, dark sockets/lips
hcol=np.tile(CRIMSON,(len(hme.vertices),1))
hcol=lerp(hcol, OXBLOOD, np.clip(Hn[:,2],0,1)*0.7)
hgold=(1-flesh)*np.exp(-((hen-0.24)/0.14)**2)
hcol=lerp(hcol, GOLD, np.clip(hgold*0.6,0,1))
hcol=lerp(hcol, CRIMSON*1.25+np.array([0.05,0,0]), flesh*0.5)        # flesh a touch warmer/softer
hcol=lerp(hcol, np.array([0.05,0.01,0.01]), np.clip(eye_m+lip,0,1)*0.8)  # dark sockets/mouth
hmott=vnoise(Hv,0.5,seed=5); hcol*=(0.9+0.2*hmott)[:,None]
set_col(hme, hcol)
set_mat(head, BODY)

# =====================================================================
# PART C — DORSAL SPIKE ROW (graded, spine-following, alternating jitter)
# =====================================================================
# sample the real back ridge: for target y, take the highest dorsal body vertex
Vb=get_np(me); Nb=vnormals(me)
def ridge_point(ty):
    m=(np.abs(Vb[:,1]-ty)<0.16)&(Nb[:,2]>0.35)&(np.abs(Vb[:,0])<0.28)
    if m.sum()<3:
        m=(np.abs(Vb[:,1]-ty)<0.28)&(Nb[:,2]>0.2)
    if m.sum()==0: return None
    sub=Vb[m]; return sub[np.argmax(sub[:,2])]
Vs=[]; Fs=[]; Cs=[]
def spike_geo(base, tip, halfx, halfy, seg=6, rootc=SMOKE, tipc=BONE):
    base=np.array(base,float); tip=np.array(tip,float)
    axis=tip-base; L=np.linalg.norm(axis); zc=axis/L
    up=np.array([0,0,1.0]); xc=np.cross(up,zc)
    if np.linalg.norm(xc)<1e-4: xc=np.array([1.0,0,0])
    xc/=np.linalg.norm(xc); yc=np.cross(zc,xc)
    b0=len(Vs); ang=np.linspace(0,2*np.pi,seg,endpoint=False)
    for t in ang:
        Vs.append(base+halfx*math.cos(t)*xc+halfy*math.sin(t)*yc); Cs.append(rootc)
    ti=len(Vs); Vs.append(tip); Cs.append(tipc)
    ci=len(Vs); Vs.append(base-zc*0.02); Cs.append(rootc)   # slight base cap inset
    for j in range(seg):
        k=(j+1)%seg; Fs.append((b0+j,b0+k,ti)); Fs.append((ci,b0+k,b0+j))
ys=np.arange(-4.4,7.6,0.34)
for i,ty in enumerate(ys):
    rp=ridge_point(ty)
    if rp is None: continue
    rp=rp.copy(); rp[2]+=ZSHIFT
    # size: peak over the shoulders (~y=-1), shrink up the neck & down the tail
    sz=0.085+0.22*math.exp(-((ty+1.0)/2.6)**2)
    sz*=np.clip((7.7-ty)/2.6,0.18,1.0)          # taper to the tail tip
    lean=0.42*sz                                 # sweep the tip backward (+y)
    jit=0.028*(-1 if i%2 else 1)                 # alternating lateral jitter
    yaw=math.radians(7*(-1 if i%2 else 1))
    base=rp+np.array([jit,0,0])
    tip=base+np.array([jit*1.5+math.sin(yaw)*sz*0.3, lean, sz+0.02])
    spike_geo(base,tip, halfx=sz*0.28, halfy=sz*0.5)
sm=bpy.data.meshes.new("DragonSpineSpikes")
sm.from_pydata([list(v) for v in Vs],[],Fs)
for p in sm.polygons: p.use_smooth=True
sm.update()
spikes=link(bpy.data.objects.new("DragonSpineSpikes",sm))
set_col(sm, np.array(Cs)); set_mat(spikes, HORN)

# =====================================================================
# PART D — EMBER glow: recessed emissive cells in the chest/throat plate gaps
# =====================================================================
Vb2=get_np(me); Nb2=vnormals(me)
def ventral_point(ty):
    m=(np.abs(Vb2[:,1]-ty)<0.14)&(Nb2[:,2]<-0.25)&(np.abs(Vb2[:,0])<0.30)
    if m.sum()<3:
        m=(np.abs(Vb2[:,1]-ty)<0.26)&(Nb2[:,2]<-0.1)
    if m.sum()==0: return None,None
    sub=Vb2[m]; sn=Nb2[m]; k=np.argmin(sub[:,2]); return sub[k],sn[k]
Ve=[]; Fe=[]
_erng=np.random.default_rng(3)
def ember_cell(c,n,halfx,halfy):
    c=np.array(c,float); n=np.array(n,float); n/=np.linalg.norm(n)
    up=np.array([0,0,1.0]); xc=np.cross(n,up)
    if np.linalg.norm(xc)<1e-4: xc=np.array([1.0,0,0])
    xc/=np.linalg.norm(xc); yc=np.cross(n,xc)
    c=c+n*0.004+xc*(_erng.random()-0.5)*0.05     # sit just proud; organic x jitter
    b0=len(Ve)
    for sxx,syy in ((-1,-1),(1,-1),(1,1),(-1,1)):
        Ve.append(c+sxx*halfx*xc+syy*halfy*yc)
    Fe.append((b0,b0+1,b0+2,b0+3))
# glow deepest at the sternum (~y=-1.6) and fades UP the throat to ~y=-4.0
for ty in np.arange(-4.0,-1.0,0.26):
    p,n=ventral_point(ty)
    if p is None: continue
    p=p.copy(); p[2]+=ZSHIFT
    s=np.clip(1.0-(abs(ty+1.6)/2.6),0.28,1.0)    # biggest/brightest at the sternum
    ember_cell(p,n, halfx=0.20*s, halfy=0.07*s)
em=bpy.data.meshes.new("DragonEmberCracks")
em.from_pydata([list(v) for v in Ve],[],Fe)
em.update()
ember=link(bpy.data.objects.new("DragonEmberCracks",em))
col_flat(em,(1.0,0.3,0.05)); set_mat(ember, EMBER)

# =====================================================================
# PART E — remaining meshes: materials + "Col" on EVERY mesh
# =====================================================================
def treat_scaled(o, cell=0.26, amp=0.018, dark=0.85, gold=0.45, seed=41):
    """give a limb/arm mesh real cellular scale relief + crimson-gold colour so
    it matches the body instead of reading as smooth plastic (idempotent)."""
    d=o.data
    if "s4_base" not in d.attributes:
        a=d.attributes.new("s4_base",'FLOAT_VECTOR','POINT')
        a.data.foreach_set("vector", get_np(d).ravel())
    else:
        a=d.attributes["s4_base"]; buf=np.empty(len(d.vertices)*3)
        a.data.foreach_get("vector",buf); set_np(d, buf.reshape(-1,3))
    Vl=get_np(d); Nl=vnormals(d)
    f1,f2=worley(Vl,cell,seed=seed)
    dp,en=plate_disp(f1,f2,cell,0.18)
    set_np(d, Vl+Nl*(amp*dp)[:,None])
    c=np.tile(CRIMSON*dark,(len(d.vertices),1))
    c=lerp(c, OXBLOOD, np.clip(Nl[:,2],0,1)*0.85)
    gw=np.exp(-((en-0.20)/0.09)**2)
    c=lerp(c, GOLD, np.clip(gw*gold,0,1))
    mn=vnoise(Vl,cell*3,seed=seed+1); c*=(0.86+0.22*mn)[:,None]
    set_col(d, c); set_mat(o, BODY)

for o in sc.objects:
    if o.type!='MESH' or o.name=="GroundPlane": continue
    nm=o.name; d=o.data
    if nm in ("DragonBody","DragonHead","DragonSpineSpikes","DragonEmberCracks"): continue
    if nm.startswith(("DragonThigh","DragonKnee","DragonShin","DragonAnkle",
                      "DragonMeta","DragonFoot","DragonToe")):
        treat_scaled(o, cell=0.22, amp=0.030, dark=0.70, gold=0.38)   # scaled hind legs
    elif nm.startswith("DragonWingArm"):
        treat_scaled(o, cell=0.28, amp=0.024, dark=0.68, gold=0.32, seed=57)  # scaled arm/hand
    elif nm.startswith(("DragonHorn","DragonChinSpike","DragonClaw")):
        col_gradient(d, SMOKE, BONE); set_mat(o, HORN)
    elif nm.startswith(("DragonToothU","DragonToothL","DragonTooth")):
        col_flat(d, IVORY); set_mat(o, TEETH)
    elif nm.startswith("DragonWingMembrane"):
        Vm=get_np(d); outer=np.clip((Vm[:,2]-1.0)/5.0,0,1)
        mc=np.outer(1-outer,MEMDARK)+np.outer(outer,MEMLIT)
        mn=vnoise(Vm,0.7,seed=3); mc*=(0.85+0.3*mn)[:,None]
        set_col(d, mc); set_mat(o, MEMB)
    elif nm.startswith("DragonEye"):
        col_flat(d,(1,1,1))                                           # neutral; keep CAO_DragonEye
    elif nm.startswith("DragonPupil"):
        col_flat(d,(0.02,0.015,0.01))

# =====================================================================
# PART F — preview-only lighting: warm gold key from below-front + cool rim
# =====================================================================
for nm in ("Key","Fill","Rim"):
    L=sc.objects.get(nm)
    if L: L.hide_render=True
def add_light(name, kind, energy, size, loc, color, target):
    l=bpy.data.lights.new(name,kind); l.energy=energy
    if kind=='AREA': l.size=size
    l.color=color
    ob=link(bpy.data.objects.new(name,l)); ob.location=loc
    ob.constraints.new('TRACK_TO').target=target
    return ob
tgt=sc.objects["CamTarget"]
add_light("S4WarmKey",'AREA',4000,7,(9,-13,5),(1.0,0.90,0.78),tgt)    # warm key, low-front
add_light("S4WarmBounce",'AREA',1500,10,(0,-9,-2),(1.0,0.58,0.26),tgt)# gold hoard bounce from below
add_light("S4RimCool",'AREA',3600,5,(-8,11,10),(0.52,0.66,1.0),tgt)   # cool rim
add_light("S4Fill",'AREA',500,12,(-11,-6,5),(0.66,0.68,0.82),tgt)

# =====================================================================
# PART G — renders (side, front 3/4, head close-up, low hoard-glow)
# =====================================================================
bpy.context.view_layer.update()
cam=sc.objects["DragonCam"]; sc.camera=cam
sc.view_settings.view_transform='Standard'
try: sc.eevee.use_bloom=True
except Exception: pass
tgt.location=(0,0.6,3.2)
sc.render.resolution_x=1100; sc.render.resolution_y=800
cam.location=(24.0,0.6,4.2)
sc.render.filepath=SCRATCH+"/dragon_s4_side.png"; bpy.ops.render.render(write_still=True)
cam.location=(15.0,-13.5,5.6)
sc.render.filepath=SCRATCH+"/dragon_s4_front34.png"; bpy.ops.render.render(write_still=True)
# head close-up
tgt.location=(0,-5.9,5.4); cam.location=(6.0,-11.5,5.7)
sc.render.filepath=SCRATCH+"/dragon_s4_head.png"; bpy.ops.render.render(write_still=True)
# low-angle hoard glow (camera below, looking up at the lit chest)
tgt.location=(0,-1.6,2.6); cam.location=(11.0,-12.5,0.7)
sc.render.filepath=SCRATCH+"/dragon_s4_hoard.png"; bpy.ops.render.render(write_still=True)

nt=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in sc.objects if o.type=='MESH' and o.name!="GroundPlane")
mats=[m.name for m in bpy.data.materials if m.name.startswith(("CAO_Dragon","DragonPupil"))]
result={"stage":4,"tris_total":nt,
        "body_tris":sum(len(p.vertices)-2 for p in me.polygons),
        "n_spikes":len(ys),"n_ember":len(Fe),
        "materials":sorted(set(mats)),
        "col_on_all":all(("Col" in [c.name for c in o.data.color_attributes])
                          for o in sc.objects if o.type=='MESH' and o.name!="GroundPlane")}


# ============ STAGE 4b: polish ============
# Orchestrator fixes on Stage 4:
#   1. PALETTE: deep blood-crimson body (value down ~25%, hue to red); gold kept
#      ONLY on scale rims + belly. Verified under a NEUTRAL light render.
#   2. WING-ARM BONES: darker to match the body, stronger cellular relief so
#      they read scaled hide over bone (not copper pipes); membranes darker.
#   3. HORNS/TEETH/SPIKES: charcoal-brown base -> smoke-horn tip gradient,
#      roughness 0.5; teeth = aged ivory with darker roots.
#   4. EMBER: wider/deeper recessed cells (sternum cluster), emission raised so
#      it reads in a dim scene, extra small cracks up the throat underside;
#      proven with a dark low-angle render (dragon_s4b_ember.png).
#   + neck scale cells stretched horizontally (row-like overlapping hint).
# Idempotent: restores every mesh from its stored "s4_base" before re-displacing.
import bpy, math, bmesh
import numpy as np
from mathutils import Vector, Euler

SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/5dc3834d-80e3-46f6-8b76-b0308daa5ca3/scratchpad"
sc = bpy.data.scenes.get("DragonBuild")
bpy.context.window.scene = sc

def link(o):
    sc.collection.objects.link(o); return o
def get_np(me):
    n=len(me.vertices); V=np.empty(n*3); me.vertices.foreach_get("co",V); return V.reshape(-1,3)
def set_np(me, V):
    me.vertices.foreach_set("co", V.ravel()); me.update()
def vnormals(me):
    n=len(me.vertices)
    try:
        me.update()
        buf=np.empty(n*3); me.vertex_normals.foreach_get("vector",buf)
        N=buf.reshape(-1,3)
        if np.isfinite(N).all() and np.abs(N).sum()>0: return N
    except Exception:
        pass
    V=get_np(me); N=np.zeros((n,3))
    for p in me.polygons:
        vs=list(p.vertices); nml=np.zeros(3)
        for k in range(len(vs)):
            a=V[vs[k]]; b=V[vs[(k+1)%len(vs)]]
            nml+=np.cross(a,b)
        for vi in vs: N[vi]+=nml
    ln=np.linalg.norm(N,axis=1,keepdims=True); ln[ln<1e-9]=1
    return N/ln

def _hash3(ix, iy, iz, seed):
    ix=ix.astype(np.uint64); iy=iy.astype(np.uint64); iz=iz.astype(np.uint64)
    h=(ix*np.uint64(73856093))^(iy*np.uint64(19349663))^(iz*np.uint64(83492791))^np.uint64(seed*2654435761)
    def frac(mult):
        v=(h*np.uint64(mult))>>np.uint64(11)
        return (v & np.uint64(0x1FFFFF)).astype(np.float64)/2097152.0
    return frac(0x9E3779B1), frac(0x85EBCA77), frac(0xC2B2AE3D)
def worley(P, cell, seed=0):
    Pc=P/cell; g=np.floor(Pc).astype(np.int64); n=len(P)
    F1=np.full(n,1e18); F2=np.full(n,1e18)
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            for dz in (-1,0,1):
                cx=g[:,0]+dx; cy=g[:,1]+dy; cz=g[:,2]+dz
                jx,jy,jz=_hash3(cx,cy,cz,seed)
                fx=(cx+jx)-Pc[:,0]; fy=(cy+jy)-Pc[:,1]; fz=(cz+jz)-Pc[:,2]
                d=fx*fx+fy*fy+fz*fz
                closer=d<F1
                F2=np.where(closer,F1,np.minimum(F2,d))
                F1=np.where(closer,d,F1)
    return np.sqrt(F1)*cell, np.sqrt(F2)*cell
def vnoise(P, cell, seed=0):
    f1,_=worley(P,cell,seed)
    return np.clip(f1/cell,0,1)
def plate_disp(f1,f2,cell,groove):
    e=f2-f1
    en=np.clip(e/(0.55*cell),0,1)
    face=(en-0.42)
    crease=np.exp(-(e/(groove*cell))**2)
    return face-0.9*crease, en
def lerp(a,b,t):
    t=np.clip(t,0,1)[:,None] if np.ndim(t) else t
    return a*(1-t)+b*t

# ---------- Stage-4b palette: DEEP blood-crimson, gold rims only ----------
CRIMSON = np.array([0.125,0.0125,0.010])
OXBLOOD = np.array([0.040,0.0060,0.0055])
GOLD    = np.array([0.62,0.275,0.036])
CREAM   = np.array([0.52,0.345,0.165])
SCARCOL = np.array([0.032,0.007,0.006])
CHARCOAL= np.array([0.028,0.022,0.017])   # horn/spike base (charcoal-brown)
SMOKEH  = np.array([0.185,0.155,0.120])   # horn/spike tip (smoke-horn, kept dark)
IVORY_T = np.array([0.66,0.575,0.42])     # aged ivory tooth tip
IVORY_R = np.array([0.26,0.205,0.135])    # darker tooth root
MEMDARK = np.array([0.085,0.013,0.012])
MEMLIT  = np.array([0.26,0.062,0.026])

def set_col(me, cols):
    ca=me.color_attributes
    ex=ca.get("Col")
    if ex: ca.remove(ex)
    at=ca.new(name="Col", type='FLOAT_COLOR', domain='POINT')
    n=len(me.vertices)
    rgba=np.ones((n,4)); rgba[:,:3]=np.clip(cols,0,1)
    at.data.foreach_set("color", rgba.ravel())
    for nm in ("active_color_name","render_color_name"):
        try: setattr(ca, nm, "Col")
        except Exception: pass
    me.update()
def col_flat(me, rgb):
    set_col(me, np.tile(np.array(rgb),(len(me.vertices),1)))
def col_gradient(me, root_rgb, tip_rgb):
    V=get_np(me); ext=V.max(0)-V.min(0); ax=int(np.argmax(ext))
    t=(V[:,ax]-V[:,ax].min())/max(ext[ax],1e-6)
    o=[i for i in range(3) if i!=ax]
    lo_m=t<0.25; hi_m=t>0.75
    def spread(m):
        if m.sum()<3: return 0
        return float(V[m][:,o].std())
    if spread(hi_m)>spread(lo_m): t=1-t
    set_col(me, np.outer(1-t,np.array(root_rgb))+np.outer(t,np.array(tip_rgb)))

# ---------- material factor tweaks (names/graph unchanged, export-safe) ----------
def _pr(name): return bpy.data.materials[name].node_tree.nodes["Principled BSDF"]
b=_pr("CAO_DragonBody");  b.inputs["Roughness"].default_value=0.58; b.inputs["Metallic"].default_value=0.12
b=_pr("CAO_DragonHorn");  b.inputs["Roughness"].default_value=0.50; b.inputs["Metallic"].default_value=0.03
b=_pr("CAO_DragonTeeth"); b.inputs["Roughness"].default_value=0.42
b=_pr("CAO_DragonMembrane"); b.inputs["Roughness"].default_value=0.56
b.inputs["Emission Strength"].default_value=0.12
b=_pr("CAO_DragonEmber")
b.inputs["Emission Color"].default_value=(1.0,0.22,0.025,1)
b.inputs["Emission Strength"].default_value=16.0
BODY = bpy.data.materials["CAO_DragonBody"];  HORN = bpy.data.materials["CAO_DragonHorn"]
TEETH= bpy.data.materials["CAO_DragonTeeth"]; MEMB = bpy.data.materials["CAO_DragonMembrane"]
EMBER= bpy.data.materials["CAO_DragonEmber"]
def set_mat(ob, mat):
    ob.data.materials.clear(); ob.data.materials.append(mat)

ZSHIFT=0.066
SPINE_CP = [
    (0.00,-5.30,5.40,0.09,1.00),(0.00,-5.18,5.46,0.24,1.02),(0.00,-4.98,5.55,0.31,1.05),
    (0.00,-4.50,5.65,0.38,1.08),(0.00,-3.85,5.28,0.42,1.12),(0.00,-3.45,4.30,0.46,1.12),
    (0.00,-3.35,3.30,0.50,1.08),(0.00,-2.95,2.65,0.56,1.05),(0.00,-2.25,2.75,0.64,1.03),
    (0.00,-1.40,2.95,0.90,1.05),(0.00,-0.20,2.80,1.00,1.08),(0.00, 1.20,2.60,0.78,1.00),
    (0.20, 2.90,1.85,0.52,1.00),(-0.45,4.50,1.15,0.36,1.00),(0.45, 6.00,0.62,0.22,1.00),
    (-0.30,7.35,0.36,0.12,1.00),(0.05, 8.60,0.28,0.03,1.00),
]
def catmull_rom(pts, samples):
    P=np.array(pts,float); P=np.vstack([P[0]+(P[0]-P[1]),P,P[-1]+(P[-1]-P[-2])])
    nseg=len(P)-3; out=np.empty((samples,P.shape[1]))
    for i,t in enumerate(np.linspace(0,nseg,samples,endpoint=True)):
        seg=min(int(t),nseg-1); u=t-seg; p0,p1,p2,p3=P[seg],P[seg+1],P[seg+2],P[seg+3]
        out[i]=0.5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u**3)
    return out
spine=catmull_rom(SPINE_CP,220)[:,:3]

# =====================================================================
# PART A — body: re-displace (row-stretched neck cells) + DEEP crimson repaint
# =====================================================================
body=sc.objects["DragonBody"]; me=body.data
a=me.attributes["s4_base"]; buf=np.empty(len(me.vertices)*3)
a.data.foreach_get("vector",buf); set_np(me, buf.reshape(-1,3))
V=get_np(me); N=vnormals(me)
Nz=N[:,2]; y=V[:,1]; z=V[:,2]
Pw=V.copy(); Pw[:,2]+=ZSHIFT
spine_z=np.interp(y, spine[:,1], spine[:,2])
# proper spine-frame ventral mask: the neck rises near-vertically, so its
# ventral (throat) surface faces -Y, not -Z — build the local "up" along the
# spine (Stage-1 frame) and test the vertex normal against LOCAL down.
Tsp=np.gradient(spine,axis=0); Tsp/=np.linalg.norm(Tsp,axis=1,keepdims=True)
Zg=np.array([0.0,0.0,1.0])
sd=np.cross(np.broadcast_to(Zg,Tsp.shape),Tsp); sd/=np.linalg.norm(sd,axis=1,keepdims=True)
upv=np.cross(Tsp,sd); upv/=np.linalg.norm(upv,axis=1,keepdims=True)
up_x=np.interp(y,spine[:,1],upv[:,0]); up_y=np.interp(y,spine[:,1],upv[:,1])
up_z=np.interp(y,spine[:,1],upv[:,2])
vent=np.clip(-(N[:,0]*up_x+N[:,1]*up_y+N[:,2]*up_z),0,1)   # 1 = faces local-down
belly_w=vent**2.2                                          # tight ventral band, sides stay crimson
belly_w*=np.clip((2.4-y)/0.9,0,1)*np.clip((y+4.9)/0.9,0,1)
belly_w=np.clip(belly_w,0,1)
plate_w=1.0-belly_w
neck_w =np.clip((-2.15-y)/1.1,0,1)
tail_w =np.clip((y-1.6)/1.2,0,1)
f1c,f2c=worley(Pw,0.46,seed=11)
# neck cells: compress the grid vertically -> cells wider than tall (scale rows)
Pn=Pw*np.array([1.0,1.0,2.4])
f1n,f2n=worley(Pn,0.30,seed=23)
dispC,enC=plate_disp(f1c,f2c,0.46,0.16)
dispN,enN=plate_disp(f1n,f2n,0.30,0.18)
amp_plate=0.060*(1-0.55*tail_w)
disp_plate=amp_plate*(dispN*neck_w + dispC*(1-neck_w))
en_plate=enN*neck_w + enC*(1-neck_w)
band=y/0.50; frac=band-np.floor(band)
tri=np.clip(1.0-np.abs(frac-0.40)/0.55,0,1)
disp_belly=0.090*(tri-0.32)
pc=np.array([0.66,-1.95,2.15-ZSHIFT]); pr=np.array([0.34,0.42,0.30])
patch=np.exp(-(((V-pc)/pr)**2).sum(1)*1.4)
disp=disp_plate*plate_w + disp_belly*belly_w - 0.045*patch
set_np(me, V+N*disp[:,None])
# repaint: deep crimson, oxblood back, gold ONLY on rims + belly
col=np.tile(CRIMSON,(len(me.vertices),1))
col=lerp(col, OXBLOOD, np.clip(Nz,0,1)*0.9)
col=lerp(col, CREAM, np.clip(belly_w*(0.65+tri*0.5),0,1))
col=lerp(col, CREAM*0.40, np.clip(belly_w*(1-tri)*0.55,0,1))
gold_w=plate_w*np.exp(-((en_plate-0.20)/0.085)**2)*(1-patch)
gold_w*=np.clip(1.0-belly_w*1.3,0,1)*(1.0-0.5*neck_w)     # less gold wash on the neck
col=lerp(col, GOLD, np.clip(gold_w*0.40,0,1))
mott=vnoise(Pw,0.9,seed=7); col*=(0.86+0.22*mott)[:,None]
for (sx,sy,sz,rr) in [(-0.55,-0.6,3.4,(0.10,0.55,0.30)),
                      (0.7,0.7,2.6,(0.09,0.45,0.55)),
                      (-0.3,-2.3,3.4,(0.07,0.30,0.30))]:
    scw=np.exp(-(((V-np.array([sx,sy,sz-ZSHIFT]))/np.array(rr))**2).sum(1)*1.6)
    col=lerp(col, SCARCOL, scw*0.7)
col=lerp(col, OXBLOOD*0.7+np.array([0.015,0,0]), patch*0.85)
set_col(me, col)

# =====================================================================
# PART B — head: repaint deep crimson (displacement from Stage 4 kept)
# =====================================================================
head=sc.objects["DragonHead"]; hme=head.data
a=hme.attributes["s4_base"]; buf=np.empty(len(hme.vertices)*3)
a.data.foreach_get("vector",buf); set_np(hme, buf.reshape(-1,3))
Hv=get_np(hme); Hn=vnormals(hme)
hy,hz=Hv[:,1],Hv[:,2]
flesh=np.clip((-0.55-hy)/0.35,0,1)
eye_m=np.exp(-(((Hv-np.array([-0.25,-0.20,0.0]))/np.array([0.14,0.14,0.13]))**2).sum(1)*1.2)
eye_m+=np.exp(-(((Hv-np.array([0.25,-0.20,0.0]))/np.array([0.14,0.14,0.13]))**2).sum(1)*1.2)
lip=np.exp(-((hz+0.10)/0.05)**2)*np.clip((-0.1-hy),0,1)
flesh=np.clip(flesh+eye_m+lip,0,1)
hf1,hf2=worley(Hv,0.24,seed=31)
hdisp,hen=plate_disp(hf1,hf2,0.24,0.18)
set_np(hme, Hv+Hn*(0.022*hdisp*(1-0.85*flesh))[:,None])
hcol=np.tile(CRIMSON,(len(hme.vertices),1))
hcol=lerp(hcol, OXBLOOD, np.clip(Hn[:,2],0,1)*0.75)
hgold=(1-flesh)*np.exp(-((hen-0.24)/0.12)**2)
hcol=lerp(hcol, GOLD, np.clip(hgold*0.45,0,1))
hcol=lerp(hcol, CRIMSON*1.3+np.array([0.02,0,0]), flesh*0.5)
hcol=lerp(hcol, np.array([0.035,0.008,0.007]), np.clip(eye_m+lip,0,1)*0.8)
hmott=vnoise(Hv,0.5,seed=5); hcol*=(0.88+0.22*hmott)[:,None]
set_col(hme, hcol)

# =====================================================================
# PART C — dorsal spikes: recolor charcoal-brown base -> smoke-horn tip
# =====================================================================
sm=sc.objects["DragonSpineSpikes"].data
Vs=get_np(sm)
# per-spike gradient: each spike is a tiny vert cluster; use local z within a
# small neighborhood — cheap proxy: normalize z against a smoothed local base
zc=Vs[:,2]
# spikes were emitted base-ring(6)+tip+cap sequentially: rebuild t per 8-vert block
tS=np.zeros(len(Vs))
for b0 in range(0,len(Vs),8):
    blk=Vs[b0:b0+8]
    zmin=blk[:,2].min(); zmax=blk[:,2].max()
    tS[b0:b0+8]=(blk[:,2]-zmin)/max(zmax-zmin,1e-6)
set_col(sm, np.outer(1-tS,CHARCOAL)+np.outer(tS,SMOKEH))

# =====================================================================
# PART D — EMBER rebuild: wider recessed cells, sternum cluster + throat cracks
# =====================================================================
for o in list(sc.objects):
    if o.name.startswith("DragonEmber"):
        bpy.data.objects.remove(o, do_unlink=True)
Vb2=get_np(me); Nb2=vnormals(me)
def ventral_point(ty):
    m=(np.abs(Vb2[:,1]-ty)<0.14)&(Nb2[:,2]<-0.25)&(np.abs(Vb2[:,0])<0.30)
    if m.sum()<3:
        m=(np.abs(Vb2[:,1]-ty)<0.26)&(Nb2[:,2]<-0.1)
    if m.sum()==0: return None,None
    sub=Vb2[m]; sn=Nb2[m]; k=np.argmin(sub[:,2]); return sub[k],sn[k]
Ve=[]; Fe=[]
_erng=np.random.default_rng(3)
def ember_cell(c,n,halfx,halfy,jx=0.05):
    c=np.array(c,float); n=np.array(n,float); n/=np.linalg.norm(n)
    up=np.array([0,0,1.0]); xc=np.cross(n,up)
    if np.linalg.norm(xc)<1e-4: xc=np.array([1.0,0,0])
    xc/=np.linalg.norm(xc); yc=np.cross(n,xc)
    c=c+n*0.012+xc*(_erng.random()-0.5)*jx
    b0=len(Ve)
    for sxx,syy in ((-1,-1),(1,-1),(1,1),(-1,1)):
        Ve.append(c+sxx*halfx*xc+syy*halfy*yc)
    Fe.append((b0,b0+1,b0+2,b0+3))
# sternum cluster: big wide gaps chest -> mid-belly (deepest glow)
for ty in np.arange(-2.6,-0.9,0.24):
    p,n=ventral_point(ty)
    if p is None: continue
    p=p.copy(); p[2]+=ZSHIFT
    s=np.clip(1.0-(abs(ty+1.7)/1.6),0.45,1.0)
    ember_cell(p,n, halfx=0.34*s, halfy=0.11*s)
    # paired side embers flanking the midline gap (wider glowing seam)
    if s>0.7:
        for sx in (-1,1):
            q=p+np.array([sx*0.22,0.10,0.06])
            ember_cell(q,n, halfx=0.13*s, halfy=0.07*s, jx=0.02)
# throat cracks: 3 small cells fading up the underside of the neck
for ty in (-3.1,-3.6,-4.1):
    p,n=ventral_point(ty)
    if p is None: continue
    p=p.copy(); p[2]+=ZSHIFT
    s=np.clip(1.0-(abs(ty+1.7)/3.2),0.20,1.0)
    ember_cell(p,n, halfx=0.16*s, halfy=0.06*s, jx=0.03)
em=bpy.data.meshes.new("DragonEmberCracks")
em.from_pydata([list(v) for v in Ve],[],Fe)
em.update()
ember=link(bpy.data.objects.new("DragonEmberCracks",em))
col_flat(em,(1.0,0.28,0.04)); set_mat(ember, EMBER)

# =====================================================================
# PART E — limbs/wing-arms stronger relief + darker; horns/teeth/membranes
# =====================================================================
def treat_scaled(o, cell, amp, dark, gold, seed):
    d=o.data
    a=d.attributes.get("s4_base")
    if a is None:
        a=d.attributes.new("s4_base",'FLOAT_VECTOR','POINT')
        a.data.foreach_set("vector", get_np(d).ravel())
    else:
        buf=np.empty(len(d.vertices)*3)
        a.data.foreach_get("vector",buf); set_np(d, buf.reshape(-1,3))
    Vl=get_np(d); Nl=vnormals(d)
    f1,f2=worley(Vl,cell,seed=seed)
    dp,en=plate_disp(f1,f2,cell,0.18)
    set_np(d, Vl+Nl*(amp*dp)[:,None])
    c=np.tile(CRIMSON*dark,(len(d.vertices),1))
    c=lerp(c, OXBLOOD, np.clip(Nl[:,2],0,1)*0.85)
    gw=np.exp(-((en-0.20)/0.09)**2)
    c=lerp(c, GOLD, np.clip(gw*gold,0,1))
    mn=vnoise(Vl,cell*3,seed=seed+1); c*=(0.84+0.24*mn)[:,None]
    set_col(d, c); set_mat(o, BODY)

for o in sc.objects:
    if o.type!='MESH' or o.name=="GroundPlane": continue
    nm=o.name; d=o.data
    if nm.startswith(("DragonThigh","DragonKnee","DragonShin","DragonAnkle",
                      "DragonMeta","DragonFoot","DragonToe")):
        treat_scaled(o, cell=0.26, amp=0.052, dark=0.72, gold=0.22, seed=41)
    elif nm.startswith("DragonWingArm"):
        # coarse tube mesh: LARGER cells so the relief actually resolves
        treat_scaled(o, cell=0.34, amp=0.058, dark=0.65, gold=0.18, seed=57)
    elif nm.startswith(("DragonHorn","DragonChinSpike","DragonClaw")):
        col_gradient(d, CHARCOAL, SMOKEH); set_mat(o, HORN)
    elif nm.startswith(("DragonToothU","DragonToothL","DragonTooth")):
        col_gradient(d, IVORY_R, IVORY_T); set_mat(o, TEETH)
    elif nm.startswith("DragonWingMembrane"):
        Vm=get_np(d); outer=np.clip((Vm[:,2]-1.0)/5.0,0,1)
        mc=np.outer(1-outer,MEMDARK)+np.outer(outer,MEMLIT)
        mn=vnoise(Vm,0.7,seed=3); mc*=(0.82+0.30*mn)[:,None]
        set_col(d, mc); set_mat(o, MEMB)

# =====================================================================
# PART F — renders: NEUTRAL side (palette check), warm front34 + head,
#                   DARK low-angle ember-proof shot
# =====================================================================
bpy.context.view_layer.update()
cam=sc.objects["DragonCam"]; tgt=sc.objects["CamTarget"]; sc.camera=cam
sc.view_settings.view_transform='Standard'
sc.render.resolution_x=1100; sc.render.resolution_y=800
S4L={nm:sc.objects[nm] for nm in ("S4WarmKey","S4WarmBounce","S4RimCool","S4Fill") if nm in sc.objects}
_save={nm:(tuple(L.data.color),L.data.energy) for nm,L in S4L.items()}
def lights(mode):
    for nm,L in S4L.items():
        col,en=_save[nm]
        if mode=="neutral": L.data.color=(1.0,1.0,1.0); L.data.energy=en
        elif mode=="warm":  L.data.color=col;           L.data.energy=en
        elif mode=="dark":  L.data.color=col;           L.data.energy=en*0.045
# 1. neutral-light side (palette verification)
lights("neutral")
tgt.location=(0,0.6,3.2); cam.location=(24.0,0.6,4.2)
sc.render.filepath=SCRATCH+"/dragon_s4b_side.png"; bpy.ops.render.render(write_still=True)
# 2-3. warm hero shots
lights("warm")
cam.location=(15.0,-13.5,5.6)
sc.render.filepath=SCRATCH+"/dragon_s4b_front34.png"; bpy.ops.render.render(write_still=True)
tgt.location=(0,-5.9,5.4); cam.location=(6.0,-11.5,5.7)
sc.render.filepath=SCRATCH+"/dragon_s4b_head.png"; bpy.ops.render.render(write_still=True)
# 4. DARK low-angle ember proof (near-black scene; the glow must carry it)
lights("dark")
tgt.location=(0,-1.9,2.3); cam.location=(9.0,-11.0,0.6)
sc.render.filepath=SCRATCH+"/dragon_s4b_ember.png"; bpy.ops.render.render(write_still=True)
lights("warm")

nt=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in sc.objects if o.type=='MESH' and o.name!="GroundPlane")
result={"stage":"4b","tris_total":nt,"n_ember_cells":len(Fe),
        "col_on_all":all(("Col" in [c.name for c in o.data.color_attributes])
                          for o in sc.objects if o.type=='MESH' and o.name!="GroundPlane")}

# ============ STAGE 5: pivots + export ============
# Self-contained (orc_build.py STAGE 3 style): runs against the already-built
# "DragonBuild" scene. Adds the game-contract pivot empties, parents meshes to
# the nearest sensible pivot, and exports the dragon-only selection to
# public/assets/models/dragon.glb. Post-check confirms feet at z~0 + tri count.
#
# PIVOT / PARENT CONTRACT (mirrors orc rig style — code rotates these by name):
#   BodyPivot (root) -> { NeckPivot -> HeadPivot -> JawPivot, WingL, WingR, TailPivot }
#   head+horns+teeth+eyes -> HeadPivot ; wing arm+membrane -> WingL/R ;
#   body loft (carries the tail), spine spikes, embers, legs/feet -> BodyPivot.
#   JawPivot has no geometry yet (jaw is part of the loft) — placed for future use.
#   Materials CAO_DragonEmber / CAO_DragonEye keep exact names (code coupling);
#   vertex color exports as COLOR_0, membrane alpha-blend + double-sided survive,
#   emissive strengths ride out via KHR_materials_emissive_strength.
import bpy, os
import numpy as np
from mathutils import Vector

OUT = "/Users/davideghiotto/Desktop/projects/claude-art-online/public/assets/models/dragon.glb"
sc = bpy.data.scenes["DragonBuild"]
bpy.context.window.scene = sc

# non-dragon helpers that must NOT export (cameras / lights / targets / ground)
SKIP = {"GroundPlane", "DragonCam", "HeadCam", "CamTarget", "HeadTarget",
        "Key", "Fill", "Rim", "S4Fill", "S4WarmKey", "S4WarmBounce",
        "S4RimCool"}
def skipped(o):
    return o.name.split('.')[0] in SKIP or o.type in ('LIGHT', 'CAMERA', 'EMPTY')

# ---- pivots (game contract: rotate these by exact name) ----
def pivot(name, loc):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.location = loc
    e.empty_display_size = 0.4
    return e

def reparent(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()

# wing-root side from actual geometry, so WingL sits on the WingArmL mesh side
def cx(name):
    o = sc.objects[name]; V = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", V); V = V.reshape(-1, 3)
    return float((np.c_[V, np.ones(len(V))] @ np.array(o.matrix_world).T)[:, 0].mean())
sL = 1.0 if cx("DragonWingArmL") >= 0 else -1.0
sR = -sL

bodyP = pivot("BodyPivot", (0.0, -0.50, 3.20))   # body centre of mass (loft centroid)
neckP = pivot("NeckPivot", (0.0, -2.00, 3.90))   # neck root, leaving the shoulders
headP = pivot("HeadPivot", (0.0, -5.00, 5.40))   # skull base (rear of head)
jawP  = pivot("JawPivot",  (0.0, -5.05, 5.20))   # jaw hinge (no geo yet; future handle)
wingL = pivot("WingL", (sL * 0.55, -1.35, 3.30))
wingR = pivot("WingR", (sR * 0.55, -1.35, 3.30))
tailP = pivot("TailPivot", (0.0, 2.20, 2.90))    # tail root, behind the hips
bpy.context.view_layer.update()  # empties just created: world matrix is stale

# ---- parent meshes to nearest sensible pivot ----
HEAD_PRE = ("DragonHead", "DragonEye", "DragonPupil", "DragonTooth",
            "DragonChinSpike", "DragonHorn")
for o in list(sc.objects):
    if o.type != 'MESH' or skipped(o):
        continue
    nm = o.name
    if nm.startswith("DragonWingArmL") or nm.startswith("DragonWingMembraneL"):
        reparent(o, wingL)
    elif nm.startswith("DragonWingArmR") or nm.startswith("DragonWingMembraneR"):
        reparent(o, wingR)
    elif nm.startswith(HEAD_PRE):
        reparent(o, headP)
    else:  # body loft (holds the tail), spine spikes, embers, legs/feet -> body
        reparent(o, bodyP)

# ---- empty hierarchy: BodyPivot -> {NeckPivot -> HeadPivot -> JawPivot, WingL, WingR, TailPivot}
reparent(jawP, headP)
reparent(headP, neckP)
reparent(neckP, bodyP)
reparent(wingL, bodyP)
reparent(wingR, bodyP)
reparent(tailP, bodyP)
bpy.context.view_layer.update()

# ---- make the "Col" color attribute active+render on every mesh so it exports as COLOR_0
for o in sc.objects:
    if o.type != 'MESH' or skipped(o):
        continue
    ca = o.data.color_attributes
    idx = next((i for i, a in enumerate(ca) if a.name == "Col"), None)
    if idx is not None:
        ca.active_color_index = idx
        ca.render_color_index = idx

# ---- export dragon meshes + pivots only ----
for o in sc.objects:
    o.select_set(False)
sel = []
for o in sc.objects:
    keep = (o.type == 'MESH' and not skipped(o)) or o.name in {
        "BodyPivot", "NeckPivot", "HeadPivot", "JawPivot", "WingL", "WingR", "TailPivot"}
    o.select_set(keep)
    if keep:
        sel.append(o)
with bpy.context.temp_override(scene=sc, selected_objects=sel,
                               active_object=bodyP, object=bodyP):
    bpy.ops.export_scene.gltf(
        filepath=OUT, use_selection=True, export_format='GLB',
        export_apply=False, export_yup=True,
        export_materials='EXPORT', export_normals=True)

# ---- post-check: feet at z~0, tri count, file size ----
bpy.context.view_layer.update()
zs = []
tris = 0
for o in sc.objects:
    if o.type != 'MESH' or skipped(o):
        continue
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    for c in o.bound_box:
        zs.append((o.matrix_world @ Vector(c)).z)
result = {"stage": "5", "file": OUT,
          "size_mb": round(os.path.getsize(OUT) / 1048576, 2),
          "tris": tris, "ground_min_z": round(min(zs), 3),
          "top_z": round(max(zs), 3), "n_selected": len(sel),
          "wingL_x": round(sL * 0.55, 2), "wingR_x": round(sR * 0.55, 2),
          "pivots": {p.name: [round(v, 2) for v in p.matrix_world.translation]
                     for p in (bodyP, neckP, headP, jawP, wingL, wingR, tailP)}}
