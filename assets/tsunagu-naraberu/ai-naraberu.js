// ならべる派CPU: 全入れ替えを時間を飛ばして試し、カーソルを1マスずつ動かして入れ替える。
// 小さい消しはすぐ撃たず、「次の1手で何連鎖になるか（見込み）」を育てて大きく撃つ。
import { LEVELS, AI_N } from './config.js';
import { snapshot, simulateSwap, TOP, BOTTOM, COLS } from './naraberu.js';
import { createRng } from './rng.js';

const NONE = Object.freeze({ left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false });

function pairs(s) {
  let n = 0;
  for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS; x++) {
    const i = y * COLS + x, c = s[i];
    if (c < 1 || c > 5) continue;
    if (x < COLS - 1 && s[i + 1] === c) n++;
    if (y < BOTTOM && s[i + COLS] === c) n++;
  }
  return n;
}

function stackHeight(s) {
  for (let y = 0; y <= BOTTOM; y++) for (let x = 0; x < COLS; x++) if (s[y * COLS + x] !== 0) return BOTTOM - y + 1;
  return 0;
}

export function createNaraberuAI(levelName, cfg, opts = {}) {
  const L = LEVELS[levelName];
  const rng = createRng(opts.seed ?? 77);
  const noise = AI_N.noise[levelName];
  const minChain = AI_N.minChain[levelName];
  let plan = null, wait = L.think;
  const buf = new Int8Array(24 * COLS), buf2 = new Int8Array(24 * COLS), buf3 = new Int8Array(24 * COLS);

  // 1手で起こせる最大の連鎖数
  function potential(grid) {
    let best = 0;
    for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS - 1; x++) {
      const r = simulateSwap(grid, x, y, cfg, buf3);
      if (r && r.chains > best) best = r.chains;
    }
    return best;
  }

  function fire(r, danger) {
    if (!r.cleared) return 0;
    const big = danger || r.chains >= minChain || r.thaw > 0;
    if (big) return r.D * AI_N.D + r.chains * AI_N.chain + r.cleared * AI_N.clear + r.thaw * AI_N.thaw;
    return r.cleared * AI_N.smallClear;
  }

  function shape(grid) {
    let s = -(Math.max(0, stackHeight(grid) - 6) ** 2) * AI_N.high;
    if (L.lookahead) s += pairs(grid) * AI_N.pair;
    return s;
  }

  function makePlan(board, pendingD) {
    const snap = snapshot(board);
    const { x: cx, y: cy } = board.cursor;
    const danger = stackHeight(snap) >= AI_N.dangerHeight || pendingD * cfg.convN >= AI_N.dangerPending;
    const cands = [];
    for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS - 1; x++) {
      const i = y * COLS + x;
      if (board.S[i] || board.S[i + 1] || board.Gd[i] || board.Gd[i + 1]) continue;
      const r = simulateSwap(snap, x, y, cfg, buf);
      if (!r) continue;
      let s = fire(r, danger) + shape(r.grid) - (Math.abs(cx - x) + Math.abs(cy - y)) * AI_N.dist;
      if (noise) s += (rng.next() - 0.5) * 2 * noise;
      cands.push({ x, y, s, grid: r.grid.slice() });
    }
    if (!cands.length) return null;
    let base = shape(snap);
    cands.sort((a, b) => b.s - a.s);
    const top = cands.slice(0, AI_N.topK);
    if (L.lookahead) {
      const pot = g => { const p = potential(g); return p >= 2 ? p * p * AI_N.pot : 0; };
      base += pot(snap);
      for (const c of top) c.s += pot(c.grid);
    }
    if (L.depth >= 2) {
      for (const c of top) {
        let b2 = -Infinity;
        for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS - 1; x++) {
          const r2 = simulateSwap(c.grid, x, y, cfg, buf2);
          if (!r2) continue;
          const v = fire(r2, danger) + shape(r2.grid);
          if (v > b2) b2 = v;
        }
        if (b2 > -Infinity) c.s += AI_N.second * (b2 - shape(c.grid));
      }
    }
    top.sort((a, b) => b.s - a.s);
    const best = top[0];
    if (best.s <= base + 0.5) return null;
    const i = best.y * COLS + best.x;
    return { x: best.x, y: best.y, rc: board.riseCount, c0: board.C[i], c1: board.C[i + 1] };
  }

  function next(board, pendingD = 0) {
    let falling = false, clearing = false;
    for (let i = 0; i < board.S.length; i++) { if (board.S[i] === 2) falling = true; else if (board.S[i] === 1) clearing = true; }
    const raise = !clearing && pendingD <= 0 && stackHeight(board.C) < AI_N.raiseBelow[levelName];
    const idle = { ...NONE, bHeld: raise };
    if (wait > 0) { wait--; return idle; }
    if (falling) return idle;
    if (!plan) {
      plan = makePlan(board, pendingD);
      if (!plan) { wait = L.think; return idle; }
    }
    const ty = plan.y - (board.riseCount - plan.rc);
    if (ty < TOP) { plan = null; return idle; }
    wait = L.act;
    const cur = board.cursor;
    if (cur.y !== ty) return { ...idle, up: cur.y > ty, down: cur.y < ty };
    if (cur.x !== plan.x) return { ...idle, left: cur.x > plan.x, right: cur.x < plan.x };
    const i = ty * COLS + plan.x;
    const ok = board.C[i] === plan.c0 && board.C[i + 1] === plan.c1
      && !board.S[i] && !board.S[i + 1] && !board.Gd[i] && !board.Gd[i + 1];
    plan = null;
    if (!ok) { wait = 0; return idle; }
    wait = L.think;
    return { ...idle, a: true };
  }

  return { next };
}
