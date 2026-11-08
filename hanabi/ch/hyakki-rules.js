// 第六章「百鬼夜行」のルール。DOM に触らない。
// 太鼓に合わせて一筆。妖怪の面が出て、輪がしぼんだ拍の時に、筆で面を通りぬける。線のはじまりからは火が追ってくるので、止まって待てない。
// 拍はステージの時計（st.t）で刻む。筆を置くと、次の拍から四つ数えて、面が出はじめる。
export const DT = 1 / 60;
export const GOOD = 0.15, PERFECT = 0.07; // 拍の前後、何秒までなら通ったことにするか

export function rng32(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// bpm: 太鼓の速さ。n: 面の数。ivs: 面と面の間の拍（くりかえす。0.5 は一拍に二つ）。D: 一拍で動く道のり。
// turn: 曲がりかた（flow なめらか / zig 拍ごとに大きく折れる / mix まぜる）。fire: 火の速さ。r: 面の当たりの大きさ。
// maxMiss: これより多く外すと終わり。appr: 輪が出てから拍までの拍数。mobs: 面の妖怪
export const LEVELS = [
  { id: 'don', ja: 'はじめの太鼓', bpm: 72, n: 8, ivs: [2], D: 105, turn: 'flow', fire: 55, r: 50, maxMiss: 4, appr: 2, mobs: ['mask'], seed: 11 },
  { id: 'men', ja: '面の行列', bpm: 80, n: 12, ivs: [1], D: 140, turn: 'flow', fire: 80, r: 46, maxMiss: 4, appr: 2, mobs: ['mask'], seed: 23 },
  { id: 'kodama', ja: '山彦のこだま', bpm: 88, n: 16, ivs: [1, 1, 2], D: 145, turn: 'mix', fire: 100, r: 44, maxMiss: 4, appr: 2, mobs: ['yamabiko', 'mask'], seed: 37 },
  { id: 'magari', ja: 'ドンで曲がる', bpm: 92, n: 18, ivs: [1], D: 160, turn: 'zig', fire: 115, r: 44, maxMiss: 4, appr: 2, mobs: ['tengu', 'mask'], seed: 41 },
  { id: 'kamaitachi', ja: '鎌鼬の早駆け', bpm: 104, n: 22, ivs: [1, 0.5, 0.5], D: 150, turn: 'flow', fire: 130, r: 42, maxMiss: 5, appr: 2, mobs: ['kamaitachi'], seed: 53 },
  { id: 'haratsuzumi', ja: '狸の腹鼓', bpm: 100, n: 22, ivs: [1, 1, 1.5, 0.5], D: 155, turn: 'mix', fire: 130, r: 42, maxMiss: 5, appr: 2, mobs: ['tanuki', 'mask'], seed: 67 },
  { id: 'fubuki', ja: '雪女の吹雪', bpm: 110, n: 24, ivs: [1, 1, 0.5, 0.5, 1], D: 160, turn: 'mix', fire: 145, r: 40, maxMiss: 5, appr: 1.25, mobs: ['yukionna'], seed: 71 },
  { id: 'hyakki', ja: '百鬼夜行', bpm: 120, n: 36, ivs: [1, 1, 0.5, 0.5, 1, 0.5, 0.5, 2], D: 165, turn: 'mix', fire: 160, r: 40, maxMiss: 6, appr: 2, mobs: ['tengu', 'kamaitachi', 'yamabiko', 'kitsune', 'tanuki', 'yukionna', 'neko', 'mask'], seed: 89 },
];
export const COUNT_IN = 4;

// 遊ぶ所と、太鼓の置き場（遊ぶ所の外の角）
export function fieldFor(w, h) {
  return w >= h ? { x0: 180, x1: w - 120, y0: 152, y1: h * 0.565 } : { x0: 84, x1: w - 84, y0: 272, y1: h * 0.6 };
}
export function taikoAt(w, h) { return w >= h ? { x: 84, y: h * 0.5 } : { x: w / 2, y: h * 0.645 }; }

// 譜面を作る: 前の面から、決まった道のりと曲がりかたで次の面を置く。近くの拍の面とは重ねない
export function makeChart(lv, w, h) {
  const f = fieldFor(w, h), rnd = rng32(lv.seed * 2654435761 + w * 7 + h), r = lv.r, start = { x: f.x0 + 30, y: (f.y0 + f.y1) / 2 };
  const tk = taikoAt(w, h), out = [];
  let pos = start, head = 0, beat = 0, flip = 1;
  const inField = (p) => p.x > f.x0 + r * 0.6 && p.x < f.x1 - r * 0.6 && p.y > f.y0 + r * 0.5 && p.y < f.y1 - r * 0.5 && Math.hypot(p.x - tk.x, p.y - tk.y) > 120;
  // 近い拍（見えている間が重なる）の面からの、いちばん近い距離
  const sepAt = (p, b) => { let m = Infinity; for (const o of out) if (Math.abs(o.beat - b) <= 3.2) m = Math.min(m, Math.hypot(o.x - p.x, o.y - p.y)); if (b <= 3) m = Math.min(m, Math.hypot(p.x - start.x, p.y - start.y) * 1.5); return m; };
  for (let i = 0; i < lv.n; i++) {
    const iv = i === 0 ? 0 : lv.ivs[(i - 1) % lv.ivs.length];
    beat += iv;
    const dist0 = i === 0 ? lv.D * 1.2 : iv <= 1 ? lv.D * Math.max(0.55, iv) : lv.D * (1 + (iv - 1) * 0.6);
    const zig = lv.turn === 'zig' || (lv.turn === 'mix' && rnd() < 0.3);
    let best = null, bestScore = -Infinity;
    for (let k = 0; k < 200; k++) {
      let turn;
      if (k >= 40) turn = (rnd() - 0.5) * 2 * Math.PI; // 決まった曲がりかたで置けなければ、どの向きでも
      else if (i === 0) turn = (rnd() - 0.5) * 0.8;
      else if (zig) { turn = -flip * (1.9 + rnd() * 0.6); }
      else turn = (rnd() < 0.7 ? flip : -flip) * (0.15 + rnd() * 0.65);
      const dist = dist0 * (k >= 100 ? (k % 2 ? 0.85 : 1.15) : 1);
      const a = head + turn, p = { x: pos.x + Math.cos(a) * dist, y: pos.y + Math.sin(a) * dist };
      if (!inField(p)) continue;
      const sep = sepAt(p, beat);
      if (sep > r * 2.5 && k < 40) { best = { p, a, turn }; break; }
      const sc = Math.min(sep, r * 4) - (k >= 40 ? r * 0.3 : 0);
      if (sc > bestScore) { bestScore = sc; best = { p, a, turn }; }
    }
    if (!best) { const p = { x: Math.max(f.x0 + r, Math.min(f.x1 - r, pos.x)), y: Math.max(f.y0 + r, Math.min(f.y1 - r, pos.y + lv.D)) }; best = { p, a: head, turn: 0 }; }
    if (zig) flip = -flip; else if (best.turn) flip = Math.sign(best.turn) || flip;
    if (!zig && rnd() < 0.25) flip = -flip;
    out.push({ i, beat, x: best.p.x, y: best.p.y, mob: lv.mobs[i % lv.mobs.length] });
    head = Math.atan2(best.p.y - pos.y, best.p.x - pos.x); pos = best.p;
  }
  return { targets: out, start, f };
}

export function newStage(lv, w, h, opt = {}) {
  const { targets, start, f } = makeChart(lv, w, h), spb = 60 / lv.bpm;
  return {
    lv, w, h, f, start, spb, taiko: taikoAt(w, h), phase: 'aim', events: [], t: 0, reason: null,
    targets: targets.map((o) => ({ ...o, tb: 0, state: 'wait', inside: false, bestD: Infinity, bestT: 0, at: 0, off: 0 })),
    songStart: 0, gBeat: -1, pts: [], len: 0, fireS: 0, fireOn: false, fx: 0, fy: 0, fi: 0, pen: null, prev: null,
    hit: 0, perfect: 0, miss: 0, combo: 0, maxCombo: 0, minGap: Infinity, r: lv.r, appr: Math.max(0.9, (lv.appr || 2) * spb), hint: !!opt.hint,
  };
}
// 拍の時計: 筆を置いてからの「曲の時間」。0 で四つ数えはじめ、COUNT_IN 拍めから面
export const songT = (st) => st.t - st.songStart;
export const lastTb = (st) => st.targets[st.targets.length - 1].tb;

function fail(st, reason) { st.phase = 'fail'; st.reason = reason; st.events.push({ type: 'fail', reason }); }

export function penDown(st, x, y) {
  if (st.phase !== 'aim') return false;
  if (Math.hypot(x - st.start.x, y - st.start.y) > 52) { st.events.push({ type: 'miss', x, y }); return false; }
  // 次の拍（近すぎれば、その次）から数えはじめる
  const k = Math.ceil(st.t / st.spb + 0.3);
  st.songStart = k * st.spb;
  for (const o of st.targets) o.tb = (COUNT_IN + o.beat) * st.spb;
  st.phase = 'play'; st.pts = [{ x, y, s: 0 }]; st.len = 0; st.pen = { x, y }; st.prev = { x, y }; st.fx = x; st.fy = y;
  st.events.push({ type: 'start' });
  return true;
}
export function penMove(st, x, y) {
  if (st.phase !== 'play') return;
  st.pen = { x, y };
  const l = st.pts[st.pts.length - 1], d = Math.hypot(x - l.x, y - l.y);
  if (d > 3) { st.len += d; st.pts.push({ x, y, s: st.len }); }
}
export function penUp(st) { if (st.phase === 'play') fail(st, 'lift'); }

function pointAt(st, s) {
  const P = st.pts; if (P.length < 2) return P[0] || { x: 0, y: 0 };
  let i = Math.min(st.fi, P.length - 2); while (i < P.length - 2 && P[i + 1].s < s) i++; st.fi = i;
  const a = P[i], b = P[i + 1], u = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

// 面の判定: 拍の前後 GOOD 秒のうちに筆が面の輪に入れば当たり。いちばん中心に近づいた時で、拍とのずれを測る
function judge(st, dt) {
  const c = songT(st), a = st.prev || st.pen, b = st.pen;
  for (const o of st.targets) {
    if (o.state !== 'wait') continue;
    if (c < o.tb - GOOD - dt) break; // 面は拍の順に並んでいる
    // このコマの筆の動き（a→b）のうち、面の中心にいちばん近い所
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    const u = L2 > 0 ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.y - a.y) * dy) / L2)) : 1;
    const d = Math.hypot(a.x + dx * u - o.x, a.y + dy * u - o.y), tc = c - dt + dt * u;
    const inWin = tc >= o.tb - GOOD && tc <= o.tb + GOOD;
    if (inWin && d <= st.r) { o.inside = true; if (d < o.bestD) { o.bestD = d; o.bestT = tc; } }
    const leftNow = o.inside && Math.hypot(b.x - o.x, b.y - o.y) > st.r;
    if (o.inside && (leftNow || c > o.tb + GOOD)) {
      o.off = o.bestT - o.tb; o.state = 'hit'; o.at = c; st.hit++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo);
      const pf = Math.abs(o.off) <= PERFECT; if (pf) st.perfect++;
      st.events.push({ type: 'hit', i: o.i, perfect: pf, off: o.off });
    } else if (!o.inside && c > o.tb + GOOD) {
      o.state = 'miss'; o.at = c; st.miss++; st.combo = 0; st.events.push({ type: 'targetMiss', i: o.i });
    }
  }
}

export function step(st, dt = DT) {
  st.t += dt;
  // 太鼓は、筆を置く前から鳴っている（速さを耳でおぼえる）
  const g = Math.floor(st.t / st.spb + 1e-9);
  if (g !== st.gBeat && (st.phase === 'aim' || st.phase === 'play')) {
    st.gBeat = g;
    const rel = st.phase === 'play' ? Math.round((g * st.spb - st.songStart) / st.spb) : null;
    st.events.push({ type: 'beat', g, rel, count: rel !== null && rel >= 0 && rel < COUNT_IN ? COUNT_IN - rel : 0, pre: st.phase === 'aim' });
  }
  if (st.phase !== 'play') return;
  const c = songT(st);
  if (!st.fireOn && c >= 2 * st.spb) { st.fireOn = true; st.events.push({ type: 'ignite' }); }
  if (st.fireOn) {
    st.fireS += st.lv.fire * dt;
    const gap = st.len - st.fireS; st.minGap = Math.min(st.minGap, gap);
    if (gap <= 0) { st.fireS = st.len; const p = pointAt(st, st.fireS); st.fx = p.x; st.fy = p.y; fail(st, 'caught'); return; }
    const p = pointAt(st, st.fireS); st.fx = p.x; st.fy = p.y;
  }
  judge(st, dt);
  st.prev = st.pen ? { ...st.pen } : null;
  if (st.miss > st.lv.maxMiss) { fail(st, 'miss'); return; }
  if (st.targets.every((o) => o.state !== 'wait')) { st.phase = 'done'; st.doneT = st.t; st.events.push({ type: 'done' }); }
}

// 星: 越えたら 1、面の 85% 以上に当てたら 2、60% 以上がぴったり（拍の前後 0.07 秒）なら 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  const n = st.targets.length;
  return 1 + (st.hit >= n * 0.85 ? 1 : 0) + (st.perfect >= n * 0.6 ? 1 : 0);
}

// 運転手: 面から面へ、拍ちょうどに中心を通る。間があくときは、火に追いつかれないように波を描いて道のりをかせぐ
function plan(st) {
  const f = st.f, T = st.targets, vf = st.lv.fire, knots = [{ c: 0, x: st.start.x, y: st.start.y }];
  for (const o of T) knots.push({ c: o.tb, x: o.x, y: o.y });
  const l = T[T.length - 1], p = T[T.length - 2] || { x: st.start.x, y: st.start.y }, dl = Math.hypot(l.x - p.x, l.y - p.y) || 1;
  knots.push({ c: l.tb + 0.6, x: Math.max(f.x0, Math.min(f.x1, l.x + ((l.x - p.x) / dl) * 120)), y: Math.max(f.y0, Math.min(f.y1, l.y + ((l.y - p.y) / dl) * 120)) });
  const segs = [];
  for (let k = 0; k + 1 < knots.length; k++) {
    const a = knots[k], b = knots[k + 1], d = Math.hypot(b.x - a.x, b.y - a.y), dc = b.c - a.c;
    const need = Math.max(d, vf * 1.35 * dc), m = Math.max(1, Math.ceil(need / 200));
    const shape = (A, u) => { const nx = d > 0 ? -(b.y - a.y) / d : 0, ny = d > 0 ? (b.x - a.x) / d : 1, w = A * Math.sin(Math.PI * m * u); return { x: Math.max(f.x0 - 40, Math.min(f.x1 + 40, a.x + (b.x - a.x) * u + nx * w)), y: Math.max(f.y0 - 30, Math.min(f.y1 + 30, a.y + (b.y - a.y) * u + ny * w)) }; };
    const lenOf = (A) => { let L = 0, q = shape(A, 0); for (let i = 1; i <= 40; i++) { const r = shape(A, i / 40); L += Math.hypot(r.x - q.x, r.y - q.y); q = r; } return L; };
    let A = 0;
    if (need > d + 1) { let lo = 0, hi = 260; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (lenOf(mid) < need) lo = mid; else hi = mid; } A = hi; }
    segs.push({ a, b, A, shape });
  }
  return segs;
}
export function bot(st, mem) {
  if (st.phase === 'aim') { mem.p = { ...st.start }; return { down: [st.start.x, st.start.y] }; }
  if (st.phase !== 'play') return null;
  if (!mem.segs) mem.segs = plan(st);
  const c = songT(st) + DT, sg = mem.segs.find((q) => c <= q.b.c) || mem.segs[mem.segs.length - 1];
  const u = Math.max(0, Math.min(1, (c - sg.a.c) / (sg.b.c - sg.a.c || 1))), g = sg.shape(sg.A, u);
  const dx = g.x - mem.p.x, dy = g.y - mem.p.y, d = Math.hypot(dx, dy), v = 8.9;
  if (d > v) { mem.p.x += (dx / d) * v; mem.p.y += (dy / d) * v; } else { mem.p.x = g.x; mem.p.y = g.y; }
  return { move: [mem.p.x, mem.p.y] };
}
