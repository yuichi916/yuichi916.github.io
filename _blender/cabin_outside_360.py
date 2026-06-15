"""森の外 — Cabin in the Hollow / the lake at night.

Step out of the cabin onto a small rock in the middle of a still forest lake.
The whole sky is filled with stars (満天の星空) and a low moon; the mirror-calm
water doubles them. Deep forest silhouettes ring the far shore. Built from
KitBash3D Valhalla (tree, rocks, logs) + Enchanted Interiors (a 2nd tree),
with a procedural star sky, moon and reflective lake.

  assets/cabin-outside360.jpg   6144x3072 equirectangular (Cycles)
  assets/cabin-outside-still.jpg 2560x1440 perspective fallback / OGP

  blender -b --factory-startup --python cabin_outside_360.py -- preview|final|pano
"""
import bpy, os, sys, math, random
from mathutils import Vector
random.seed(7)

ARGV = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = (ARGV[0] if ARGV else 'preview').lower()

BLEND_VAL = r'P:\CG fanbook\3D assets\KitBash3D - Valhalla\Blender\KB3D_Valhalla-Native.blend'
BLEND_ECI = r'C:\tmp\blends\eci\kb3d_enchantedinteriors-native.blend'
OUT = r'C:\projects\yuichi916.github.io\assets'
os.makedirs(OUT, exist_ok=True)

# ============================================================ materials
def make_emissive(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    return m

def make_night(name, color, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular'].default_value = 0.2
    return m

def make_water(name):
    """Near-mirror dark lake with a gentle ripple, so it reflects the stars + moon."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    b = nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (0.004, 0.010, 0.020, 1)
    # a rippled (not mirror) surface: soft star/moon shimmer, and far cheaper to trace
    b.inputs['Roughness'].default_value = 0.30
    b.inputs['Specular'].default_value = 0.6
    if 'Transmission' in b.inputs: b.inputs['Transmission'].default_value = 0.0
    tc = nodes.new('ShaderNodeTexCoord')
    nz = nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 5.5; nz.inputs['Detail'].default_value = 3.0
    links.new(tc.outputs['Object'], nz.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.15; bump.inputs['Distance'].default_value = 0.04
    links.new(nz.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

# ============================================================ star sky (満天の星空)
def build_star_world():
    """Crisp white stars on a near-black indigo sky + a very faint Milky Way band.
    Rendered with the Standard view transform so the tiny bright points survive."""
    w = bpy.data.worlds.new('NightSky'); bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree; nodes, links = nt.nodes, nt.links
    for n in list(nodes): nodes.remove(n)
    out = nodes.new('ShaderNodeOutputWorld')
    bg = nodes.new('ShaderNodeBackground')
    tc = nodes.new('ShaderNodeTexCoord')
    def starlayer(scale, cut, bright):
        v = nodes.new('ShaderNodeTexVoronoi'); v.feature = 'F1'; v.inputs['Scale'].default_value = scale
        links.new(tc.outputs['Generated'], v.inputs['Vector'])
        r = nodes.new('ShaderNodeValToRGB')
        r.color_ramp.interpolation = 'EASE'
        r.color_ramp.elements[0].position = 0.0; r.color_ramp.elements[0].color = (bright, bright, bright, 1)
        r.color_ramp.elements[1].position = cut; r.color_ramp.elements[1].color = (0, 0, 0, 1)
        links.new(v.outputs['Distance'], r.inputs['Fac'])
        return r
    # three dense layers -> a sky truly full of stars (満天の星空)
    s1 = starlayer(220, 0.060, 1.2)   # dense fine stars
    s2 = starlayer(90,  0.042, 2.2)   # bright stars
    s3 = starlayer(40,  0.032, 3.4)   # rare brilliant stars
    add1 = nodes.new('ShaderNodeMixRGB'); add1.blend_type = 'ADD'; add1.inputs[0].default_value = 1.0
    links.new(s1.outputs['Color'], add1.inputs[1]); links.new(s2.outputs['Color'], add1.inputs[2])
    add2 = nodes.new('ShaderNodeMixRGB'); add2.blend_type = 'ADD'; add2.inputs[0].default_value = 1.0
    links.new(add1.outputs['Color'], add2.inputs[1]); links.new(s3.outputs['Color'], add2.inputs[2])
    # only a gentle density variation so stars are nearly everywhere (no cloud look)
    dn = nodes.new('ShaderNodeTexNoise'); dn.inputs['Scale'].default_value = 1.7; dn.inputs['Detail'].default_value = 2.0
    links.new(tc.outputs['Generated'], dn.inputs['Vector'])
    dramp = nodes.new('ShaderNodeValToRGB')
    dramp.color_ramp.elements[0].position = 0.25; dramp.color_ramp.elements[0].color = (0.78, 0.78, 0.78, 1)
    dramp.color_ramp.elements[1].position = 0.70; dramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(dn.outputs['Fac'], dramp.inputs['Fac'])
    stars = nodes.new('ShaderNodeMixRGB'); stars.blend_type = 'MULTIPLY'; stars.inputs[0].default_value = 0.4
    links.new(add2.outputs['Color'], stars.inputs[1]); links.new(dramp.outputs['Color'], stars.inputs[2])
    # star colour tint (blue / white / warm)
    cn = nodes.new('ShaderNodeTexNoise'); cn.inputs['Scale'].default_value = 35.0
    links.new(tc.outputs['Generated'], cn.inputs['Vector'])
    cramp = nodes.new('ShaderNodeValToRGB')
    cramp.color_ramp.elements[0].position = 0.30; cramp.color_ramp.elements[0].color = (0.70, 0.80, 1.0, 1)
    cramp.color_ramp.elements[1].position = 0.72; cramp.color_ramp.elements[1].color = (1.0, 0.88, 0.74, 1)
    links.new(cn.outputs['Fac'], cramp.inputs['Fac'])
    starCol = nodes.new('ShaderNodeMixRGB'); starCol.blend_type = 'MULTIPLY'; starCol.inputs[0].default_value = 1.0
    links.new(stars.outputs['Color'], starCol.inputs[1]); links.new(cramp.outputs['Color'], starCol.inputs[2])
    # near-black indigo base (no milky-way band — it read as clouds)
    base = nodes.new('ShaderNodeMixRGB'); base.blend_type = 'ADD'; base.inputs[0].default_value = 1.0
    base.inputs[2].default_value = (0.003, 0.005, 0.012, 1)
    links.new(starCol.outputs['Color'], base.inputs[1])
    links.new(base.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 3.2
    links.new(bg.outputs['Background'], out.inputs['Surface'])

# ============================================================ GPU
def setup_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dtype in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = dtype; prefs.refresh_devices()
            n = 0
            for d in prefs.devices:
                d.use = (d.type != 'CPU'); n += 1 if d.use else 0
            if n:
                bpy.context.scene.cycles.device = 'GPU'
                print(f'[gpu] {dtype} x{n}', flush=True); return True
        except Exception as e:
            print('[gpu] ', dtype, e, flush=True)
    return False

# ============================================================ build the scene
print('[scene] opening Valhalla...', flush=True)
bpy.ops.wm.open_mainfile(filepath=BLEND_VAL)

def find_meshes(substr, exclude=()):
    out = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and substr.lower() in o.name.lower() and not any(e.lower() in o.name.lower() for e in exclude):
            out.append(o)
    return out

_tree = next(iter(find_meshes('Tree', exclude=['TreeBase'])), None)
_rocks = find_meshes('Rock')[:8]
_logs = find_meshes('WoodLogs')[:2] or find_meshes('FireWood')[:2]
tree_data = _tree.data if _tree else None
rock_datas = [o.data for o in _rocks]
log_datas = [o.data for o in _logs]
print(f'[val] tree={bool(tree_data)} rocks={len(rock_datas)} logs={len(log_datas)}', flush=True)

# a 2nd tree species from Enchanted Interiors
eci_tree_data = None
try:
    with bpy.data.libraries.load(BLEND_ECI, link=False) as (df, dt):
        want = [n for n in df.objects if 'IntWizardOffice_A_Tree' in n]
        dt.objects = want[:1]
    for o in dt.objects:
        if o:
            bpy.context.scene.collection.objects.link(o)
            eci_tree_data = o.data
    print('[eci] 2nd tree appended:', bool(eci_tree_data), flush=True)
except Exception as e:
    print('[eci] append failed', e, flush=True)

# keep wanted data alive, then wipe everything
for d in [tree_data, eci_tree_data] + rock_datas + log_datas:
    if d: d.use_fake_user = True
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

scene = bpy.context.scene
coll = scene.collection

# materials
MAT = {
    'tree':  make_night('m_tree',  (0.010, 0.014, 0.022), 0.92),
    'tree2': make_night('m_tree2', (0.014, 0.020, 0.018), 0.92),
    'rock':  make_night('m_rock',  (0.007, 0.009, 0.014), 0.88),
    'ground':make_night('m_ground',(0.013, 0.018, 0.014), 0.95),
    'log':   make_night('m_log',   (0.020, 0.018, 0.016), 0.9),
    'water': make_water('m_water'),
    'moon':  make_emissive('m_moon', (1.0, 0.97, 0.90), 18.0),
    'window':make_emissive('m_window',(1.0, 0.55, 0.22), 6.0),
}

# one night material per shared kit mesh (trees are silhouettes; rocks catch moonlight)
if tree_data: tree_data.materials.clear(); tree_data.materials.append(MAT['tree'])
if eci_tree_data: eci_tree_data.materials.clear(); eci_tree_data.materials.append(MAT['tree2'])
for rd in rock_datas: rd.materials.clear(); rd.materials.append(MAT['rock'])
for ld in log_datas: ld.materials.clear(); ld.materials.append(MAT['log'])

# distant silhouette trees can be heavily decimated — that is what keeps the
# reflective lake (whose rays trace the whole forest) fast to render
def _decimate(data, ratio):
    if not data or not data.polygons: return
    before = len(data.polygons)
    tmp = bpy.data.objects.new('decim', data); coll.objects.link(tmp)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = tmp; tmp.select_set(True)
    md = tmp.modifiers.new('d', 'DECIMATE'); md.ratio = ratio
    try: bpy.ops.object.modifier_apply(modifier='d')
    except Exception as e: print('[decim] fail', e, flush=True)
    print(f'[decim] {data.name}: {before} -> {len(data.polygons)} polys', flush=True)
    bpy.data.objects.remove(tmp, do_unlink=True)
_decimate(tree_data, 0.16)
_decimate(eci_tree_data, 0.16)

def data_dims(data):
    xs = [v.co for v in data.vertices]
    if not xs: return Vector((1,1,1))
    mn = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
    mx = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
    return mx - mn, mn, mx

def place(data, loc, rotz, target_h, mat, jitter_tilt=0.0):
    o = bpy.data.objects.new('o', data)
    coll.objects.link(o)
    dim, mn, mx = data_dims(data)
    h = max(dim.z, 0.001)
    s = target_h / h
    o.scale = (s, s, s)
    o.rotation_euler = (random.uniform(-jitter_tilt, jitter_tilt), random.uniform(-jitter_tilt, jitter_tilt), rotz)
    # drop so the base sits on z=loc[2]
    o.location = (loc[0], loc[1], loc[2] - mn.z * s)
    return o  # material is pre-assigned on the shared mesh data

# ---- huge dark ground (hidden under the lake) + the wide mirror lake ----
bpy.ops.mesh.primitive_plane_add(size=800, location=(0, 0, -0.06))
g = bpy.context.active_object; g.name = 'Ground'; g.data.materials.append(MAT['ground'])

bpy.ops.mesh.primitive_circle_add(radius=30, fill_type='NGON', location=(0, 0, 0.0))
lake = bpy.context.active_object; lake.name = 'Lake'; lake.data.materials.append(MAT['water'])

# ---- the small rock you step out onto, ringed by the lake ----
bpy.ops.mesh.primitive_circle_add(radius=2.6, fill_type='NGON', location=(0, 0, 0.18))
isl = bpy.context.active_object; isl.name = 'Stand'; isl.data.materials.append(MAT['rock'])
if rock_datas:
    for i in range(5):
        a = i/5*math.tau + random.uniform(-0.3, 0.3); r = random.uniform(2.0, 3.2)
        place(random.choice(rock_datas), (math.cos(a)*r, math.sin(a)*r, 0.06),
              random.uniform(0, math.tau), random.uniform(0.4, 0.7), None, 0.15)
    place(random.choice(rock_datas), (0.9, 2.2, 0.06), 0.5, 0.6, None, 0.1)   # small foreground anchor
if log_datas:
    place(random.choice(log_datas), (-1.5, 1.6, 0.12), 1.3, 0.5, None, 0.05)  # a log to sit on

# ---- the deep, dense forest pressing right up to the small lake ----
trees = [d for d in (tree_data, eci_tree_data) if d]
if trees:
    for i in range(420):
        a = random.uniform(0, math.tau)
        # leave a clearing toward the moon (+Y, a≈pi/2) so it shines over the water
        diff = (a - math.pi/2 + math.pi) % math.tau - math.pi
        if abs(diff) < 0.34 and random.random() < 0.82: continue
        r = 31 + (random.random()**1.4) * 84      # biased toward the near shore = enclosing
        h = random.uniform(11, 25) * (1.0 - 0.16*random.random())
        place(random.choice(trees), (math.cos(a)*r, math.sin(a)*r, 0.0),
              random.uniform(0, math.tau), h, None, 0.06)

# ---- shoreline rocks where the water meets the dense forest ----
if rock_datas:
    for i in range(34):
        a = i/34*math.tau; r = random.uniform(28.5, 31.5)
        place(random.choice(rock_datas), (math.cos(a)*r, math.sin(a)*r, 0.0),
              random.uniform(0, math.tau), random.uniform(0.8, 2.0), None, 0.1)

# ---- the cabin you came from: a warm window glow tucked in the trees (-Y) ----
bpy.ops.mesh.primitive_plane_add(size=1.6, location=(0, -33, 1.8), rotation=(math.radians(90), 0, 0))
win = bpy.context.active_object; win.name = 'CabinWindow'; win.data.materials.append(MAT['window'])
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -34, 2.2)); cb = bpy.context.active_object
cb.scale = (3.6, 2.8, 2.6); cb.data.materials.append(MAT['tree'])

# ---- the moon, low over the clearing (+Y), mirrored in the small lake ----
bpy.ops.mesh.primitive_uv_sphere_add(radius=3.0, location=(0, 58, 11))
moon = bpy.context.active_object; moon.name = 'Moon'; moon.data.materials.append(MAT['moon'])
for p in moon.data.polygons: p.use_smooth = True
bpy.ops.mesh.primitive_uv_sphere_add(radius=5.2, location=(0, 58, 11))
halo = bpy.context.active_object; halo.name = 'MoonHalo'; halo.data.materials.append(make_emissive('m_halo', (0.85, 0.9, 1.0), 0.7))
for p in halo.data.polygons: p.use_smooth = True

# ---- moonlight: a cool sun from the moon's direction ----
sun_d = bpy.data.lights.new('Moonlight', 'SUN'); sun_d.energy = 0.28; sun_d.color = (0.64, 0.74, 1.0); sun_d.angle = math.radians(3.0)
sun = bpy.data.objects.new('Moonlight', sun_d); coll.objects.link(sun)
sun.location = (0, 120, 30); sun.rotation_euler = (math.radians(62), 0, math.radians(180))

build_star_world()
# the moon's Sun lamp is the key light — skip the (very slow) importance map for the
# high-frequency star world, which otherwise stalls Cycles on 'Updating Lights'
try: scene.world.cycles.sampling_method = 'NONE'
except Exception as e: print('[world] sampling_method', e, flush=True)
try: scene.world.cycles.sample_map_resolution = 256
except Exception: pass

# ============================================================ camera + render
pd = bpy.data.cameras.new('Pano'); pd.type = 'PANO'
try: pd.cycles.panorama_type = 'EQUIRECTANGULAR'
except Exception: pass
cam = bpy.data.objects.new('Pano', pd); coll.objects.link(cam)
cam.location = (0, 0, 1.45); cam.rotation_euler = (math.radians(90), 0, 0)   # face +Y, level

stilld = bpy.data.cameras.new('Still'); stilld.lens = 24
still = bpy.data.objects.new('Still', stilld); coll.objects.link(still)
still.location = (0, 1.5, 1.7); still.rotation_euler = (math.radians(86), 0, math.radians(2))

_GPU = setup_gpu()

# keep the night render fast: shallow bounces + clamp the fireflies the star emission
# and the reflective lake would otherwise throw
cy = scene.cycles
cy.max_bounces = 3; cy.diffuse_bounces = 2; cy.glossy_bounces = 1
cy.transmission_bounces = 1; cy.transparent_max_bounces = 2; cy.volume_bounces = 0
cy.sample_clamp_indirect = 2.5
try: cy.caustics_reflective = False; cy.caustics_refractive = False
except Exception: pass

def render_to(camobj, path, rx, ry, engine, samples):
    scene.camera = camobj; scene.render.engine = engine
    scene.render.resolution_x = rx; scene.render.resolution_y = ry
    scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 90
    if engine == 'CYCLES':
        scene.cycles.samples = samples; scene.cycles.use_denoising = True
        try: scene.cycles.denoiser = 'OPTIX' if _GPU else 'OPENIMAGEDENOISE'
        except Exception: pass
        scene.view_settings.view_transform = 'Standard'
        try: scene.view_settings.look = 'None'
        except Exception: pass
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)
    print('[render]', path, flush=True)

if MODE == 'final':
    render_to(cam,   os.path.join(OUT, 'cabin-outside360.jpg'),    6144, 3072, 'CYCLES', 1024)
    render_to(still, os.path.join(OUT, 'cabin-outside-still.jpg'), 2560, 1440, 'CYCLES', 768)
    print('=== DONE final', flush=True)
elif MODE == 'pano':
    render_to(cam, r'C:\tmp\outside_pano_test.jpg', 3072, 1536, 'CYCLES', 256)
    print('=== DONE pano', flush=True)
else:
    render_to(still, r'C:\tmp\outside_preview.jpg', 1600, 900, 'BLENDER_EEVEE', 64)
    print('=== DONE preview', flush=True)
