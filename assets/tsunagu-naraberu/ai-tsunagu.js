// つなぐ派CPU: 新しい組が出たら全配置を盤の複製で試し打ちし、目標(x, rot)へ操作する。
import { LEVELS, AI_T } from './config.js';
import { cloneGrid, dropPiece, resolveAll } from './tsunagu.js';
import { createRng } from './rng.js';

const NONE = Object.freeze({ left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false });
const CANDS = [];
for (let rot = 0; rot < 4; rot++) for (let x = 0; x < 6; x++) {
  const cx = x + [0, 1, 0, -1][rot];
  if (cx >= 0 && cx < 6) CANDS.push({ x, rot });
}

function heights(g) {
  const h = [];
  for (let x = 0; x < 6; x++) {
    let y = 1;
    while (y <= 12 && g[y][x] === 0) y++;
    h.push(13 - y);
  }
  return h;
}

// 1つ足したら何連鎖起きるか（色×列の最大）
function potential(g, cfg) {
  let best = 0;
  for (let x = 0; x < 6; x++) {
    if (g[2][x] !== 0) continue;
    for (let c = 1; c <= cfg.colorsT; c++) {
      let y = 12;
      while (y >= 1 && g[y][x] !== 0) y--;
      const ok = (y < 12 && g[y + 1][x] === c) || (x > 0 && g[y][x - 1] === c) || (x < 5 && g[y][x + 1] === c);
      if (!ok) continue;
      const t = cloneGrid(g);
      t[y][x] = c;
      const r = resolveAll(t, cfg);
      if (r.chains > best) best = r.chains;
    }
  }
  return best;
}

function evalGrid(g, cfg, withPot) {
  const h = heights(g);
  let conn = 0, garbage = 0;
  for (let y = 1; y <= 12; y++) for (let x = 0; x < 6; x++) {
    const c = g[y][x];
    if (c === 6) garbage++;
    if (c < 1 || c > 5) continue;
    if (x < 5 && g[y][x + 1] === c) conn++;
    if (y < 12 && g[y + 1][x] === c) conn++;
  }
  let s = conn * AI_T.conn - garbage * AI_T.garbage;
  for (let x = 0; x < 6; x++) {
    s -= Math.max(0, h[x] - 6) ** 2 * AI_T.high;
    if (x < 5) s -= Math.abs(h[x] - h[x + 1]) * AI_T.bump;
  }
  if (h[2] >= 9) s -= AI_T.col3 * (h[2] - 8);
  if (withPot) { const p = potential(g, cfg); s += p * p * AI_T.pot; }
  return s;
}

// 組は考えている間も落ち続ける。目標 (x, rot) まで、考える時間＋1手ごとの待ちで回転・移動していく間に、
// 組がいる列の空きより下まで落ちてしまわないか（落ちたらその場で着地して、狙いと違う所＝多くは出口の3列目に置かれる）。
// movesFirst: 横移動を先にして回転は目標の列でする（3列目が高くて急ぐとき）
const CHILD = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function inTime(h, x, rot, think, act, fallFrames, timer0, movesFirst) {
  const steps = [];
  const rotSteps = rot === 0 ? [] : rot === 2 ? [1, 2] : [rot];
  const dx = Math.sign(x - 2), moves = [];
  for (let c = 2; c !== x; c += dx) moves.push(c + dx);
  if (movesFirst) { for (const c of moves) steps.push({ x: c, rot: 0 }); for (const r of rotSteps) steps.push({ x, rot: r }); }
  else { for (const r of rotSteps) steps.push({ x: 2, rot: r }); for (const c of moves) steps.push({ x: c, rot }); }
  // 列 c で、上から数えて row 段目（1〜12）が空いているか
  const free = (c, row) => row >= 1 && row <= 12 - h[c];
  for (let i = 0; i < steps.length; i++) {
    const t = think + act * (i + 1);
    const y = 1 + Math.floor((timer0 + t) / fallFrames); // そのとき組の軸がいる段
    const st = steps[i], [cx, cy] = CHILD[st.rot];
    if (!free(st.x, y) || !(y + cy < 1 || free(st.x + cx, y + cy))) return false;
  }
  return true;
}

// 出現位置から目標列まで、通り道がふさがっていないか
function reachable(g, x, rot) {
  const cx = x + [0, 1, 0, -1][rot];
  const lo = Math.min(2, x, cx), hi = Math.max(2, x, cx);
  for (let c = lo; c <= hi; c++) if (g[1][c] !== 0) return false;
  return true;
}

export function createTsunaguAI(levelName, cfg, opts = {}) {
  const L = LEVELS[levelName];
  const rng = createRng(opts.seed ?? 99);
  const minChain = AI_T.minChain[levelName];
  const noise = AI_T.noise[levelName];
  let pid = -1, target = null, wait = 0, lastX = -1, stuck = 0, rotTries = 0, movesFirst = false;

  function fireScore(r, danger) {
    if (r.chains === 0) return 0;
    if (danger) return r.D * AI_T.fireDanger;
    return r.chains >= minChain ? r.D * AI_T.fireBig : r.D * AI_T.fireSmall - 20;
  }

  function plan(board, pendingD) {
    const g0 = board.grid;
    const h = heights(g0);
    const free = h.reduce((t, v) => t + 12 - v, 0);
    const danger = opts.danger || pendingD * cfg.convT > free * AI_T.dangerFree
      || Math.max(...h) >= AI_T.dangerHeight || h[2] >= AI_T.dangerHeight;
    const { a, b } = board.piece;
    const nx = board.next[0];
    const fallFrames = Math.round(cfg.tsunaguFallSec * 60);
    const urgent = h[2] >= AI_T.urgentCol3;
    const think = urgent ? 0 : L.think;
    // 間に合う候補だけを考える（間に合う候補がなければ、全部から選ぶ）
    let cands = CANDS.filter(c => reachable(g0, c.x, c.rot) && inTime(h, c.x, c.rot, think, L.act, fallFrames, board.fallTimer, urgent));
    if (!cands.length) cands = CANDS.filter(c => reachable(g0, c.x, c.rot));
    movesFirst = urgent;
    let best = null;
    for (const c of cands) {
      const g = cloneGrid(g0);
      if (!dropPiece(g, c.x, c.rot, a, b)) continue;
      const r = resolveAll(g, cfg);
      let s = fireScore(r, danger);
      if (L.depth >= 2) {
        let b2 = -Infinity;
        for (const c2 of CANDS) {
          const g2 = cloneGrid(g);
          if (!dropPiece(g2, c2.x, c2.rot, nx.a, nx.b)) continue;
          const r2 = resolveAll(g2, cfg);
          const v = fireScore(r2, danger) * 0.9 + evalGrid(g2, cfg, false);
          if (v > b2) b2 = v;
        }
        s += (b2 === -Infinity ? -1e6 : b2) + (L.lookahead ? evalGrid(g, cfg, true) - evalGrid(g, cfg, false) : 0);
      } else {
        s += evalGrid(g, cfg, L.lookahead);
      }
      if (noise) s += (rng.next() - 0.5) * 2 * noise;
      if (!best || s > best.s) best = { ...c, s };
    }
    return best || { x: 2, rot: 0 };
  }

  function next(board, pendingD = 0) {
    if (board.phase !== 'fall' || !board.piece) return NONE;
    if (board.pieceId !== pid || !target) {
      target = plan(board, pendingD);
      pid = board.pieceId; // 計画が成功してから記録する（失敗したら次の刻みでやり直す）
      wait = movesFirst ? 0 : L.think; // 3列目が高いときは考える間を置かずに動く
      lastX = -1; stuck = 0; rotTries = 0;
    }
    if (wait > 0) { wait--; return NONE; }
    wait = L.act;
    const p = board.piece;
    const rotate = () => { rotTries++; return (target.rot - p.rot + 4) % 4 === 3 ? { ...NONE, a: true } : { ...NONE, b: true }; };
    const move = () => { if (p.x === lastX) stuck++; lastX = p.x; return p.x < target.x ? { ...NONE, right: true } : { ...NONE, left: true }; };
    const needRot = p.rot !== target.rot && rotTries < 4, needMove = p.x !== target.x && stuck < 2;
    // ふだんは回してから動かす。急ぐときは先に動かして、目標の列で回す（回転2は下に伸びて着地が早まる）
    if (movesFirst && needMove) return move();
    if (needRot) return rotate();
    if (needMove) return move();
    return { ...NONE, up: true };
  }

  return { next };
}
