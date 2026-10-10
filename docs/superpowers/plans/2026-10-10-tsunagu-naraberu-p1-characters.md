# 『つなぐ×ならべる』クオリティアップ 第1部: キャラ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 女の子4人（表情7種＋選択用＋カットイン）と描き直した相棒マスコットをゲームに入れる。声は ElevenLabs で作る（2人ぶんの ID 待ち）。

**Architecture:** 絵は reForge API で作る。基本の1枚を txt2img で作り、表情は顔マスクの inpaint で作る。透過 WebP にしてリポジトリに置く。ゲーム側は `characters.js`（データ）と `chara.js`（描画）だけが絵を知る。ゲームの中身には触らない。

**Tech Stack:** Python（requests, Pillow, rembg）、reForge（WAI-Illustrious SDXL）、ElevenLabs API（turbo_v2_5, ja）、Canvas 2D

**Spec:** `docs/superpowers/specs/2026-10-10-tsunagu-naraberu-quality-up-design.md`（1章）

## Global Constraints
- 無料公開。生成画像は WAI-Illustrious のライセンス範囲で使う
- 露出・性的な表現は入れない
- 演出の有無で試合結果が変わらない（`fx.test.mjs` を守る）
- 絵の合計は約3MB以内、1枚高さ720pxの透過 WebP
- ユーザー向けの文は日本語

## Review Focus
1. 同じキャラの表情差分が別人に見える（髪型・服・色のずれ）→ 品質チェックで見る
2. 透過の縁に白いにじみが残り、暗い背景で白い縁が見える → 暗い背景に重ねた画像で確かめる
3. スマホ幅で立ち絵が盤や操作ボタンに重なる → 375px のスクリーンショットで確かめる
4. 絵の読み込み前・失敗時に描画が例外を出す → 未読み込みでは相棒だけを描く
5. 2人が同じキャラのとき、どちらがどちらか分からない → 2P は色違い＋名前の札

---

### Task 1: スタイルブックと生成スクリプト
**Files:**
- Create: `docs/tsunagu-naraberu-stylebook.md`
- Create: `_dev/tsunagu-naraberu/art/gen_base.py`

**内容:**
- スタイルブックに書くもの
  - 共通プロンプト: `masterpiece, best quality, anime style, cute, 1girl, solo, cowboy shot, looking at viewer, simple white background, soft shading, thick outline`
  - ネガティブ: `nsfw, cleavage, ... , lowres, bad hands, extra fingers, text, watermark`
  - キャラごとの外見タグ
- `gen_base.py <id> [n=8] [seed]`
  - txt2img（832×1216、steps 28、cfg 5.5、sampler Euler a）で候補 n 枚
  - 保存先: `_dev/tsunagu-naraberu/art/out/<id>/base_<k>.png`
  - プロンプトとシードは JSON に記録する

**確認:** 4人×8枚ができ、どれも白背景・腰から上になっている。

### Task 2: 基本の1枚の選定（品質チェック）
- 確認用エージェント4体（キャラごと）で、8枚から基本の1枚を選ぶ
  - 見る点: 崩れ・設定どおりの外見・かわいさ・表情差分に向く正面寄りの顔
- 合格がなければ、プロンプトかシードを変えて Task 1 をやり直す
- 選んだものを `_dev/.../art/out/<id>/base.png` にする

### Task 3: 表情差分（inpaint）
**Files:** Create `_dev/tsunagu-naraberu/art/gen_expr.py`
- 顔マスクを作る
  - アニメ顔検出（なければ、基本の1枚ごとに手で決めた顔の矩形を JSON で持つ）
  - 矩形を少し広げ、ぼかしたマスクにする
- 表情7種のタグ
  - normal: `smile, closed mouth`
  - happy: `happy, open mouth, smile, ^_^`
  - attack: `shouting, open mouth, determined, v-shaped eyebrows`
  - ouch: `surprised, wince, one eye closed, sweatdrop`
  - pinch: `worried, nervous, sweat, frown`
  - win: `laughing, open mouth, sparkle`
  - lose: `crying, tears, sad`
- img2img＋mask、denoise 0.5、inpaint_full_res、seed 固定。各表情4候補 → 品質チェックで1枚選ぶ

### Task 4: 透過と書き出し
**Files:** Create `_dev/tsunagu-naraberu/art/export.py`
- 背景を抜く（rembg isnet-anime、なければ白の塗りつぶし抜き）＋縁の色にじみ処理
- 書き出すもの: 高さ720 WebP（`chara/<id>/<expr>.webp`）、`select.webp`、`cutin.webp`
- 検査: 暗い背景（#0d0b1f）に重ねた確認画像を作り、白い縁がないかを品質チェックで見る

### Task 5: characters.js（データ）
**Files:** Create `assets/tsunagu-naraberu/characters.js`, Test `_dev/tsunagu-naraberu/characters.test.mjs`
- `CHARACTERS = { hinata: {id, name, faction:'tsunagu', color, accent, lines:{select,start,c1..c5,ouch,danger,win,lose}, partner:'punimaru'}, ... }`
- `charsOf(faction)`、`spritePath(id, expr)`、`voicePath(id, key)`
- テスト
  - 4人そろう
  - 各派2人ずつ
  - 全員に台詞11本と表情7種のパスがある
  - パスのファイルが実在する（絵の書き出し後）

### Task 6: chara.js の作り替え（立ち絵・相棒・カットイン）
- 読み込み: 立ち絵を `Image` → `createImageBitmap` で用意する。読み込み前は相棒だけを描く
- 気分 → 表情の対応（仕様 1.4）。表情が変わるときは0.12秒で重ねて切り替え、呼吸の上下ゆれを付ける
- カットイン: 4連鎖以上で、cutin.webp ＋集中線を0.8秒
- 2人が同じキャラなら、2P は `filter: hue-rotate(...)` と名前の札
- 相棒（ぷにまる・カクたん）の描き直し: 輪郭のつや・影・まばたき・跳ねる動き
- 確認: Playwright で PC/375px の対戦中・カットイン中・結果を撮り、品質チェック

### Task 7: 声（ElevenLabs）— 声 ID がそろってから
**Files:** Create `_dev/tsunagu-naraberu/gen_voice_el.py`
- 4人×11本を生成する（turbo_v2_5, ja, Python requests）
- 尺の回帰残差で異常を検出し、作り直す
- audio.js の読み込み一覧を、キャラ別の声に差し替える。相棒は鳴き声の効果音
- クレジットを VOICEVOX から ElevenLabs に差し替える
- 声 ID が届くまでは、既知の2つで2人ぶんだけ作り、残りは声なしで動くようにしておく

### Task 8: 確認と公開の可否
- `node --test` 全件（既存71＋新規）
- Playwright で PC/375px、エラー0
- 公開してよいかをうかがう
