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
  let pid = -1, target = null, wait = 0, lastX = -1, stuck = 0, rotTries = 0;

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
    let best = null;
    for (const c of CANDS) {
      if (!reachable(g0, c.x, c.rot)) continue;
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
      wait = L.think;
      lastX = -1; stuck = 0; rotTries = 0;
    }
    if (wait > 0) { wait--; return NONE; }
    wait = L.act;
    const p = board.piece;
    if (p.rot !== target.rot && rotTries < 4) {
      rotTries++;
      return (target.rot - p.rot + 4) % 4 === 3 ? { ...NONE, a: true } : { ...NONE, b: true };
    }
    if (p.x !== target.x && stuck < 2) {
      if (p.x === lastX) stuck++;
      lastX = p.x;
      return p.x < target.x ? { ...NONE, right: true } : { ...NONE, left: true };
    }
    return { ...NONE, up: true };
  }

  return { next };
}
