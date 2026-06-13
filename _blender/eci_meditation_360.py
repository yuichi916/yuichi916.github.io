"""森の小屋 360 meditation scene — Cabin in the Hollow.

Kitbash3D Enchanted Interiors GEOMETRY (fireplace, cushion, rocking chair,
lantern, brazier, magical light, books) re-skinned with Dark Fantasy PBR
inside a hand-built warm timber cabin, lit for an intimate night per the
CABIN_MEDITATION_360 style book. Outputs:
  assets/cabin360.jpg    6144x3072 equirectangular (Cycles)
  assets/cabin-still.jpg 2560x1440 perspective fallback / OGP

  blender -b --factory-startup --python eci_meditation_360.py -- preview|final|pano
"""
import bpy, os, sys, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = (ARGV[0] if ARGV else 'preview').lower()

BLEND = r'C:\tmp\blends\eci\kb3d_enchantedinteriors-native.blend'
TEX   = r'P:\CG fanbook\3D assets\KitBash3D - Dark Fantasy\Textures'
OUT   = r'C:\projects\yuichi916.github.io\assets'
TEX_CAP = 2048 if MODE in ('final', 'pano') else 1024
os.makedirs(OUT, exist_ok=True)

# ============================================================ helpers
_img_cache = {}
def load_img(fam, role, noncolor):
    key = (fam, role)
    if key in _img_cache:
        return _img_cache[key]
    path = os.path.join(TEX, f'KB3D_DKF_{fam}_{role}.png')
    img = None
    if os.path.exists(path):
        img = bpy.data.images.load(path, check_existing=True)
        if noncolor:
            img.colorspace_settings.name = 'Non-Color'
        try:
            if max(img.size) > TEX_CAP:
                img.scale(TEX_CAP, TEX_CAP)
        except Exception:
            pass
    _img_cache[key] = img
    return img

def make_pbr(name, fam, mapscale=0.4, rough_add=0.0, base_mult=(1, 1, 1), metal=0.0, normal=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    bsdf = nodes.get('Principled BSDF')
    tc = nodes.new('ShaderNodeTexCoord')
    mp = nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (mapscale,)*3
    links.new(tc.outputs['Object'], mp.inputs['Vector'])
    def teximg(role, noncolor):
        img = load_img(fam, role, noncolor)
        if not img: return None
        n = nodes.new('ShaderNodeTexImage'); n.image = img; n.projection = 'BOX'; n.projection_blend = 0.3
        links.new(mp.outputs['Vector'], n.inputs['Vector'])
        return n
    bc = teximg('basecolor', False)
    if bc:
        mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = (*base_mult, 1)
        links.new(bc.outputs['Color'], mix.inputs[1]); links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    rg = teximg('roughness', True)
    if rg:
        ad = nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; ad.inputs[1].default_value = rough_add
        ad.use_clamp = True
        links.new(rg.outputs['Color'], ad.inputs[0]); links.new(ad.outputs['Value'], bsdf.inputs['Roughness'])
    bsdf.inputs['Metallic'].default_value = metal
    nm = teximg('normal', True)
    if nm:
        nmap = nodes.new('ShaderNodeNormalMap'); nmap.inputs['Strength'].default_value = normal
        links.new(nm.outputs['Color'], nmap.inputs['Color']); links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def make_solid(name, color, rough=0.8, metal=0.0, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Sheen' in b.inputs: b.inputs['Sheen'].default_value = sheen
    return m

def make_emissive(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    return m

def set_mat(obj, mat):
    obj.data.materials.clear(); obj.data.materials.append(mat)

# ============================================================ open + materials
print('[scene] opening blend...', flush=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene

print('[mat] building library...', flush=True)
MAT = {
    'floor': make_pbr('cab_floor', 'PlanksC', mapscale=0.34, base_mult=(0.74, 0.55, 0.38)),
    'wall':  make_pbr('cab_wall',  'FloorA',  mapscale=0.20, base_mult=(0.52, 0.38, 0.26)),
    'ceil':  make_pbr('cab_ceil',  'PlanksD', mapscale=0.30, base_mult=(0.40, 0.30, 0.21)),
    'beam':  make_pbr('cab_beam',  'BeamB',   mapscale=0.22, base_mult=(0.45, 0.33, 0.22)),
    'stone': make_pbr('cab_stone', 'BlocksB', mapscale=0.26, base_mult=(0.66, 0.60, 0.52)),
    'metal': make_pbr('cab_metal', 'MetalA',  mapscale=0.6,  rough_add=0.05, base_mult=(0.42, 0.38, 0.34), metal=1.0),
    'door':  make_pbr('cab_door',  'DoorA',   mapscale=0.5,  base_mult=(0.55, 0.42, 0.30)),
    'wood':  make_pbr('cab_wood',  'PlanksC', mapscale=0.5,  base_mult=(0.60, 0.45, 0.32)),
    'rug':   make_solid('cab_rug',  (0.30, 0.10, 0.08), rough=0.95, sheen=0.4),
    'cush':  make_solid('cab_cush', (0.42, 0.20, 0.11), rough=0.88, sheen=0.6),
    'wax':   make_solid('cab_wax',  (0.80, 0.70, 0.52), rough=0.5),
    'book':  make_solid('cab_book', (0.26, 0.13, 0.10), rough=0.7),
    'fire':  make_emissive('cab_fire',  (1.0, 0.42, 0.14), 8.0),
    'flame': make_emissive('cab_flame', (1.0, 0.58, 0.22), 9.0),
    'glow':  make_emissive('cab_glow',  (1.0, 0.70, 0.34), 1.6),
    'magic': make_emissive('cab_magic', (1.0, 0.72, 0.40), 2.0),
}

# ============================================================ isolate ECI kit
# name -> (mat, x, y, rotz_deg, scale)
KIT = {
    'KB3D_ECI_PropFireplace_A_Main':    ('stone', 0.0,  2.50, 0,   0.46),
    'KB3D_ECI_PropFire_C_Main':         ('fire',  0.0,  2.34, 0,   0.55),
    'KB3D_ECI_PropFloorFabric_A_Main':  ('rug',   0.0,  0.10, 0,   0.50),
    'KB3D_ECI_PropPillow_A_Main':       ('cush',  0.0, -0.45, 0,   1.10),
    'KB3D_ECI_PropRockingChair_A_Main': ('wood',  1.55, 0.95, -125, 1.0),
    'KB3D_ECI_PropLantern_A_Main':      ('metal', -1.78, -0.55, 20, 1.4),
    'KB3D_ECI_PropLantern_A_MainTransl':('glow',  -1.78, -0.55, 20, 1.4),
    'KB3D_ECI_PropSoulSmokers_A_Brazier':('metal', -2.05, 1.85, 0, 1.0),
    'KB3D_ECI_PropSoulSmokers_A_Fire':  ('flame', -2.05, 1.85, 0, 1.0),
    'KB3D_ECI_PropMagicalLight_D_Main': ('magic', 2.15, 2.25, 0, 0.6),
    'KB3D_ECI_PropBookStack_C_Main':    ('book',  1.55, 0.05, 12, 1.0),
    'KB3D_ECI_PropBookStack_D_Main':    ('book',  -1.6, -0.30, 0, 1.0),
}
keep = set(KIT.keys()); removed = 0
for o in list(bpy.data.objects):
    if o.name not in keep:
        try: bpy.data.objects.remove(o, do_unlink=True); removed += 1
        except Exception: pass
print(f'[scene] removed {removed}, kept {len(bpy.data.objects)}', flush=True)

def world_bbox(o):
    mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx

for name, (mk, x, y, rz, sc) in KIT.items():
    o = bpy.data.objects.get(name)
    if not o:
        print('[kit MISS]', name, flush=True); continue
    o.rotation_euler = (0, 0, math.radians(rz)); o.scale = (sc, sc, sc)
    bpy.context.view_layer.update()
    mn, mx = world_bbox(o)
    o.location.x += (x - (mn.x+mx.x)/2); o.location.y += (y - (mn.y+mx.y)/2); o.location.z += (0.0 - mn.z)
    set_mat(o, MAT[mk]); bpy.context.view_layer.update()
def lift(name, dz):
    o = bpy.data.objects.get(name)
    if o: o.location.z += dz
lift('KB3D_ECI_PropFire_C_Main', 0.32)
print('[kit] placed', flush=True)

# ============================================================ cabin shell
RX, RY, H = 2.7, 2.9, 2.7
def add_box(name, sx, sy, sz, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = (sx, sy, sz); set_mat(o, mat); return o

add_box('Floor', RX*2, RY*2, 0.12, (0, 0, -0.06), MAT['floor'])
add_box('Ceiling', RX*2, RY*2, 0.18, (0, 0, H+0.09), MAT['ceil'])
add_box('Wall_N', RX*2, 0.16, H, (0,  RY, H/2), MAT['wall'])
add_box('Wall_S', RX*2, 0.16, H, (0, -RY, H/2), MAT['wall'])
add_box('Wall_W', 0.16, RY*2, H, (-RX, 0, H/2), MAT['wall'])
wallE = add_box('Wall_E', 0.16, RY*2, H, (RX, 0, H/2), MAT['wall'])

def boolean_cut(target, sx, sy, sz, loc):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    cutter = bpy.context.active_object; cutter.scale = (sx, sy, sz)
    md = target.modifiers.new('cut', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(cutter, do_unlink=True)
boolean_cut(wallE, 0.5, 1.5, 1.25, (RX, 0.1, 1.45))   # window in +X wall
# window frame (wood)
for fy, fz, fsy, fsz in [(0.1, 0.78, 1.6, 0.1), (0.1, 2.12, 1.6, 0.1), (-0.66, 1.45, 0.1, 1.45), (0.86, 1.45, 0.1, 1.45)]:
    add_box('WinFrame', 0.18, fsy, fsz, (RX, fy, fz), MAT['wood'])
# beams across X
for i, by in enumerate((-1.9, -0.6, 0.7, 2.0)):
    add_box(f'Beam_{i}', RX*2-0.1, 0.16, 0.24, (0, by, H-0.18), MAT['beam'])
# hearthstone slab + mantel ledge
add_box('Hearthstone', 1.7, 0.95, 0.10, (0, 1.95, 0.05), MAT['stone'])
add_box('Mantel', 1.5, 0.34, 0.10, (0, 2.05, 1.62), MAT['wood'])
# side stool under lantern
add_box('StoolTop', 0.40, 0.40, 0.05, (-1.78, -0.55, 0.40), MAT['wood'])
add_box('StoolLeg', 0.34, 0.34, 0.40, (-1.78, -0.55, 0.20), MAT['wood'])
# closed plank door on back wall
add_box('Door', 0.92, 0.06, 2.05, (0.5, -RY+0.11, 1.02), MAT['door'])
# wall shelf on -X with book stacks feel
add_box('Shelf', 0.34, 1.2, 0.06, (-RX+0.28, 1.0, 1.5), MAT['wood'])

# ============================================================ candles (warm, flamed)
def spawn_candle(x, y, z, h, r=0.025):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=(x, y, z+h/2))
    c = bpy.context.active_object; c.name = 'Candle'; set_mat(c, MAT['wax'])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(x, y, z+h+0.02))
    f = bpy.context.active_object; f.name = 'CandleFlame'; f.scale = (1, 1, 1.8); set_mat(f, MAT['flame'])
CANDLES = [(-0.58, 2.05, 1.67, 0.22), (0.52, 2.05, 1.67, 0.17)]   # two on the mantel only
for cx, cy, cz, ch in CANDLES:
    spawn_candle(cx, cy, cz, ch)

# ============================================================ night forest beyond the +X window
# dim moonlit-sky gradient (kept faint so the window doesn't read as a bright bar)
bpy.ops.mesh.primitive_plane_add(size=1, location=(RX+2.4, 0.1, 1.5))
bd = bpy.context.active_object; bd.name = 'ForestBackdrop'
bd.rotation_euler = (math.radians(90), 0, math.radians(90)); bd.scale = (7.0, 4.4, 1)
bdm = bpy.data.materials.new('forest_bd'); bdm.use_nodes = True
bn, bl = bdm.node_tree.nodes, bdm.node_tree.links
em = bn.get('Principled BSDF')
tcg = bn.new('ShaderNodeTexCoord'); grad = bn.new('ShaderNodeTexGradient'); ramp = bn.new('ShaderNodeValToRGB')
mpg = bn.new('ShaderNodeMapping'); mpg.inputs['Rotation'].default_value = (0, math.radians(90), 0)
bl.new(tcg.outputs['Generated'], mpg.inputs['Vector']); bl.new(mpg.outputs['Vector'], grad.inputs['Vector'])
bl.new(grad.outputs['Color'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].color = (0.006, 0.014, 0.03, 1)   # horizon dark
ramp.color_ramp.elements[1].color = (0.05, 0.10, 0.18, 1)     # sky (moonlit)
bl.new(ramp.outputs['Color'], em.inputs['Emission']); em.inputs['Emission Strength'].default_value = 0.55
set_mat(bd, bdm)
# soft moon disc
bpy.ops.mesh.primitive_circle_add(radius=0.5, fill_type='NGON', location=(RX+2.3, 1.3, 2.6))
moon = bpy.context.active_object; moon.name = 'Moon'; moon.rotation_euler = (0, math.radians(90), 0)
set_mat(moon, make_emissive('moon_m', (0.7, 0.8, 1.0), 2.2))
# a near layer of wide, soft tree silhouettes (close to glass -> large, low-contrast)
for i, tx in enumerate((-1.5, -0.4, 0.7, 1.7)):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16+0.06*(i % 2), depth=5.0, location=(RX+0.9, tx, 2.0))
    t = bpy.context.active_object; t.name = f'Tree_{i}'; set_mat(t, make_solid(f'trunk{i}', (0.004, 0.008, 0.014), 0.98))
# window mullions (wood bars) so the opening reads as a window
for my, mz, msy, msz in [(0.1, 1.45, 0.05, 1.25), (-0.66, 1.45, 0.62, 0.04), (0.86, 1.45, 0.62, 0.04)]:
    add_box('Mullion', 0.10, msy, msz, (RX, my, mz), MAT['wood'])

# ============================================================ lights (1 key + soft fills)
def add_light(kind, name, loc, energy, color, size=0.5):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if kind == 'AREA': d.size = size
    elif kind == 'POINT': d.shadow_soft_size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = loc
    return o
add_light('POINT', 'HearthKey',  (0, 2.18, 0.5), 95, (1.0, 0.44, 0.16), size=0.45)
add_light('POINT', 'HearthFill', (0, 1.5, 0.95), 26, (1.0, 0.5, 0.22), size=0.9)
mo = add_light('AREA', 'MoonLight', (RX+0.3, 0.1, 1.5), 46, (0.42, 0.58, 1.0), size=2.4)
mo.rotation_euler = (0, math.radians(82), 0)
add_light('POINT', 'Lantern', (-1.78, -0.5, 0.66), 7, (1.0, 0.64, 0.3), size=0.16)
add_light('POINT', 'Brazier', (-2.0, 1.85, 1.05), 11, (1.0, 0.48, 0.2), size=0.22)
add_light('POINT', 'CandlesM',(0.0, 2.05, 1.85), 6, (1.0, 0.6, 0.28), size=0.3)
add_light('POINT', 'Magic',   (2.15, 2.25, 1.1), 6, (1.0, 0.72, 0.4), size=0.4)

# ============================================================ world
world = scene.world or bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
wbg = world.node_tree.nodes.get('Background')
wbg.inputs[0].default_value = (0.016, 0.018, 0.026, 1); wbg.inputs[1].default_value = 0.14

# ============================================================ cameras
SEAT = Vector((0.0, -1.5, 1.12))
LOOK = Vector((0.0, 2.0, 0.55))
cd = bpy.data.cameras.new('Still'); cd.lens = 30
still = bpy.data.objects.new('Still', cd); scene.collection.objects.link(still); still.location = SEAT
tgt = bpy.data.objects.new('Tgt', None); scene.collection.objects.link(tgt); tgt.location = LOOK
cc = still.constraints.new('TRACK_TO'); cc.target = tgt; cc.track_axis = 'TRACK_NEGATIVE_Z'; cc.up_axis = 'UP_Y'
pd = bpy.data.cameras.new('Pano'); pd.type = 'PANO'
try: pd.cycles.panorama_type = 'EQUIRECTANGULAR'
except Exception: pass
pano = bpy.data.objects.new('Pano', pd); scene.collection.objects.link(pano); pano.location = SEAT
pano.rotation_euler = (math.radians(90), 0, 0)

# ============================================================ render
view = scene.view_settings
try: view.view_transform = 'Filmic'
except Exception: pass
view.look = 'Medium Contrast'; view.exposure = 0.22

def setup_gpu():
    prefs = bpy.context.preferences.addons.get('cycles')
    if not prefs:
        return False
    cp = prefs.preferences
    for dtype in ('OPTIX', 'CUDA'):
        try:
            cp.compute_device_type = dtype
            cp.refresh_devices()
            gpus = [d for d in cp.devices if d.type == dtype]
            if gpus:
                for d in cp.devices:
                    d.use = (d.type == dtype)
                print(f'[gpu] {dtype}: {[d.name for d in gpus]}', flush=True)
                return True
        except Exception as e:
            print('[gpu]', dtype, 'fail', e, flush=True)
    return False
_GPU = setup_gpu()

def render_to(cam, path, rx, ry, engine, samples):
    scene.camera = cam; scene.render.engine = engine
    scene.render.resolution_x = rx; scene.render.resolution_y = ry
    scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 90
    if engine == 'CYCLES':
        scene.cycles.samples = samples; scene.cycles.use_denoising = True
        try: scene.cycles.denoiser = 'OPTIX' if _GPU else 'OPENIMAGEDENOISE'
        except Exception: pass
        scene.cycles.device = 'GPU' if _GPU else 'CPU'
    else:
        scene.eevee.taa_render_samples = samples
        scene.eevee.use_bloom = True; scene.eevee.bloom_intensity = 0.025; scene.eevee.bloom_threshold = 1.2
        scene.eevee.use_gtao = True; scene.eevee.use_ssr = True
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)
    print('[render]', path, flush=True)

if MODE == 'final':
    render_to(pano,  os.path.join(OUT, 'cabin360.jpg'),    6144, 3072, 'CYCLES', 1024)
    render_to(still, os.path.join(OUT, 'cabin-still.jpg'), 2560, 1440, 'CYCLES', 768)
elif MODE == 'pano':
    render_to(pano, r'C:\tmp\med_pano_test.jpg', 3072, 1536, 'CYCLES', 220)
else:
    render_to(still, r'C:\tmp\med_preview.jpg', 1600, 900, 'BLENDER_EEVEE', 64)
print('=== DONE', MODE, flush=True)
