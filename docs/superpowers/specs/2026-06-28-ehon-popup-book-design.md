# 飛び出す絵本ページ `ehon.html` 設計書

- 日付: 2026-06-28
- 対象: `C:\projects\yuichi916.github.io\ehon.html`（新規・独立ページ）
- 関連: cabin.html の子ページ世界として将来統合

## 1. 目的

cabin.html（森の小屋 360°瞑想）の世界観の延長として、「本を開くと一つの箱庭ファンタジー世界が飛び出す」体験ページを作る。
将来的に Valhalla / Dark Fantasy / Enchanted の3世界をページめくりで巡れる絵本にする。

参照イメージ: ユーザー添付の水彩タッチ立体ポップアップ絵本（FF9 / Wallace & Gromit / Muppets / Devil May Cry）。
「開いた本＋ページの束＋せり上がる平面レイヤーのジオラマ」がゴールビジュアル。

## 2. 今回のスコープ（プロトタイプ）

**1ページ（`ehon.html`）に Enchanted 世界を2方式で実装し、画面内トグルで A/B 見比べ。**
良かった方式を採用方式として確定し、後続作業で Valhalla / Dark Fantasy を量産する。

今回作らないもの（YAGNI）:
- ページめくりナビ本体（枠の意識だけ。実装は採用方式確定後）
- Valhalla / Dark Fantasy の中身
- cabin.html からの導線（独立ページとして完成後に接続）
- i18n（後付け。まずは日本語固定で世界観テキスト）

## 3. 体験フロー

1. 机の上に閉じた古い本（柔らかい光、cabin/niwa のコージーな雰囲気）
2. クリック → 表紙が開くアニメ
3. ページから Enchanted の箱庭世界がせり上がる（ポップアップ）
4. マウス移動 / モバイルはジャイロで視点が動き、レイヤー視差 or 3D 回り込みで立体感
5. 画面隅の「**水彩 / 3D**」トグルで同一世界を A/B 切替
6. （将来）左右でページをめくり次の世界へ

## 4. アーキテクチャ

### 4.1 共通シェル（両方式で共有）
- 背景: 木の机 + ソフトライト（CSS グラデ or 画像）
- 本ベース: 開いた本＋ページ束のビジュアル（Enchanted Interiors の Open Book アセットからレンダした画像、または当面はスタイライズ画像）
- 開閉アニメ: 閉本 → 表紙が開く → 世界ポップアップ
- モードトグル UI: 「水彩 / 3D」。同じ Enchanted を切替
- タイトルカード: "Enchanted — （世界名）"（添付画像のキャプション風）
- 単一 HTML ファイル。重複 const チェック（`python C:/tmp/check_dup_const.py`）を commit 前に通す

### 4.2 方式A：水彩レイヤー飛び出し絵本
**制作パイプライン**
1. Blender で `P:\CG fanbook\3D assets\KitBash3D - Enchanted` の .blend を開き、妖精建築＋大樹＋水辺のヒーロー・ジオラマを構図（カメラ仰角 30〜40°、参照画像に合わせる）
2. **水彩化は Blender 内で完結する**（外部 SD img2img は使わない）。手段: NPR/トゥーンシェーディング + 水彩テクスチャオーバーレイ + コンポジタ（エッジ・にじみ・紙テクスチャ）。線画パス + 水彩塗りパスを合成して参照画像の水彩タッチに寄せる
3. 深度パス / オブジェクトグループ分けで **空・遠景山・中景街・前景キャラ&地面** の3〜4層に分解 → 透過 PNG 書き出し
4. Web: 本ベース画像 + 各層をカード化。開いた瞬間に各層が上にせり上がり + 傾く（CSS 3D transform or Three.js 平面）。マウスで層ごとに視差オフセット → 立体錯覚

**Web 実装の単位**
- `LayerStack`: 透過 PNG 群を z 順に保持し、視差オフセットと pop-up transform を適用
- 入力: 層画像配列 + 深度値。依存: なし（純表示）

### 4.3 方式B：リアル3Dジオラマ飛び出し
**制作パイプライン**
1. Blender で Enchanted の一角を「小島ジオラマ」に厳選 → 重メッシュをデシメート → テクスチャをアトラス/ベイク → GLTF 書き出し（Draco/meshopt 圧縮）
2. **モバイル配信を捨てない**: GLTF はモバイルで実用的な容量に収める（目標 数十MB 以内 / テクスチャは KTX2 圧縮も検討）。容量を計測しながら厳選・デシメート・テクスチャ解像度で調整する。低スペック端末向けに LOD or 簡易版も視野
3. Web（Three.js）: 本ベース → 開くと GLTF ジオラマがせり上がってスケール拡大 → 限定 OrbitControls で回り込み。照明をシーンに合わせる

**Web 実装の単位**
- `DioramaScene`: GLTF をロードし、pop-up 用の rise+scale アニメと限定オービットを管理
- 入力: GLTF URL + ライティング設定。依存: Three.js, GLTFLoader, DRACOLoader

### 4.4 大容量アセットの置き場
- **配信アセット（GLTF / 水彩 PNG レイヤー / 本ベース画像）は pCloud public folder（`P:\Public Folder` = pCloud public）に置き、`ehon.html` から pCloud の public 直リンクで参照する**。リポジトリに巨大バイナリを入れない
- 中間レンダ等の作業ファイルも `P:\Public Folder` 配下でよい
- `ehon.html` 自体は `C:\projects\yuichi916.github.io` 配下（リポジトリ）に置き GitHub Pages で配信。アセット URL は pCloud public リンクを定数化

## 5. データフロー

```
Blender (.blend) ──A──> NPR+watercolor compositor ──> depth split ──> PNG layers ─┐
                 ──B──> decimate/bake ──> GLTF(Draco/KTX2) ───────────────────────┤
                                                                                    └─> pCloud public ──> ehon.html
```

## 6. エラー処理 / フォールバック
- GLTF / 画像ロード失敗時: トグルの該当モードに「読み込み失敗」表示、もう片方へ誘導
- WebGL 非対応端末: 方式A（CSS）を既定にフォールバック
- モバイル: 方式B を捨てないため GLTF を容量最適化して配信。極端な低スペック端末のみ方式A へ自動フォールバック

## 7. 検証
- ローカル http サーバで `ehon.html` を開き、開閉アニメ・ポップアップ・視差/オービット・トグル切替を目視確認
- スクリーンショットで両方式を並べてユーザーに提示し採用方式を決定（YouTube preview ルール同様、deploy 前にプレビュー承認）
- commit 前に重複 const チェックを通す

## 8. 最大の難所
3〜5GB の .blend からの最初の1レンダ / 1エクスポートが山場。ここを最初に通してから Web 実装に入る。
方式B はモバイル容量が課題になり得る（容量計測してから判断）。

## 9. 採用後（今回スコープ外）
勝った方式で Valhalla・Dark Fantasy を追加 → ページめくりナビ実装 → cabin.html へ導線。各世界は spec→plan→実装サイクルを回す。
