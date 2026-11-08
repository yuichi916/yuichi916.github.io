// 一筆花火 物語「影絵の宿」— 燃えた線だけが障子に影を落とす。DOM に触らない。
// 決まり: 行灯のそばの「手元」で線を引く。線の影は 行灯 + (筆 − 行灯) × k の所に映る（行灯から遠いほど大きい）。
// 影になるのは、火が燃やしたところだけ。障子のお題の印に、燃えた影が十分に重なれば越える。お題から遠い影は、はみ出し。
export const DT = 1 / 60;

// お題の形は [-1, 1] の箱の中の折れ線（y は下向き）。route は運転手の筆順（省けば segs を 1 本ずつ）
const loop = (...p) => [...p, p[0]];
const FOX = [loop([-0.6, -0.95], [-0.22, -0.38], [0.22, -0.38], [0.6, -0.95], [0.78, -0.1], [0.52, 0.38], [0, 0.95], [-0.52, 0.38], [-0.78, -0.1])];
const CRANE = [loop([-1, -0.4], [-0.32, 0.12], [-0.02, -0.95], [0.2, 0.12], [0.72, -0.55], [0.98, -0.42], [0.36, 0.48], [-0.4, 0.48])];
const RABBIT = [loop([0, 0.92], [-0.55, 0.74], [-0.68, 0.28], [-0.46, -0.12], [-0.62, -0.88], [-0.44, -1], [-0.2, -0.2], [0.2, -0.2], [0.44, -1], [0.62, -0.88], [0.46, -0.12], [0.68, 0.28], [0.55, 0.74])];
const TORII = [
  [[-1, -0.78], [-0.5, -0.64], [0, -0.6], [0.5, -0.64], [1, -0.78]], // 笠木
  [[-0.78, -0.32], [0.78, -0.32]], // 貫
  [[-0.5, -0.64], [-0.56, 0.95]], [[0.5, -0.64], [0.56, 0.95]], // 柱
];
const TORII_ROUTE = [
  [[-1, -0.78], [-0.5, -0.64], [0, -0.6], [0.5, -0.64], [1, -0.78], [0.5, -0.64], [0.56, 0.95]],
  [[-0.56, 0.95], [-0.5, -0.64], [-0.512, -0.32], [-0.78, -0.32], [0.78, -0.32]],
];
const FUJI = [loop([-1, 0.78], [-0.55, 0.2], [-0.24, -0.52], [-0.12, -0.6], [0, -0.52], [0.12, -0.6], [0.24, -0.52], [0.55, 0.2], [1, 0.78])];
const CAT_BODY = [[0.55, 0.95], [-0.55, 0.95], [-0.64, 0.42], [-0.4, -0.02], [-0.44, -0.42], [-0.46, -0.95], [-0.18, -0.66], [0.18, -0.66], [0.46, -0.95], [0.44, -0.42], [0.4, -0.02], [0.64, 0.42], [0.55, 0.95]];
const CAT_TAIL = [[0.9, 0.3], [1, 0.58], [0.86, 0.88], [0.55, 0.95]];
const CAT = [CAT_BODY, CAT_TAIL];
const CAT_ROUTE = [[...CAT_TAIL, ...CAT_BODY.slice(1)]];
const arcSide = (s) => Array.from({ length: 9 }, (_, i) => { const th = -Math.PI / 2 + (i / 8) * Math.PI; return [s * (0.32 + 0.32 * Math.cos(th)), 0.72 * Math.sin(th)]; });
// 提灯: 胴と、まんなかの丸い紋
const CREST = Array.from({ length: 17 }, (_, i) => [0.3 * Math.sin((i / 16) * Math.PI * 2), -0.3 * Math.cos((i / 16) * Math.PI * 2)]);
const LANTERN = [[[-0.32, -0.88], [0.32, -0.88], ...arcSide(1), [0.32, 0.88], [-0.32, 0.88], ...arcSide(-1).reverse(), [-0.32, -0.88]], CREST];
// 最後のお題: おかっぱの髪、着物の袖、帯の後ろ姿
const GIRL = [
  loop([-0.42, 1], [-0.36, 0.42], [-0.62, 0.22], [-0.62, -0.1], [-0.44, -0.26], [-0.3, -0.34], [-0.33, -0.6], [-0.22, -0.84], [0, -0.92], [0.22, -0.84], [0.33, -0.6], [0.3, -0.34], [0.44, -0.26], [0.62, -0.1], [0.62, 0.22], [0.36, 0.42], [0.42, 1]),
  [[-0.4, 0.04], [-0.18, 0.04], [-0.18, 0.3], [0.18, 0.3], [0.18, 0.04], [0.4, 0.04]],
];

// k: 影の大きさ（行灯からの距離の倍率）。kAmp/kPer: 行灯がゆれる。mirror: 影が左右さかさま。flicker: 行灯がまたたく。
// strokes: 筆を置ける回数。ghost: 手元にお題の下書き。reveal: お題がひとりでに浮かぶ。速さは手元の線の長さで数える
export const LEVELS = [
  { id: 'kitsune', ja: '狐', segs: FOX, k: 2.0, ghost: true, v0: 40, ramp: 4, grace: 1.4, rk: 0.25 },
  { id: 'tsuru', ja: '鶴', segs: CRANE, k: 2.0, v0: 60, ramp: 6, rk: 0.23 },
  { id: 'usagi', ja: '兎', segs: RABBIT, k: 2.3, v0: 70, ramp: 8, rk: 0.22 },
  { id: 'torii', ja: '鳥居', segs: TORII, route: TORII_ROUTE, strokes: 2, k: 2.1, v0: 75, ramp: 8, rk: 0.22 },
  { id: 'fuji', ja: '富士山', segs: FUJI, k: 2.1, kAmp: 0.25, kPer: 4.5, v0: 80, ramp: 9, rk: 0.22 },
  { id: 'neko', ja: '猫', segs: CAT, route: CAT_ROUTE, k: 2.1, mirror: true, v0: 65, ramp: 6, rk: 0.22 },
  { id: 'chochin', ja: '提灯', segs: LANTERN, strokes: 2, k: 2.2, flicker: true, v0: 90, ramp: 10, rk: 0.21 },
  { id: 'ushiro', ja: '後ろ姿', segs: GIRL, strokes: 2, k: 2.2, kAmp: 0.15, kPer: 6, reveal: true, v0: 100, ramp: 12, rk: 0.21 },
];
export const PASS = 0.7, GOOD = 0.85, STRAY_MAX = 0.3, STRAY_FINE = 0.12;

// 置き場所: 横長は 行灯 → 手元 → 障子 が左から右、縦長は下から上
const M = 1.15, PAD = 14, PAD_TOP = 30, GAP = 10;
const need = (S, k) => (S + PAD + GAP + (M * S) / k) / (1 - 1 / k); // 行灯からお題の真ん中まで。これより近いと、手元が障子にかかる
export function layout(lv, w, h) {
  const kMin = lv.k - (lv.kAmp || 0);
  if (w >= h) {
    const x0 = 50, x1 = w - 40, y0 = 116, y1 = h * 0.6;
    let S = Math.min(150, (y1 - y0 - PAD_TOP - PAD) / 2);
    while (46 + need(S, kMin) + S + PAD > x1 - x0 && S > 60) S *= 0.97;
    const D = need(S, kMin), span = 46 + D + S + PAD, left = (x0 + x1) / 2 - span / 2;
    const T = { x: left + 46 + D, y: y0 + PAD_TOP + S };
    const L = { x: left + 46, y: T.y + S * 0.22 };
    return { land: true, S, T, L, paper: { x0: T.x - S - PAD, x1: T.x + S + PAD, y0: T.y - S - PAD_TOP, y1: T.y + S + PAD } };
  }
  const x0 = 60, x1 = w - 60, y0 = 232, Ly = h * 0.68 - 34, A0 = Ly - y0 - PAD_TOP;
  let S = Math.min(200, (x1 - x0) / 2 - PAD);
  while (need(S, kMin) + S > A0 && S > 60) S *= 0.98;
  const T = { x: w / 2, y: y0 + PAD_TOP + S }, L = { x: w / 2, y: T.y + need(S, kMin) };
  return { land: false, S, T, L, paper: { x0: Math.max(40, T.x - S - 70), x1: Math.min(w - 40, T.x + S + 70), y0: T.y - S - PAD_TOP, y1: T.y + S + PAD } };
}

export function kAt(st, t = st.t) { const lv = st.lv; return lv.k + (lv.kAmp ? lv.kAmp * Math.sin((t / lv.kPer) * Math.PI * 2) : 0); }
// 筆の所 → 影の所
export function shadowOf(st, x, y, t = st.t) {
  const k = kAt(st, t), L = st.L; let sx = L.x + (x - L.x) * k;
  const sy = L.y + (y - L.y) * k;
  if (st.lv.mirror) sx = 2 * st.T.x - sx;
  return { x: sx, y: sy };
}
// 影の所 → 筆の所（運転手と、手元の下書き用）
export function handOf(st, sx, sy, t = st.t) {
  const k = kAt(st, t), L = st.L; if (st.lv.mirror) sx = 2 * st.T.x - sx;
  return { x: L.x + (sx - L.x) / k, y: L.y + (sy - L.y) / k };
}
// 手元の枠: お題の箱（少し広め）を、行灯へ縮めた所
export function handBox(st, t = st.t) {
  const a = handOf(st, st.T.x - M * st.S, st.T.y - M * st.S, t), b = handOf(st, st.T.x + M * st.S, st.T.y + M * st.S, t);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
}
// 行灯がまたたく面: 1.9 秒のうち 0.6 秒は暗い（お題も筆の影も見えない。燃えた影は残る）
export const lampOn = (st, t = st.t) => !st.lv.flicker || ((t + 0.6) % 1.9) < 1.3;

const toShadow = (st, [u, v]) => ({ x: st.T.x + u * st.S, y: st.T.y + v * st.S });
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; const u = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0; return Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u); };

export function newStage(lv, w, h, opt = {}) {
  const lay = layout(lv, w, h);
  const st = {
    lv, w, h, ...lay, phase: 'aim', events: [], t: 0, strokes: [], cur: null, strokesLeft: (lv.strokes || 1),
    R: lv.rk * lay.S, cov: 0, covered: 0, shadowLen: 0, strayLen: 0, stray: 0, lastPct: 0, wait: 0, minGap: Infinity, drawT: 0,
    hint: !!opt.hint, reason: null, pen: null, doneT: 0,
  };
  st.strayR = st.R * 1.7;
  // お題の線（影の座標）と、重なりを数える印
  st.tsegs = []; st.cps = [];
  const sp = Math.max(8, lay.S * 0.07);
  for (const line of lv.segs) {
    const P = line.map((q) => toShadow(st, q));
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(d / sp));
      st.tsegs.push([a, b]);
      for (let j = 0; j < n; j++) st.cps.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n, hit: false });
    }
    if (line[0][0] !== line[line.length - 1][0] || line[0][1] !== line[line.length - 1][1]) { const e = P[P.length - 1]; st.cps.push({ x: e.x, y: e.y, hit: false }); }
  }
  st.route = (lv.route || lv.segs).map((line) => line.map((q) => toShadow(st, q)));
  return st;
}

export const distToTarget = (st, p) => { let d = Infinity; for (const [a, b] of st.tsegs) d = Math.min(d, segDist(p, a, b)); return d; };
export function inHand(st, x, y, m = 22) { const b = handBox(st); return x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m; }

export function penDown(st, x, y) {
  if (st.phase !== 'aim' && st.phase !== 'aim2') return false;
  if (!inHand(st, x, y)) { st.events.push({ type: 'miss', x, y }); return false; }
  const s = shadowOf(st, x, y);
  st.cur = { pts: [{ x, y, s: 0, sx: s.x, sy: s.y }], len: 0, fireS: 0, fireOn: false, age: 0, v: 0, burnIdx: 0, fx: x, fy: y, from: st.phase };
  st.strokes.push(st.cur); st.phase = 'draw'; st.pen = { x, y };
  st.events.push({ type: 'start', n: st.strokes.length });
  return true;
}

export function penMove(st, x, y) {
  if (st.phase !== 'draw') return;
  st.pen = { x, y };
  const k = st.cur, last = k.pts[k.pts.length - 1], dx = x - last.x, dy = y - last.y, d = Math.hypot(dx, dy);
  if (d < 2) return;
  const n = Math.max(1, Math.ceil(d / 6));
  for (let i = 1; i <= n; i++) {
    const px = last.x + (dx * i) / n, py = last.y + (dy * i) / n, s = shadowOf(st, px, py);
    k.len += d / n; k.pts.push({ x: px, y: py, s: k.len, sx: s.x, sy: s.y });
  }
}

export function penUp(st) {
  if (st.phase !== 'draw') return;
  const k = st.cur;
  if (k.len < 14) { st.strokes.pop(); st.phase = k.from; st.cur = null; st.events.push({ type: 'cancel' }); return; } // 押し間違いは数えない
  st.strokesLeft--; st.phase = 'burn';
  st.events.push({ type: 'lift' });
}

// 火が通った所の影を、障子に焼きつける
function burnTo(st, k) {
  const P = k.pts;
  while (k.burnIdx + 1 < P.length && P[k.burnIdx + 1].s <= k.fireS) {
    const a = { x: P[k.burnIdx].sx, y: P[k.burnIdx].sy }, b = { x: P[k.burnIdx + 1].sx, y: P[k.burnIdx + 1].sy };
    for (const c of st.cps) if (!c.hit && segDist(c, a, b) < st.R) { c.hit = true; st.covered++; }
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    st.shadowLen += L;
    if (distToTarget(st, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) > st.strayR) st.strayLen += L;
    k.burnIdx++;
  }
  st.cov = st.covered / st.cps.length;
  st.stray = st.shadowLen > 0 ? st.strayLen / st.shadowLen : 0;
  const pct = Math.floor(st.cov * 10 + 1e-9);
  if (pct > st.lastPct) { st.lastPct = pct; st.events.push({ type: 'cover', pct }); }
}

function fail(st, reason) { st.phase = 'fail'; st.reason = reason; st.events.push({ type: 'fail', reason }); }
function finish(st) {
  if (st.cov >= PASS && st.stray <= STRAY_MAX) { st.phase = 'done'; st.doneT = st.t; st.events.push({ type: 'bloom' }); }
  else fail(st, st.cov < PASS ? 'short' : 'stray');
}

export function pointAt(k, s) {
  const P = k.pts; if (P.length < 2) return P[0] || { x: 0, y: 0 };
  let i = 0; while (i < P.length - 2 && P[i + 1].s < s) i++;
  const a = P[i], b = P[i + 1], u = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

export function step(st, dt = DT) {
  st.t += dt;
  const k = st.cur, lv = st.lv;
  if (st.phase === 'draw') {
    k.age += dt; st.drawT += dt;
    if (!k.fireOn && k.age >= (lv.grace || 1.0)) { k.fireOn = true; st.events.push({ type: 'ignite' }); }
    if (k.fireOn) {
      k.v = Math.min(400, lv.v0 + lv.ramp * (k.age - (lv.grace || 1.0)));
      k.fireS += k.v * dt;
      const gap = k.len - k.fireS;
      st.minGap = Math.min(st.minGap, gap);
      if (gap <= 0) { k.fireS = k.len; burnTo(st, k); fail(st, 'caught'); }
      else burnTo(st, k);
    }
  } else if (st.phase === 'burn') {
    // 筆を離したら、残りは一気に燃える
    k.fireOn = true; k.fireS = Math.min(k.len, k.fireS + Math.max(k.v, 300) * 3 * dt);
    burnTo(st, k);
    if (k.fireS >= k.len) {
      if (st.cov >= GOOD || st.strokesLeft <= 0) finish(st);
      else { st.phase = 'aim2'; st.wait = 4.5; st.events.push({ type: 'more', left: st.strokesLeft }); }
    }
  } else if (st.phase === 'aim2') {
    st.wait -= dt; if (st.wait <= 0) finish(st);
  }
  if (k) { const p = pointAt(k, Math.min(k.fireS, k.len)); k.fx = p.x; k.fy = p.y; }
}

// 星: 越えたら 1、重なり 85% で 2、そのうえ はみ出しが少なければ 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  return 1 + (st.cov >= GOOD ? 1 : 0) + (st.cov >= GOOD && st.stray <= STRAY_FINE ? 1 : 0);
}

// 手本どおりに影をなぞる運転手。影の所から筆の所を逆算して、1 コマ 4 まで動かす（人と同じくらいの速さ）
export function bot(st, mem) {
  if (mem.si === undefined) { mem.si = 0; }
  if (st.phase === 'aim' || st.phase === 'aim2') {
    if (mem.si >= st.route.length) return null; // 描く物がもうない（待てば終わる）
    const R = st.route[mem.si]; mem.line = R; mem.sig = 0; mem.seg = 0;
    const h = handOf(st, R[0].x, R[0].y); mem.p = { ...h }; mem.si++;
    return { down: [h.x, h.y] };
  }
  if (st.phase !== 'draw' || !mem.line) return null;
  const R = mem.line;
  if (mem.seg >= R.length - 1) { mem.line = null; return { up: true }; }
  let budget = 4;
  while (budget > 1e-6 && mem.seg < R.length - 1) {
    const a = R[mem.seg], b = R[mem.seg + 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, u = Math.min(1, mem.sig / L);
    const q = handOf(st, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u), d = Math.hypot(q.x - mem.p.x, q.y - mem.p.y);
    if (d <= budget) {
      mem.p = q; budget -= d;
      if (u >= 1) { mem.seg++; mem.sig = 0; } else mem.sig = Math.min(L, mem.sig + 3);
    } else { mem.p.x += ((q.x - mem.p.x) / d) * budget; mem.p.y += ((q.y - mem.p.y) / d) * budget; budget = 0; }
  }
  return { move: [mem.p.x, mem.p.y] };
}
