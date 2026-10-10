// ならべる派の盤: 横2マスのカーソルで入れ替え、縦横3つ以上で消える。盤は下からせり上がる。
// 24行×6列。y=0..11 は隠し（おじゃま出現域）、y=12..23 が見える範囲。
// C: 0=空 1〜5=色 9=おじゃま / S: 0=静止 1=消去中 2=落下中 3=浮遊中 / F: 連鎖フラグ / Gd: おじゃまブロックID
// 浮遊: 支えを失ったパネルは少し浮いてから落ちる。その間に下へパネルを差し込むと受け止められ、
// 連鎖フラグを持ったままそろえば連鎖が続く（アクティブ連鎖）。
import { createRng } from './rng.js';
import { naraberuDamage } from './damage.js';

export const COLS = 6;
export const ROWS = 24;
export const TOP = 12;
export const BOTTOM = 23;
export const GARB = 9;
const N = COLS * ROWS;
const LETTER = { '.': 0, R: 1, G: 2, B: 3, Y: 4, P: 5 };

const isColor = c => c >= 1 && c <= 5;

// 3つ以上の並びを持つセル番号の集合（cand(i) が真のセルだけで判定）
function findRuns(C, cand) {
  const hit = new Set();
  for (let y = 0; y < ROWS; y++) {
    let run = 1;
    for (let x = 1; x <= COLS; x++) {
      const i = y * COLS + x;
      const same = x < COLS && cand(i) && cand(i - 1) && C[i] === C[i - 1];
      if (same) run++;
      else {
        if (run >= 3) for (let k = 1; k <= run; k++) hit.add(y * COLS + x - k);
        run = 1;
      }
    }
  }
  for (let x = 0; x < COLS; x++) {
    let run = 1;
    for (let y = 1; y <= ROWS; y++) {
      const i = y * COLS + x;
      const same = y < ROWS && cand(i) && cand(i - COLS) && C[i] === C[i - COLS];
      if (same) run++;
      else {
        if (run >= 3) for (let k = 1; k <= run; k++) hit.add((y - k) * COLS + x);
        run = 1;
      }
    }
  }
  return hit;
}

export function createNaraberu({ cfg, seed, takeGarbage }) {
  const rng = createRng(seed);
  // 消去: 光る(flash) → 驚いた顔(face) → 左上から1枚ずつはじける(pop)。全部はじけたら消える
  const FL = cfg.naraberuClearFlash, FA = cfg.naraberuClearFace, PO = cfg.naraberuClearPop;
  const clearTime = n => FL + FA + n * PO;
  const graceMax = Math.round(cfg.topGraceSec * 60);
  const hoverChain = cfg.naraberuHoverFrames, hoverSwap = cfg.naraberuSwapHoverFrames;

  const B = {
    kind: 'naraberu',
    C: new Int8Array(N),
    S: new Uint8Array(N),
    T: new Int16Array(N),
    F: new Uint8Array(N),
    Gd: new Int16Array(N),
    K: new Uint8Array(N), // 連鎖の2段目以降で消去中のセル（連鎖が続いている印）
    Q: new Uint8Array(N), // 消去中のセルが何枚目にはじけるか（0から）
    TT: new Int16Array(N), // その消去の全体の刻み数（演出が経過を知るため）
    blocks: new Map(),
    nextGid: 1,
    preview: new Int8Array(COLS),
    cursor: { x: 2, y: 18 },
    rise: 0,
    riseCount: 0,
    chain: 0,
    grace: graceMax,
    graceMax,
    stop: 0, // 停止時間（刻み）: 同時消し・連鎖のあと、せり上がりと天井の猶予が止まる
    frame: 0,
    dead: false,
    isDead: () => B.dead,
    step,
    addBlock,
  };

  // 初期盤: 各列 startRows-1〜+1 段、そろいなし。
  // 開幕の一撃で決まらないよう、1手で2連鎖以上・2手で3連鎖以上が起きる並びは作り直す。
  for (let tries = 0; tries < 60; tries++) {
    B.C.fill(0);
    for (let x = 0; x < COLS; x++) {
      const h = cfg.naraberuStartRows - 1 + rng.int(3);
      for (let k = 0; k < h; k++) B.C[(BOTTOM - k) * COLS + x] = -1;
    }
    for (let y = BOTTOM; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (B.C[i] === -1) B.C[i] = pickColor(x, y);
      }
    }
    if (quietOpening(B.C, cfg)) break;
  }
  makePreview();

  function pickColor(x, y) {
    const C = B.C;
    const bad = new Set();
    if (x >= 2 && C[y * COLS + x - 1] === C[y * COLS + x - 2] && isColor(C[y * COLS + x - 1])) bad.add(C[y * COLS + x - 1]);
    if (x <= COLS - 3 && C[y * COLS + x + 1] === C[y * COLS + x + 2] && isColor(C[y * COLS + x + 1])) bad.add(C[y * COLS + x + 1]);
    if (y <= ROWS - 3 && C[(y + 1) * COLS + x] === C[(y + 2) * COLS + x] && isColor(C[(y + 1) * COLS + x])) bad.add(C[(y + 1) * COLS + x]);
    let c;
    do { c = rng.int(cfg.colorsN) + 1; } while (bad.has(c));
    return c;
  }

  function makePreview() {
    const p = B.preview;
    for (let x = 0; x < COLS; x++) {
      const bad = new Set();
      if (x >= 2 && p[x - 1] === p[x - 2]) bad.add(p[x - 1]);
      const a = B.C[BOTTOM * COLS + x], b2 = B.C[(BOTTOM - 1) * COLS + x];
      if (isColor(a) && a === b2) bad.add(a);
      let c;
      do { c = rng.int(cfg.colorsN) + 1; } while (bad.has(c));
      p[x] = c;
    }
  }

  function addBlock(x, y, w, h) {
    const id = B.nextGid++;
    B.blocks.set(id, { id, x, y, w, h, thaw: 0, thawTotal: 0, reveal: null });
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * COLS + xx;
        B.C[i] = GARB; B.Gd[i] = id; B.S[i] = 0; B.F[i] = 0;
      }
    }
    return id;
  }

  const swappable = i => B.S[i] === 0 && B.Gd[i] === 0 && B.C[i] !== GARB;

  function anyActive() {
    let clearing = false, falling = false, flagged = false, chainClearing = false;
    for (let i = 0; i < N; i++) {
      if (B.S[i] === 1) { clearing = true; if (B.K[i]) chainClearing = true; }
      else if (B.S[i] === 2 || B.S[i] === 3) falling = true;
      if (B.F[i]) flagged = true;
    }
    let thawing = false;
    for (const b of B.blocks.values()) if (b.thaw > 0) thawing = true;
    return { clearing, falling, flagged, thawing, chainClearing };
  }

  function riseFramesNow() {
    const t = Math.min(1, B.frame / 60 / cfg.naraberuRiseRampSec);
    const sec = cfg.naraberuRiseStartSec + (cfg.naraberuRiseEndSec - cfg.naraberuRiseStartSec) * t;
    return Math.max(1, sec * 60);
  }

  // 隠し行の最上段にものがあると、せり上げで押し出して欠けてしまう
  function hiddenTopBusy() {
    for (let x = 0; x < COLS; x++) if (B.C[x] !== 0) return true;
    for (const b of B.blocks.values()) if (b.y <= 0) return true;
    return false;
  }

  function topOccupied() {
    for (let x = 0; x < COLS; x++) if (B.C[TOP * COLS + x] !== 0) return true;
    return false;
  }

  function shiftUp() {
    for (let y = 0; y < BOTTOM; y++) {
      for (let x = 0; x < COLS; x++) {
        const d = y * COLS + x, s = d + COLS;
        B.C[d] = B.C[s]; B.S[d] = B.S[s]; B.T[d] = B.T[s]; B.F[d] = B.F[s]; B.Gd[d] = B.Gd[s]; B.K[d] = B.K[s];
        B.Q[d] = B.Q[s]; B.TT[d] = B.TT[s];
      }
    }
    for (let x = 0; x < COLS; x++) {
      const i = BOTTOM * COLS + x;
      B.C[i] = B.preview[x]; B.S[i] = 0; B.T[i] = 0; B.F[i] = 0; B.Gd[i] = 0; B.K[i] = 0; B.Q[i] = 0; B.TT[i] = 0;
    }
    for (const b of B.blocks.values()) b.y--;
    makePreview();
    B.cursor.y = Math.max(TOP, B.cursor.y - 1);
    B.riseCount++;
  }

  function move(s, d) {
    B.C[d] = B.C[s]; B.S[d] = B.S[s]; B.T[d] = B.T[s]; B.F[d] = B.F[s]; B.Gd[d] = B.Gd[s]; B.K[d] = B.K[s];
    B.Q[d] = B.Q[s]; B.TT[d] = B.TT[s];
    B.C[s] = 0; B.S[s] = 0; B.T[s] = 0; B.F[s] = 0; B.Gd[s] = 0; B.K[s] = 0; B.Q[s] = 0; B.TT[s] = 0;
  }

  // 浮遊を始める: そのパネルと、上に積み重なった静止パネルをまとめて浮かせる
  function startHover(i, frames) {
    for (let j = i; j >= 0 && isColor(B.C[j]) && B.S[j] === 0 && !B.Gd[j]; j -= COLS) { B.S[j] = 3; B.T[j] = frames; }
  }

  function gravity() {
    const moved = new Uint8Array(N);
    const vacated = new Uint8Array(N); // この刻みで下へ動いて空いたマス（上のパネルはそのままついて落ちる）
    const blocksByBottom = new Map();
    for (const b of B.blocks.values()) {
      const bot = b.y + b.h - 1;
      if (!blocksByBottom.has(bot)) blocksByBottom.set(bot, []);
      blocksByBottom.get(bot).push(b);
    }
    const fall = i => { move(i, i + COLS); B.S[i + COLS] = 2; B.T[i + COLS] = 0; moved[i + COLS] = 1; vacated[i] = 1; };
    for (let y = BOTTOM - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x, below = i + COLS;
        if (!isColor(B.C[i]) || B.S[i] === 1) continue;
        if (B.C[below] !== 0) {
          // 浮遊中に、止まっているものが下に入った＝受け止められた
          if (B.S[i] === 3 && B.S[below] !== 2 && B.S[below] !== 3) { B.S[i] = 0; B.T[i] = 0; }
          continue;
        }
        if (B.S[i] === 2 || vacated[below]) fall(i);
        else if (B.S[i] === 0) startHover(i, B.F[i] ? hoverChain : hoverSwap);
        else if (B.S[i] === 3 && --B.T[i] <= 0) fall(i);
      }
      for (const b of blocksByBottom.get(y) || []) {
        if (b.thaw > 0) continue;
        let ok = true;
        for (let x = b.x; x < b.x + b.w; x++) if (B.C[(y + 1) * COLS + x] !== 0) ok = false;
        if (!ok) continue;
        for (let yy = y; yy >= b.y; yy--) {
          for (let x = b.x; x < b.x + b.w; x++) move(yy * COLS + x, (yy + 1) * COLS + x);
        }
        for (let x = b.x; x < b.x + b.w; x++) vacated[b.y * COLS + x] = 1;
        b.y++;
      }
    }
    // 動かなかった落下中パネルは着地
    for (let i = 0; i < N; i++) if (B.S[i] === 2 && !moved[i]) B.S[i] = 0;
  }

  function finishTimers(ev) {
    const removed = [];
    for (let i = 0; i < N; i++) {
      if (B.S[i] !== 1) continue;
      B.T[i]--;
      const el = B.TT[i] - B.T[i];
      if (el === FL + FA + B.Q[i] * PO) ev.push({ type: 'popcell', i, c: B.C[i], k: B.Q[i] });
      if (B.T[i] <= 0) removed.push(i);
    }
    for (const i of removed) { B.C[i] = 0; B.S[i] = 0; B.F[i] = 0; B.T[i] = 0; B.K[i] = 0; B.Q[i] = 0; B.TT[i] = 0; }
    for (const i of removed) {
      for (let j = i - COLS; j >= 0; j -= COLS) {
        if (!isColor(B.C[j]) || B.S[j] !== 0) break;
        B.F[j] = 1;
      }
    }
    for (const b of [...B.blocks.values()]) {
      if (b.thaw <= 0) continue;
      b.thaw--;
      const el = b.thawTotal - b.thaw, y = b.y + b.h - 1;
      const k = (el - FL - FA) / PO;
      if (k >= 0 && k < b.w && Number.isInteger(k)) ev.push({ type: 'reveal', x: b.x + k, y, c: b.reveal[k], k });
      if (b.thaw === 0) {
        for (let x = b.x; x < b.x + b.w; x++) {
          const i = y * COLS + x;
          B.C[i] = b.reveal[x - b.x]; B.Gd[i] = 0; B.S[i] = 0; B.F[i] = 1;
        }
        b.h--;
        b.reveal = null;
        if (b.h <= 0) B.blocks.delete(b.id);
        ev.push({ type: 'thaw', w: b.w, y });
      }
    }
  }

  // おじゃまの解凍を始める: 下の段がどの色になるかを先に決め、端から1マスずつ見せる
  function startThaw(b) {
    const r = [];
    for (let k = 0; k < b.w; k++) {
      let c;
      do { c = rng.int(cfg.colorsN) + 1; } while (k >= 2 && r[k - 1] === c && r[k - 2] === c);
      r.push(c);
    }
    b.reveal = r;
    b.thawTotal = b.thaw = FL + FA + b.w * PO;
  }

  function detect(ev) {
    const C = B.C;
    const cand = i => isColor(C[i]) && B.S[i] === 0 && B.Gd[i] === 0
      && (i + COLS >= N || (C[i + COLS] !== 0 && B.S[i + COLS] !== 2 && B.S[i + COLS] !== 3));
    const hit = findRuns(C, i => i >= TOP * COLS && cand(i));
    if (hit.size === 0) return;
    let anyChain = false;
    for (const i of hit) if (B.F[i]) anyChain = true;
    let stepChain = 1;
    if (anyChain) { B.chain = Math.max(B.chain, 1) + 1; stepChain = B.chain; } else if (B.chain === 0) B.chain = 1;
    const n = hit.size;
    const total = clearTime(n);
    const order = [...hit].sort((a, b) => a - b); // 上の行から、同じ行は左から
    order.forEach((i, k) => { B.S[i] = 1; B.T[i] = total; B.TT[i] = total; B.Q[i] = k; B.F[i] = 0; B.K[i] = stepChain >= 2 ? 1 : 0; });
    // 隣のおじゃまブロックを解凍
    for (const i of hit) {
      const x = i % COLS;
      for (const j of [i - COLS, i + COLS, x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1]) {
        if (j < 0 || j >= N || !B.Gd[j]) continue;
        const b = B.blocks.get(B.Gd[j]);
        if (b && b.thaw === 0) startThaw(b);
      }
    }
    // 停止時間: 同時消し（4つ以上）と連鎖でもらえる。長い方を残す
    let stop = 0;
    if (n >= 4) stop += cfg.naraberuStopCombo + (n - 4) * cfg.naraberuStopComboPer;
    if (stepChain >= 2) stop += cfg.naraberuStopChain * (stepChain - 1);
    if (stop > B.stop) B.stop = stop;
    ev.push({ type: 'pop', chain: stepChain, n, cells: [...hit] });
    const D = naraberuDamage({ n, chain: stepChain }, cfg);
    if (D > 0) ev.push({ type: 'attack', D, chain: stepChain });
  }

  function placeGarbage(list, ev) {
    let side = 0;
    for (const { w, h: h0 } of list) {
      const x = w >= COLS ? 0 : (side++ % 2 === 0 ? 0 : COLS - w);
      let top = ROWS;
      for (let xx = x; xx < x + w; xx++) {
        for (let y = 0; y < ROWS; y++) if (B.C[y * COLS + xx] !== 0) { top = Math.min(top, y); break; }
      }
      const bottom = Math.min(TOP - 1, top - 1);
      const h = Math.min(h0, bottom + 1);
      if (h <= 0) continue;
      addBlock(x, bottom - h + 1, w, h);
      ev.push({ type: 'garbage', w, h });
    }
  }

  function step(inp) {
    const ev = [];
    if (B.dead) return ev;
    B.frame++;
    const cur = B.cursor;
    if (inp.left) cur.x = Math.max(0, cur.x - 1);
    if (inp.right) cur.x = Math.min(COLS - 2, cur.x + 1);
    if (inp.up) cur.y = Math.max(TOP, cur.y - 1);
    if (inp.down) cur.y = Math.min(BOTTOM, cur.y + 1);
    if (inp.a) {
      const i = cur.y * COLS + cur.x, j = i + 1;
      if (swappable(i) && swappable(j) && (B.C[i] !== 0 || B.C[j] !== 0)) {
        const ci = B.C[i];
        B.C[i] = B.C[j]; B.C[j] = ci;
        B.F[i] = 0; B.F[j] = 0;
        ev.push({ type: 'swap' });
      }
    }

    finishTimers(ev);
    gravity();
    detect(ev);
    // 着地して消えなかったパネルの連鎖フラグを消す
    for (let i = 0; i < N; i++) {
      if (B.F[i] && B.S[i] === 0 && (i + COLS >= N || (B.C[i + COLS] !== 0 && B.S[i + COLS] !== 2 && B.S[i + COLS] !== 3))) {
        // 下が消去中なら、これから落ちるのでフラグを残す
        if (i + COLS < N && B.S[i + COLS] === 1) continue;
        B.F[i] = 0;
      }
    }
    const act = anyActive();
    if (!act.flagged && !act.chainClearing) B.chain = 0;

    if (!act.clearing && !act.thawing && !act.falling) {
      const list = takeGarbage();
      if (list.length) placeGarbage(list, ev);
    }

    if (B.stop > 0 && !act.clearing) B.stop--;
    if (inp.bHeld && !act.clearing && !act.thawing) B.stop = 0; // 手動せり上げは停止時間を打ち切る

    // せり上がり（停止時間中は止まる）
    if (!act.clearing && !act.thawing && B.stop === 0 && !topOccupied()) {
      B.rise += 1 / riseFramesNow();
      if (inp.bHeld) B.rise += 1 / cfg.naraberuManualRiseFrames;
      if (B.rise >= 1) {
        if (hiddenTopBusy()) B.rise = 1;
        else { B.rise -= 1; shiftUp(); ev.push({ type: 'rise' }); }
      }
    }

    // 天井の猶予: 消去・解凍・浮遊・落下・停止時間の間は減らない
    if (topOccupied()) {
      const busy = act.clearing || act.thawing || act.falling || B.stop > 0;
      if (!busy && --B.grace <= 0) { B.dead = true; ev.push({ type: 'dead' }); }
    } else B.grace = graceMax;
    return ev;
  }

  return B;
}

function quietOpening(C, cfg) {
  const snap = Int8Array.from(C);
  const a = new Int8Array(N), b = new Int8Array(N);
  for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS - 1; x++) {
    const r = simulateSwap(snap, x, y, cfg, a);
    if (!r) continue;
    if (r.chains >= 2) return false;
    for (let y2 = TOP; y2 <= BOTTOM; y2++) for (let x2 = 0; x2 < COLS - 1; x2++) {
      const r2 = simulateSwap(a, x2, y2, cfg, b);
      if (r2 && r2.chains >= 3) return false;
    }
  }
  return true;
}

// テスト用: 見える範囲に下詰めで文字列を並べる（R G B Y P と .）
export function fillFromRows(b, rows) {
  b.C.fill(0); b.S.fill(0); b.T.fill(0); b.F.fill(0); b.Gd.fill(0); b.K.fill(0); b.Q.fill(0); b.TT.fill(0); b.blocks.clear();
  const off = BOTTOM - rows.length + 1;
  rows.forEach((r, k) => [...r].forEach((ch, x) => { b.C[(off + k) * COLS + x] = LETTER[ch]; }));
}

export function matchesOf(b) {
  return findRuns(b.C, i => isColor(b.C[i]) && b.Gd[i] === 0);
}

// AI用のスナップショット: 色だけの配列。消去中は空、おじゃまは9（動かない）
export function snapshot(b) {
  const s = new Int8Array(N);
  for (let i = 0; i < N; i++) s[i] = b.S[i] === 1 ? 0 : b.C[i];
  return s;
}

function simGravity(s) {
  for (let x = 0; x < COLS; x++) {
    let w = BOTTOM;
    for (let y = BOTTOM; y >= 0; y--) {
      const i = y * COLS + x, v = s[i];
      if (v === GARB) { w = y - 1; continue; }
      if (v !== 0) { s[i] = 0; s[w * COLS + x] = v; w--; }
    }
  }
}

// 入れ替え(x,y)↔(x+1,y)を時間を飛ばして解決（AI用）。snap は書き換えない
export function simulateSwap(snap, x, y, cfg, out = null) {
  const s = out || new Int8Array(N);
  s.set(snap);
  const i = y * COLS + x;
  if (s[i] === GARB || s[i + 1] === GARB) return null;
  if (s[i] === 0 && s[i + 1] === 0) return null;
  const t = s[i]; s[i] = s[i + 1]; s[i + 1] = t;
  return resolveSnap(s, cfg);
}

export function resolveSnap(s, cfg) {
  let chains = 0, D = 0, cleared = 0, thaw = 0;
  for (;;) {
    simGravity(s);
    const hit = findRuns(s, i => i >= TOP * COLS && isColor(s[i]));
    if (!hit.size) break;
    chains++;
    D += naraberuDamage({ n: hit.size, chain: chains }, cfg);
    cleared += hit.size;
    for (const i of hit) {
      const x = i % COLS;
      for (const j of [i - COLS, i + COLS, x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < N && s[j] === GARB) thaw++;
      }
    }
    for (const i of hit) s[i] = 0;
  }
  let maxH = 0;
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y <= BOTTOM; y++) if (s[y * COLS + x] !== 0) { maxH = Math.max(maxH, BOTTOM - y + 1); break; }
  }
  return { chains, D, cleared, thaw, maxH, grid: s };
}
