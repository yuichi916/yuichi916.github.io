# 『つなぐ×ならべる』実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** つなぐ派（4つつなげて消す落ち物）とならべる派（3つ並べて消す入れ替え）が異なる盤のまま対戦し、CPU同士の自動対戦で勝率45〜55%に調整されたブラウザゲームを作る。

**Architecture:** 盤ロジック・ダメージ・試合進行・CPUはDOM非依存のESモジュール（`assets/tsunagu-naraberu/`）にし、毎秒60回の固定刻みで決定的に動かす。HTMLは描画・入力・音だけを担う。Node（`node --test`）と worker_threads のバランス測定が同じモジュールを直接読む。

**Tech Stack:** 素のJavaScript（ESモジュール）、Canvas 2D、WebAudio、Node 24（node:test, worker_threads）。依存ライブラリなし。

**Spec:** `docs/superpowers/specs/2026-10-06-tsunagu-naraberu-design.md`

## Global Constraints

- 「ぷよぷよ」「パネルでポン」の名称はゲーム内・サイト・説明文で使わない。呼称は「つなぐ派／ならべる派／つぶ／パネル／おじゃまつぶ／おじゃまブロック」
- 盤は幅6×高さ12、5色＋形マーク（●▲■◆★）
- 固定刻み60Hz、同じシード＋同じ入力列で同じ試合
- バランス目標: 同じ段のCPU同士でつなぐ派の勝率45〜55%（全段）、平均試合時間2.5〜4分
- 外部ライブラリなし、単一ページ `tsunagu-naraberu.html`
- ユーザー向けの文言はすべて日本語

## Review Focus

1. つなぐ派で窒息直前に回転・移動したとき、隠し行（最上段の上）にはみ出しても落ちないこと → Task 2 のテスト「隠し行での回転」
2. ならべる派で、消去中のパネルや落下中のパネル、おじゃまブロックは入れ替えできないこと → Task 3 のテスト「入れ替え不可」
3. 予告が2マス分以下のときは、ならべる派に着弾せず残り続けること（毎刻み空撃ちしない）→ Task 1 のテスト「端数残し」
4. 両者が同じ刻みで負けたら引き分けになり、10分経っても決着しない試合は引き分けで打ち切られること → Task 4 のテスト
5. せり上がりでカーソルが盤外に出ないこと、ならべる派CPUがせり上がり後も正しい位置を入れ替えること → Task 3／Task 5 のテスト

---

## ファイル構成

```
assets/tsunagu-naraberu/
  package.json        {"type":"module"}（Nodeで .js をESMとして読むため）
  config.js           CFG（つまみ・時間・AI重み）、LEVELS、HANDICAP_STEP
  rng.js              createRng(seed) → {next(), int(n), state}
  damage.js           tsunaguDamage / naraberuDamage / sendAttack / landTsunagu / landNaraberu
  tsunagu.js          createTsunagu({cfg, seed, takeGarbage})
  naraberu.js         createNaraberu({cfg, seed, takeGarbage})
  match.js            createMatch({cfg, kinds, seeds, handicap})
  ai-tsunagu.js       createTsunaguAI(level, cfg)
  ai-naraberu.js      createNaraberuAI(level, cfg)
  render.js / input.js / audio.js / app.js   画面まわり
tsunagu-naraberu.html
_dev/tsunagu-naraberu/
  *.test.mjs          node --test
  balance.mjs         バランス測定（worker_threads）
docs/tsunagu-naraberu-balance.md   測定結果
```

## 共通インターフェース

**入力**（1刻みぶん。すべて真偽値。edgeは押した瞬間、Heldは押しっぱなし）
`{left, right, up, down, a, b, downHeld, bHeld}`
- つなぐ派: left/right=移動、downHeld=高速落下、up=すぐ落とす、a=左回転、b=右回転
- ならべる派: 方向=カーソル移動、a=入れ替え、bHeld=せり上げ

**盤**（両派共通）
- `step(input) → events[]`。events は `{type:'attack', D, chain}` `{type:'pop', chain, n}` `{type:'land'}` `{type:'garbage', n}` `{type:'lock'}` `{type:'swap'}` `{type:'rise'}`
- `isDead() → bool`、`kind`、`frame`
- 着弾は盤から `takeGarbage()` を呼ぶ。つなぐ派は数（整数）、ならべる派は `[{w,h}]` が返る。

---

### Task 1: config / rng / damage

**Files:** Create `assets/tsunagu-naraberu/{package.json,config.js,rng.js,damage.js}`, Test `_dev/tsunagu-naraberu/damage.test.mjs`

**Produces:**
- `CFG`（spec 7章の全キー＋AI重み）
- `createRng(seed)`: mulberry32
- `tsunaguDamage({n, chain, groupSizes, colors}, cfg) → number`
  - 計算式は `10*n*max(1, CP[chain]+ΣGB+CB)/70*cfg.atkMulT`
- `naraberuDamage({n, chain}, cfg) → number`
  - コンボ分 `n>=4 ? COMBO[n] : 0` ＋ 連鎖分 `chain>=2 ? chainStepN*(chain-1) : 0`、最後に `atkMulN` を掛ける
- `sendAttack(D, own, opp)`: own/opp は `{D, age}`。相殺してから余りを送る。返り値は相殺後に送った量
- `landTsunagu(pending, cfg) → count`
  - `min(30, floor(D*convT))` 個を落とし、`D -= count/convT`
- `landNaraberu(pending, cfg) → [{w,h}]`
  - 予告が `age >= landSec*60` のときだけ分割して返す。2マス以下の端数は残す

**テスト（期待値は手計算）:**
- 4個・1連鎖・1色 → 40/70 ≈ 0.5714
- 4個・2連鎖 → 320/70 ≈ 4.571
- 5個（GB=2）・3連鎖・2色（CB=3）→ 10·5·(16+2+3)/70 = 15
- ならべる派: 同時4個で1連鎖 → 3。同時3個で2連鎖 → 6。同時5個で3連鎖 → 4+12=16
- 相殺: own.D=10 で D=4 → own.D=6, opp.D=0。own.D=3 で D=8 → own.D=0, opp.D=5
- ならべる派の分割: 6→[{6,1}]、9→[{6,1},{3,1}]、14→[{6,2}]＋端数2は残る、2→[]で残る
- 年齢: age < landSec*60 なら [] を返す
- 空の予告に新しく足したときだけ age を0に戻す（端数の予告に足す場合も、マス換算3未満なら0に戻す）
- つなぐ派: D=40.2 → 30個落ちて D≈10.2 が残る

### Task 2: tsunagu.js（つなぐ派の盤）

**Files:** Create `assets/tsunagu-naraberu/tsunagu.js`, Test `_dev/tsunagu-naraberu/tsunagu.test.mjs`

**Produces:** `createTsunagu({cfg, seed, takeGarbage})`
- 盤: `grid[y][x]`。13行×6列で、y=0 は隠し行。値は 0=空、1〜5=色、6=おじゃま
- 状態: `piece {x,y,rot,a,b}`、`next[2]`、`phase` ('fall'|'pop'|'garbage'|'dead')、`chain`
- 補助（テストとAIが使う。すべて純粋関数）
  - `findGroups(grid) → [{color, cells}]`
  - `applyGravity(grid)`
  - `resolveAll(grid, cfg) → {chains, D, cleared}`
  - `dropPiece(grid, x, rot, a, b) → bool`
  - `childPos(piece)`

**動き:**
- fall: 自動落下 `tsunaguFallSec*60` 刻みごと（downHeld なら2刻みごと）。落ちられなければ固定する。up で即座に固定
- 固定後: 浮いたつぶを落とし、群があれば pop（`tsunaguPopSec*60` 刻み）。消える群に隣接するおじゃまも一緒に消す。attack イベントを出し、連鎖を数える
- 連鎖が終わったら `takeGarbage()` を呼ぶ。0個でなければ garbage フェーズ（20刻み）
- その後、(2,1) が埋まっていれば dead。そうでなければ次の組を出す
- 回転: 子の行き先がふさがっていれば、親を反対方向へ1マス押し出す。押し出し先もふさがっていれば上下反転。下向きにふさがっていれば親を1マス上げる

**テスト:**
- 4連結で消える
- 3連結は消えない
- 2連鎖の盤面（手組み）で resolveAll が chains=2・D≈4.571+α
- おじゃまの巻き込み消去
- 壁際（x=5, rot=0）で右回転すると親が x=4 に押し出される
- 幅1の井戸で回転すると上下反転する
- 隠し行での回転: 親 y=1・子 y=0 で左右移動・回転しても例外が出ない
- 窒息: (2,1) を埋めた盤で次の組が出ず dead になる
- 同じシードなら出る組の列が一致する

### Task 3: naraberu.js（ならべる派の盤）

**Files:** Create `assets/tsunagu-naraberu/naraberu.js`, Test `_dev/tsunagu-naraberu/naraberu.test.mjs`

**Produces:** `createNaraberu({cfg, seed, takeGarbage})`
- 盤: 24行×6列で、y=0..11 は隠し（おじゃまの出現域）、y=12..23 が見える範囲。下にせり上がり待ちの1行 `preview[6]`
- セル: `{c, st, t, chain, gid}`
  - c: 0=空、1〜5=色、9=おじゃま
  - st: 'idle'|'clear'|'fall'
  - t: 残り時間、chain: 連鎖フラグ、gid: おじゃまブロックのID
- 状態: おじゃまブロック `blocks Map(gid → {x,y,w,h,thaw})`、`cursor {x:0..4, y:12..23}`、`rise`（0〜1）、`riseCount`、`chain`、`grace`
- 補助（純粋関数）
  - `findMatches(cells) → Set(index)`
  - `simulateSwap(snapshot, x, y) → {cleared, chains, D, thaw, maxH}`（AI用。時間を飛ばして即座に解決する）

**1刻みの順序:**
1. 入力
2. 消去タイマー（終わったら削除し、上のパネルに連鎖フラグ）／解凍タイマー（終わったら最下行を色パネルにし、連鎖フラグを付ける）
3. 重力（下から順に1マス／刻み。ブロックは全体で動く）
4. 静止したパネルでそろいを判定 → clear（`naraberuClearSec*60`）。隣接ブロックを解凍し、attack イベントを出す
5. 着地して消えなかったパネルの連鎖フラグを消す
6. 消去中も連鎖フラグ付きもなくなったら chain=0
7. 消去・落下中でなければ `takeGarbage()` を呼んで配置
8. せり上がり（消去中は止める）
9. 最上段の判定と猶予

**テスト:**
- 横3／縦3で消える
- L字5は同時5個で attack D=4
- 落下2連鎖で 2段目の attack D=6
- 空きマスとの入れ替えのあと落ちる
- 入れ替え不可（消去中のセル／ブロックのセル）
- せり上がりで全体が1行上がり、カーソルも追従する。消去中はせり上がりが止まる
- 解凍: ブロック（6×2）の隣で消すと最下行が色パネルになり、h=1 が残る
- 最上段に届くと猶予が減り、0で dead。消去中は減らない
- 最上段でカーソルが盤外に出ない
- 初期盤にそろいがない（100シード）

### Task 4: match.js

**Files:** Create `assets/tsunagu-naraberu/match.js`, Test `_dev/tsunagu-naraberu/match.test.mjs`

**Produces:** `createMatch({cfg, kinds:[k0,k1], seeds:[s0,s1], handicap:[h0,h1]})`
- `.step([in0, in1]) → events[]`。各 event に `p`（プレイヤー番号）を付ける
- `.players[i] = {board, pending:{D,age}, sent, kind}`
- `.result`: null か `{winner: 0|1|-1, frames}`
- `.frame`、`.feverMul()`
- 攻撃倍率は `feverMul * (1 + 0.2*handicap)`
- 10分（36000刻み）で引き分けとして打ち切る

**テスト:**
- 同じシード＋同じ入力列なら結果が一致する
- 攻撃が相手の pending に入り、相殺される
- 両者同時の dead で winner=-1
- 36000刻みで引き分けになる
- feverMul: 89秒で1.0、90秒で1.1、105秒で1.2、上限2.0

### Task 5: CPU（ai-tsunagu.js / ai-naraberu.js）

**Files:** Create both, Test `_dev/tsunagu-naraberu/ai.test.mjs`

**Produces:** `createTsunaguAI(levelName, cfg)` と `createNaraberuAI(levelName, cfg)`
- どちらも `.next(board) → input`（毎刻み呼ぶ）
- LEVELS: やさしい {depth:1, act:12, think:30}、ふつう {depth:1, act:6, think:15, lookahead:true}、つよい {depth:2, act:3, think:6}

**動き:**
- つなぐ派: 新しい組が出たら全配置を評価して目標（x, rot）を決める。回転→移動→すぐ落とす、を act 刻みおきに入力する
- ならべる派: 全入れ替えを `simulateSwap` で評価する（つよいは上位12手に2手目を足す）。カーソルを1マスずつ動かして入れ替える
  - 目標の行は riseCount の差で補正する
  - 入れ替え直前に色が変わっていたら考え直す
  - 盤が低ければ bHeld でせり上げる

**テスト:**
- つなぐ派AIが、置けばすぐ消える盤面で消える配置を選ぶ
- ならべる派AIが、1手でそろう盤面で200刻み以内にそろえる
- せり上がり後も正しい位置を入れ替える
- CPU対CPUが全段・全派の組で完走し（引き分け打ち切りも含む）、例外が出ない

### Task 6: バランス測定と調整

**Files:** Create `_dev/tsunagu-naraberu/balance.mjs`, `docs/tsunagu-naraberu-balance.md`. Modify `config.js`

- `node _dev/tsunagu-naraberu/balance.mjs --games 2000 --level ふつう [--set convT=1.2,...]`
- 出力: つなぐ派の勝率（Wilsonの95%信頼区間）、引き分け率、平均試合時間、1試合あたり平均ダメージ（派別）
- 左右の偏りを消すため、半分の試合はつなぐ派を P1 にする
- 調整の手順
  1. ふつうで atkMulT/atkMulN の比を二分探索して、勝率50%付近にする
  2. 試合時間は fever 系と naraberuRise で合わせる
  3. 全段で確認する
  4. ミラー（同じ派どうし）が50%前後になることを確認する
- バックグラウンドで実行する（30秒を超えるため）

### Task 7: 画面（HTML / render / input / audio / app）

**Files:** Create `tsunagu-naraberu.html`, `assets/tsunagu-naraberu/{render,input,audio,app}.js`

- 画面の流れ: タイトル → モード（CPU戦／2人対戦）→ 1P・2Pの派 → CPUの強さ・ハンデ → 対戦 → 結果（もう一回／選び直す）。Esc/P で一時停止
- 描画
  - canvas 1枚。PCは左右2盤＋中央（時間・加速倍率）
  - 盤の上に予告アイコン（1・6・30）
  - 連鎖表示「3れんさ！」、攻撃の弾が中央を飛ぶ演出
  - つなぐ派は丸いつぶ（同色をつなぐ橋あり）、ならべる派は角丸パネル。どちらも形マーク付き
- 入力: キー対応表は spec 9章。左右の押しっぱなしは 10刻み後に2刻みごとに繰り返す
  - タッチ: つなぐ派は画面下のボタン。ならべる派はパネルに触れるとカーソル、横になぞると入れ替え。せり上げボタンあり
- 375px幅では自分の盤を大きく、相手の盤を縮小して上に置く
- 音: WebAudioの合成音（移動・回転・消去（連鎖ごとに音程が上がる）・着弾・勝敗）。ミュートボタンあり

### Task 8: 実画面の確認とサイト登録

- ローカルサーバ（`python -m http.server`）で開いて確認する
  - コンソールエラー0
  - CPU戦を両派で完走
  - 2人対戦のキー操作
  - 375px幅の表示とタッチ操作
- index.html の構造化データ・ナビ・カード一覧に登録する（shogi-puyo と同じ書式）
- サイトの機械可読パイプライン（`build_agent_view.py`）を再実行する
