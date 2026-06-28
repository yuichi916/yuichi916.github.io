"""方式B: Enchanted の焦点ジオラマを軽量GLB化(テクスチャ付き)。
   blender -b --factory-startup --python ehon_enchanted_gltf.py
   出力: C:\\tmp\\ehon\\B_diorama.glb
   方式Aと同じ構図(焦点WizardTower周囲DIST)を3D書き出し。モバイル配信のためWebP圧縮+デシメート。
"""
import bpy, os, math
from mathutils import Vector

BLEND = r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend'
OUT   = r'C:\tmp\ehon\B_diorama.glb'
TEXROOT = r'C:\tmp\blends\enchanted\KB3DTextures'
FOCAL_SUBSTR = 'WizardTower'
DIST = 50.0
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene

# テクスチャ再リンク(4k参照→ローカル2k)
try:
    bpy.ops.file.find_missing_files(directory=TEXROOT)
    print('[ehon] find_missing_files done')
except Exception as e:
    print(f'[ehon] find_missing_files err: {e}')


def obj_center(o):
    acc = Vector((0, 0, 0))
    for c in o.bound_box:
        acc += o.matrix_world @ Vector(c)
    return acc / 8


focal = None
for o in bpy.data.objects:
    if o.type == 'MESH' and FOCAL_SUBSTR.lower() in o.name.lower():
        focal = obj_center(o)
        break
if focal is None:
    cs = [obj_center(o) for o in bpy.data.objects if o.type == 'MESH']
    focal = sum(cs, Vector((0, 0, 0))) / max(1, len(cs))

keep = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        c = obj_center(o)
        if math.hypot(c.x - focal.x, c.y - focal.y) <= DIST:
            keep.append(o)
print(f'[ehon] keep={len(keep)}')

# 不要オブジェクト削除(operatorはView Layer外オブジェクトで壊れるためデータAPIで削除)
keepset = set(keep)
for o in list(bpy.data.objects):
    if o not in keepset:
        bpy.data.objects.remove(o, do_unlink=True)

# デシメート(重メッシュ)
for o in keep:
    if o.type == 'MESH' and len(o.data.vertices) > 15000:
        m = o.modifiers.new('dec', 'DECIMATE')
        m.ratio = 0.4

# 原点へ寄せ(全体bbox中心を原点、最低点を接地)
mins = Vector((1e9,) * 3); maxs = Vector((-1e9,) * 3)
for o in keep:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mins = Vector((min(mins[i], w[i]) for i in range(3)))
        maxs = Vector((max(maxs[i], w[i]) for i in range(3)))
center = (mins + maxs) / 2
for o in keep:
    o.location -= Vector((center.x, center.y, mins.z))  # XY中心化, Z接地

# テクスチャ縮小(モバイル容量対策): 最大辺1024へ
MAXTEX = 1024
for im in bpy.data.images:
    try:
        w, h = im.size
        if w > MAXTEX or h > MAXTEX:
            s = MAXTEX / max(w, h)
            im.scale(max(1, int(w * s)), max(1, int(h * s)))
            print(f'[ehon] scaled {im.name} {w}x{h}->{im.size[0]}x{im.size[1]}')
    except Exception as e:
        print(f'[ehon] scale skip {im.name}: {e}')

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_image_format='WEBP',
    export_image_quality=60,
    export_apply=True,
    export_yup=True,
)
print('GLTF_DONE')
