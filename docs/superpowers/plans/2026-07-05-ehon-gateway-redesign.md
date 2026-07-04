# ehon.html 絵本ゲートウェイ再構成 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ehon.html を全12コンテンツ+既存3世界+目次+奥付の「17見開き 3D 絵本ゲートウェイ」に拡張し、動物図鑑・JP/EN・宣伝導線を実装してサイトの実質トップにする。

**Architecture:** 既存の単一ファイル ehon.html の `WORLDS`(3要素) を `PAGES`(17要素) に拡張し、方式B (book.glb + diorama GLB + Three.js) を全頁の主軸にする。diorama は Blender headless の共通スクリプトでキット blend から prefix 指定抽出→Draco GLB 化。動物は STL→デシメート→クレイ質感 GLB。GLB は GitHub 同梱 (CORS 必須)、サムネ・音声等の CORS 不要メディアは pCloud。

**Tech Stack:** Three.js (既存 importmap)、Blender 5.1 headless (bpy)、Node (純関数テスト)、pCloud publink API、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-07-05-ehon-gateway-redesign-design.md`

## Global Constraints

- 単一ファイル文化: 実装は `ehon.html` 内に追記。**commit 前に `python C:/tmp/check_dup_const.py ehon.html` が exit 0 必須**
- GLB 容量: diorama 1頁 **≤4MB**、動物 1体 **≤1MB** (Draco level 6 + WebP q60 + テクスチャ≤1024px)
- **Cloudflare Worker 等のプロキシ仲介は全面禁止** (pCloud 署名URLのIP束縛で間欠410)
- pCloud は `<img>`/`<audio>` 用メディアのみ。GLB は `_ehon_assets/ehon/` (同一オリジン) のみ
- localStorage キー: `ehon_quest`/`ehon_quest_meta` (既存互換維持)、新規 `ehon_zukan`、`ehon_lang`
- 動物は STL ジオメトリそのまま (単色クレイ質感)。水彩化はしない (後日オプション)
- 新規頁は `modes:['b']` (3Dのみ)。方式A (水彩) は既存3世界のみ
- Blender exe: `C:\Users\yuich\Downloads\blender-5.1.1-windows-x64\blender-5.1.1-windows-x64\blender.exe`
- キット blend ローカルコピー: `C:\tmp\blends\{ti,eci,enc,val,dkf}\`。ECI テクスチャ再リンク先: `C:\tmp\blends\eci\eci_textures\`
- Blender 5.1 制約: コンポジタAPI廃止・Freestyle不可・`open_mainfile`+remove方式 (append禁止)
- コミットは Conventional Commits。1タスク=1コミット以上
- 日本語UIテキストは日本語、コード/ID は英語

---

### Task 1: ehon2 コア純関数 (日替わり配置・図鑑状態) + Node テスト

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html` (`</script>` 直前の QuestEngine の後に `EHON2_CORE` ブロック追加)
- Create: `C:\projects\yuichi916.github.io\tests\ehon2_core_test.mjs`

**Interfaces:**
- Produces: `window.EHON2 = { dailySpotIndex(dateStr, animalId, spotCount) -> int, zukanLoad() -> {found:{}}, zukanAdd(state, animalId, dateStr) -> newState, zukanIsComplete(state, animalIds) -> bool }`
- ehon.html 内では `<script id="ehon2-core">…</script>` という**専用 script タグ**に置く (テストが id で抽出するため)

- [ ] **Step 1: テストを書く**

`tests/ehon2_core_test.mjs`:

```js
// ehon.html の <script id="ehon2-core"> を抽出して評価し、純関数をテストする
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

const html = readFileSync(new URL('../ehon.html', import.meta.url), 'utf8');
const m = html.match(/<script id="ehon2-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'ehon2-core script block found');
const sandbox = { window: {} };
new Function('window', m[1])(sandbox.window);
const E = sandbox.window.EHON2;
assert.ok(E, 'window.EHON2 defined');

// dailySpotIndex: 決定的・範囲内・日付で変わる
assert.strictEqual(E.dailySpotIndex('2026-07-05', 'turtle', 4), E.dailySpotIndex('2026-07-05', 'turtle', 4), 'deterministic');
for (const d of ['2026-07-05', '2026-07-06', '2026-07-07']) {
  const i = E.dailySpotIndex(d, 'turtle', 4);
  assert.ok(i >= 0 && i < 4, `in range: ${i}`);
}
{ // 30日間で少なくとも2種類の位置を取る (毎日同じ場所にならない)
  const seen = new Set();
  for (let day = 1; day <= 30; day++) seen.add(E.dailySpotIndex(`2026-07-${String(day).padStart(2, '0')}`, 'wolfpup', 4));
  assert.ok(seen.size >= 2, 'position varies across days');
}
// 動物IDでも変わる (同日で全動物が同じindexにならないこと)
{
  const ids = ['turtle', 'wolfpup', 'penguin', 'dingo', 'hare'];
  const set = new Set(ids.map(a => E.dailySpotIndex('2026-07-05', a, 5)));
  assert.ok(set.size >= 2, 'varies across animals');
}

// zukan reducer
let s = { found: {} };
s = E.zukanAdd(s, 'turtle', '2026-07-05');
assert.strictEqual(s.found.turtle, '2026-07-05');
s = E.zukanAdd(s, 'turtle', '2026-07-06');
assert.strictEqual(s.found.turtle, '2026-07-05', 'first-found date is kept');
assert.strictEqual(E.zukanIsComplete(s, ['turtle']), true);
assert.strictEqual(E.zukanIsComplete(s, ['turtle', 'wolfpup']), false);
console.log('ehon2_core_test: ALL PASS');
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"`
Expected: FAIL (`ehon2-core script block found` の assert で落ちる)
(node が無い場合のみ: `winget install OpenJS.NodeJS.LTS` 後にシェル再起動)

- [ ] **Step 3: ehon.html に EHON2_CORE を実装**

`ehon.html` の QuestEngine ブロックの直後 (`const QuestEngine = …})();` の後) に追加:

```html
<script id="ehon2-core">
/* ehon2 コア純関数 (Node テスト対象: tests/ehon2_core_test.mjs が id 抽出で評価する)
   DOM・localStorage 非依存の純関数のみ置くこと */
window.EHON2 = (function () {
  /* 日替わり配置: 日付+動物IDのFNV風ハッシュで候補スポットから1つ選ぶ */
  function dailySpotIndex(dateStr, animalId, spotCount) {
    if (!spotCount) return 0;
    const s = dateStr + ':' + animalId;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0; }
    return h % spotCount;
  }
  /* 図鑑状態 reducer (localStorage 読み書きは呼び出し側 ZukanEngine の責務) */
  function zukanAdd(state, animalId, dateStr) {
    const found = Object.assign({}, state && state.found);
    if (!found[animalId]) found[animalId] = dateStr; /* 初発見日を保持 */
    return { found: found };
  }
  function zukanIsComplete(state, animalIds) {
    const found = (state && state.found) || {};
    return animalIds.every(function (id) { return !!found[id]; });
  }
  return { dailySpotIndex: dailySpotIndex, zukanAdd: zukanAdd, zukanIsComplete: zukanIsComplete };
})();
</script>
<script>
```

注意: 既存の巨大 `<script>` ブロックを一旦閉じて (`</script>`)、`ehon2-core` ブロックを挟み、再び `<script>` を開く形にする。挿入位置の前後で既存コードが分断されないよう、**QuestEngine 定義完了直後かつ利用開始前**の位置に挟むこと。

- [ ] **Step 4: テストが通ることを確認**

Run: `node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"`
Expected: `ehon2_core_test: ALL PASS`

- [ ] **Step 5: 重複宣言チェック + コミット**

```bash
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io"
git add ehon.html tests/ehon2_core_test.mjs
git commit -m "feat(ehon): add EHON2 core pure functions (daily spots, zukan) with node tests"
```

---

### Task 2: WORLDS → PAGES データモデル移行とナビ17頁対応

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html` (L364 `const WORLDS` 一帯、`updateNavButtons`/`switchWorld`/dots)

**Interfaces:**
- Produces: `const PAGES = [...17要素]`、`const WORLDS = PAGES.filter(p => p.type==='adventure')` (後方互換エイリアス)、`EHON.state.currentPageIdx`
- 各頁: `{id, type, chapter, title:{jp,en}, sub:{jp,en}, story:{jp,en}|null, link|null, linkJpOnly, modes, diorama|null, camPos, animal|null, quest|null}`
- Consumes: Task 1 の `window.EHON2`

- [ ] **Step 1: PAGES 配列を定義 (WORLDS を置換)**

`const WORLDS = [...]` (3要素) を以下に置換。**title/sub は17頁全て確定**。story は先行頁制作タスク (Task 10〜14) で頁ごとに記入するため、この時点では `story:null` (未制作頁は目次でグレーアウト表示になる):

```js
/* ---- 頁一覧 (絵本の見開き) ---- */
const CH = { TOTONOU:{jp:'整える',en:'Calm'}, ASOBU:{jp:'遊ぶ',en:'Play'},
             MANABU:{jp:'学ぶ',en:'Learn'}, KIKU:{jp:'聴く',en:'Listen'},
             TABI:{jp:'旅する',en:'Travel'}, MONOGATARI:{jp:'物語',en:'Story'},
             BOUKEN:{jp:'冒険',en:'Adventure'} };
const PAGES = [
  {id:'toc', type:'toc', chapter:null,
   title:{jp:'世界の地図', en:'Map of Worlds'}, sub:{jp:'この本のすべての頁', en:'All pages of this book'},
   story:null, link:null, linkJpOnly:false, modes:[], diorama:null, camPos:null, animal:null, quest:null},
  {id:'cabin', type:'content', chapter:CH.TOTONOU,
   title:{jp:'森の小屋', en:'The Forest Cabin'}, sub:{jp:'焚き火と360°の静けさ', en:'A fire and 360° of quiet'},
   story:null, link:'cabin.html', linkJpOnly:false, modes:['b'], diorama:'cabin_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'niwa', type:'content', chapter:CH.TOTONOU,
   title:{jp:'心の庭', en:'The Mind Garden'}, sub:{jp:'浮遊島をめぐる瞑想', en:'Meditation over floating isles'},
   story:null, link:'niwa.html', linkJpOnly:false, modes:['b'], diorama:'niwa_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'tomoshibi', type:'content', chapter:CH.TOTONOU,
   title:{jp:'小さな灯', en:'A Little Lamp'}, sub:{jp:'朝がつらい君への手帖', en:'A notebook for heavy mornings'},
   story:null, link:'tomoshibi.html', linkJpOnly:true, modes:['b'], diorama:'tomoshibi_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'stopwatch', type:'content', chapter:CH.TOTONOU,
   title:{jp:'時の計り手', en:'The Timekeeper'}, sub:{jp:'高精度ストップウォッチ', en:'A precise stopwatch'},
   story:null, link:'stopwatch.html', linkJpOnly:false, modes:['b'], diorama:'stopwatch_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'sudoku', type:'content', chapter:CH.ASOBU,
   title:{jp:'ルーンの大聖堂', en:'The Rune Cathedral'}, sub:{jp:'異世界立体数独', en:'3D sudoku from another world'},
   story:null, link:'sudoku.html', linkJpOnly:false, modes:['b'], diorama:'sudoku_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'shogi-puyo', type:'content', chapter:CH.ASOBU,
   title:{jp:'北の対局場', en:'The Northern Game Hall'}, sub:{jp:'将棋ぷよ「成」', en:'Shogi-puyo "Nari"'},
   story:null, link:'shogi-puyo.html', linkJpOnly:false, modes:['b'], diorama:'shogipuyo_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'lingo', type:'content', chapter:CH.MANABU,
   title:{jp:'ことばの書斎', en:"The Word Wizard's Study"}, sub:{jp:'YouTubeで英語リスニング', en:'English listening via YouTube'},
   story:null, link:'lingo.html', linkJpOnly:true, modes:['b'], diorama:'lingo_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'toeic', type:'content', chapter:CH.MANABU,
   title:{jp:'試練の武具庫', en:'The Armory of Trials'}, sub:{jp:'TOEIC Part5 三十番勝負', en:'30 TOEIC Part-5 trials'},
   story:null, link:'toeic.html', linkJpOnly:true, modes:['b'], diorama:'toeic_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'salon', type:'content', chapter:CH.KIKU,
   title:{jp:'歌う銀河', en:'The Singing Galaxy'}, sub:{jp:'一万九千人の音楽の宇宙', en:'A universe of 19,000 artists'},
   story:null, link:'salon.html', linkJpOnly:false, modes:['b'], diorama:'salon_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'hitoritabi', type:'content', chapter:CH.TABI,
   title:{jp:'出航の港', en:'The Departure Harbor'}, sub:{jp:'32の一人旅の記録', en:'Records of 32 solo journeys'},
   story:null, link:'hitoritabi/index.html', linkJpOnly:false, modes:['b'], diorama:'hitoritabi_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'world', type:'content', chapter:CH.TABI,
   title:{jp:'地図師の机', en:"The Cartographer's Desk"}, sub:{jp:'浮遊島群の地図', en:'A map of floating isles'},
   story:null, link:'world.html', linkJpOnly:false, modes:['b'], diorama:'world_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'hollow-tale', type:'content', chapter:CH.MONOGATARI,
   title:{jp:'消えない焚き火', en:'The Fire That Never Dies'}, sub:{jp:'森の小屋の、ある夜の物語', en:'One night at the forest cabin'},
   story:null, link:'hollow-tale.html', linkJpOnly:true, modes:['b'], diorama:'hollowtale_diorama.glb', camPos:[0,7,14], animal:null, quest:null},
  {id:'enchanted', type:'adventure', chapter:CH.BOUKEN,
   title:{jp:'Enchanted', en:'Enchanted'}, sub:{jp:'妖精の森の絵本', en:'A fairy-forest picture book'},
   story:null, link:null, linkJpOnly:false, modes:['a','b'], diorama:'enchanted_diorama.glb', camPos:[0,7,14], animal:null, quest:'enchanted'},
  {id:'valhalla', type:'adventure', chapter:CH.BOUKEN,
   title:{jp:'Valhalla', en:'Valhalla'}, sub:{jp:'北欧の神々の広間', en:'The hall of Norse gods'},
   story:null, link:null, linkJpOnly:false, modes:['a','b'], diorama:'valhalla_diorama.glb', camPos:[0,7,14], animal:null, quest:'valhalla'},
  {id:'darkfantasy', type:'adventure', chapter:CH.BOUKEN,
   title:{jp:'Dark Fantasy', en:'Dark Fantasy'}, sub:{jp:'崩れゆく大聖堂', en:'A crumbling cathedral'},
   story:null, link:null, linkJpOnly:false, modes:['a','b'], diorama:'darkfantasy_diorama.glb', camPos:[0,7,14], animal:null, quest:'darkfantasy'},
  {id:'colophon', type:'colophon', chapter:null,
   title:{jp:'外の窓', en:'Windows to Outside'}, sub:{jp:'この本のつくり手より', en:'From the maker of this book'},
   story:null, link:null, linkJpOnly:false, modes:[], diorama:null, camPos:null, animal:null, quest:null},
];
/* 後方互換: 既存コードの WORLDS 参照は adventure 頁のみを指す */
const WORLDS = PAGES.filter(p => p.type === 'adventure');
```

- [ ] **Step 2: EHON.state と switchWorld を PAGES 対応に改修**

`EHON.state.currentWorldIdx` を `currentPageIdx` にリネームし (初期値は **1** = cabin。目次からでなく最初のコンテンツ頁から始まり、目次へは戻る操作/ジャンプで行ける)、以下を変更:

```js
/* state 初期値 */
state: { open: false, mode: 'b', booted: { a: false, b: false }, currentPageIdx: 1, immerse: false },
```

`switchWorld(newIdx)` → `switchPage(newIdx)` に改名し、中身を PAGES 対応に:

```js
switchPage(newIdx) {
  if (newIdx < 0 || newIdx >= PAGES.length) return;
  if (newIdx === this.state.currentPageIdx) return;
  this.state.currentPageIdx = newIdx;
  const page = PAGES[newIdx];

  const stage = document.querySelector('.ehon-stage');
  stage.classList.remove('flipping');
  void stage.offsetWidth;
  stage.classList.add('flipping');
  stage.addEventListener('animationend', () => stage.classList.remove('flipping'), { once: true });

  const self = this;
  setTimeout(() => {
    document.querySelector('#title-card h1').textContent = tt(page.title) + ' — ' + tt(page.sub);
    renderPageOverlay(page);            /* Task 3: 右頁オーバーレイ (story/リンク/バッジ) */
    updateModeToggle(page);             /* modes に応じて A/B トグル表示切替 */
    if (page.type === 'toc') { renderToc(); return; }        /* Task 4 */
    if (page.type === 'colophon') { renderColophon(); return; } /* Task 5 */
    const mode = (page.modes.includes(self.state.mode)) ? self.state.mode : page.modes[0];
    self.state.mode = mode;
    if (mode === 'a') { self.state.booted.a = false; window.bootWorldA && window.bootWorldA(); }
    if (mode === 'b') {
      window.disposeWorldB && window.disposeWorldB();
      self.state.booted.b = false;
      window.bootWorldB && window.bootWorldB();
      if (self.state.open && window.popWorldB) setTimeout(() => window.popWorldB(), 200);
    }
  }, 300);

  document.querySelectorAll('#world-dots .dot').forEach((d, i) =>
    d.classList.toggle('active', i === newIdx));
  updateNavButtons();
},
```

`updateModeToggle` を新設 (`updateNavButtons` の隣):

```js
function updateModeToggle(page) {
  const tg = document.getElementById('mode-toggle');
  /* 方式A を持つ頁 (既存3世界) のみトグルを見せる */
  tg.style.display = (page.modes.includes('a') && EHON.state.open) ? '' : 'none';
}
```

既存の `switchWorld` 呼び出し (`nav-prev`/`nav-next`/キーボード/dots 生成) を全て `switchPage` に置換。`WORLDS[EHON.state.currentWorldIdx]` 参照箇所 (bootWorldA/bootWorldB/QuestEngine.enter) は `PAGES[EHON.state.currentPageIdx]` に置換する。dots は 17 個になるため、HTML 側の `#world-dots` 生成が固定3個ならループ生成に変更:

```js
const dotsWrap = document.getElementById('world-dots');
dotsWrap.innerHTML = '';
PAGES.forEach((p, i) => {
  const d = document.createElement('button');
  d.className = 'dot' + (i === EHON.state.currentPageIdx ? ' active' : '');
  d.setAttribute('aria-label', tt(p.title));
  d.addEventListener('click', e => { e.stopPropagation(); EHON.switchPage(i); });
  dotsWrap.appendChild(d);
});
```

`tt()` は Task 3 で定義する i18n セレクタ。**Task 2 の時点では暫定で `const tt = v => (v && v.jp) || v;` を PAGES 直後に置く** (Task 3 で正式版に置換)。
`renderPageOverlay`/`renderToc`/`renderColophon` も Task 3〜5 で実装するため、Task 2 時点では空関数スタブを PAGES 直後に置く: `function renderPageOverlay(){} function renderToc(){} function renderColophon(){}` (Task 3〜5 が本実装で置換)。

- [ ] **Step 3: クエスト保存キー互換の確認**

QuestEngine は `worldId` 文字列 (`enchanted` 等) をキーに保存しており、PAGES 移行後も id は不変のため互換。`QuestEngine.enter(worldId)` の呼び出し元が `PAGES[...].id` を渡すことを確認する (adventure 頁のみ quest あり):

```js
enterWorld() 内:
  const page = PAGES[this.state.currentPageIdx];
  if (page.quest) QuestEngine.enter(page.id);
```

- [ ] **Step 4: ブラウザで基本動作確認**

Run: `cd "C:/projects/yuichi916.github.io" && ./serve.bat` (または `python -m http.server 8000`) → 実機ブラウザで `http://localhost:8000/ehon.html`
Expected: 本が開く / ◀▶ で17頁ぶんナビできる (未制作頁は「この世界は準備中なのだ」フォールバック表示) / 既存3世界 (14〜16頁目) は従来通り diorama 表示+クエスト動作 / dots が17個

- [ ] **Step 5: Node テスト再実行 + 重複チェック + コミット**

```bash
node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io"
git add ehon.html
git commit -m "feat(ehon): migrate WORLDS to 17-page PAGES model with chapter nav"
```

---

### Task 3: i18n 機構 (JP/EN) + 言語トグル + 右頁オーバーレイ

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html`

**Interfaces:**
- Produces: `ehonLang() -> 'jp'|'en'`、`setEhonLang(l)`、`tt({jp,en}) -> string` (正式版)、`renderPageOverlay(page)` (右頁: story + 入るボタン + JPバッジ)、`I18N.ui` 辞書
- Consumes: Task 2 の PAGES / switchPage

- [ ] **Step 1: 言語解決と辞書を実装**

Task 2 の暫定 `tt` を置換:

```js
/* ---- i18n ---- */
const I18N = { ui: {
  enter:        {jp:'この世界に入る',   en:'Enter this world'},
  jpBadge:      {jp:'日本語コンテンツ', en:'Japanese content'},
  zukan:        {jp:'いきもの図鑑',     en:'Creature Book'},
  found:        {jp:'はっけん！',       en:'Found!'},
  notFound:     {jp:'？？？',           en:'???'},
  complete:     {jp:'全部あつめた！',   en:'All found!'},
  share:        {jp:'じまんする',       en:'Share'},
  toc:          {jp:'世界の地図',       en:'Map of Worlds'},
  windows:      {jp:'外の窓',           en:'Windows to Outside'},
  close:        {jp:'とじる',           en:'Close'},
  preparing:    {jp:'この世界は準備中なのだ', en:'This world is still being drawn…'},
}};
function ehonLang() {
  try { const s = localStorage.getItem('ehon_lang'); if (s === 'jp' || s === 'en') return s; } catch (e) {}
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en') return 'en';
  if (q === 'ja' || q === 'jp') return 'jp';
  return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'jp' : 'en';
}
function setEhonLang(l) {
  try { localStorage.setItem('ehon_lang', l); } catch (e) {}
  document.documentElement.lang = (l === 'jp') ? 'ja' : 'en';
  refreshAllText();
}
function tt(v) { if (!v) return ''; return v[ehonLang()] || v.jp || v; }
function refreshAllText() {
  const page = PAGES[EHON.state.currentPageIdx];
  document.querySelector('#title-card h1').textContent = tt(page.title) + ' — ' + tt(page.sub);
  renderPageOverlay(page);
  document.getElementById('lang-toggle').textContent = (ehonLang() === 'jp') ? 'A' : 'あ';
  if (page.type === 'toc') renderToc();
  if (page.type === 'colophon') renderColophon();
}
```

- [ ] **Step 2: 言語トグルボタンを追加**

HTML (nav ボタン群の隣、`#mode-toggle` の後) に:

```html
<button id="lang-toggle" class="nav-round" aria-label="Language"></button>
```

CSS は既存の `#mode-toggle` 系ボタンと同じ見た目クラスを流用 (`.nav-round` が無ければ既存ナビボタンの class 名を確認して合わせる)。JS:

```js
document.getElementById('lang-toggle').addEventListener('click', e => {
  e.stopPropagation();
  setEhonLang(ehonLang() === 'jp' ? 'en' : 'jp');
});
document.documentElement.lang = (ehonLang() === 'jp') ? 'ja' : 'en';
```

- [ ] **Step 3: 右頁オーバーレイ renderPageOverlay を実装**

Task 2 のスタブを置換。content 頁で本の右側に物語文+リンクボタンを重ねる:

```js
function renderPageOverlay(page) {
  let ov = document.getElementById('page-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'page-overlay';
    document.querySelector('.ehon-stage').appendChild(ov);
  }
  if (page.type !== 'content' || !EHON.state.open) { ov.innerHTML = ''; ov.className = ''; return; }
  ov.className = 'show';
  const story = page.story ? tt(page.story) : '';
  ov.innerHTML =
    '<div class="po-story">' + story + '</div>' +
    (page.linkJpOnly && ehonLang() === 'en'
      ? '<span class="po-jp-badge">' + tt(I18N.ui.jpBadge) + '</span>' : '') +
    '<a class="po-enter" href="' + page.link + '">' + tt(I18N.ui.enter) + ' →</a>';
}
```

CSS (既存 `<style>` に追記):

```css
#page-overlay{position:absolute;right:4%;bottom:18%;width:min(34vw,320px);z-index:40;
  opacity:0;pointer-events:none;transition:opacity .5s .4s;text-align:left}
#page-overlay.show{opacity:1;pointer-events:auto}
.po-story{font-size:.92rem;line-height:1.9;color:#3a2f22;background:rgba(255,250,238,.82);
  border-radius:10px;padding:12px 14px;box-shadow:0 2px 12px rgba(60,40,10,.18)}
.po-jp-badge{display:inline-block;margin-top:8px;font-size:.7rem;padding:2px 8px;border-radius:99px;
  background:#8c6d46;color:#fff;letter-spacing:.06em}
.po-enter{display:inline-block;margin-top:10px;font-weight:700;color:#fff;background:#a3552f;
  padding:10px 18px;border-radius:99px;text-decoration:none;box-shadow:0 3px 10px rgba(120,50,10,.35)}
.po-enter:hover{background:#c26a3d}
```

- [ ] **Step 4: 動作確認**

実機ブラウザ: `http://localhost:8000/ehon.html?lang=en` → タイトル・オーバーレイUIが英語 / トグルで即時切替 / `localStorage.ehon_lang` が保存され再読込でも維持 / lingo 頁 (story 未記入でもボタンは出る) に EN 時バッジ表示。
Expected: すべて成立。

- [ ] **Step 5: チェック + コミット**

```bash
node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html && git commit -m "feat(ehon): JP/EN i18n with lang toggle and page overlay"
```

---

### Task 4: 目次見開き「世界の地図」

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html`

**Interfaces:**
- Produces: `renderToc()` (本の上に章別グリッド DOM を出す)、目次サムネ URL 規約 `getMediaUrl('toc_<pageId>_v1.webp')` (Task 15 で pCloud 化するまではローカル `_ehon_assets/ehon/toc_<pageId>_v1.webp`)
- Consumes: PAGES、tt()、ZukanEngine (Task 6 実装後にバッジ連動、それまでボタンのみ)

- [ ] **Step 1: getMediaUrl を追加**

`getAssetUrl` の隣に (Task 15 で pCloud 実装に差し替わる暫定版):

```js
/* CORS 不要メディア (img/audio)。Task 15 で pCloud getpubthumb に切替 */
function getMediaUrl(filename) {
  return `${ASSET_BASE}/ehon/${filename}`;
}
window.getMediaUrl = getMediaUrl;
```

- [ ] **Step 2: renderToc を実装**

Task 2 のスタブを置換:

```js
function renderToc() {
  const host = document.getElementById('world-b');
  window.disposeWorldB && window.disposeWorldB();
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'toc-wrap';
  let html = '<h2 class="toc-title">' + tt(I18N.ui.toc) + '</h2>';
  const chapters = [];
  PAGES.forEach((p, i) => {
    if (p.type !== 'content' && p.type !== 'adventure') return;
    const ch = p.chapter ? tt(p.chapter) : '';
    let grp = chapters.find(c => c.name === ch);
    if (!grp) { grp = { name: ch, items: [] }; chapters.push(grp); }
    grp.items.push({ p, i });
  });
  for (const ch of chapters) {
    html += '<div class="toc-ch"><span class="toc-ch-name">' + ch.name + '</span><div class="toc-grid">';
    for (const { p, i } of ch.items) {
      const ready = !!p.story || p.type === 'adventure';
      html += '<button class="toc-card' + (ready ? '' : ' toc-soon') + '" data-page="' + i + '">' +
        '<img loading="lazy" alt="" src="' + getMediaUrl('toc_' + p.id.replace(/-/g, '') + '_v1.webp') + '" onerror="this.style.display=\'none\'">' +
        '<span class="toc-card-t">' + tt(p.title) + '</span>' +
        '<span class="toc-card-s">' + tt(p.sub) + '</span></button>';
    }
    html += '</div></div>';
  }
  html += '<button class="toc-zukan" id="toc-zukan-btn">🐾 ' + tt(I18N.ui.zukan) + '</button>';
  wrap.innerHTML = html;
  host.appendChild(wrap);
  wrap.querySelectorAll('.toc-card').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); EHON.switchPage(parseInt(b.dataset.page, 10)); }));
  const zb = wrap.querySelector('#toc-zukan-btn');
  zb.addEventListener('click', e => { e.stopPropagation(); if (window.ZukanEngine) window.ZukanEngine.openModal(); });
}
```

CSS:

```css
.toc-wrap{position:absolute;inset:6% 8% 10%;overflow:auto;z-index:30;
  background:rgba(252,246,232,.94);border-radius:14px;padding:22px 26px;
  box-shadow:0 8px 40px rgba(60,40,10,.3)}
.toc-title{font-size:1.3rem;margin:0 0 12px;color:#4a3a24;letter-spacing:.12em}
.toc-ch{margin-bottom:14px}
.toc-ch-name{font-size:.8rem;color:#8c6d46;letter-spacing:.2em}
.toc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:6px}
.toc-card{position:relative;border:none;border-radius:10px;overflow:hidden;cursor:pointer;
  background:#efe5d0;min-height:96px;padding:8px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end}
.toc-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.85}
.toc-card-t{position:relative;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.7);font-size:.95rem}
.toc-card-s{position:relative;color:#ffe;text-shadow:0 1px 3px rgba(0,0,0,.7);font-size:.7rem}
.toc-soon{filter:grayscale(.6);opacity:.75}
.toc-zukan{margin-top:8px;border:none;border-radius:99px;padding:10px 20px;font-weight:700;
  background:#4a6b48;color:#fff;cursor:pointer}
```

- [ ] **Step 3: 表紙を開いたとき目次に飛べる導線**

`EHON.open()` 内の末尾に、目次へ行く小ボタン (title-card 近く) を表示する処理を追加:

```html
<button id="goto-toc" aria-label="目次">🗺</button>
```

```js
document.getElementById('goto-toc').addEventListener('click', e => { e.stopPropagation(); EHON.switchPage(0); });
/* EHON.open() 内に追加: document.getElementById('goto-toc').classList.add('show'); */
```

```css
#goto-toc{position:fixed;top:14px;left:14px;z-index:60;font-size:1.3rem;border:none;border-radius:50%;
  width:44px;height:44px;background:rgba(74,58,36,.8);color:#fff;cursor:pointer;opacity:0;pointer-events:none;transition:.4s}
#goto-toc.show{opacity:1;pointer-events:auto}
```

- [ ] **Step 4: 動作確認 + コミット**

実機: 目次頁 (dots 先頭 or 🗺) → 章別グリッド17件中15件表示 (toc/colophon 除外)、サムネ未配置でもタイトルで成立、クリックで該当頁へめくれる。
Expected: 成立。

```bash
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html && git commit -m "feat(ehon): add table-of-contents spread (Map of Worlds)"
```

---

### Task 5: 奥付見開き「外の窓」

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html`

**Interfaces:**
- Produces: `renderColophon()`。外部リンク4窓 (YouTube/X/note/GitHub)
- Consumes: tt()、ZukanEngine.state (Task 6 後に連動。それまで図鑑行は非表示可)

- [ ] **Step 1: renderColophon 実装**

```js
const OUTSIDE_WINDOWS = [
  {icon:'▶️', name:{jp:'ずんだもんAIラボ', en:'Zundamon AI Lab'}, sub:'YouTube', url:'https://www.youtube.com/@zundamon_ai_lab'},
  {icon:'🐦', name:{jp:'X (旧Twitter)', en:'X (Twitter)'}, sub:'@ViewsEngineer', url:'https://x.com/ViewsEngineer'},
  {icon:'📝', name:{jp:'note — 月光の書架', en:'note (blog)'}, sub:'note.com', url:'https://note.com/views_of_life'},
  {icon:'🐙', name:{jp:'GitHub', en:'GitHub'}, sub:'yuichi916', url:'https://github.com/yuichi916'},
];
function renderColophon() {
  const host = document.getElementById('world-b');
  window.disposeWorldB && window.disposeWorldB();
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'colo-wrap';
  let html = '<h2 class="toc-title">' + tt(I18N.ui.windows) + '</h2><div class="colo-grid">';
  for (const w of OUTSIDE_WINDOWS) {
    html += '<a class="colo-win" target="_blank" rel="noopener" href="' + w.url + '">' +
      '<span class="colo-icon">' + w.icon + '</span>' +
      '<span class="colo-name">' + tt(w.name) + '</span>' +
      '<span class="colo-sub">' + w.sub + '</span></a>';
  }
  html += '</div><div id="colo-zukan"></div>';
  wrap.innerHTML = html;
  host.appendChild(wrap);
  if (window.ZukanEngine) window.ZukanEngine.renderSummary(wrap.querySelector('#colo-zukan'));
}
```

CSS:

```css
.colo-wrap{position:absolute;inset:10% 12%;z-index:30;background:rgba(30,26,20,.92);border-radius:14px;
  padding:26px;color:#f5ecd8;overflow:auto}
.colo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-top:10px}
.colo-win{display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 10px;border-radius:12px;
  background:linear-gradient(180deg,#5a4a32,#3c3122);text-decoration:none;color:#ffe9c4;
  border:2px solid #8c6d46;box-shadow:inset 0 0 30px rgba(255,220,150,.12)}
.colo-win:hover{box-shadow:inset 0 0 40px rgba(255,220,150,.3);transform:translateY(-2px)}
.colo-icon{font-size:1.8rem}
.colo-name{font-weight:700}
.colo-sub{font-size:.72rem;opacity:.7}
```

- [ ] **Step 2: URL の実在確認**

Run: note と YouTube の URL を開いて 200/チャンネル表示を確認 (`curl -sI -o /dev/null -w "%{http_code}" <url>` ×4)。note の URL が異なる場合は実 URL に修正 (note トップの自分のページ URL をブラウザで確認)。
Expected: 4つとも 200 系。

- [ ] **Step 3: 動作確認 + コミット**

実機: 最終頁で窓4つが並び、新規タブで正しく開く。
```bash
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html && git commit -m "feat(ehon): add colophon spread with outside windows (YouTube/X/note/GitHub)"
```

---

### Task 6: 図鑑エンジン (ZukanEngine) + モーダル + Web Audio 鳴き声

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html`
- Modify: `C:\projects\yuichi916.github.io\tests\ehon2_core_test.mjs` (ANIMALS 整合テスト追記)

**Interfaces:**
- Produces: `window.ZukanEngine = { onAnimalClick(animalId), openModal(), renderSummary(el), isComplete() }`、`const ANIMALS` (11種の全定義)、`playCry(animalId)`
- Consumes: `EHON2.zukanAdd/zukanIsComplete/dailySpotIndex` (Task 1)、Task 7 が `ZukanEngine.onAnimalClick` を raycaster から呼ぶ

- [ ] **Step 1: ANIMALS 定義と鳴き声パラメータを実装**

```js
/* ---- いきもの図鑑 ---- */
const ANIMALS = [
  {id:'wolfpup',    page:'cabin',      glb:'animal_wolfpup_v1.glb',    name:{jp:'オオカミのこども', en:'Wolf Pup'},
   quote:{jp:'小屋の焚き火、ぼくもすき。', en:'I love the cabin fire too.'},
   cry:{type:'sawtooth', f0:520, f1:380, dur:0.5, repeat:1, vib:6}},
  {id:'hare',       page:'niwa',       glb:'animal_hare_v1.glb',       name:{jp:'ホッキョクウサギ', en:'Arctic Hare'},
   quote:{jp:'庭のはっぱは、やわらかいの。', en:'The garden leaves are so soft.'},
   cry:{type:'sine', f0:900, f1:1200, dur:0.12, repeat:2, vib:0}},
  {id:'warthog',    page:'tomoshibi',  glb:'animal_warthog_v1.glb',    name:{jp:'イボイノシシ', en:'Warthog'},
   quote:{jp:'酒場のパン、ひとつちょうだい。', en:'One bread from the tavern, please.'},
   cry:{type:'sawtooth', f0:140, f1:90, dur:0.3, repeat:2, vib:0}},
  {id:'penguin',    page:'stopwatch',  glb:'animal_penguin_v1.glb',    name:{jp:'ジェンツーペンギン', en:'Gentoo Penguin'},
   quote:{jp:'時間ぴったりに、あるくのだ。', en:'I march right on time.'},
   cry:{type:'square', f0:700, f1:500, dur:0.2, repeat:3, vib:0}},
  {id:'binturong',  page:'sudoku',     glb:'animal_binturong_v1.glb',  name:{jp:'ビントロング', en:'Binturong'},
   quote:{jp:'大聖堂のはり、ねごこち最高。', en:'Cathedral beams make the best beds.'},
   cry:{type:'sine', f0:300, f1:200, dur:0.6, repeat:1, vib:3}},
  {id:'snowleopard',page:'shogi-puyo', glb:'animal_snowleopard_v1.glb',name:{jp:'ユキヒョウ', en:'Snow Leopard'},
   quote:{jp:'次の一手、みえた。', en:'I see the next move.'},
   cry:{type:'sawtooth', f0:220, f1:160, dur:0.7, repeat:1, vib:2}},
  {id:'polecat',    page:'lingo',      glb:'animal_polecat_v1.glb',    name:{jp:'ケナガイタチ', en:'European Polecat'},
   quote:{jp:'ことばって、すばしっこいね。', en:'Words are quick little things.'},
   cry:{type:'square', f0:1100, f1:800, dur:0.1, repeat:3, vib:0}},
  {id:'lioncub',    page:'toeic',      glb:'animal_lioncub_v1.glb',    name:{jp:'ライオンのこども', en:'Lion Cub'},
   quote:{jp:'30問、ぜんぶ挑むぞ！', en:'I will face all thirty trials!'},
   cry:{type:'sawtooth', f0:330, f1:240, dur:0.4, repeat:1, vib:4}},
  {id:'toad',       page:'salon',      glb:'animal_toad_v1.glb',       name:{jp:'ジムグリガエル', en:'Burrowing Toad'},
   quote:{jp:'ぼくの歌も、銀河にとどく？', en:'Will my song reach the galaxy?'},
   cry:{type:'square', f0:180, f1:220, dur:0.25, repeat:2, vib:0}},
  {id:'turtle',     page:'hitoritabi', glb:'animal_turtle_v1.glb',     name:{jp:'オサガメ', en:'Leatherback Turtle'},
   quote:{jp:'海はぜんぶ、つながってる。', en:'Every sea is connected.'},
   cry:{type:'sine', f0:400, f1:300, dur:0.5, repeat:1, vib:2}},
  {id:'dingo',      page:'world',      glb:'animal_dingo_v1.glb',      name:{jp:'ディンゴ', en:'Dingo'},
   quote:{jp:'地図のはしっこまで、いこう。', en:'To the very edge of the map.'},
   cry:{type:'sawtooth', f0:600, f1:450, dur:0.45, repeat:1, vib:5}},
];
function playCry(animalId) {
  const a = ANIMALS.find(x => x.id === animalId); if (!a) return;
  try {
    const ctx = playCry._ctx || (playCry._ctx = new (window.AudioContext || window.webkitAudioContext)());
    let t = ctx.currentTime;
    for (let r = 0; r < (a.cry.repeat || 1); r++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = a.cry.type;
      o.frequency.setValueAtTime(a.cry.f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, a.cry.f1), t + a.cry.dur);
      if (a.cry.vib) { const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = a.cry.vib; lg.gain.value = a.cry.f0 * 0.05;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + a.cry.dur); }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a.cry.dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + a.cry.dur + 0.05);
      t += a.cry.dur + 0.07;
    }
  } catch (e) { /* 音は飾り: 失敗しても図鑑登録は進める */ }
}
```

- [ ] **Step 2: ZukanEngine を実装**

```js
const ZukanEngine = (function () {
  const LS = 'ehon_zukan';
  function load() {
    try { const s = JSON.parse(localStorage.getItem(LS) || '{}'); return { found: s.found || {} }; }
    catch (e) { return { found: {} }; }
  }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const ids = ANIMALS.map(a => a.id);
  function isComplete() { return window.EHON2.zukanIsComplete(load(), ids); }
  function onAnimalClick(animalId) {
    const a = ANIMALS.find(x => x.id === animalId); if (!a) return;
    playCry(animalId);
    const before = isComplete();
    save(window.EHON2.zukanAdd(load(), animalId, todayStr()));
    showFoundToast(a);
    if (!before && isComplete()) setTimeout(showCompleteReward, 1200);
  }
  function showFoundToast(a) {
    let el = document.getElementById('zukan-toast');
    if (!el) { el = document.createElement('div'); el.id = 'zukan-toast'; document.body.appendChild(el); }
    el.innerHTML = '<b>' + tt(I18N.ui.found) + '</b> ' + tt(a.name) + '<br><span>「' + tt(a.quote) + '」</span>';
    el.classList.add('show');
    clearTimeout(showFoundToast._t);
    showFoundToast._t = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function showCompleteReward() {
    document.body.classList.add('zukan-complete');   /* 表紙の金の紋章 CSS が反応 */
    openModal();                                      /* コンプ状態のモーダル (シェアボタン付き Task 16) */
  }
  function openModal() {
    const st = load();
    let mod = document.getElementById('zukan-modal');
    if (!mod) { mod = document.createElement('div'); mod.id = 'zukan-modal'; document.body.appendChild(mod); }
    let html = '<div class="zk-box"><h3>🐾 ' + tt(I18N.ui.zukan) + '</h3><div class="zk-grid">';
    for (const a of ANIMALS) {
      const f = st.found[a.id];
      html += '<div class="zk-cell' + (f ? ' zk-found' : '') + '">' +
        '<img loading="lazy" alt="" src="' + getMediaUrl('zukan_' + a.id + '_v1.webp') + '" onerror="this.style.visibility=\'hidden\'">' +
        '<span class="zk-name">' + (f ? tt(a.name) : tt(I18N.ui.notFound)) + '</span>' +
        (f ? '<span class="zk-date">' + f + '</span>' : '') + '</div>';
    }
    html += '</div>' +
      (isComplete() ? '<p class="zk-comp">👑 ' + tt(I18N.ui.complete) + '</p><div id="zk-share"></div>' : '') +
      '<button class="zk-close">' + tt(I18N.ui.close) + '</button></div>';
    mod.innerHTML = html; mod.classList.add('show');
    mod.querySelector('.zk-close').addEventListener('click', () => mod.classList.remove('show'));
    if (window.renderShareButton && isComplete()) window.renderShareButton(mod.querySelector('#zk-share')); /* Task 16 */
  }
  function renderSummary(el) {
    if (!el) return;
    const st = load();
    const n = ids.filter(id => st.found[id]).length;
    el.innerHTML = '<button class="toc-zukan" style="margin-top:16px">🐾 ' + tt(I18N.ui.zukan) + ' ' + n + '/' + ids.length + '</button>';
    el.querySelector('button').addEventListener('click', e => { e.stopPropagation(); openModal(); });
  }
  if (isComplete()) document.body.classList.add('zukan-complete');
  return { onAnimalClick, openModal, renderSummary, isComplete };
})();
window.ZukanEngine = ZukanEngine;
```

CSS:

```css
#zukan-toast{position:fixed;left:50%;bottom:9%;transform:translateX(-50%) translateY(20px);z-index:90;
  background:rgba(40,60,36,.95);color:#fff;border-radius:12px;padding:12px 22px;text-align:center;
  opacity:0;pointer-events:none;transition:.35s}
#zukan-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#zukan-toast span{font-size:.85rem;opacity:.85}
#zukan-modal{position:fixed;inset:0;z-index:95;background:rgba(20,16,10,.6);display:none;
  align-items:center;justify-content:center}
#zukan-modal.show{display:flex}
.zk-box{background:#fbf4e4;border-radius:16px;max-width:640px;width:92%;max-height:84vh;overflow:auto;
  padding:20px 24px;color:#463823}
.zk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.zk-cell{background:#e8dcc2;border-radius:10px;padding:8px;text-align:center;filter:grayscale(1);opacity:.66}
.zk-cell.zk-found{filter:none;opacity:1;background:#fff8e6;box-shadow:0 2px 8px rgba(150,110,40,.25)}
.zk-cell img{width:100%;aspect-ratio:1;object-fit:contain}
.zk-name{display:block;font-weight:700;font-size:.8rem}
.zk-date{display:block;font-size:.66rem;opacity:.6}
.zk-comp{font-weight:700;color:#a3552f;text-align:center}
.zk-close{margin-top:12px;border:none;border-radius:99px;padding:8px 22px;background:#8c6d46;color:#fff;cursor:pointer}
body.zukan-complete #title-card h1::after{content:' 👑'}
```

- [ ] **Step 3: 整合テストを追記して実行**

`tests/ehon2_core_test.mjs` 末尾に追記:

```js
// ANIMALS と PAGES の整合 (HTML テキストレベルの静的チェック)
const animalIds = [...html.matchAll(/\{id:'([a-z]+)',\s*page:'([a-z\-]+)'/g)].map(m => ({ id: m[1], page: m[2] }));
assert.strictEqual(animalIds.length, 11, '11 animals defined');
const pageIds = [...html.matchAll(/\{id:'([a-z\-]+)', type:'content'/g)].map(m => m[1]);
for (const a of animalIds) assert.ok(pageIds.includes(a.page), `animal ${a.id} page exists: ${a.page}`);
assert.ok(!animalIds.some(a => a.page === 'hollow-tale'), 'hollow-tale has no animal');
console.log('animals/pages consistency: PASS');
```

Run: `node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"`
Expected: ALL PASS + consistency PASS

- [ ] **Step 4: 手動確認 + コミット**

実機コンソールで `ZukanEngine.onAnimalClick('turtle')` → 鳴き声+トースト+モーダルに登録が反映、`localStorage.ehon_zukan` 保存確認。
```bash
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html tests/ehon2_core_test.mjs && git commit -m "feat(ehon): creature book engine with web-audio cries and modal"
```

---

### Task 7: bootWorldB の PAGES 対応 + 動物配置 + raycaster + フォールバック

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html` (`window.bootWorldB` L1061〜)

**Interfaces:**
- Consumes: PAGES (Task 2)、ANIMALS/ZukanEngine (Task 6)、`EHON2.dailySpotIndex` (Task 1)、既存 `mountBook3D`/`disposeWorldB`/`getAssetUrl`
- Produces: 頁別 diorama + 動物 GLB 表示。`animal.spots` は各頁データの `[{x,y,z},...]` (diorama 正規化後のローカル座標、単位=本の上のシーン座標)

- [ ] **Step 1: bootWorldB を頁対応に改修**

`window.bootWorldB` 内の変更点 (全文を以下に。既存の同名関数を置換):

```js
window.bootWorldB = async function () {
  const page = PAGES[EHON.state.currentPageIdx];
  if (!page.diorama) return;                       /* toc/colophon は renderToc/renderColophon が描く */
  const host = document.getElementById('world-b');
  host.innerHTML = '';
  _bDisposed = false;

  const msg = document.createElement('div');
  msg.className = 'status-msg';
  msg.textContent = (ehonLang() === 'jp') ? '3Dを読み込み中…' : 'Loading 3D…';
  host.appendChild(msg);

  if (!window.WebGLRenderingContext) { showStaticFallback(host, page); return; }

  const bookMount = window.mountBook3D(host, { noLoop: true, camPos: page.camPos || [0, 7, 14] });
  _renderer = bookMount.renderer;
  const scene = bookMount.scene;
  const cam = bookMount.cam;

  const controls = new OrbitControls(cam, _renderer.domElement);
  controls.enablePan = false; controls.minDistance = 9; controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.49; controls.target.set(0, 1.5, 0);
  controls.autoRotate = true; controls.autoRotateSpeed = 0.55;
  _controls = controls;

  const fail = (label, url, err) => {
    showStaticFallback(host, page);
    console.error('ehon 3D load error', label, url, err);
  };
  const loadGLB = (url) => {
    const draco2 = new DRACOLoader();
    draco2.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    const ldr = new GLTFLoader();
    ldr.setDRACOLoader(draco2);
    return new Promise((res, rej) => ldr.load(url, g => res(g), undefined, e => rej(e)));
  };

  const dioUrl = window.getAssetUrl(page.diorama);
  let dioramaGrp = null, targetY = 0, animalMesh = null;

  (async () => {
    try {
      const bookTopY = await bookMount.bookTopYPromise.catch(e => { fail('本(book.glb)', '', e); throw e; });
      if (_bDisposed) return;
      const dioGltf = await loadGLB(dioUrl).catch(e => { fail('ジオラマ', dioUrl, e); throw e; });
      if (_bDisposed) return;
      const dio = dioGltf.scene;
      let db = new THREE.Box3().setFromObject(dio);
      let ds = db.getSize(new THREE.Vector3());
      const dScale = 7.5 / Math.max(ds.x, ds.y, ds.z);
      dio.scale.setScalar(dScale);
      db = new THREE.Box3().setFromObject(dio);
      const dc = db.getCenter(new THREE.Vector3());
      dio.position.x -= dc.x; dio.position.z -= dc.z;
      dio.position.y -= db.min.y;
      dioramaGrp = new THREE.Group();
      dioramaGrp.add(dio);

      /* ---- 動物 (この頁の住人・日替わり位置) ---- */
      const animal = ANIMALS.find(a => a.page === page.id);
      if (animal && page.animalSpots && page.animalSpots.length) {
        try {
          const ag = await loadGLB(window.getAssetUrl(animal.glb));
          if (!_bDisposed) {
            const am = ag.scene;
            const ab = new THREE.Box3().setFromObject(am);
            const asz = ab.getSize(new THREE.Vector3());
            am.scale.setScalar(1.1 / Math.max(asz.x, asz.y, asz.z)); /* 本の上で約1.1ユニット */
            const today = new Date();
            const ds8 = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            const spot = page.animalSpots[window.EHON2.dailySpotIndex(ds8, animal.id, page.animalSpots.length)];
            am.position.set(spot.x, spot.y, spot.z);
            am.traverse(o => { if (o.isMesh) o.userData.animalId = animal.id; });
            animalMesh = am;
            dioramaGrp.add(am);
          }
        } catch (e) { console.warn('animal load failed (non-fatal)', e); }
      }

      dioramaGrp.position.y = bookTopY;
      targetY = bookTopY;
      dioramaGrp.scale.setScalar(EHON.state.open ? 1 : 0.001);
      scene.add(dioramaGrp);
      controls.target.set(0, bookTopY + 1.5, 0);
      if (msg.parentNode) msg.remove();
      if (EHON.state.open) window.popWorldB();
    } catch (e) { /* fail() 済み */ }
  })();

  /* ---- クリック: raycaster で動物ヒット判定 ---- */
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
  _renderer.domElement.addEventListener('pointerdown', (ev) => {
    if (!animalMesh || _bDisposed) return;
    const r = _renderer.domElement.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, cam);
    const hits = ray.intersectObject(animalMesh, true);
    if (hits.length) { ev.stopPropagation(); window.ZukanEngine.onAnimalClick(hits[0].object.userData.animalId); }
  });

  _popB = () => {
    if (!dioramaGrp) return;
    const t0 = performance.now();
    (function pop() {
      if (_bDisposed) return;
      const k = Math.min(1, (performance.now() - t0) / 950);
      const e = 1 - Math.pow(1 - k, 3);
      dioramaGrp.scale.setScalar(0.001 + e * 0.999);
      dioramaGrp.position.y = targetY - 3 * (1 - e);
      if (k < 1) requestAnimationFrame(pop);
    })();
  };

  (function loop() {
    if (_bDisposed) return;
    if (EHON.state.mode === 'b') { controls.update(); _renderer.render(scene, cam); }
    requestAnimationFrame(loop);
  })();
};

/* WebGL 不可・GLB 失敗時の静的フォールバック (リンクは常に生かす) */
function showStaticFallback(host, page) {
  host.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'status-msg';
  d.innerHTML = '<img alt="" style="max-width:60%;border-radius:12px" src="' + getMediaUrl('toc_' + page.id.replace(/-/g, '') + '_v1.webp') + '" onerror="this.remove()"><br>' + tt(I18N.ui.preparing);
  host.appendChild(d);
}
```

- [ ] **Step 2: PAGES に animalSpots を追加**

各 content 頁定義に `animalSpots` フィールドを追加 (Task 2 の PAGES へ)。頁制作前の暫定値は共通で本上の3点。頁制作タスク (Task 10〜14) で diorama に合わせ調整:

```js
/* 各 content 頁に追加 (例: cabin) — 値は暫定、頁制作時に調整 */
animalSpots: [{x:-2.2,y:0,z:1.5},{x:2.4,y:0,z:0.8},{x:0.2,y:0,z:2.6}],
```

- [ ] **Step 3: 既存3世界のリグレッション確認**

実機: enchanted/valhalla/darkfantasy 頁の diorama 表示・回転・せり上がり・クエスト (方式A) が従来通り。
Expected: 従来動作維持 (bootWorldB 差し替えの影響なし)。

- [ ] **Step 4: チェック + コミット**

```bash
node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html && git commit -m "feat(ehon): page-aware bootWorldB with daily animal placement and raycaster"
```

---

### Task 8: Blender 共通パイプライン (diorama / 動物 / サムネ)

**Files:**
- Create: `C:\projects\yuichi916.github.io\_blender\ehon2_diorama.py`
- Create: `C:\projects\yuichi916.github.io\_blender\ehon2_animal.py`
- Create: `C:\projects\yuichi916.github.io\_blender\ehon2_pages.json` (頁→キット/アセット選定の設定台帳)

**Interfaces:**
- Produces: `python 実行 → C:\tmp\ehon2\<page>_diorama.glb` (≤4MB) と `C:\tmp\ehon2\thumb_<page>.png`、`C:\tmp\ehon2\animal_<id>_v1.glb` (≤1MB)
- Consumes: `C:\tmp\blends\` のキット blend、`docs/asset-inventory/` の台帳名
- 頁設定 JSON スキーマ: `{"<pageId>": {"blend": path, "tex": path, "include_prefixes": [..], "exclude_substr": [..], "focal": str|null, "radius": float|null, "max_tex": 1024, "thumb_cam": {"dist": float, "elev_deg": float, "azim_deg": float}}}`

- [ ] **Step 1: ehon2_diorama.py を作成**

`ehon_world_gltf.py` (既存) を土台に、**明示 prefix リスト方式** (ユーザー要件: 厳密選定) を追加:

```python
"""ehon2 diorama GLB ビルダー (明示 prefix 選定方式)
usage: blender -b --factory-startup --python ehon2_diorama.py -- <pageId>
入力: _blender/ehon2_pages.json の <pageId> エントリ
出力: C:\tmp\ehon2\<pageId>_diorama.glb + thumb_<pageId>.png
"""
import bpy, sys, os, json, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PAGE = ARGV[0]
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, 'ehon2_pages.json'), encoding='utf-8'))[PAGE]
OUT_DIR = r'C:\tmp\ehon2'
os.makedirs(OUT_DIR, exist_ok=True)
SLUG = PAGE.replace('-', '')   # hollow-tale → hollowtale (PAGES の diorama 名・toc 名と一致させる)
OUT = os.path.join(OUT_DIR, f'{SLUG}_diorama.glb')

bpy.ops.wm.open_mainfile(filepath=CFG['blend'])
if CFG.get('tex') and os.path.isdir(CFG['tex']):
    try: bpy.ops.file.find_missing_files(directory=CFG['tex'])
    except Exception as e: print('[ehon2] ffm err', e)

def center(o):
    acc = Vector((0,0,0))
    for c in o.bound_box: acc += o.matrix_world @ Vector(c)
    return acc / 8

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
keep = []
prefixes = CFG.get('include_prefixes') or []
excl = CFG.get('exclude_substr') or []
if prefixes:
    keep = [o for o in meshes
            if any(o.name.startswith(p) for p in prefixes)
            and not any(x.lower() in o.name.lower() for x in excl)]
if CFG.get('focal') and CFG.get('radius'):   # prefix に加えて焦点半径でも拾える (併用可)
    focal = None
    for o in meshes:
        if CFG['focal'].lower() in o.name.lower(): focal = center(o); break
    if focal is not None:
        for o in meshes:
            c = center(o)
            if math.hypot(c.x-focal.x, c.y-focal.y) <= CFG['radius'] and o not in keep \
               and not any(x.lower() in o.name.lower() for x in excl):
                keep.append(o)
assert keep, f'[ehon2] no objects selected for {PAGE}'
print(f'[ehon2] {PAGE} keep={len(keep)}')

keepset = set(keep)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o not in keepset:
        bpy.data.objects.remove(o, do_unlink=True)

for o in keep:
    if len(o.data.vertices) > 15000:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.4

mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
for o in keep:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector((min(mn[i], w[i]) for i in range(3)))
        mx = Vector((max(mx[i], w[i]) for i in range(3)))
ctr = (mn + mx) / 2
for o in keep:
    o.location -= Vector((ctr.x, ctr.y, mn.z))

MAXTEX = int(CFG.get('max_tex', 1024))
for im in bpy.data.images:
    try:
        w, h = im.size
        if w > MAXTEX or h > MAXTEX:
            s = MAXTEX / max(w, h)
            im.scale(max(1, int(w*s)), max(1, int(h*s)))
    except Exception: pass

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_image_format='WEBP', export_image_quality=60,
                          export_apply=True, export_yup=True)
size_mb = os.path.getsize(OUT) / 1048576
print(f'[ehon2] {OUT} = {size_mb:.2f} MB')
assert size_mb <= 4.0, f'GLB over budget: {size_mb:.2f} MB > 4 MB — include_prefixes を絞るか max_tex を下げる'

# ---- サムネレンダ (目次用) ----
tc = CFG.get('thumb_cam', {'dist': 30, 'elev_deg': 28, 'azim_deg': 35})
sz = (mx - mn)
rad = max(sz.x, sz.y, sz.z) * 1.15 if max(sz.x, sz.y, sz.z) > 0 else tc['dist']
el = math.radians(tc['elev_deg']); az = math.radians(tc['azim_deg'])
cam_d = bpy.data.cameras.new('thumbcam'); cam_o = bpy.data.objects.new('thumbcam', cam_d)
bpy.context.scene.collection.objects.link(cam_o)
tgt = Vector((0, 0, sz.z * 0.35))
cam_o.location = tgt + Vector((rad*math.cos(el)*math.cos(az), -rad*math.cos(el)*math.sin(az), rad*math.sin(el)))
d = tgt - cam_o.location
cam_o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam_o
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5
sun_o = bpy.data.objects.new('sun', sun); bpy.context.scene.collection.objects.link(sun_o)
sun_o.rotation_euler = (math.radians(50), 0, math.radians(20))
bpy.context.scene.render.engine = 'CYCLES'   # 前回実績 (ehon_world_render.py)。EEVEE系はBlender5.1で名称流動のため使わない
bpy.context.scene.cycles.samples = 64
bpy.context.scene.render.resolution_x = 640
bpy.context.scene.render.resolution_y = 400
bpy.context.scene.render.filepath = os.path.join(OUT_DIR, f'thumb_{SLUG}.png')
bpy.ops.render.render(write_still=True)
print(f'{SLUG.upper()}_EHON2_DONE')
```

- [ ] **Step 2: ehon2_animal.py を作成**

```python
"""動物 STL → クレイ質感 GLB (Draco)
usage: blender -b --factory-startup --python ehon2_animal.py -- <animalId> <stlPath> [decimate_ratio]
出力: C:\tmp\ehon2\animal_<animalId>_v1.glb (≤1MB 目標)
"""
import bpy, sys, os

ARGV = sys.argv[sys.argv.index('--') + 1:]
AID, STL = ARGV[0], ARGV[1]
RATIO = float(ARGV[2]) if len(ARGV) > 2 else 0.02   # 数百万頂点 → 数万
OUT = rf'C:\tmp\ehon2\animal_{AID}_v1.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=STL)
obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = obj

# 3Dプリント用サポート等の分離ゴミがあれば最大アイランドのみ残す前提だが、
# pre-supported でない本体 STL を使うこと (wolf-pup.stl の方。*-pre-supported.stl は使わない)
m = obj.modifiers.new('dec', 'DECIMATE'); m.ratio = RATIO
bpy.ops.object.modifier_apply(modifier='dec')
print('[ehon2] verts after decimate:', len(obj.data.vertices))

# クレイ質感 (単色・微ラフ)
mat = bpy.data.materials.new('clay'); mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.82, 0.74, 0.62, 1.0)  # 生成りクレイ
bsdf.inputs['Roughness'].default_value = 0.85
obj.data.materials.clear(); obj.data.materials.append(mat)

# 原点を底面中央に・向きは STL のまま (頁組込みで調整)
import mathutils
mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
for c in obj.bound_box:
    w = obj.matrix_world @ mathutils.Vector(c)
    mn = mathutils.Vector((min(mn[i], w[i]) for i in range(3)))
    mx = mathutils.Vector((max(mx[i], w[i]) for i in range(3)))
obj.location -= mathutils.Vector(((mn.x+mx.x)/2, (mn.y+mx.y)/2, mn.z))

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_apply=True, export_yup=True)
size_mb = os.path.getsize(OUT) / 1048576
print(f'[ehon2] {OUT} = {size_mb:.2f} MB')
assert size_mb <= 1.0, f'animal GLB over budget: {size_mb:.2f} MB — decimate_ratio を下げる'
print(f'{AID.upper()}_ANIMAL_DONE')
```

- [ ] **Step 3: ehon2_pages.json の初期版 (先行4頁+残り8頁の設定)**

台帳 (`docs/asset-inventory/`) のオブジェクト名に基づく (prefix は実在名。実行時に `keep=0` なら台帳を再確認して調整):

```json
{
  "hitoritabi": {
    "blend": "C:\\tmp\\blends\\ti\\KB3D_TreasureIsland-Native.blend",
    "tex":   "C:\\tmp\\blends\\ti\\KB3DTextures",
    "include_prefixes": ["KB3D_TIS_Ship_A_", "KB3D_TIS_Lantern", "KB3D_TIS_Crate", "KB3D_TIS_Barrel", "KB3D_TIS_Chest", "KB3D_TIS_Palm"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 40, "elev_deg": 22, "azim_deg": 40}
  },
  "lingo": {
    "blend": "C:\\tmp\\blends\\eci\\kb3d_enchantedinteriors-native.blend",
    "tex":   "C:\\tmp\\blends\\eci\\eci_textures",
    "include_prefixes": ["KB3D_ECI_IntWizardOffice"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 24, "elev_deg": 18, "azim_deg": 30}
  },
  "tomoshibi": {
    "blend": "C:\\tmp\\blends\\eci\\kb3d_enchantedinteriors-native.blend",
    "tex":   "C:\\tmp\\blends\\eci\\eci_textures",
    "include_prefixes": ["KB3D_ECI_IntTavern"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 24, "elev_deg": 18, "azim_deg": -25}
  },
  "toeic": {
    "blend": "C:\\tmp\\blends\\eci\\kb3d_enchantedinteriors-native.blend",
    "tex":   "C:\\tmp\\blends\\eci\\eci_textures",
    "include_prefixes": ["KB3D_ECI_IntPaladinsArmory"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 26, "elev_deg": 20, "azim_deg": 30}
  },
  "world": {
    "blend": "C:\\tmp\\blends\\eci\\kb3d_enchantedinteriors-native.blend",
    "tex":   "C:\\tmp\\blends\\eci\\eci_textures",
    "include_prefixes": ["KB3D_ECI_IntKingsHall"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 30, "elev_deg": 24, "azim_deg": 35}
  },
  "cabin": {
    "blend": "C:\\tmp\\blends\\eci\\kb3d_enchantedinteriors-native.blend",
    "tex":   "C:\\tmp\\blends\\eci\\eci_textures",
    "include_prefixes": ["KB3D_ECI_PropStove", "KB3D_ECI_PropFire", "KB3D_ECI_PropCandle", "KB3D_ECI_PropTable", "KB3D_ECI_PropShelf", "KB3D_ECI_PropBook"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 14, "elev_deg": 16, "azim_deg": 25}
  },
  "niwa": {
    "blend": "C:\\tmp\\blends\\enc\\kb3d_enchanted-native.blend",
    "tex":   "C:\\tmp\\blends\\enchanted\\KB3DTextures",
    "include_prefixes": ["KB3D_ENC_PropShrub", "KB3D_ENC_PropPlanter", "KB3D_ENC_PropTree", "KB3D_ENC_PropLantern", "KB3D_ENC_BldgSm_A"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 20, "elev_deg": 22, "azim_deg": 30}
  },
  "sudoku": {
    "blend": "C:\\tmp\\blends\\dkf\\KB3D_DarkFantasy-Native.blend",
    "tex":   "C:\\tmp\\blends\\dkf\\Textures",
    "include_prefixes": [],
    "exclude_substr": [],
    "focal": "BldgLG_B", "radius": 45.0, "max_tex": 1024,
    "thumb_cam": {"dist": 45, "elev_deg": 24, "azim_deg": 35}
  },
  "shogi-puyo": {
    "blend": "C:\\tmp\\blends\\val\\KB3D_Valhalla-Native.blend",
    "tex":   "C:\\tmp\\blends\\val\\Textures",
    "include_prefixes": ["KB3D_VAL_Shield", "KB3D_VAL_Weapon", "KB3D_VAL_Totem", "KB3D_VAL_Target", "KB3D_VAL_Well", "KB3D_VAL_BldgSM_A"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 22, "elev_deg": 20, "azim_deg": -30}
  },
  "stopwatch": {
    "blend": "C:\\tmp\\blends\\dkf\\KB3D_DarkFantasy-Native.blend",
    "tex":   "C:\\tmp\\blends\\dkf\\Textures",
    "include_prefixes": ["KB3D_DKF_Tower_A", "KB3D_DKF_Tower_B"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 40, "elev_deg": 18, "azim_deg": 25}
  },
  "hollow-tale": {
    "blend": "C:\\tmp\\blends\\val\\KB3D_Valhalla-Native.blend",
    "tex":   "C:\\tmp\\blends\\val\\Textures",
    "include_prefixes": ["KB3D_VAL_Firewood", "KB3D_VAL_Torch", "KB3D_VAL_Bench", "KB3D_VAL_Rock", "KB3D_VAL_BldgSM_A"],
    "exclude_substr": [],
    "focal": null, "radius": null, "max_tex": 1024,
    "thumb_cam": {"dist": 16, "elev_deg": 15, "azim_deg": 20}
  },
  "salon": { "_note": "自作銀河シーン (Task 13 専用スクリプト ehon2_salon.py)。この JSON では扱わない" }
}
```

- [ ] **Step 4: パイプライン疎通テスト (lingo で1回)**

Run:
```bash
"C:/Users/yuich/Downloads/blender-5.1.1-windows-x64/blender-5.1.1-windows-x64/blender.exe" -b --factory-startup --python "C:/projects/yuichi916.github.io/_blender/ehon2_diorama.py" -- lingo
```
Expected: `[ehon2] lingo keep=<100〜200>` → `... MB` (≤4MB assert 通過) → `thumb_lingo.png` 生成 → `LINGO_EHON2_DONE`。
`C:\tmp\ehon2\thumb_lingo.png` を **Read (画像) で目視確認**: 魔法使いの書斎に見えるか / マゼンタ (テクスチャ欠落) が無いか。マゼンタなら `find_missing_files` の tex パスを確認 (ECI は `.png.2k` 変則名フォルダ由来のローカルコピー)。

- [ ] **Step 5: コミット**

```bash
cd "C:/projects/yuichi916.github.io"
git add _blender/ehon2_diorama.py _blender/ehon2_animal.py _blender/ehon2_pages.json
git commit -m "feat(ehon): blender pipeline for page dioramas and clay animals"
```

---

### Task 9: 動物 11 体の GLB 一括制作

**Files:**
- Create (成果物): `C:\projects\yuichi916.github.io\_ehon_assets\ehon\animal_<id>_v1.glb` ×11
- Create: `C:\tmp\ehon2\animals_extract\` (STL 展開作業場)

**Interfaces:**
- Consumes: `P:\CG fanbook\3D assets\01. Fre Model Collection\*.zip/.rar`、Task 8 の `ehon2_animal.py`
- Produces: Task 7 が `getAssetUrl('animal_<id>_v1.glb')` でロードする 11 ファイル

- [ ] **Step 1: アーカイブを展開**

zip は 10 種 (turtle のみ rar)。PowerShell:

```powershell
$src = 'P:\CG fanbook\3D assets\01. Fre Model Collection'
$dst = 'C:\tmp\ehon2\animals_extract'
New-Item -ItemType Directory -Force $dst | Out-Null
Get-ChildItem "$src\*.zip" | ForEach-Object {
  Expand-Archive -Path $_.FullName -DestinationPath (Join-Path $dst $_.BaseName) -Force
}
```

rar (Leatherback Sea Turtle): `7z` が無ければ `winget install 7zip.7zip` 後:

```powershell
& "C:\Program Files\7-Zip\7z.exe" x "P:\CG fanbook\3D assets\01. Fre Model Collection\Animal - Leatherback Sea Turtle 02.rar" -o"C:\tmp\ehon2\animals_extract\turtle" -y
```

Expected: 各フォルダに `*.stl` (pre-supported でない方を使う)。

- [ ] **Step 2: 11 体を変換**

対応表 (animalId → 展開フォルダ内の本体 STL。実ファイル名は展開後に `ls` で確認し、`-pre-supported`/`presupported` の付かない方を選ぶ):

| animalId | アーカイブ |
|---|---|
| wolfpup | Wolf Pup.zip |
| hare | (Arctic Hares は jpg のみの可能性 → 展開結果に STL が無ければ本タスク Step 4 の欠員処理へ) |
| warthog | Common Warthog.zip |
| penguin | gentoo-penguin.zip |
| binturong | Binturong - Bear Cat.zip |
| snowleopard | Snow Leopard Stretching.zip |
| polecat | european-polecat-standing.zip |
| lioncub | Lion Cubs Playing.zip |
| toad | Mexican Burrowing Toad.zip |
| turtle | Animal - Leatherback Sea Turtle 02.rar |
| dingo | dingo.zip |

各体 (bash、STL パスは展開結果で置換):

```bash
B="C:/Users/yuich/Downloads/blender-5.1.1-windows-x64/blender-5.1.1-windows-x64/blender.exe"
A="C:/projects/yuichi916.github.io/_blender/ehon2_animal.py"
"$B" -b --factory-startup --python "$A" -- wolfpup "C:/tmp/ehon2/animals_extract/Wolf Pup/wolf-pup.stl"
# … 11体分繰り返し (animalId と STL パスを差し替え)
```

Expected: 各 `animal_<id>_v1.glb` が `≤1.0MB` assert を通過。超過したら第3引数で ratio を下げて再実行 (例 `-- wolfpup <stl> 0.01`)。

- [ ] **Step 3: リポジトリへ配置 + プレビュー確認**

```bash
cp C:/tmp/ehon2/animal_*_v1.glb "C:/projects/yuichi916.github.io/_ehon_assets/ehon/"
ls -la "C:/projects/yuichi916.github.io/_ehon_assets/ehon/" | grep animal
```

実機ブラウザのコンソールで 1 体スポット確認 (cabin 頁で wolfpup が本の上に立つ / クリックで鳴く+図鑑登録)。

- [ ] **Step 4: 欠員処理 (STL が無い動物がいた場合)**

Arctic Hares 等、アーカイブに STL が無い/破損の場合: その動物は **ANIMALS から外さず** `glb:null` にして頁配置をスキップ (図鑑には「？？？」のまま残さない — ANIMALS から一時的に外し、テストの `11 animals` 期待値も合わせて修正し、コミットメッセージに欠員理由を明記)。代替素材は Sketchfab/Thingiverse の CC0 を後日調達 (スペックの「不足分はネット調達」枠)。

- [ ] **Step 5: コミット**

```bash
cd "C:/projects/yuichi916.github.io"
git add _ehon_assets/ehon/animal_*.glb ehon.html tests/ehon2_core_test.mjs
git commit -m "feat(ehon): add 11 clay animal GLBs (decimated STL, draco)"
```

---

### Task 10: 先行頁① hitoritabi「出航の港」(頁制作の標準手順)

この手順が**頁制作の標準テンプレート**。Task 11〜14 も同じ 6 ステップで行う。

**Files:**
- Modify: `C:\projects\yuichi916.github.io\_blender\ehon2_pages.json` (調整)
- Create: `C:\projects\yuichi916.github.io\_ehon_assets\ehon\hitoritabi_diorama.glb`
- Modify: `C:\projects\yuichi916.github.io\ehon.html` (story 記入・animalSpots 調整)

**Interfaces:**
- Consumes: Task 8 パイプライン、Task 9 の `animal_turtle_v1.glb`
- Produces: 完成した hitoritabi 見開き (diorama+動物+物語文+サムネ)

- [ ] **Step 1: diorama をビルド**

```bash
"C:/Users/yuich/Downloads/blender-5.1.1-windows-x64/blender-5.1.1-windows-x64/blender.exe" -b --factory-startup --python "C:/projects/yuichi916.github.io/_blender/ehon2_diorama.py" -- hitoritabi
```
Expected: `keep=40〜80` / `≤4MB` / `HITORITABI_EHON2_DONE`

- [ ] **Step 2: サムネを目視レビュー (吟味ゲート)**

`C:\tmp\ehon2\thumb_hitoritabi.png` を Read で確認。合格基準: **帆船が主役として判別できる / 港の小物 (樽・ランタン) が添えてある / マゼンタ・穴あきテクスチャ無し / 「ただの建物群」になっていない**。不合格なら `ehon2_pages.json` の `include_prefixes` を調整 (台帳 `docs/asset-inventory/treasure_island.txt` から候補を選び直す) して Step 1 からやり直し。**安易な妥協で次に進まない** (ユーザー要件)。

- [ ] **Step 3: GLB 配置 + 物語文記入**

```bash
cp C:/tmp/ehon2/hitoritabi_diorama.glb "C:/projects/yuichi916.github.io/_ehon_assets/ehon/"
```

ehon.html の hitoritabi 頁定義に story を記入:

```js
story:{jp:'港のすみで、一そうの帆船が息をととのえている。32回の一人旅の記録が、船倉にぎっしり詰まっている。今日はどの海の話を聞こうか。',
       en:'In a corner of the harbor, a tall ship catches its breath. Its hold is packed with records of 32 solo journeys. Which sea shall we hear about today?'},
```

- [ ] **Step 4: 動物スポット調整**

実機で hitoritabi 頁を開き、コンソールで diorama スケール後の座標を確認しながら `animalSpots` 3〜5 点を決めて記入 (甲板上・桟橋・樽のかげ等)。ウミガメが埋まらない/浮かないこと。

```js
animalSpots: [{x:-2.6,y:0.1,z:1.8},{x:1.9,y:1.2,z:-0.6},{x:3.1,y:0.05,z:1.2},{x:-0.8,y:0.1,z:2.8}],
```

- [ ] **Step 5: 実機確認**

チェック: めくって現れる → 帆船 diorama がせり上がる → 自動回転 → ウミガメ発見クリックで鳴き声+図鑑 → 「この世界に入る →」で hitoritabi/index.html へ遷移 → 戻って他頁への影響なし。JP/EN 両言語で story 表示。

- [ ] **Step 6: チェック + コミット**

```bash
node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io"
git add ehon.html _ehon_assets/ehon/hitoritabi_diorama.glb _blender/ehon2_pages.json
git commit -m "feat(ehon): hitoritabi page — departure harbor diorama with sea turtle"
```

---

### Task 11: 先行頁② lingo「ことばの書斎」

Task 10 と同じ 6 ステップ。頁固有パラメータのみ記す:

- ビルド: `-- lingo` (ECI IntWizardOffice)
- 吟味基準: 机・本・巻物・魔法の器具が「書斎」として読める / 壁や床の欠けが目立たない
- story:
```js
story:{jp:'ことばの魔法使いの書斎。ひらいた本の上を、英語のことばが小鳥のように飛びかう。今日のリスニングは、どの動画にしよう。',
       en:"The word wizard's study. English words flit over open books like little birds. Which video shall we listen to today?"},
```
- 動物: polecat (机の下・本棚の上・巻物のかご等 3〜5 スポット)
- コミット: `feat(ehon): lingo page — word wizard's study diorama with polecat`

- [ ] Task 10 の Step 1〜6 を lingo で実施

---

### Task 12: 先行頁③ tomoshibi「小さな灯」

- ビルド: `-- tomoshibi` (ECI IntTavern)
- 吟味基準: ストーブ/蝋燭の「あたたかい灯」が主役に見える構図 (thumb_cam の azim/elev を調整して灯が正面に)
- story:
```js
story:{jp:'夜の酒場に、小さな灯がともっている。朝がつらい日は、ここであたたかいスープを一杯。心を軽くする手帖を、そっとひらこう。',
       en:'A little lamp glows in the night tavern. On heavy mornings, have a warm soup here and gently open the notebook that lightens your heart.'},
```
- 動物: warthog (カウンター横・樽のそば・入口等)
- コミット: `feat(ehon): tomoshibi page — night tavern diorama with warthog`

- [ ] Task 10 の Step 1〜6 を tomoshibi で実施

---

### Task 13: 先行頁④ salon「歌う銀河」(自作 3D シーン)

**Files:**
- Create: `C:\projects\yuichi916.github.io\_blender\ehon2_salon.py`
- Create: `C:\projects\yuichi916.github.io\_ehon_assets\ehon\salon_diorama.glb`

KitBash に宇宙素材が無いため自作 (スペック承認済みの自作枠)。渦巻銀河をパーティクル的な発光小球で構成:

- [ ] **Step 1: ehon2_salon.py を作成**

```python
"""salon 用: 渦巻銀河 diorama (自作ジオメトリ、発光マテリアル)
usage: blender -b --factory-startup --python ehon2_salon.py
出力: C:\tmp\ehon2\salon_diorama.glb
"""
import bpy, os, math, random

random.seed(20260705)   # 再現性
OUT = r'C:\tmp\ehon2\salon_diorama.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def emissive(name, rgb, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*rgb, 1.0)
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

PALETTE = [((1.0,0.85,0.55), 5.0), ((0.65,0.8,1.0), 5.0), ((1.0,0.6,0.7), 4.0), ((0.85,0.7,1.0), 4.0)]
mats = [emissive(f'star{i}', c, s) for i, (c, s) in enumerate(PALETTE)]

# 3本腕の渦巻銀河: 対数螺旋に沿って小球 420 個
ARMS, PER_ARM = 3, 140
for arm in range(ARMS):
    base = arm * 2 * math.pi / ARMS
    for i in range(PER_ARM):
        t = i / PER_ARM
        r = 0.35 + 4.3 * t
        th = base + t * 3.6 + random.uniform(-0.16, 0.16)
        x = r * math.cos(th) + random.uniform(-0.12, 0.12)
        y = r * math.sin(th) + random.uniform(-0.12, 0.12)
        z = 0.55 + random.uniform(-0.16, 0.16) * (1.2 - t)
        sz = random.uniform(0.028, 0.085) * (1.35 - 0.6 * t)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=sz, location=(x, y, z))
        o = bpy.context.object
        o.data.materials.append(random.choice(mats))
# 中心コア
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.34, location=(0, 0, 0.6))
bpy.context.object.data.materials.append(emissive('core', (1.0, 0.95, 0.8), 9.0))

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_apply=True, export_yup=True)
print('SALON_EHON2_DONE', os.path.getsize(OUT) / 1048576, 'MB')
```

- [ ] **Step 2: ビルド + three.js 側の見え方確認**

Run: `"<blender>" -b --factory-startup --python "C:/projects/yuichi916.github.io/_blender/ehon2_salon.py"`
発光は GLB では emissiveFactor になる。実機で確認し、光量不足なら bootWorldB に頁オプション `bloomLike` は**追加しない** (YAGNI)。代わりに emission strength を上げて再ビルド。

- [ ] **Step 3〜6: Task 10 の Step 3〜6 を salon で実施**

- story:
```js
story:{jp:'ページの上に、小さな銀河がうかんでいる。一万九千の歌い手たちの星。すきな星をひとつ選べば、そこから音楽の旅がはじまる。',
       en:'A little galaxy floats above the page — stars of nineteen thousand singers. Pick a star you like, and your music journey begins.'},
```
- 動物: toad (銀河のふち・コアの下の影等)。銀河は空中に浮くため spots の y は 0 付近 (本の上) に置き「銀河を見上げるカエル」の絵にする
- コミット: `feat(ehon): salon page — hand-built singing galaxy diorama with toad`

---

### Task 14: 残り 8 頁 (cabin / niwa / sudoku / shogi-puyo / stopwatch / toeic / world / hollow-tale)

各頁とも **Task 10 の 6 ステップ**を実施 (`ehon2_diorama.py -- <pageId>`、設定は Task 8 の ehon2_pages.json 初期値から吟味ゲートで調整)。頁固有の story と動物・吟味基準:

- [ ] **cabin** (ECI ストーブ・蝋燭・本の温かい一角 / wolfpup):
```js
story:{jp:'森の奥の小屋では、焚き火がいつでも君を待っている。360°の静けさに、からだをあずけてみよう。',
       en:'Deep in the forest, a fire is always waiting for you. Lean into the 360° stillness.'},
```
吟味: 「小屋の中の温かさ」が伝わる小物構成 (建物丸ごとではなく暖炉まわりのクローズアップ)。コミット: `feat(ehon): cabin page`

- [ ] **niwa** (ENC 茂み・鉢植え・木・ランタン+小さな家1軒 / hare):
```js
story:{jp:'浮かぶ島の庭に、季節の花がひらく。なにもしなくていい。ただ歩いて、風の音をきくだけの場所。',
       en:'On a floating island garden, seasonal flowers bloom. You need do nothing here — just walk and listen to the wind.'},
```
吟味: 緑と花が主役、建物は脇役1軒まで。コミット: `feat(ehon): niwa page`

- [ ] **sudoku** (DKF 大聖堂 focal+radius / binturong):
```js
story:{jp:'崩れかけた大聖堂に、古代のルーンが浮かんでいる。数字の代わりに刻まれた印を、そろえてみないか。',
       en:'Ancient runes float in a crumbling cathedral. Care to align the carved signs where numbers ought to be?'},
```
吟味: 塔と大聖堂のゴシック感。既存 darkfantasy 頁と構図が被らない azim にする。コミット: `feat(ehon): sudoku page`

- [ ] **shogi-puyo** (VAL 盾・武器・トーテム・的・井戸+小屋 / snowleopard):
```js
story:{jp:'北の広間では、駒たちが今日も腕くらべ。歩も銀も金も、四つそろえば大わざが出るぞ。',
       en:'In the northern hall, the pieces test their strength. Line up four — pawn, silver, or gold — and unleash a special move.'},
```
吟味: 「対局場・武芸場」の趣。盾と的が見える構図。コミット: `feat(ehon): shogi-puyo page`

- [ ] **stopwatch** (DKF Tower_A/B の塔 / penguin):
```js
story:{jp:'まちの時計塔は、今日も正確に時を刻む。1秒の千分の一まで、きみの時間を見守っている。',
       en:'The town clock tower keeps perfect time, watching over your seconds down to the millisecond.'},
```
吟味: 塔が縦に主役。頂部が切れないよう thumb_cam.elev を調整。コミット: `feat(ehon): stopwatch page`

- [ ] **toeic** (ECI IntPaladinsArmory / lioncub):
```js
story:{jp:'聖騎士の武具庫で、今日の試練が待っている。三十の問いに、勇気をもって挑もう。',
       en:'In the paladin armory, today\'s trials await. Face the thirty questions with courage.'},
```
吟味: 武具がずらりと並ぶ「試練の間」感。コミット: `feat(ehon): toeic page`

- [ ] **world** (ECI IntKingsHall の大テーブル+本 / dingo):
```js
story:{jp:'地図師の大広間には、浮遊島々の地図がひろげてある。次はどの島を訪ねよう。',
       en:'In the cartographer\'s hall lies a map of the floating isles. Which island shall we visit next?'},
```
吟味: KingsHall は 522 メッシュと大きい — `include_prefixes` をテーブル周辺 (`KB3D_ECI_IntKingsHall_Table` 系があるか台帳確認) に絞り ≤4MB に。コミット: `feat(ehon): world page`

- [ ] **hollow-tale** (VAL 薪・トーチ・ベンチ・岩 / 動物なし):
```js
story:{jp:'雪の夜、小屋の焚き火だけが起きていた。少年と少女と、灯守の秘密。——この火は、消えない。',
       en:'On a snowy night, only the cabin fire stayed awake. A boy, a girl, and the lamplighter\'s secret — this fire never dies.'},
```
吟味: 「夜の焚き火」の孤独と温かさ。小物少なめの引き算構図。コミット: `feat(ehon): hollow-tale page`

- [ ] **8頁完了後の一括確認**: 全17頁をめくり通し、コンソールエラー 0・全 diorama ≤4MB・動物10体配置・図鑑が全動物発見可能なことを確認

---

### Task 15: pCloud メディア配信統合 (サムネ・図鑑画像)

**Files:**
- Create (pCloud): `P:\Public Folder\ehon2-assets\` (目次サムネ 15 枚 + 図鑑用動物画像 11 枚)
- Modify: `C:\projects\yuichi916.github.io\ehon.html` (`getMediaUrl` を pCloud 実装に差替え)

**Interfaces:**
- Produces: `getMediaUrl(name)` が pCloud getpubthumb URL を返す。`EHON2_MEDIA_FILEIDS` 静的マップ
- Consumes: Task 8/10〜14 の `thumb_<page>.png`、動物サムネは `ehon2_animal.py` 実行時の GLB プレビュー (下記 Step 1 で生成)

- [ ] **Step 1: サムネ・図鑑画像を WebP 化して pCloud へ**

```powershell
New-Item -ItemType Directory -Force 'P:\Public Folder\ehon2-assets' | Out-Null
# 目次サムネ (Pillow で webp 変換)
python -c "
from PIL import Image; import glob, os
for p in glob.glob(r'C:\tmp\ehon2\thumb_*.png'):
    page = os.path.basename(p)[6:-4].replace('-','')
    Image.open(p).convert('RGB').save(rf'P:\Public Folder\ehon2-assets\toc_{page}_v1.webp', 'WEBP', quality=82)
"
```
図鑑画像 `zukan_<animalId>_v1.webp`: 各動物 GLB の Blender 静止画レンダ (ehon2_animal.py に `--thumb` は足さず、`ehon2_diorama.py` と同じ手法の小スクリプトをこの Step 内で 1 回書いて回す。出力 512×512 PNG→WebP→pCloud 同フォルダ)。

- [ ] **Step 2: fileid を採取して静的マップ化**

```bash
python -c "
import json, urllib.request
r = json.load(urllib.request.urlopen('https://api.pcloud.com/showpublink?code=kZqt6O5Z4gUlPEmDoLyJhwfgiE5ztFhhp9Fk'))
def walk(m):
    for c in m.get('contents', []):
        if c.get('isfolder'): walk(c)
        elif 'ehon2' in (c.get('parentfolderid_path') or '') or True: print(c['name'], c['fileid'])
walk(r['metadata'])" | grep -E "toc_|zukan_"
```
注: `ehon2-assets` が publink (`hitoritabi` フォルダ) の外にある場合は pCloud Web で `Public Folder` 直下を共有する publink を新規作成し、その code を使う (**Worker は作らない**)。
採取結果を ehon.html に:

```js
/* pCloud 静的メディアマップ (アップロード後に fileid を記入。ファイルはバージョン名で不変) */
const EHON2_MEDIA = {
  code: 'kZqt6O5Z4gUlPEmDoLyJhwfgiE5ztFhhp9Fk',   /* ehon2-assets を含む publink code */
  fileids: {
    'toc_hitoritabi_v1.webp': 0,   /* ←採取値に置換 ×26 ファイル */
  }
};
function getMediaUrl(filename) {
  const fid = EHON2_MEDIA.fileids[filename];
  if (!fid) return `${ASSET_BASE}/ehon/${filename}`;   /* ローカルフォールバック */
  return `https://apitok2.pcloud.com/getpubthumb?code=${EHON2_MEDIA.code}&fileid=${fid}&type=auto&crop=0&size=1024x1024`;
}
```

- [ ] **Step 3: 到達性検証**

```bash
curl -sI -o /dev/null -w "%{http_code}\n" "https://apitok2.pcloud.com/getpubthumb?code=<code>&fileid=<採取したfileid>&type=auto&crop=0&size=1024x1024"
```
Expected: `200`。全26ファイル分ループで確認。

- [ ] **Step 4: 実機確認 + コミット**

目次のサムネ・図鑑モーダルの動物画像が pCloud から表示される (DevTools Network で apitok2 ドメイン確認)。
```bash
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html && git commit -m "feat(ehon): serve toc/zukan media via pCloud getpubthumb (no worker)"
```

---

### Task 16: OGP / 構造化データ / 達成シェアカード

**Files:**
- Modify: `C:\projects\yuichi916.github.io\ehon.html` (head メタ + renderShareButton)
- Create: `C:\projects\yuichi916.github.io\assets\og\ehon-cover-1200x630.jpg`
- Modify: `C:\projects\yuichi916.github.io\sitemap.xml` (ehon.html の priority/lastmod 更新)

- [ ] **Step 1: OG 画像制作**

実機ブラウザで表紙 (本が閉じた状態) を 1200×630 でスクショ (`chrome --headless --screenshot --window-size=1200,630 "http://localhost:8000/ehon.html"` は book.glb 小 GLB なので描画可)。良い構図にならなければ Blender の book.glb シーンをレンダ。`assets/og/ehon-cover-1200x630.jpg` (q85, ≤300KB) に保存。

- [ ] **Step 2: head メタ整備**

ehon.html の `<head>` に (既存 og タグがあれば置換):

```html
<title>とびだす絵本の世界 — 12の世界へつづく本 | yuichi916.github.io</title>
<meta name="description" content="ページをめくると3Dの世界がとびだす絵本。森の小屋・心の庭・歌う銀河・出航の港…12の世界と11匹のいきもの図鑑。A pop-up picture book leading to 12 little worlds.">
<meta property="og:title" content="とびだす絵本の世界 | A Pop-up Book of Worlds">
<meta property="og:description" content="ページをめくると3Dの世界がとびだす。12の世界と、日替わりでかくれる11匹のいきもの。">
<meta property="og:type" content="website">
<meta property="og:url" content="https://yuichi916.github.io/ehon.html">
<meta property="og:image" content="https://yuichi916.github.io/assets/og/ehon-cover-1200x630.jpg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"CreativeWork","name":"とびだす絵本の世界 / A Pop-up Book of Worlds",
 "url":"https://yuichi916.github.io/ehon.html","inLanguage":["ja","en"],
 "author":{"@type":"Person","name":"yuichi916"},
 "description":"ページをめくると3Dの世界がとびだすWeb絵本。12の世界と11匹のいきもの図鑑。"}
</script>
```

- [ ] **Step 3: renderShareButton (達成シェアカード)**

```js
window.renderShareButton = function (el) {
  if (!el) return;
  const btn = document.createElement('button');
  btn.className = 'po-enter';
  btn.textContent = '🐾 ' + tt(I18N.ui.share);
  btn.addEventListener('click', async () => {
    /* canvas でカード生成 */
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630;
    const cx = cv.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 0, 630);
    g.addColorStop(0, '#2c2418'); g.addColorStop(1, '#584428');
    cx.fillStyle = g; cx.fillRect(0, 0, 1200, 630);
    cx.fillStyle = '#ffe9b8'; cx.font = 'bold 64px serif'; cx.textAlign = 'center';
    cx.fillText((ehonLang() === 'jp') ? '🐾 いきもの図鑑 コンプリート！' : '🐾 Creature Book Complete!', 600, 200);
    cx.font = '38px serif';
    cx.fillText((ehonLang() === 'jp') ? '11匹ぜんぶ みつけた' : 'All 11 creatures found', 600, 290);
    cx.font = '30px monospace'; cx.fillStyle = '#d9c08a';
    cx.fillText('yuichi916.github.io/ehon.html', 600, 560);
    const shareText = (ehonLang() === 'jp')
      ? 'とびだす絵本の「いきもの図鑑」をコンプリートした！🐾📖'
      : 'I completed the Creature Book in this pop-up world book! 🐾📖';
    const url = 'https://yuichi916.github.io/ehon.html';
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = blob ? new File([blob], 'ehon-zukan.png', { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ text: shareText, url, files: [file] }); return; } catch (e) {}
    }
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(url), '_blank');
  });
  el.appendChild(btn);
};
```

- [ ] **Step 4: sitemap 更新 + 検証 + コミット**

sitemap.xml の ehon.html エントリの `<lastmod>` を当日に、`<priority>` を 0.9 に。
検証: `https://cards-dev.twitter.com/validator` 相当は手動 — 実機で `document.querySelector('meta[property="og:image"]').content` を確認し、curl で og 画像 200。シェアボタンはモーダルコンプ状態で表示 (localStorage を手で埋めて確認: `localStorage.ehon_zukan='{"found":{"wolfpup":"x","hare":"x","warthog":"x","penguin":"x","binturong":"x","snowleopard":"x","polecat":"x","lioncub":"x","toad":"x","turtle":"x","dingo":"x"}}'`)。
```bash
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io" && git add ehon.html assets/og/ sitemap.xml && git commit -m "feat(ehon): OGP, structured data, and zukan share card"
```

---

### Task 17: index.html の入り口切替

**Files:**
- Modify: `C:\projects\yuichi916.github.io\index.html` (Hero 主CTA + 絵本セクション)

**不変条件:** 訪問者カウント (#visitorCount/GoatCounter)・`?nofx=1`・既存 i18n 機構・「世界の地図」グリッド・journal.html リンクは**触らない**。

- [ ] **Step 1: Hero 主CTA を差し替え**

index.html の Hero 主CTA (現: cabin.html) を:

```html
<a class="(既存CTAと同じclass)" href="ehon.html">📖 本をひらく — 12の世界へ</a>
```
副CTA は既存のまま (niwa)。既存 class 名は index.html の該当箇所を読んで一致させる。

- [ ] **Step 2: 絵本紹介セクションを Hero 直下に追加**

```html
<section class="wm-ehon-intro reveal">
  <h2>ページをめくると、世界がとびだす</h2>
  <p>この家のすべてのコンテンツは、一冊の絵本につながりました。ページの上にせり上がる12の3D世界。日替わりでかくれる11匹のいきもの。ぜんぶ見つけられるかな。</p>
  <a href="ehon.html">絵本をひらく →</a>
</section>
```
スタイルは index.html 既存の `.reveal` セクションの流儀 (クラス命名・余白) に合わせる。

- [ ] **Step 3: 確認 + コミット**

実機: index → CTA → ehon が自然に流れる / 既存グリッド・カウンタ健在。
```bash
cd "C:/projects/yuichi916.github.io" && git add index.html && git commit -m "feat(index): make ehon picture book the primary gateway CTA"
```

---

### Task 18: 最終検証 + デプロイ + 本番確認

- [ ] **Step 1: 全数チェック**

```bash
node "C:/projects/yuichi916.github.io/tests/ehon2_core_test.mjs"
python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/ehon.html"
cd "C:/projects/yuichi916.github.io"
git ls-files -z _ehon_assets | xargs -0 stat -c "%s %n" | sort -rn | head -30   # GLB 予算再確認
```
Expected: テスト PASS / dup 0 / diorama ≤4MB ×12・animal ≤1MB ×11

- [ ] **Step 2: 実機総合走査**

チェックリスト: 表紙→17頁めくり通し (コンソールエラー0) / JP・EN 切替で全頁 / 図鑑 11 匹コンプ→👑+シェアカード / クエスト3世界互換 (旧 `ehon_quest` データが生きる) / モバイル幅 (DevTools 390px) でオーバーレイ・目次・図鑑が崩れない / `?lang=en&nofx=1` 等パラメータ併用。

- [ ] **Step 3: デプロイ**

```bash
cd "C:/projects/yuichi916.github.io" && git push origin main
```
2〜3 分後:

```bash
curl -sI -o /dev/null -w "%{http_code}\n" https://yuichi916.github.io/ehon.html
curl -sI -o /dev/null -w "%{http_code}\n" https://yuichi916.github.io/_ehon_assets/ehon/hitoritabi_diorama.glb
curl -sI -o /dev/null -w "%{http_code}\n" https://yuichi916.github.io/assets/og/ehon-cover-1200x630.jpg
```
Expected: すべて 200

- [ ] **Step 4: 本番実機確認 + 記録**

本番 URL で Step 2 の要点を再確認 (特に pCloud サムネと GLB の混在ロード)。完了したらメモリ `ehon-popup-book.md` に「17頁ゲートウェイ化 (2026-07-XX)・PAGES 構造・図鑑・pCloud getpubthumb 方式」を追記。

---

## Self-Review (実施済み)

1. **Spec coverage:** §3 構成=Task 2/4/5、§4 マッピング=Task 8/10-14、§5 図鑑=Task 1/6/7/9、§6 i18n=Task 3、§7 宣伝=Task 5/16、§8 index=Task 17、§9 アーキ=Task 2/7、§10 パイプライン=Task 8、§11 予算=Task 8-9 の assert、§11.5 配信=Task 15、§12 フォールバック=Task 7、§13 検証=各タスク+Task 18、§14 Phase=Task 順序、§15 不変条件=Task 2 Step 3・Task 17 不変条件節。
2. **Placeholder scan:** fileid の `0` プレースホルダは Task 15 Step 2 で採取値に置換する明示手順あり。story は全12頁分を本文に記載済み。
3. **Type consistency:** `EHON2.dailySpotIndex/zukanAdd/zukanIsComplete` (Task 1) を Task 6/7 が同名で使用。`switchPage`/`currentPageIdx` (Task 2) を Task 3/4/7 が使用。`getMediaUrl` (Task 4 暫定→Task 15 本実装) 一貫。`ZukanEngine.onAnimalClick/openModal/renderSummary` (Task 6) を Task 4/5/7 が使用。`renderShareButton` (Task 16) を Task 6 が feature-detect 呼び出し。
