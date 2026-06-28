"""Enchanted 水彩ヒーロー画。Blender内で水彩化完結(Freestyle線画 + コンポジタ水彩)。
   blender -b --factory-startup --python ehon_enchanted_watercolor.py -- preview|final
   出力: C:\\tmp\\ehon\\A_full.png

   構図キュレーション:
   - 主役: WizardTower, BldgSmWatermill, BldgSmUpperTownSquare, BldgLgManor
   - 大樹: PropTree_A, PropTree_B, BldgLgManor_A_Tree
   - それ以外の遠距離メッシュはhide_render=True
   - カメラ: ヒーロー群bboxに合わせ仰角35°の俯瞰全景
"""
import bpy, sys, os, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = (ARGV[0] if ARGV else 'preview').lower()
BLEND = r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend'
OUT   = r'C:\tmp\ehon\A_full.png'
W, H  = (1024, 1280) if MODE in ('final', 'layers') else (800, 1000)
SAMPLES = 200 if MODE in ('final', 'layers') else 48
os.makedirs(os.path.dirname(OUT), exist_ok=True)

print(f'[ehon] MODE={MODE} {W}x{H} samples={SAMPLES}')

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene

# ── テクスチャ再リンク (KitBash native は //KB3DTextures\4k\ を参照するが実体は2k) ──
# find_missing_files は basename 再帰検索なので 4k→2k のフォルダ差を吸収する
TEXROOT = r'C:\tmp\blends\enchanted\KB3DTextures'
try:
    bpy.ops.file.find_missing_files(directory=TEXROOT)
    print('[ehon] find_missing_files done')
except Exception as e:
    print(f'[ehon] find_missing_files err: {e}')

# ── GPU設定 ──────────────────────────────────────────
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
try:
    sc.cycles.device = 'GPU'
    cprefs = bpy.context.preferences.addons['cycles'].preferences
    # OptiX優先、なければCUDA
    for ct in ('OPTIX', 'CUDA'):
        try:
            cprefs.compute_device_type = ct
            cprefs.get_devices()
            devs = [d for d in cprefs.devices if d.type != 'CPU']
            if devs:
                for d in cprefs.devices:
                    d.use = True
                print(f'[ehon] GPU mode: {ct}, devices: {[d.name for d in devs]}')
                break
        except Exception as e:
            print(f'[ehon] {ct} failed: {e}')
except Exception as e:
    print(f'[ehon] GPU setup skipped: {e}')

sc.render.resolution_x = W
sc.render.resolution_y = H
sc.render.film_transparent = True   # 被写体を透過出力(ポストで紙/空に合成。Task3レイヤーと統一)
# World が無いシーンなので先に用意(背景色は後段のBackgroundノードで設定)
if sc.world is None:
    sc.world = bpy.data.worlds.new('World')

# ── 構図: 焦点建築の周囲だけを残し「箱庭」化 ──────────────
# シーンは radius~200 に建物が散在。焦点(主役の城)の周囲 DIST 内だけ残して
# 一つの島の世界が飛び出す密度のあるジオラマにする。
FOCAL_SUBSTR = 'WizardTower'   # 焦点となる主役建築
DIST = 50.0                    # 焦点中心からのXY距離(この範囲を残す。要調整)

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
print(f'[ehon] focal={focal} ({FOCAL_SUBSTR})')

shown = 0
hidden = 0
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        c = obj_center(obj)
        keep = math.hypot(c.x - focal.x, c.y - focal.y) <= DIST
        obj.hide_render = not keep
        obj.hide_viewport = not keep
        shown += int(keep)
        hidden += int(not keep)
    elif obj.type == 'LIGHT':
        obj.hide_render = False
print(f'[ehon] shown={shown} hidden={hidden}')

# ── ヒーロー群のbboxを計測 ──────────────────────────────
mins = Vector((1e9,  1e9,  1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for obj in bpy.data.objects:
    if obj.type == 'MESH' and not obj.hide_render:
        for c in obj.bound_box:
            w = obj.matrix_world @ Vector(c)
            mins = Vector((min(mins.x, w.x), min(mins.y, w.y), min(mins.z, w.z)))
            maxs = Vector((max(maxs.x, w.x), max(maxs.y, w.y), max(maxs.z, w.z)))

center  = (mins + maxs) / 2
size    = maxs - mins
radius  = size.length / 2
print(f'[ehon] bbox center={center} radius={radius:.1f}  size={size}')

# ── カメラ: 俯瞰仰角35°の正面斜め上から ──────────────────
#  縦長フォーマット(1600x2000)に合わせ水平方向を少し引いてfov調整
cam_data = bpy.data.cameras.new('EhonCam')
cam_data.lens = 35          # 35mm — 広角寄りで全景を収める
cam_data.clip_start = 0.1
cam_data.clip_end   = radius * 10

cam = bpy.data.objects.new('EhonCam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam

# カメラ位置: center から仰角35°、やや正面右斜め(読みやすい絵本構図)
ang_elev = math.radians(35)        # 仰角
ang_azim = math.radians(-25)       # 水平回転(正面から-25°右寄り)
dist     = radius * 2.2            # 距離係数: 全景＋余白

cam.location = Vector((
    center.x + dist * math.sin(ang_azim) * math.cos(ang_elev),
    center.y - dist * math.cos(ang_azim) * math.cos(ang_elev),
    center.z + dist * math.sin(ang_elev) + size.z * 0.1,   # 少し上を見せる
))

# カメラをcenterへ向ける
direction = center - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# ── ライティング: 柔らかい昼光(絵本の温かみ) ──────────────
# 既存ライトを消してシンプルな昼光シーンを組む
for obj in bpy.data.objects:
    if obj.type == 'LIGHT':
        bpy.data.objects.remove(obj, do_unlink=True)

# 主光(キー): 右斜め上から、明るい昼光
sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy  = 4.5
sun_data.angle   = math.radians(8)       # 柔らかい影
sun_data.color   = (1.0, 0.96, 0.86)    # 温かみある黄色
sun = bpy.data.objects.new('Sun', sun_data)
sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

# フィル光: 反対側から弱く当てて影を持ち上げる(高キーの絵本トーン)
fill_data = bpy.data.lights.new('Fill', 'SUN')
fill_data.energy = 1.6
fill_data.angle  = math.radians(20)
fill_data.color  = (0.82, 0.88, 1.0)    # 冷たい空色のフィル
fill = bpy.data.objects.new('Fill', fill_data)
sc.collection.objects.link(fill)
fill.rotation_euler = (math.radians(60), 0, math.radians(-150))

# 環境光: 明るい空色のソフトアンビエント(全体を持ち上げる)
if sc.world is None:
    sc.world = bpy.data.worlds.new('World')
sc.world.use_nodes = True
wnt = sc.world.node_tree
bg_node = wnt.nodes.get('Background')
if bg_node is None:
    bg_node = wnt.nodes.new('ShaderNodeBackground')
bg_node.inputs['Color'].default_value   = (0.70, 0.80, 0.95, 1.0)   # 明るい空色
bg_node.inputs['Strength'].default_value = 1.6

# ── Freestyle 線画は無効 ─────────────────────────────────
# KitBashの重複エッジ大量のメッシュで Freestyle がC++例外クラッシュ(Blender 5.1)。
# 絵本のインク輪郭線は後段ポスト(ehon_watercolor_post.py)で luminance Sobel から付与する。
sc.render.use_freestyle = False
sc.view_layers[0].use_freestyle = False

# ── レンダ実行(クリーン: Freestyleインク + 温かい昼光) ──────────
# 水彩ウォッシュ/にじみ/紙肌は後段の決定論的Pythonポスト(ehon_watercolor_post.py)で付与。
# Blender 5.1 のコンポジタは Mix/Composite 等クラシックノードが廃止されAPIが不安定なため、
# 3D・インク線・ライティング・構図のみBlenderが担い、水彩化はPIL/numpy(=非AI)で行う。
sc.render.use_compositing = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode  = 'RGBA'
sc.render.image_settings.color_depth = '8'

kept = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]


def render_to(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# 全景クリーンレンダ(SDのinit元)
render_to(r'C:\tmp\ehon\A_render.png')
print(f'A_RENDER_DONE {W} {H}')

if MODE == 'layers':
    # ── 距離グループ(far/mid/fore)のアルファマスクを出力 ──
    # SD水彩画像を深度層に切り出すため、カメラ距離で3分割し各グループ単独の
    # シルエット(アルファ)をレンダする。SDが構図を保つので A_render と整合。
    camp = cam.location
    dist_of = [( (obj_center(o) - camp).length, o) for o in kept]
    ds = sorted(d for d, _ in dist_of)
    if ds:
        q1 = ds[len(ds) // 3]
        q2 = ds[2 * len(ds) // 3]
        groups = {'far': [], 'mid': [], 'fore': []}
        for d, o in dist_of:
            g = 'far' if d > q2 else ('mid' if d > q1 else 'fore')
            groups[g].append(o)
        for band, objs in groups.items():
            for o in kept:
                o.hide_render = o not in objs
            render_to(rf'C:\tmp\ehon\A_mask_{band}.png')
            print(f'MASK_DONE {band} {len(objs)}')
        for o in kept:
            o.hide_render = False
    print('LAYERS_DONE')
