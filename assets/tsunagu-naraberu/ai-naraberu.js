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
  const L = { ...LEVELS[levelName], ...AI_N.speed[levelName] };
  const rng = createRng(opts.seed ?? 77);
  const noise = AI_N.noise[levelName];
  const minChain = AI_N.minChain[levelName];
  let plan = null, wait = L.think, noMove = false;
  const recent = []; // 直近の入れ替え {x, y, rc, c0, c1}（c0・c1 は入れ替えたあとの並び）
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

  // prep: 良くなる手がなくても、ほとんど悪くならない手（形を整える手）なら打つ（せり上げられない高さで棒立ちしないため）
  function makePlan(board, pendingD, prep = false) {
    const snap = snapshot(board);
    // 盤が止まっていない＝消去中・落下中・浮遊中・おじゃまの解凍中（先読みはどれも終わった先を計算する）
    const moving = board.S.some(v => v !== 0) || [...board.blocks.values()].some(b => b.thaw > 0);
    const { x: cx, y: cy } = board.cursor;
    const danger = stackHeight(snap) >= AI_N.dangerHeight || pendingD * cfg.convN >= AI_N.dangerPending;
    const cands = [];
    for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS - 1; x++) {
      const i = y * COLS + x;
      if (board.S[i] || board.S[i + 1] || board.Gd[i] || board.Gd[i + 1]) continue;
      if (board.C[i] === board.C[i + 1]) continue; // 同じ色どうしは入れ替えても何も変わらない
      const r = simulateSwap(snap, x, y, cfg, buf);
      if (!r) continue;
      // 直近に入れ替えた2枚をそのまま元に戻す手は選ばない（同じ2枚の入れ替えを繰り返さない）。例外は盤が止まっていて、戻すと消えるときだけ。
      // 盤が止まっていない間の「消える」見込みは、消え終わり・着地を先取りした計算なので外れることがあり、戻しては戻すを繰り返していた
      if ((!r.cleared || moving) && recent.some(h => x === h.x && y === h.y - (board.riseCount - h.rc)
        && board.C[i] === h.c0 && board.C[i + 1] === h.c1)) continue;
      // s0: ぶれを含まない点（「何もしないより良いか」の判定に使う）。s: ぶれを足した点（候補の並べ替えに使う）
      const s0 = fire(r, danger) + shape(r.grid) - (Math.abs(cx - x) + Math.abs(cy - y)) * AI_N.dist;
      const s = noise ? s0 + (rng.next() - 0.5) * 2 * noise : s0;
      cands.push({ x, y, s, s0, grid: r.grid.slice() });
    }
    if (!cands.length) return null;
    let base = shape(snap);
    cands.sort((a, b) => b.s - a.s);
    const top = cands.slice(0, AI_N.topK);
    if (L.lookahead) {
      const pot = g => { const p = potential(g); return p >= 2 ? p * p * AI_N.pot : 0; };
      base += pot(snap);
      for (const c of top) { const v = pot(c.grid); c.s += v; c.s0 += v; }
    }
    if (L.depth >= 2) {
      // 2手目の伸び。基準（何もしない）にも同じだけ足して、そろえて比べる
      const second = g => {
        let b2 = -Infinity;
        for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < COLS - 1; x++) {
          const r2 = simulateSwap(g, x, y, cfg, buf2);
          if (!r2) continue;
          const v = fire(r2, danger) + shape(r2.grid);
          if (v > b2) b2 = v;
        }
        return b2 > -Infinity ? AI_N.second * (b2 - shape(g)) : 0;
      };
      base += second(snap);
      for (const c of top) { const v = second(c.grid); c.s += v; c.s0 += v; }
    }
    top.sort((a, b) => b.s - a.s);
    const best = top[0];
    if (best.s0 <= base + 0.5 && !(prep && best.s0 >= base - AI_N.prepTol)) return null;
    const i = best.y * COLS + best.x;
    return { x: best.x, y: best.y, rc: board.riseCount, c0: board.C[i], c1: board.C[i + 1] };
  }

  function next(board, pendingD = 0) {
    let falling = false, clearing = false;
    for (let i = 0; i < board.S.length; i++) { if (board.S[i] === 2 || board.S[i] === 3) falling = true; else if (board.S[i] === 1) clearing = true; }
    // せり上げ: 予告が降ったときの段数を足しても上限に届かないなら押す。数えるのは降る量だけ
    // （3マス未満の予告はたまるまで降らない。それを1段と数えると、盤が減っても棒立ちになる）
    const cells = Math.floor(pendingD * cfg.convN + 1e-9);
    const incomingRows = cells >= 3 ? Math.ceil(cells / 6) : 0;
    const h = stackHeight(board.C) + incomingRows;
    // 良い入れ替えが見つからない間は、安全な高さ（raiseIdle）までせり上げて材料を出す（人ならそうする）
    const raise = !clearing && (h < AI_N.raiseBelow[levelName] || (!plan && noMove && h < AI_N.raiseIdle));
    const idle = { ...NONE, bHeld: raise };
    if (wait > 0) { wait--; return idle; }
    // 浮遊中・落下中のパネルがあっても、動かせるパネルは動かす（計画は静止セルだけ、入れ替え直前に色を確かめる）
    if (!plan) {
      plan = makePlan(board, pendingD, !clearing && h >= AI_N.raiseIdle);
      noMove = !plan;
      if (!plan) { wait = L.think; return { ...NONE, bHeld: !clearing && h < AI_N.raiseIdle }; }
    }
    const ty = plan.y - (board.riseCount - plan.rc);
    if (ty < TOP) { plan = null; return idle; }
    // 向かっている途中で狙いの2枚が変わったら（消えた・落ちてきた）、着いてから捨てずに、すぐ計画し直す
    const ti = ty * COLS + plan.x;
    if (board.C[ti] !== plan.c0 || board.C[ti + 1] !== plan.c1) { plan = null; return idle; }
    wait = L.act;
    const cur = board.cursor;
    if (cur.y !== ty) return { ...idle, up: cur.y > ty, down: cur.y < ty };
    if (cur.x !== plan.x) return { ...idle, left: cur.x > plan.x, right: cur.x < plan.x };
    const i = ty * COLS + plan.x, done = plan;
    const ok = board.C[i] === plan.c0 && board.C[i + 1] === plan.c1
      && !board.S[i] && !board.S[i + 1] && !board.Gd[i] && !board.Gd[i + 1];
    plan = null;
    if (!ok) { wait = 0; return idle; }
    wait = L.think;
    recent.push({ x: done.x, y: ty, rc: board.riseCount, c0: done.c1, c1: done.c0 });
    if (recent.length > 4) recent.shift();
    return { ...idle, a: true };
  }

  return { next };
}
