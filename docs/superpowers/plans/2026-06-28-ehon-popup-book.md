# 飛び出す絵本ページ `ehon.html` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enchanted 世界を「水彩レイヤー飛び出し絵本(方式A)」と「リアル3Dジオラマ飛び出し(方式B)」の2方式で `ehon.html` に実装し、画面トグルで A/B を見比べて採用方式を決める。

**Architecture:** Blender headless で Enchanted .blend から (A)水彩レイヤーPNG群 と (B)軽量GLTF を生成 → pCloud public folder に配置 → 単一 `ehon.html`(GitHub Pages) が pCloud public URL でアセットを参照。Web は「机の上の閉じた本→クリックで開く→世界がせり上がる」共通シェルの中に方式A(CSS/Three.js平面の視差ポップアップ)と方式B(Three.js GLTFジオラマ)を載せ、トグルで切替。

**Tech Stack:** Blender (Cycles + Freestyle + コンポジタ, headless `-b --python`), Python(Blender bpy), Three.js r160+ (GLTFLoader / DRACOLoader / OrbitControls), 素のHTML/CSS/JS(単一ファイル), Playwright(検証), pCloud public folder(配信).

## Global Constraints

- ページは単一ファイル `C:\projects\yuichi916.github.io\ehon.html`。GitHub Pages 配信
- 巨大バイナリ(GLTF/PNGレイヤー/本ベース画像)はリポジトリに入れず pCloud public folder(`P:\Public Folder`)に置き public 直リンクで参照
- アセットURLは `ehon.html` 冒頭の単一定数 `ASSET_BASE` に集約(ローカル開発時はローカルパス、deploy前にpCloud public URLへ差替え)
- .blend は pCloud Drive 直開き禁止(ハング回避)。`C:\tmp\blends\` にローカルコピーしてから開く
- Blender 起動: `blender -b --factory-startup --python <script> -- <mode>`。スクリプトは `C:\projects\yuichi916.github.io\_blender\` に置く
- 水彩化は Blender 内で完結(外部 Stable Diffusion を使わない)
- 方式Bはモバイル配信を捨てない。GLTF は Draco 圧縮 + テクスチャは KTX2/解像度調整で容量最適化(目標 数十MB以内)
- commit 前に `python C:/tmp/check_dup_const.py C:\projects\yuichi916.github.io\ehon.html` を exit 0 で通す
- Windows: Python実行は `PYTHONUTF8=1` を前置。日本語テキストは正書法保持
- デプロイ(git push)前に必ずユーザーにA/Bプレビュー(スクリーンショット)を提示し承認を得る

---

## Phase 1 — Enchanted アセット生成(Blender)

### Task 1: Blender環境確認とシーン棚卸し

**Files:**
- Create: `C:\projects\yuichi916.github.io\_blender\ehon_enchanted_inspect.py`
- Output: `C:\tmp\ehon\inspect.json`(コレクション/オブジェクト数/bbox/カメラ一覧)

**Interfaces:**
- Produces: `C:\tmp\blends\enchanted\kb3d_enchanted-native.blend`(ローカルコピー), `inspect.json`(構図決定に使う在庫表)

- [ ] **Step 1: Blender実行ファイルを特定**

Run:
```bash
ls "/c/Program Files/Blender Foundation/"/*/blender.exe 2>/dev/null; \
ls "/c/Program Files/Blender"/*/blender.exe 2>/dev/null; \
where.exe blender 2>/dev/null
```
Expected: 1つ以上のパス。見つからなければユーザーに確認。以降このパスを `BLENDER` とする(例 `C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`)

- [ ] **Step 2: .blendをローカルへコピー**

Run:
```bash
mkdir -p /c/tmp/blends/enchanted /c/tmp/ehon && \
cp "P:/CG fanbook/3D assets/KitBash3D - Enchanted/kb3d_enchanted-native.blend" /c/tmp/blends/enchanted/
```
Expected: コピー完了(数GB。時間がかかる)。`ls -la /c/tmp/blends/enchanted/` でサイズ確認

- [ ] **Step 3: 棚卸しスクリプトを書く**

`_blender/ehon_enchanted_inspect.py`:
```python
"""Enchanted シーン棚卸し: コレクション/オブジェクト/bbox/カメラを inspect.json に出力。
   blender -b --factory-startup --python ehon_enchanted_inspect.py
"""
import bpy, json, os
from mathutils import Vector

BLEND = r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend'
OUT   = r'C:\tmp\ehon\inspect.json'
bpy.ops.wm.open_mainfile(filepath=BLEND)

def wbbox(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs=[c.x for c in cs]; ys=[c.y for c in cs]; zs=[c.z for c in cs]
    return [min(xs),min(ys),min(zs),max(xs),max(ys),max(zs)]

cols = {}
for c in bpy.data.collections:
    cols[c.name] = len([o for o in c.all_objects if o.type=='MESH'])
meshes = []
for o in bpy.data.objects:
    if o.type=='MESH':
        meshes.append({'name':o.name, 'verts':len(o.data.vertices), 'bbox':wbbox(o)})
meshes.sort(key=lambda m:-m['verts'])
cams = [o.name for o in bpy.data.objects if o.type=='CAMERA']
data = {'collections':cols, 'mesh_count':len(meshes), 'top_meshes':meshes[:40], 'cameras':cams}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT,'w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('INSPECT_DONE', len(meshes), 'meshes')
```

- [ ] **Step 4: 実行して棚卸し**

Run:
```bash
"$BLENDER" -b --factory-startup --python "C:\projects\yuichi916.github.io\_blender\ehon_enchanted_inspect.py"
```
Expected: 末尾に `INSPECT_DONE <n> meshes`。`/c/tmp/ehon/inspect.json` が生成される

- [ ] **Step 5: 棚卸し結果を読み構図候補を決める**

`inspect.json` を Read。妖精建築/大樹/水辺/橋に当たる collection・mesh 名を5〜10個メモ(方式A構図 と 方式B厳選 の両方に使う)。コレクション命名が KitBash 標準(建物/植生/地形等)かを確認

- [ ] **Step 6: スクリプトをコミット**

```bash
cd C:\projects\yuichi916.github.io && git add _blender/ehon_enchanted_inspect.py && git commit -m "feat(ehon): Enchanted シーン棚卸しスクリプト"
```

---

### Task 2: 方式A — 水彩ヒーロー画レンダ(単一フラット画)

**Files:**
- Create: `C:\projects\yuichi916.github.io\_blender\ehon_enchanted_watercolor.py`
- Output: `C:\tmp\ehon\A_full.png`(水彩フラット全景, 1600x2000 縦)

**Interfaces:**
- Consumes: Task1 の構図メモ(採用コレクション/mesh名), `C:\tmp\blends\enchanted\...blend`
- Produces: `A_full.png`(方式Aの見た目評価用 兼 Task3 のレイヤ分解元)

- [ ] **Step 1: 水彩レンダスクリプトを書く**

`_blender/ehon_enchanted_watercolor.py`。要点を全て含む:
```python
"""Enchanted 水彩ヒーロー画。Blender内で水彩化完結(Freestyle線画 + コンポジタ水彩)。
   blender -b --factory-startup --python ehon_enchanted_watercolor.py -- preview|final
   出力: C:\\tmp\\ehon\\A_full.png
"""
import bpy, sys, os, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = (ARGV[0] if ARGV else 'preview').lower()
BLEND = r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend'
OUT   = r'C:\tmp\ehon\A_full.png'
W,H = (1600,2000) if MODE=='final' else (800,1000)
SAMPLES = 256 if MODE=='final' else 48
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
try:
    sc.cycles.device = 'GPU'
    cprefs = bpy.context.preferences.addons['cycles'].preferences
    cprefs.compute_device_type = 'OPTIX' if any('OptiX' in d.name for d in cprefs.devices) else 'CUDA'
    for d in cprefs.devices: d.use = True
except Exception as e:
    print('GPU setup skipped', e)
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.render.film_transparent = False

# --- カメラ: 仰角30-40°の俯瞰(参照画像準拠)。Task1のbboxから全景を収める ---
cam_data = bpy.data.cameras.new('EhonCam'); cam = bpy.data.objects.new('EhonCam', cam_data)
sc.collection.objects.link(cam); sc.camera = cam
# シーン全体bboxの中心と半径を概算
mins=Vector((1e9,1e9,1e9)); maxs=Vector((-1e9,-1e9,-1e9))
for o in bpy.data.objects:
    if o.type=='MESH':
        for c in o.bound_box:
            w=o.matrix_world@Vector(c)
            mins=Vector((min(mins.x,w.x),min(mins.y,w.y),min(mins.z,w.z)))
            maxs=Vector((max(maxs.x,w.x),max(maxs.y,w.y),max(maxs.z,w.z)))
center=(mins+maxs)/2; radius=(maxs-mins).length/2
ang=math.radians(35)
cam.location = center + Vector((0, -radius*1.7*math.cos(ang), radius*1.7*math.sin(ang)+center.z))
# 注視点をcenterへ
d = center - cam.location
cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
cam_data.lens = 50

# --- Freestyle 線画(絵本の輪郭) ---
sc.render.use_freestyle = True
vl = sc.view_layers[0]
vl.use_freestyle = True
fs = vl.freestyle_settings
ls = fs.linesets[0] if fs.linesets else fs.linesets.new('ehon')
ls.linestyle.color = (0.15,0.12,0.10)
ls.linestyle.thickness = 1.6

# --- コンポジタ: 水彩化(色調を柔らかく+紙テクスチャ乗算+にじみ) ---
sc.use_nodes = True
nt = sc.node_tree; nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers')
# 彩度/明度を水彩寄りに
hsv = nt.nodes.new('CompositorNodeHueSat'); hsv.inputs['Saturation'].default_value = 0.82
hsv.inputs['Value'].default_value = 1.08
# 軽いブラーでにじみ
blur = nt.nodes.new('CompositorNodeBlur'); blur.filter_type='GAUSS'; blur.size_x=3; blur.size_y=3
mix_blur = nt.nodes.new('CompositorNodeMixRGB'); mix_blur.blend_type='MIX'; mix_blur.inputs['Fac'].default_value=0.35
# 紙テクスチャ乗算(手続き的: ノイズ)
tex = nt.nodes.new('CompositorNodeTexture')
paper = bpy.data.textures.new('paper','NOISE')
tex.texture = paper
mul = nt.nodes.new('CompositorNodeMixRGB'); mul.blend_type='MULTIPLY'; mul.inputs['Fac'].default_value=0.12
comp = nt.nodes.new('CompositorNodeComposite')
out = nt.nodes.new('CompositorNodeOutputFile'); out.base_path=os.path.dirname(OUT); out.file_slots[0].path='A_full_'
nt.links.new(rl.outputs['Image'], hsv.inputs['Image'])
nt.links.new(hsv.outputs['Image'], blur.inputs['Image'])
nt.links.new(hsv.outputs['Image'], mix_blur.inputs[1])
nt.links.new(blur.outputs['Image'], mix_blur.inputs[2])
nt.links.new(mix_blur.outputs['Image'], mul.inputs[1])
nt.links.new(tex.outputs['Color'], mul.inputs[2])
nt.links.new(mul.outputs['Image'], comp.inputs['Image'])
nt.links.new(mul.outputs['Image'], out.inputs['Image'])

sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('A_FULL_DONE', W, H)
```

- [ ] **Step 2: preview解像度でレンダ**

Run:
```bash
"$BLENDER" -b --factory-startup --python "C:\projects\yuichi916.github.io\_blender\ehon_enchanted_watercolor.py" -- preview
```
Expected: 末尾 `A_FULL_DONE 800 1000`。`/c/tmp/ehon/A_full.png` 生成(0バイトでない)

- [ ] **Step 3: 画像を目視確認**

`C:\tmp\ehon\A_full.png` を Read(画像表示)。確認: 妖精世界の全景が収まる/水彩タッチ(線画+柔らかい色+紙質)が出ている/暗すぎ・白飛びしていない。NGならカメラ仰角・lens・HSV/blur/紙Facをこのタスク内で調整して再レンダ(構図とトーンが参照画像に寄るまで反復。妥協版で先に進まない)

- [ ] **Step 4: final解像度でレンダ**

Run:
```bash
"$BLENDER" -b --factory-startup --python "C:\projects\yuichi916.github.io\_blender\ehon_enchanted_watercolor.py" -- final
```
Expected: `A_FULL_DONE 1600 2000`。再度 Read で品質確認

- [ ] **Step 5: コミット**

```bash
cd C:\projects\yuichi916.github.io && git add _blender/ehon_enchanted_watercolor.py && git commit -m "feat(ehon): 方式A Enchanted水彩ヒーロー画レンダ"
```

---

### Task 3: 方式A — 深度レイヤー分解(透過PNG群)

**Files:**
- Modify: `C:\projects\yuichi916.github.io\_blender\ehon_enchanted_watercolor.py`(レイヤー出力モード追加)
- Output: `C:\tmp\ehon\A_layer_{sky,far,mid,fore}.png`(透過PNG 4層)

**Interfaces:**
- Consumes: Task2 の水彩設定・カメラ
- Produces: `A_layer_sky.png` / `A_layer_far.png` / `A_layer_mid.png` / `A_layer_fore.png`(同一カメラ・同一画角・透過。Web の LayerStack が z 順に重ねる)

- [ ] **Step 1: レイヤー分解関数を追記**

`ehon_enchanted_watercolor.py` に `MODE=='layers'` 分岐を追加。各層を「カメラからの距離(Task1 bbox)」でオブジェクトをグルーピングし、対象層以外を `hide_render=True` にして `film_transparent=True` で4回レンダ。空は単独のグラデ平面 or world のみ:
```python
def render_layers():
    sc.render.film_transparent = True
    cam_pos = sc.camera.location
    groups = {'far':[], 'mid':[], 'fore':[]}
    dists = []
    for o in bpy.data.objects:
        if o.type!='MESH': continue
        c = sum((o.matrix_world@Vector(cc) for cc in o.bound_box), Vector())/8
        dists.append(((c-cam_pos).length, o))
    if not dists:
        print('NO_MESH'); return
    ds = sorted(d for d,_ in dists)
    q1 = ds[len(ds)//3]; q2 = ds[2*len(ds)//3]
    for dist,o in dists:
        g = 'far' if dist>q2 else ('mid' if dist>q1 else 'fore')
        groups[g].append(o)
    allmesh = [o for o in bpy.data.objects if o.type=='MESH']
    for layer,objs in groups.items():
        for o in allmesh: o.hide_render = (o not in objs)
        sc.render.filepath = rf'C:\tmp\ehon\A_layer_{layer}.png'
        bpy.ops.render.render(write_still=True)
        print('LAYER_DONE', layer, len(objs))
    for o in allmesh: o.hide_render = False
    # 空: メッシュ全非表示でworldのみ
    for o in allmesh: o.hide_render = True
    sc.render.film_transparent = False
    sc.render.filepath = r'C:\tmp\ehon\A_layer_sky.png'
    bpy.ops.render.render(write_still=True)
    print('LAYER_DONE sky')
    for o in allmesh: o.hide_render = False

if MODE=='layers':
    render_layers()
else:
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print('A_FULL_DONE', W, H)
```
注: 上の `if MODE=='layers'` ブロックは Task2 スクリプト末尾の `bpy.ops.render.render(write_still=True); print('A_FULL_DONE'...)` を置き換える形で挿入する

- [ ] **Step 2: レイヤーレンダ実行**

Run:
```bash
"$BLENDER" -b --factory-startup --python "C:\projects\yuichi916.github.io\_blender\ehon_enchanted_watercolor.py" -- layers
```
Expected: `LAYER_DONE far/mid/fore/sky` が出る。4つの `A_layer_*.png` 生成

- [ ] **Step 3: 各層を目視確認**

4枚を Read。確認: far/mid/fore が透過背景で正しく分離/重ねたとき全景に復元できる/前景に十分なオブジェクトがある。分離が悪ければ q1/q2 のしきい値をこのタスク内で調整

- [ ] **Step 4: コミット**

```bash
cd C:\projects\yuichi916.github.io && git add _blender/ehon_enchanted_watercolor.py && git commit -m "feat(ehon): 方式A 深度レイヤー分解出力"
```

---

### Task 4: 方式B — 軽量GLTFジオラマ書き出し

**Files:**
- Create: `C:\projects\yuichi916.github.io\_blender\ehon_enchanted_gltf.py`
- Output: `C:\tmp\ehon\B_diorama.glb`(Draco圧縮, モバイル容量目標 数十MB以内)

**Interfaces:**
- Consumes: Task1 の厳選mesh名リスト
- Produces: `B_diorama.glb`(Web の DioramaScene が GLTFLoader+DRACOLoader でロード)

- [ ] **Step 1: GLTF書き出しスクリプトを書く**

`_blender/ehon_enchanted_gltf.py`:
```python
"""Enchanted 小島ジオラマを軽量GLB化。デシメート+Draco。
   blender -b --factory-startup --python ehon_enchanted_gltf.py
   出力: C:\\tmp\\ehon\\B_diorama.glb
"""
import bpy, os
from mathutils import Vector
BLEND = r'C:\tmp\blends\enchanted\kb3d_enchanted-native.blend'
OUT   = r'C:\tmp\ehon\B_diorama.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)

# Task1で決めた厳選コレクション/オブジェクト名(置換する)
KEEP_SUBSTR = ['Building','House','Tower','Tree','Bridge','Rock','Ground','Water']  # ← inspect.json に合わせ調整
keep = [o for o in bpy.data.objects if o.type=='MESH' and any(s.lower() in o.name.lower() for s in KEEP_SUBSTR)]
if not keep:
    keep = [o for o in bpy.data.objects if o.type=='MESH'][:30]
# 全体中心へ寄せ・スケール正規化のため bbox 計算
mins=Vector((1e9,)*3); maxs=Vector((-1e9,)*3)
for o in keep:
    for c in o.bound_box:
        w=o.matrix_world@Vector(c)
        mins=Vector((min(mins[i],w[i]) for i in range(3)))
        maxs=Vector((max(maxs[i],w[i]) for i in range(3)))
center=(mins+maxs)/2
# 不要オブジェクト削除
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type=='MESH' and o not in keep:
        o.select_set(True)
bpy.ops.object.delete()
# デシメート(重メッシュ)
for o in keep:
    if len(o.data.vertices) > 20000:
        m = o.modifiers.new('dec','DECIMATE'); m.ratio = 0.35
# 原点へ移動
for o in keep:
    o.location -= center
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_apply=True, export_yup=True)
print('GLTF_DONE')
```

- [ ] **Step 2: 書き出し実行**

Run:
```bash
"$BLENDER" -b --factory-startup --python "C:\projects\yuichi916.github.io\_blender\ehon_enchanted_gltf.py"
```
Expected: `GLTF_DONE`。`/c/tmp/ehon/B_diorama.glb` 生成

- [ ] **Step 3: 容量を計測しモバイル予算に収める**

Run: `ls -la /c/tmp/ehon/B_diorama.glb`
Expected: 数十MB以内。超過なら KEEP_SUBSTR を絞る / DECIMATE ratio を下げる / テクスチャ解像度を下げて(`export_image_quality` やテクスチャリサイズ)再書き出し。妥協せず予算内で見栄えを確保

- [ ] **Step 4: GLBが正しく開けるか確認**

簡易 three.js ローダ確認は Task8 で行うため、ここではバイナリ健全性のみ:
Run: `head -c 4 /c/tmp/ehon/B_diorama.glb | xxd` → `glTF`(0x676c5446) を確認

- [ ] **Step 5: コミット**

```bash
cd C:\projects\yuichi916.github.io && git add _blender/ehon_enchanted_gltf.py && git commit -m "feat(ehon): 方式B 軽量GLTFジオラマ書き出し"
```

---

### Task 5: アセットをpCloud public folderへ配置しURL確定

**Files:**
- Output: `P:\Public Folder\ehon\` に A_layer_*.png(4), B_diorama.glb, (本ベース画像があれば)を配置
- Create: `C:\tmp\ehon\asset_urls.txt`(各ファイルの pCloud public 直リンクをメモ)

**Interfaces:**
- Produces: `ASSET_BASE` 用の pCloud public URL ベース(Web の Task6 で定数化)

- [ ] **Step 1: pCloud public folderへコピー**

Run:
```bash
mkdir -p "P:/Public Folder/ehon" && \
cp /c/tmp/ehon/A_layer_sky.png /c/tmp/ehon/A_layer_far.png /c/tmp/ehon/A_layer_mid.png /c/tmp/ehon/A_layer_fore.png /c/tmp/ehon/B_diorama.glb "P:/Public Folder/ehon/"
```
Expected: `ls "P:/Public Folder/ehon/"` に5ファイル

- [ ] **Step 2: public直リンクを取得**

pCloud の public folder 直リンク仕様を確認(pCloud の "Public Folder" 機能は `https://filedn.com/<id>/...` 形式の直リンクベースを持つ)。`P:\Public Folder` 配下のファイルに対応する直リンクベースURLを確認し `C:\tmp\ehon\asset_urls.txt` に記録。直リンク方式が不明な場合はユーザーに pCloud public link ベースURLを確認する

- [ ] **Step 3: URL到達性を確認**

Run(取得したURL例で): `curl -sI "<ASSET_BASE>/ehon/B_diorama.glb" | head -3`
Expected: `HTTP/.. 200`。403/404 ならフォルダの public 設定を見直す

---

## Phase 2 — Web実装 `ehon.html`

### Task 6: 共通シェル(机・閉じた本・開閉アニメ・トグル・タイトル)

**Files:**
- Create: `C:\projects\yuichi916.github.io\ehon.html`

**Interfaces:**
- Produces: グローバル `window.EHON = { open(), close(), setMode(m), state }`, 定数 `ASSET_BASE`, DOM要素 `#book`,`#world-a`,`#world-b`,`#mode-toggle`,`#title-card`。Task7/8 が `#world-a`/`#world-b` 内を埋める

- [ ] **Step 1: スケルトンHTMLを書く**

`ehon.html`(共通シェル+空のworldコンテナ):
```html
<!doctype html><html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>飛び出す絵本 — Enchanted</title>
<style>
  :root{--ink:#3a2f25}
  *{box-sizing:border-box;margin:0}
  html,body{height:100%}
  body{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;color:var(--ink);
    background:radial-gradient(120% 100% at 50% 0%,#d8c7a8 0%,#9c8a6a 60%,#5b4a36 100%),
      repeating-linear-gradient(90deg,#6b5742 0 38px,#7a6450 38px 40px);
    background-blend-mode:multiply;overflow:hidden;height:100%}
  #stage{position:fixed;inset:0;display:grid;place-items:center;perspective:1600px}
  #book{position:relative;width:min(92vw,820px);aspect-ratio:4/3;cursor:pointer;
    transform-style:preserve-3d;transition:transform .6s ease}
  #book.closed{transform:rotateX(8deg)}
  #book.open{cursor:default}
  #world-a,#world-b{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .4s}
  #world-a.active,#world-b.active{opacity:1;pointer-events:auto}
  #title-card{position:fixed;left:24px;top:20px;max-width:46vw;padding:10px 14px;
    background:rgba(250,245,235,.82);border:1px solid #b9a784;border-radius:4px;
    box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:0;transition:opacity .6s}
  #title-card.show{opacity:1}
  #title-card h1{font-size:clamp(16px,3.2vw,26px);letter-spacing:.04em}
  #title-card p{font-size:13px;color:#6b5b45;margin-top:4px}
  #mode-toggle{position:fixed;right:18px;bottom:18px;display:none;gap:0;z-index:10;
    border-radius:999px;overflow:hidden;border:1px solid #b9a784;background:#faf5eb}
  #mode-toggle.show{display:flex}
  #mode-toggle button{border:0;padding:10px 18px;background:transparent;font:inherit;cursor:pointer;color:#8a7860}
  #mode-toggle button.sel{background:#7a6450;color:#fdf8ee}
  #hint{position:fixed;left:0;right:0;bottom:64px;text-align:center;color:#fdf8ee;
    text-shadow:0 1px 3px rgba(0,0,0,.5);opacity:.9;font-size:14px}
  #hint.gone{opacity:0;transition:opacity .5s}
</style></head>
<body>
<div id="stage">
  <div id="book" class="closed">
    <div id="world-a"></div>
    <div id="world-b"></div>
  </div>
</div>
<div id="title-card"><h1>Enchanted</h1><p>魔法の森に芽吹く、妖精たちの箱庭</p></div>
<div id="mode-toggle">
  <button id="btn-a" class="sel">水彩</button>
  <button id="btn-b">3D</button>
</div>
<div id="hint">本をひらく</div>
<script>
const ASSET_BASE = location.hostname.endsWith('github.io')
  ? 'PCLOUD_PUBLIC_BASE_HERE'      // ← Task5 の pCloud public URL に差替え
  : './_ehon_assets';              // ローカル開発時(後述のローカルコピー)
const EHON = {
  state:{ open:false, mode:'a', booted:{a:false,b:false} },
  open(){ if(this.state.open) return; this.state.open=true;
    document.getElementById('book').className='open';
    document.getElementById('hint').classList.add('gone');
    document.getElementById('title-card').classList.add('show');
    document.getElementById('mode-toggle').classList.add('show');
    this.setMode(this.state.mode); },
  setMode(m){ this.state.mode=m;
    document.getElementById('btn-a').classList.toggle('sel',m==='a');
    document.getElementById('btn-b').classList.toggle('sel',m==='b');
    document.getElementById('world-a').classList.toggle('active',m==='a');
    document.getElementById('world-b').classList.toggle('active',m==='b');
    if(m==='a' && !this.state.booted.a){ this.state.booted.a=true; window.bootWorldA&&window.bootWorldA(); }
    if(m==='b' && !this.state.booted.b){ this.state.booted.b=true; window.bootWorldB&&window.bootWorldB(); }
  }
};
window.EHON = EHON;
document.getElementById('book').addEventListener('click',()=>EHON.open());
document.getElementById('btn-a').addEventListener('click',e=>{e.stopPropagation();EHON.setMode('a');});
document.getElementById('btn-b').addEventListener('click',e=>{e.stopPropagation();EHON.setMode('b');});
</script>
</body></html>
```
- [ ] **Step 2: ローカルアセットを用意**

Run:
```bash
mkdir -p "C:/projects/yuichi916.github.io/_ehon_assets/ehon" && \
cp /c/tmp/ehon/A_layer_*.png /c/tmp/ehon/B_diorama.glb "C:/projects/yuichi916.github.io/_ehon_assets/ehon/" 2>/dev/null; \
echo "_ehon_assets/" >> "C:/projects/yuichi916.github.io/.gitignore"
```
注: `ASSET_BASE` のローカル枝は `./_ehon_assets` だが層は `ehon/` サブにあるので Task7/8 のパスは `${ASSET_BASE}/ehon/...` とする。`_ehon_assets` は .gitignore でリポジトリ除外

- [ ] **Step 3: ローカルサーバで開閉とトグルを確認**

Run(バックグラウンド): `cd C:\projects\yuichi916.github.io && python -m http.server 8777`
Playwright(mcp__plugin_ecc_playwright)で `http://localhost:8777/ehon.html` を開き、`#book` クリック→`#mode-toggle.show`/`#title-card.show` が出る、btn-a/btn-b で `sel` が切替わることをスナップショットで確認

- [ ] **Step 4: dup-constチェック**

Run: `PYTHONUTF8=1 python C:/tmp/check_dup_const.py C:\projects\yuichi916.github.io\ehon.html`
Expected: exit 0

- [ ] **Step 5: コミット**

```bash
cd C:\projects\yuichi916.github.io && git add ehon.html .gitignore && git commit -m "feat(ehon): 共通シェル(本/開閉/モードトグル/タイトル)"
```

---

### Task 7: 方式A — LayerStack 視差ポップアップ

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html`(`bootWorldA` と関連CSS追加)

**Interfaces:**
- Consumes: `ASSET_BASE`, DOM `#world-a`, `EHON.state`
- Produces: グローバル `window.bootWorldA()`(Task6 が mode='a' 初回に呼ぶ)

- [ ] **Step 1: 方式A CSSとbootWorldAを追記**

`ehon.html` の `<style>` 末尾に追加:
```css
  #world-a .layer{position:absolute;left:50%;bottom:6%;width:96%;
    transform:translateX(-50%) translateY(40px);transform-origin:50% 100%;
    opacity:0;transition:transform .9s cubic-bezier(.2,.8,.2,1),opacity .6s;
    will-change:transform;background-size:contain;background-repeat:no-repeat;background-position:bottom center}
  #world-a.popped .layer{opacity:1}
  #world-a.popped .layer.sky{transform:translateX(-50%) translateY(0) scale(1.04)}
  #world-a.popped .layer.far{transform:translateX(-50%) translateY(0) rotateX(2deg)}
  #world-a.popped .layer.mid{transform:translateX(-50%) translateY(0) rotateX(4deg)}
  #world-a.popped .layer.fore{transform:translateX(-50%) translateY(0) rotateX(7deg)}
```
`</body>` 前の `<script>` に追記:
```javascript
window.bootWorldA = function(){
  const root = document.getElementById('world-a');
  const layers = [
    {k:'sky', z:0, depth:0.0},
    {k:'far', z:1, depth:0.25},
    {k:'mid', z:2, depth:0.55},
    {k:'fore',z:3, depth:1.0},
  ];
  root.innerHTML='';
  layers.forEach(L=>{
    const d=document.createElement('div');
    d.className='layer '+L.k; d.style.zIndex=L.z; d.dataset.depth=L.depth;
    d.style.height=(70+L.z*8)+'%';
    d.style.backgroundImage=`url(${ASSET_BASE}/ehon/A_layer_${L.k}.png)`;
    root.appendChild(d);
  });
  requestAnimationFrame(()=>root.classList.add('popped'));
  // マウス視差
  function onMove(e){
    if(EHON.state.mode!=='a') return;
    const cx=(e.clientX/innerWidth-0.5), cy=(e.clientY/innerHeight-0.5);
    root.querySelectorAll('.layer').forEach(el=>{
      const dp=parseFloat(el.dataset.depth);
      el.style.setProperty('--px',(cx*dp*36)+'px');
      el.style.transform=`translateX(calc(-50% + ${cx*dp*36}px)) translateY(${cy*dp*-14}px)`;
    });
  }
  window.addEventListener('mousemove',onMove,{passive:true});
  window.addEventListener('deviceorientation',ev=>{
    if(EHON.state.mode!=='a'||ev.gamma==null) return;
    const cx=Math.max(-.5,Math.min(.5,ev.gamma/45)), cy=Math.max(-.5,Math.min(.5,(ev.beta-45)/45));
    root.querySelectorAll('.layer').forEach(el=>{
      const dp=parseFloat(el.dataset.depth);
      el.style.transform=`translateX(calc(-50% + ${cx*dp*36}px)) translateY(${cy*dp*-14}px)`;
    });
  },{passive:true});
};
```
注: ポップアップ後にmousemoveがCSS .popped の transform を上書きするのは意図通り(初期せり上がりアニメ後に視差へ引き継ぐ)

- [ ] **Step 2: 方式Aを目視確認**

Playwright で `http://localhost:8777/ehon.html` を開き本をクリック(mode既定a)。スナップショット+スクリーンショットで: 4層がせり上がり全景を形成/マウス移動で層が視差(手前ほど大きく動く)。`browser_console_messages` でエラー無しを確認。画像が出ない場合 `_ehon_assets/ehon/A_layer_*.png` の存在とパスを確認

- [ ] **Step 3: dup-constチェック**

Run: `PYTHONUTF8=1 python C:/tmp/check_dup_const.py C:\projects\yuichi916.github.io\ehon.html`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
cd C:\projects\yuichi916.github.io && git add ehon.html && git commit -m "feat(ehon): 方式A 水彩レイヤー視差ポップアップ"
```

---

### Task 8: 方式B — DioramaScene(Three.js GLTF)

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html`(Three.js importmap, `bootWorldB`, canvasコンテナ)

**Interfaces:**
- Consumes: `ASSET_BASE`, DOM `#world-b`, `EHON.state`
- Produces: グローバル `window.bootWorldB()`(Task6 が mode='b' 初回に呼ぶ)

- [ ] **Step 1: Three.js importmap を head に追加**

`ehon.html` `<head>` 内に:
```html
<script type="importmap">
{ "imports": {
  "three":"https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"
}}
</script>
```

- [ ] **Step 2: bootWorldB を module script で追記**

`</body>` 前に新規 `<script type="module">`:
```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.bootWorldB = function(){
  const host = document.getElementById('world-b');
  host.innerHTML='';
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const fit=()=>renderer.setSize(host.clientWidth, host.clientHeight,false);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, host.clientWidth/host.clientHeight, 0.1, 200);
  cam.position.set(0, 6, 12);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enablePan=false; controls.minDistance=6; controls.maxDistance=20;
  controls.maxPolarAngle=Math.PI*0.49; controls.autoRotate=true; controls.autoRotateSpeed=0.6;
  scene.add(new THREE.HemisphereLight(0xfff2d8, 0x4a5a6a, 1.1));
  const sun=new THREE.DirectionalLight(0xfff0d0,1.4); sun.position.set(6,12,6); scene.add(sun);
  const draco=new DRACOLoader(); draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
  const loader=new GLTFLoader(); loader.setDRACOLoader(draco);
  let popT=0;
  loader.load(`${ASSET_BASE}/ehon/B_diorama.glb`, gltf=>{
    const m=gltf.scene;
    // 正規化: bboxで中心化&スケール
    const box=new THREE.Box3().setFromObject(m); const c=box.getCenter(new THREE.Vector3());
    const sz=box.getSize(new THREE.Vector3()); const s=8/Math.max(sz.x,sz.y,sz.z);
    m.position.sub(c); m.scale.setScalar(s); m.position.y -= (box.min.y-c.y)*s; 
    const grp=new THREE.Group(); grp.add(m); grp.scale.setScalar(0.01); scene.add(grp);
    // せり上がりアニメ
    const t0=performance.now();
    (function pop(){ const k=Math.min(1,(performance.now()-t0)/900);
      const e=1-Math.pow(1-k,3); grp.scale.setScalar(0.01+e*0.99); grp.position.y=-4+e*4;
      if(k<1) requestAnimationFrame(pop); })();
  }, undefined, err=>{
    host.innerHTML='<div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;text-shadow:0 1px 3px #000">3Dの読み込みに失敗。水彩でお楽しみください</div>';
    console.error('GLB load error', err);
  });
  fit();
  addEventListener('resize',fit);
  (function loop(){ if(EHON.state.mode==='b'){controls.update();renderer.render(scene,cam);} requestAnimationFrame(loop); })();
};
// WebGL非対応 → 方式Aへフォールバック・3Dボタン無効化
(function(){ try{ const c=document.createElement('canvas');
  if(!(c.getContext('webgl2')||c.getContext('webgl'))){
    document.getElementById('btn-b').disabled=true; document.getElementById('btn-b').title='この端末は3D非対応'; }
}catch(e){ document.getElementById('btn-b').disabled=true; } })();
```
`#world-b canvas` 用CSSを `<style>` に追加: `#world-b{display:block} #world-b canvas{width:100%;height:100%;display:block}`

- [ ] **Step 3: 方式Bを目視確認**

Playwright で開き、`3D`ボタンを押す。スナップショット+スクリーンショットで: GLTFジオラマがせり上がり/自動回転で立体が見える/`browser_console_messages` にロードエラー無し。Draco デコーダの取得失敗があればパスを確認

- [ ] **Step 4: dup-constチェック**

Run: `PYTHONUTF8=1 python C:/tmp/check_dup_const.py C:\projects\yuichi916.github.io\ehon.html`
Expected: exit 0

- [ ] **Step 5: コミット**

```bash
cd C:\projects\yuichi916.github.io && git add ehon.html && git commit -m "feat(ehon): 方式B Three.js GLTFジオラマ"
```

---

### Task 9: A/B比較プレビューとユーザー採用判断

**Files:**
- Output: `C:\tmp\ehon\compare_a.png`, `C:\tmp\ehon\compare_b.png`(プレビュー用スクショ)

**Interfaces:**
- Consumes: 完成した `ehon.html`(両モード)
- Produces: ユーザーの採用方式決定(以降の量産フェーズの入力)

- [ ] **Step 1: 両モードのスクリーンショットを取得**

Playwright で `ehon.html` を開き本クリック→mode a でスクショ `compare_a.png`、3Dボタン→mode b でせり上がり完了後スクショ `compare_b.png`(デスクトップ幅とモバイル幅 375px の両方)

- [ ] **Step 2: ユーザーにプレビュー提示**

SendUserFile で compare_a/b を送り、採用方式(水彩 or 3D、もしくは両載せ維持)をユーザーに確認。デプロイ前承認(Global Constraints)

- [ ] **Step 3: 採用方式を反映(必要なら)**

ユーザー判断に従い、不採用方式の削除 or 既定モード変更を行う(両載せ維持なら変更なし)。変更時は dup-check 後コミット

- [ ] **Step 4: pCloud公開URLへ差替え & デプロイ判断**

`ASSET_BASE` の github.io 枝を Task5 の pCloud public URL に差替え → dup-check → ユーザー承認後に push:
```bash
cd C:\projects\yuichi916.github.io && git add ehon.html && git commit -m "feat(ehon): 配信URLをpCloud publicに設定" && git push
```
(push はユーザー承認後のみ)

---

## 自己レビュー結果

- **Spec coverage:** 共通シェル(Task6)/方式A水彩(Task2,3,7)/方式B 3D(Task4,8)/pCloud配信(Task5,9)/モバイル容量(Task4 Step3)/水彩Blender完結(Task2)/A-Bトグル(Task6)/フォールバック(Task8)/プレビュー承認(Task9)/dup-check(各Web Task)/ローカル.blendコピー(Task1) — 全てタスクにマップ済み
- **Placeholder scan:** `ASSET_BASE` の pCloud URL と `KEEP_SUBSTR` は inspect.json 依存で実値が Task1/5 完了まで未確定 → それぞれ「Task1で調整」「Task5で差替え」と明示済み(プレースホルダ放置でなく取得手順を記載)
- **Type consistency:** `window.bootWorldA()`/`bootWorldB()`/`EHON.setMode`/`EHON.state`/`ASSET_BASE`/レイヤーキー `sky,far,mid,fore` を Task6→7→8 で一貫使用。GLBパス `${ASSET_BASE}/ehon/B_diorama.glb` と Task5 配置先が一致
