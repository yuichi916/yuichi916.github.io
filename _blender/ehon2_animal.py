"""動物 STL → クレイ質感 GLB (Draco)
usage: blender -b --factory-startup --python ehon2_animal.py -- <animalId> <stlPath> [decimate_ratio]
出力: C:\tmp\ehon2\animal_<animalId>_v1.glb (≤1MB 目標)
"""
import bpy, sys, os

ARGV = sys.argv[sys.argv.index('--') + 1:]
AID, STL = ARGV[0], ARGV[1]
RATIO = float(ARGV[2]) if len(ARGV) > 2 else 0.02   # 数百万頂点 → 数万
OUT = rf'C:\tmp\ehon2\animal_{AID}_v1.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=STL)
obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = obj

# 3Dプリント用サポート等の分離ゴミがあれば最大アイランドのみ残す前提だが、
# pre-supported でない本体 STL を使うこと (wolf-pup.stl の方。*-pre-supported.stl は使わない)
m = obj.modifiers.new('dec', 'DECIMATE'); m.ratio = RATIO
bpy.ops.object.modifier_apply(modifier='dec')
print('[ehon2] verts after decimate:', len(obj.data.vertices))

# クレイ質感 (単色・微ラフ)
mat = bpy.data.materials.new('clay'); mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.82, 0.74, 0.62, 1.0)  # 生成りクレイ
bsdf.inputs['Roughness'].default_value = 0.85
obj.data.materials.clear(); obj.data.materials.append(mat)

# 原点を底面中央に・向きは STL のまま (頁組込みで調整)
import mathutils
mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
for c in obj.bound_box:
    w = obj.matrix_world @ mathutils.Vector(c)
    mn = mathutils.Vector((min(mn[i], w[i]) for i in range(3)))
    mx = mathutils.Vector((max(mx[i], w[i]) for i in range(3)))
obj.location -= mathutils.Vector(((mn.x+mx.x)/2, (mn.y+mx.y)/2, mn.z))

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_apply=True, export_yup=True)
size_mb = os.path.getsize(OUT) / 1048576
print(f'[ehon2] {OUT} = {size_mb:.2f} MB')
assert size_mb <= 1.0, f'animal GLB over budget: {size_mb:.2f} MB — decimate_ratio を下げる'
print(f'{AID.upper()}_ANIMAL_DONE')
