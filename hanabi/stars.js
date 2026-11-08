// 一筆花火 物語「星の夜」— 星座の一筆書き。DOM に触らない。
// ルール: 星座の線を、同じ線を二度なぞらずに、指を離さずに全部なぞる。線の始まりから火が追ってくる。
// 奇数本の線が出ている星が 0 か 2 個なら一筆で描ける（オイラーの一筆書き）。4 個なら、どうしても一度は筆を離すしかない。
export const DT = 1 / 60;

// 座標は横 1.6 × 縦 1 の箱の中の割合
export const LEVELS = [
  { id: 'hokuto', ja: '北斗七星', nodes: [[0.05, 0.25], [0.32, 0.18], [0.52, 0.32], [0.72, 0.38], [0.78, 0.68], [1.18, 0.78], [1.28, 0.44]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]], v0: 120, ramp: 8 },
  { id: 'sankaku', ja: '夏の大三角', nodes: [[0.22, 0.32], [1.2, 0.2], [0.85, 0.9], [0.7, 0.04]], edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 1]], v0: 130, ramp: 9 },
  { id: 'cassiopeia', ja: 'カシオペヤ', nodes: [[0.08, 0.3], [0.42, 0.78], [0.8, 0.42], [1.18, 0.82], [1.52, 0.26]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3], [0, 4]], v0: 140, ramp: 9 },
  { id: 'hakucho', ja: '白鳥座', nodes: [[0.8, 0.06], [0.8, 0.46], [0.8, 0.94], [0.22, 0.4], [1.38, 0.4]], edges: [[0, 1], [1, 2], [3, 1], [1, 4], [3, 0], [4, 0], [4, 2]], v0: 150, ramp: 10 },
  { id: 'ie', ja: '天の家', nodes: [[0.45, 0.92], [1.15, 0.92], [1.15, 0.42], [0.45, 0.42], [0.8, 0.04]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [3, 4], [4, 2]], v0: 150, ramp: 11 },
  // 一筆では描けない（奇数の星が 4 つ）。失敗すると鵲が来て、一度だけ筆を離せるようになる
  { id: 'tanabata', ja: '織姫と彦星', nodes: [[0.06, 0.28], [0.42, 0.14], [0.36, 0.6], [0.14, 0.92], [1.16, 0.1], [1.52, 0.42], [1.22, 0.58], [1.44, 0.92]], edges: [[0, 1], [1, 2], [2, 0], [2, 3], [4, 5], [5, 6], [6, 4], [6, 7]], v0: 140, ramp: 9, magpie: true, river: true },
  { id: 'amanogawa', ja: '天の川', nodes: [[0.04, 0.5], [0.28, 0.12], [0.5, 0.5], [0.28, 0.88], [0.98, 0.92], [1.54, 0.92], [1.54, 0.46], [0.98, 0.46], [1.26, 0.06]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [4, 5], [5, 6], [6, 7], [7, 4], [4, 6], [5, 7], [7, 8], [8, 6]], v0: 170, ramp: 12, jumps: 1, river: true },
];

export function fieldFor(w, h) {
  return w >= h ? { x0: 110, x1: w - 110, y0: 118, y1: h * 0.57 } : { x0: 60, x1: w - 60, y0: 230, y1: h * 0.66 };
}

export function newPuzzle(lv, w, h, opt = {}) {
  const f = fieldFor(w, h), fw = f.x1 - f.x0, fh = f.y1 - f.y0, S = Math.min(fw / 1.6, fh);
  const cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2;
  const Sx = Math.min(fw / 1.6, S * 1.3); // 横長の画面では、横に少し広げて星の間をあける
  const nodes = lv.nodes.map(([u, v]) => ({ x: cx + (u - 0.8) * Sx, y: cy + (v - 0.5) * S, deg: 0 }));
  const edges = lv.edges.map(([a, b]) => ({ a, b, used: false }));
  for (const e of edges) { nodes[e.a].deg++; nodes[e.b].deg++; }
  const r = Math.max(26, Math.min(36, S * 0.075));
  return {
    lv, w, h, field: f, S, nodes, edges, r, phase: 'aim', cur: -1, pts: [], len: 0, fireS: 0, fireOn: false, fx: 0, fy: 0,
    t: 0, age: 0, v: 0, jumpsLeft: (lv.jumps || 0) + (opt.magpie ? 1 : 0), events: [], minGap: Infinity, pen: null, lastBad: -1, grace: 1.0,
    v0: lv.v0 * (opt.speedX || 1), ramp: lv.ramp, vmax: 420 * (opt.speedX || 1), reason: null, doneT: 0,
  };
}
const unusedAt = (st, n) => st.edges.some((e) => !e.used && (e.a === n || e.b === n));
const edgeBetween = (st, a, b) => st.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
export const remaining = (st) => st.edges.filter((e) => !e.used).length;
export function nodeAt(st, x, y, r = st.r) {
  let best = -1, bd = r;
  st.nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}
export const oddNodes = (st) => st.nodes.map((n, i) => (n.deg % 2 ? i : -1)).filter((i) => i >= 0);

function addSeg(st, n, jump) {
  const a = st.nodes[st.cur], b = st.nodes[n], d = Math.hypot(b.x - a.x, b.y - a.y), k = Math.max(1, Math.ceil(d / 12));
  for (let i = 1; i <= k; i++) { st.len += d / k; st.pts.push({ x: a.x + ((b.x - a.x) * i) / k, y: a.y + ((b.y - a.y) * i) / k, s: st.len, jump }); }
  st.cur = n;
}

export function penDown(st, x, y) {
  if (st.phase === 'aim') {
    const n = nodeAt(st, x, y, st.r * 1.3); if (n < 0) { st.events.push({ type: 'miss', x, y }); return false; }
    st.cur = n; st.pts = [{ x: st.nodes[n].x, y: st.nodes[n].y, s: 0 }]; st.len = 0; st.phase = 'draw'; st.age = 0; st.pen = { x, y };
    st.fx = st.nodes[n].x; st.fy = st.nodes[n].y;
    st.events.push({ type: 'start', n });
    return true;
  }
  if (st.phase === 'jump') {
    const n = nodeAt(st, x, y, st.r * 1.3);
    if (n < 0) return false;
    if (!unusedAt(st, n)) { st.events.push({ type: 'noEdge', n }); return false; }
    st.jumpsLeft--; const from = st.cur; addSeg(st, n, true); st.phase = 'draw'; st.pen = { x, y };
    st.events.push({ type: 'jump', from, n });
    return true;
  }
  return false;
}

export function penMove(st, x, y) {
  if (st.phase !== 'draw') return;
  st.pen = { x, y };
  const n = nodeAt(st, x, y);
  if (n < 0 || n === st.cur) { if (n < 0) st.lastBad = -1; return; }
  const e = edgeBetween(st, st.cur, n);
  if (e && !e.used) {
    e.used = true; const from = st.cur; addSeg(st, n, false);
    st.events.push({ type: 'edge', from, n, left: remaining(st) });
    if (!remaining(st)) { st.phase = 'clear'; st.events.push({ type: 'clear' }); return; }
    if (!unusedAt(st, n) && st.jumpsLeft <= 0) fail(st, 'stuck');
  } else if (st.lastBad !== n) {
    st.lastBad = n; st.events.push({ type: e ? 'used' : 'noLine', n });
  }
}

export function penUp(st) {
  if (st.phase !== 'draw') return;
  if (st.jumpsLeft > 0) { st.phase = 'jump'; st.events.push({ type: 'lift' }); }
  else fail(st, 'lift');
}

function fail(st, reason) {
  st.phase = 'fail'; st.reason = reason;
  st.events.push({ type: 'fail', reason });
}

function pointAt(st, s) {
  const P = st.pts; if (P.length < 2) return P[0] || { x: 0, y: 0 };
  let i = 0; while (i < P.length - 2 && P[i + 1].s < s) i++;
  const a = P[i], b = P[i + 1], u = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

export function step(st, dt = DT) {
  st.t += dt;
  if (st.phase === 'draw' || st.phase === 'jump') {
    st.age += dt;
    if (!st.fireOn && st.age >= st.grace) { st.fireOn = true; st.events.push({ type: 'ignite' }); }
    if (st.fireOn) {
      st.v = Math.min(st.vmax, st.v0 + st.ramp * (st.age - st.grace));
      st.fireS += st.v * dt;
      const gap = st.len - st.fireS;
      if (st.len > 0) st.minGap = Math.min(st.minGap, gap);
      if (gap <= 0) { st.fireS = st.len; fail(st, 'caught'); }
    }
  } else if (st.phase === 'clear') {
    st.fireS += Math.max(st.v, 300) * 3 * dt;
    if (st.fireS >= st.len) { st.fireS = st.len; st.phase = 'done'; st.doneT = st.t; st.events.push({ type: 'bloom' }); }
  }
  const p = pointAt(st, Math.min(st.fireS, st.len)); st.fx = p.x; st.fy = p.y;
}

// 星の数: 描けたら 1、手早ければ 2、火をぎりぎりまで引きつけていたら 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  const par = st.len / 260 + 2.5;
  return 1 + (st.age <= par ? 1 : 0) + (st.minGap < 70 ? 1 : 0);
}

// 解き方（テストと手本用）: 筆を離せる回数 jumps までで、全部の線をなぞる順を返す
export function solve(lv, jumps = lv.jumps || 0) {
  const E = lv.edges.map(([a, b]) => ({ a, b })), used = new Array(E.length).fill(false), N = lv.nodes.length;
  const path = [];
  const go = (cur, left, j) => {
    if (left === 0) return true;
    for (let i = 0; i < E.length; i++) {
      if (used[i] || (E[i].a !== cur && E[i].b !== cur)) continue;
      const nx = E[i].a === cur ? E[i].b : E[i].a;
      used[i] = true; path.push({ n: nx, jump: false });
      if (go(nx, left - 1, j)) return true;
      used[i] = false; path.pop();
    }
    if (j > 0) for (let n = 0; n < N; n++) {
      if (n === cur || !E.some((e, i) => !used[i] && (e.a === n || e.b === n))) continue;
      path.push({ n, jump: true });
      if (go(n, left, j - 1)) return true;
      path.pop();
    }
    return false;
  };
  for (let s = 0; s < N; s++) { path.length = 0; path.push({ n: s, jump: false }); if (go(s, E.length, jumps)) return path.slice(); }
  return null;
}
