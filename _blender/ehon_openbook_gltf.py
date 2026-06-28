"""方式B ステージ: Enchanted Interiors の Open Book を単体GLB化(原点配置・簡易マテリアル)。
   blender -b --factory-startup --python ehon_openbook_gltf.py
   出力: C:\\tmp\\ehon\\book.glb  (Webで机上の本ステージとして使用。上に城ジオラマが乗る)
"""
import bpy, os
from mathutils import Vector
BLEND = r'C:\tmp\blends\eci\kb3d_enchantedinteriors-native.blend'
OUT = r'C:\tmp\ehon\book.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene

book = [o for o in bpy.data.objects if o.type == 'MESH' and 'PropOpenBook_A' in o.name]
print('[ehon] book meshes', len(book))

# 本以外を削除(データAPIで安全に)
keep = set(book)
for o in list(bpy.data.objects):
    if o not in keep:
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception:
            pass
bpy.context.view_layer.update()

# 親を解除して原点へ(bbox中心XY=0, 最低点Z=0)
o = book[0]
o.parent = None
bpy.context.view_layer.update()
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for c in o.bound_box:
    w = o.matrix_world @ Vector(c)
    mn = Vector((min(mn[i], w[i]) for i in range(3)))
    mx = Vector((max(mx[i], w[i]) for i in range(3)))
ctr = (mn + mx) / 2
o.location -= Vector((ctr.x, ctr.y, mn.z))
bpy.context.view_layer.update()

# 簡易マテリアル(羊皮紙/革)。テクスチャ無しなので単色。
mat = bpy.data.materials.new('BookParchment'); mat.use_nodes = True
b = mat.node_tree.nodes.get('Principled BSDF')
b.inputs['Base Color'].default_value = (0.82, 0.74, 0.58, 1.0)
b.inputs['Roughness'].default_value = 0.9
o.data.materials.clear(); o.data.materials.append(mat)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_apply=True, export_yup=True)
print('BOOK_GLTF_DONE')
