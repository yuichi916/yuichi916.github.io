// 一筆花火 物語「雪の山里」のルール。DOM に触らない（node でテストできる）。
// 引いた線が凍って氷の道になる。座敷わらしのそりが、その上をすべって家まで帰る。
// 線の始まりから火が追ってきて、燃えた所の氷は溶けて消える。そりは火より先にいなければ落ちる。
// そりは重さのある点: 氷の上では坂に沿って速くなり（少しだけ摩擦）、線の端からは飛び出し、下の氷に着地する。
// 湯けむりの中では線が凍らない（引けない）。雪の松にぶつかると、そりはひっくり返る。谷へ落ちても失敗。
export const DT = 1 / 60;
export const G = 620, MU = 0.035, DRAG = 0.0007, SUB = 4, GRACE = 1.1;
export const HOUSE_R = 46, PINE_R = 21, USAGI_R = 30, STEP = 7, MINSTEP = 4, BODY = 14;

// 面の座標: u は横（左 0 → 右 1）、v は縦（上 0 → 下 1）。重さは下向きなので、縦長でも向きは変えない。
// start: そりの待つ雪の棚。steam: [u1, u2, v1, v2] の湯けむり（線が引けない）。pines: 雪の松。usagi: 雪うさぎ。
// usagiP: 縦長の画面での雪うさぎ（縦長は坂が急になるので、そりの通り道が少し変わる）。par: 手早さの目安の秒 [横長, 縦長]
// bot: 運転手の引く線（下の bot を参照）
export const LEVELS = [
  { id: 'atchi', ja: 'おうち、あっち', v0: 80, ramp: 5, par: [4.5, 3.5], start: [0.04, 0.06], house: [0.93, 0.84], steam: [], pines: [], usagi: [[0.5, 0.5]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.5, 0.56], [0.93, 0.86]] }] },
  { id: 'yukemuri', ja: '湯けむりの谷', v0: 90, ramp: 6, par: [4.5, 3.5], start: [0.04, 0.06], house: [0.93, 0.9], steam: [[0.45, 0.56, -0.3, 1.2]], pines: [], usagi: [[0.51, 0.5]], usagiP: [[0.5, 0.26]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.3, 0.52], [0.38, 0.6], [0.43, 0.56]], ptsP: [[0.1, 0.11], [0.22, 0.17], [0.34, 0.26], [0.43, 0.27]] }, { at: 0.38, air: true, aim: 24, pts: [[0.57, 0.66], [0.75, 0.74], [0.93, 0.92]], ptsP: [[0.57, 0.4], [0.68, 0.66], [0.8, 0.82], [0.93, 0.9]] }] },
  { id: 'matsu', ja: '雪の松林', v0: 100, ramp: 8, par: [5, 3.5], start: [0.04, 0.06], house: [0.93, 0.86], steam: [], pines: [[0.36, 0.58], [0.64, 0.8]], usagi: [[0.5, 0.36], [0.78, 0.6]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.36, 0.32], [0.5, 0.45], [0.64, 0.55], [0.78, 0.7], [0.93, 0.88]] }] },
  { id: 'nobori', ja: '上り坂', v0: 110, ramp: 10, par: [4.5, 4], start: [0.04, 0.06], house: [0.92, 0.6], steam: [[0.3, 0.42, -0.3, 0.55]], pines: [], usagi: [[0.55, 0.82]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.3, 0.72], [0.45, 0.86], [0.55, 0.88], [0.68, 0.84], [0.8, 0.72], [0.92, 0.62]] }] },
  { id: 'tsumetai', ja: '冷たい手', v0: 120, ramp: 12, par: [5, 3.5], start: [0.04, 0.06], house: [0.94, 0.94], steam: [[0.3, 0.39, -0.3, 1.2], [0.62, 0.71, -0.3, 1.2]], pines: [], usagi: [[0.35, 0.44], [0.67, 0.6]], usagiP: [[0.35, 0.24], [0.67, 0.54]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.2, 0.42], [0.25, 0.5], [0.29, 0.44]], ptsP: [[0.1, 0.11], [0.2, 0.17], [0.29, 0.24]] },
      { at: 0.25, air: true, aim: 20, pts: [[0.41, 0.48], [0.52, 0.6], [0.57, 0.64], [0.61, 0.57]], ptsP: [[0.41, 0.3], [0.61, 0.42]] },
      { at: 0.57, air: true, aim: 20, pts: [[0.73, 0.76], [0.94, 0.96]], ptsP: [[0.73, 0.5], [0.82, 0.8], [0.94, 0.96]] }] },
  { id: 'tsuzura', ja: 'つづら折り', v0: 110, ramp: 10, par: [11, 6], start: [0.04, 0.06], house: [0.14, 0.88], steam: [[-0.2, 0.42, 0.34, 0.66]], pines: [[0.6, 0.5]], usagi: [[0.9, 0.46], [0.42, 0.8]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.5, 0.33], [0.84, 0.45]], ptsP: [[0.1, 0.11], [0.5, 0.22], [0.8, 0.32]] },
      { at: 0.8, air: true, pts: [[0.97, 0.47], [0.8, 0.66], [0.5, 0.8], [0.14, 0.9]], ptsP: [[0.97, 0.36], [0.78, 0.56], [0.5, 0.74], [0.14, 0.9]] }] },
  { id: 'hayabi', ja: '早い火', v0: 250, ramp: 30, par: [5, 3.5], start: [0.04, 0.06], house: [0.94, 0.78], steam: [], pines: [[0.3, 0.75], [0.55, 0.88], [0.78, 0.97]], usagi: [[0.36, 0.38], [0.68, 0.5]], usagiP: [[0.36, 0.22], [0.68, 0.38]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.2, 0.34], [0.34, 0.42]], ptsP: [[0.1, 0.11], [0.2, 0.18], [0.34, 0.26]] },
      { at: 0.3, air: true, aim: 22, pts: [[0.38, 0.46], [0.56, 0.52], [0.66, 0.54]], ptsP: [[0.38, 0.3], [0.56, 0.38], [0.66, 0.42]] },
      { at: 0.62, air: true, aim: 22, pts: [[0.7, 0.58], [0.94, 0.8]], ptsP: [[0.7, 0.46], [0.94, 0.8]] }] },
  { id: 'yukionna', ja: '雪女の山', v0: 210, ramp: 24, par: [5.5, 3.5], start: [0.04, 0.06], house: [0.93, 0.5], steam: [[0.42, 0.5, 0.3, 1.2]], pines: [[0.25, 0.64], [0.76, 0.98], [0.3, 0.06]], usagi: [[0.46, 0.34], [0.62, 0.68], [0.8, 0.6]], usagiP: [[0.46, 0.34], [0.62, 0.55], [0.8, 0.6]],
    bot: [{ at: 0, pts: [[0.07, 0.2], [0.2, 0.36], [0.35, 0.46], [0.41, 0.38]], ptsP: [[0.1, 0.11], [0.2, 0.18], [0.41, 0.31]] },
      { at: 0.4, air: true, aim: 22, pts: [[0.52, 0.6], [0.62, 0.68], [0.72, 0.7], [0.82, 0.64], [0.93, 0.54]], ptsP: [[0.52, 0.38], [0.62, 0.5], [0.7, 0.56], [0.8, 0.56], [0.93, 0.52]] }] },
];

export function fieldFor(w, h) {
  if (w >= h) { const fw = Math.min(w - 220, 820), x0 = (w - fw) / 2; return { land: true, x0, x1: x0 + fw, y0: 150, y1: h * 0.585, bx0: 16, bx1: w - 16, by0: 108, by1: h * 0.625, fallY: h * 0.66 }; }
  return { land: false, x0: 70, x1: w - 70, y0: 280, y1: Math.min(h * 0.66, 880), bx0: 16, bx1: w - 16, by0: 226, by1: h * 0.705, fallY: h * 0.74 };
}
export const mapUV = (f, u, v) => ({ x: f.x0 + u * (f.x1 - f.x0), y: f.y0 + v * (f.y1 - f.y0) });

export function newStage(lv, w, h, opt = {}) {
  const f = fieldFor(w, h), at = ([u, v]) => mapUV(f, u, v), s0 = at(lv.start);
  // 雪の棚: 溶けない、少しだけ右下がりの台。そりはここで待つ
  const ledge = { fixed: true, pts: [], len: 0, fireS: -1e9, fireOn: false, ended: true };
  for (let i = 0; i <= 10; i++) { const x = s0.x - 30 + i * 7, y = s0.y + i * 1.3; if (i) ledge.len += Math.hypot(7, 1.3); ledge.pts.push({ x, y, s: ledge.len }); }
  const p = pointAt(ledge, 14);
  return {
    lv, w, h, field: f, ledge, strokes: [], cur: null, phase: 'aim', t: 0, events: [], reason: null,
    steam: lv.steam.map(([u1, u2, v1, v2]) => { const a = at([u1, v1]), b = at([u2, v2]); return { x0: a.x, x1: b.x, y0: a.y, y1: b.y }; }),
    pines: lv.pines.map((q) => ({ ...at(q), r: PINE_R })), usagi: ((!f.land && lv.usagiP) || lv.usagi).map((q) => ({ ...at(q), got: false })), house: { ...at(lv.house), r: HOUSE_R },
    sled: { mode: 'hold', k: ledge, s: 14, vs: 0, x: p.x, y: p.y, vx: 0, vy: 0, tx: 1, ty: 0, melted: false, from: null, fromS: 0, fromT: -9 },
    goT: -1, rideT: 0, v0: lv.v0 * (opt.speedX || 1), ramp: lv.ramp * (opt.speedX || 1), vmax: 460 * (opt.speedX || 1), hint: !!opt.hint, doneT: 0, pen: null, blockT: -9,
  };
}

export function pointAt(k, s) {
  const P = k.pts; if (P.length < 2) return P[0];
  if (s <= 0) return P[0];
  let lo = 0, hi = P.length - 1;
  if (s >= P[hi].s) return P[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; }
  const a = P[lo], b = P[hi], u = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}
// s の所の向き（少し前後をならして、手ぶれでがたつかないようにする）
function tangentAt(k, s) {
  const a = pointAt(k, Math.max(0, s - 5)), b = pointAt(k, Math.min(k.len, s + 5));
  let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy);
  if (l < 1e-6) { const P = k.pts, q = P[Math.max(0, P.length - 2)], r = P[P.length - 1]; dx = r.x - q.x; dy = r.y - q.y; const m = Math.hypot(dx, dy) || 1; return { x: dx / m, y: dy / m }; }
  return { x: dx / l, y: dy / l };
}
// 氷の上側（そりが乗る側）の向き
const upOf = (t) => (t.x >= 0 ? { x: t.y, y: -t.x } : { x: -t.y, y: t.x });

function blockedAt(st, x, y) {
  const f = st.field;
  if (x < f.bx0 || x > f.bx1 || y < f.by0 || y > f.by1) return 'edge';
  for (const s of st.steam) if (x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1) return 'steam';
  for (const p of st.pines) if (Math.hypot(x - p.x, y - p.y) < p.r + 4) return 'pine';
  return null;
}

export function penDown(st, x, y) {
  if ((st.phase !== 'aim' && st.phase !== 'play') || st.cur) return false;
  const b = blockedAt(st, x, y);
  if (b) { st.events.push({ type: 'block', what: b, x, y }); return false; }
  const k = { pts: [{ x, y, s: 0 }], len: 0, fireS: 0, fireOn: false, age: 0, v: 0, ended: false, gone: false, fx: x, fy: y, id: st.strokes.length };
  st.strokes.push(k); st.cur = k; st.pen = { x, y };
  if (st.phase === 'aim') { st.phase = 'play'; st.goT = st.t + 0.3; }
  st.events.push({ type: 'start', n: k.id });
  return true;
}

export function penMove(st, x, y) {
  const k = st.cur; if (!k || st.phase !== 'play') return;
  st.pen = { x, y };
  for (let guard = 0; guard < 400; guard++) {
    const p = k.pts[k.pts.length - 1], d = Math.hypot(x - p.x, y - p.y);
    if (d < MINSTEP) return;
    const l = Math.min(STEP, d), nx = p.x + ((x - p.x) / d) * l, ny = p.y + ((y - p.y) / d) * l;
    const b = blockedAt(st, nx, ny);
    if (b) { if (st.t - st.blockT > 0.4) { st.blockT = st.t; st.events.push({ type: 'block', what: b, x: nx, y: ny }); } return; }
    k.len += l; k.pts.push({ x: nx, y: ny, s: k.len });
    // 家まで引けたら、筆はそこでおしまい（指を離し忘れても、火に追いつかれない）
    if (Math.hypot(nx - st.house.x, ny - st.house.y) < st.house.r * 0.8) { penUp(st); return; }
  }
}

export function penUp(st) {
  const k = st.cur; if (!k) return;
  k.ended = true; st.cur = null;
  st.events.push({ type: 'lift', n: k.id });
}

function fail(st, reason) {
  if (st.phase !== 'play') return;
  st.phase = 'fail'; st.reason = reason; st.cur = null;
  st.events.push({ type: 'fail', reason, x: st.sled.x, y: st.sled.y });
}

export function step(st, dt = DT) {
  st.t += dt;
  if (st.phase !== 'play' && st.phase !== 'done') return;
  // 火: 線ごとに、引きはじめから少しして始まりに火がつく
  for (const k of st.strokes) {
    if (k.gone) continue;
    k.age += dt;
    if (!k.fireOn && k.age >= GRACE && st.phase === 'play') { k.fireOn = true; st.events.push({ type: 'ignite', n: k.id, x: k.pts[0].x, y: k.pts[0].y }); }
    if (k.fireOn) {
      k.v = Math.min(st.vmax, st.v0 + st.ramp * (k.age - GRACE));
      k.fireS = Math.min(k.len, k.fireS + k.v * (st.phase === 'done' ? 2.5 : 1) * dt);
      if (!k.ended && k.fireS >= k.len - 0.5 && st.phase === 'play') { fail(st, 'caught'); return; }
      if (k.ended && k.fireS >= k.len) { k.gone = true; k.goneT = st.t; st.events.push({ type: 'melted', n: k.id }); }
    }
    const p = pointAt(k, k.fireS); k.fx = p.x; k.fy = p.y;
  }
  if (st.phase !== 'play') return;
  const sl = st.sled;
  if (sl.mode === 'hold') { if (st.goT >= 0 && st.t >= st.goT) { sl.mode = 'ride'; sl.vs = 110; st.events.push({ type: 'go' }); } else return; }
  st.rideT += dt;
  const h = dt / SUB;
  for (let i = 0; i < SUB && st.phase === 'play'; i++) { if (sl.mode === 'ride') ride(st, sl, h); else air(st, sl, h); touch(st, sl); }
  if (st.phase === 'play' && st.rideT > 45) fail(st, 'stuck');
}

function ride(st, sl, h) {
  const k = sl.k;
  if (!k.fixed && (k.gone || k.fireS >= sl.s - 2)) { sl.melted = true; detach(st, sl, 'melt'); return; }
  const t = tangentAt(k, sl.s);
  const gs = G * t.y, fr = MU * G * Math.abs(t.x);
  if (Math.abs(sl.vs) < 2 && Math.abs(gs) <= fr) sl.vs = 0;
  else sl.vs += (gs - Math.sign(sl.vs || gs) * fr - DRAG * sl.vs * Math.abs(sl.vs)) * h;
  const s1 = sl.s + sl.vs * h;
  const lo = k.fixed ? 0 : Math.max(0, k.fireS);
  if (s1 >= k.len || s1 <= lo) {
    // 線の端（または溶けた所）から飛び出す
    const p = pointAt(k, Math.max(lo, Math.min(k.len, s1)));
    sl.x = p.x; sl.y = p.y; sl.s = Math.max(lo, Math.min(k.len, s1)); detach(st, sl, s1 >= k.len ? 'end' : 'melt'); return;
  }
  const q = pointAt(k, s1), t1 = tangentAt(k, s1), n = upOf(t1);
  sl.s = s1; sl.x = q.x; sl.y = q.y; sl.tx = t1.x; sl.ty = t1.y;
  // 坂が上がわへ丸く折れて（山なりで）、速さのわりに曲がりがきついと、そりは浮く
  const ta = tangentAt(k, Math.min(k.len, s1 + 8)), tb = tangentAt(k, Math.max(0, s1 - 8)), kn = ((ta.x - tb.x) * n.x + (ta.y - tb.y) * n.y) / 16;
  if (kn < 0 && sl.vs * sl.vs * -kn > G * -n.y * 1.05 + 30) detach(st, sl, 'jump');
}

function detach(st, sl, why) {
  const t = tangentAt(sl.k, sl.s);
  sl.vx = t.x * sl.vs; sl.vy = t.y * sl.vs; sl.from = sl.k; sl.fromS = sl.s; sl.fromT = st.t;
  sl.mode = 'air'; sl.k = null;
  if (why !== 'melt') sl.melted = false;
  st.events.push({ type: 'air', why, x: sl.x, y: sl.y });
}

function air(st, sl, h) {
  const sp = Math.hypot(sl.vx, sl.vy);
  sl.vx -= DRAG * sp * sl.vx * h; sl.vy += G * h - DRAG * sp * sl.vy * h;
  const x1 = sl.x + sl.vx * h, y1 = sl.y + sl.vy * h;
  // 着地: 動いた線分が、氷の線分を上から横切ったら乗る
  let best = null;
  for (const k of [st.ledge, ...st.strokes]) {
    if (k.gone || k.pts.length < 2) continue;
    const P = k.pts;
    for (let j = 1; j < P.length; j++) {
      const a = P[j - 1], b = P[j];
      if (!k.fixed && b.s <= k.fireS + 3) continue;
      const hit = segX(sl.x, sl.y, x1, y1, a.x, a.y, b.x, b.y); if (!hit) continue;
      const s = a.s + (b.s - a.s) * hit.v;
      if (k === sl.from && Math.abs(s - sl.fromS) < 2.5 && st.t - sl.fromT < 0.05) continue;
      if (!k.fixed && s <= k.fireS + 3) continue;
      const tx = (b.x - a.x) / ((b.s - a.s) || 1), ty = (b.y - a.y) / ((b.s - a.s) || 1), n = upOf({ x: tx, y: ty });
      if (sl.vx * n.x + sl.vy * n.y >= 0) continue; // 下からは通り抜ける
      if (!best || hit.u < best.u) best = { u: hit.u, k, s, tx, ty };
    }
  }
  if (best) {
    const k = best.k, t = tangentAt(k, best.s), vn = Math.abs(sl.vx * upOf(t).x + sl.vy * upOf(t).y);
    sl.mode = 'ride'; sl.k = k; sl.s = best.s; sl.vs = (sl.vx * t.x + sl.vy * t.y) * 0.96; sl.melted = false;
    const p = pointAt(k, best.s); sl.x = p.x; sl.y = p.y; sl.tx = t.x; sl.ty = t.y;
    st.events.push({ type: 'land', x: p.x, y: p.y, hard: vn });
    return;
  }
  sl.x = x1; sl.y = y1;
}

// 線分 p0→p1 と a→b の交わり（u: p の側の割合、v: a→b の割合）
function segX(px, py, qx, qy, ax, ay, bx, by) {
  const rx = qx - px, ry = qy - py, sx = bx - ax, sy = by - ay, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const u = ((ax - px) * sy - (ay - py) * sx) / den, v = ((ax - px) * ry - (ay - py) * rx) / den;
  return u > 1e-7 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
}

// そりの体（線より少し上）が、うさぎ・松・家・谷に触れたか
function touch(st, sl) {
  if (st.phase !== 'play') return;
  const n = sl.mode === 'ride' ? upOf({ x: sl.tx, y: sl.ty }) : { x: 0, y: -1 }, bx = sl.x + n.x * BODY, by = sl.y + n.y * BODY;
  for (const u of st.usagi) if (!u.got && Math.hypot(bx - u.x, by - u.y) < USAGI_R) { u.got = true; st.events.push({ type: 'usagi', x: u.x, y: u.y, n: st.usagi.filter((q) => q.got).length }); }
  const H = st.house;
  if (Math.hypot(bx - H.x, by - H.y) < H.r) {
    st.phase = 'done'; st.doneT = st.t; sl.mode = 'home'; st.cur = null;
    st.events.push({ type: 'done', x: H.x, y: H.y });
    return;
  }
  for (const p of st.pines) if (Math.hypot(bx - p.x, by - p.y) < p.r + 6) { fail(st, 'pine'); return; }
  const f = st.field;
  if (sl.y > f.fallY || sl.x < -30 || sl.x > st.w + 30) fail(st, sl.melted ? 'melt' : 'fell');
}

// 手早さの目安（秒）: 横長と縦長で道の長さがちがうので、別々に決める
export const parOf = (st) => st.lv.par[st.field.land ? 0 : 1];

// 星: 家に帰れたら 1、手早ければ 2、雪うさぎをぜんぶ拾えたら 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  return 1 + (st.rideT <= parOf(st) ? 1 : 0) + (st.usagi.every((u) => u.got) ? 1 : 0);
}

// 運転手: 面ごとの線を、そりの位置を見ながら順に引く。
// at: そりがその横の位置（u）を越えたら引きはじめる。air: そりが宙に浮いてから。aim: 最初の点の高さを、そりの落ちてくる所に合わせる（人が目で見て合わせるのと同じ）
// 縦長の画面では ptsP があればそちらを使う
export function bot(st, mem, speed = 8.4) {
  const list = st.lv.bot;
  if (mem.k === undefined) { mem.k = 0; mem.i = 0; mem.on = false; }
  if (st.phase !== 'aim' && st.phase !== 'play') return null;
  const f = st.field, sl = st.sled;
  if (!mem.on) {
    if (mem.k >= list.length) return null;
    const b = list[mem.k];
    if (b.at && sl.x < mapUV(f, b.at, 0).x) return null;
    if (b.air && sl.mode !== 'air') return null;
    mem.pts = ((!f.land && b.ptsP) || b.pts).map((q) => mapUV(f, q[0], q[1]));
    if (b.aim) {
      // そりの飛ぶ道を先読みして、落ちてくる所の少し下から引く
      const p0 = mem.pts[0]; let x = sl.x, y = sl.y, vx = sl.vx, vy = sl.vy;
      for (let i = 0; i < 400 && x < p0.x; i++) { const h = 1 / 120, sp = Math.hypot(vx, vy); vx -= DRAG * sp * vx * h; vy += G * h - DRAG * sp * vy * h; x += vx * h; y += vy * h; }
      const dy = Math.max(-60, Math.min(160, y + b.aim - p0.y));
      const last = mem.k === list.length - 1; // 家へ向かう最後の線は、終わりを家に残したまま傾ける
      mem.pts = mem.pts.map((q, i) => ({ x: q.x, y: Math.min(f.by1 - 4, q.y + dy * (last ? Math.max(0, 1 - i / Math.max(1, mem.pts.length - 1)) : 1)) }));
    }
    mem.p = { ...mem.pts[0] }; mem.i = 1; mem.on = true;
    return { down: [mem.p.x, mem.p.y] };
  }
  if (mem.i >= mem.pts.length) { mem.on = false; mem.k++; return { up: true }; }
  const t = mem.pts[mem.i], dx = t.x - mem.p.x, dy = t.y - mem.p.y, d = Math.hypot(dx, dy);
  if (d <= speed) { mem.p = { x: t.x, y: t.y }; mem.i++; } else { mem.p = { x: mem.p.x + (dx / d) * speed, y: mem.p.y + (dy / d) * speed }; }
  return { move: [mem.p.x, mem.p.y] };
}
