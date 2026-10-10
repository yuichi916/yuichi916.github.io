# 『つなぐ×ならべる』クオリティアップ 第2部: 操作性 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** キー設定、ゲームパッド、連続移動の調整（DAS/ARR）、先行入力、スマホのジェスチャーと振動、練習モードを入れる。

**Architecture:**
- 入力の変換（キー・パッド・ジェスチャー → 1刻みの入力）と、設定の保存は、DOM に依存しない純粋な関数にして Node でテストする。
- 先行入力は盤（tsunagu.js・naraberu.js）の中に入れる。CPU は使わないので、バランスは変わらない。
- 練習モードは、試合と同じ形のオブジェクト（`players`・`step`・`frame`）を返す `practice.js` にする。描画は「プレイヤー1人」の配置に対応させる。

**Spec:** `docs/superpowers/specs/2026-10-10-tsunagu-naraberu-quality-up-design.md`（2章）

## Global Constraints
- 既存のテスト（75件）がすべて通ること。演出の有無で試合結果が変わらないこと
- CPU の入力の経路は変えない（バランス測定の前提）
- ユーザー向けの文は日本語。ボタンは最小 56px

## Review Focus
1. キー設定で、同じキーを2つの操作や 1P・2P に重ねて割り当てる → 新しい割り当てを優先し、重なった古い割り当ては外す
2. ゲームパッドの抜き差し（試合中に外れる・2台目を後から挿す）→ 例外を出さず、割り当てを詰め直す
3. ジェスチャーで、タップと横スライドの区別があいまいな小さな動き → 指を動かした量が半マス未満ならタップ
4. 練習モードで盤が詰まる → その場で盤をやり直す（結果画面にしない）
5. 保存された古い設定（`tn-settings`、kinds 形式）→ 読み替えて、新しい形式で保存し直す

---

### Task 1: settings.js（設定の保存と読み替え）
- `DEFAULTS`: mode, chars, level, handicap, keys {p1, p2, solo}, das 10, arr 2, touch 'gesture', vibrate true
  - 第3部で使う項目も、ここに場所を作っておく: volume {bgm, se, voice}, effects 'high', reduceMotion
- `loadSettings(storage)`: v2 があればそれを読む。なければ旧 `tn-settings` を読み替える。どちらもなければ既定値
- `saveSettings(storage, s)`
- `rebind(keys, player, action, code)`: 同じ code の古い割り当てを、すべての操作・プレイヤーから外す
- テスト（偽の storage を使う）
  - 既定値になる
  - 旧形式を読み替える
  - 保存して読み戻せる
  - rebind で重なりが外れる
  - 壊れた JSON でも既定値で起動する

### Task 2: 入力（DAS/ARR・キー割り当て・ゲームパッド）
- input.js
  - `setKeys(keys)`、`setTiming(das, arr)`
  - ゲームパッド:
    - `padButtons(gp)`: standard mapping を、操作名の集合に変える純粋関数
    - `pollPads(getPads)`: 毎刻みの最初に呼ぶ。接続順に 1P・2P へ割り当てる。ひとりで遊ぶときは、どのパッドでも 1P
- テスト
  - padButtons（十字キー・スティックのしきい値・A/B/X/Start）
  - パッドの押した瞬間の検出
  - 抜けたパッドで例外が出ない
  - DAS/ARR の値で連続移動の間隔が変わる

### Task 3: 先行入力（ゲームの中身）
- つなぐ派（IRS）: 組を操作していない刻み（消去・おじゃま着地）に押した回転を覚え、次の組が出た刻みに回す
- ならべる派: 入れ替えが「落下中・浮遊中のセル」で断られたら、その位置で最大6刻みのあいだ毎刻み試す
- テスト
  - 消去中に右回転を押す → 出た組の rot=1
  - 押さなければ rot=0
  - 落下中のセルへの入れ替えは、着地した刻みに成立する
  - 6刻みを過ぎたら、成立しない

### Task 4: スマホのジェスチャーと振動
- `createTsunaguGesture({cell})`: down/move/up（座標・時刻）→ 仮想の入力（left/right のタップ、a/b、up、downHeld）
  - 横に1マス分すべるごとに1列
  - 半マス未満の動きで離したらタップ（盤の左半分なら左回転、右半分なら右回転）
  - 下へ 1.2マス/0.1秒以上の速さで、1マス以上はじく → すぐ落とす
  - ゆっくり下へ1マス以上 → 速く落とす（指を離すまで）
- 振動: 入れ替え 8ms・消去 15ms・おじゃま 30ms。設定で切れる
- テスト: ジェスチャーの各場合

### Task 5: 練習モード
- practice.js: `createPractice({cfg, kind, seed})` → `{players:[pl], frame, cfg, result:null, feverMul:()=>1, step([inp]), dropGarbage(n), resetBoard()}`
  - 盤が詰まったら `resetBoard()` する（結果画面にしない）
- 描画: プレイヤー1人の配置（盤を中央寄りに、立ち絵は左）
- 画面
  - モードに「れんしゅう」を足す
  - 対戦中のツールバー: おじゃま6／12／30・やり直す・やめる
- テスト
  - 練習の盤が進む
  - おじゃまを落とすと盤に入る
  - 詰まると盤が新しくなる

### Task 6: 操作の設定画面
- 設定画面から「操作の設定」を開く
  - 1P・2P のキー割り当て（「変更」を押すと、次に押したキーを割り当てる）
  - DAS・ARR のスライダー
  - スマホの操作方式（ジェスチャー／ボタン）、振動
  - 「初期値に戻す」
- 確認: Playwright で、キーを割り当て直したあと、そのキーで実際に動くこと

### Task 7: 確認
- `node --test` 全件
- Playwright: PC・375px でエラー0。ゲームパッドは偽の `navigator.getGamepads` で動作を確かめる
- 公開の可否をうかがう
