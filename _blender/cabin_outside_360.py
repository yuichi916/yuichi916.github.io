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
        b.inputs['Base Color'].default_value = (0.013, 0.026, 0.042, 1)
        b.inputs['Roughness'].default_value = 0.09
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
        links.new(base.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 4.2
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
fire_datas  = uniq_datas(['Firewood', 'Logs', 'LogPile'], limit=3)   # campfire fuel for the shore
rock_datas  = uniq_datas(['Rock', 'Boulder', 'Stone'], exclude=['Stonework'], limit=6)
print(f'[enc] trees={len(tree_datas)} shrubs={len(shrub_datas)} firewood={len(fire_datas)} rocks={len(rock_datas)}', flush=True)
for d in tree_datas + shrub_datas + fire_datas + rock_datas: d.use_fake_user = True
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

scene = bpy.context.scene; coll = scene.collection

# build materials AFTER opening Enchanted (open_mainfile wipes earlier data)
MAT = {
    'cabinwall': make_wood('m_cabinwall', 'PlanksC', 0.45, (0.62, 0.46, 0.30)),
    'cabinbeam': make_wood('m_cabinbeam', 'BeamB',   0.30, (0.40, 0.30, 0.20)),
    'roof':      make_wood('m_roof',      'PlanksD', 0.40, (0.30, 0.22, 0.16)),
    'chimney':   make_wood('m_chimney',   'BlocksB', 0.30, (0.55, 0.50, 0.44)),
    'win':       make_emissive('m_win', (1.0, 0.62, 0.26), 9.0),
    'ground':    make_solid('m_ground', (0.10, 0.13, 0.07) if DAY else (0.034, 0.042, 0.030), 0.95),
    'shore':     make_solid('m_shore',  (0.14, 0.15, 0.10) if DAY else (0.075, 0.085, 0.080), 0.92),
    'lakebed':   make_solid('m_lakebed', (0.02, 0.03, 0.035) if DAY else (0.02, 0.03, 0.03), 0.95),
    'rock':      make_solid('m_rock',   (0.20, 0.20, 0.19) if DAY else (0.018, 0.022, 0.028), 0.85),
    'water':     make_water(),
    'moon':      make_emissive('m_moon', (1.0, 0.97, 0.90), 16.0),
    'ember':     make_emissive('m_ember', (1.0, 0.42, 0.10), 34.0),    # glowing coals
    'flame':     make_emissive('m_flame', (1.0, 0.66, 0.26), 46.0),    # billboard flame
    'firestone': make_solid('m_firestone', (0.16, 0.15, 0.14) if DAY else (0.06, 0.06, 0.06), 0.9),
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

def organic_disc(name, cx, cy, z, rx, ry, segs, jitter, mat, seedv):
    """a filled n-gon disc whose rim wobbles -> a natural, non-circular shoreline."""
    rnd = random.Random(seedv)
    bpy.ops.mesh.primitive_circle_add(vertices=segs, radius=1.0, fill_type='NGON', location=(cx, cy, z))
    o = bpy.context.active_object; o.name = name
    # low-frequency lobes + fine jitter so the edge reads as a real lake, not a wheel
    ph1, ph2 = rnd.uniform(0, math.tau), rnd.uniform(0, math.tau)
    for v in o.data.vertices:
        ang = math.atan2(v.co.y, v.co.x)
        wob = 1.0 + 0.10*math.sin(ang*3 + ph1) + 0.06*math.sin(ang*5 + ph2) + (rnd.random()-0.5)*jitter
        v.co.x = math.cos(ang) * rx * wob
        v.co.y = math.sin(ang) * ry * wob
        v.co.z = 0.0
    o.data.materials.append(mat)
    return o

# ---- ground + a natural round forest lake, ringed by a shore you stand on ----
LC = (0.0, 27.0)            # lake centre, out in front (+Y)
LRX, LRY = 27.0, 23.0       # radii: spans x≈±27, y≈4..50 — a clear few-metre bank at your feet
box('Ground', 600, 600, 0.1, (0, 0, -0.10), MAT['ground'])
# a broad organic shore bank (pebble/grass) the lake sits inside — the 湖畔 ring all the way round
organic_disc('ShoreBank', LC[0], LC[1], -0.07, LRX+5.0, LRY+5.0, 140, 0.10, MAT['shore'], 21)
# the bed, seen through the clear water by day
organic_disc('LakeBed', LC[0], LC[1], -0.42, LRX-1.5, LRY-1.5, 96, 0.08, MAT['lakebed'], 23)
# the water itself — a natural, slightly wavy round lake
organic_disc('Lake', LC[0], LC[1], -0.05, LRX, LRY, 160, 0.09, MAT['water'], 11)

# ---- the cabin you came from: a log cabin on the near-left shore, FACING you across the lake ----
CABIN = (-25.0, 12.0)       # left bank, beside the water
# windows/door sit on the cabin's local +Y face, so aim +Y (not +X) at the viewer: dir-to-origin minus 90°
YAW = math.atan2(0 - CABIN[1], 0 - CABIN[0]) - math.radians(90)
_ca, _sa = math.cos(YAW), math.sin(YAW)
def cpos(lx, ly):           # local cabin coords -> world (rotated by YAW about the cabin centre)
    return (CABIN[0] + lx*_ca - ly*_sa, CABIN[1] + lx*_sa + ly*_ca)
cw, cd, ch = 5.4, 4.6, 3.1
box('CabinWall', cw, cd, ch, (*cpos(0, 0), ch/2), MAT['cabinwall'], rot=(0, 0, YAW))
for ex in (-cw/2, cw/2):
    for ey in (-cd/2, cd/2):
        box('CabinPost', 0.22, 0.22, ch, (*cpos(ex, ey), ch/2), MAT['cabinbeam'], rot=(0, 0, YAW))
# gable roof — two slabs meeting at a ridge (pitch about local Y, then yawed)
box('Roof1', cw*0.66, cd*1.28, 0.18, (*cpos(-cw*0.30, 0), ch+0.62), MAT['roof'], rot=(0, math.radians(36), YAW))
box('Roof2', cw*0.66, cd*1.28, 0.18, (*cpos( cw*0.30, 0), ch+0.62), MAT['roof'], rot=(0, -math.radians(36), YAW))
box('Gable', cw, 0.12, 1.1, (*cpos(0, -cd/2), ch+0.52), MAT['cabinwall'], rot=(0, 0, YAW))
# warm glowing windows + plank door on the front (+local Y) face — turned to greet you across the water
box('CabinWin',  0.9, 0.06, 0.95, (*cpos(-1.1, cd/2+0.03), 1.55), MAT['win'], rot=(0, 0, YAW))
box('CabinWin2', 0.9, 0.06, 0.95, (*cpos( 1.1, cd/2+0.03), 1.55), MAT['win'], rot=(0, 0, YAW))
box('CabinDoor', 1.05, 0.06, 2.1, (*cpos(0, cd/2+0.03), 1.05), MAT['cabinbeam'], rot=(0, 0, YAW))
# stone chimney with a soft glow
box('Chimney', 0.85, 0.85, ch+1.6, (*cpos(-cw/2-0.35, 0), (ch+1.6)/2), MAT['chimney'], rot=(0, 0, YAW))
# a small warm light spilling from the cabin windows, reflected in the lake
cwl = bpy.data.lights.new('CabinGlow', 'POINT'); cwl.color = (1.0, 0.62, 0.26); cwl.energy = 90.0 if DAY else 210.0
cwlo = bpy.data.objects.new('CabinGlow', cwl); coll.objects.link(cwlo); cwlo.location = (*cpos(0, cd/2+0.6), 1.5)

# ---- a campfire on the near shore (foreground-right): logs, a stone ring, coals + flame + warm light ----
FC = (5.5, 2.2)             # on the near bank, just in front of you and to the right; lake beyond, cabin to the left
# the Enchanted firewood/rock materials have no local texture (would render magenta),
# so we keep the KitBash geometry but swap on our cached wood / solid rock.
def place_solid(data, loc, rotz, target_h, mat, tilt=0.0):
    o = place(data, loc, rotz, target_h, tilt)
    o.data = o.data.copy(); o.data.materials.clear(); o.data.materials.append(mat)
    return o
if fire_datas:
    place_solid(random.choice(fire_datas), (FC[0], FC[1], 0.0), random.uniform(0, math.tau), 0.85, MAT['cabinbeam'])
else:
    for k in range(5):                 # fallback: a small log tepee
        a = k/5*math.tau
        box('Log%d'%k, 0.12, 0.95, 0.12, (FC[0]+math.cos(a)*0.18, FC[1]+math.sin(a)*0.18, 0.42),
            MAT['cabinbeam'], rot=(math.radians(58), 0, a))
for k in range(9):                     # ring of stones round the pit
    a = k/9*math.tau; rr = 0.62
    if rock_datas:
        place_solid(random.choice(rock_datas), (FC[0]+math.cos(a)*rr, FC[1]+math.sin(a)*rr, 0.0),
                    random.uniform(0, math.tau), random.uniform(0.20, 0.32), MAT['rock'])
    else:
        s = 0.12 + random.uniform(0, 0.05)
        box('FireStone%d'%k, s, s, s*0.7, (FC[0]+math.cos(a)*rr, FC[1]+math.sin(a)*rr, 0.06), MAT['firestone'])
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, location=(FC[0], FC[1], 0.14))   # glowing coal bed
coal = bpy.context.active_object; coal.name = 'Coals'; coal.scale = (1.0, 1.0, 0.4); coal.data.materials.append(MAT['ember'])
for ai, a in enumerate((0.0, math.radians(45), math.radians(90), math.radians(135))):  # crossed emissive flame cards
    box('Flame%d'%ai, 0.002, 0.46, 0.92, (FC[0], FC[1], 0.66), MAT['flame'], rot=(0, 0, a))
fl = bpy.data.lights.new('FireLight', 'POINT'); fl.color = (1.0, 0.55, 0.20)
fl.energy = 70.0 if DAY else 340.0
try: fl.shadow_soft_size = 0.5
except Exception: pass
flo = bpy.data.objects.new('FireLight', fl); coll.objects.link(flo); flo.location = (FC[0], FC[1], 0.7)

# ---- the forest: real trees + shrubs ringing the lake; open water fills the whole front ----
def in_lake(x, y, m=1.0):
    return ((x-LC[0])/(LRX*m))**2 + ((y-LC[1])/(LRY*m))**2 < 1.0
def in_water(x, y):
    if in_lake(x, y, 1.16): return True               # the lake + its surrounding shore ring
    if abs(x) < 11 and -3.0 < y < 5.0: return True    # the near bank you stand on + the campfire spot
    return False
def near_cabin(x, y):
    if abs(x - CABIN[0]) < 5.4 and abs(y - CABIN[1]) < 5.4: return True
    den = CABIN[0]**2 + CABIN[1]**2          # keep a clear view corridor from the shore to the cabin
    t = (x*CABIN[0] + y*CABIN[1]) / den
    if 0.0 < t < 1.0:
        px, py = t*CABIN[0], t*CABIN[1]
        if (x-px)**2 + (y-py)**2 < 9.0: return True
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
# thicken the far treeline across the lake — tall and dense so the forest walls the water in
for i in range(360):
    x = random.uniform(-95, 95); y = random.uniform(46, 100)
    if in_water(x, y): continue
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
    sd = bpy.data.lights.new('Moon', 'SUN'); sd.energy = 1.2; sd.color = (0.64, 0.74, 1.0); sd.angle = math.radians(3.0)
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
