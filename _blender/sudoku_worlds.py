# Render dim, atmospheric 360 equirectangular backdrops from KitBash3D kits
# for the isekai 3D sudoku page (sudoku.html). One world per invocation.
#
#   blender -b --factory-startup --python sudoku_worlds.py -- <world> [preview]
#
# world in {dark, enchanted, valhalla, treasure}. Output:
#   <repo>/assets/sudoku/<world>/bg.jpg   2048x1024 equirect (Cycles)
# The backdrop is intentionally dark/low-exposure so the floating cube + runes
# read clearly in front of it.

import bpy, sys, os, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WORLD = (ARGV[0] if ARGV else 'dark').lower()
PREVIEW = len(ARGV) > 1 and ARGV[1] == 'preview'

ASSETS = r'P:\CG fanbook\3D assets'
REPO = r'C:\projects\yuichi916.github.io'
BLENDS = {
    'dark':      os.path.join(ASSETS, r'KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'),
    'enchanted': os.path.join(ASSETS, r'KitBash3D - Enchanted\kb3d_enchanted-native.blend'),
    'valhalla':  os.path.join(ASSETS, r'KitBash3D - Valhalla\Blender\KB3D_Valhalla-Native.blend'),
    'treasure':  os.path.join(ASSETS, r'Kitbash3D - Treasure Island BLENDER\Native (1)\KB3D_TreasureIsland-Native.blend'),
}
# Per-world dusk lighting: sun elevation/azimuth (deg), sky strength, sun energy+color.
LIGHT = {
    'dark':      dict(elev=7,  azim=20,  sky=0.30, sun=2.2, col=(0.55, 0.60, 1.00)),
    'enchanted': dict(elev=12, azim=120, sky=0.45, sun=2.6, col=(0.75, 1.00, 0.80)),
    'valhalla':  dict(elev=5,  azim=250, sky=0.40, sun=3.0, col=(1.00, 0.78, 0.48)),
    'treasure':  dict(elev=22, azim=70,  sky=0.55, sun=3.2, col=(1.00, 0.95, 0.80)),
}

blend = BLENDS[WORLD]
print('[open]', blend, flush=True)
bpy.ops.wm.open_mainfile(filepath=blend)
scene = bpy.context.scene

# ---- relink textures: KB3D native blends reference Blender\KB3DTextures\ but
#      the actual files live in <kit>\Textures\. Build a basename index. ----
def relink_textures(blend_path):
    bdir = os.path.dirname(blend_path)
    roots = [bdir, os.path.dirname(bdir), os.path.dirname(os.path.dirname(bdir))]
    search_dirs = []
    for r in roots:
        for sub in ('Textures', 'textures', 'KB3DTextures'):
            d = os.path.join(r, sub)
            if os.path.isdir(d) and d not in search_dirs:
                search_dirs.append(d)
    # Blender's built-in: recursively remap missing files found under directory.
    for d in search_dirs:
        try:
            bpy.ops.file.find_missing_files(find_all=True, directory=d)
            print(f'[tex] find_missing_files in {d}', flush=True)
        except Exception as e:
            print('[tex] find_missing_files fail', e, flush=True)
    miss = sum(1 for img in bpy.data.images if img.source == 'FILE'
               and not os.path.exists(bpy.path.abspath(img.filepath)))
    print(f'[tex] remaining missing images: {miss}', flush=True)

relink_textures(blend)

# ---- bounding box of all visible meshes -> camera vantage inside the scene ----
mins = Vector(( 1e18,  1e18,  1e18))
maxs = Vector((-1e18, -1e18, -1e18))
nmesh = 0
for ob in scene.objects:
    if ob.type != 'MESH':
        continue
    nmesh += 1
    for corner in ob.bound_box:
        w = ob.matrix_world @ Vector(corner)
        for i in range(3):
            mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
center = (mins + maxs) * 0.5
size = maxs - mins
print(f'[bbox] meshes={nmesh} size={tuple(round(v,1) for v in size)}', flush=True)

# Camera hovers above mid-height so the skyline reads as a vista around the cube.
cam_z = mins.z + size.z * 0.52
seat = Vector((center.x, center.y, cam_z))

pd = bpy.data.cameras.new('Pano'); pd.type = 'PANO'
try: pd.cycles.panorama_type = 'EQUIRECTANGULAR'
except Exception: pass
pano = bpy.data.objects.new('Pano', pd); scene.collection.objects.link(pano)
pano.location = seat
pano.rotation_euler = (math.radians(90), 0, 0)
scene.camera = pano

# ---- physical dusk sky + sun so the architecture reads as a moody skyline ----
LP = LIGHT.get(WORLD, LIGHT['dark'])
world = scene.world or bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
out_w = nt.nodes.new('ShaderNodeOutputWorld')
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs[1].default_value = LP['sky']
nt.links.new(bg.outputs[0], out_w.inputs[0])
try:
    sky = nt.nodes.new('ShaderNodeTexSky')
    # Blender 5.x renamed Nishita -> MULTIPLE_SCATTERING
    sky.sky_type = 'MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in [i.identifier for i in sky.bl_rna.properties['sky_type'].enum_items] else 'NISHITA'
    sky.sun_elevation = math.radians(LP['elev'])
    sky.sun_rotation = math.radians(LP['azim'])
    nt.links.new(sky.outputs[0], bg.inputs[0])
except Exception as e:
    print('[sky] nishita fail, solid fallback', e, flush=True)
    bg.inputs[0].default_value = (0.05, 0.05, 0.09, 1.0)

# directional sun matching the sky for building definition
sdata = bpy.data.lights.new('Sun', 'SUN')
sdata.energy = LP['sun']; sdata.angle = math.radians(3.0); sdata.color = LP['col']
sun = bpy.data.objects.new('Sun', sdata); scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(90 - LP['elev']), 0, math.radians(LP['azim']))

# ---- view transform: cinematic, slightly dim so the cube pops in front ----
view = scene.view_settings
for vt in ('AgX', 'Filmic'):
    try: view.view_transform = vt; break
    except Exception: pass
try: view.look = 'Medium Contrast'
except Exception: pass
view.exposure = -0.2
view.gamma = 1.0

# ---- GPU ----
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

# ---- render ----
rx, ry = (1024, 512) if PREVIEW else (2048, 1024)
samples = 80 if PREVIEW else 200
scene.render.engine = 'CYCLES'
scene.render.resolution_x = rx; scene.render.resolution_y = ry
scene.cycles.samples = samples
scene.cycles.use_denoising = True
try: scene.cycles.denoiser = 'OPTIX' if _GPU else 'OPENIMAGEDENOISE'
except Exception: pass
scene.cycles.device = 'GPU' if _GPU else 'CPU'
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 88

out_dir = os.path.join(REPO, 'assets', 'sudoku', WORLD)
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'preview.jpg' if PREVIEW else 'bg.jpg')
scene.render.filepath = out
print(f'[render] {WORLD} -> {out} ({rx}x{ry}, {samples}spp, gpu={_GPU})', flush=True)
bpy.ops.render.render(write_still=True)
print('=== DONE', WORLD, flush=True)
