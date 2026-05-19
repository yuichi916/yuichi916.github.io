# 心の庭 niwa.html — World Stylebook v1.0

> テーマ: **月夜の苔庭・京都古都** (高山寺・西芳寺・三千院 + Studio Ghibli + Spiritfarer 夜パート + FlowScape 月明かり)
> 目標: 1 シーン = 「これで完成」と言えるレベルまで仕上げてから次へ。場あたり禁止。

---

## 1. World-view summary

月が登り始めた静かな京都の山あいの古寺と苔庭。墨色の空、苔の翡翠、漆喰の白、提灯の橙、それだけ。プレイヤーは 8 つの祠を巡って静かに心を整える。**音と気配で誘い、彩度で叫ばない**。

- **時刻**: 月の出 (timeOfDay 0.85) ↔ 深夜 (timeOfDay 1.0)。昼夜サイクルは廃止、夜のみ。
- **天候**: 雲少なく月明かり強め、地表に薄霧。風は弱め (草が 1-2°ゆれる程度)。
- **音**: 鈴虫の遠鳴き / 水琴窟 / 遠雷の余韻 / 木の軋み / 提灯紙の擦れ。

## 2. Master palette (絶対遵守・全シーン共通) — 京都古都研究反映 v1.1

```
夜空ベース  (sky-zenith)   #0A1424    # 月明かりの夜空・遠景山影 (Ghibli千と千尋の上空調)
墨紺横帯   (sky-horizon)   #1A2E4A    # 地平 (HemisphereLight sky color と同じ)
月光ハイライト (moon-hi)    #C8D8E8    # 月の縁・苔の月光反射銀 (5500K)
漆喰      (wall-cream)    #e8d9b0    # 建築の白壁・障子
銀沙      (sand-silver)   #d8d0b8    # 銀沙灘・敷砂 (月光を散乱)
苔翠      (moss-mid)      #2F5841    # 苔の中間 (HSL 135 35 22 ベース)
苔深      (moss-shadow)   #1F3A2E    # 苔の陰影 (深緑)
苔銀      (moss-silver)   #7B9890    # 月光を浴びた苔の差色
苔黄      (moss-young)    #6B8A3A    # 若芽差色
提灯コア  (lantern)       #F4B860    # 提灯/行灯/燭台 — 唯一の温色 (1900K)
墨黒     (ink-black)     #0F1A12     # 木の幹・瓦・groundColor
青磁     (water)         #1F3850    # 池/水面 — 月を映す鏡
```

**ルール**:
- これ以外の色を**使わない** (Material が既存テクスチャを持っていても toon ramp で上書き)
- アクセントは提灯コアのみ。赤・桃・原色禁止 (桜・veg_patch・赤屋根は全削除)
- 月明かりは冷色 (墨青・苔翠) を強調、提灯周辺だけ局所的に温色

## 3. Light setup (研究反映)

- **月 (key)**: `DirectionalLight` color `#D9E6F2` (5500K)、intensity 1.0、方向 (-0.3, 0.85, 0.4)、PCFSoftShadowMap、shadowBias -0.0005
- **環境 (ambient)**: `HemisphereLight` skyColor `#1A2E4A` / groundColor `#0F1A12`、intensity 0.15
- **提灯 (fill)**: `PointLight` color `#FFB070` (1900K)、intensity 0.8、distance 6m、減衰 1.5
- **提灯数の上限**: 同時表示 **≤ 12 個 / シーン** (主役 1 + 三角配置 3 + 道沿い ≤ 8)
- **HDRI**: `moonless_golf_1k.hdr` を青寄り -10° hue shift、PMREM intensity 0.4

## 4. Atmospherics (研究反映)

- **Fog**: `THREE.FogExp2(0x0A1424, 0.035)` (墨紺指数霧、30m で完全減衰)
- **Bloom**: threshold 0.75、strength 0.45、radius 0.6 (提灯と月の縁のみ光る)
- **DoF**: focusDistance 6m、focalLength 35mm、bokehScale 1.8
- **Tonemap**: ACESFilmicToneMapping、exposure 0.85
- **Ground mist**: color `#0A1424`、強度 +30%
- **Vignette**: ColorGrade で四隅を 0.4 まで沈める

## 4b. Scale & camera (研究反映)

- **player身長**: 1.7m 基準、目線高 1.5m
- **建築物高 (player倍率)**: 五重塔 = 8x (13.6m) / 阿弥陀堂 = 4x (6.8m) / 茶室 = 2.5x (4.25m) / 石灯籠 = 1.2x (2m)
- **主役シルエット**: 画面高の **55-65%** を占めること
- **カメラ**: FoV 50°、目線高 1.5m、見上げ角 5-12°
- **面積比**: 水 : 石 : 苔 : 建築 ≈ 1 : 1 : 5 : 1

## 4c. Ground cover 比率 (研究反映)

- 苔 70% / 落葉 (紅葉・銀杏) 12% / 石・敷石 10% / 白砂 5% / 水苔縁 3%

## 5. Composition rules

[niwa-composition-rules.md](C:\Users\yuich\.claude\projects\C--Users-yuich\memory\niwa-composition-rules.md) の 8 か条をすべて適用。要点抜粋:

1. **主役 1 点** を三分割交点に
2. **三層 (fg/mg/bg)** で明度差 2 段
3. **sight line S 字 1 本**
4. **negative space 30-40%** を死守
5. **palette 3+1** = 上記マスター palette だけ
6. **アクセント 1 主役 + 3 反復** (灯橙の提灯を主役+遠景 3 灯に三角配置)
7. **silhouette test 必須** — 主役/脇/遠景が形だけで判別できるか
8. **ground cover 70/30** — 苔翠 70% + 苔暗 18% + 苔黄 + 真砂

## 6. Per-scene briefs

### 0. 入口プラザ (心の門)

| 要素 | 仕様 |
|---|---|
| 主役 | 朱塗りの**鳥居 1 基** (高さ 5.5m、画面中央奥) ← `../blender/torii_red.glb` |
| FG 額縁 | 苔むした古い石灯籠 2 基 (画面左右の手前) |
| MG | 石畳の参道 (S 字、鳥居まで)、灯橙の提灯 4 個 (鳥居両柱+左右ベンチ脇) |
| BG | 遠景の杉並木シルエット (墨青)、上空の月 (満月) |
| Ground | 砂利 (真砂) 70% + 苔翠縁取り 30%、石畳タイル S 字 |
| 音 | 鈴虫 / 遠い水音 |
| 残すアセット | torii_red, stone_lantern×4, chibi_bench, signpost |
| 排除 | mailbox, chochin (除く 4 個提灯), 桜の木 (sakura_a/b → 全削除) |

### 1. 森 (深い苔の森)

| 要素 | 仕様 |
|---|---|
| 主役 | **苔むしたねじれ広葉樹 1 本** (Blender 新規生成、高さ 8m、キャノピー直径 6m) |
| FG 額縁 | 大きな苔むし石 (画面手前左右)、シダ |
| MG | 茅葺き古民家 1 棟 (chibi 風だが屋根を黒くしてシルエットを締める) + 苔石階段 |
| BG | 杉の森のシルエット (墨青、ローポリ深いシルエット) |
| Ground | 苔翠 70% + 苔暗 18% + 落葉 8% + キノコの斑点 4% |
| Sight line | 苔石の踏み分け道が S 字に古民家へ |
| 灯 | 軒先の行灯 1 個、遠景に 1 個 |
| 排除 | chibi 桜、赤い実、現状の赤系チビ木 |

### 2. 湖 (月を映す池)

| 要素 | 仕様 |
|---|---|
| 主役 | **池そのもの** (円形、Reflector で月を映す)、奥に**枝垂れ柳 1 本** |
| FG 額縁 | 池畔の石組 + 苔、蓮の葉 |
| MG | 太鼓橋 (画面手前から斜めに延びる)、茶室 (画面右奥小さく) |
| BG | 遠景山影 (墨青ラインのみ) |
| Ground | 砂利 (真砂) 60% + 苔翠 30% + 水際の蓮葉 10% |
| 鯉 | 既存 koi×3 維持 (色は墨黒系のみに変更、白金/赤青は禁止) |
| 灯 | 茶室軒先 1 提灯、太鼓橋袂 1 提灯、遠景 1 提灯 |
| 排除 | 桜、明るすぎる lake_fl 系 |

### 3. 村 (灯火の集落)

| 要素 | 仕様 |
|---|---|
| 主役 | **古民家本堂 (kominka_b)** 1 棟、高さ 5.4m |
| FG 額縁 | 苔石垣 + 木戸の門柱 |
| MG | 漆喰塀沿いに小さなチビ家 2 軒 (高さ 1.8m、屋根を黒く塗り直し)、行灯の連なり |
| BG | 遠景の watchtower (silhouette、高さ縮小) |
| Ground | 真砂参道 + 苔縁取り、井戸 1 + 水盤 |
| 灯 | 軒下提灯 3 個 + 主役横 1 提灯 |
| 排除 | veg_patch (赤すぎる)、wheelbarrow (西洋的すぎる)、birdhouse、umbrella、laundry (生活感過多)、bonsai_a |
| 残す | offering_box, fence_segment, furin, kominka_b, watchtower (縮小), 2 軒のみのチビ家 (屋根再着色) |

### 4. 山 (五重塔)

| 要素 | 仕様 |
|---|---|
| 主役 | **五重塔 (pagoda_5tier)** 1 基、高さ 10.5m |
| FG 額縁 | 苔むし大岩 2 + シダ |
| MG | 鐘楼 (1.0 倍に縮小)、つづら折りの石段 (procedural) |
| BG | 遠景の岩峰 (墨青) + 月 |
| Ground | 露出した黒岩 50% + 苔翠 30% + 真砂 20% |
| 灯 | 塔最上層 1 灯、石段下 1 灯、鐘楼軒 1 灯 |
| 排除 | shrine_mclaughlin (重複)、現状の chibi 木 (山には不要) |

## 7. Asset manifest

### Blender 新規生成が必要 (`C:/projects/niwa-blender/gen_kyoto_v1.py`)

- `moss_rock_a/b/c.glb` — 苔むし大岩 3 種 (FG 額縁用)
- `gnarled_tree.glb` — ねじれ広葉樹 (森の主役、高さ 8m)
- `weeping_willow.glb` — 枝垂れ柳 (湖の主役、高さ 6m)
- `moss_lantern.glb` — 苔むし古石灯籠 (3-4 個配置)
- `andon.glb` — 行灯 (軒先用、提灯と区別)
- `temple_steps.glb` — 苔石の踏み分け道タイル
- `mizukoto.glb` — 水琴窟 (音オブジェ)
- `furin_simple.glb` — 風鈴 (既存 furin より装飾削減)

### 削除候補 (現状 EXTERNAL_ASSETS から外す)

- `bonsai_a/b` (西洋的すぎる位置)
- `village_veg`, `wheelbarrow`, `birdhouse`, `village_laundry`, `village_umbrella`
- `chibi_house_red2.glb` (1 軒削減)
- `chibi_tree_sakura.glb × 3` (湖の桜並木) → 枝垂れ柳 1 本に
- `chibi_tree_red.glb` (赤すぎる)
- `mailbox` (近代的)
- 過剰な `ishidoro_flopsi` (4 個→2 個)

### Polyhaven 追加 DL

- `moonlit_golf_1k.hdr` (既存) → 青寄り tint
- `forest_slope_1k.hdr` 月夜版 (もしあれば)
- 苔テクスチャ `moss_albedo` 2k (terrain blend layer 用)

## 8. Phase plan & completion criteria

各 Phase は次の条件を**すべて**満たすまで次に進まない。

### Phase 0: stylebook 合意 ← **今ここ**

- [x] テーマ確定 (月夜の苔庭・京都古都)
- [ ] スタイルブック (本ドキュメント) をユーザーが承認
- [ ] palette/数値仕様の異論なし

### Phase 1: 入口プラザの完成 (推定 4h equiv)

- [ ] palette だけ使用、月夜シェード適用
- [ ] silhouette test pass (鳥居が主役と一目で分かる)
- [ ] negative space 35%+ 確保
- [ ] 排除リスト適用済み (mailbox/桜/余計な chochin)
- [ ] 提灯 4 個三角配置
- [ ] スクリーンショット (1920x1080) でユーザー OK

### Phase 2: 森の完成 (推定 5h equiv)

- [ ] gnarled_tree.glb 生成・配置
- [ ] 苔 ground cover 専用 shader
- [ ] palette 内のみ使用
- [ ] silhouette test pass
- [ ] スクリーンショット OK

### Phase 3: 湖の完成 (推定 4h equiv)

- [ ] 池 Reflector 月映り
- [ ] 枝垂れ柳 hero
- [ ] 鯉色を墨黒系に再着色
- [ ] スクリーンショット OK

### Phase 4: 村の完成 (推定 4h equiv)

- [ ] 排除リスト適用 (veg/wheelbarrow/laundry 削除)
- [ ] kominka_b を主役に拡大、屋根を palette 内に再着色
- [ ] 行灯+提灯三角配置
- [ ] スクリーンショット OK

### Phase 5: 山の完成 (推定 3h equiv)

- [ ] 五重塔 hero 配置最終調整
- [ ] つづら折り石段 procedural
- [ ] スクリーンショット OK

### Phase 6: 最終調整 (推定 3h equiv)

- [ ] DoF + Bloom + 霧 + vignette のシーン横断調整
- [ ] 音設計 (鈴虫・水琴窟・遠雷)
- [ ] silhouette test 全シーン pass
- [ ] palette test (画面の各画素が palette ±10% 内に収まる)

---

**現状の niwa.html (v47 deploy 済) との差分**: 桜・赤系木・mailbox・veg_patch・wheelbarrow・birdhouse・laundry・umbrella・bonsai 等を全削除し、palette を月夜の苔庭固定 9 色に置き換える。各 biome を 1 つずつ完成度 MAX で仕上げる方針へ転換。
