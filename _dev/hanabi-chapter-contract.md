# 物語の章の型（hanabi/ch/<id>.js）

物語モード `hanabi/story.html` は、章を 1 つのモジュールとして読みこむ。章は下の名前を export する。
**お手本は第一章 `hanabi/ch/hoshi.js`**（ルールは `hanabi/stars.js`、テストは `tests/hanabi_story_test.mjs`）。

## ゲーム全体の芯（どの章でも守る）
- 指で**一筆**の線を引く。線の始まりから**火（ヒノコ）が追ってくる**。追いつかれると、その試みは失敗。
- 章ごとに、それ以外の考え方を 1 つ持ちこむ（線が川になる、影になる、など）。
- 1 章 = **8 面ちょうど**。面 0 は 30 秒で分かるやさしい面、面 7 は章の山場（物語の驚きと重なる。台本 `hanabi/script.js` 参照）。
- 面ごとに、星 1〜3（1 = 越えた、2・3 = 腕の見せどころ。たとえば手早さ、火をぎりぎりまで引きつける、取り逃しなし）。

## export するもの
```js
export const CHAPTER = { id, no, ja, sky, band };   // sky: story.js の SKY の名前、band: 'summer' | 'winter' | 'demon'
export const LEVELS = [{ id, ja, ...面のデータ }];  // 8 面
export const FAIL = { <reason>: '失敗の理由を短い日本語で' };
export function newStage(lv, W, H, opt) { ... }    // st を返す。st.lv = lv, st.phase = 'aim'（筆を置く前）, st.events = [], st.t = 0
export function penDown(st, x, y) { ... }          // 受けつけたら true
export function penMove(st, x, y) { ... }
export function penUp(st) { ... }
export function step(st, dt) { ... }               // dt = 1/60 固定
export function starsFor(st) { ... }               // 0〜3。越えていなければ 0
export function info(st) { ... }                   // 画面上の真ん中の 1 行（HTML。<em> で強調）
export function retry(lv, fails, opt) { ... }      // 任意: 失敗のあとに opt を変える（ヒントを出す等）
export function labels(st) { ... }                 // 任意: [{ x, y, text, cls }]（cls: big / dim / gold / red / blue）
export function draw(st, api) { ... }              // GL の段: api.ribbon(k)、api.put(...)
export function particles(st, api) { ... }         // 粒の段: api.fx.add(...) など。毎コマ呼ばれる
export function onEvent(ev, st, api) { ... }       // 音と演出
export function bot(st, mem) { ... }               // テストと通しの運転手
```
- 終わり: 越えたら `st.phase = 'done'` にして `st.events.push({ type: 'done' })`（または 'bloom'）。失敗は `st.phase = 'fail'; st.reason = '...'; st.events.push({ type: 'fail', reason })`。エンジンは 'done' の 1.5 秒後に次へ進むので、その間に花火を見せる。
- ルール（newStage〜starsFor・bot）は **DOM・window・Math.random を使わない**。同じ入力なら同じ結果（乱数は面の seed から自分で作る。stars.js / sim.js の rng32 の形）。node でテストできること。
- 座標は論理座標。横長は H = 720・W = 960〜1600、縦長は W = 720・H = 1280〜1560。**両方で遊べること**。上 100 は文字の帯、横長では下の H*0.62 より下は町なので、遊ぶ物は y = 110〜H*0.6 あたりに（縦長は 220〜H*0.68）。

## api（draw / particles / onEvent に渡る）
- `api.ribbon({ pts:[{x,y,s}], len, flameS, heatLv:0〜2, flameOn, width? })` — 燃える導火線。s は線の始めからの長さ。flameS より前は燃えた跡、先は金の線。
- `api.put(x, y, size, name, glow=0.15, atlas='story', alpha=1)` — 絵。atlas 'story' の名前は `hanabi/story-art.js` の STORY_CELLS（neko kitsune tanuki tengu kamaitachi yukionna yamabiko toro toro_lit lotus rock shrine sled usagi house snowpine andon shoji_dot kitsunebi bride mask taiko memory memory_lit）。花火玉の絵は atlas 'shell' で `api.cellOf({ type: 'kin' })`、ヒノコは `api.HINOKO`（熱い顔は +1）。size は絵の半分の大きさくらい（玉なら半径 / 0.72）。
- `api.fx` — 粒（`fx.add(x, y, vx, vy, life, size, drag, grav, col0, col1, glow, flag)`。毎コマ光らせる物は life = api.one）、`fx.burst(kind, x, y, R, shellType, heat)`（kind: peony chrys willow ring crossette palm kamuro mini）、`fx.tick(x, y, col, n, speed)`、`fx.flame(x, y, dirx, diry, heat, dt)`、`fx.light(x, y, i, r, col)`、`fx.launch`。
- `api.one`・`api.dt`・`api.t`（秒）、`api.W`・`api.H`
- `api.audio` — `note(n, {vol, dur, pan})`、`boom(size, pan)`、`launch(pan)`、`ui('tap'|'win'|'lose'|'heat'|'caught')`、`fuse(level, heat)`、`scene('calm'|'burn'|'finale')`
- `api.floatText(x, y, text, cls, size)`・`api.banner(html, size, ms)`・`api.whisper(x, y, text)`・`api.pan(x)`・`api.R.shake / R.flash`
- `api.burstShape(segs, points)` — 線の形のまま空に開く花火（星座の花火と同じ）。

## 運転手 bot(st, mem)
毎コマ（1/60 秒）呼ばれる。返すのは `{ down: [x, y] }` / `{ move: [x, y] }` / `{ up: true }` / null。mem は面ごとに空の {} から始まる。
- **全 8 面を、横長 1280×720 と縦長 720×1280 の両方で越えられること**（テストで確かめる）。指の速さは 1 コマ 9 以下（毎秒 540 以下）。人より上手すぎない手でよい。
- 面の失敗の形（追いつかれる・離す・ほかの章固有の失敗）が、それぞれ本当に起きることも、別のテストで確かめる。

## 確かめ方
1. `node tests/hanabi_ch_<id>_test.mjs` — 全面を bot で越える（横・縦）、失敗の形、決定的、星の数、画面の外に物が出ない。
2. `PORT=<割りあて> python _dev/hanabi-chapter-e2e.py <出力フォルダ> <id>` と、`... <id> 720 1280` — 本物のブラウザで章の全 8 面を bot に遊ばせる。最後に `CHAPTER E2E <id> ALL PASS`。撮った絵（各面のはじめと途中）を自分の目で見て、見えにくい・重なる・はみ出すを直す。
3. 物語の台詞は `hanabi/script.js` にある（面 0・3/4・7 の前など）。章の内容と台詞が食い違うなら、報告で知らせる（script.js は直さない）。
