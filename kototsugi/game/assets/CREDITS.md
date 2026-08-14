# 素材クレジットと生成記録

すべて自家生成。第三者素材の再配布は含まない。

## 生成環境
- reForge (Stable Diffusion WebUI 互換API) / `http://127.0.0.1:7860`
- モデル: **NoobAI-XL v1.1** (`NoobAI-XL-v1.1.safetensors`, hash 6681e8e4b1)
- サンプラー: Euler a / CFG 5.0–6.0 / Steps 30–34
- 生成日: 2026-08-13

## 背景 `bg/`（1920x1080 PNG・人物なし）— **KitBash3D + Blender レンダに差し替え済み**

初期版は reForge 生成だったが、世界観の作り込みのため 3D 実シーンへ置換した。

- 3Dキット: **KitBash3D "Treasure Island"**（744メッシュ／33棟＋70種の小物、メートル単位）
  `P:\CG fanbookD assets\Kitbash3D - Treasure Island BLENDER`
- レンダラ: **Blender 5.1.1** / EEVEE / 1920x1080 / AgX (Medium High Contrast) / カットごとに露出補正
- 構成スクリプト: `tools/blender/build_island.py`（カットごとに前景・中景・遠景を手で配置）
- 空: Nishita 大気（Blender 5.x では MULTIPLE_SCATTERING）を各カットのキーライトと連動
- カット: `beach_dawn`（夜明けの浜・沖の帆）/ `village`（漁村の広場）/ `night_sea`（夜の桟橋）/
  `cliff`（島の縁）/ `kitchen`（飯屋の内観）
- ライセンス: KitBash3D のキットは購入済み。**レンダリング成果物の利用**という形態であり、
  キットそのものの再配布は行っていない

### 旧・reForge 生成版（差し替え前の記録）
| ファイル | seed | 備考 |
|---|---|---|
| beach_dawn.png | 2571 | 夜明けの浜。空に星の尾。人物・異物なしを重み付きネガティブで担保 |
| night_sea.png | 4412 | 星明かりの夜の海 |
| kitchen.png | 914 | 飯屋の内観（前近代・土間と鉄鍋。近代家電はネガティブで排除） |
| village.png | 703 | 島の漁村・夕暮れ |

## 立ち絵 `sprite/fine/`（760x1160 透過PNG・接地位置とスケール統一）
- キャラクター: フィーネ（白い麻のワンピース／長い黒髪／素足）
- **同一 seed 8801 + 同一基本プロンプト**で表情のみ差分＝顔の一貫性を担保
- 表情: `normal` / `smile` / `surprise` / `trouble` / `shy`
- 工程: グリーンバック生成 → despill 付きキーイング（緑被り中和）→ 微小alpha除去 → 外接矩形 → 高さ1100へ正規化 → 760x1160 キャンバスへ下端中央で配置

## 意図的に存在しない素材
- **主人公ツヅクの立ち絵は作らない**（作品の根幹に関わる設計判断。慣習に見せかけた仕掛け）

## 音楽 `bgm/`（第三者素材・要クレジット表記）

作曲: **なぐもりずの音楽室（Nagumo Rizu）** — <https://nagumorizu.com/>

利用条件は配布元の規約（<https://nagumorizu.com/tos>）に基づく。商用利用可・改変可・
クレジット表記が条件。**本作は規約に従いクレジットを表示する**。原曲ファイルの再配布は
行わず、ゲーム内再生用に ogg へ変換したもののみを同梱している。

| 使用名 | 原曲 | 収録 | 用途 |
|---|---|---|---|
| `dawn` | 空が茜に染まるまで | 音楽素材集vol.24『ヴェルスティア旅行記』 | 夜明けの浜 |
| `daily` | Peaceful Village | 音楽素材集Vol.3『Fictional OST 01』 | 飯屋・村・日常 |
| `wonder` | Looking for Magic Clover | 音楽素材集Vol.3『Fictional OST 01』 | 漂着・不思議 |
| `night` | 宿屋 | 音楽素材集Vol.3『Fictional OST 01』 | 夜の窓辺・儀式 |
| `narration` | 眠る森 | 音楽素材集vol.24『ヴェルスティア旅行記』 | 朗読・幕間 |
| `tension` | Ruined Altar | 音楽素材集Vol.3『Fictional OST 01』 | 緊迫 |

変換: FLAC → ogg vorbis（`-q:a 5`、ラウドネスを揃えて音量差を潰した）

### 頒布時に必ず記載すること

> Music: なぐもりずの音楽室 https://nagumorizu.com/

## 効果音 `se/` と環境音 `amb/`（自家生成）

`tools/audio/make_sfx.py` で合成。第三者素材を含まない。

- 効果音 10 種: `drop` `fire` `bell` `chime` `sand`（言葉の五つの響きに対応）/
  `pick`（拾得）`weave`（言継ぎ成立）`deny`（拒否）`burn`（言葉を焼く）`chart`（星図）
- 環境音 4 種: `waves` `waves_night` `hearth` `night`
- ループ点は前後をクロスフェードして繋いであり、波もかまども継ぎ目で鳴らない
