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

# 本物の装飾写本テクスチャ(KB3D_ECI_BooksAtlas_*)を再リンク(元マテリアル維持)。
for _texdir in (r'C:\tmp\blends\eci\eci_textures',
                r'P:\CG fanbook\3D assets\Kitbash3D - Enchanted Interiors\kb3d_enchantedinteriors.png.2k'):
    if os.path.isdir(_texdir):
        try:
            bpy.ops.file.find_missing_files(directory=_texdir)
            print(f'[ehon] find_missing_files: {_texdir}')
            break
        except Exception as e:
            print(f'[ehon] ffm err {e}')

# テクスチャをGLBに埋め込む(WebP圧縮)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_image_format='WEBP', export_image_quality=75,
                          export_apply=True, export_yup=True)
print('BOOK_GLTF_DONE')
