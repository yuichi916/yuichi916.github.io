# niwa.html — Captain Toad × Settlers × PBR rebuild

## 何を作るか（ユーザー指定スクリーンショット 3 枚より確定）
**2.5D 箱庭 RPG のファンタジー癒し要素 × フォトリアリスティック PBR の両立**

参考:
- **Captain Toad: Treasure Tracker** — チビ + 浮島ジオラマ + 鮮やかな色 + コンパクト + 宝物
- **The Settlers** — 密度ある中世村 + すべての建物に役割 + 市場/工房/家
- **UE5 PBR** — 本物のマテリアル / ソフトシャドウ / リアルな光

## 過去の致命的誤り（修正対象）
| 誤り | 原因 | 修正 |
|---|---|---|
| HDR Wallpaper を「写実風景マップ」と解釈 | 20m 半径マップに 200 種類ばら撒き | **8m 半径**の宝石ジオラマに圧縮 |
| `pad150PBR` で kind を全部置く | 「150 種類置け」を「150 個置け」と誤読 | **完全廃止** |
| `densifyGround` 自動草大量配置 | 余白を埋めようとした | 廃止 — 浮島の縁を切る |
| `extendWorldGround` で外周地形 | 「ひとつながり世界」を境界なくすと解釈 | 廃止 — 浮島は独立して浮く |
| `addDistantLandmarks` で他scene建物全配置 | 連続感を出そうとした | 廃止 — 1〜2個の遠景 only |
| HDR Wallpaper 風強 grade (彩度1.65, 暖寒0.55) | 写真風を狙った | **彩度1.25, 暖寒0.20** チビ向け柔らかさへ |

## 新しい設計ルール

### スケール
- **浮島半径 = 8m** (旧 SCENE_RADIUS = 20 → 8)
- **カメラ ortho size = 7.5** (旧 12 → 7.5) で寄る
- **浮島の厚み = 1.2m** (Captain Toad 風に水平に切れた断面)

### 浮島ベース（必須）
- 円形 or 矩形の **block-island**
- **上面**: 鮮やか芝 PBR（normal map + AO）
- **側面**: 石/土の断面（PBR）
- **下面**: 暗い土（chamfered edge）
- **影**: ジオラマ全体に soft drop shadow

### 配置密度（Settlers ルール）
- **15〜25 オブジェクト** per シーン（旧 200 → 20）
- **すべて目的あり**:
  - 市場 = 屋台 + 売り物 + 客
  - 井戸 = 桶 + 水汲み NPC + 通路
  - 橋 = 道 + 欄干 + 通行人
  - 工房 = 鍛冶 + 道具 + 職人
- **配置パターン**:
  - 中心ハブ（井戸 or 焚火 or 桜）
  - そこから放射状の小道
  - 道沿いに建物・小物が並ぶ
  - 縁に低い柵 or 樹木

### マテリアル（フォトリアル PBR）
- **roughness map** 必須（ベタ塗り禁止）
- **normal map** で凹凸（特に石・木）
- **AO** で接地感
- **emissive** は提灯・窓・水・蛍だけ
- **環境マップ** で金属反射

### 光（癒し）
- **時間帯固定 = 夕方 16:00 ごろ** （warm but not extreme sunset）
- **太陽 elevation = 25-35°**（影が長すぎず短すぎず）
- **空 = bright cyan-blue with soft cumulus**（HDR Wallpaper のドラマチック sunset では NO）
- **fog**: 軽い（near=20, far=60）— ジオラマの粒子が見える距離
- **ambient = 0.45**（chibi 向け明るさ）

### Post-processing（再チューニング）
- Bloom: 0.95 → **0.45**（控えめ）
- HDRGrade: 彩度 1.65 → **1.25**、暖寒 0.55 → **0.20**、ヴィネット 0.55 → **0.25**
- 太陽 god-rays: 0.42 → **0.20**（ほぼ off）
- Tone mapping ACES: 維持

### NPC（チビ）
- 既存 chibi_red/blue/green/yellow/monk/woman/child を **3〜5 体** per シーン
- **walk path** で常に動く
- **吹き出し** or **頭上アイコン**（？/!）でファンタジー感

### ファンタジー要素（必須）
- 各シーンに **1 個のジュエル/宝箱/魔法アイテム**（既存 makeCrystal/makeChest 使う）
- **発光する小物**（提灯・蛍・水晶）
- **きのこ**（既存 mushroom_cluster）
- **桜の花びら**（既存 cherry_petals particle）

## 10 シーンのコンセプト（新方針）

| # | scene | 主役（中央ハブ） | 周囲（5-7） | 縁（5-7） | 動き |
|---|---|---|---|---|---|
| 01 | **plaza** | 桜大樹 + 井戸 | 屋台3、地蔵2、market_stall | 低塀、灯篭2、kominka背景 | NPC 4 体周回 + 桜吹雪 |
| 02 | **monlight** | 五重塔 | 月読み台、書架、行灯3 | 桔梗、岩 | 月光カーテン effect |
| 03 | **oto** | 滝＋苔岩 | 抹茶亭、kakehi、笹 | 苔石、シダ | 水音 + 蒸気 |
| 04 | **tabi** | 浮見堂 | 砂浜、ヤシ2、貝殻 | 漂流木、岩 | 波音 + カモメ |
| 05 | **toki** | 巨大砂時計 | 雲台、本棚、行灯 | 雲、星 | 砂が落ちる anim |
| 06 | **hoshi** | 観測台 | 望遠鏡、月見台、行灯 | 紫陽花、岩 | 星のキラ |
| 07 | **takibi** | 焚火 + 丸太椅子4 | sake_barrel、kettle、紅葉 | 杉、stump | 火 + 火の粉 + fireflies |
| 08 | **mizube** | 太鼓橋 + 鯉池 | 浮見堂、灯篭、蓮 | 柳、岩 | 鯉泳ぎ + 蓮揺れ |
| 09 | **amaoto** | 茅葺き小屋 | 雨樋、suikinkutsu、苔岩 | 紫陽花、しだ | 雨 + 水音 |
| 10 | **heya** | 行灯 + 火鉢 | 床の間、tatami、棚 | 障子、襖、bonsai | キャンドル揺れ |

## 進行方針

**Step 1**: Plaza シーン 1 枚を完成度 MAX で作る（5-8時間相当）
- 浮島ベース mesh + 鮮やか芝 PBR
- 中心ハブ = 桜大樹 + 井戸
- 屋台 3 + market_stall + chibi NPC 4 + 灯篭 2
- 縁 = 低塀 + 桜並木 + 遠景に kominka
- post-processing 軟調再チューン
- 桜吹雪 particle 維持

**Step 2**: User に見せて approval

**Step 3**: 同パターンで残り 9 シーン展開

## ファイル方針
- 既存 `niwa.html` は git で常に rollback 可能なので、**直接編集** で進める
- まず:
  1. `pad150PBR / densifyGround / extendWorldGround / addDistantLandmarks` をすべて **no-op** に
  2. SCENE_RADIUS と CAM_ORTHO_SIZE を縮小
  3. 既存 plaza の build を破棄して **再設計版** で書き直す
  4. post-processing を軟調再チューン
- これだけで「産業廃棄物」状態は劇的に改善するはず
