"""汎用 世界レンダ: 任意キットの焦点ジオラマをクリーンレンダ+距離マスク出力。
   blender -b --factory-startup --python ehon_world_render.py -- <world> <preview|final|layers>
   出力: C:\\tmp\\ehon\\<world>_render.png  (+ layers時 <world>_mask_{far,mid,fore}.png)
   Enchanted で確立した方式(find_missing_files再リンク→焦点DIST箱庭→クリーンレンダ+距離マスク)を
   Valhalla / Dark Fantasy にも適用。水彩化は後段 post/SD、層切出しは layer_cut が担う。
"""
import bpy, sys, os, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WORLD = ARGV[0] if ARGV else 'enchanted'
MODE = (ARGV[1] if len(ARGV) > 1 else 'preview').lower()

WORLDS = {
    'enchanted': dict(
        blend=r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend',
        tex=r'C:\tmp\blends\enchanted\KB3DTextures',
        focal='WizardTower', dist=50.0),
    'valhalla': dict(
        blend=r'C:\tmp\blends\valhalla\KB3D_Valhalla-Native.blend',
        tex=r'P:\CG fanbook\3D assets\KitBash3D - Valhalla\Blender\Textures',
        focal='BldgLG_A', dist=38.0),
    'darkfantasy': dict(
        blend=r'C:\tmp\blends\darkfantasy\KB3D_DarkFantasy-Native.blend',
        tex=r'P:\CG fanbook\3D assets\KitBash3D - Dark Fantasy\Textures',
        focal='BldgLG_B', dist=45.0),
}
CFG = WORLDS[WORLD]
OUT = rf'C:\tmp\ehon\{WORLD}_render.png'
W, H = (1024, 1280) if MODE in ('final', 'layers') else (800, 1000)
SAMPLES = 200 if MODE in ('final', 'layers') else 48
os.makedirs(os.path.dirname(OUT), exist_ok=True)
print(f'[ehon] WORLD={WORLD} MODE={MODE} {W}x{H}')

bpy.ops.wm.open_mainfile(filepath=CFG['blend'])
sc = bpy.context.scene

# テクスチャ再リンク
for d in (CFG['tex'],):
    if os.path.isdir(d):
        try:
            bpy.ops.file.find_missing_files(directory=d)
            print(f'[ehon] find_missing_files: {d}')
        except Exception as e:
            print(f'[ehon] ffm err {e}')

sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
try:
    sc.cycles.device = 'GPU'
    cp = bpy.context.preferences.addons['cycles'].preferences
    for ct in ('OPTIX', 'CUDA'):
        try:
            cp.compute_device_type = ct; cp.get_devices()
            if any(d.type != 'CPU' for d in cp.devices):
                for d in cp.devices:
                    d.use = True
                print(f'[ehon] GPU {ct}')
                break
        except Exception as e:
            print('[ehon] gpu', ct, e)
except Exception as e:
    print('[ehon] gpu skip', e)

sc.render.resolution_x = W; sc.render.resolution_y = H
sc.render.film_transparent = True
if sc.world is None:
    sc.world = bpy.data.worlds.new('World')


def obj_center(o):
    acc = Vector((0, 0, 0))
    for c in o.bound_box:
        acc += o.matrix_world @ Vector(c)
    return acc / 8


# 焦点まわり DIST 内だけ残す箱庭化
focal = None
for o in bpy.data.objects:
    if o.type == 'MESH' and CFG['focal'].lower() in o.name.lower():
        focal = obj_center(o); break
if focal is None:
    cs = [obj_center(o) for o in bpy.data.objects if o.type == 'MESH']
    focal = sum(cs, Vector((0, 0, 0))) / max(1, len(cs))
print(f'[ehon] focal={focal}')
kept = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        c = obj_center(o)
        keep = math.hypot(c.x - focal.x, c.y - focal.y) <= CFG['dist']
        o.hide_render = not keep; o.hide_viewport = not keep
        if keep:
            kept.append(o)
    elif o.type == 'LIGHT':
        o.hide_render = False
print(f'[ehon] kept={len(kept)}')

# bbox
mins = Vector((1e9,) * 3); maxs = Vector((-1e9,) * 3)
for o in kept:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mins = Vector((min(mins[i], w[i]) for i in range(3)))
        maxs = Vector((max(maxs[i], w[i]) for i in range(3)))
center = (mins + maxs) / 2; size = maxs - mins; radius = size.length / 2

# カメラ 俯瞰35°
cam_data = bpy.data.cameras.new('EhonCam'); cam_data.lens = 35
cam_data.clip_start = 0.1; cam_data.clip_end = radius * 10
cam = bpy.data.objects.new('EhonCam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
ae = math.radians(35); az = math.radians(-25); dist = radius * 2.2
cam.location = Vector((center.x + dist * math.sin(az) * math.cos(ae),
                       center.y - dist * math.cos(az) * math.cos(ae),
                       center.z + dist * math.sin(ae) + size.z * 0.1))
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()

# ライティング(明るい高キー昼光)
for o in list(bpy.data.objects):
    if o.type == 'LIGHT':
        bpy.data.objects.remove(o, do_unlink=True)
sun_d = bpy.data.lights.new('Sun', 'SUN'); sun_d.energy = 4.5; sun_d.angle = math.radians(8)
sun_d.color = (1.0, 0.96, 0.86)
sun = bpy.data.objects.new('Sun', sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
fill_d = bpy.data.lights.new('Fill', 'SUN'); fill_d.energy = 1.6; fill_d.angle = math.radians(20)
fill_d.color = (0.82, 0.88, 1.0)
fill = bpy.data.objects.new('Fill', fill_d); sc.collection.objects.link(fill)
fill.rotation_euler = (math.radians(60), 0, math.radians(-150))
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.70, 0.80, 0.95, 1.0)
bg.inputs['Strength'].default_value = 1.6

sc.render.use_freestyle = False
sc.view_layers[0].use_freestyle = False
sc.render.use_compositing = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'


def render_to(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


render_to(OUT)
print(f'{WORLD.upper()}_RENDER_DONE {W} {H}')

if MODE == 'layers':
    camp = cam.location
    dd = [((obj_center(o) - camp).length, o) for o in kept]
    ds = sorted(d for d, _ in dd)
    if ds:
        q1 = ds[len(ds) // 3]; q2 = ds[2 * len(ds) // 3]
        groups = {'far': [], 'mid': [], 'fore': []}
        for d, o in dd:
            g = 'far' if d > q2 else ('mid' if d > q1 else 'fore')
            groups[g].append(o)
        for band, objs in groups.items():
            for o in kept:
                o.hide_render = o not in objs
            render_to(rf'C:\tmp\ehon\{WORLD}_mask_{band}.png')
            print(f'MASK_DONE {band} {len(objs)}')
        for o in kept:
            o.hide_render = False
    print('LAYERS_DONE')
