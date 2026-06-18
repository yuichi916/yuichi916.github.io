# 心を整える没入世界トップ再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `index.html` を「瞑想小屋→浮遊島の世界→各コンテンツを巡る」没入ゲートウェイに再構成し、散在バナーを統一カードグリッドに畳み込み、現トップは `journal.html` として残す。

**Architecture:** 単一HTMLファイル(`index.html`)の再構成。既存の SEO構造化データ / i18n切替 / GoatCounter / 訪問者カウント / reveal アニメ / `body.nofx` キャプチャ規約を保持しつつ、(1)世界ゲートウェイHero (2)統一カードグリッド「世界の地図」(3)世界観トーンに溶かした note/Manifesto/チャンネル に置き換える。Phase 2 で cabin↔niwa↔各ページの周遊を閉路化。

**Tech Stack:** プレーン HTML / CSS / バニラJS。検証は ripgrep（構造アサート）＋ Playwright MCP（デスクトップ1280px / モバイル390px のスクショ目視）。テストフレームワークは無い。

**Spec:** `docs/superpowers/specs/2026-06-18-immersive-world-home-redesign-design.md`

---

## File Structure

- **Create** `journal.html` — 現 `index.html` の無改変コピー（新聞版アーカイブ）。自己参照のみ最小調整。
- **Modify** `index.html` — フル再構成。`<head>`（SEO/i18n/analytics/fonts）と末尾の `<script>`（i18n辞書・langトグル・訪問者カウント・reveal・nofx）は温存し、`<body>` の各 `<section>` を差し替え。
- **Modify (Phase 2)** `cabin.html` — 「庭へ出る → niwa.html」出口を追加。
- **Modify (Phase 2)** `niwa.html` — `SECTION_PORTALS`（line ~721-735）に 立体数独/将棋ぷよ/TOEIC News/lingo を追加。
- **Modify (Phase 2)** `sudoku.html` `shogi-puyo.html` `salon.html` `toeic.html` 他 — 「← 庭にもどる(niwa)」戻りリンク追加。

> 注意（memory: validate_before_commit）: index.html は大型 single-file。各 commit 前に `python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html` を走らせ exit 0 を確認すること（const/function 重複宣言事故防止）。

---

## Phase 0 — バックアップ

### Task 0: 現トップを journal.html として保存しリンク到達可能にする

**Files:**
- Create: `journal.html`（`index.html` のコピー）
- Modify: `journal.html`（自己参照のみ）

- [ ] **Step 1: 無改変コピーを作成**

```bash
cd C:/projects/yuichi916.github.io
cp index.html journal.html
```

- [ ] **Step 2: journal.html の自己参照を調整**

`journal.html` 内で以下を変更:
- `<link rel="canonical" href="https://yuichi916.github.io/">` → `.../journal.html`
- `<meta property="og:url" content="https://yuichi916.github.io/">` → `.../journal.html`
- `<title>` 末尾に ` — 新聞版アーカイブ` を付す（重複コンテンツ回避の弱い差別化）
- `<head>` に `<meta name="robots" content="noindex,follow">` を追加（新トップと内容重複するため検索重複を避ける）

その他の内部リンク（`#featured` 等のアンカー、`cabin.html` 等の相対リンク）はそのままで動作するため変更不要。

- [ ] **Step 3: 検証（コピーが有効なHTMLで主要リンクが残る）**

Run:
```bash
cd C:/projects/yuichi916.github.io
rg -c "cabin.html|sudoku.html|hitoritabi/" journal.html
rg -n "canonical|robots" journal.html | head
```
Expected: コンテンツリンクが複数ヒット、canonical が journal.html、robots に noindex。

- [ ] **Step 4: Commit**

```bash
git add journal.html
git commit -m "feat: 現トップを journal.html として保存（新聞版アーカイブ）"
```

> journal.html への到達リンクは Task 4（読む節）と Task 5（フッター）で新 index 側に張る。

---

## Phase 1 — index.html フル再構成

### Task 1: 既存JSの把握とナビ/マストヘッド圧縮（破壊しないための土台）

**Files:**
- Read first: `index.html`（末尾 `<script>` 全体）
- Modify: `index.html`（`.masthead` 〜 `.titlebar`、line ~505-546）

- [ ] **Step 1: 既存スクリプトを読み、温存対象を確定**

Run: `rg -n "i18n|translations|langMenu|visitorCount|reveal|nofx|today|goatcounter" index.html`
確認すること: i18n辞書オブジェクト名、`data-i18n` / `data-i18n-html` の適用関数、訪問者カウント取得処理、`reveal` IntersectionObserver、`body.nofx` 判定。**これらの `<script>` と `<head>` は今回触らない**。差し替えるのは `<body>` の section 群のみ。

- [ ] **Step 2: ナビを6項目に圧縮**

`index.html` の `<nav class="nav">`（line ~529-545）を置換:

```html
<nav class="nav">
  <a href="#enter">世界に入る</a>
  <a href="#map">場所の地図</a>
  <a href="#library">読む</a>
  <a href="#about">About</a>
  <a href="https://note.com/views_of_life" target="_blank" rel="noopener">Note ↗</a>
</nav>
```

`.name`（マストヘッド見出し）は `Views Engineer<em>.</em>` のまま残す（庭師の署名として）。`.masthead` の issue 行 `VIEWS — ENGINEER — JOURNAL` は `A QUIET GARDEN — 心を整える庭` に変更（世界観トーン、§1ブランド溶かし込み）。

- [ ] **Step 3: 検証**

Run: `rg -n "JOURNAL|世界に入る|場所の地図" index.html`
Expected: 旧 `VIEWS — ENGINEER — JOURNAL` が消え、新ナビ項目がヒット。

- [ ] **Step 4: Commit**

```bash
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html
git add index.html && git commit -m "feat: ナビ6項目圧縮・マストヘッドを世界観トーンに"
```

---

### Task 2: 世界ゲートウェイ Hero に差し替え

**Files:**
- Modify: `index.html`（`<section class="front">` 全体、line ~549-593）

- [ ] **Step 1: front セクションをゲートウェイに置換**

`<section class="front">…</section>` を以下で置換。既存の `.front`/`.lead`/`.deck`/`.btn` CSSクラスを再利用（新規CSS最小化）。`data-i18n-html` は付けず日本語固定でよい（i18n辞書未整備の新コピーは英語化を Task 6 で追補）。

```html
<section class="front" id="enter">
  <div class="lead">
    <div class="kicker">A QUIET GARDEN · 心を整える庭</div>
    <h1 class="serif">
      <span class="row r1"><span>世界に入り、</span></span>
      <span class="row r2"><span><em>心</em> を 整える。</span></span>
    </h1>
    <p class="deck serif">
      焚き火と雨音の <strong>瞑想小屋</strong> から、雲の上に浮かぶ箱庭の世界へ。
      九つの場所を歩いて巡れば、<strong>音楽の宇宙</strong>・<strong>立体数独</strong>・
      ひとり旅の記録・本の書架へとたどり着く。急がず、ただ歩く。それだけの場所です。
    </p>
    <div class="actions">
      <a class="btn btn-primary" href="cabin.html">🛖 瞑想小屋から始める →</a>
      <a class="btn btn-ghost" href="niwa.html?scene=island">🪂 世界をすぐ歩く →</a>
    </div>
    <div class="byline">
      <span>Tended by Views Engineer / yuichi916</span>
      <span>Tokyo · 2026</span>
    </div>
  </div>

  <aside class="sidebar">
    <h6>はじめての方へ <span class="x">— guide</span></h6>
    <a class="item" href="cabin.html">
      <div class="num">STEP 01 / 小屋</div>
      <div class="ttl serif">焚き火の前で深呼吸。360°の小屋で心をほどく。</div>
    </a>
    <a class="item" href="niwa.html?scene=island">
      <div class="num">STEP 02 / 世界</div>
      <div class="ttl serif">WASD で浮遊島を歩き、九つの場所を巡る。</div>
    </a>
    <a class="item" href="#map">
      <div class="num">STEP 03 / 地図</div>
      <div class="ttl serif">行きたい場所へ直接。すべての入口の一覧。</div>
    </a>
    <div class="pull">
      <p class="serif">「急がなくていい。<br>ここでは、<span style="color:var(--accent)">歩くことそのもの</span> が目的だ。」</p>
      <div class="src">— 庭の入口にて</div>
    </div>
  </aside>
</section>
```

- [ ] **Step 2: 検証（Hero表示・CTA）**

Playwright MCP:
1. `browser_navigate` → `file:///C:/projects/yuichi916.github.io/index.html`
2. `browser_evaluate` → `document.body.classList.add('nofx')`（入場アニメ無効化）
3. `browser_resize` 1280×900 → `browser_take_screenshot` → 目視: 「世界に入り、心を整える。」見出し、2つのCTAが見えること。
Expected: ゲートウェイHeroが表示。旧「AI 時代 を、使い倒す側へ。」が無い。

- [ ] **Step 3: Commit**

```bash
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html
git add index.html && git commit -m "feat: 世界ゲートウェイHero（瞑想小屋→世界の入口）"
```

---

### Task 3: 統一カードグリッド「世界の地図」（バナー統一＋全コンテンツ整理）

**Files:**
- Modify: `index.html`
  - 削除: `cabin-cta`(~595-647) / `hitoritabi-cta`(~649以降) / `niwa-gate`(~857-876) / `sudoku-gate`(~878-897) / `shogi-gate`(~899-918) の各 section と、それらの専用 `<style>`（`.cabin-cta` 等、line ~751付近）。
  - 置換: 旧 `<section class="section" id="works">`（テキストDirectory, ~920-997）を新カードグリッドに。
  - 追加CSS: `.worldmap` グリッドとカード。

- [ ] **Step 1: カードグリッド用CSSを追加**

`</style>`（line ~501）直前に追記:

```css
/* ── World Map (unified content cards) ── */
.worldmap{display:grid;gap:0;border:1px solid var(--ink)}
.wm-cat{grid-column:1/-1;font-family:"JetBrains Mono",monospace;font-size:11px;
  letter-spacing:.25em;text-transform:uppercase;color:var(--accent);
  background:var(--paper-2);border-bottom:1px solid var(--ink);padding:12px 20px}
.wm-grid{display:grid;grid-template-columns:repeat(3,1fr)}
.wm-card{position:relative;display:flex;flex-direction:column;gap:8px;
  padding:24px 22px 22px;text-decoration:none;color:var(--ink);
  border-right:1px solid var(--ink);border-bottom:1px solid var(--ink);
  background:var(--card,linear-gradient(160deg,#1a1812,#3a3830));transition:transform .18s,filter .2s}
.wm-card:hover{filter:brightness(1.08);transform:translateY(-2px)}
.wm-card .emoji{font-size:34px;line-height:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.4))}
.wm-card .chip{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.18em;
  color:var(--paper);opacity:.85}
.wm-card .ttl{font-family:"Shippori Mincho",serif;font-weight:700;font-size:20px;
  line-height:1.35;color:var(--paper)}
.wm-card .dsc{font-size:12.5px;line-height:1.7;color:rgba(255,255,255,.8)}
.wm-card .go{margin-top:auto;font-family:"JetBrains Mono",monospace;font-size:11px;
  letter-spacing:.16em;color:var(--paper);opacity:.9}
.wm-card .badge{position:absolute;top:14px;right:14px;font-family:"JetBrains Mono",monospace;
  font-size:9px;letter-spacing:.14em;padding:3px 8px;border-radius:2px;color:#160a26;font-weight:700}
.badge.daily{background:#ffd36b}.badge.new{background:#7be0a0}.badge.upd{background:#9ec9ff}
@media(max-width:900px){.wm-grid{grid-template-columns:1fr}}
@media(max-width:620px){.wm-grid{grid-template-columns:1fr}}
```

- [ ] **Step 2: 散在バナー section と専用CSSを削除**

`<!-- ── CABIN CTA ── -->` から `shogi-gate` の `</section>`（~595〜918）までを丸ごと削除。あわせて `<style>` 内の `.cabin-cta`/`.hitoritabi-cta` 系の専用ルール（~751付近のブロック）も削除。
**注意**: Hero(front)・stamps・featured・manifesto は残す（順序は Task 4 で再配置）。

- [ ] **Step 3: 新カードグリッド section を挿入**

旧 `id="works"` の Directory（~920-997）を以下で置換。全11コンテンツを5カテゴリで掲載。`--card` でテーマ配色をインライン指定。

```html
<section class="section" id="map">
  <div class="section-head">
    <div class="section-eyebrow">№ 02 — World Map</div>
    <h2 class="section-title">世界の <em>地図</em>。</h2>
  </div>
  <div class="worldmap">

    <div class="wm-cat">🌿 整える — Calm</div>
    <div class="wm-grid">
      <a class="wm-card" style="--card:linear-gradient(160deg,#0a0608,#2a1a10 70%,#a85820)" href="cabin.html">
        <span class="badge new">入口</span>
        <div class="emoji">🛖</div><div class="chip">CABIN · 森の小屋</div>
        <div class="ttl">森の小屋（360°瞑想）</div>
        <div class="dsc">焚き火と雨音、深呼吸のための小さな小屋。世界への入口。</div>
        <div class="go">小屋に入る →</div>
      </a>
      <a class="wm-card" style="--card:linear-gradient(160deg,#0e1a26,#16293c 70%,#3a5a72)" href="niwa.html?scene=island">
        <div class="emoji">🪂</div><div class="chip">NIWA · 浮遊島</div>
        <div class="ttl">浮遊島を歩く</div>
        <div class="dsc">九つの場所がひと続きの3D箱庭。WASDで散策できる世界そのもの。</div>
        <div class="go">島へ渡る →</div>
      </a>
      <a class="wm-card" style="--card:linear-gradient(160deg,#12110c,#2e2c22 70%,#6b6759)" href="stopwatch.html">
        <div class="emoji">⏱</div><div class="chip">STOPWATCH · 時計</div>
        <div class="ttl">ストップウォッチ</div>
        <div class="dsc">ミリ秒精度のラップ・カウントダウン・世界時計。10カ国語対応。</div>
        <div class="go">計る →</div>
      </a>
    </div>

    <div class="wm-cat">🎮 遊ぶ — Play</div>
    <div class="wm-grid">
      <a class="wm-card" style="--card:linear-gradient(160deg,#0a0814,#1a1140 70%,#8a5bd6)" href="sudoku.html">
        <span class="badge daily">デイリー</span>
        <div class="emoji">🧊</div><div class="chip">RUNE CUBE · 立体数独</div>
        <div class="ttl">異世界立体数独 ルーン・キューブ</div>
        <div class="dsc">宙に浮く魔法のキューブに属性ルーンを並べる。デイリー＆ストリークで毎日。</div>
        <div class="go">挑戦する →</div>
      </a>
      <a class="wm-card" style="--card:linear-gradient(160deg,#150d06,#2a1d12 70%,#e0a93a)" href="shogi-puyo.html">
        <span class="badge new">NEW</span>
        <div class="emoji">♟️</div><div class="chip">SHOGI PUYO · 将棋ぷよ</div>
        <div class="ttl">将棋ぷよ「成」</div>
        <div class="dsc">駒を色に見立てた対戦パズル。連鎖と「成り」でお邪魔を送り、王を討て。</div>
        <div class="go">対局する →</div>
      </a>
      <a class="wm-card" style="--card:linear-gradient(160deg,#12100a,#33291a 70%,#b08b4a)" href="world.html">
        <div class="emoji">📜</div><div class="chip">MAP · 島の地図</div>
        <div class="ttl">浮遊島群の地図</div>
        <div class="dsc">羊皮紙の上に広がる島々を、地図としてたどる。</div>
        <div class="go">地図を開く →</div>
      </a>
    </div>

    <div class="wm-cat">📚 学ぶ — Learn</div>
    <div class="wm-grid">
      <a class="wm-card" style="--card:linear-gradient(160deg,#0c1410,#1d2e24 70%,#4a8f6a)" href="toeic.html">
        <div class="emoji">📚</div><div class="chip">TOEIC NEWS</div>
        <div class="ttl">TOEIC News</div>
        <div class="dsc">最新ニュースを題材にした Part5 英文法30問。AI検証済みクイズ＋動画。</div>
        <div class="go">解く →</div>
      </a>
      <a class="wm-card" style="--card:linear-gradient(160deg,#0c1014,#1d2730 70%,#4a7a9f)" href="toeic-practice.html">
        <div class="emoji">📝</div><div class="chip">TOEIC 模試</div>
        <div class="ttl">TOEIC 模試 200問</div>
        <div class="dsc">Part5/6/7を完全再現した2セット。ネイティブ音声・日本語訳・解説付き。</div>
        <div class="go">受ける →</div>
      </a>
      <a class="wm-card" style="--card:linear-gradient(160deg,#14100c,#302419 70%,#9f7a4a)" href="lingo.html">
        <div class="emoji">🗣</div><div class="chip">LINGO · 英語</div>
        <div class="ttl">lingo — YouTube英語</div>
        <div class="dsc">YouTube動画を英語×日本語の二言語字幕で。耳から英語に浸る。</div>
        <div class="go">見る →</div>
      </a>
    </div>

    <div class="wm-cat">🎵 聴く — Listen</div>
    <div class="wm-grid">
      <a class="wm-card" style="--card:linear-gradient(160deg,#0a0a14,#161636 70%,#5b5bd6)" href="salon.html">
        <div class="emoji">🎵</div><div class="chip">MUSIC UNIVERSE · 音の祠</div>
        <div class="ttl">音楽の宇宙</div>
        <div class="dsc">19,810アーティストのWebGL地図。好きな曲の隣で、まだ知らない音楽に出会う。</div>
        <div class="go">旅に出る →</div>
      </a>
    </div>

    <div class="wm-cat">🧳 旅する — Wander</div>
    <div class="wm-grid">
      <a class="wm-card" style="--card:linear-gradient(160deg,#1a120c,#3a2418 70%,#c2754a)" href="hitoritabi/">
        <div class="emoji">🧳</div><div class="chip">HITORITABI · 一人旅</div>
        <div class="ttl">一人旅フォトジャーナル</div>
        <div class="dsc">32の旅・約1700枚。世界を歩いて撮りためた写真と言葉の記録。</div>
        <div class="go">旅の記録へ →</div>
      </a>
    </div>

  </div>
</section>
```

- [ ] **Step 4: 検証（全11コンテンツ網羅・旧バナー消滅）**

Run:
```bash
cd C:/projects/yuichi916.github.io
for h in cabin.html "niwa.html?scene=island" stopwatch.html sudoku.html shogi-puyo.html world.html toeic.html toeic-practice.html lingo.html salon.html hitoritabi/; do rg -q "href=\"$h\"" index.html && echo "OK $h" || echo "MISSING $h"; done
rg -c "cabin-cta|hitoritabi-cta|niwa-gate|sudoku-gate|shogi-gate" index.html
```
Expected: 11件すべて `OK`、旧 *-cta/*-gate のヒット数 0。

Playwright: 1280px と 390px でスクショ → カードが整列し、デイリー/NEWバッジが見えること。

- [ ] **Step 5: Commit**

```bash
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html
git add index.html && git commit -m "feat: 散在バナーを統一カードグリッド『世界の地図』へ（全11コンテンツ整理）"
```

---

### Task 4: 「読む／本の宇宙」節（Featured note + Manifesto + journal リンク）

**Files:**
- Modify: `index.html`（`#featured`(~813-841) と `#manifesto`(~843-854) を `#map` の後ろへ移動し、見出しを世界観トーンに。journal.html リンク追加）

- [ ] **Step 1: featured/manifesto を #map の後ろに再配置し見出し調整**

`#featured` section を `id="library"` を持つラッパへ寄せる。最小改修として:
- `#featured` の eyebrow `№ 01 — Featured Article` → `№ 03 — 月光の書架 · 読む`
- `#manifesto` の eyebrow `№ 02 — Manifesto` → `№ 04 — Manifesto`
- `#featured` section の開きタグに `id` を `library` へ統合するため、Hero直後にあった featured/manifesto を **DOM順で #map の直後**に来るよう移動（front → stamps → #map(Task3) → #featured → #manifesto → channels → about → closer）。

`#featured` の `<section class="section" id="featured">` を `<section class="section" id="library">`（旧 #featured の中身は維持、`#featured` アンカーは使わないので id 変更でよい。ナビは Task1 で `#library` を指す）。

- [ ] **Step 2: journal.html へのリンクを Manifesto 末尾に追加**

`#manifesto` の `.cols` 直後（`</section>` 前）に追記:

```html
<p style="margin-top:32px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.08em;color:var(--ink-3)">
  かつてこの庭は一枚の新聞だった。
  <a href="journal.html" style="color:var(--accent);text-decoration:underline">▸ 新聞版（旧トップ）を読む</a>
</p>
```

- [ ] **Step 3: 検証**

Run: `rg -n "id=\"library\"|journal.html|月光の書架" index.html`
Expected: `id="library"` が存在、journal.html リンクあり、eyebrow更新済み。

- [ ] **Step 4: Commit**

```bash
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html
git add index.html && git commit -m "feat: Featured/Manifestoを『読む・月光の書架』に再配置＋journal.htmlリンク"
```

---

### Task 5: チャンネル集約・About/Closer/Footer・stamps の数字修正

**Files:**
- Modify: `index.html`（旧 Directory 内の note/YouTube/GitHub/X 5行(~926-960)を「世界の外の窓」ブロックとして再利用 / `#about`(~999) / `.closer`(~1027) / `.footer` / stamps(~805-811)）

- [ ] **Step 1: チャンネル「世界の外の窓」ブロックを about の手前に作成**

旧 Directory の note/YouTube/GitHub/X 5行（`.dir-row` の外部リンク5つ）は Task3 で id="works" ごと消えているため、新規に小ブロックを about 直前へ挿入。既存 `.dir-row`/`.directory` CSS を再利用:

```html
<section class="section" id="windows">
  <div class="section-head">
    <div class="section-eyebrow">№ 05 — 世界の外の窓</div>
    <h2 class="section-title">外の <em>窓</em> から。</h2>
  </div>
  <div class="directory">
    <a class="dir-row" href="https://note.com/views_of_life" target="_blank" rel="noopener">
      <div class="ix">01</div><div class="name serif">Note</div>
      <div class="desc">AIと問題解決を100年単位で掘り下げる長文。本の宇宙の本体。</div>
      <div class="handle">/views_of_life</div><div class="arr">→</div></a>
    <a class="dir-row" href="https://www.youtube.com/@zundamon_ai_lab" target="_blank" rel="noopener">
      <div class="ix">02</div><div class="name serif">YouTube</div>
      <div class="desc">ずんだもんのAIラボ — 解説 Shorts を連載。</div>
      <div class="handle">@zundamon_ai_lab</div><div class="arr">→</div></a>
    <a class="dir-row" href="https://github.com/yuichi916" target="_blank" rel="noopener">
      <div class="ix">03</div><div class="name serif">GitHub</div>
      <div class="desc">この庭と各コンテンツのソースコード・自動化スクリプト。</div>
      <div class="handle">@yuichi916</div><div class="arr">→</div></a>
    <a class="dir-row" href="https://x.com/ViewsEngineer" target="_blank" rel="noopener">
      <div class="ix">04</div><div class="name serif">X · 個人</div>
      <div class="desc">AIと問題解決の実験録。短文の独り言。</div>
      <div class="handle">@ViewsEngineer</div><div class="arr">→</div></a>
    <a class="dir-row" href="https://x.com/ZundamonAILab" target="_blank" rel="noopener">
      <div class="ix">05</div><div class="name serif">X · AIラボ</div>
      <div class="desc">ずんだもんのAIラボ公式。動画告知と短文解説。</div>
      <div class="handle">@ZundamonAILab</div><div class="arr">→</div></a>
  </div>
</section>
```

- [ ] **Step 2: stamps の数字を実態に修正**

stamps（~805-811）を更新。`data-i18n` は残しても表示テキストを実態へ:
- `Channels 5+` → `Places 11`（`data-i18n="stamp.l1"` の値表示を `Places`、`.n` を `11`）
- `Time-range 100年` は維持 / `Stack 4 tools` 維持 / `Operator 1人` 維持 / `Visitors` 維持（`#visitorCount` はそのまま）

該当の `<div class="n">5+</div>` → `<div class="n">11</div>`、隣接ラベル `Channels` → `Places`。

- [ ] **Step 3: About / Closer のトーン微調整**

- `#about` eyebrow `№ 04 — About the Author` → `№ 06 — 庭師について`
- `.closer` 見出し `使い倒す側 に、来ないか。` → `この庭を、<em>気ままに</em><br>歩いていって。`（`data-i18n-html="closer.title"` は残し表示文を更新）
- `.closer` の本文・CTAは現状維持（note/X）。

- [ ] **Step 4: フッターに journal リンク追加**

`.footer` の右側リンク群（`.right`）に追加:
```html
<a href="journal.html">新聞版アーカイブ</a>
```

- [ ] **Step 5: 検証（数字不整合の一掃）**

Run:
```bash
cd C:/projects/yuichi916.github.io
rg -n "5 つの活動の場|5つの場所|Channels|5\+" index.html
rg -n "id=\"windows\"|Places|新聞版アーカイブ" index.html
```
Expected: 1つ目（旧数字）= ヒット0。2つ目 = いずれもヒット。
（注: Hero副CTA `5 つの活動の場` は Task2 で既に消えているはず。残っていればここで修正）

- [ ] **Step 6: Commit**

```bash
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html
git add index.html && git commit -m "feat: チャンネルを『外の窓』に集約・stamps数字修正・About/Closer世界観化・footerにjournal"
```

---

### Task 6: i18n 整合・全体検証（デスクトップ/モバイル）

**Files:**
- Modify: `index.html`（i18n辞書: 変更した既存キーの訳文、または不要キー除去）

- [ ] **Step 1: i18n の破綻チェックと最小整合**

Run: `rg -n "data-i18n" index.html | rg -v "data-i18n-html" | head -40`
新コピーで残した `data-i18n*` 属性（closer.title 等）について、i18n辞書（Task1 Step1で把握した辞書オブジェクト）の対応キーの **ja 訳を新表示文に合わせて更新**。削除した section（front.title 等の旧キー）が辞書に残っていても実害は無いが、`directory.title`(5つの場所) 等 **画面に出ない旧キーで誤訳が残らないよう ja を実態へ**。新規に増やしたカード文言は日本語固定（属性なし）で可。EN等は最低限 ja フォールバックで崩れないことを確認。

- [ ] **Step 2: 言語切替が壊れていないことを確認**

Playwright:
1. `browser_navigate` → index.html、`browser_evaluate` → `document.body.classList.add('nofx')`
2. langトグルで EN に切替（`browser_click` #langToggle → English）
3. `browser_take_screenshot` → 文字化け・空欄が無いか目視。ja に戻して再確認。

- [ ] **Step 3: コンソールエラー・訪問者カウント確認**

`browser_console_messages` → 致命的エラーが無いこと。`#visitorCount` が `—` 以外 or 既存挙動どおりであること。

- [ ] **Step 4: レスポンシブ目視（最終）**

`browser_resize` を 1280×900 と 390×850 で各 `browser_take_screenshot`。確認: Hero / 世界の地図カード（モバイルで1列） / 読む / 外の窓 / Closer が破綻なく縦に流れる。

- [ ] **Step 5: Commit**

```bash
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/index.html
git add index.html && git commit -m "fix: i18n辞書のja訳を新トップに整合・全体レスポンシブ検証"
```

---

## Phase 2 — 世界の周遊配線（cabin↔niwa↔各ページ）

### Task 7: cabin.html に「庭へ出る → niwa」出口を追加

**Files:**
- Modify: `cabin.html`（`.brand`(~871) 付近のナビ、または小屋UIのどこかに niwa への導線）

- [ ] **Step 1: niwa への出口リンクを追加**

`cabin.html` のヘッダ `.brand`（HOME 相当）付近に、niwa への明示リンクを追加。既存の `<a class="brand" href="index.html">` の隣に:

```html
<a class="brand" href="niwa.html?scene=takibi" title="庭へ出る" style="margin-left:14px"><span class="lantern-dot"></span> 庭へ出る</a>
```
（`scene=takibi`＝焚き火の森＝小屋の所在地に出る。なければ `niwa.html` 単体でよい。）

- [ ] **Step 2: 検証**

Run: `rg -n "niwa.html" cabin.html`
Expected: niwa への出口リンクがヒット。

- [ ] **Step 3: Commit**

```bash
git add cabin.html && git commit -m "feat(cabin): 小屋から庭(niwa)へ出る導線を追加"
```

---

### Task 8: niwa.html のポータルに 立体数独/将棋ぷよ/TOEIC News/lingo を追加

**Files:**
- Modify: `niwa.html`（`SECTION_PORTALS`、line ~721-735）

- [ ] **Step 1: 既存ポータル構造を確認**

Run: `rg -n "label:|href:|SECTION_PORTALS|scene-tab|SCENE_POS" niwa.html | head -40`
確認: portal定義の正確なキー名・スキーマ（`{label, href, ...}`）、scene一覧、空きセル（plaza/heya/hoshi_int 等は外部誘導なし）。

- [ ] **Step 2: 4コンテンツのポータルを追加**

`SECTION_PORTALS`（~718-735）に、既存スキーマに合わせて追記。割当て先は新規ジオメトリを作らず既存セルに相乗り or 未使用方角を使う（Step1の結果で確定。例: `heya` を将棋ぷよ、`plaza` の副ポータル等）。最小実装として既存の各 portal オブジェクトと同形で:

```js
  // v?? — 新コンテンツのポータル（既存スキーマに準拠。割当てセルはStep1で確定）
  sudoku:  { label: '立体数独へ', href: 'sudoku.html',
             /* 既存portalと同じ追加プロパティ（color/icon等があれば踏襲） */ },
  shogi:   { label: '将棋ぷよへ', href: 'shogi-puyo.html' },
  toeicn:  { label: 'TOEIC Newsへ', href: 'toeic.html' },
  lingo:   { label: 'lingo（英語）へ', href: 'lingo.html' },
```
※ niwa が portal を「scene名キー」で引く設計なら、対応する scene を持つキー名に合わせること（Step1で判明したキー命名に従う）。新 scene を足さない方針なら、既存 scene の portal を「複数行き先」に拡張するか、`scene-tabs` に行き先リンクを併記する形でよい。

- [ ] **Step 3: 検証（リンク到達 + 実描画）**

Run: `rg -n "sudoku.html|shogi-puyo.html|toeic.html|lingo.html" niwa.html`
Expected: 4件ヒット。

Playwright: `browser_navigate` → niwa.html、`browser_console_messages` で致命的エラーが無いこと、scene切替/ポータルUIが従来どおり出ることをスクショ目視（memory: 3Dは重複宣言・描画破綻に注意）。

- [ ] **Step 4: Commit**

```bash
git add niwa.html && git commit -m "feat(niwa): 立体数独/将棋ぷよ/TOEIC News/lingo を世界のポータルに追加"
```

---

### Task 9: 主要コンテンツページに「庭にもどる(niwa)」戻りリンクを追加

**Files:**
- Modify: `sudoku.html` `shogi-puyo.html` `salon.html` `toeic.html` `toeic-practice.html` `stopwatch.html` `world.html` `lingo.html` `hitoritabi/index.html`（各ページの既存「HOME/戻る」UI付近）

- [ ] **Step 1: 各ページの既存戻りUIを把握**

Run: `rg -n "href=\"index.html\"|← *HOME|もどる|戻る|class=\"brand\"" sudoku.html shogi-puyo.html salon.html toeic.html toeic-practice.html stopwatch.html world.html lingo.html hitoritabi/index.html`
各ページで index.html へ戻るリンクの位置を確認。

- [ ] **Step 2: niwa への戻りリンクを併設**

各ページの index.html 戻りリンクの隣に、邪魔にならない形で追加（例。各ページの既存スタイルに馴染ませる）:

```html
<a href="niwa.html" title="庭にもどる">🪂 庭にもどる</a>
```
ゲーム系(sudoku/shogi)はプレイUIを塞がない隅に。SEOページ(stopwatch/toeic)はヘッダ/フッタの既存ナビ内に。**各ページ個別にスタイル整合**させること（一律挿入で崩さない）。

- [ ] **Step 3: 検証**

Run: `rg -c "niwa.html" sudoku.html shogi-puyo.html salon.html toeic.html toeic-practice.html stopwatch.html world.html lingo.html hitoritabi/index.html`
Expected: 各ファイル ≥1。
Playwright で2-3ページを開きリンクが見え機能することを目視。

- [ ] **Step 4: Commit（ページ単位で分割可）**

```bash
git add <該当ファイル> && git commit -m "feat: 各コンテンツページに『庭にもどる(niwa)』戻り導線を追加"
```

---

## Self-Review（記入済み）

**Spec coverage:**
- §1コンセプト/ハイブリッド/ブランド溶かし込み → Task1,2,4（Hero・トーン・library）
- §3 整理(5カテゴリ全11) → Task3
- §4① ゲートウェイHero → Task2 / §4② 統一グリッド → Task3 / §4③ 読む → Task4 / §4④ チャンネル集約 → Task5 / ナビ圧縮・数字修正 → Task1,Task5
- §5 リピート施策（デイリー/NEWバッジ）→ Task3 / 周遊閉路化 → Task7,8,9 / SEO維持 → head温存（Task1 Step1）
- §6 Phase0/1/2 → Task0 / Task1-6 / Task7-9
- §8 受け入れ基準 → 各Taskの検証Stepで担保（journal到達=Task0,4,5／全11=Task3／ナビ6=Task1／数字=Task5／i18n・カウント=Task6）

**Placeholder scan:** Task8 の portal 追加プロパティは「既存スキーマに準拠」とし、Step1で実構造を確認してから埋める設計（niwa の正確な portal スキーマは実装時読取りが必要なため、確認手順を明示）。それ以外は具体コードを記載。

**Type/命名整合:** `.wm-card`/`.worldmap`/`.wm-grid`/`.wm-cat`/`.badge`(daily/new/upd) を Task3 で定義し他で流用。section id: `enter`(Hero)/`map`(グリッド)/`library`(読む)/`windows`(チャンネル)/`about`/ で統一、ナビ(Task1)と一致。

**未確定の実装時確認事項（プラン内で手順化済み）:**
- index.html 末尾 `<script>` の i18n 辞書オブジェクト名・適用関数（Task1 Step1, Task6 Step1）
- niwa.html の portal スキーマと scene 割当て（Task8 Step1）
- 各コンテンツページの既存戻りUIスタイル（Task9 Step1）
