# Parametric low-poly townsfolk builder for Claude Art Online.
# Flat-shaded, flat-color materials, no textures (VISION.md). Feet at z=0, centered
# on x/y so the GLB origin grounds via terrainHeight(). ~1.75 Blender units tall
# (≈ knight scale, so NPC_MODELS scale ≈ 1).
#
# MODE = 'preview'  -> build all in a row, render a contact sheet PNG
# MODE = 'export'   -> build each at origin, export GLB to public/assets/models/npc/
import os, math, mathutils

MODE = globals().get('MODE', 'preview')
SCRATCH = "/private/tmp/claude-501/-Users-davideghiotto-Desktop-projects-claude-art-online/a99661af-b7a3-40bd-872f-f21d06578502/scratchpad"
OUTDIR = "/Users/davideghiotto/Desktop/projects/claude-art-online/public/assets/models/npc"

# ---- palette (linear-ish sRGB floats) ----
SKIN  = {'light':(0.95,0.78,0.63),'tan':(0.88,0.69,0.52),'olive':(0.78,0.55,0.37),'brown':(0.55,0.36,0.24)}
HAIR  = {'black':(0.10,0.09,0.08),'brown':(0.34,0.21,0.12),'blonde':(0.80,0.62,0.32),'gray':(0.74,0.73,0.69),'red':(0.55,0.27,0.15)}

_mats = {}
def mat(rgb):
    key = tuple(round(c,3) for c in rgb)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new("m_%.2f_%.2f_%.2f" % key); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = 1.0
    if "Metallic" in b.inputs: b.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0.1
    _mats[key] = m; return m

def _finish(o, m):
    o.data.materials.append(m)
    return o

def cyl(r1, r2, h, z, m, verts=10):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, location=(0,0,z))
    return _finish(bpy.context.object, m)

def tube(r, h, z, m, verts=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(0,0,z))
    return _finish(bpy.context.object, m)

def box(sx, sy, sz, loc, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.scale = (sx, sy, sz)
    return _finish(o, m)

def ico(r, z, m, sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=(0,0,z))
    return _finish(bpy.context.object, m)

def build_person(cfg):
    parts = []
    skin = mat(cfg['skin']); tunic = mat(cfg['tunic'])
    tb = cfg.get('torso', 0.17)          # torso half-width (shoulders)
    # ---- lower body ----
    if cfg.get('robe'):
        parts.append(cyl(0.33, 0.15, 1.04, 0.52, tunic, verts=12))     # skirt/gown cone
    else:
        for s in (-1, 1):
            leg = tube(0.105, 0.92, 0.46, mat(cfg.get('legs', (0.22,0.18,0.15))))
            leg.location.x = s*0.10; parts.append(leg)
        for s in (-1, 1):                                              # shoes
            parts.append(box(0.12, 0.24, 0.1, (s*0.10, 0.06, 0.05), mat((0.2,0.15,0.11))))
    # ---- torso: near-straight, hips a touch wider than shoulders (no lampshade flare) ----
    parts.append(cyl(tb+0.02, tb-0.01, 0.54, 1.16, tunic, verts=12))
    if cfg.get('belt'):
        parts.append(tube(tb+0.035, 0.09, 0.93, mat((0.22,0.15,0.09)), verts=12))
    if cfg.get('cape'):                                                # wide across back, thin in depth
        cp = box(2*(tb+0.015), 0.03, 0.52, (0, -tb-0.015, 1.17), mat(cfg['cape'])); parts.append(cp)
    # ---- arms: close to the torso, slight outward angle ----
    for s in (-1, 1):
        arm = tube(0.062, 0.5, 1.14, tunic); arm.location.x = s*(tb+0.03)
        arm.rotation_euler = (0, s*0.05, 0); parts.append(arm)
        parts.append(box(0.085, 0.1, 0.12, (s*(tb+0.07), 0, 0.9), skin))  # hand
    # ---- neck + head ----
    parts.append(tube(0.06, 0.1, 1.46, skin, verts=8))
    parts.append(ico(0.135, 1.6, skin))
    parts.append(box(0.045, 0.07, 0.05, (0, 0.13, 1.58), skin))            # nose
    # ---- hair / hat / beard ----
    hs = cfg.get('hair')
    if hs and hs[1] != 'bald':
        hc = mat(hs[0])
        cap = ico(0.145, 1.63, hc); cap.scale = (1, 1, 0.72); parts.append(cap)
        if hs[1] == 'long':
            parts.append(box(0.26, 0.12, 0.34, (0, -0.09, 1.47), hc))
        elif hs[1] == 'bun':
            b = ico(0.08, 1.72, hc); b.location.y = -0.1; parts.append(b)
    if cfg.get('beard'):
        bd = cyl(0.11, 0.02, 0.16, 1.5, mat(cfg.get('beardc', hs[0])), verts=8)
        bd.location.y = 0.08; parts.append(bd)
    hat = cfg.get('hat')
    if hat:
        hc = mat(hat[1])
        if hat[0] == 'cone':
            parts.append(cyl(0.19, 0.02, 0.34, 1.82, hc, verts=10))
        elif hat[0] == 'brim':
            parts.append(tube(0.3, 0.03, 1.72, hc, verts=14))
            parts.append(tube(0.17, 0.2, 1.82, hc, verts=12))
        elif hat[0] == 'scarf':
            sc = ico(0.16, 1.66, hc); sc.scale = (1, 1, 0.9); parts.append(sc)

    # join into one object
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = cfg['name']
    for poly in o.data.polygons: poly.use_smooth = False
    if cfg.get('scale', 1) != 1:
        o.scale = (cfg['scale'],)*3
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o

CONFIGS = [
    {'name':'peasant_man','skin':SKIN['tan'],'tunic':(0.42,0.31,0.22),'hair':(HAIR['brown'],'short'),'beard':True,'belt':True},
    {'name':'peasant_woman','skin':SKIN['light'],'tunic':(0.48,0.23,0.28),'robe':True,'hair':(HAIR['brown'],'long'),'hat':('scarf',(0.54,0.42,0.22))},
    {'name':'elder_man','skin':SKIN['olive'],'tunic':(0.29,0.33,0.28),'hair':(HAIR['gray'],'short'),'beard':True,'beardc':HAIR['gray'],'belt':True,'scale':0.96},
    {'name':'elder_woman','skin':SKIN['light'],'tunic':(0.25,0.25,0.30),'robe':True,'hair':(HAIR['gray'],'bun'),'cape':(0.2,0.2,0.24),'scale':0.93},
    {'name':'merchant','skin':SKIN['tan'],'tunic':(0.22,0.31,0.42),'hair':(HAIR['black'],'short'),'beard':True,'hat':('brim',(0.16,0.16,0.19)),'cape':(0.35,0.22,0.16),'belt':True,'scale':1.03},
    {'name':'noble_woman','skin':SKIN['light'],'tunic':(0.44,0.29,0.42),'robe':True,'hair':(HAIR['blonde'],'long'),'cape':(0.6,0.42,0.63),'torso':0.2,'scale':1.04},
    {'name':'child_boy','skin':SKIN['light'],'tunic':(0.29,0.42,0.23),'hair':(HAIR['brown'],'short'),'scale':0.62},
    {'name':'child_girl','skin':SKIN['light'],'tunic':(0.63,0.31,0.42),'robe':True,'hair':(HAIR['blonde'],'long'),'scale':0.6},
    {'name':'worker','skin':SKIN['brown'],'tunic':(0.54,0.48,0.29),'hair':(HAIR['black'],'bald'),'belt':True,'scale':1.02},
    {'name':'young_woman','skin':SKIN['tan'],'tunic':(0.22,0.44,0.47),'robe':True,'hair':(HAIR['red'],'bun'),'scale':0.98},
    {'name':'young_man','skin':SKIN['tan'],'tunic':(0.48,0.23,0.23),'hair':(HAIR['red'],'short'),'hat':('cone',(0.35,0.29,0.17))},
    {'name':'guard_civ','skin':SKIN['olive'],'tunic':(0.18,0.21,0.26),'hair':(HAIR['black'],'short'),'hat':('brim',(0.14,0.15,0.18)),'belt':True,'scale':1.08},
]

def wipe():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def add_cam_sun(target, dist, height, ortho_scale=None):
    cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    if ortho_scale:                       # fit the whole row, heads-to-feet
        cam_data.type = 'ORTHO'; cam_data.ortho_scale = ortho_scale
        cam.location = (target[0], -10, height)
        d = mathutils.Vector((target[0], 0, height)) - cam.location
    else:
        cam.location = (target[0]+dist*0.55, -dist, height)
        d = mathutils.Vector((target[0], 0, height*0.62)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.camera = cam
    s = bpy.data.lights.new("Sun",'SUN'); s.energy = 3.2
    so = bpy.data.objects.new("Sun", s); bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(52), 0, math.radians(40))
    w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.28,0.30,0.33,1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.6

def render(path, rx, ry):
    sc = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    for want in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH'):
        if want in engines: sc.render.engine = want; break
    sc.render.resolution_x = rx; sc.render.resolution_y = ry
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

if MODE == 'preview':
    wipe()
    n = len(CONFIGS); span = 1.15
    for i, cfg in enumerate(CONFIGS):
        o = build_person(cfg)
        o.location.x = (i - (n-1)/2) * span
    add_cam_sun((0,0,0), dist=0, height=0.95, ortho_scale=span*n + 1.4)
    out = "/Users/davideghiotto/Desktop/projects/claude-art-online/blender/npc_contact.png"
    render(out, 1920, 660)
    result = {"built": [c['name'] for c in CONFIGS], "preview": out, "exists": os.path.exists(out)}

elif MODE == 'export':
    os.makedirs(OUTDIR, exist_ok=True)
    exported = []
    for cfg in CONFIGS:
        wipe()
        o = build_person(cfg)
        bpy.context.scene.cursor.location = (0,0,0)
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        # z-up (blender) -> gltf exporter converts to y-up; feet at origin
        dims = list(o.dimensions)
        path = os.path.join(OUTDIR, cfg['name'] + ".glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True)
        exported.append({"name": cfg['name'], "height": round(dims[2],3), "glb": os.path.basename(path)})
    result = {"exported": exported, "dir": OUTDIR}
