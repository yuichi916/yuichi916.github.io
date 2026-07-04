"""汎用 世界GLB: 任意キットの焦点ジオラマを軽量GLB化(テクスチャ付き)。
   blender -b --factory-startup --python ehon_world_gltf.py -- <world>
   出力: C:\\tmp\\ehon\\<world>_diorama.glb
"""
import bpy, sys, os, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WORLD = ARGV[0] if ARGV else 'enchanted'

WORLDS = {
    'enchanted': dict(blend=r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend',
                      tex=r'C:\tmp\blends\enchanted\KB3DTextures', focal='WizardTower', dist=50.0),
    'valhalla': dict(blend=r'C:\tmp\blends\valhalla\KB3D_Valhalla-Native.blend',
                     tex=r'P:\CG fanbook\3D assets\KitBash3D - Valhalla\Blender\Textures', focal='BldgLG_A', dist=38.0),
    'darkfantasy': dict(blend=r'C:\tmp\blends\darkfantasy\KB3D_DarkFantasy-Native.blend',
                        tex=r'P:\CG fanbook\3D assets\KitBash3D - Dark Fantasy\Textures', focal='BldgLG_B', dist=45.0),
}
CFG = WORLDS[WORLD]
OUT = rf'C:\tmp\ehon\{WORLD}_diorama.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=CFG['blend'])
if os.path.isdir(CFG['tex']):
    try:
        bpy.ops.file.find_missing_files(directory=CFG['tex'])
    except Exception as e:
        print('[ehon] ffm err', e)


def obj_center(o):
    acc = Vector((0, 0, 0))
    for c in o.bound_box:
        acc += o.matrix_world @ Vector(c)
    return acc / 8


focal = None
for o in bpy.data.objects:
    if o.type == 'MESH' and CFG['focal'].lower() in o.name.lower():
        focal = obj_center(o); break
if focal is None:
    cs = [obj_center(o) for o in bpy.data.objects if o.type == 'MESH']
    focal = sum(cs, Vector((0, 0, 0))) / max(1, len(cs))

keep = [o for o in bpy.data.objects if o.type == 'MESH'
        and math.hypot(obj_center(o).x - focal.x, obj_center(o).y - focal.y) <= CFG['dist']]
print(f'[ehon] {WORLD} keep={len(keep)}')

keepset = set(keep)
for o in list(bpy.data.objects):
    if o not in keepset:
        bpy.data.objects.remove(o, do_unlink=True)

for o in keep:
    if o.type == 'MESH' and len(o.data.vertices) > 15000:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.4

mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in keep:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector((min(mn[i], w[i]) for i in range(3)))
        mx = Vector((max(mx[i], w[i]) for i in range(3)))
center = (mn + mx) / 2
for o in keep:
    o.location -= Vector((center.x, center.y, mn.z))

MAXTEX = 1024
for im in bpy.data.images:
    try:
        w, h = im.size
        if w > MAXTEX or h > MAXTEX:
            s = MAXTEX / max(w, h)
            im.scale(max(1, int(w * s)), max(1, int(h * s)))
    except Exception:
        pass

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_image_format='WEBP', export_image_quality=60,
                          export_apply=True, export_yup=True)
print(f'{WORLD.upper()}_GLTF_DONE')
