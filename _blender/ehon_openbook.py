"""ステージ基盤: Enchanted Interiors の Open Book を単体で水彩レンダ(透過)。
   blender -b --factory-startup --python ehon_openbook.py -- preview|final
   出力: C:\\tmp\\ehon\\book_render.png (透過・後段でSD水彩化)
   ECIにテクスチャ別出しが無いため簡易マテリアル(羊皮紙ページ+革表紙)を付与しSDで画風化。
"""
import bpy, sys, os, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = (ARGV[0] if ARGV else 'preview').lower()
BLEND = r'C:\tmp\blends\eci\kb3d_enchantedinteriors-native.blend'
OUT   = r'C:\tmp\ehon\book_render.png'
W, H  = (1280, 960) if MODE in ('final',) else (800, 600)
SAMPLES = 160 if MODE == 'final' else 40
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# eci blend を開いて Open Book 以外を hide(append方式は factory scene が黒レンダになるため
# castleで実績のある open_mainfile + hide 方式を使う)。本は _grp(-29,-22)配下の実位置に在る。
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
book_objs = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        is_book = ('PropOpenBook_A' in o.name)
        o.hide_render = not is_book
        o.hide_viewport = not is_book
        if is_book:
            book_objs.append(o)
bpy.context.view_layer.update()
print(f'[ehon] book meshes={len(book_objs)}')

# 本物の装飾写本テクスチャ(KB3D_ECI_BooksAtlas_*)を再リンク。
# ECIのテクスチャは kb3d_enchantedinteriors.png.2k フォルダにある(ローカルコピー済)。
# 元の BooksAtlas マテリアルをそのまま使い、城と同じく find_missing_files で解決する。
for _texdir in (r'C:\tmp\blends\eci\eci_textures',
                r'P:\CG fanbook\3D assets\Kitbash3D - Enchanted Interiors\kb3d_enchantedinteriors.png.2k'):
    if os.path.isdir(_texdir):
        try:
            bpy.ops.file.find_missing_files(directory=_texdir)
            print(f'[ehon] find_missing_files: {_texdir}')
            break
        except Exception as e:
            print(f'[ehon] ffm err {e}')


# ── 分厚い本にする: 開いた本の下にページ束ブロックを追加(ページ数を増やす) ──
def add_page_stack(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector((min(mn[i], w[i]) for i in range(3)))
            mx = Vector((max(mx[i], w[i]) for i in range(3)))
    ctr = (mn + mx) / 2; sx = mx.x - mn.x; sy = mx.y - mn.y; th = mx.z - mn.z
    stackh = max(th * 3.2, 0.12)
    # ブロック上面を本の下半分に食い込ませて一体化(隙間なし=分厚い一冊に見せる)
    top_z = mn.z + th * 0.5
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(ctr.x, ctr.y, top_z - stackh * 0.5))
    blk = bpy.context.active_object; blk.name = 'PageStack'
    blk.scale = (sx * 0.985 * 0.5, sy * 0.985 * 0.5, stackh * 0.5)
    pages = bpy.data.materials.new('StackPages'); pages.use_nodes = True
    pbs = pages.node_tree.nodes.get('Principled BSDF'); pbs.inputs['Roughness'].default_value = 0.95
    tex = pages.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(r'C:\tmp\ehon\pageedge.png', check_existing=True)
    pages.node_tree.links.new(tex.outputs['Color'], pbs.inputs['Base Color'])
    leather = bpy.data.materials.new('StackLeather'); leather.use_nodes = True
    lbs = leather.node_tree.nodes.get('Principled BSDF')
    lbs.inputs['Base Color'].default_value = (0.20, 0.10, 0.06, 1.0); lbs.inputs['Roughness'].default_value = 0.5
    blk.data.materials.append(pages)    # 0 = ページ小口
    blk.data.materials.append(leather)  # 1 = 革(底)
    for poly in blk.data.polygons:
        poly.material_index = 1 if poly.normal.z < -0.5 else 0
    return blk


# 開いた本のページ束を分厚く: Z方向にスケール(各ページの束が厚い豪華本に)
for _o in book_objs:
    _o.scale.z *= 1.4
bpy.context.view_layer.update()

# bbox
mins = Vector((1e9,) * 3); maxs = Vector((-1e9,) * 3)
for o in book_objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mins = Vector((min(mins[i], w[i]) for i in range(3)))
        maxs = Vector((max(maxs[i], w[i]) for i in range(3)))
center = (mins + maxs) / 2
size = maxs - mins
radius = size.length / 2
print(f'[ehon] book bbox center={center} size={size}')

# カメラ: 開いたページが見える、やや上から手前に傾けた俯瞰
cam_data = bpy.data.cameras.new('BookCam'); cam_data.lens = 45
cam = bpy.data.objects.new('BookCam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
ang = math.radians(30)   # 低めの俯瞰で革の表紙・背表紙の厚みを見せる
cam.location = center + Vector((0, -radius * 1.5 * math.cos(ang), radius * 1.5 * math.sin(ang)))
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()

# ライティング(明るい昼光)
sun_d = bpy.data.lights.new('Sun', 'SUN'); sun_d.energy = 4.0; sun_d.angle = math.radians(8)
sun_d.color = (1.0, 0.96, 0.88)
sun = bpy.data.objects.new('Sun', sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
if sc.world is None:
    sc.world = bpy.data.worlds.new('World')
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.72, 0.80, 0.92, 1.0)
bg.inputs['Strength'].default_value = 1.5

# レンダ(透過, GPU)
sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES
try:
    sc.cycles.device = 'GPU'
    cp = bpy.context.preferences.addons['cycles'].preferences
    cp.compute_device_type = 'OPTIX'; cp.get_devices()
    for d in cp.devices:
        d.use = True
except Exception as e:
    print('[ehon] gpu', e)
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.render.film_transparent = True
sc.render.use_freestyle = False
sc.view_layers[0].use_freestyle = False
sc.render.use_compositing = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print(f'BOOK_RENDER_DONE {W} {H}')
