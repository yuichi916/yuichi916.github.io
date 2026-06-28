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

# 簡易マテリアル(羊皮紙)を全パートに付与。SDが表紙/ページを描き分ける。
mat = bpy.data.materials.new('Parchment')
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (0.86, 0.80, 0.66, 1.0)
bsdf.inputs['Roughness'].default_value = 0.85
for o in book_objs:
    o.data.materials.clear()
    o.data.materials.append(mat)

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
ang = math.radians(42)
cam.location = center + Vector((0, -radius * 1.9 * math.cos(ang), radius * 1.9 * math.sin(ang)))
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
