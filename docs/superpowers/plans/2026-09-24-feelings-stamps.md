# 気持ちスタンプ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 作品の終わりとページ末尾に「気持ちスタンプ」のはがきを置き、トップに「みんなの気持ち」を足して、訪問者の気持ちを数で見せる（作者の運用作業はゼロ）。

**Architecture:** 純関数の `assets/feel/feel-core.js` と、DOM を持つ `assets/feel/feel.js`（ES module、Shadow DOM）の 2 ファイル。スタンプは既存の GoatCounter のイベントとして送り、数は公開カウンタから読む。自由記述の「ひとこと」は作成済みの Google フォームへ `no-cors` で POST する。各ページには `<div data-feel=…>` と読み込み 1 行を置くだけ。

**Tech Stack:** 素の HTML / ES modules（ビルドなし・依存追加なし）、GoatCounter 公開カウンタ、Google フォーム、テストは Node（`node:*` のみ）と Python Playwright。

**Spec:** `docs/superpowers/specs/2026-09-23-feelings-stamps-design.md`

## Global Constraints

- 実装は worktree `C:\tmp\wt-feelings`（ブランチ `feat/feelings-stamps`）で行う。別のセッションが `main` に並行してコミットしているため、`C:\projects\yuichi916.github.io` の作業ツリーは Task 7 の最後まで触らない
- 依存の追加・ビルド工程は作らない。ページからの読み込みはルート相対で `<script type="module" src="/assets/feel/feel.js"></script>` の 1 行
- GoatCounter のパス: スタンプ `feel/<work>/<key>`、ひとこと `feel/<work>/note`、ボード `feel/board/open/<work>`。イベントは `goatcounter.count({ path, title, event: true })`
- 公開カウンタ: `https://viewsengineer.goatcounter.com/counter/<encodeURIComponent(path)>.json`（値は `"2 035"` 形式の文字列）
- フォーム送信先: `https://docs.google.com/forms/d/e/1FAIpQLSfu4FAXL_Qyu_BBhgGgyIfn2KH4gPGAnQSueTNop6v2H8RjJA/formResponse`、entry は 作品 `entry.796994745` ／ ページ `entry.20892979` ／ ひとこと `entry.274902902`
- ひとこと: 500 字まで、欄を開いて 3 秒未満の送信は送らない、隠し入力欄が埋まっていたらボットとして扱う
- 保存: 押した状態と下書きは localStorage `feel.v1`、数のキャッシュは sessionStorage `feel.cache.v1`（10 分）
- はがきは Shadow DOM（`:host{all:initial}`）でページの CSS から切り離す。ボードは index の CSS 変数（`--ink` など）を継承して馴染ませる
- 置かないページ: cabin.html, niwa.html, hitori.html, stopwatch.html, koe.html, journal.html, kototsugi/game/, hitoritabi/journey-*.html
- index に足す文言は日本語固定（`data-i18n` を付けない）
- 既存ファイルの作業ツリーは CRLF。スクリプトで書き換えるときは改行コードを保つ
- 変更は要求に直結する行だけ。隣のコードの整形や「ついでの改善」はしない
- コミットは既存の履歴に合わせた Conventional Commits（日本語の要約）。本文の最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Python は `PYTHONUTF8=1` を付けて実行する

## Review Focus

- ページ側の CSS がはがきのボタンに漏れる（例: hyaku の `#ending button{letter-spacing:.2em;padding:10px 34px}`）→ どのページでも同じ見た目のはがきが出るべき。Task 2 の `page_css_does_not_leak`（試験台の暗い節に同じ規則を置く）と、Task 3〜6 の `feel_pages_test.py`（全置き場所で字間と文字サイズを測る）で押さえる
- 最初は隠れている場所（hyaku の読了画面、sudoku・shogi-puyo の結果、ehon の奥付）→ 表に出たときに描かれるべき。Task 2 の `hidden_then_shown` と、各ページの検査の REVEAL で押さえる
- 読み終える前に言語を切り替えた（hyaku `?lang=en`）→ はがきも英語で出るべき。Task 4 で `hyaku-en` を検査する
- ストレージが使えない（プライベートモード・保存禁止の設定）→ 例外なく描かれ、押せて、同じページ内で二重に押せないべき。Task 2 の `storage_blocked`
- 数の取得が失敗する（遮断・500・JSON でない）→ 数を出さずに押せ、ページにエラーを出さないべき。Task 2 の `counter_unreachable`

---

## File Structure

| ファイル | 役割 |
|---|---|
| `assets/feel/feel-core.js`（新規） | 純関数と定数。スタンプの定義、パスと URL、カウンタ値の読み取り、言語、文言、ひとことの検査、キャッシュと押下状態の更新、ボードの並べ替え |
| `assets/feel/feel.js`（新規） | DOM と通信。はがき（通常版・小型版）、ボード、GoatCounter への送信、数の取得、フォーム送信。`window.Feel = { mount, scan }` |
| `tests/feel_core_test.mjs`（新規） | feel-core の Node テスト |
| `tests/feel_harness.html`（新規） | 部品だけを置いた試験台（テストが使う。noindex） |
| `tests/feel_widget_test.py`（新規） | 試験台で部品の動作を検査する Playwright テスト（通信はすべて横取り） |
| `tests/feel_placement_test.mjs`（新規） | 各ページに置き場所・読み込み・計測タグがそろっているかの静的検査 |
| `tests/feel_pages_test.py`（新規） | 各ページで、はがきが描かれ、はみ出さず、CSS が漏れていないかを撮って確かめる |
| `scripts/feel_place.py`（新規） | footer の直前にはがきを差し込む。道具・学びのページと研究ノート用。何度実行してもよい |
| `index.html` | № 05「みんなの気持ち」の節、ナビ、節番号の繰り下げ |
| `hyaku.html` `seikai.html` `kototsugi/index.html` | 物語の終わりのはがき（hyaku は読了画面のスクロール修正、kototsugi は計測タグの追加も） |
| `sudoku.html` `shogi-puyo.html` `ehon.html` | 結果画面と奥付の小型版 |
| `ai-map.html` `salon.html` `ai-english.html` `toeic.html` `novel-bench.html` `hitoritabi/index.html` `method/*.html` `method/en/*.html` | `scripts/feel_place.py` で末尾に差し込む |

---

### Task 0: worktree を作る

**Files:** なし（git の操作のみ）

- [ ] **Step 1: worktree とブランチを作る**

```bash
git -C C:/projects/yuichi916.github.io worktree add C:/tmp/wt-feelings -b feat/feelings-stamps main
```
Expected: `Preparing worktree (new branch 'feat/feelings-stamps')`。以降のコマンドはすべて `C:\tmp\wt-feelings` で実行する。

- [ ] **Step 2: 設計書と計画が入っていることを確かめる**

```bash
cd C:/tmp/wt-feelings && ls docs/superpowers/specs/2026-09-23-feelings-stamps-design.md docs/superpowers/plans/2026-09-24-feelings-stamps.md
```
Expected: 2 行とも表示される。

---

### Task 1: 純関数 `feel-core.js`

**Files:**
- Create: `assets/feel/feel-core.js`
- Test: `tests/feel_core_test.mjs`

**Interfaces:**
- Produces（以降のタスクが使う名前。すべて named export）:
  - 定数 `COUNTER_BASE`, `FORM_URL`, `FORM_ENTRIES`, `NOTE_MAX`(500), `NOTE_MIN_MS`(3000), `CACHE_TTL_MS`(600000)
  - 定数 `SETS: {story|game|ehon|note|tool|site: Array<{key, emoji, ja, en}>}`, `HEADINGS: {set: {ja, en}}`, `TEXT: {ja: {...}, en: {...}}`, `WORKS: {work: {title, url}}`, `BOARD: Array<{id, label, key, emoji, stamp, works}>`, `CLEAR_PATHS: {work: path}`
  - `isWorkId(work) → boolean` / `stampsFor(set) → Array|null` / `counterPath(work, key) → string` / `counterUrl(path) → string`
  - `parseCount(json) → number|null` / `pickLang(hint, navLang) → 'ja'|'en'` / `countLabel(lang, n) → string` / `countMessage(lang, n) → string`
  - `validateNote(text, elapsedMs, honeypot) → {ok:true, text} | {ok:false, reason:'bot'|'empty'|'tooLong'|'tooFast'}`
  - `formBody(work, page, text) → Array<[entry, value]>` / `workTitle(work, docTitle) → string` / `sortRows(rows) → rows`
  - `readCache(store, path, now, ttl?) → number|null` / `writeCache(store, path, n, now) → store`
  - `isPressed(state, path) → boolean` / `markPressed(state, path, day) → state` / `getDraft(state, work) → string` / `setDraft(state, work, text) → state`

- [ ] **Step 1: 失敗するテストを書く**

`tests/feel_core_test.mjs`:

```js
// 気持ちスタンプの純関数テスト。DOM も fetch も使わない。実行: node tests/feel_core_test.mjs
import * as F from '../assets/feel/feel-core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function deq(a, b, msg) { eq(JSON.stringify(a), JSON.stringify(b), msg); }

check('SETS: 各組は 3〜4 個・キー重複なし・文言がそろう', () => {
  for (const [name, stamps] of Object.entries(F.SETS)) {
    if (stamps.length < 3 || stamps.length > 4) throw new Error(`${name}: ${stamps.length} 個`);
    eq(new Set(stamps.map((s) => s.key)).size, stamps.length, `${name} のキー重複`);
    for (const s of stamps) {
      if (!/^[a-z]+$/.test(s.key) || !s.emoji || !s.ja || !s.en) throw new Error(`${name}/${s.key} が欠けている`);
    }
    if (!F.HEADINGS[name] || !F.HEADINGS[name].ja || !F.HEADINGS[name].en) throw new Error(`${name} の見出しが無い`);
  }
});

check('TEXT: 日本語と英語でキーがそろう', () => {
  deq(Object.keys(F.TEXT.ja).sort(), Object.keys(F.TEXT.en).sort());
});

check('BOARD: 作品は WORKS にあり、キーはどこかの組にある', () => {
  const keys = new Set(Object.values(F.SETS).flat().map((s) => s.key));
  for (const g of F.BOARD) {
    if (!keys.has(g.key)) throw new Error(`${g.id}: ${g.key}`);
    for (const w of g.works) if (!F.WORKS[w]) throw new Error(`${g.id}: ${w} が WORKS に無い`);
  }
  for (const w of Object.keys(F.CLEAR_PATHS)) if (!F.WORKS[w]) throw new Error(`CLEAR_PATHS: ${w}`);
});

check('isWorkId', () => {
  for (const ok of ['hyaku', 'shogi-puyo', 'site', 'method/kansoku-suru-monogatari',
    'method/en/stories-that-watch-you', 'harness-story']) eq(F.isWorkId(ok), true, ok);
  for (const ng of ['', 'Hyaku', '../x', 'a//b', 'a/', '/a', '_test', 'a b', null, 'x'.repeat(81)]) {
    eq(F.isWorkId(ng), false, String(ng));
  }
});

check('stampsFor: 無い組と Object のプロパティ名は null', () => {
  eq(F.stampsFor('story').length, 4);
  eq(F.stampsFor('nope'), null);
  eq(F.stampsFor('constructor'), null);
});

check('counterPath / counterUrl', () => {
  eq(F.counterPath('hyaku', 'naita'), 'feel/hyaku/naita');
  eq(F.counterUrl('feel/hyaku/naita'),
    'https://viewsengineer.goatcounter.com/counter/feel%2Fhyaku%2Fnaita.json');
  eq(F.counterUrl('feel/method/en/stories-that-watch-you/motto'),
    'https://viewsengineer.goatcounter.com/counter/feel%2Fmethod%2Fen%2Fstories-that-watch-you%2Fmotto.json');
});

check('parseCount: 区切り文字・ゼロ・壊れた値', () => {
  eq(F.parseCount({ count: '2 035' }), 2035);
  eq(F.parseCount({ count: '2\u202f035' }), 2035);
  eq(F.parseCount({ count: '0' }), 0);
  eq(F.parseCount({ count: 7 }), 7);
  eq(F.parseCount({ count: '' }), null);
  eq(F.parseCount({ count: 'abc' }), null);
  eq(F.parseCount({}), null);
  eq(F.parseCount(null), null);
  eq(F.parseCount('12'), null);
});

check('pickLang', () => {
  eq(F.pickLang('ja', 'en-US'), 'ja');
  eq(F.pickLang('', 'ja-JP'), 'ja');
  eq(F.pickLang('en', 'ja'), 'en');
  eq(F.pickLang('jp', ''), 'ja');
  eq(F.pickLang('zh-CN', 'ja'), 'en');
  eq(F.pickLang('', ''), 'en');
});

check('countLabel', () => {
  eq(F.countLabel('ja', null), '');
  eq(F.countLabel('ja', 0), 'まだ誰も');
  eq(F.countLabel('ja', 12), '12人');
  eq(F.countLabel('en', 0), 'be the first');
  eq(F.countLabel('en', 12), '12');
});

check('countMessage', () => {
  eq(F.countMessage('ja', 1), '最初のひとりになりました。');
  eq(F.countMessage('ja', 13), 'あなたと同じ気持ちの人が 13 人います。');
  eq(F.countMessage('ja', null), 'ありがとう。');
  eq(F.countMessage('en', 1), "You're the first.");
  eq(F.countMessage('en', 13), '13 people felt the same.');
  eq(F.countMessage('en', null), 'Thank you.');
});

check('validateNote', () => {
  deq(F.validateNote('x', 9000, 'http://spam'), { ok: false, reason: 'bot' });
  deq(F.validateNote('', 5000, ''), { ok: false, reason: 'empty' });
  deq(F.validateNote('   ', 5000, ''), { ok: false, reason: 'empty' });
  deq(F.validateNote('あ'.repeat(501), 5000, ''), { ok: false, reason: 'tooLong' });
  deq(F.validateNote('こんにちは', 2999, ''), { ok: false, reason: 'tooFast' });
  deq(F.validateNote('こんにちは', 3000, ''), { ok: true, text: 'こんにちは' });
  deq(F.validateNote(' 前後の空白 ', 4000, ''), { ok: true, text: '前後の空白' });
  deq(F.validateNote('あ'.repeat(500), 4000, ''), { ok: true, text: 'あ'.repeat(500) });
});

check('formBody と送信先: 設計書の entry に対応させる', () => {
  deq(F.formBody('hyaku', '/hyaku.html', '本文'), [
    ['entry.796994745', 'hyaku'], ['entry.20892979', '/hyaku.html'], ['entry.274902902', '本文'],
  ]);
  eq(F.FORM_URL,
    'https://docs.google.com/forms/d/e/1FAIpQLSfu4FAXL_Qyu_BBhgGgyIfn2KH4gPGAnQSueTNop6v2H8RjJA/formResponse');
});

check('workTitle', () => {
  eq(F.workTitle('hyaku', 'なんでも'), '百の悪行');
  eq(F.workTitle('method/kansoku-suru-monogatari',
    '観測する物語 — 物語に「あなたを覚えている」を実装できるようになった｜新しい形の研究'), '観測する物語');
  eq(F.workTitle('method/en/stories-that-watch-you',
    'Stories That Watch You — Flags Made of Words | New Forms Research'), 'Stories That Watch You');
  eq(F.workTitle('harness-x', ''), 'harness-x');
  eq(F.workTitle('constructor', ''), 'constructor');
});

check('sortRows: 多い順・null は最後・同数は設定順・元を並べ替えない', () => {
  const rows = [
    { work: 'a', count: 3, order: 0 }, { work: 'b', count: 5, order: 1 }, { work: 'c', count: 0, order: 2 },
    { work: 'd', count: null, order: 3 }, { work: 'e', count: 5, order: 4 },
  ];
  deq(F.sortRows(rows).map((r) => r.work), ['b', 'e', 'a', 'c', 'd']);
  eq(rows[0].work, 'a');
});

check('readCache / writeCache: 10 分で切れる・元を書き換えない', () => {
  const empty = {};
  const s = F.writeCache(empty, 'feel/hyaku/naita', 12, 1000);
  deq(empty, {});
  eq(F.readCache(s, 'feel/hyaku/naita', 1000 + F.CACHE_TTL_MS - 1), 12);
  eq(F.readCache(s, 'feel/hyaku/naita', 1000 + F.CACHE_TTL_MS + 1), null);
  eq(F.readCache(s, 'feel/other', 1000), null);
  eq(F.readCache({ p: { n: 'x', t: 0 } }, 'p', 1), null);
  eq(F.readCache(null, 'p', 1), null);
});

check('isPressed / markPressed', () => {
  const s0 = {};
  const s1 = F.markPressed(s0, 'feel/hyaku/naita', '2026-09-24');
  eq(F.isPressed(s1, 'feel/hyaku/naita'), true);
  eq(F.isPressed(s1, 'feel/hyaku/tsuzuki'), false);
  eq(F.isPressed(s0, 'feel/hyaku/naita'), false, '元を書き換えない');
  eq(F.isPressed(F.markPressed(null, 'p', 'd'), 'p'), true);
  eq(F.isPressed(null, 'p'), false);
});

check('getDraft / setDraft', () => {
  const s1 = F.setDraft({}, 'hyaku', '下書き');
  eq(F.getDraft(s1, 'hyaku'), '下書き');
  eq(F.getDraft(s1, 'seikai'), '');
  const s2 = F.setDraft(s1, 'hyaku', '');
  eq(F.getDraft(s2, 'hyaku'), '');
  eq('hyaku' in s2.drafts, false, '空にしたら消す');
  eq(F.getDraft(s1, 'hyaku'), '下書き', '元を書き換えない');
  eq(F.getDraft(null, 'hyaku'), '');
});

if (failures) { console.error(`feel_core_test: ${failures} FAILED`); process.exit(1); }
console.log('feel_core_test: ALL PASS');
```

- [ ] **Step 2: 失敗を確かめる**

Run: `node tests/feel_core_test.mjs`
Expected: `Cannot find module` を含むエラーで終了（`feel-core.js` がまだ無い）。

- [ ] **Step 3: 実装を書く**

`assets/feel/feel-core.js`:

```js
// 気持ちスタンプの純関数。DOM・fetch・storage に触らない。
// ブラウザでは assets/feel/feel.js が import し、テストは tests/feel_core_test.mjs が import する。
// 設計書: docs/superpowers/specs/2026-09-23-feelings-stamps-design.md

export const COUNTER_BASE = 'https://viewsengineer.goatcounter.com/counter/';
export const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfu4FAXL_Qyu_BBhgGgyIfn2KH4gPGAnQSueTNop6v2H8RjJA/formResponse';
export const FORM_ENTRIES = { work: 'entry.796994745', page: 'entry.20892979', text: 'entry.274902902' };
export const NOTE_MAX = 500;
export const NOTE_MIN_MS = 3000;
export const CACHE_TTL_MS = 10 * 60 * 1000;

// key は GoatCounter のパスに入る。変えると、それまでの数がゼロに戻る
export const SETS = {
  story: [
    { key: 'naita', emoji: '😭', ja: '泣いた', en: 'It made me cry' },
    { key: 'mouichido', emoji: '🔁', ja: 'もう一度読みたい', en: 'Want to read again' },
    { key: 'susume', emoji: '📣', ja: '誰かに勧めたい', en: 'Would recommend' },
    { key: 'tsuzuki', emoji: '✍️', ja: '続きが読みたい', en: 'Want a sequel' },
  ],
  game: [
    { key: 'tanoshii', emoji: '🎉', ja: '楽しかった', en: 'Fun' },
    { key: 'tegowai', emoji: '🧠', ja: '手ごわかった', en: 'Tough one' },
    { key: 'mata', emoji: '🔁', ja: 'またやる', en: 'Will play again' },
  ],
  ehon: [
    { key: 'tanoshii', emoji: '🎉', ja: '楽しかった', en: 'Fun' },
    { key: 'kirei', emoji: '✨', ja: 'きれいだった', en: 'Beautiful' },
    { key: 'mata', emoji: '🔁', ja: 'また開く', en: 'Will open again' },
  ],
  note: [
    { key: 'yakudatta', emoji: '💡', ja: '役に立った', en: 'Useful' },
    { key: 'tameshite', emoji: '🛠', ja: '試してみる', en: "I'll try it" },
    { key: 'motto', emoji: '❓', ja: 'もっと知りたい', en: 'Want to know more' },
  ],
  tool: [
    { key: 'yakudatta', emoji: '💡', ja: '役に立った', en: 'Useful' },
    { key: 'omoshiroi', emoji: '✨', ja: '面白かった', en: 'Interesting' },
    { key: 'mata', emoji: '🔁', ja: 'また来る', en: 'Will come back' },
  ],
  site: [
    { key: 'clap', emoji: '👏', ja: '拍手', en: 'Applause' },
    { key: 'mata', emoji: '🔁', ja: 'また来る', en: 'Will come back' },
    { key: 'susume', emoji: '📣', ja: '誰かに勧めたい', en: 'Would recommend' },
  ],
};

export const HEADINGS = {
  story: { ja: 'この物語に、気持ちを置いていく', en: 'Leave a feeling for this story' },
  game: { ja: '遊んでみて、どうでした？', en: 'How was it?' },
  ehon: { ja: 'この絵本、どうでした？', en: 'How was this book?' },
  note: { ja: 'このノート、どうでした？', en: 'How was this note?' },
  tool: { ja: 'ここまで見て、どうでした？', en: 'How was it?' },
  site: { ja: 'このサイトに、ひとこと', en: 'A word for this site' },
};

export const TEXT = {
  ja: {
    sub: '押すと、同じ気持ちの人の数が見えます',
    already: 'もう届いています。ありがとう。',
    thanks: 'ありがとう。',
    noteToggle: '🔒 作者にひとこと（非公開）',
    noteLabel: '作者へのひとこと',
    noteHint: '作者だけが読みます。返事はしていません。個人情報は書かないでください。',
    notePlaceholder: 'たとえば、いちばん残った場面',
    send: '届ける',
    sending: '送っています…',
    sent: '届きました。ありがとう。',
    failed: '送れませんでした。もう一度どうぞ。',
    empty: 'ひとことを書いてから届けてください。',
    tooLong: '500字までにしてください。',
    tooFast: 'もう一度「届ける」を押してください。',
  },
  en: {
    sub: 'Tap to see how many felt the same',
    already: 'Already sent. Thank you.',
    thanks: 'Thank you.',
    noteToggle: '🔒 A private note to the author',
    noteLabel: 'Note to the author',
    noteHint: "Only the author reads this. No replies. Please don't include personal information.",
    notePlaceholder: 'The scene that stayed with you',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Sent. Thank you.',
    failed: "Couldn't send. Please try again.",
    empty: 'Write something first.',
    tooLong: 'Please keep it under 500 characters.',
    tooFast: 'Please press Send once more.',
  },
};

export const WORKS = {
  hyaku: { title: '百の悪行', url: 'hyaku.html' },
  seikai: { title: '正解の外側', url: 'seikai.html' },
  kototsugi: { title: 'ことつぎの星', url: 'kototsugi/' },
  ehon: { title: '飛び出す絵本', url: 'ehon.html' },
  sudoku: { title: '異世界立体数独', url: 'sudoku.html' },
  'shogi-puyo': { title: '将棋ぷよ「成」', url: 'shogi-puyo.html' },
  'ai-map': { title: 'AIエージェント能力アトラス', url: 'ai-map.html' },
  salon: { title: '音楽の宇宙', url: 'salon.html' },
  'ai-english': { title: 'AI英語ラボ', url: 'ai-english.html' },
  toeic: { title: 'TOEIC Part 5 英文法30問', url: 'toeic.html' },
  'novel-bench': { title: '書き出し診断', url: 'novel-bench.html' },
  hitoritabi: { title: '一人旅フォトジャーナル', url: 'hitoritabi/' },
  site: { title: 'ひとりぶんの棚', url: './' },
};

// トップの「みんなの気持ち」。研究ノートは 16 本に分かれて問い合わせが増えるので載せない
export const BOARD = [
  { id: 'cry', label: '泣きたい', key: 'naita', emoji: '😭', stamp: '泣いた', works: ['hyaku', 'seikai', 'kototsugi'] },
  { id: 'fun', label: '遊びたい', key: 'tanoshii', emoji: '🎉', stamp: '楽しかった', works: ['shogi-puyo', 'sudoku', 'ehon'] },
  { id: 'learn', label: '学びたい', key: 'yakudatta', emoji: '💡', stamp: '役に立った',
    works: ['ai-map', 'ai-english', 'toeic', 'novel-bench'] },
];

// 既存の読了イベント（hyaku.html / seikai.html が送っている）
export const CLEAR_PATHS = { hyaku: 'game/hyaku/clear', seikai: 'game/seikai/clear' };

const WORK_ID = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

export function isWorkId(work) {
  return typeof work === 'string' && work.length <= 80 && WORK_ID.test(work);
}

export function stampsFor(set) {
  return own(SETS, set) ? SETS[set] : null;
}

export function counterPath(work, key) {
  return `feel/${work}/${key}`;
}

export function counterUrl(path) {
  return COUNTER_BASE + encodeURIComponent(path) + '.json';
}

// 公開カウンタは {"count":"2 035"} のように区切り文字入りの文字列を返す
export function parseCount(json) {
  if (!json || typeof json !== 'object' || json.count == null) return null;
  const digits = String(json.count).replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

// 優先順は data-feel-lang → <html lang> → navigator.language。日本語以外は英語にする
export function pickLang(hint, navLang) {
  const l = String(hint || navLang || '').toLowerCase();
  return l === 'jp' || l.startsWith('ja') ? 'ja' : 'en';
}

export function countLabel(lang, n) {
  if (n == null) return '';
  if (n === 0) return lang === 'ja' ? 'まだ誰も' : 'be the first';
  return lang === 'ja' ? `${n}人` : String(n);
}

export function countMessage(lang, n) {
  if (n == null) return TEXT[lang].thanks;
  if (n <= 1) return lang === 'ja' ? '最初のひとりになりました。' : "You're the first.";
  return lang === 'ja' ? `あなたと同じ気持ちの人が ${n} 人います。` : `${n} people felt the same.`;
}

export function validateNote(text, elapsedMs, honeypot) {
  if (honeypot) return { ok: false, reason: 'bot' };
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > NOTE_MAX) return { ok: false, reason: 'tooLong' };
  if (elapsedMs < NOTE_MIN_MS) return { ok: false, reason: 'tooFast' };
  return { ok: true, text: t };
}

export function formBody(work, page, text) {
  return [[FORM_ENTRIES.work, work], [FORM_ENTRIES.page, page], [FORM_ENTRIES.text, text]];
}

// WORKS に無いもの（研究ノート）は、ページの <title> の先頭を使う
export function workTitle(work, docTitle) {
  if (own(WORKS, work)) return WORKS[work].title;
  const t = String(docTitle || '').split(/\s*[｜|—]\s*/)[0].trim();
  return t || work;
}

// 多い順。数が読めなかった行（null）は最後。同数は設定の順
export function sortRows(rows) {
  const v = (r) => (r.count == null ? -1 : r.count);
  return rows.slice().sort((a, b) => v(b) - v(a) || a.order - b.order);
}

export function readCache(store, path, now, ttl = CACHE_TTL_MS) {
  const hit = store && own(store, path) ? store[path] : null;
  if (!hit || typeof hit.n !== 'number' || now - hit.t > ttl) return null;
  return hit.n;
}

export function writeCache(store, path, n, now) {
  return Object.assign({}, store, { [path]: { n, t: now } });
}

export function isPressed(state, path) {
  return !!(state && state.pressed && own(state.pressed, path));
}

export function markPressed(state, path, day) {
  const pressed = Object.assign({}, state && state.pressed, { [path]: day });
  return Object.assign({}, state, { pressed });
}

export function getDraft(state, work) {
  return (state && state.drafts && own(state.drafts, work) && state.drafts[work]) || '';
}

export function setDraft(state, work, text) {
  const drafts = Object.assign({}, state && state.drafts);
  if (text) drafts[work] = text;
  else delete drafts[work];
  return Object.assign({}, state, { drafts });
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `node tests/feel_core_test.mjs`
Expected: `feel_core_test: ALL PASS`

- [ ] **Step 5: コミット**

```bash
git add assets/feel/feel-core.js tests/feel_core_test.mjs
git commit -m "feat(feel): 気持ちスタンプの純関数を追加" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: はがき部品 `feel.js` と試験台

**Files:**
- Create: `assets/feel/feel.js`
- Create: `tests/feel_harness.html`
- Test: `tests/feel_widget_test.py`

**Interfaces:**
- Consumes: Task 1 の `feel-core.js` の export すべて
- Produces:
  - 置き場所の書式 `<div data-feel="<work>" data-feel-set="<set>" [data-feel-mode="compact"] [data-feel-lang="ja|en"] [data-feel-title="…"]></div>`
  - ボードの書式 `<div data-feel-board></div>`
  - `window.Feel.mount(el, opts?)`（opts は `{work, set, mode, lang, title}`、省略時は data 属性）と `window.Feel.scan(root?)`
  - Shadow DOM 内のクラス名（テストが使う）: はがき `.card` `.title` `.sub` `.stamp[data-key]` `.label` `.n` `.msg` `.note-toggle` `textarea` `.send` `.note-msg`、ボード `.chip[data-id]` `.row` `.name` `.extra` `.n`

- [ ] **Step 1: 試験台を作る**

`tests/feel_harness.html`（暗い節には hyaku と同じ種類の「ボタン全体に効く CSS」を置き、漏れを検査できるようにする）:

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>気持ちスタンプ試験台</title>
<style>
  body{margin:0;font-family:sans-serif}
  section{padding:24px 0}
  .light{background:#f4f0e6;color:#161510}
  .dark{background:#05050a;color:#e8e2d0;letter-spacing:.3em;line-height:2.2}
  .dark button{letter-spacing:.2em;padding:10px 34px;background:transparent;color:#e8e2d0}
</style>
</head>
<body>
<!-- tests/feel_widget_test.py が使う試験台。数とフォームへの通信はテストが横取りする -->
<section class="light"><div id="full" data-feel="harness-story" data-feel-set="story"></div></section>
<section class="dark"><div id="compact" data-feel="harness-game" data-feel-set="game" data-feel-mode="compact"></div></section>
<section class="light"><div id="board" data-feel-board></div></section>
<section class="dark"><div id="en" data-feel="harness-note" data-feel-set="note" data-feel-lang="en"></div></section>
<section class="dark" id="later" hidden><div id="late" data-feel="harness-late" data-feel-set="game" data-feel-mode="compact"></div></section>
<script type="module" src="/assets/feel/feel.js"></script>
</body>
</html>
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/feel_widget_test.py`:

```python
# -*- coding: utf-8 -*-
"""気持ちスタンプ部品（assets/feel/feel.js）の動作確認。外への通信はすべて横取りする。

  set PYTHONUTF8=1 && python tests/feel_widget_test.py

試験台は tests/feel_harness.html。数（GoatCounter 公開カウンタ）とひとこと（Google フォーム）は
Net が横取りして、送られた中身を記録する。count.js は読ませず、window.goatcounter を差し替える。
"""
import functools
import http.server
import json
import socketserver
import sys
import tempfile
import threading
import urllib.parse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8773
URL = f"http://127.0.0.1:{PORT}/tests/feel_harness.html"
SHOTS = Path(tempfile.gettempdir()) / "feel_shots"

GC_STUB = "window.__gc = []; window.goatcounter = { count: (o) => window.__gc.push(o) };"
BLOCK_STORAGE = """
for (const k of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(window, k, { configurable: true, get() { throw new Error('storage blocked'); } });
}
"""
COUNTS = {
    "feel/harness-story/naita": "2 035",
    "feel/seikai/naita": "5",
    "feel/hyaku/naita": "3",
    "game/hyaku/clear": "14",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Net:
    """公開カウンタとフォームを横取りする。counter / form に 'abort' や '500' を渡すと失敗させる。"""

    def __init__(self, counter="ok", form="ok"):
        self.counter, self.form, self.posts = counter, form, []

    def install(self, ctx):
        ctx.route("**/gc.zgo.at/**", lambda route: route.abort())
        ctx.route("https://viewsengineer.goatcounter.com/counter/**", self.on_counter)
        ctx.route("https://docs.google.com/forms/**", self.on_form)

    def on_counter(self, route):
        if self.counter == "abort":
            return route.abort()
        if self.counter == "500":
            return route.fulfill(status=500, body="oops")
        tail = route.request.url.split("/counter/", 1)[1]
        name = urllib.parse.unquote(tail[: -len(".json")])
        n = COUNTS.get(name, "0")
        route.fulfill(status=200, content_type="application/json",
                      headers={"Access-Control-Allow-Origin": "*"},
                      body=json.dumps({"count": n, "count_unique": n}))

    def on_form(self, route):
        if self.form == "abort":
            return route.abort()
        self.posts.append(route.request.post_data or "")
        route.fulfill(status=200, body="ok")


failures = []


def check(name, fn):
    try:
        fn()
        print(f"ok    {name}")
    except Exception as e:  # noqa: BLE001 — 失敗は数えて最後にまとめて返す
        failures.append(name)
        print(f"FAIL  {name}: {e}")


def open_page(browser, net, init="", width=1280):
    ctx = browser.new_context(viewport={"width": width, "height": 900})
    ctx.add_init_script(GC_STUB + init)
    net.install(ctx)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    expect(page.locator("#full .card")).to_be_visible()
    return ctx, page, errors


def gc_paths(page):
    return [e["path"] for e in page.evaluate("window.__gc")]


def main():
    SHOTS.mkdir(exist_ok=True)
    httpd = serve()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        def counts_render():
            ctx, page, _ = open_page(browser, Net())
            expect(page.locator("#full .stamp")).to_have_count(4)
            expect(page.locator('#full .stamp[data-key="naita"] .n')).to_have_text("2035人")
            expect(page.locator('#full .stamp[data-key="tsuzuki"] .n')).to_have_text("まだ誰も")
            expect(page.locator("#full .title")).to_have_text("この物語に、気持ちを置いていく")
            ctx.close()

        def press_and_reload():
            ctx, page, _ = open_page(browser, Net())
            b = page.locator('#full .stamp[data-key="naita"]')
            expect(b.locator(".n")).to_have_text("2035人")
            b.click()
            expect(b).to_have_attribute("aria-pressed", "true")
            expect(page.locator("#full .msg")).to_have_text("あなたと同じ気持ちの人が 2036 人います。")
            ev = page.evaluate("window.__gc")
            assert ev == [{"path": "feel/harness-story/naita",
                           "title": "気持ちスタンプ試験台 — 泣いた", "event": True}], ev
            page.reload()
            b = page.locator('#full .stamp[data-key="naita"]')
            expect(b).to_have_attribute("aria-pressed", "true")
            expect(b.locator(".n")).to_have_text("2036人")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("もう届いています。ありがとう。")
            assert gc_paths(page) == [], gc_paths(page)
            ctx.close()

        def first_person():
            ctx, page, _ = open_page(browser, Net())
            b = page.locator('#full .stamp[data-key="tsuzuki"]')
            expect(b.locator(".n")).to_have_text("まだ誰も")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("最初のひとりになりました。")
            expect(b.locator(".n")).to_have_text("1人")
            ctx.close()

        def note_sends():
            net = Net()
            ctx, page, _ = open_page(browser, net)
            page.click("#full .note-toggle")
            page.fill("#full textarea", "最後の一行で泣きました")
            page.wait_for_timeout(3200)
            page.click("#full .send")
            expect(page.locator("#full .note-msg")).to_have_text("届きました。ありがとう。")
            assert len(net.posts) == 1, net.posts
            q = urllib.parse.parse_qs(net.posts[0])
            assert q["entry.796994745"] == ["harness-story"], q
            assert q["entry.20892979"] == ["/tests/feel_harness.html"], q
            assert q["entry.274902902"] == ["最後の一行で泣きました"], q
            assert page.input_value("#full textarea") == ""
            assert "feel/harness-story/note" in gc_paths(page), gc_paths(page)
            ctx.close()

        def note_too_fast():
            net = Net()
            ctx, page, _ = open_page(browser, net)
            page.click("#full .note-toggle")
            page.fill("#full textarea", "すぐ送る")
            page.click("#full .send")
            expect(page.locator("#full .note-msg")).to_have_text("もう一度「届ける」を押してください。")
            assert net.posts == [], net.posts
            ctx.close()

        def note_failure_keeps_draft():
            ctx, page, _ = open_page(browser, Net(form="abort"))
            page.click("#full .note-toggle")
            page.fill("#full textarea", "通信が切れても消えない")
            page.wait_for_timeout(3200)
            page.click("#full .send")
            expect(page.locator("#full .note-msg")).to_have_text("送れませんでした。もう一度どうぞ。")
            assert page.input_value("#full textarea") == "通信が切れても消えない"
            page.reload()
            expect(page.locator("#full .card")).to_be_visible()
            expect(page.locator("#full textarea")).to_have_value("通信が切れても消えない")
            ctx.close()

        def counter_unreachable(mode):
            def run():
                ctx, page, errors = open_page(browser, Net(counter=mode))
                b = page.locator('#full .stamp[data-key="naita"]')
                page.wait_for_timeout(500)
                expect(b.locator(".n")).to_have_text("")
                b.click()
                expect(page.locator("#full .msg")).to_have_text("ありがとう。")
                assert errors == [], errors
                ctx.close()
            return run

        def storage_blocked():
            ctx, page, errors = open_page(browser, Net(), init=BLOCK_STORAGE)
            blocked = page.evaluate("(() => { try { localStorage; return 'open'; } catch (e) { return 'blocked'; } })()")
            assert blocked == "blocked", "試験の前提（ストレージの遮断）が効いていない"
            b = page.locator('#full .stamp[data-key="naita"]')
            expect(b.locator(".n")).to_have_text("2035人")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("あなたと同じ気持ちの人が 2036 人います。")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("もう届いています。ありがとう。")
            assert gc_paths(page) == ["feel/harness-story/naita"], gc_paths(page)
            assert errors == [], errors
            ctx.close()

        def english_and_compact():
            ctx, page, _ = open_page(browser, Net())
            page.locator("#en").scroll_into_view_if_needed()
            expect(page.locator("#en .title")).to_have_text("How was this note?")
            expect(page.locator('#en .stamp[data-key="yakudatta"] .label')).to_have_text("Useful")
            expect(page.locator('#en .stamp[data-key="yakudatta"] .n')).to_have_text("be the first")
            page.locator("#compact").scroll_into_view_if_needed()
            expect(page.locator("#compact .stamp")).to_have_count(3)
            expect(page.locator("#compact .note-toggle")).to_have_count(0)
            ctx.close()

        def page_css_does_not_leak():
            ctx, page, _ = open_page(browser, Net())
            page.locator("#compact").scroll_into_view_if_needed()
            expect(page.locator("#compact .stamp").first).to_be_visible()
            ls, fs = page.eval_on_selector(
                "#compact",
                "h => { const s = getComputedStyle(h.shadowRoot.querySelector('.stamp'));"
                " return [s.letterSpacing, s.fontSize]; }")
            assert ls in ("normal", "0px"), ls
            assert fs == "14px", fs
            ctx.close()

        def hidden_then_shown():
            ctx, page, _ = open_page(browser, Net())
            assert page.eval_on_selector("#late", "h => h.shadowRoot === null")
            page.evaluate("document.getElementById('later').hidden = false")
            page.locator("#late").scroll_into_view_if_needed()
            expect(page.locator("#late .card")).to_be_visible()
            ctx.close()

        def board():
            ctx, page, _ = open_page(browser, Net())
            page.locator("#board").scroll_into_view_if_needed()
            rows = page.locator("#board .row")
            expect(rows).to_have_count(3)
            expect(rows.nth(0).locator(".n")).to_have_text("😭 泣いた 5人")
            expect(rows.nth(0).locator(".name")).to_contain_text("正解の外側")
            expect(rows.nth(1).locator(".name")).to_contain_text("最後まで読んだ 14人")
            expect(rows.nth(2).locator(".n")).to_have_text("まだ誰も押していません")
            page.click('#board .chip[data-id="learn"]')
            expect(rows).to_have_count(4)
            expect(page.locator('#board .chip[data-id="learn"]')).to_have_attribute("aria-pressed", "true")
            page.eval_on_selector(
                "#board", "h => h.shadowRoot.addEventListener('click', e => e.preventDefault(), true)")
            rows.nth(0).click()
            assert any(p.startswith("feel/board/open/") for p in gc_paths(page)), gc_paths(page)
            ctx.close()

        def phone_layout():
            ctx, page, _ = open_page(browser, Net(), width=375)
            for sel in ("#full", "#compact", "#board", "#en"):
                page.locator(sel).scroll_into_view_if_needed()
                page.wait_for_timeout(300)
            sw = page.evaluate("document.documentElement.scrollWidth")
            assert sw <= 375, f"横にはみ出している: {sw}px"
            page.screenshot(path=str(SHOTS / "harness_375.png"), full_page=True)
            ctx.close()

        check("数が描かれる", counts_render)
        check("押すと +1 し、読み直しても押した状態のまま", press_and_reload)
        check("0 人のスタンプを押すと最初のひとり", first_person)
        check("ひとことがフォームへ届く", note_sends)
        check("3 秒未満の送信は送らない", note_too_fast)
        check("送信失敗でも下書きが残る", note_failure_keeps_draft)
        check("数の取得が遮断されても押せる", counter_unreachable("abort"))
        check("数の取得が 500 でも押せる", counter_unreachable("500"))
        check("ストレージが使えなくても動き、二重に押せない", storage_blocked)
        check("英語と小型版", english_and_compact)
        check("ページの CSS がはがきに漏れない", page_css_does_not_leak)
        check("隠れていた場所も、表に出たら描かれる", hidden_then_shown)
        check("トップのボード", board)
        check("スマホ幅で横にはみ出さない", phone_layout)
        browser.close()
    httpd.shutdown()
    if failures:
        print(f"\n{len(failures)} 件失敗: {failures}")
        sys.exit(1)
    print("\nfeel_widget_test: ALL PASS")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 失敗を確かめる**

Run: `set PYTHONUTF8=1 && python tests/feel_widget_test.py`（Git Bash なら `PYTHONUTF8=1 python tests/feel_widget_test.py`）
Expected: 最初の `open_page` で `#full .card` が見つからずタイムアウトし、全項目 FAIL・終了コード 1（`feel.js` がまだ 404）。

- [ ] **Step 4: 実装を書く**

`assets/feel/feel.js`:

```js
// 気持ちスタンプのはがき（Shadow DOM でページの CSS から切り離す）と、トップの「みんなの気持ち」ボード。
// ページに置くのは次の 2 行だけ:
//   <div data-feel="hyaku" data-feel-set="story"></div>
//   <script type="module" src="/assets/feel/feel.js"></script>
// 小型版は data-feel-mode="compact"、言語の指定は data-feel-lang="ja|en"。
// JS が後から描く画面では window.Feel.mount(el) を呼ぶ。ボードは <div data-feel-board></div>。
// 設計書: docs/superpowers/specs/2026-09-23-feelings-stamps-design.md
import * as C from './feel-core.js';

const LS_KEY = 'feel.v1';
const SS_KEY = 'feel.cache.v1';

function storage(kind) {
  try { return window[kind] || null; } catch (e) { return null; }
}
function load(kind, key) {
  const s = storage(kind);
  if (!s) return {};
  try { return JSON.parse(s.getItem(key) || '{}') || {}; } catch (e) { return {}; }
}
function save(kind, key, value) {
  const s = storage(kind);
  if (!s) return;
  try { s.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても画面は動かす */ }
}
function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function today() { return new Date().toISOString().slice(0, 10); }

// count.js は async で遅れて来る。最大 5 秒待ってから送る
function gcCount(path, title) {
  let tries = 0;
  (function attempt() {
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') {
      try { gc.count({ path, title, event: true }); } catch (e) { /* 計測の失敗で画面を壊さない */ }
      return;
    }
    if (++tries < 20) setTimeout(attempt, 250);
  })();
}

function rememberCount(path, n) {
  save('sessionStorage', SS_KEY, C.writeCache(load('sessionStorage', SS_KEY), path, n, Date.now()));
}

async function fetchCount(path) {
  const hit = C.readCache(load('sessionStorage', SS_KEY), path, Date.now());
  if (hit != null) return hit;
  try {
    const r = await fetch(C.counterUrl(path), { mode: 'cors' });
    if (!r.ok) return null;
    const n = C.parseCount(await r.json());
    if (n != null) rememberCount(path, n);
    return n;
  } catch (e) {
    return null;
  }
}

// 画面に入ってから描く。隠れた読了画面・結果画面は、表に出たときに描かれる
function whenVisible(host, fn) {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: '200px 0px' });
  io.observe(host);
}

const CARD_CSS = `
:host{all:initial;display:block;width:100%}
[hidden]{display:none!important}
.card{position:relative;box-sizing:border-box;width:calc(100% - 32px);max-width:560px;margin:40px auto;
  padding:18px 20px 16px;background:#f7f1e3;color:#2b2620;border:1px solid rgba(43,38,32,.28);border-radius:6px;
  box-shadow:0 10px 28px rgba(0,0,0,.18);font-family:"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif;
  font-size:15px;line-height:1.7;text-align:left;letter-spacing:normal}
.card *{box-sizing:border-box}
.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.title{margin:0;font-size:17px;font-weight:700;color:#2b2620}
.sub{margin:2px 0 0;font-size:12.5px;color:#6b6155}
.postmark{flex:none;width:44px;height:52px;border:1.5px dashed rgba(43,38,32,.45);border-radius:3px;
  display:flex;align-items:center;justify-content:center;font-size:22px;color:#6b6155}
.stamps{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 8px}
.stamp{display:inline-flex;align-items:center;gap:6px;min-height:40px;margin:0;padding:6px 12px;font:inherit;
  font-size:14px;line-height:1.3;letter-spacing:normal;color:#2b2620;background:#fffaf0;
  border:1px solid rgba(43,38,32,.35);border-radius:999px;cursor:pointer}
.stamp:hover{background:#fff1d6}
.stamp[aria-pressed="true"]{background:#2b2620;color:#f7f1e3;border-color:#2b2620}
.stamp:focus-visible,.note-toggle:focus-visible,.send:focus-visible{outline:2px solid #b5542c;outline-offset:2px}
.n{font-size:12px;opacity:.8}
.msg{min-height:1.5em;margin:0;font-size:13px;color:#8a3b17}
.note-toggle{margin:6px 0 0;padding:6px 0;font:inherit;font-size:13px;color:#6b6155;background:none;border:0;
  cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.note{margin-top:8px}
textarea{display:block;width:100%;min-height:96px;margin:0;padding:10px;font:inherit;font-size:14px;color:#2b2620;
  background:#fffdf7;border:1px solid rgba(43,38,32,.35);border-radius:4px;resize:vertical}
.hp{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none}
.note-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
.hint{flex:1 1 220px;font-size:12px;color:#6b6155}
.send{min-height:40px;margin:0;padding:6px 20px;font:inherit;font-size:14px;color:#f7f1e3;background:#2b2620;
  border:0;border-radius:4px;cursor:pointer}
.send:disabled{opacity:.6;cursor:wait}
.note-msg{min-height:1.4em;margin:6px 0 0;font-size:13px;color:#8a3b17}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.card.compact{margin:14px auto 4px;padding:12px 14px}
.card.compact .head{justify-content:center}
.card.compact .title{font-size:14px;text-align:center}
.card.compact .stamps{justify-content:center;margin:8px 0 4px}
.card.compact .msg{text-align:center}
`;

const BOARD_CSS = `
:host{display:block}
.board{max-width:760px;margin:0 0 12px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.chip{min-height:38px;padding:4px 16px;font:inherit;font-size:14px;color:var(--ink,#161510);background:transparent;
  border:1px solid var(--ink,#161510);border-radius:999px;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--ink,#161510);color:var(--paper,#f4f0e6)}
.chip:focus-visible,.row:focus-visible{outline:2px solid var(--accent,#c43d2a);outline-offset:2px}
.row{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px 12px;padding:14px 2px;
  border-top:1px solid rgba(22,21,16,.18);color:var(--ink,#161510);text-decoration:none}
.row:hover .name{color:var(--accent,#c43d2a)}
.name{font-weight:700}
.extra{margin-left:8px;font-size:12px;font-weight:400;color:var(--ink-3,#6b6759)}
.n{font-size:14px;color:var(--ink-2,#3a3830);white-space:nowrap}
`;

function mount(host, opts = {}) {
  if (!host || host.__feel) return;
  const work = opts.work || host.dataset.feel;
  const set = opts.set || host.dataset.feelSet;
  if (!C.isWorkId(work) || !C.stampsFor(set)) return;
  host.__feel = {
    work,
    set,
    mode: opts.mode || host.dataset.feelMode || 'full',
    lang: opts.lang || host.dataset.feelLang || '',
    title: opts.title || host.dataset.feelTitle || '',
  };
  whenVisible(host, () => renderCard(host));
}

function renderCard(host) {
  const cfg = host.__feel;
  const lang = C.pickLang(cfg.lang || document.documentElement.lang, navigator.language);
  const T = C.TEXT[lang];
  const heading = C.HEADINGS[cfg.set][lang];
  const title = C.workTitle(cfg.work, cfg.title || document.title);
  const compact = cfg.mode === 'compact';

  const card = node('div', compact ? 'card compact' : 'card');
  card.lang = lang;
  const head = node('div', 'head');
  const words = node('div');
  words.append(node('p', 'title', heading));
  if (!compact) words.append(node('p', 'sub', T.sub));
  head.append(words);
  if (!compact) {
    const mark = node('div', 'postmark', '✉');
    mark.setAttribute('aria-hidden', 'true');
    head.append(mark);
  }
  const row = node('div', 'stamps');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', heading);
  const msg = node('p', 'msg');
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  const state = load('localStorage', LS_KEY);
  for (const s of C.stampsFor(cfg.set)) {
    const pressed = C.isPressed(state, C.counterPath(cfg.work, s.key));
    row.append(stampButton(cfg, s, lang, title, msg, pressed));
  }
  card.append(head, row, msg);
  if (!compact) card.append(noteBlock(cfg, T, title));

  const style = node('style');
  style.textContent = CARD_CSS;
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(style, card);
}

function stampButton(cfg, s, lang, title, msg, pressedBefore) {
  const path = C.counterPath(cfg.work, s.key);
  const b = node('button', 'stamp');
  b.type = 'button';
  b.dataset.key = s.key;
  b.setAttribute('aria-pressed', pressedBefore ? 'true' : 'false');
  const n = node('span', 'n');
  b.append(node('span', 'emoji', s.emoji), node('span', 'label', s[lang]), n);
  let count = null;
  let pressedNow = false;
  fetchCount(path).then((v) => {
    // 数が届く前に押された場合は、届いた数に自分の 1 を足す
    if (v != null && pressedNow) { v += 1; rememberCount(path, v); }
    count = v;
    n.textContent = C.countLabel(lang, v);
  });
  b.addEventListener('click', () => {
    const state = load('localStorage', LS_KEY);
    if (b.getAttribute('aria-pressed') === 'true' || C.isPressed(state, path)) {
      msg.textContent = C.TEXT[lang].already;
      return;
    }
    pressedNow = true;
    save('localStorage', LS_KEY, C.markPressed(state, path, today()));
    b.setAttribute('aria-pressed', 'true');
    gcCount(path, `${title} — ${s.ja}`);
    if (count != null) {
      count += 1;
      n.textContent = C.countLabel(lang, count);
      rememberCount(path, count);
    }
    msg.textContent = C.countMessage(lang, count);
  });
  return b;
}

function noteBlock(cfg, T, title) {
  const wrap = node('div', 'notewrap');
  const toggle = node('button', 'note-toggle', T.noteToggle);
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const box = node('div', 'note');
  box.hidden = true;
  const label = node('label', 'sr', T.noteLabel);
  label.htmlFor = 'feel-note';
  const ta = node('textarea');
  ta.id = 'feel-note';
  ta.maxLength = C.NOTE_MAX;
  ta.placeholder = T.notePlaceholder;
  const hp = node('input', 'hp'); // 人には見えない欄。埋まっていたらボット
  hp.type = 'text';
  hp.tabIndex = -1;
  hp.autocomplete = 'off';
  hp.setAttribute('aria-hidden', 'true');
  const send = node('button', 'send', T.send);
  send.type = 'button';
  const line = node('div', 'note-row');
  line.append(node('span', 'hint', T.noteHint), send);
  const out = node('p', 'note-msg');
  out.setAttribute('role', 'status');
  out.setAttribute('aria-live', 'polite');
  box.append(label, ta, hp, line, out);
  wrap.append(toggle, box);

  let openedAt = 0;
  const open = () => {
    box.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    openedAt = Date.now();
  };
  ta.value = C.getDraft(load('localStorage', LS_KEY), cfg.work);
  if (ta.value) open(); // 前に送れなかった下書きがあれば開いておく

  toggle.addEventListener('click', () => {
    if (box.hidden) { open(); ta.focus(); return; }
    box.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });
  ta.addEventListener('input', () => {
    save('localStorage', LS_KEY, C.setDraft(load('localStorage', LS_KEY), cfg.work, ta.value));
  });
  send.addEventListener('click', async () => {
    const v = C.validateNote(ta.value, Date.now() - openedAt, hp.value);
    if (!v.ok) {
      out.textContent = v.reason === 'bot' ? T.sent : T[v.reason]; // ボットには成功したふりをする
      return;
    }
    send.disabled = true;
    out.textContent = T.sending;
    try {
      await fetch(C.FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(C.formBody(cfg.work, location.pathname, v.text)),
      });
      ta.value = '';
      save('localStorage', LS_KEY, C.setDraft(load('localStorage', LS_KEY), cfg.work, ''));
      out.textContent = T.sent;
      gcCount(`feel/${cfg.work}/note`, `${title} — ひとこと`);
    } catch (e) {
      out.textContent = T.failed;
    } finally {
      send.disabled = false;
    }
  });
  return wrap;
}

function mountBoard(host) {
  if (!host || host.__feelBoard) return;
  host.__feelBoard = true;
  whenVisible(host, () => renderBoard(host));
}

function renderBoard(host) {
  const chips = node('div', 'chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', '気持ちで選ぶ');
  const rows = node('div', 'rows');
  const box = node('div', 'board');
  box.append(chips, rows);
  const style = node('style');
  style.textContent = BOARD_CSS;
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(style, box);

  const counts = {};
  let current = C.BOARD[0];
  const draw = () => {
    chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === current.id)));
    const list = C.sortRows(current.works.map((w, i) => (
      { work: w, count: counts[C.counterPath(w, current.key)], order: i })));
    rows.replaceChildren(...list.map((r) => boardRow(r, current, counts)));
  };
  for (const g of C.BOARD) {
    const b = node('button', 'chip', g.label);
    b.type = 'button';
    b.dataset.id = g.id;
    b.addEventListener('click', () => { current = g; draw(); });
    chips.append(b);
  }
  draw(); // 数が届く前から、作品へのリンクは出しておく

  const paths = new Set(Object.values(C.CLEAR_PATHS));
  C.BOARD.forEach((g) => g.works.forEach((w) => paths.add(C.counterPath(w, g.key))));
  Promise.all([...paths].map((p) => fetchCount(p).then((n) => { counts[p] = n; }))).then(draw);
}

function boardRow(r, g, counts) {
  const w = C.WORKS[r.work];
  const a = node('a', 'row');
  a.href = w.url;
  const name = node('span', 'name', w.title);
  const cleared = C.CLEAR_PATHS[r.work] ? counts[C.CLEAR_PATHS[r.work]] : null;
  if (cleared) name.append(node('span', 'extra', `最後まで読んだ ${cleared}人`));
  let right = '';
  if (r.count === 0) right = 'まだ誰も押していません';
  else if (r.count != null) right = `${g.emoji} ${g.stamp} ${r.count}人`;
  a.append(name, node('span', 'n', right));
  a.addEventListener('click', () => gcCount(`feel/board/open/${r.work}`, `みんなの気持ち → ${w.title}`));
  return a;
}

function scan(root = document) {
  root.querySelectorAll('[data-feel]').forEach((n) => mount(n));
  root.querySelectorAll('[data-feel-board]').forEach((n) => mountBoard(n));
}

window.Feel = { mount, scan };
scan();
```

- [ ] **Step 5: 通ることを確かめる**

Run: `PYTHONUTF8=1 python tests/feel_widget_test.py` と `node tests/feel_core_test.mjs`
Expected: 14 項目すべて `ok`、最後に `feel_widget_test: ALL PASS`。`feel_core_test: ALL PASS`。

- [ ] **Step 6: スマホ幅の画像を見る**

`%TEMP%\feel_shots\harness_375.png` を開き、はがきの文字が読めること、暗い節でもはがきがクリーム色の紙として見えること、ボタンが切れていないことを確かめる（画像の確認はサブエージェントに任せてよい）。

- [ ] **Step 7: コミット**

```bash
git add assets/feel/feel.js tests/feel_harness.html tests/feel_widget_test.py
git commit -m "feat(feel): はがき部品と試験台を追加" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: トップに № 05「みんなの気持ち」

**Files:**
- Modify: `index.html`（ナビ、作り方の節の参照文、新しい節、節番号 3 か所）
- Test: `tests/feel_placement_test.mjs`（新規）、`tests/feel_pages_test.py`（新規）

**Interfaces:**
- Consumes: Task 2 の `data-feel` / `data-feel-board` の書式、Shadow DOM のクラス名
- Produces: `tests/feel_placement_test.mjs` の `EXPECTED` 配列と、`tests/feel_pages_test.py` の `PAGES` 配列・`EXTRA` 辞書（Task 4〜6 が行を足す）

- [ ] **Step 1: 失敗する静的検査を書く**

`tests/feel_placement_test.mjs`:

```js
// 気持ちスタンプの置き場所の静的検査。実行: node tests/feel_placement_test.mjs
// 設計書 4 章の表どおりに置かれ、読み込みと計測タグがそろっているかを見る。
import { readFileSync, readdirSync } from 'node:fs';
import { stampsFor, isWorkId } from '../assets/feel/feel-core.js';

const ROOT = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
const SCRIPT = '<script type="module" src="/assets/feel/feel.js"></script>';
const GC = 'gc.zgo.at/count.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// [ファイル, 作品ID, 組, 小型版か]。Task 4〜6 で行を足す
const EXPECTED = [
  ['index.html', 'site', 'site', false],
];

// 置いてはいけないページ（設計書 4 章）
const NEVER = ['cabin.html', 'niwa.html', 'hitori.html', 'stopwatch.html', 'koe.html', 'journal.html',
  'kototsugi/game/index.html'];

for (const [file, work, set, compact] of EXPECTED) {
  check(`${file}: ${work} / ${set}`, () => {
    const html = read(file);
    const tag = `data-feel="${work}" data-feel-set="${set}"${compact ? ' data-feel-mode="compact"' : ''}`;
    ok(html.includes(tag), `置き場所が無い: ${tag}`);
    ok(html.split(SCRIPT).length - 1 === 1, 'feel.js の読み込みがちょうど 1 回ではない');
    ok(html.includes(GC), 'GoatCounter の count.js が無い');
  });
}

for (const file of NEVER) {
  check(`${file} には置かない`, () => ok(!read(file).includes('data-feel'), 'data-feel がある'));
}

// サイト全体: 置いた所はすべて、組が実在し、作品 ID が正しく、feel.js を読み込んでいる
function htmlFiles(dir = '') {
  const out = [];
  for (const e of readdirSync(new URL(dir || './', ROOT), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules') continue;
    const rel = dir + e.name;
    if (e.isDirectory()) out.push(...htmlFiles(rel + '/'));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
for (const file of htmlFiles()) {
  const html = read(file);
  if (!html.includes('data-feel=')) continue;
  check(`${file}: 組と作品 ID と読み込み`, () => {
    for (const m of html.matchAll(/data-feel-set="([^"]*)"/g)) ok(stampsFor(m[1]), `知らない組: ${m[1]}`);
    for (const m of html.matchAll(/data-feel="([^"]*)"/g)) ok(isWorkId(m[1]), `作品 ID が不正: ${m[1]}`);
    ok(html.includes(SCRIPT), 'feel.js を読み込んでいない');
  });
}

check('index: ナビ・節・節番号', () => {
  const html = read('index.html');
  ok(html.includes('<a href="#feelings">気持ち</a>'), 'ナビに「気持ち」が無い');
  ok(html.includes('<section class="section" id="feelings">'), '#feelings の節が無い');
  ok(html.includes('data-feel-board'), 'ボードが無い');
  for (const s of ['№ 05 — みんなの気持ち', '№ 06 — 世界の外の窓', '№ 07 — Agent View', '№ 08 — 立場とプロフィール']) {
    ok(html.includes(s), `節番号が無い: ${s}`);
  }
  ok(!html.includes('№ 05 — 世界の外の窓'), '古い節番号「№ 05 — 世界の外の窓」が残っている');
});

if (failures) { console.error(`feel_placement_test: ${failures} FAILED`); process.exit(1); }
console.log('feel_placement_test: ALL PASS');
```

- [ ] **Step 2: 失敗を確かめる**

Run: `node tests/feel_placement_test.mjs`
Expected: `FAIL index.html: site / site` と `FAIL index: ナビ・節・節番号` が出て終了コード 1。

- [ ] **Step 3: index.html を直す（4 か所）**

(a) ナビ。変更前:
```html
    <a href="#knowhow">作り方</a>
    <a href="#windows">外の窓</a>
```
変更後:
```html
    <a href="#knowhow">作り方</a>
    <a href="#feelings">気持ち</a>
    <a href="#windows">外の窓</a>
```

(b) 作り方の節の末尾の参照文。`<a href="#windows" style="color:var(--accent)">№ 05 — 世界の外の窓</a>` の `№ 05` を `№ 06` にする（この 1 か所だけ）。

(c) 新しい節。`<!-- ── WINDOWS (channels) ── -->` の行の**直前**に次を入れる:
```html
<!-- ── № 05 · みんなの気持ち — 作品の終わりで押された気持ちスタンプ（assets/feel/feel.js） ── -->
<section class="section" id="feelings">
  <div class="section-head">
    <div class="section-eyebrow">№ 05 — みんなの気持ち</div>
    <h2 class="section-title">みんなの <em>気持ち</em>。</h2>
  </div>
  <p style="max-width:760px;margin:-24px 0 28px;font-size:15px;line-height:1.9;color:var(--ink-2)">
    作品の終わりに置いた気持ちスタンプが、押された数です。迷ったら、いまの気持ちで選んでください。
  </p>
  <div data-feel-board></div>
  <div data-feel="site" data-feel-set="site"></div>
  <script type="module" src="/assets/feel/feel.js"></script>
</section>

```

(d) 節番号を 1 つずつ繰り下げる（4 か所）:
- `<div class="section-eyebrow">№ 05 — 世界の外の窓</div>` → `<div class="section-eyebrow">№ 06 — 世界の外の窓</div>`
- `<!-- ── № 06 · Agent View — 機械向けの入口 ── -->` → `<!-- ── № 07 · Agent View — 機械向けの入口 ── -->`
- `<div class="section-eyebrow">№ 06 — Agent View</div>` → `<div class="section-eyebrow">№ 07 — Agent View</div>`
- `<div class="section-eyebrow">№ 07 — 立場とプロフィール</div>` → `<div class="section-eyebrow">№ 08 — 立場とプロフィール</div>`

作り方の節の中にある `№ 05 · パズル` `№ 06 · 基盤` などはカードの番号なので**触らない**。

- [ ] **Step 4: 静的検査が通ることを確かめる**

Run: `node tests/feel_placement_test.mjs`
Expected: `feel_placement_test: ALL PASS`

- [ ] **Step 5: ページ検査を書く**

`tests/feel_pages_test.py`:

```python
# -*- coding: utf-8 -*-
"""気持ちスタンプを置いた各ページの検査。外の計測とフォームは横取りする。

  set PYTHONUTF8=1 && python tests/feel_pages_test.py           # 全部
  set PYTHONUTF8=1 && python tests/feel_pages_test.py hyaku     # 名前に hyaku を含む行だけ

見ていること（設計書 7 章）:
  - はがきが描かれ、スマホ 375px・PC 1280px のどちらでも画面の横幅に収まる
  - ページ側の CSS がはがきのボタンに漏れていない（字間・文字サイズ）
  - 最初は隠れている画面（読了画面・結果画面・奥付）でも、表に出たら描かれる
撮った画像は %TEMP%\\feel_shots に置く。文字が読めること・切れていないことを目で確かめる。
"""
import functools
import http.server
import json
import socketserver
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8774
SHOTS = Path(tempfile.gettempdir()) / "feel_shots"
VIEWPORTS = {"375": {"width": 375, "height": 812}, "1280": {"width": 1280, "height": 900}}
GC_STUB = "window.goatcounter = { count: () => {} };"

# (名前, URL, はがきの場所, 描く前に実行する JS, 期待する見出し)。Task 4〜6 で行を足す
PAGES = [
    ("index", "/index.html?nofx=1", '[data-feel="site"]', None, "このサイトに、ひとこと"),
]

# 隠れた親をすべて表に出してから、はがきを画面の中央に持ってくる
REVEAL = """(sel) => {
  const host = document.querySelector(sel);
  if (!host) return false;
  for (let p = host.parentElement; p && p !== document.body; p = p.parentElement) {
    p.hidden = false;
    p.classList.remove('hidden');
    if (getComputedStyle(p).display === 'none') p.style.display = 'flex';
  }
  host.scrollIntoView({ block: 'center' });
  return true;
}"""

MEASURE = """(sel) => {
  const host = document.querySelector(sel);
  const root = host && host.shadowRoot;
  const card = root && root.querySelector('.card');
  if (!card) return null;
  const r = card.getBoundingClientRect();
  const s = getComputedStyle(root.querySelector('.stamp'));
  return { left: r.left, right: r.right, width: r.width, vw: innerWidth,
           ls: s.letterSpacing, fs: s.fontSize, title: root.querySelector('.title').textContent };
}"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def install_net(ctx):
    ctx.route("**/gc.zgo.at/**", lambda route: route.abort())
    ctx.route("https://viewsengineer.goatcounter.com/counter/**",
              lambda route: route.fulfill(status=200, content_type="application/json",
                                          headers={"Access-Control-Allow-Origin": "*"},
                                          body=json.dumps({"count": "3", "count_unique": "3"})))
    ctx.route("https://docs.google.com/forms/**", lambda route: route.fulfill(status=200, body="ok"))


def extra_index(page, vw):
    page.evaluate(REVEAL, "[data-feel-board]")
    page.wait_for_function(
        "(() => { const h = document.querySelector('[data-feel-board]');"
        " return !!(h && h.shadowRoot && h.shadowRoot.querySelectorAll('.row').length >= 3); })()",
        timeout=10000)
    nav = page.evaluate("[...document.querySelectorAll('#siteNav a')].map(a => a.getAttribute('href'))")
    assert "#feelings" in nav, nav


# 名前ごとの追加の検査。Task 4 で hyaku を足す
EXTRA = {"index": extra_index}


def check_page(browser, name, url, sel, prep, heading, vw):
    ctx = browser.new_context(viewport=VIEWPORTS[vw], locale="ja-JP")
    ctx.add_init_script(GC_STUB)
    install_net(ctx)
    page = ctx.new_page()
    try:
        page.goto(f"http://127.0.0.1:{PORT}{url}", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(1500)
        if prep:
            page.evaluate(prep)
        assert page.evaluate(REVEAL, sel), f"{sel} が無い"
        page.wait_for_function(
            "(sel) => { const h = document.querySelector(sel);"
            " return !!(h && h.shadowRoot && h.shadowRoot.querySelector('.card')); }",
            arg=sel, timeout=10000)
        page.wait_for_timeout(400)
        m = page.evaluate(MEASURE, sel)
        assert m, "はがきが描かれていない"
        assert m["left"] >= -1 and m["right"] <= m["vw"] + 1, f"横にはみ出している: {m}"
        assert m["width"] >= 200, f"つぶれている: {m}"
        assert m["ls"] in ("normal", "0px"), f"字間が漏れている: {m['ls']}"
        assert m["fs"] == "14px", f"文字サイズが漏れている: {m['fs']}"
        if heading:
            assert m["title"] == heading, f"見出し: {m['title']!r}"
        page.locator(sel).screenshot(path=str(SHOTS / f"{name}_{vw}.png"))
        if name in EXTRA:
            EXTRA[name](page, vw)
    finally:
        ctx.close()


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    SHOTS.mkdir(exist_ok=True)
    httpd = serve()
    failures = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name, url, sel, prep, heading in PAGES:
            if only and only not in name:
                continue
            for vw in VIEWPORTS:
                try:
                    check_page(browser, name, url, sel, prep, heading, vw)
                    print(f"ok    {name} {vw}")
                except Exception as e:  # noqa: BLE001 — 失敗は数えて最後にまとめて返す
                    failures.append(f"{name} {vw}")
                    print(f"FAIL  {name} {vw}: {e}")
        browser.close()
    httpd.shutdown()
    print(f"\n画像: {SHOTS}")
    if failures:
        print(f"{len(failures)} 件失敗: {failures}")
        sys.exit(1)
    print("feel_pages_test: ALL PASS")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: ページ検査を回す**

Run: `PYTHONUTF8=1 python tests/feel_pages_test.py`
Expected: `ok    index 375` と `ok    index 1280`、`feel_pages_test: ALL PASS`。
`%TEMP%\feel_shots\index_375.png` を見て、はがきが節の幅に収まり読めることを確かめる。

- [ ] **Step 7: コミット**

```bash
git add index.html tests/feel_placement_test.mjs tests/feel_pages_test.py
git commit -m "feat(index): № 05 みんなの気持ちを足し、節番号を繰り下げる" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 3 つの物語の終わり（hyaku・seikai・kototsugi）

**Files:**
- Modify: `hyaku.html`（`#ending` の CSS、`#afterword` の中、`</body>` の前）
- Modify: `seikai.html`（タイトル画面の共有ボタンの下、`</body>` の前）
- Modify: `kototsugi/index.html`（`</head>` の前に計測タグ、footer の前にはがき）
- Test: `tests/feel_placement_test.mjs`、`tests/feel_pages_test.py`（行を足す）

**Interfaces:**
- Consumes: Task 2 の置き場所の書式。Task 3 の `EXPECTED` / `PAGES` / `EXTRA`

- [ ] **Step 1: 検査に行を足して、失敗を確かめる**

`tests/feel_placement_test.mjs` の `EXPECTED` を次にする:
```js
const EXPECTED = [
  ['index.html', 'site', 'site', false],
  ['hyaku.html', 'hyaku', 'story', false],
  ['seikai.html', 'seikai', 'story', false],
  ['kototsugi/index.html', 'kototsugi', 'story', false],
];
```
`tests/feel_pages_test.py` の `PAGES` を次にする:
```python
PAGES = [
    ("index", "/index.html?nofx=1", '[data-feel="site"]', None, "このサイトに、ひとこと"),
    ("hyaku", "/hyaku.html", '[data-feel="hyaku"]', None, "この物語に、気持ちを置いていく"),
    ("hyaku-en", "/hyaku.html?lang=en", '[data-feel="hyaku"]', None, "Leave a feeling for this story"),
    ("seikai", "/seikai.html", '[data-feel="seikai"]', None, "この物語に、気持ちを置いていく"),
    ("kototsugi", "/kototsugi/index.html", '[data-feel="kototsugi"]', None, "この物語に、気持ちを置いていく"),
]
```
`EXTRA = {"index": extra_index}` の直前に次を足し、`EXTRA` を `{"index": extra_index, "hyaku": extra_hyaku}` にする:
```python
def extra_hyaku(page, vw):
    # 読了画面は画面より高くなる。末尾の「表紙へもどる」までスクロールで届くこと
    bottom = page.evaluate("""() => { const e = document.getElementById('ending');
        e.scrollTop = e.scrollHeight; return document.getElementById('btnBack').getBoundingClientRect().bottom; }""")
    height = page.evaluate("innerHeight")
    assert bottom <= height + 1, f"表紙へもどる に届かない: {bottom} > {height}"
```

Run: `node tests/feel_placement_test.mjs`
Expected: hyaku / seikai / kototsugi の 3 行が FAIL。

- [ ] **Step 2: hyaku.html を直す（3 か所）**

(a) 読了画面のスクロール。変更前:
```css
#ending{position:fixed;inset:0;z-index:55;background:#05050a;display:none;
  flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;line-height:2.2}
```
変更後:
```css
#ending{position:fixed;inset:0;z-index:55;background:#05050a;display:none;
  flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;line-height:2.2;
  /* はがきを足すと画面より高くなる。上が切れないよう safe で寄せ、縦にスクロールさせる */
  justify-content:safe center;overflow-y:auto}
```

(b) あとがきの中。`      <p class="aw-next-lead" id="awNextLead">次に読むなら</p>` の行の**直前**に 1 行入れる:
```html
      <div data-feel="hyaku" data-feel-set="story"></div>
```

(c) `</body>` の直前に 1 行入れる:
```html
<script type="module" src="/assets/feel/feel.js"></script>
```

- [ ] **Step 3: seikai.html を直す（2 か所）**

(a) `    <section class="about">` の行の**直前**に 1 行入れる（共有ボタンの `.sharerow` の下になる）:
```html
    <div data-feel="seikai" data-feel-set="story"></div>
```
(b) `</body>` の直前に `<script type="module" src="/assets/feel/feel.js"></script>` を入れる。

- [ ] **Step 4: kototsugi/index.html を直す（2 か所）**

(a) `</head>` の直前に計測タグを入れる（index.html の 80 行目と同じもの）:
```html
<script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="//gc.zgo.at/count.js" integrity="sha384-2UjvVpptg4JlEVgJI2PdscrjOjPcil/4F1ZvIMJ81CShQnEDSlPI+l4PfogvTLYi" crossorigin="anonymous"></script>
```
(b) `<footer data-star="6">` の行の**直前**に入れる:
```html
<div data-feel="kototsugi" data-feel-set="story"></div>
<script type="module" src="/assets/feel/feel.js"></script>

```

- [ ] **Step 5: 検査を回す**

Run: `node tests/feel_placement_test.mjs` → Expected: `feel_placement_test: ALL PASS`
Run: `PYTHONUTF8=1 python tests/feel_pages_test.py` → Expected: index・hyaku・hyaku-en・seikai・kototsugi の各 375 / 1280 がすべて `ok`、`feel_pages_test: ALL PASS`

失敗したら、失敗した名前だけを `PYTHONUTF8=1 python tests/feel_pages_test.py hyaku` のように回して直す。

- [ ] **Step 6: 画像を見る**

`%TEMP%\feel_shots\` の `hyaku_375.png` `hyaku-en_375.png` `seikai_375.png` `kototsugi_375.png` を見て、暗い画面の上でもはがきが読めること、英語版が英語で出ていることを確かめる。

- [ ] **Step 7: コミット**

```bash
git add hyaku.html seikai.html kototsugi/index.html tests/feel_placement_test.mjs tests/feel_pages_test.py
git commit -m "feat(feel): 3つの物語の終わりにはがきを置く" -m "百の悪行の読了画面は、はがきを足すと画面より高くなるので縦にスクロールできるようにした。ことつぎの星の紹介ページには GoatCounter のタグが無かったので足した。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ゲームの結果画面と絵本の奥付（小型版）

**Files:**
- Modify: `sudoku.html`（結果画面 `#resultScreen` の中、`</body>` の前）
- Modify: `shogi-puyo.html`（結果カード `#resultCard` の中、`</body>` の前）
- Modify: `ehon.html`（`renderColophon()` の中、`</body>` の前）
- Test: `tests/feel_placement_test.mjs`、`tests/feel_pages_test.py`（行を足す）

**Interfaces:**
- Consumes: Task 2 の `window.Feel.mount(el)`（ehon は奥付を JS で描くので明示的に呼ぶ）

- [ ] **Step 1: 検査に行を足して、失敗を確かめる**

`EXPECTED` の末尾に 3 行足す:
```js
  ['sudoku.html', 'sudoku', 'game', true],
  ['shogi-puyo.html', 'shogi-puyo', 'game', true],
  ['ehon.html', 'ehon', 'ehon', true],
```
`PAGES` の末尾に 3 行足す:
```python
    ("sudoku", "/sudoku.html", '[data-feel="sudoku"]', None, "遊んでみて、どうでした？"),
    ("shogi-puyo", "/shogi-puyo.html", '[data-feel="shogi-puyo"]', None, "遊んでみて、どうでした？"),
    ("ehon", "/ehon.html", '[data-feel="ehon"]',
     "typeof renderColophon === 'function' && renderColophon()", "この絵本、どうでした？"),
```
Run: `node tests/feel_placement_test.mjs` → Expected: 3 行が FAIL。

- [ ] **Step 2: sudoku.html と shogi-puyo.html を直す**

sudoku.html: `      <div class="endnext">` の行の**直前**に入れる（結果画面の「メニューへ」ボタンの下、NEXT の上）:
```html
      <div data-feel="sudoku" data-feel-set="game" data-feel-mode="compact"></div>
```
shogi-puyo.html: `      <div class="endnext">` の行の**直前**に入れる（「もう一局」ボタンの下、NEXT の上）:
```html
      <div data-feel="shogi-puyo" data-feel-set="game" data-feel-mode="compact"></div>
```
両方とも `</body>` の直前に `<script type="module" src="/assets/feel/feel.js"></script>` を入れる。
（どちらの結果画面も、すでに縦にスクロールできる作りなので CSS は触らない）

- [ ] **Step 3: ehon.html を直す**

(a) `renderColophon()` の中。変更前:
```js
  const zukanDiv = document.createElement('div');
  zukanDiv.id = 'colo-zukan';
  wrap.appendChild(zukanDiv);
```
変更後:
```js
  const zukanDiv = document.createElement('div');
  zukanDiv.id = 'colo-zukan';
  wrap.appendChild(zukanDiv);

  /* 気持ちスタンプ（小型版）。描くのは assets/feel/feel.js */
  const feelBox = document.createElement('div');
  feelBox.innerHTML = '<div data-feel="ehon" data-feel-set="ehon" data-feel-mode="compact"></div>';
  const feelSlot = feelBox.firstChild;
  feelSlot.dataset.feelLang = ehonLang() === 'jp' ? 'ja' : 'en';
  wrap.appendChild(feelSlot);
```
(b) 同じ関数の末尾。変更前:
```js
  host.appendChild(wrap);
  if (window.ZukanEngine) window.ZukanEngine.renderSummary(zukanDiv);
```
変更後:
```js
  host.appendChild(wrap);
  if (window.ZukanEngine) window.ZukanEngine.renderSummary(zukanDiv);
  if (window.Feel) window.Feel.mount(feelSlot);
```
（`host.appendChild(wrap);` は目次の描画にもあるので、2 行まとめて目印にする）

(c) `</body>` の直前に `<script type="module" src="/assets/feel/feel.js"></script>` を入れる。

- [ ] **Step 4: 検査を回す**

Run: `node tests/feel_placement_test.mjs` → Expected: `ALL PASS`
Run: `PYTHONUTF8=1 python tests/feel_pages_test.py` → Expected: 追加した 3 ページも 375 / 1280 で `ok`、`ALL PASS`
Run: `python C:/tmp/check_dup_const.py ehon.html` → Expected: 終了コード 0

- [ ] **Step 5: 画像を見る**

`sudoku_375.png` `shogi-puyo_375.png` `ehon_375.png` を見て、小型版が結果カードの中に収まり、スタンプ 3 つが読めることを確かめる。

- [ ] **Step 6: コミット**

```bash
git add sudoku.html shogi-puyo.html ehon.html tests/feel_placement_test.mjs tests/feel_pages_test.py
git commit -m "feat(feel): ゲームの結果画面と絵本の奥付に小型のはがきを置く" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 道具・学びのページと研究ノート（差し込みスクリプト）

**Files:**
- Create: `scripts/feel_place.py`
- Modify（スクリプトが書き換える）: `ai-map.html` `salon.html` `ai-english.html` `toeic.html` `novel-bench.html` `hitoritabi/index.html`、`method/` の日本語ノート 14 本と `method/en/` の英語ノート 2 本（どちらも `index.html` は除く）
- Test: `tests/feel_placement_test.mjs`、`tests/feel_pages_test.py`（行を足す）

**Interfaces:**
- Consumes: Task 2 の置き場所の書式
- Produces: `python scripts/feel_place.py`（研究ノートを足したら再実行する運用。placement テストが漏れを検出する）

- [ ] **Step 1: 検査に行を足して、失敗を確かめる**

`EXPECTED` の末尾に 6 行足す:
```js
  ['ai-map.html', 'ai-map', 'tool', false],
  ['salon.html', 'salon', 'tool', false],
  ['ai-english.html', 'ai-english', 'tool', false],
  ['toeic.html', 'toeic', 'tool', false],
  ['novel-bench.html', 'novel-bench', 'tool', false],
  ['hitoritabi/index.html', 'hitoritabi', 'tool', false],
```
`const EXPECTED = [ … ];` の直後に、研究ノートを自動で加える次のコードを足す:
```js
// 研究ノートは全部（index.html を除く）。新しいノートは scripts/feel_place.py を再実行すれば通る
for (const dir of ['method/', 'method/en/']) {
  for (const f of readdirSync(new URL(dir, ROOT))) {
    if (!f.endsWith('.html') || f === 'index.html') continue;
    EXPECTED.push([dir + f, dir + f.slice(0, -'.html'.length), 'note', false]);
  }
}
```
`PAGES` の末尾に 8 行足す:
```python
    ("ai-map", "/ai-map.html", '[data-feel="ai-map"]', None, "ここまで見て、どうでした？"),
    ("salon", "/salon.html", '[data-feel="salon"]', None, "ここまで見て、どうでした？"),
    ("ai-english", "/ai-english.html", '[data-feel="ai-english"]', None, "ここまで見て、どうでした？"),
    ("toeic", "/toeic.html", '[data-feel="toeic"]', None, "ここまで見て、どうでした？"),
    ("novel-bench", "/novel-bench.html", '[data-feel="novel-bench"]', None, "ここまで見て、どうでした？"),
    ("hitoritabi", "/hitoritabi/index.html", '[data-feel="hitoritabi"]', None, "ここまで見て、どうでした？"),
    ("method-ja", "/method/kansoku-suru-monogatari.html",
     '[data-feel="method/kansoku-suru-monogatari"]', None, "このノート、どうでした？"),
    ("method-en", "/method/en/stories-that-watch-you.html",
     '[data-feel="method/en/stories-that-watch-you"]', None, "How was this note?"),
```
Run: `node tests/feel_placement_test.mjs` → Expected: 6 ページと研究ノート 16 本が FAIL。

- [ ] **Step 2: 差し込みスクリプトを書く**

`scripts/feel_place.py`:

```python
# -*- coding: utf-8 -*-
"""気持ちスタンプのはがき（assets/feel/feel.js）を、ページ末尾の footer の直前に差し込む。

何度実行してもよい（data-feel がすでにあるページは飛ばす）。研究ノートを足したら再実行する。

  set PYTHONUTF8=1 && python scripts/feel_place.py

物語・ゲーム・トップの置き場所は画面ごとに位置が違うので、ここでは扱わない（手で置いてある）。
作業ツリーの HTML は CRLF なので、改行コードはファイルに合わせて保つ。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = '<script type="module" src="/assets/feel/feel.js"></script>'

# (ファイル, 作品ID, 組, この文字列がある行の直前に差し込む)
FOOTER_PAGES = [
    ("ai-map.html", "ai-map", "tool", '<footer><div class="wrap">'),
    ("salon.html", "salon", "tool", '<footer class="foot">'),
    ("ai-english.html", "ai-english", "tool", "<footer>"),
    ("toeic.html", "toeic", "tool", '<footer class="foot">'),
    ("novel-bench.html", "novel-bench", "tool", '<div class="foot">'),
    ("hitoritabi/index.html", "hitoritabi", "tool", "<footer>"),
]


def method_pages():
    for sub in ("method", "method/en"):
        for p in sorted((ROOT / sub).glob("*.html")):
            if p.name == "index.html":
                continue
            rel = p.relative_to(ROOT).as_posix()
            yield rel, rel[: -len(".html")], "note", "<footer"


def place(rel, work, set_, anchor):
    path = ROOT / rel
    html = path.read_bytes().decode("utf-8")
    if "data-feel=" in html:
        return "skip"
    i = html.find(anchor)
    if i < 0:
        raise SystemExit(f"{rel}: 目印 {anchor!r} が見つからない")
    nl = "\r\n" if "\r\n" in html else "\n"
    start = html.rfind("\n", 0, i) + 1  # 目印のある行の頭に差し込む
    snippet = f'<div data-feel="{work}" data-feel-set="{set_}"></div>{nl}{SCRIPT}{nl}'
    path.write_bytes((html[:start] + snippet + html[start:]).encode("utf-8"))
    return "placed"


def main():
    for rel, work, set_, anchor in FOOTER_PAGES + list(method_pages()):
        print(f"{place(rel, work, set_, anchor):6}  {rel}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: スクリプトを実行し、差分を確かめる**

Run: `PYTHONUTF8=1 python scripts/feel_place.py`
Expected: 22 行が `placed`（6 ページ＋日本語 14 本＋英語 2 本）。
Run: `git diff --stat`
Expected: 22 ファイルがそれぞれ `2 +`（挿入 2 行・削除 0 行）。改行コードが変わっていれば数百行の差分になるので、その場合は `git checkout -- .` で戻してスクリプトを直す。
Run: 同じコマンドをもう一度 → Expected: 22 行とも `skip`（冪等）。

- [ ] **Step 4: 検査を回す**

Run: `node tests/feel_placement_test.mjs` → Expected: `ALL PASS`
Run: `PYTHONUTF8=1 python tests/feel_pages_test.py` → Expected: 全行が 375 / 1280 で `ok`、`ALL PASS`

- [ ] **Step 5: 画像を見る**

`ai-map_375.png` `salon_375.png` `novel-bench_375.png` `method-ja_375.png` `method-en_375.png` を見て、はがきが本文の幅に収まり、英語のノートでは英語で出ていることを確かめる。

- [ ] **Step 6: コミット**

```bash
git add scripts/feel_place.py ai-map.html salon.html ai-english.html toeic.html novel-bench.html hitoritabi/index.html method tests/feel_placement_test.mjs tests/feel_pages_test.py
git commit -m "feat(feel): 道具・学びのページと研究ノートの末尾にはがきを置く" -m "研究ノートを足したら scripts/feel_place.py を再実行する。漏れは tests/feel_placement_test.mjs が落ちて知らせる。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 公開と実測

このタスクで **サイトに公開する**（`main` への push）。計画の承認をもって公開の承認とする。

**Files:**
- Modify（生成物）: `site-index.json` 系・`llms.txt` `llms-full.txt` `feed.xml` `feed.json` `agent.html` `sitemap.xml` `sitemap-v2.xml`（`scripts/build_agent_view.py` と `scripts/generate_sitemap.py` が書くもの）
- Create（使い捨て、コミットしない）: `C:\tmp\feel_live_check.py`

- [ ] **Step 1: すべての検査を回す**

```bash
node tests/feel_core_test.mjs && node tests/feel_placement_test.mjs && PYTHONUTF8=1 python tests/feel_widget_test.py && PYTHONUTF8=1 python tests/feel_pages_test.py
```
Expected: 4 本とも `ALL PASS`。

- [ ] **Step 2: 機械向けの出力を作り直してコミットする**

```bash
PYTHONUTF8=1 python scripts/build_agent_view.py && PYTHONUTF8=1 python scripts/generate_sitemap.py && cp sitemap.xml sitemap-v2.xml
git status --short
```
Expected: 生成物だけが変わっている。差分を目で見て、`__DESC__` のようなプレースホルダが混ざっていないことを確かめる（`git diff llms.txt | grep -c "__"` が 0）。
```bash
git add -A -- '*.json' '*.txt' '*.xml' agent.html
git commit -m "chore(seo): 機械向け出力を作り直す" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: 最新の main を取り込む（マージ）**

```bash
git fetch origin
git merge --no-edit origin/main
```
Expected: 衝突なしで取り込めるか「Already up to date」。衝突したら、相手（別セッション）の変更を残したうえで、自分の差し込み行だけを足し直す。取り込んだら Step 1 の検査をもう一度すべて回す。
（rebase ではなく merge にする: ローカルの main にある設計書のコミットを祖先のまま残し、最後に main を早送りできるようにするため）

- [ ] **Step 4: push する（公開）**

```bash
git push origin HEAD:main
```
Expected: `feat/feelings-stamps -> main` の早送りで成功。拒否されたら Step 3 からやり直す（強制 push はしない）。

- [ ] **Step 5: 公開を待つ（バックグラウンド）**

Bash の `run_in_background: true` で実行する:
```bash
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w '%{http_code}' "https://yuichi916.github.io/assets/feel/feel.js?v=$i"); echo "$i $c"; [ "$c" = "200" ] && break; sleep 10; done
```
Expected: 10 分以内に `200`。

- [ ] **Step 6: 本番のページを確かめる**

```bash
for p in "" hyaku.html seikai.html kototsugi/ ehon.html sudoku.html shogi-puyo.html ai-map.html salon.html ai-english.html toeic.html novel-bench.html hitoritabi/ method/kansoku-suru-monogatari.html method/en/stories-that-watch-you.html; do printf "%-45s %s\n" "/$p" "$(curl -s "https://yuichi916.github.io/$p?v=$(date +%s)" | grep -c 'data-feel')"; done
```
Expected: どの行も 1 以上（トップはボードとはがきで 2）。

- [ ] **Step 7: GoatCounter が同じ人の 2 回を 1 と数えるかを実測する**

`C:\tmp\feel_live_check.py`（使い捨て。自動化用 Chrome の 9222 に、既存タブへ触らず自分のタブを 1 枚開く。前面には出さない）:
```python
# 公開後の実測: 同じブラウザから同じイベントを 2 回送り、公開カウンタが 1 になるかを見る
import sys
import time
import urllib.request

sys.path.insert(0, r"C:\tmp")
from cdp_tab import Tab  # noqa: E402

PATH = "feel/_test/dedupe"
t = Tab.open("https://yuichi916.github.io/?nofx=1")
t.wait("!!(window.goatcounter && window.goatcounter.count)", timeout=60)
for _ in range(2):
    t.js(f"window.goatcounter.count({{path: '{PATH}', title: '気持ちスタンプ 動作確認', event: true}}); true")
    time.sleep(5)
urllib.request.urlopen(f"http://127.0.0.1:9222/json/close/{t.id}", timeout=10)
print("sent twice:", PATH)
```
Run: `PYTHONUTF8=1 python C:/tmp/feel_live_check.py` → Expected: `sent twice: feel/_test/dedupe`
続けて `run_in_background: true` で 15 分まで見る:
```bash
for i in $(seq 1 15); do echo "$i $(curl -s 'https://viewsengineer.goatcounter.com/counter/feel%2F_test%2Fdedupe.json')"; sleep 60; done
```
Expected: `"count":"1"` になる。
- `"2"` になった場合: GoatCounter はイベントを毎回数えている。はがき側は同じブラウザで二重に押せないので実害はないが、設計書 3 章の「訪問者単位で数える」を「同じブラウザでは二重に押せない作りで守る」に直してコミットする
- 15 分たっても `"0"` の場合: この経路では数えられていない。自動化用 Chrome の状態（`navigator.webdriver`）と count.js の送信を調べ、原因をユーザーに報告する

- [ ] **Step 8: 手元の main を早送りする**

```bash
git -C C:/projects/yuichi916.github.io merge --ff-only origin/main
```
Expected: 早送りで成功。失敗した場合（別セッションが未 push のコミットを持っている）は何もせず、その旨をユーザーに伝える。worktree は `git worktree remove C:/tmp/wt-feelings` で片付ける。

- [ ] **Step 9: メモリを更新する**

`C:\Users\yuich\.claude\projects\C--Users-yuich\memory\feelings-stamps.md` の「次」を公開済みの状態に書き換える（公開日、コミットの範囲、GoatCounter の実測結果、`scripts/feel_place.py` の再実行ルール）。`MEMORY.md` の該当行も「公開済み」に直す。
