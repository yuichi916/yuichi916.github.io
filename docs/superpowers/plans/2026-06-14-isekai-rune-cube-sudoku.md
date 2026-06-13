# 異世界立体数独「ルーン・キューブ」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 宙に浮く N×N×N ラテンキューブ数独を、Three.js 単一HTMLで「立体でも見やすく操作しやすいUX」+「何度でも遊べるはまり要素」付きで `yuichi916.github.io/sudoku.html` として実装する。

**Architecture:** 純ロジック（`LatinCube`: 解生成・一意性ソルバ・パズル生成）を Node でTDD → `sudoku.html` 内にインライン化。Three.js で `CubeView`（回転/スライス/エクスプロード/レイキャスト）、素JSで `InputPalette` / `GameState` / `Progression` / `WorldTheme`。状態は localStorage。背景は Blender で KitBash キットからレンダした画像を世界解放で切替。

**Tech Stack:** HTML/CSS/JS 単一ファイル, Three.js (CDN r160+), localStorage, Blender (アセット), Playwright (視覚検証), Node (ロジックTDD)。

---

## File Structure

- Create: `C:\projects\yuichi916.github.io\sudoku.html` — ゲーム本体（単一ファイル）。
- Create: `C:\projects\yuichi916.github.io\_dev\latincube.mjs` — 開発時の純ロジック（Nodeテスト用、後で `sudoku.html` にインライン）。
- Create: `C:\projects\yuichi916.github.io\_dev\latincube.test.mjs` — ロジックのテスト。
- Create: `C:\projects\yuichi916.github.io\_blender\sudoku_worlds.py` — KitBashキットから背景レンダ。
- Create: `C:\projects\yuichi916.github.io\assets\sudoku\<world>\bg.jpg` — レンダ出力。
- Modify: `C:\projects\yuichi916.github.io\index.html` — №09 カード追加。

> 注: `latincube.mjs` のロジックは最終的に `sudoku.html` の `<script>` にコピーする。**唯一の正本は sudoku.html**。`_dev/` はTDD用の足場で、インライン化後はロジックを二重編集しない（コミット前 dup チェックで担保）。

---

## Task 1: LatinCube — 完全解の生成（純ロジックTDD）

**Files:**
- Create: `_dev/latincube.mjs`
- Test: `_dev/latincube.test.mjs`

ルール: N×N×N 配列 `g[i][j][k] ∈ 0..N-1`。X/Y/Z 各軸に平行な全ライン（軸を1つ固定して他2インデックスを止め、残り1つを 0..N-1 で走らせた N セル）が 0..N-1 の置換であること。

- [ ] **Step 1: 失敗するテストを書く**

```js
// _dev/latincube.test.mjs
import assert from 'node:assert';
import { makeSolution, isValidSolution } from './latincube.mjs';

function check(N) {
  const g = makeSolution(N, () => 0.5); // 決定的乱数
  assert.equal(g.length, N);
  assert.ok(isValidSolution(g, N), `N=${N} solution must satisfy all axis lines`);
}
for (const N of [3, 4, 5]) check(N);
console.log('Task1 OK');
```

- [ ] **Step 2: 失敗を確認**

Run: `node _dev/latincube.test.mjs`
Expected: FAIL（`makeSolution` 未定義 / モジュール未存在）

- [ ] **Step 3: 最小実装**

```js
// _dev/latincube.mjs
// g[i][j][k] = (i + j + k) mod N は3軸ラテン制約を満たす基本解。
// rng で「層インデックスの置換」と「記号の置換」を掛けて多様化する。
function permute(N, rng) {
  const a = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeSolution(N, rng = Math.random) {
  const pi = permute(N, rng); // i 方向の置換
  const pj = permute(N, rng); // j 方向の置換
  const pk = permute(N, rng); // k 方向の置換
  const sym = permute(N, rng); // 記号の置換
  const g = [];
  for (let i = 0; i < N; i++) {
    g[i] = [];
    for (let j = 0; j < N; j++) {
      g[i][j] = [];
      for (let k = 0; k < N; k++) {
        const base = (pi[i] + pj[j] + pk[k]) % N;
        g[i][j][k] = sym[base];
      }
    }
  }
  return g;
}

export function isValidSolution(g, N) {
  const lineOK = (vals) => {
    const seen = new Set(vals);
    return seen.size === N && [...seen].every((v) => v >= 0 && v < N);
  };
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const lx = [], ly = [], lz = [];
      for (let t = 0; t < N; t++) {
        lx.push(g[t][a][b]);
        ly.push(g[a][t][b]);
        lz.push(g[a][b][t]);
      }
      if (!lineOK(lx) || !lineOK(ly) || !lineOK(lz)) return false;
    }
  }
  return true;
}
```

- [ ] **Step 4: パス確認**

Run: `node _dev/latincube.test.mjs`
Expected: PASS（`Task1 OK`）

- [ ] **Step 5: コミット**

```bash
git add _dev/latincube.mjs _dev/latincube.test.mjs
git commit -m "feat: latin cube full-solution generator with axis-line validation"
```

---

## Task 2: 一意性ソルバ + パズル生成（純ロジックTDD）

**Files:**
- Modify: `_dev/latincube.mjs`
- Test: `_dev/latincube.test.mjs`

ソルバ: 空セル(`-1`)を制約伝播+バックトラックで充填。解の個数を最大2まで数える（一意性判定に2あれば十分）。生成: 完全解からセルをランダム順で `-1` にし、「一意のまま」の間だけ確定。

- [ ] **Step 1: 失敗するテストを追記**

```js
// _dev/latincube.test.mjs に追記
import { makePuzzle, countSolutions } from './latincube.mjs';

function rngSeq(seed) { // 決定的LCG
  let s = seed >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
}

for (const N of [3, 4]) {
  const rng = rngSeq(42);
  const { puzzle, solution } = makePuzzle(N, 'normal', rng);
  // 公開セルは solution と一致
  for (let i=0;i<N;i++) for (let j=0;j<N;j++) for (let k=0;k<N;k++) {
    if (puzzle[i][j][k] !== -1) assert.equal(puzzle[i][j][k], solution[i][j][k]);
  }
  // 一意解
  assert.equal(countSolutions(puzzle, N, 2), 1, `N=${N} puzzle must be unique`);
  // 少なくとも1つは空いている
  let blanks=0; for (let i=0;i<N;i++) for (let j=0;j<N;j++) for (let k=0;k<N;k++) if (puzzle[i][j][k]===-1) blanks++;
  assert.ok(blanks > 0);
}
console.log('Task2 OK');
```

- [ ] **Step 2: 失敗を確認**

Run: `node _dev/latincube.test.mjs`
Expected: FAIL（`makePuzzle`/`countSolutions` 未定義）

- [ ] **Step 3: 最小実装（追記）**

```js
// _dev/latincube.mjs に追記
// セル列挙ヘルパ: (i,j,k) -> フラットidx
const idx = (N, i, j, k) => (i * N + j) * N + k;

// 候補計算: あるセルに置ける記号集合（3ラインの既存値を除外）
function candidates(flat, N, i, j, k) {
  const used = new Set();
  for (let t = 0; t < N; t++) {
    const a = flat[idx(N, t, j, k)]; if (a >= 0) used.add(a);
    const b = flat[idx(N, i, t, k)]; if (b >= 0) used.add(b);
    const c = flat[idx(N, i, j, t)]; if (c >= 0) used.add(c);
  }
  const res = [];
  for (let v = 0; v < N; v++) if (!used.has(v)) res.push(v);
  return res;
}

// 解の個数を limit までカウント。flatは -1 を含む N^3 配列のコピーを使うこと。
export function countSolutions(grid3d, N, limit = 2) {
  const flat = new Int8Array(N * N * N);
  for (let i=0;i<N;i++) for (let j=0;j<N;j++) for (let k=0;k<N;k++) flat[idx(N,i,j,k)] = grid3d[i][j][k];
  let count = 0;
  function solve() {
    // 最小候補数のセルを選ぶ（MRV）
    let best = -1, bestC = null;
    for (let p = 0; p < flat.length; p++) {
      if (flat[p] !== -1) continue;
      const i = Math.floor(p / (N * N)), j = Math.floor((p % (N * N)) / N), k = p % N;
      const c = candidates(flat, N, i, j, k);
      if (c.length === 0) return; // 行き止まり
      if (bestC === null || c.length < bestC.length) { best = p; bestC = c; if (c.length === 1) break; }
    }
    if (best === -1) { count++; return; } // 空無し=完成
    const i = Math.floor(best / (N * N)), j = Math.floor((best % (N * N)) / N), k = best % N;
    for (const v of bestC) {
      flat[best] = v;
      solve();
      flat[best] = -1;
      if (count >= limit) return;
    }
  }
  solve();
  return count;
}

const BLANK_RATIO = { easy: 0.35, normal: 0.5, hard: 0.62 };

export function makePuzzle(N, difficulty = 'normal', rng = Math.random) {
  const solution = makeSolution(N, rng);
  const puzzle = solution.map((p) => p.map((r) => r.slice()));
  // 全セルをシャッフル順に走査し、一意のまま空けられるなら空ける
  const cells = [];
  for (let i=0;i<N;i++) for (let j=0;j<N;j++) for (let k=0;k<N;k++) cells.push([i,j,k]);
  for (let m = cells.length - 1; m > 0; m--) { const r = Math.floor(rng()*(m+1)); [cells[m],cells[r]]=[cells[r],cells[m]]; }
  const target = Math.floor(N*N*N * BLANK_RATIO[difficulty]);
  let blanks = 0;
  for (const [i,j,k] of cells) {
    if (blanks >= target) break;
    const keep = puzzle[i][j][k];
    puzzle[i][j][k] = -1;
    if (countSolutions(puzzle, N, 2) === 1) { blanks++; }
    else { puzzle[i][j][k] = keep; } // 多解になるので戻す
  }
  return { puzzle, solution };
}
```

- [ ] **Step 4: パス確認**

Run: `node _dev/latincube.test.mjs`
Expected: PASS（`Task1 OK` と `Task2 OK`）

- [ ] **Step 5: コミット**

```bash
git add _dev/latincube.mjs _dev/latincube.test.mjs
git commit -m "feat: unique-solution solver and puzzle carving for latin cube"
```

---

## Task 3: sudoku.html スケルトン + Three.js でキューブ描画

**Files:**
- Create: `sudoku.html`

`_dev/latincube.mjs` のロジックを `<script>` にインライン（`export` を外す）。N=3 のパズルを生成し、N³ のセルをガラスブロックとして空間配置・描画。固定ヒントセルはルーン記号スプライトを表示。

- [ ] **Step 1: 骨組みを書く**（CDN three.js、フルスクリーンcanvas、`LatinCube` ロジックをインライン、`THEME.runes`=色付きシンボル定義、`buildCube(N, puzzle)` でセルメッシュ生成。各セルは `BoxGeometry` + 半透明 `MeshStandardMaterial`。固定値セルは `CanvasTexture` でルーン文字を貼ったスプライトを中央に。`OrbitControls` で回転。`window.__game` にデバッグ用参照を公開）。

セル座標: `pos = (index - (N-1)/2) * SPACING`（SPACING≈1.25）。ライト: ambient + directional。背景: 暫定 `scene.background = new THREE.Color(0x0a0a1a)`。

- [ ] **Step 2: Playwrightで描画検証**

Run（Playwright MCP）: `file:///C:/projects/yuichi916.github.io/sudoku.html` を開き 1280×720 にリサイズ、2秒待ってスクリーンショット。
Expected: 暗い背景に半透明キューブ群と、いくつかのセルにルーン記号が見える。`browser_console_messages` にエラーが無い。

- [ ] **Step 3: コンソールエラーがあれば修正、再撮影**

Expected: エラー0、キューブが中央に表示。

- [ ] **Step 4: コミット**

```bash
git add sudoku.html
git commit -m "feat: render floating NxN latin cube with three.js"
```

---

## Task 4: セル選択（レイキャスト）+ 立体ガイド + 矛盾検出

**Files:**
- Modify: `sudoku.html`

クリック/タップでセルを選択。選択セルの X/Y/Z 3ラインのセルを発光（emissive 強調）。同記号セルも淡く強調。ライン内に重複があれば該当セルを赤 emissive で脈動（`requestAnimationFrame` で sin 明滅）。固定ヒントセルは選択不可。

- [ ] **Step 1: 実装**（`raycaster` でクリック → `selected={i,j,k}`。`highlightGuides(selected)`: 3ライン+同記号を色分け。`computeConflicts(state)`: 各ラインで重複値のセル集合を返す。アニメループで矛盾セルの emissiveIntensity を `0.5+0.5*sin(t)`）。

- [ ] **Step 2: Playwright検証**

Run: ページを開き、`browser_evaluate` で `window.__game.selectCell(0,0,0)` を呼び、スクリーンショット。
Expected: (0,0,0) を通る3本のラインが発光。意図的に重複を入れた状態（`__game.setCell` で同ライン2箇所同値）で赤脈動セルが見える。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: cell selection, 3-axis guide highlight, conflict pulse"
```

---

## Task 5: ルーン入力パレット + 候補メモ

**Files:**
- Modify: `sudoku.html`

セル選択時、PCは選択セル近傍に放射状ルーンパレット（HTML/CSSオーバーレイ、N+消去ボタン）、モバイル（`matchMedia('(max-width:768px)')`）は画面下ボトムシート。選んだ記号をセルに設定→ `state` 更新→再描画+矛盾再計算。長押し(>400ms)/右クリックで候補メモモード（小さな複数ルーンをセル面に格子表示）。

- [ ] **Step 1: 実装**（`InputPalette.open(cell, screenXY)`, `InputPalette.onPick(sym)`。候補は `state.notes[cellKey] = Set`。`setCell` は固定ヒントを上書きしない）。

- [ ] **Step 2: Playwright検証**

Run: セルクリック→パレットDOM出現を `browser_snapshot` で確認→ルーンボタンを `browser_click`→該当セルに記号反映をスクショ確認。モバイル幅(390×844)でボトムシート表示確認。
Expected: PC=放射パレット、モバイル=ボトムシート。記号設定が盤面に反映。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: radial/bottom-sheet rune input palette with pencil marks"
```

---

## Task 6: レイヤースライス + 軸切替 + エクスプロード

**Files:**
- Modify: `sudoku.html`

サイドの縦スライダー（0..N-1 + 「全表示」）で1層抽出: 選択層を不透明・正面向きに寄せ、他層を低 opacity ゴースト化。軸セレクタ(X/Y/Z)でスライス方向切替。「展開」トグルで層間隔を広げる（`SPACING` を層方向のみ拡大、Tween）。

- [ ] **Step 1: 実装**（`view.setSlice(axis, layer|null)`: 各セルmesh の opacity と表示/非表示を更新。`view.setExplode(on)`: 層オフセットを補間。スライダーUIはCSSオーバーレイ）。

- [ ] **Step 2: Playwright検証**

Run: `__game.view.setSlice('z', 1)` → スクショで中間層のみ明瞭・他層ゴースト確認。`__game.view.setExplode(true)` → 層分離確認。
Expected: 1層が平面的に読め、他は半透明。展開で全セル一望。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: layer slice slider, axis switch, explode view"
```

---

## Task 7: 回転/自転/ズーム + レスポンシブ

**Files:**
- Modify: `sudoku.html`

ドラッグ全方向回転（OrbitControls、パン無効）、放置3秒で微速自転（操作で停止）、ホイール/ピンチズーム（min/max距離クランプ）。`resize` 対応。モバイルのタッチで回転とタップ選択を区別（移動量しきい値）。

- [ ] **Step 1: 実装**（OrbitControls 設定、`enablePan=false`、`autoRotate` を idle タイマーで制御、`pointerdown→up` の移動量<6pxならクリック扱い）。

- [ ] **Step 2: Playwright検証**

Run: `browser_drag` でcanvasをドラッグ→回転前後スクショ差分確認。リサイズ(390×844 / 1280×720)で破綻が無いか撮影。
Expected: ドラッグで視点が回り、タップ選択と誤爆しない。レイアウト崩れ無し。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: orbit rotation, idle auto-spin, zoom, responsive touch"
```

---

## Task 8: GameState — タイマー/ミス/ヒント/クリア/★/保存

**Files:**
- Modify: `sudoku.html`

タイマー（mm:ss）、ミスカウント（矛盾を生む確定で+1）、ヒント（「魔法の導き」: 空セルを1つ正解で埋める、残数表示）。全充填+全制約OKでクリア演出（キューブ発光+紙吹雪+結果モーダル）。★算定: `3 - min(2, floor(mistakes/3) + hintsUsed>0?1:0)` 等。localStorage に進行（盤面/タイマー/設定）を保存し再開。

- [ ] **Step 1: 実装**（`GameState` オブジェクト: `start/tick/recordMistake/useHint/checkClear/serialize/restore`。`STORAGE_KEY='isekai_rune_cube_v1'`。設定: 記号/数字切替、音トグル）。

- [ ] **Step 2: Playwright検証**

Run: `__game.fillAllCorrect()`（テスト用: solution で全埋め）→ クリアモーダル出現+★表示スクショ。リロードして途中状態が復元されることを `__game.state` で確認。
Expected: クリア演出・★・ベストタイム記録。リロードで再開可能。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: timer, mistakes, hints, clear flow, star rating, persistence"
```

---

## Task 9: Progression — 難易度/デイリー/ストリーク/世界解放/実績/XP

**Files:**
- Modify: `sudoku.html`

スタート画面: 難易度（3/4/5 = 初級/中級/上級）、「デイリー」（日付シードで全員同一問題）。クリアで XP 加算→レベル、🔥ストリーク（連続日数）、実績バッジ（初クリア/ノーミス/各サイズ制覇/7日連続 等）。世界解放: 累計クリアで `闇のファンタジー→エンチャント→ヴァルハラ→トレジャーアイランド` をアンロックし選択可能に。結果シェアテキスト生成。

- [ ] **Step 1: 実装**（`Progression`: `xp/level/streak/lastПlayDate/unlockedWorlds/achievements`。日付シード = `YYYYMMDD` を `rngSeq` に。`onClear()` で各値更新+解放判定+トースト）。

> 実装注: 上記 `lastПlayDate` のような全角/キリル混入は禁止。識別子は ASCII の `lastPlayDate` を使う。

- [ ] **Step 2: Playwright検証**

Run: スタート画面の難易度ボタンを `browser_click`→対応サイズ生成確認。`__game.progression.onClear(...)` を複数回呼び XP/レベル/解放トーストをスクショ確認。
Expected: 難易度選択動作、クリアでXP・ストリーク・世界解放が進む。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: difficulty/daily/streak/world-unlock/achievements/xp progression"
```

---

## Task 10: WorldTheme — 背景画像切替

**Files:**
- Modify: `sudoku.html`

`assets/sudoku/<world>/bg.jpg` を `scene.background`（equirect なら `EquirectangularReflectionMapping`、平面なら CSS背景+透過canvas）に設定。解放済み世界から選択。画像未存在時は単色フォールバック。盤面の視認性のため背景は暗め/ぼかし前提。

- [ ] **Step 1: 実装**（`WorldTheme.apply(world)`: テクスチャロード（失敗時 `onError` でフォールバック色）。世界ごとに accent カラー（UI/ルーン発光色）も切替）。

- [ ] **Step 2: Playwright検証**（プレースホルダ画像を `assets/sudoku/dark/bg.jpg` に置いて）

Run: 世界切替UIで背景が変わるかスクショ。画像欠落時にフォールバック色になるか確認。
Expected: 背景切替動作、欠落時も破綻せず単色。

- [ ] **Step 3: コミット**

```bash
git add sudoku.html
git commit -m "feat: world theme background swap with fallback"
```

---

## Task 11: Blender アセットパイプライン（KitBash → 背景）

**Files:**
- Create: `_blender/sudoku_worlds.py`
- Create: `assets/sudoku/<world>/bg.jpg`

`P:\CG fanbook\3D assets` の各 KitBash キット（Dark Fantasy / Enchanted / Valhalla / Treasure Island BLENDER）を開き、カメラを引きで構え、Cycles でレンダ→ 暗め・軽くブラー（コンポジタ）で 2048×1024 程度の背景を出力。cabin.html の `eci_meditation_360.py` を参考に。

- [ ] **Step 1: スクリプト作成**（キットごとに `.blend` をオープン or append、ワールドライティング、カメラ配置、`render.filepath` を `assets/sudoku/<world>/bg.jpg`、`engine='CYCLES'`, samples 控えめ。被写界深度/Blur ノードで盤面が映える背景に）。

- [ ] **Step 2: レンダ実行**

Run: `& "<blender.exe>" -b -P _blender/sudoku_worlds.py`（または各キット毎にループ）。
Expected: `assets/sudoku/dark/bg.jpg` 等が生成。ハング時は memory `feedback_no_quality_compromise` に従い .blend をローカルコピーして再実行（妥協版で済ませない）。

- [ ] **Step 3: 視覚確認**

Run: Read で各 `bg.jpg` を開いて、暗め・盤面が映える構図か確認。だめなら Step1 調整。

- [ ] **Step 4: コミット**

```bash
git add _blender/sudoku_worlds.py assets/sudoku
git commit -m "feat: blender pipeline rendering kitbash world backgrounds"
```

---

## Task 12: index.html カード + 最終ポリッシュ + 重複チェック

**Files:**
- Modify: `index.html`
- Modify: `sudoku.html`

`index.html` に №09 として「異世界立体数独 ルーン・キューブ」カードを既存パターンで追加（リンク `sudoku.html`、サムネ/説明）。i18n（既存子ページの日英流儀があれば踏襲）。最終UIポリッシュ（チュートリアル初回オーバーレイ「ドラッグで回す/スライダーで層を見る/セルをタップしてルーン」）。

- [ ] **Step 1: index.html カード追加**（既存カードのDOM構造を Grep で確認し同形で挿入）。

- [ ] **Step 2: 初回チュートリアルオーバーレイ実装**（localStorage `tutorialSeen` で初回のみ）。

- [ ] **Step 3: 重複宣言チェック**

Run: `python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/sudoku.html`
Expected: exit 0。非0なら重複を解消（`Identifier X has already been declared` 事故防止）。

- [ ] **Step 4: 通し検証（Playwright）**

Run: index.html → カードクリック → sudoku.html 起動 → 難易度選択 → 数セル入力 → スライス → クリア(`fillAllCorrect`) の一連をスクショ。コンソールエラー0確認。
Expected: 全フロー動作、エラー無し。

- [ ] **Step 5: コミット & プッシュ**

```bash
git add index.html sudoku.html
git commit -m "feat: add isekai 3d sudoku page card, tutorial, final polish"
git push
```

---

## Self-Review メモ

- **Spec coverage**: コア(Task1-3) / 3D-UX 4機構(Task4,6,7) / 入力(Task5) / はまり要素(Task8,9) / アセット(Task10,11) / 統合(Task12) — spec の全節に対応タスクあり。
- **識別子整合**: `setCell`/`selectCell`/`setSlice`/`setExplode`/`onClear`/`fillAllCorrect` を全タスクで統一。`lastPlayDate` は ASCII。
- **単一ファイル正本**: ロジックは `_dev/` でTDD後 `sudoku.html` にインライン、二重編集しない。コミット前 dup チェックで担保。
