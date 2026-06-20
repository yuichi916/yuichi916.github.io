"""森の外 — the lakeside forest cabin, in DAY or NIGHT.

Step out of the cabin onto the shore of a clear forest lake. Real KitBash3D
Enchanted trees + shrubs make the forest; a small hand-built log cabin (the one
you came from) sits on the shore; the water is clear by day and a dark mirror by
night.

  assets/cabin-outside360.jpg       6144x3072 equirect — NIGHT
  assets/cabin-outside-day360.jpg   6144x3072 equirect — DAY
  assets/cabin-outside-still.jpg     2560x1440 OGP

  blender -b --factory-startup --python cabin_outside_360.py -- pano|final  night|day
"""
import bpy, os, sys, math, random
from mathutils import Vector
random.seed(7)

ARGV = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = (ARGV[0] if ARGV else 'preview').lower()
TIME = (ARGV[1] if len(ARGV) > 1 else 'night').lower()
DAY = (TIME == 'day')

ENCH     = r'C:\tmp\blends\enchanted.blend'
# textures copied LOCAL (pCloud P:\ stalls find_missing_files / render image loads → hangs for days)
ENCH_TEX = r'C:\tmp\ench_tex'
DKF_TEX  = r'C:\tmp\dkf_tex'
OUT      = r'C:\projects\yuichi916.github.io\assets'
os.makedirs(OUT, exist_ok=True)

# ============================================================ materials
def make_emissive(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    return m

def make_solid(name, color, rough=0.85, spec=0.3):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular'].default_value = spec
    return m

def make_wood(name, fam, mapscale=0.5, base_mult=(1,1,1)):
    """textured PBR from Dark Fantasy for the cabin."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    bsdf = nodes.get('Principled BSDF')
    tc = nodes.new('ShaderNodeTexCoord'); mp = nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (mapscale,)*3
    links.new(tc.outputs['Object'], mp.inputs['Vector'])
    def img(role, noncol):
        p = os.path.join(DKF_TEX, f'KB3D_DKF_{fam}_{role}.png')
        if not os.path.exists(p): return None
        im = bpy.data.images.load(p, check_existing=True)
        if noncol: im.colorspace_settings.name = 'Non-Color'
        try:
            if max(im.size) > 2048: im.scale(2048, 2048)
        except Exception: pass
        n = nodes.new('ShaderNodeTexImage'); n.image = im; n.projection = 'BOX'; n.projection_blend = 0.3
        links.new(mp.outputs['Vector'], n.inputs['Vector']); return n
    bc = img('basecolor', False)
    if bc:
        mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = (*base_mult, 1)
        links.new(bc.outputs['Color'], mix.inputs[1]); links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    rg = img('roughness', True)
    if rg: links.new(rg.outputs['Color'], bsdf.inputs['Roughness'])
    nm = img('normal', True)
    if nm:
        nmap = nodes.new('ShaderNodeNormalMap'); links.new(nm.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def make_water():
    """clear blue-green by day (you see the bottom), a dark mirror by night."""
    m = bpy.data.materials.new('water'); m.use_nodes = True
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    b = nodes.get('Principled BSDF')
    tc = nodes.new('ShaderNodeTexCoord')
    # NB the plane's Object coords are -0.5..0.5, so the noise scale must be large to
    # get many ripples across the huge lake (a small scale = flat mirror = looks like floor)
    nz = nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 340.0; nz.inputs['Detail'].default_value = 6.0
    try: nz.inputs['Roughness'].default_value = 0.65
    except Exception: pass
    links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nz2 = nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 90.0; nz2.inputs['Detail'].default_value = 3.0
    links.new(tc.outputs['Object'], nz2.inputs['Vector'])
    mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'ADD'; mix.inputs[0].default_value = 0.5
    links.new(nz.outputs['Fac'], mix.inputs[1]); links.new(nz2.outputs['Fac'], mix.inputs[2])
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = (0.5 if DAY else 0.35); bump.inputs['Distance'].default_value = 0.012
    links.new(mix.outputs['Color'], bump.inputs['Height']); links.new(bump.outputs['Normal'], b.inputs['Normal'])
    if DAY:
        b.inputs['Base Color'].default_value = (0.006, 0.035, 0.060, 1) # dark blue-teal forest lake
        b.inputs['Roughness'].default_value = 0.03                     # crisp mirror: reflects the far treeline + cabin
        b.inputs['Transmission'].default_value = 0.12                  # a hint of depth, but the water stays dark
        b.inputs['IOR'].default_value = 1.333
        b.inputs['Specular'].default_value = 0.5
    else:
        b.inputs['Base Color'].default_value = (0.004, 0.010, 0.020, 1)
        b.inputs['Roughness'].default_value = 0.10
        b.inputs['Specular'].default_value = 0.6
    return m

# NB: MAT is built AFTER open_mainfile (below) — opening a .blend wipes data created before it

# ============================================================ sky / lighting
def build_world():
    w = bpy.data.worlds.new('sky'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; nodes, links = nt.nodes, nt.links
    for n in list(nodes): nodes.remove(n)
    out = nodes.new('ShaderNodeOutputWorld'); bg = nodes.new('ShaderNodeBackground')
    if DAY:
        sky = nodes.new('ShaderNodeTexSky')
        try:
            sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(15); sky.sun_rotation = math.radians(125)
            sky.air_density = 1.0; sky.dust_density = 1.3; sky.ozone_density = 1.0   # low afternoon sun, gentle gradient, off-centre
        except Exception: pass
        links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.35
    else:
        tc = nodes.new('ShaderNodeTexCoord')
        def stars(scale, cut, bright):
            v = nodes.new('ShaderNodeTexVoronoi'); v.feature = 'F1'; v.inputs['Scale'].default_value = scale
            links.new(tc.outputs['Generated'], v.inputs['Vector'])
            r = nodes.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'EASE'
            r.color_ramp.elements[0].position = 0.0; r.color_ramp.elements[0].color = (bright,)*3 + (1,)
            r.color_ramp.elements[1].position = cut; r.color_ramp.elements[1].color = (0, 0, 0, 1)
            links.new(v.outputs['Distance'], r.inputs['Fac']); return r
        s1 = stars(200, 0.05, 1.0); s2 = stars(75, 0.04, 1.6)
        add = nodes.new('ShaderNodeMixRGB'); add.blend_type = 'ADD'; add.inputs[0].default_value = 1.0
        links.new(s1.outputs['Color'], add.inputs[1]); links.new(s2.outputs['Color'], add.inputs[2])
        base = nodes.new('ShaderNodeMixRGB'); base.blend_type = 'ADD'; base.inputs[0].default_value = 1.0
        base.inputs[2].default_value = (0.010, 0.015, 0.030, 1)
        links.new(add.outputs['Color'], base.inputs[1])
        links.new(base.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 3.2
    links.new(bg.outputs['Background'], out.inputs['Surface'])

def setup_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dt in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = dt; prefs.refresh_devices(); n = 0
            for d in prefs.devices:
                d.use = (d.type != 'CPU'); n += 1 if d.use else 0
            if n: bpy.context.scene.cycles.device = 'GPU'; print(f'[gpu] {dt} x{n}', flush=True); return True
        except Exception as e: print('[gpu]', dt, e, flush=True)
    return False

# ============================================================ assets from Enchanted
print('[scene] opening Enchanted...', flush=True)
bpy.ops.wm.open_mainfile(filepath=ENCH)
# Repoint every Enchanted texture to the LOCAL copy and reload it. We never touch
# pCloud here (find_missing_files would recursively walk P:\ and hang for days).
_rebound = 0
for im in bpy.data.images:
    if not im.filepath:
        continue
    bn = bpy.path.basename(im.filepath)
    lp = os.path.join(ENCH_TEX, bn)
    if os.path.exists(lp):
        im.filepath = lp
        try: im.reload()
        except Exception: pass
        _rebound += 1
print(f'[tex] rebound {_rebound} images to local', flush=True)

def uniq_datas(substrs, exclude=(), limit=99):
    seen = {}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        nm = o.name.lower()
        if any(s.lower() in nm for s in substrs) and not any(e.lower() in nm for e in exclude):
            if o.data.name not in seen and len(o.data.vertices) > 8:
                seen[o.data.name] = o.data
        if len(seen) >= limit: break
    return list(seen.values())

tree_datas  = uniq_datas(['_Tree'], exclude=['TreeBase'], limit=8)
shrub_datas = uniq_datas(['Shrub'], limit=14)
print(f'[enc] trees={len(tree_datas)} shrubs={len(shrub_datas)}', flush=True)
for d in tree_datas + shrub_datas: d.use_fake_user = True
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

scene = bpy.context.scene; coll = scene.collection

# build materials AFTER opening Enchanted (open_mainfile wipes earlier data)
MAT = {
    'cabinwall': make_wood('m_cabinwall', 'PlanksC', 0.45, (0.62, 0.46, 0.30)),
    'cabinbeam': make_wood('m_cabinbeam', 'BeamB',   0.30, (0.40, 0.30, 0.20)),
    'roof':      make_wood('m_roof',      'PlanksD', 0.40, (0.30, 0.22, 0.16)),
    'chimney':   make_wood('m_chimney',   'BlocksB', 0.30, (0.55, 0.50, 0.44)),
    'win':       make_emissive('m_win', (1.0, 0.62, 0.26), 5.0),
    'ground':    make_solid('m_ground', (0.10, 0.13, 0.07) if DAY else (0.020, 0.026, 0.018), 0.95),
    'shore':     make_solid('m_shore',  (0.14, 0.15, 0.10) if DAY else (0.04, 0.05, 0.05), 0.92),
    'lakebed':   make_solid('m_lakebed', (0.02, 0.03, 0.035) if DAY else (0.02, 0.03, 0.03), 0.95),
    'rock':      make_solid('m_rock',   (0.20, 0.20, 0.19) if DAY else (0.012, 0.015, 0.020), 0.85),
    'water':     make_water(),
    'moon':      make_emissive('m_moon', (1.0, 0.97, 0.90), 16.0),
}

def data_dims(data):
    vs = data.vertices
    mn = Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs)))
    mx = Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs)))
    return mx - mn, mn

def place(data, loc, rotz, target_h, tilt=0.0):
    o = bpy.data.objects.new('o', data); coll.objects.link(o)
    dim, mn = data_dims(data); s = target_h / max(dim.z, 0.001)
    o.scale = (s, s, s)
    o.rotation_euler = (random.uniform(-tilt, tilt), random.uniform(-tilt, tilt), rotz)
    o.location = (loc[0], loc[1], loc[2] - mn.z * s)
    return o

def box(name, sx, sy, sz, loc, mat, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = (sx, sy, sz)
    o.data.materials.append(mat); return o

# ---- ground + intimate forest pond (water laps right at your feet, wraps past you) ----
box('Ground', 600, 600, 0.1, (0, 0, -0.10), MAT['ground'])
box('LakeBed', 200, 150, 0.05, (0, 21, -0.42), MAT['lakebed'])     # bottom seen through clear water
# NB primitive_plane_add(size=1) makes a 1×1 plane, so scale == full size in metres.
# near edge = loc_y - scale_y/2.  Here y ≈ 0.4 .. 42 → the water laps right at your feet (one step ahead).
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 21.2, -0.05))
lake = bpy.context.active_object; lake.name = 'Lake'; lake.scale = (84, 41.6, 1)   # x±42, y≈0.4..42: water starts ~0.4 m in front of you
lake.data.materials.append(MAT['water'])
# the narrow mossy bank you stand on — its front lip is ~0.1 m ahead, water begins right past it
box('ShoreStrip', 13, 3.1, 0.05, (0, -1.45, -0.02), MAT['shore'])
box('FarBank', 130, 8, 0.08, (0, 44, -0.06), MAT['shore'])         # the far-bank the treeline stands on

# ---- the cabin you came from: a log cabin nestled at the forest edge behind-left ----
CABIN = (-9.5, -7.5)        # turn around from the lake and it's there, among the trees
cw, cd, ch = 5.4, 4.6, 3.1
box('CabinWall', cw, cd, ch, (CABIN[0], CABIN[1], ch/2), MAT['cabinwall'])
for ex in (-cw/2, cw/2):
    for ey in (-cd/2, cd/2):
        box('CabinPost', 0.22, 0.22, ch, (CABIN[0]+ex, CABIN[1]+ey, ch/2), MAT['cabinbeam'])
# gable roof — two slabs meeting at a ridge, overhanging the walls
box('Roof1', cw*0.66, cd*1.28, 0.18, (CABIN[0]-cw*0.30, CABIN[1], ch+0.62), MAT['roof'], rot=(0, math.radians(36), 0))
box('Roof2', cw*0.66, cd*1.28, 0.18, (CABIN[0]+cw*0.30, CABIN[1], ch+0.62), MAT['roof'], rot=(0, -math.radians(36), 0))
box('Gable', cw, 0.12, 1.1, (CABIN[0], CABIN[1]-cd/2, ch+0.52), MAT['cabinwall'])
# warm glowing windows + plank door facing the lake (+Y), so the light greets you when you turn back
box('CabinWin', 0.9, 0.06, 0.95, (CABIN[0]-1.1, CABIN[1]+cd/2+0.03, 1.55), MAT['win'])
box('CabinWin2', 0.9, 0.06, 0.95, (CABIN[0]+1.1, CABIN[1]+cd/2+0.03, 1.55), MAT['win'])
box('CabinDoor', 1.05, 0.06, 2.1, (CABIN[0], CABIN[1]+cd/2+0.03, 1.05), MAT['cabinbeam'])
# stone chimney with a soft glow
box('Chimney', 0.85, 0.85, ch+1.6, (CABIN[0]-cw/2-0.35, CABIN[1], (ch+1.6)/2), MAT['chimney'])

# ---- the forest: real trees + shrubs ringing the lake; open water fills the whole front ----
def in_water(x, y):
    # the pond footprint (water y≈0.4..42, x±42) + the near bank: keep trees/shrubs off the water and out of the view right in front
    return (-0.5 < y < 43) and (abs(x) < 44)
def near_cabin(x, y):
    if abs(x - CABIN[0]) < 5.0 and abs(y - CABIN[1]) < 5.0: return True
    # keep a clear sightline (a little path) from the shore to the cabin so it's always visible
    den = CABIN[0]**2 + CABIN[1]**2
    t = (x*CABIN[0] + y*CABIN[1]) / den
    if 0.0 < t < 1.05:
        px, py = t*CABIN[0], t*CABIN[1]
        if (x-px)**2 + (y-py)**2 < 6.25: return True
    return False
random.seed(5); nT = 0
for i in range(880):
    a = random.uniform(0, math.tau); r = 6 + (random.random()**1.2) * 116
    x, y = math.cos(a)*r, math.sin(a)*r
    if in_water(x, y) or near_cabin(x, y): continue
    place(random.choice(tree_datas), (x, y, 0.0), random.uniform(0, math.tau),
          random.uniform(8, 17) * (1.0 - 0.12*random.random()), 0.04); nT += 1
print(f'[forest] {nT} trees', flush=True)
# extra-dense deep forest behind you (-Y hemisphere): turn from the lake into thick woods
for i in range(360):
    a = random.uniform(math.radians(190), math.radians(350)); r = 5 + (random.random()**1.05) * 78
    x, y = math.cos(a)*r, math.sin(a)*r
    if near_cabin(x, y): continue
    place(random.choice(tree_datas), (x, y, 0.0), random.uniform(0, math.tau),
          random.uniform(8, 18) * (1.0 - 0.12*random.random()), 0.04)
# thicken the far treeline across the pond — close, tall and dense so the forest walls the water in
for i in range(340):
    x = random.uniform(-90, 90); y = random.uniform(43, 96)
    place(random.choice(tree_datas), (x, y, 0.0), random.uniform(0, math.tau),
          random.uniform(9, 17), 0.04)
# near framing trees: a few tall trunks just beside/behind you, leaning over the shore
# so the view reads as a clearing deep inside the woods (canopy at the top corners)
for sx in (-1, 1):
    for k in range(3):
        fx = sx * random.uniform(5.5, 12.0); fy = random.uniform(-8.0, -4.5)
        if near_cabin(fx, fy): continue
        place(random.choice(tree_datas), (fx, fy, 0.0), random.uniform(0, math.tau),
              random.uniform(15, 22), 0.05)
for i in range(440):
    a = random.uniform(0, math.tau); r = 4 + (random.random()**1.1) * 74
    x, y = math.cos(a)*r, math.sin(a)*r
    if in_water(x, y) or near_cabin(x, y): continue
    place(random.choice(shrub_datas), (x, y, 0.0), random.uniform(0, math.tau), random.uniform(0.8, 2.4), 0.1)
# reeds tuft the shore EDGES only (left/right), never the open water in front of you
for i in range(48):
    side = random.choice((-1, 1)); x = side * random.uniform(30, 46); y = random.uniform(-3.0, 8.0)
    place(random.choice(shrub_datas), (x, y, 0.0), random.uniform(0, math.tau), random.uniform(0.6, 1.6), 0.12)

# ---- key light ----
if DAY:
    sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = 2.4; sd.color = (1.0, 0.88, 0.72); sd.angle = math.radians(2.0)
    sun = bpy.data.objects.new('Sun', sd); coll.objects.link(sun)
    sun.rotation_euler = (math.radians(75), 0, math.radians(125))   # low warm afternoon sun, behind-right
else:
    # moon over the lake (+Y) + cool moonlight
    bpy.ops.mesh.primitive_uv_sphere_add(radius=4.0, location=(0, 120, 22))
    mo = bpy.context.active_object; mo.data.materials.append(MAT['moon'])
    for p in mo.data.polygons: p.use_smooth = True
    sd = bpy.data.lights.new('Moon', 'SUN'); sd.energy = 0.5; sd.color = (0.64, 0.74, 1.0); sd.angle = math.radians(3.0)
    sun = bpy.data.objects.new('Moon', sd); coll.objects.link(sun)
    sun.rotation_euler = (math.radians(62), 0, math.radians(180))

build_world()
try: scene.world.cycles.sampling_method = 'NONE'
except Exception: pass

# ============================================================ camera + render
pd = bpy.data.cameras.new('Pano'); pd.type = 'PANO'
try: pd.cycles.panorama_type = 'EQUIRECTANGULAR'
except Exception: pass
cam = bpy.data.objects.new('Pano', pd); coll.objects.link(cam)
cam.location = (0, 0, 1.35); cam.rotation_euler = (math.radians(90), 0, 0)   # standing on the bank lip, low — water begins ~0.4 m in front, filling the view below

stilld = bpy.data.cameras.new('Still'); stilld.lens = 26
still = bpy.data.objects.new('Still', stilld); coll.objects.link(still)
still.location = (0, -1.0, 1.6); still.rotation_euler = (math.radians(87), 0, math.radians(3))   # on the bank, near-horizontal: water at your feet → pond → far treeline → stars

_GPU = setup_gpu()
cy = scene.cycles
cy.max_bounces = 4; cy.glossy_bounces = 2; cy.transmission_bounces = 6 if DAY else 1
cy.transparent_max_bounces = 8; cy.volume_bounces = 0; cy.sample_clamp_indirect = 3.0

def render_to(camobj, path, rx, ry, samples):
    scene.camera = camobj; scene.render.engine = 'CYCLES'
    scene.render.resolution_x = rx; scene.render.resolution_y = ry
    scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 90
    scene.cycles.samples = samples; scene.cycles.use_denoising = True
    try: scene.cycles.denoiser = 'OPTIX' if _GPU else 'OPENIMAGEDENOISE'
    except Exception: pass
    scene.view_settings.view_transform = 'Filmic' if DAY else 'Standard'
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)
    print('[render]', path, flush=True)

outname = 'cabin-outside-day360.jpg' if DAY else 'cabin-outside360.jpg'
if MODE == 'final':
    render_to(cam, os.path.join(OUT, outname), 6144, 3072, 768)
    if not DAY: render_to(still, os.path.join(OUT, 'cabin-outside-still.jpg'), 2560, 1440, 640)
    print('=== DONE final', flush=True)
elif MODE == 'still':
    render_to(still, os.path.join(OUT, 'cabin-outside-still.jpg'), 2560, 1440, 640)
    print('=== DONE still', flush=True)
elif MODE == 'pano':
    render_to(cam, r'C:\tmp\outside_pano_test.jpg', 3072, 1536, 256)
    print('=== DONE pano', flush=True)
else:
    render_to(still, r'C:\tmp\outside_preview.jpg', 1600, 900, 96)
    print('=== DONE preview', flush=True)
