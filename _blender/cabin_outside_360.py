"""森の外 — the lakeside forest cabin, in DAY or NIGHT.

Step out of the cabin onto the shore of a clear forest lake. Real KitBash3D
Enchanted trees + shrubs make the forest; a small hand-built log cabin (the one
you came from) sits on the shore; the water is clear by day and a dark mirror by
night.

  assets/cabin-outside360.jpg       6144x3072 equirect — NIGHT
  assets/cabin-outside-day360.jpg   6144x3072 equirect — DAY
  assets/cabin-outside-still.jpg     2560x1440 OGP

  blender -b --factory-startup --python cabin_outside_360.py -- pano|final  night|day

  NB the campfire flame uses a painted RGBA billboard at C:\tmp\flame.png — regenerate it first
  with `python _blender/cabin_flame_texture.py` (the render bakes it into the JPGs, so the repo
  only needs the rendered panoramas, not flame.png itself).
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

def make_enc_ground(name, fam, mapscale, tint):
    """tiled PBR forest floor from an Enchanted ground texture (GrassyGroundA), tinted darker."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    bsdf = nodes.get('Principled BSDF')
    tc = nodes.new('ShaderNodeTexCoord'); mp = nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (mapscale,)*3
    links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    def img(role, noncol):
        p = os.path.join(ENCH_TEX, f'KB3D_ENC_{fam}_{role}.png')
        if not os.path.exists(p): return None
        im = bpy.data.images.load(p, check_existing=True)
        if noncol: im.colorspace_settings.name = 'Non-Color'
        n = nodes.new('ShaderNodeTexImage'); n.image = im
        links.new(mp.outputs['Vector'], n.inputs['Vector']); return n
    bc = img('basecolor', False)
    if bc:
        mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = (*tint, 1)
        links.new(bc.outputs['Color'], mix.inputs[1]); links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*tint, 1)
    rg = img('roughness', True)
    if rg: links.new(rg.outputs['Color'], bsdf.inputs['Roughness'])
    else: bsdf.inputs['Roughness'].default_value = 0.96
    nm = img('normal', True)
    if nm:
        nmap = nodes.new('ShaderNodeNormalMap'); nmap.inputs['Strength'].default_value = 1.4
        links.new(nm.outputs['Color'], nmap.inputs['Color']); links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    try: bsdf.inputs['Specular'].default_value = 0.1
    except Exception: pass
    return m

def make_leaf(name, fam, tint):
    """leaf-litter card: Enchanted leaf atlas with opacity, laid flat on the forest floor."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    try: m.blend_method = 'CLIP'; m.shadow_method = 'NONE'
    except Exception: pass
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    bsdf = nodes.get('Principled BSDF')
    def img(role, noncol):
        p = os.path.join(ENCH_TEX, f'KB3D_ENC_{fam}_{role}.png')
        if not os.path.exists(p): return None
        im = bpy.data.images.load(p, check_existing=True)
        if noncol: im.colorspace_settings.name = 'Non-Color'
        n = nodes.new('ShaderNodeTexImage'); n.image = im; return n
    bc = img('basecolor', False)
    if bc:
        mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = (*tint, 1)
        links.new(bc.outputs['Color'], mix.inputs[1]); links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    op = img('opacity', True)
    if op: links.new(op.outputs['Color'], bsdf.inputs['Alpha'])
    try: bsdf.inputs['Roughness'].default_value = 0.95; bsdf.inputs['Specular'].default_value = 0.05
    except Exception: pass
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

def make_flame():
    """a real flame from a painted RGBA flame texture (C:\\tmp\\flame.png) on a camera-facing billboard."""
    m = bpy.data.materials.new('flame'); m.use_nodes = True
    try: m.blend_method = 'BLEND'; m.shadow_method = 'NONE'
    except Exception: pass
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    for n in list(nodes):
        if n.type != 'OUTPUT_MATERIAL': nodes.remove(n)
    out = nodes.get('Material Output') or nodes.new('ShaderNodeOutputMaterial')
    tex = nodes.new('ShaderNodeTexImage')
    try:
        tex.image = bpy.data.images.load(r'C:\tmp\flame.png', check_existing=True); tex.extension = 'CLIP'
    except Exception as e:
        print('[flame] image load failed:', e, flush=True)
    emis = nodes.new('ShaderNodeEmission'); emis.inputs['Strength'].default_value = 13.0
    links.new(tex.outputs['Color'], emis.inputs['Color'])
    transp = nodes.new('ShaderNodeBsdfTransparent'); mix = nodes.new('ShaderNodeMixShader')
    links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
    links.new(transp.outputs['BSDF'], mix.inputs[1])
    links.new(emis.outputs['Emission'], mix.inputs[2])
    links.new(mix.outputs['Shader'], out.inputs['Surface'])
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
    'ground':    make_enc_ground('m_ground', 'GrassyGroundA', 190, (0.46, 0.50, 0.34) if DAY else (0.60, 0.64, 0.46)),
    'shore':     make_enc_ground('m_shore',  'GrassyGroundA', 130, (0.52, 0.52, 0.42) if DAY else (0.66, 0.68, 0.56)),
    'lakebed':   make_solid('m_lakebed', (0.02, 0.03, 0.035) if DAY else (0.02, 0.03, 0.03), 0.95),
    'rock':      make_solid('m_rock',   (0.20, 0.20, 0.19) if DAY else (0.018, 0.022, 0.028), 0.85),
    'water':     make_water(),
    'moon':      make_emissive('m_moon', (1.0, 0.97, 0.90), 16.0),
    'coals':     make_emissive('m_coals', (1.0, 0.36, 0.07), 7.0),   # dim glowing coals (the flame itself is live in three.js)
    'leafA':     make_leaf('m_leafA', 'AtlasLeafA', (0.42, 0.40, 0.26) if DAY else (0.5, 0.48, 0.34)),
    'leafB':     make_leaf('m_leafB', 'AtlasLeafC', (0.46, 0.38, 0.22) if DAY else (0.54, 0.46, 0.30)),
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
    # smooth low-frequency lobes only (gentle bays/coves) — NO per-vertex random, which makes it jagged
    ph1, ph2, ph3 = rnd.uniform(0, math.tau), rnd.uniform(0, math.tau), rnd.uniform(0, math.tau)
    for v in o.data.vertices:
        ang = math.atan2(v.co.y, v.co.x)
        wob = 1.0 + 0.11*math.sin(ang*2 + ph1) + 0.06*math.sin(ang*3 + ph2) + 0.025*math.sin(ang*5 + ph3)
        v.co.x = math.cos(ang) * rx * wob
        v.co.y = math.sin(ang) * ry * wob
        v.co.z = 0.0
    o.data.materials.append(mat)
    return o

# ---- ground + a natural round forest lake, ringed by a shore you stand on ----
LC = (0.0, 23.5)            # lake centre, out in front (+Y) — pulled right up close
LRX, LRY = 28.0, 23.2       # radii: spans x≈±28, near edge y≈0.3 (the water laps at your feet), far edge y≈47
box('Ground', 600, 600, 0.1, (0, 0, -0.10), MAT['ground'])
# a broad organic shore bank (pebble/grass) the lake sits inside — the 湖畔 ring all the way round
organic_disc('ShoreBank', LC[0], LC[1], -0.07, LRX+5.0, LRY+5.0, 200, 0.0, MAT['shore'], 21)
# the bed, seen through the clear water by day
organic_disc('LakeBed', LC[0], LC[1], -0.42, LRX-1.5, LRY-1.5, 150, 0.0, MAT['lakebed'], 23)
# the water itself — a natural, smoothly-curved round lake (high segment count = no jagged rim)
organic_disc('Lake', LC[0], LC[1], -0.05, LRX, LRY, 240, 0.0, MAT['water'], 11)

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

# ---- a campfire on the near shore (foreground-right): real logs on the ground + a real flame + warm light ----
# nothing floating: no stone ring, no glowing orb, no flat cards — just burning logs, flame, and an (invisible) light.
FC = (4.8, 0.2)             # on the near bank just ahead-right; the water laps a step beyond it
# the Enchanted firewood material has no local texture (would render magenta), so keep the
# geometry but swap on our cached wood.
def place_solid(data, loc, rotz, target_h, mat, tilt=0.0):
    o = place(data, loc, rotz, target_h, tilt)
    o.data = o.data.copy(); o.data.materials.clear(); o.data.materials.append(mat)
    return o
# a natural, charred criss-cross log stack: two firewood bundles crossed + a few logs leaning in (teepee)
charmat = make_wood('m_charlog', 'BeamB', 0.4, (0.30, 0.24, 0.18))   # darkened DKF wood = charred/sooty
char_top = make_solid('m_chartop', (0.05, 0.04, 0.035), 0.85)        # blackened, burnt ends
if fire_datas:
    for k in range(2):                 # two real firewood bundles, crossed
        o = place(random.choice(fire_datas), (FC[0], FC[1], 0.0), k*math.radians(66) + random.uniform(0, 0.4),
                  random.uniform(0.42, 0.55))
        o.data = o.data.copy(); o.data.materials.clear(); o.data.materials.append(charmat)
    for k in range(3):                 # a few logs leaning into the middle (teepee), burnt
        a = k*math.radians(60) + 0.3
        box('TopLog%d'%k, 0.07, 0.92, 0.07, (FC[0]+math.cos(a)*0.10, FC[1]+math.sin(a)*0.10, 0.34),
            char_top if k == 1 else charmat, rot=(math.radians(8), 0, a))
else:
    for k in range(6):                 # fallback: a criss-cross stack of charred logs
        a = k*math.radians(60); layer = k // 3
        box('Log%d'%k, 0.08, 1.0, 0.08, (FC[0]+math.cos(a)*0.12, FC[1]+math.sin(a)*0.12, 0.14 + layer*0.12),
            char_top if k % 3 == 0 else charmat, rot=(0, 0, a))
# glowing coals on the logs — the tall FLAME itself is drawn LIVE & animated in three.js (cabin.html),
# so the panorama only bakes the embers bed + the warm light pool it casts on the ground.
bpy.ops.mesh.primitive_circle_add(vertices=20, radius=0.34, fill_type='NGON', location=(FC[0], FC[1], 0.30))
coals = bpy.context.active_object; coals.name = 'Coals'; coals.data.materials.append(MAT['coals'])
fl = bpy.data.lights.new('FireLight', 'POINT'); fl.color = (1.0, 0.5, 0.16)
fl.energy = 70.0 if DAY else 330.0
try: fl.shadow_soft_size = 0.45
except Exception: pass
flo = bpy.data.objects.new('FireLight', fl); coll.objects.link(flo); flo.location = (FC[0], FC[1], 0.65)

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
# a dense ring of trees crowding right up to the clearing — deep, walled-in woods
for i in range(1150):
    a = random.uniform(0, math.tau); r = 4 + (random.random()**1.25) * 116
    x, y = math.cos(a)*r, math.sin(a)*r
    if in_water(x, y) or near_cabin(x, y): continue
    place(random.choice(tree_datas), (x, y, 0.0), random.uniform(0, math.tau),
          random.uniform(9, 20) * (1.0 - 0.10*random.random()), 0.05); nT += 1
print(f'[forest] {nT} trees', flush=True)
# extra-dense, tall woods behind you (-Y): turn from the lake and you face deep forest
for i in range(500):
    a = random.uniform(math.radians(188), math.radians(352)); r = 4 + (random.random()**1.05) * 80
    x, y = math.cos(a)*r, math.sin(a)*r
    if near_cabin(x, y): continue
    place(random.choice(tree_datas), (x, y, 0.0), random.uniform(0, math.tau),
          random.uniform(9, 21) * (1.0 - 0.10*random.random()), 0.05)
# far treeline across the lake — tall & dense so the forest walls the water in
for i in range(500):
    x = random.uniform(-100, 100); y = random.uniform(46, 104)
    if in_water(x, y): continue
    place(random.choice(tree_datas), (x, y, 0.0), random.uniform(0, math.tau),
          random.uniform(11, 22), 0.05)
# near framing trunks leaning over the shore — heavy canopy in the top corners (an enclosed clearing)
for sx in (-1, 1):
    for k in range(5):
        fx = sx * random.uniform(4.5, 12.0); fy = random.uniform(-9.0, -3.0)
        if near_cabin(fx, fy): continue
        place(random.choice(tree_datas), (fx, fy, 0.0), random.uniform(0, math.tau),
              random.uniform(18, 27), 0.06)
# thick wild undergrowth (ferns/shrubs) all around — unkempt forest floor
for i in range(760):
    a = random.uniform(0, math.tau); r = 3 + (random.random()**1.1) * 76
    x, y = math.cos(a)*r, math.sin(a)*r
    if in_water(x, y) or near_cabin(x, y): continue
    place(random.choice(shrub_datas), (x, y, 0.0), random.uniform(0, math.tau), random.uniform(0.7, 2.6), 0.12)
# reeds tuft the shore EDGES only (left/right), never the open water in front of you
for i in range(60):
    side = random.choice((-1, 1)); x = side * random.uniform(30, 47); y = random.uniform(-3.0, 8.0)
    place(random.choice(shrub_datas), (x, y, 0.0), random.uniform(0, math.tau), random.uniform(0.6, 1.6), 0.12)
# a few fallen logs / mossy deadfall — a wild, untrodden, far-from-anywhere feel
if fire_datas:
    for i in range(7):
        a = random.uniform(0, math.tau); r = random.uniform(8, 40)
        x, y = math.cos(a)*r, math.sin(a)*r
        if in_water(x, y) or near_cabin(x, y): continue
        o = place_solid(random.choice(fire_datas), (x, y, 0.0), random.uniform(0, math.tau), random.uniform(0.6, 1.0), MAT['cabinbeam'])
        o.rotation_euler = (math.radians(90), random.uniform(0, math.tau), random.uniform(0, math.tau))   # toppled, lying down
# leaf litter scattered over the visible forest floor (avoiding the water + the spot you stand on)
_leafmats = [MAT['leafA'], MAT['leafB']]
for i in range(220):
    a = random.uniform(0, math.tau); r = 2.0 + (random.random()**0.7) * 30.0
    x, y = math.cos(a)*r, math.sin(a)*r
    if in_water(x, y) or near_cabin(x, y): continue
    s = random.uniform(0.5, 1.3)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, 0.02 + random.uniform(0, 0.03)))
    lf = bpy.context.active_object; lf.name = 'Leaf'; lf.scale = (s, s, 1)
    lf.rotation_euler = (0, 0, random.uniform(0, math.tau))
    lf.data.materials.append(random.choice(_leafmats))

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
