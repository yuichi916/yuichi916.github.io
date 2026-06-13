# niwa.html 浮遊島シーン 商用レベル化 設計書

日付: 2026-06-12
対象: `niwa.html` (`?scene=island`) — v669 時点からの大規模品質改善
要求: 「クオリティを商用レベルに。ゲームエンジンレベルの自然な動作と市販RPGレベルの操作UX。
P:\CG fanbook\3D assets の blend を全精査してシーンに合うアセットを投入。
操作は極限まで軽く、PC/モバイル両対応、クオリティ優先版と軽量版。バグ全滅。」

---

## 1. 現状監査（2026-06-12 実測）

### 1.1 アセット配信が最大のボトルネック
- 島プレハブ 10 個 × **71〜103 MB**（合計 894 MB）。中身を解析した結果
  **95 %がフル解像度 JPEG テクスチャ**（plaza: 100 MB 中 94.5 MB が 133 枚の JPEG）。
- 初回ロード: 最初のプレハブ 15 秒、全 9 ストリーム完了まで 60〜90 秒。
- 実行時に canvas 再描画で 512px に縮小している（=帯域とCPUの二重浪費）。
- 配信網: pCloud Public Folder → Cloudflare Worker CORS proxy（健全・実測済み）。

### 1.2 実測した圧縮効果（gltf-transform 4.4.0）
| プリセット | 内容 | enc_prefab_oto 実測 |
|---|---|---|
| quality | WebP 1024px + meshopt（--no-flatten --no-join で**ノード名保持**） | 75.0 → **22.5 MB** (-70%) |
| lite | WebP 512px + simplify(error 0.001) + meshopt | 75.0 → **7.4 MB** (-90%) |

ノード名はニワの地面判定・衝突判定（`/ground|cobble|.../` 正規表現）が依存するため
join/flatten は禁止。検証済み: 40ノード→40ノード、名前完全一致。
注意: 1MB 未満の小物は WebP 化で逆に肥大するため「元と最適化後の小さい方」を採用する。

### 1.3 描画系
- pixelRatio 1.0 固定、影 PCFSoft 常時 ON、bloom/SMAA は v662 で無効化済み。
- ポストは SunShafts(strength 0=実質無効) + HDRGrade + Output の 3 パス。
- PMREM 無効化済み。プレハブ 1 個 ≈ 1.2M tris × 10 = 最大 12M tris（モバイル限界超え）。

### 1.4 操作系
- WASD カメラ相対移動・quaternion 1P カメラ・ダンプ加減速・段差制限・スライド衝突は実装済み（v654-v667）。
- モバイル: 仮想ジョイスティック + E/ジャンプボタン + ズームボタンあり。
  画面右半分ドラッグで 1P 視点回転も動作する（canvas pointermove）。
- 不足: ミニマップ、足音、ジャンプの重力感、ピンチズーム、設定メニュー、品質切替。

### 1.5 ゲーム性
- セルポータル(E で各コンテンツへ)、クエストヒント、クリスタル収集ギミックあり。
- 不足: 探索の動機付け（収集の見える化）、到達感（訪問済みセルの記録）、
  ファストトラベル UI（現状はタブ深リンクのみ）。

### 1.6 kit 精査結果（Blender 5.1.1 headless, libraries.load 名前列挙）
| キット | サイズ | 内容 |
|---|---|---|
| KB3D Dark Fantasy | 864 MB | 416 objects — ゴシック建築・ゲート・ガーゴイル |
| KB3D Enchanted Interiors | 2.9 GB | 1995 objects — 室内家具（heya 等で使用済み） |
| KB3D Enchanted | 5.4 GB | 既存 10 プレハブの供給源（使用済み） |
| KB3D Treasure Island | 1.3 GB | 海賊・港・船・椰子 — **浮遊島の縁・水辺と相性最良** |
| KB3D Valhalla | 1.5 GB | 北欧ホール・柱・ルーン — takibi(焚火)セルと相性良 |
| Village House Kit | 735 MB | 柵・荷車・井戸（一部使用済み） |

抽出済みストック: ti_* 11種 / val_* 6種 / vh_* 8種 / df_* 3種（すべてローカル assets/blender/）。

---

## 2. 設計

### 2.1 アセットパイプライン（土台）
1. ローカル 80 GLB 全部を gltf-transform で quality / lite の 2 系統に変換
   （C:\tmp\glb_opt\{quality,lite}\）。小物は小さい方を採用。
2. pCloud `niwa-assets/blender_q/` と `niwa-assets/blender_lite/` にアップロード。
   既存 `blender/` は後方互換のためそのまま残す。
3. `resolveAllEncFileids()` を品質モード対応に拡張: モードに応じて
   blender_q / blender_lite フォルダの fileid マップを使う。
4. GLTFLoader に `MeshoptDecoder`（three/addons/libs/meshopt_decoder.module.js）を設定。
   DRACOLoader は旧 GLB 互換のため残す。
5. 最適化済みアセットは実行時 canvas 縮小（_downscaleTexture）を**スキップ**
   （テクスチャは既に適正サイズ。ロード時 CPU スパイク解消）。

効果見込み: 初回表示 60-90 秒 → **quality 8〜12 秒 / lite 3〜5 秒**。

### 2.2 品質 2 モード
- 判定: `?q=high` / `?q=lite` 明示 > localStorage 保存値 > 自動判定
  （IS_MOBILE または deviceMemory<6 または hardwareConcurrency<6 → lite）。
- 切替 UI: 右上ギアメニュー「画質: 高品質/軽量」。切替は localStorage 保存 + リロード。

| 項目 | high (PC) | lite (モバイル/低スペック) |
|---|---|---|
| GLB | blender_q (1024 WebP) | blender_lite (512 WebP + simplify) |
| pixelRatio | min(dpr, 1.5) | 1.0 |
| 影 | PCFSoft 2048 | OFF（接地は blob shadow 円） |
| Bloom | 半解像度で再有効化 | OFF |
| HDRGrade | ON | ON（軽量・1パスのみ） |
| 雲/滝パーティクル | フル | 半減 |
| fog far | 200 | 140（描画距離短縮） |
| anisotropy | 4 | 1 |

### 2.3 新アセット投入（セル別テーマ強化・構図8か条適用）
各セル「主役1+アクセント3」原則。1個あたり最適化後 ≤3 MB 目安。
- **mizube（水辺）**: TI 桟橋/小舟/錨 — 既存 ti_dinghy/ti_anchor 活用 + 新規 TI dock/pier 抽出
- **takibi（焚火）**: Valhalla 柱・ロングベンチ・盾(既存) + 新規 VAL firepit/hall 部材
- **toki（時計塔）**: Dark Fantasy ガーゴイル/チェーン(既存) + 新規 DF clock/lantern 系
- **hoshi（星空）**: TI beacon(灯台/既存) + DF ランタン
- **島の縁**: TI palm を崖縁に点在、岸壁系メッシュで「浮島の底」シルエット強化
- 抽出は Blender headless `bpy.data.libraries.load` + 選択 append → GLB export
  （既存 ti_extract.py / multi_pack_extract.py パターン踏襲）。
- 衝突: 追加プロップは boxObstacles 登録（既存 streamed-scan と同じフィルタ）。

### 2.4 ゲームエンジンレベルの動作
1. **ジャンプ/重力**: verticalVel に重力 -22 m/s²、ジャンプ初速 7.5 m/s、
   coyote time 0.12 秒、着地時に微小カメラ沈み込み。
2. **足音**: WebAudio 手続き生成（ノイズバースト+LPF）。歩=0.45s 間隔、走=0.3s。
   橋の上は木質（高めの共鳴）、それ以外は土質。音量小・OFF トグル。
3. **走り FOV キック**: shift 走行中 FOV 66→72 を 0.3s で補間（1P のみ）。
4. **接地スムージング**: avatar.y を damp(12) で追従（段差カクつき除去）。
5. **頭部ボブ**: 既存実装を維持。

### 2.5 市販 RPG レベルの UX
1. **ミニマップ**(右上 140px canvas): 4×3 セルグリッド、現在地ドット、
   ポータル色アイコン、訪問済みセルをハイライト。クリックで全画面マップ。
2. **全画面マップ (M キー/ミニマップタップ)**: セル名+説明、クリックでファストトラベル
   （既存 teleportToIslandSection 呼び出し）。
3. **訪問記録**: localStorage `niwa.visited` にセル到達を記録、ミニマップ反映
   + 「10/10 制覇」表示（探索動機）。
4. **設定メニュー**(右上ギア): 画質切替 / 音 ON-OFF / 操作説明 / 視点リセット。
5. **モバイル**: ピンチズーム（2 指間距離→FOV/ortho）、ジョイスティック・ボタンの
   ヒットエリア 44px 以上確認、セーフエリア inset 対応。
6. **ロード演出**: 既存 STREAM N/9 スプラッシュ+バッジ維持、
   lite はプレハブが軽いので体感 3 秒程度になる。

### 2.6 バグ全滅 + 検証
1. 既知残存: 床すり抜け箇所（sampleHeight が拾えない座標）→ 全セル系統的
   ウォークテスト（Playwright で 10 セル × 8 方向移動 + Y 座標監視）で洗い出して修正。
2. 回帰スイート拡張 (C:\tmp\niwa_v670_suite.py):
   モーダル開閉 / 1P ヨー往復 / 橋の本数 / テレポート後入力リセット /
   10 セル teleport→walk→Y 範囲 / 品質モード切替 / meshopt GLB ロード成功。
3. commit 前: `python C:/tmp/check_dup_const.py niwa.html` 必須(exit 0)。

### 2.7 スコープ外
- NPC 再導入（ユーザーが過去に明示削除）/ 戦闘システム / セーブのクラウド同期
- KTX2/BasisU（エンコード時間に対し WebP 比の利得が小さい）

---

## 3. 実装順序
1. GLB 一括最適化 + pCloud アップロード（blender_q / blender_lite）
2. niwa.html: Meshopt 導入 + 品質モード骨格（URL/localStorage/自動判定）+ フォルダ切替
3. 描画 2 モード差分（影/bloom/pixelRatio/fog/パーティクル）
4. 動作系（ジャンプ重力・足音・FOV キック・接地スムージング）
5. UX 系（ミニマップ・全画面マップ・訪問記録・設定メニュー・ピンチズーム）
6. 新アセット抽出・配置（セル別テーマ強化）
7. 床すり抜け系統テスト + 全バグ修正 + 回帰スイート + デプロイ

各段階で Playwright スモーク → check_dup_const → commit。

---

# v671 追補 (2026-06-13): 世界観ダイナミック強化

要求: 「焚火はリアルに火が燃えている様子。森エリア。部屋のシーンはちゃんと屋内に。
商用ゲーム並みの世界観・各エリアごとにダイナミックな特色。」

## 1. リアル焚き火 (makeRealFire)
- GLSL ノイズ炎シェーダ (fbm スクロール + 垂直グラデ + 橙→黄 ramp) を十字ビルボード2枚に。additive・depthWrite off
- 火の粉 Points (上昇+カール+フェード)、煙スプライト (high のみ)、PointLight フリッカー
- 配置: takibi セル主役 (構図: 主役1点)、takibi_int 暖炉
- 全エフェクトは _NIWA_FX レジストリ + animate 内 1 フックで更新

## 2. 森エリア (_plantIslandForest)
- 手続き低ポリ樹木 3 種 (松/広葉/白樺) を InstancedMesh で 250-400 本 (lite 120)
- 配置: セル間ベルト + 島縁 r30-38 (シルエット強化)。セル円盤 r10・橋レーン・ポータルは除外
- takibi セル内は密植 (焚き火の森、biome=森: 深緑 #3F6B3A / 黄緑 #B7C77A / 赤実アクセント)
- 幹は円形コライダー登録 (r0.35)

## 3. 屋内シーン殻 (_buildRoomShell)
- v669 heya パターンを一般化: 壁3層 (下段=コライダー / 発光窓帯 / 上段) + 床板 + 天井梁 + 吊りランタン + HemisphereLight
- INTERIOR_THEMES テーブルで 9 _int シーンに各テーマ (monlight=深藍+月窓 / oto=社殿木組 / takibi=丸太小屋+暖炉火 etc.)
- playableBounds は interior stash/restore (v669) が保持

## 4. セル別シグネチャ演出 (ISLAND_CELL_FX)
| セル | 演出 |
|---|---|
| takibi | リアル焚き火 + 蛍 Points |
| mizube | 波打つ水面ディスク (頂点正弦) + 桟橋灯 |
| oto | 発光音符スプライト周回 + 接近チャイム (soundOn 連動) |
| toki | 金色歯車回転 + 落砂 Points |
| hoshi | 頭上星瞬き + 流れ星 |
| monlight | 月光ビーム円錐 + 浮遊本 |
| amaoto | 局所雨柱 Points + 波紋リング |
| tabi | 旋回鳥 3 羽 |
| plaza | 噴水ジェット Points (df_fountain 位置) |

lite はパーティクル数半減・煙なし。火は signature なので両モード維持。

## 検証
各セルのスクリーンショット (1P) + FX 数カウント + 既存 16 項スイート回帰。
