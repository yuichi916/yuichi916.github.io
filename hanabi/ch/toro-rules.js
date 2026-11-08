// 一筆花火 物語「灯籠流し」のルール。DOM に触らない（node でテストできる）。
// 線がそのまま川の流れになる。岸から社まで一筆で引くと、灯籠がその線の上を流れていく。
// 線の始まり（岸）からは火が追ってくる。火に追いつかれた灯籠は燃える。社までつながった線の終わりに着いた灯籠は、送られる。
// 岩の中へは線がのびない。蓮のそばを通った灯籠は、蓮の光をもらう（星 3 つめ）。
export const DT = 1 / 60;

// 面の座標: u は流れの向き（岸 0 → 社 1）、v は流れを横切る向き（0〜1）。
// 横長では u を横、縦長では u を縦にとる（川は上から下へ流れる）。
// walls: [u, v1, v2] は岩を並べた壁。rocks: [u, v] は岩 1 つ。bot: 運転手の引く道（社の真ん中で終わる）
export const LEVELS = [
  { id: 'hajime', ja: 'はじめての灯籠', need: 1, vL: 150, v0: 90, ramp: 8,
    docks: [{ at: [0.03, 0.5], n: 1 }], shrines: [{ at: [0.96, 0.5] }], rocks: [], walls: [], lotus: [[0.5, 0.24]],
    bot: [[[0.25, 0.38], [0.5, 0.27], [0.75, 0.38], [0.96, 0.5]]] },
  { id: 'mittsu', ja: '三つの灯', need: 2, vL: 160, v0: 110, ramp: 18,
    docks: [{ at: [0.03, 0.5], n: 3 }], shrines: [{ at: [0.96, 0.5] }], rocks: [[0.5, 0.55]], walls: [], lotus: [[0.5, 0.14]],
    bot: [[[0.28, 0.32], [0.5, 0.16], [0.72, 0.32], [0.96, 0.5]]] },
  { id: 'iwase', ja: '岩の瀬', need: 3, vL: 165, v0: 120, ramp: 22,
    docks: [{ at: [0.03, 0.3], n: 4 }], shrines: [{ at: [0.96, 0.7] }], rocks: [], walls: [[0.34, 0, 0.62], [0.67, 0.38, 1]], lotus: [[0.5, 0.86], [0.82, 0.12]],
    bot: [[[0.2, 0.62], [0.34, 0.88], [0.5, 0.84], [0.62, 0.3], [0.67, 0.13], [0.82, 0.16], [0.9, 0.45], [0.96, 0.7]]] },
  { id: 'namae', ja: '知らない名前', need: 4, vL: 170, v0: 130, ramp: 24,
    docks: [{ at: [0.03, 0.5], n: 5 }], shrines: [{ at: [0.96, 0.5] }], rocks: [[0.5, 0.5]], walls: [[0.28, 0.3, 1], [0.72, 0, 0.7]], lotus: [[0.5, 0.15], [0.86, 0.86]],
    bot: [[[0.16, 0.3], [0.28, 0.13], [0.5, 0.16], [0.6, 0.5], [0.62, 0.86], [0.74, 0.9], [0.86, 0.82], [0.96, 0.5]]] },
  { id: 'futatsu', ja: '二つの岸', need: 5, vL: 170, v0: 130, ramp: 25,
    docks: [{ at: [0.03, 0.2], n: 3, col: 'red' }, { at: [0.03, 0.8], n: 3, col: 'blue' }],
    shrines: [{ at: [0.96, 0.8], col: 'red' }, { at: [0.96, 0.2], col: 'blue' }], rocks: [[0.52, 0.5]], walls: [], lotus: [[0.76, 0.9], [0.76, 0.1]],
    bot: [[[0.28, 0.28], [0.4, 0.7], [0.62, 0.88], [0.76, 0.88], [0.96, 0.8]], [[0.28, 0.72], [0.4, 0.3], [0.62, 0.12], [0.76, 0.12], [0.96, 0.2]]] },
  { id: 'hayase', ja: '早瀬', need: 5, vL: 200, v0: 170, ramp: 27,
    docks: [{ at: [0.03, 0.5], n: 6 }], shrines: [{ at: [0.96, 0.5] }], rocks: [[0.84, 0.5]], walls: [[0.25, 0, 0.6], [0.5, 0.4, 1], [0.75, 0, 0.6]], lotus: [[0.38, 0.86], [0.62, 0.14]],
    bot: [[[0.14, 0.62], [0.25, 0.85], [0.38, 0.82], [0.42, 0.3], [0.5, 0.15], [0.62, 0.16], [0.7, 0.72], [0.75, 0.85], [0.86, 0.8], [0.96, 0.5]]] },
  { id: 'hasu', ja: '蓮の池', need: 6, vL: 185, v0: 150, ramp: 27,
    docks: [{ at: [0.03, 0.22], n: 4, col: 'blue' }, { at: [0.03, 0.78], n: 3, col: 'red' }],
    shrines: [{ at: [0.96, 0.22], col: 'red' }, { at: [0.96, 0.78], col: 'blue' }], rocks: [[0.3, 0.5], [0.7, 0.5]], walls: [], lotus: [[0.3, 0.1], [0.5, 0.5], [0.7, 0.9], [0.86, 0.5]],
    bot: [[[0.18, 0.18], [0.3, 0.13], [0.42, 0.3], [0.5, 0.47], [0.6, 0.7], [0.7, 0.86], [0.84, 0.82], [0.96, 0.78]], [[0.18, 0.82], [0.3, 0.86], [0.45, 0.7], [0.56, 0.32], [0.7, 0.18], [0.82, 0.38], [0.86, 0.47], [0.92, 0.3], [0.96, 0.22]]] },
  // 山場: 名前のない灯籠が一つだけ、どうしても岸を離れない（数に入らない。火も燃やさない）
  { id: 'nanashi', ja: '名のない灯籠', need: 7, vL: 200, v0: 170, ramp: 28,
    docks: [{ at: [0.03, 0.25], n: 4, nameless: true }, { at: [0.03, 0.75], n: 4 }],
    shrines: [{ at: [0.96, 0.5] }], rocks: [[0.86, 0.22], [0.86, 0.78]], walls: [[0.3, 0.42, 1], [0.58, 0, 0.58]], lotus: [[0.3, 0.14], [0.58, 0.86], [0.44, 0.6]],
    bot: [[[0.16, 0.2], [0.3, 0.16], [0.44, 0.56], [0.58, 0.82], [0.72, 0.8], [0.84, 0.5], [0.96, 0.5]], [[0.12, 0.6], [0.2, 0.3], [0.3, 0.2], [0.42, 0.42], [0.5, 0.75], [0.58, 0.9], [0.74, 0.86], [0.88, 0.56], [0.96, 0.5]]] },
];

export const NAMES = ['きよ', '源三', 'はる', '与一', 'たけ', '佐吉', 'ふみ', '辰五郎', 'うめ', '清次', 'さと', '弥助', 'しず', '勘太', 'なつ', '留吉', 'ちよ', '新八', 'いと', '松蔵'];
export const CONN = 1.15, RR = 30, SH_R = 40, LOTUS_R = 42, DOCK_R = 72, SP = 36, STEP = 6, REL = 0.32;

export function fieldFor(w, h) {
  if (w >= h) { const fw = Math.min(w - 260, 1100), x0 = (w - fw) / 2; return { land: true, x0, x1: x0 + fw, y0: 160, y1: h * 0.575, bx0: 24, bx1: w - 24, by0: 112, by1: h * 0.62 }; }
  return { land: false, x0: 110, x1: w - 110, y0: 300, y1: h * 0.645, bx0: 24, bx1: w - 24, by0: 230, by1: h * 0.7 };
}
export function mapUV(f, u, v) {
  return f.land ? { x: f.x0 + u * (f.x1 - f.x0), y: f.y0 + v * (f.y1 - f.y0) } : { x: f.x0 + v * (f.x1 - f.x0), y: f.y0 + u * (f.y1 - f.y0) };
}

export function newStage(lv, w, h, opt = {}) {
  const f = fieldFor(w, h), at = ([u, v]) => mapUV(f, u, v), idx = LEVELS.indexOf(lv);
  const rocks = lv.rocks.map((p) => ({ ...at(p), r: RR }));
  for (const [u, v1, v2] of lv.walls) {
    // 壁: 端から端まで、すき間なく岩を並べる
    const a = at([u, v1]), b = at([u, v2]), d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (RR * 1.55)));
    for (let i = 0; i <= n; i++) rocks.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n, r: RR });
  }
  let k = idx * 3;
  const docks = lv.docks.map((d, di) => ({ ...at(d.at), col: d.col || null, used: false, nameless: !!d.nameless, lanterns: Array.from({ length: d.n }, () => ({ name: NAMES[k++ % NAMES.length], st: 'dock', s: 0, dock: di })) }));
  const flow = f.land ? { x: 1, y: 0 } : { x: 0, y: 1 };
  // 速さは川の長さに合わせる（画面の形で道の長さが変わっても、かかる時間は同じ）
  const sc = Math.max(0.5, Math.min(1.25, routeLen(lv, f) / routeLen(lv, fieldFor(1280, 720))));
  return {
    lv, w, h, field: f, flow, rocks, docks, shrines: lv.shrines.map((s) => ({ ...at(s.at), col: s.col || null, r: SH_R })),
    lotus: lv.lotus.map((p) => ({ ...at(p), got: false })), strokes: [], cur: null,
    phase: 'aim', t: 0, events: [], reason: null, saved: 0, burned: 0, total: docks.reduce((a, d) => a + d.lanterns.length, 0), need: lv.need,
    sc, vL: lv.vL * sc, v0: lv.v0 * sc * (opt.speedX || 1), ramp: lv.ramp * sc * (opt.speedX || 1), hint: !!opt.hint, doneT: 0, pen: null, blockT: -9,
  };
}

// 手本の道の長さ（岸から社まで、道ごとの平均）
function routeLen(lv, f) {
  let sum = 0;
  lv.bot.forEach((path, i) => { let a = mapUV(f, ...lv.docks[i % lv.docks.length].at); for (const q of path) { const b = mapUV(f, q[0], q[1]); sum += Math.hypot(b.x - a.x, b.y - a.y); a = b; } });
  return sum / lv.bot.length;
}

// 線の s の位置の点
export function pointAt(k, s) {
  const P = k.pts; if (P.length < 2) return P[0];
  let lo = 0, hi = P.length - 1;
  if (s <= 0) return P[0];
  if (s >= P[hi].s) return P[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; }
  const a = P[lo], b = P[hi], u = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function blockedAt(st, k, x, y) {
  const f = st.field;
  if (x < f.bx0 || x > f.bx1 || y < f.by0 || y > f.by1) return 'edge';
  for (const r of st.rocks) if (Math.hypot(x - r.x, y - r.y) < r.r) return 'rock';
  for (const s of st.shrines) if (!colorOk(k, s) && Math.hypot(x - s.x, y - s.y) < s.r) return 'color';
  return null;
}
const colorOk = (k, s) => !s.col || !k.col || s.col === k.col;

export function penDown(st, x, y) {
  if ((st.phase !== 'aim' && st.phase !== 'play') || st.cur) return false;
  let best = null, bd = DOCK_R;
  for (const d of st.docks) { if (d.used) continue; const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = d; } }
  if (!best) { st.events.push({ type: 'miss', x, y }); return false; }
  best.used = true;
  const k = { dock: st.docks.indexOf(best), col: best.col, pts: [{ x: best.x, y: best.y, s: 0 }], len: 0, fireS: 0, fireOn: false, age: 0, v: 0, ended: false, connected: false, cut: false, shrine: -1,
    lanterns: best.lanterns, grace: Math.max(1.0, (best.lanterns.length - 1) * REL + 0.55), fx: best.x, fy: best.y, over: false };
  st.strokes.push(k); st.cur = k; st.phase = 'play'; st.pen = { x, y };
  st.events.push({ type: 'start', dock: k.dock });
  penMove(st, x, y);
  return true;
}

export function penMove(st, x, y) {
  const k = st.cur; if (!k || k.ended || st.phase !== 'play') return;
  st.pen = { x, y };
  const tip = k.pts[k.pts.length - 1], d = Math.hypot(x - tip.x, y - tip.y);
  if (d < 1) return;
  const n = Math.ceil(d / STEP);
  for (let i = 1; i <= n; i++) {
    const p = k.pts[k.pts.length - 1], rest = Math.hypot(x - p.x, y - p.y); if (rest < 0.5) break;
    const l = Math.min(STEP, rest), nx = p.x + ((x - p.x) / rest) * l, ny = p.y + ((y - p.y) / rest) * l;
    const b = blockedAt(st, k, nx, ny);
    if (b) { if (st.t - st.blockT > 0.4) { st.blockT = st.t; st.events.push({ type: 'block', what: b, x: nx, y: ny }); } return; }
    k.len += l; k.pts.push({ x: nx, y: ny, s: k.len });
    const si = st.shrines.findIndex((s) => colorOk(k, s) && Math.hypot(nx - s.x, ny - s.y) < s.r);
    if (si >= 0) {
      // 社に届いた: 線の終わりを社の真ん中につないで、筆はここでおしまい
      const s = st.shrines[si], dd = Math.hypot(s.x - nx, s.y - ny);
      if (dd > 0.5) { k.len += dd; k.pts.push({ x: s.x, y: s.y, s: k.len }); }
      k.connected = true; k.ended = true; k.shrine = si; st.cur = null;
      st.events.push({ type: 'connect', shrine: si, dock: k.dock });
      return;
    }
  }
}

export function penUp(st) {
  const k = st.cur; if (!k || k.ended) return;
  k.ended = true; k.cut = true; st.cur = null;
  st.events.push({ type: 'lift', dock: k.dock });
}

function fail(st, reason) {
  if (st.phase !== 'play') return;
  st.phase = 'fail'; st.reason = reason; st.cur = null;
  st.events.push({ type: 'fail', reason });
}

export function step(st, dt = DT) {
  st.t += dt;
  if (st.phase !== 'play' && st.phase !== 'done') return;
  for (const k of st.strokes) stepStroke(st, k, dt);
  if (st.phase !== 'play') return;
  // まだ足りるか: 送れた数 + まだ燃えていない数が、要る数より少なくなったら失敗
  const alive = st.docks.reduce((a, d) => a + d.lanterns.filter((l) => l.st === 'dock' || l.st === 'float').length, 0);
  if (st.saved + alive < st.need) {
    const k = st.lastBurnK;
    fail(st, k && k.cut ? 'lift' : k && !k.connected ? 'caught' : 'burned');
    return;
  }
  if (alive === 0 && st.docks.every((d) => d.used) && !st.cur) {
    st.phase = 'done'; st.doneT = st.t; st.events.push({ type: 'done', saved: st.saved });
  }
}

function stepStroke(st, k, dt) {
  k.age += dt;
  const L = k.lanterns, live = L.filter((l) => l.st === 'float');
  // 灯籠を一つずつ、線に乗せる
  for (let i = 0; i < L.length; i++) {
    const l = L[i]; if (l.st !== 'dock') continue;
    const prev = L.slice(0, i).reverse().find((q) => q.st === 'float');
    if (k.age >= i * REL && (!prev || prev.s >= SP) && k.len > 4 && st.phase === 'play') { l.st = 'float'; l.s = 0; st.events.push({ type: 'release', dock: k.dock, i }); }
    break;
  }
  // 火
  if (!k.fireOn && k.age >= k.grace && st.phase === 'play') { k.fireOn = true; st.events.push({ type: 'ignite', dock: k.dock }); }
  const resolved = L.every((l) => l.st === 'saved' || l.st === 'burned');
  if (k.fireOn) {
    k.v = Math.min(460, st.v0 + st.ramp * (k.age - k.grace)) * (k.cut ? 1.8 : 1);
    const v = resolved && k.ended ? Math.max(k.v, 300) * 2.5 : k.v;
    k.fireS = Math.min(k.len, k.fireS + v * dt);
    if (resolved && k.ended && k.fireS >= k.len) k.over = true;
  }
  // 灯籠を流す。前の灯籠には SP より近づかない。社につながっていなければ線の先で止まる
  const vL = st.vL * (k.connected ? CONN : 1);
  let lim = k.connected ? Infinity : Math.max(0, k.len - 14);
  for (const l of L) {
    if (l.st !== 'float') continue;
    const ns = Math.min(l.s + vL * dt, lim);
    if (ns > l.s) {
      const step = ns - l.s, n = Math.max(1, Math.ceil(step / 5));
      for (let j = 1; j <= n; j++) {
        const p = pointAt(k, l.s + (step * j) / n);
        for (const lo of st.lotus) if (!lo.got && Math.hypot(p.x - lo.x, p.y - lo.y) < LOTUS_R) { lo.got = true; st.events.push({ type: 'lotus', x: lo.x, y: lo.y }); }
      }
      l.s = ns;
    }
    if (k.connected && l.s >= k.len) { l.st = 'saved'; st.saved++; st.events.push({ type: 'save', dock: k.dock, shrine: k.shrine, name: l.name, n: st.saved }); continue; }
    lim = l.s - SP;
  }
  // 火に追いつかれた灯籠は燃える
  if (k.fireOn && st.phase === 'play') {
    for (const l of L) if (l.st === 'float' && k.fireS >= l.s - 4) { l.st = 'burned'; st.burned++; st.lastBurnK = k; const p = pointAt(k, l.s); st.events.push({ type: 'burn', dock: k.dock, x: p.x, y: p.y, name: l.name }); }
    // 灯籠が一つも乗らないうちに火が筆先まで来たら、追いつかれた
    if (!k.ended && k.fireS >= k.len - 1 && live.length === 0 && L.every((l) => l.st !== 'float')) {
      for (const l of L) if (l.st === 'dock') { l.st = 'burned'; st.burned++; }
      st.lastBurnK = k;
    }
  }
  const p = pointAt(k, Math.min(k.fireS, k.len)); k.fx = p.x; k.fy = p.y;
}

// 星: 要る数を送れたら 1、ぜんぶ送れたら 2、そのうえ蓮をぜんぶ通れたら 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  const all = st.saved === st.total;
  return 1 + (all ? 1 : 0) + (all && st.lotus.every((l) => l.got) ? 1 : 0);
}

// 運転手: 面ごとの道を、決まった速さでなぞる。岸を押して、つながったら次の岸へ
export function bot(st, mem, speed = 6.4) {
  const paths = st.lv.bot;
  if (mem.k === undefined) { mem.k = 0; mem.i = 0; mem.wait = 0; }
  if (st.phase !== 'aim' && st.phase !== 'play') return null;
  if (!st.cur) {
    if (mem.k >= paths.length) return null;
    if (mem.drawing) { mem.drawing = false; mem.k++; mem.i = 0; mem.wait = 8; if (mem.k >= paths.length) return null; }
    if (mem.wait > 0) { mem.wait--; return null; }
    const d = st.docks[st.lv.docks.length > 1 ? mem.k : 0];
    mem.p = { x: d.x, y: d.y }; mem.drawing = true;
    return { down: [d.x, d.y] };
  }
  const path = paths[mem.k]; if (mem.i >= path.length) return null;
  const t = mapUV(st.field, path[mem.i][0], path[mem.i][1]), dx = t.x - mem.p.x, dy = t.y - mem.p.y, d = Math.hypot(dx, dy);
  if (d <= speed) { mem.p = { x: t.x, y: t.y }; mem.i++; } else { mem.p.x += (dx / d) * speed; mem.p.y += (dy / d) * speed; }
  return { move: [mem.p.x, mem.p.y] };
}
