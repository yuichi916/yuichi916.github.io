// 第五章「狐の嫁入り」のルール。DOM に触らない。
// こんどは遊ぶ人が火。狐が先を走って青い線を引く。線のはじまりに筆を置き、線から外れずに追って、社に着く前に狐の尾をつかまえる。
// 線から外れると火がゆらぎ、外れたままだと消える。天気雨の夜は、のろのろしていると雨で火が冷える。
export const DT = 1 / 60;
const STEP = 5; // 道の点の間かく

export function rng32(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// rows: [横長の段の数, 縦長の段の数]。wave: 段の波の高さ（段の間かくに対する割合）。loops / decoys: 道全体の中の位置（0〜1）
// fox: walk 歩く速さ・dash 駆ける速さ・dashLen 駆ける長さ・alarm 筆がこれより近づくと駆けだす・stops [道の位置, 待つ秒]
//   最後の待ちは社の鳥居の前。ここでは逃げない（尾をつかまえる好機）。待ちきると社に入ってしまう
// rain: 雨が火を冷やす強さ（毎秒）。lat: 提灯が道からはなれている幅。tol: 線から外れたとみなす幅
export const LEVELS = [
  { id: 'michi', ja: '嫁入りの道', rows: [1, 2], wave: 0, waveN: 0, loops: [], decoys: [], rain: 0, lanterns: 3, lat: 38, tol: 64,
    fox: { walk: 125, dash: 540, dashLen: 130, alarm: 110, stops: [[0.5, 1.8], [0.86, 4.0]] } },
  { id: 'kawa', ja: '川べりの道', rows: [1, 1], wave: 0.3, waveN: 3, loops: [], decoys: [], rain: 0, lanterns: 4, lat: 40, tol: 62,
    fox: { walk: 160, dash: 580, dashLen: 140, alarm: 110, stops: [[0.35, 1.3], [0.65, 1.3], [0.88, 3.2]] } },
  { id: 'tsuzura', ja: 'つづら折り', rows: [2, 3], wave: 0.12, waveN: 2, loops: [], decoys: [], rain: 0, lanterns: 5, lat: 42, tol: 60,
    fox: { walk: 180, dash: 600, dashLen: 160, alarm: 115, stops: [[0.3, 1.1], [0.62, 1.1], [0.9, 3.0]] } },
  { id: 'wa', ja: '狐の輪', rows: [2, 3], wave: 0, waveN: 0, loops: [0.22, 0.52, 0.8], decoys: [], rain: 0, lanterns: 5, lat: 42, tol: 58,
    fox: { walk: 185, dash: 600, dashLen: 160, alarm: 115, stops: [[0.36, 1.0], [0.66, 1.0], [0.91, 2.8]] } },
  { id: 'ame', ja: '天気雨', rows: [2, 3], wave: 0.22, waveN: 3, loops: [], decoys: [], rain: 0.3, lanterns: 6, lat: 44, tol: 58,
    fox: { walk: 200, dash: 620, dashLen: 170, alarm: 120, stops: [[0.3, 0.9], [0.6, 0.9], [0.92, 2.6]] } },
  { id: 'kitsunebi', ja: '狐火の分かれ道', rows: [2, 3], wave: 0.16, waveN: 2, loops: [], decoys: [0.2, 0.47, 0.72], rain: 0.2, lanterns: 6, lat: 44, tol: 56,
    fox: { walk: 205, dash: 620, dashLen: 200, alarm: 120, stops: [[0.33, 0.9], [0.6, 0.9], [0.92, 2.5]] } },
  { id: 'hayagake', ja: '早駆け', rows: [2, 3], wave: 0.1, waveN: 2, loops: [0.3, 0.7], decoys: [0.52], rain: 0.3, lanterns: 6, lat: 46, tol: 56,
    fox: { walk: 265, dash: 680, dashLen: 220, alarm: 125, stops: [[0.45, 0.7], [0.94, 2.1]] } },
  { id: 'gyoretsu', ja: '最後の行列', rows: [2, 3], wave: 0.14, waveN: 3, loops: [0.2, 0.62], decoys: [0.36, 0.64, 0.88], rain: 0.38, lanterns: 7, lat: 46, tol: 54,
    fox: { walk: 285, dash: 720, dashLen: 240, alarm: 125, stops: [[0.3, 0.6], [0.6, 0.6], [0.955, 2.0]] } },
];
// 遊ぶ所。上は文字の帯、横長の下は町
export function fieldFor(w, h) {
  return w >= h ? { x0: 120, x1: w - 120, y0: 150, y1: h * 0.575 } : { x0: 76, x1: w - 76, y0: 262, y1: h * 0.65 };
}

// 道を作る: 段を左右に往復するつづら折り。段の上に波と輪をのせ、段の端は半円で折り返す
export function buildPath(lv, w, h) {
  const f = fieldFor(w, h), land = w >= h, nr = lv.rows[land ? 0 : 1], fh = f.y1 - f.y0;
  const m = nr > 1 ? fh * 0.1 : 0, gap = nr > 1 ? (fh - 2 * m) / (nr - 1) : fh;
  const ys = nr > 1 ? Array.from({ length: nr }, (_, i) => f.y0 + m + gap * i) : [(f.y0 + f.y1) / 2];
  const rU = nr > 1 ? Math.min(gap / 2, 96) : 0, xa = f.x0 + rU, xb = f.x1 - rU; // 折り返しは、角の丸い縦の道
  const A = lv.wave * (nr > 1 ? gap : fh * 0.8);
  // 輪を段ごとに割りふる（段の端に近すぎない所へ）
  const loopsBy = ys.map(() => []);
  for (const q of lv.loops) { const g = q * nr, r = Math.min(nr - 1, Math.floor(g)); loopsBy[r].push(Math.max(0.2, Math.min(0.8, g - r))); }
  const raw = [];
  const push = (x, y, k) => raw.push({ x, y, k });
  ys.forEach((yr, i) => {
    const dir = i % 2 ? -1 : 1;
    const xs = i === 0 ? (dir > 0 ? f.x0 : f.x1) : (dir > 0 ? xa : xb);
    const xe = i === nr - 1 ? (dir > 0 ? f.x1 : f.x0) : (dir > 0 ? xb : xa);
    const span = Math.abs(xe - xs), U = loopsBy[i].sort((a, b) => a - b);
    const roomUp = i === 0 ? yr - f.y0 : gap / 2, roomDn = i === nr - 1 ? f.y1 - yr : gap / 2;
    const up = roomUp >= roomDn, b = Math.min(48, Math.max(roomUp, roomDn) * 0.46), a = b * 0.42;
    const wv = (u) => { let k = A * Math.sin(Math.PI * lv.waveN * u); for (const c of U) k *= 1 - Math.exp(-(((u - c) / 0.09) ** 2)); return k; };
    const straight = (x1, x2) => { const n = Math.max(1, Math.ceil(Math.abs(x2 - x1) / 4)); for (let j = 0; j <= n; j++) { const x = x1 + ((x2 - x1) * j) / n, u = Math.abs(x - xs) / span; push(x, yr + wv(u), 'row'); } };
    let cur = xs;
    for (const c of U) {
      const xc = xs + dir * c * span, w0 = wv(c);
      straight(cur, xc - dir * Math.PI * a);
      for (let j = 1; j <= 64; j++) { const th = -Math.PI + (j / 64) * 2 * Math.PI; push(xc + dir * (a * th - b * Math.sin(th)), yr + w0 + (up ? -1 : 1) * b * (1 + Math.cos(th)), 'loop'); }
      cur = xc + dir * Math.PI * a;
    }
    straight(cur, xe);
    if (i < nr - 1) {
      // 四分の一の円・縦のまっすぐ・四分の一の円で、次の段へ折り返す
      const cx = dir > 0 ? xb : xa, y2 = ys[i + 1], ex = cx + dir * rU;
      for (let j = 1; j <= 20; j++) { const ph = (j / 20) * (Math.PI / 2); push(cx + dir * rU * Math.sin(ph), yr + rU * (1 - Math.cos(ph)), 'turn'); }
      const n = Math.max(1, Math.ceil((y2 - yr - 2 * rU) / 4)); for (let j = 1; j < n; j++) push(ex, yr + rU + ((y2 - yr - 2 * rU) * j) / n, 'turn');
      for (let j = 0; j < 20; j++) { const ph = (j / 20) * (Math.PI / 2); push(cx + dir * rU * Math.cos(ph), y2 - rU + rU * Math.sin(ph), 'turn'); }
    }
  });
  // 同じ間かくの点に並べなおす
  const pts = [{ x: raw[0].x, y: raw[0].y, s: 0, k: raw[0].k }];
  let acc = 0, carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1], b = raw[i], d = Math.hypot(b.x - a.x, b.y - a.y); if (d < 1e-6) continue;
    let u = STEP - carry;
    while (u <= d) { acc += STEP; pts.push({ x: a.x + ((b.x - a.x) * u) / d, y: a.y + ((b.y - a.y) * u) / d, s: acc, k: b.k }); u += STEP; }
    carry = d - (u - STEP);
  }
  const last = raw[raw.length - 1]; if (carry > 0.5) pts.push({ x: last.x, y: last.y, s: acc + carry, k: last.k });
  return { pts, L: pts[pts.length - 1].s, f, gap };
}

export function pointAt(st, s) {
  const P = st.pts, i = Math.max(0, Math.min(P.length - 2, Math.floor(s / STEP))), a = P[i], b = P[i + 1];
  const u = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}
export function tangentAt(st, s) {
  const a = pointAt(st, Math.max(0, s - 6)), b = pointAt(st, Math.min(st.L, s + 6)), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}
// 道のうち s が lo〜hi の所で、点 p にいちばん近い所
function nearest(st, p, lo, hi) {
  const P = st.pts; let best = Infinity, bs = lo;
  const i0 = Math.max(0, Math.floor(lo / STEP)), i1 = Math.min(P.length - 1, Math.ceil(hi / STEP));
  for (let i = i0; i < i1; i++) {
    const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    let u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2; u = Math.max(0, Math.min(1, u));
    let s = a.s + (b.s - a.s) * u; if (s > hi) { s = hi; u = (hi - a.s) / (b.s - a.s || 1); } if (s < lo) { s = lo; u = (lo - a.s) / (b.s - a.s || 1); }
    const d = Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u);
    if (d < best) { best = d; bs = s; }
  }
  return { d: best, s: bs };
}

function inBox(p, f, mx = 30, my = 26) { return p.x > f.x0 - mx && p.x < f.x1 + mx && p.y > f.y0 - my && p.y < f.y1 + my; }
// その点から、道の s0 のあたり（±skip）を除いた所までの、いちばん近い距離
function clearance(st, p, s0, skip) { let d = Infinity; for (const q of st.pts) if (Math.abs(q.s - s0) > skip) d = Math.min(d, Math.hypot(q.x - p.x, q.y - p.y)); return d; }

// 提灯: 道の脇に吊るす。近くを通ると火が移る
function placeLanterns(st, lv) {
  const n = lv.lanterns, last = lv.fox.stops[lv.fox.stops.length - 1][0] - 0.07; // 鳥居の前より手前に
  // 吊るせる所の候補（輪の上・分かれ道のそばは避ける。ほかの道から十分はなれている）
  const cand = [];
  for (let s = 0.1 * st.L; s <= (last + 0.04) * st.L; s += 10) {
    const P = st.pts[Math.round(s / STEP)]; if (!P || P.k === 'loop') continue;
    if (st.decoys.some((d) => Math.abs(d.s0 - s) < 90)) continue;
    const t = tangentAt(st, s), c = pointAt(st, s);
    for (const side of [-1, 1]) {
      const q = { x: c.x - t.y * side * lv.lat, y: c.y + t.x * side * lv.lat };
      if (inBox(q, st.f, 22, 30) && clearance(st, q, s, 70) >= lv.lat + 22) cand.push({ s, x: q.x, y: q.y, side });
    }
  }
  for (const gapS of [170, 140]) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const want = st.L * (0.12 + ((last - 0.12) * i) / Math.max(1, n - 1)), pref = i % 2 ? 1 : -1;
      let best = null, bd = Infinity;
      for (const c of cand) {
        if (out.some((o) => Math.abs(o.s - c.s) < gapS || Math.hypot(o.x - c.x, o.y - c.y) < 70)) continue;
        const d = Math.abs(c.s - want) + (c.side === pref ? 0 : 25);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) out.push({ ...best, lit: false, missed: false, auto: false });
    }
    if (out.length === n) return out.sort((a, b) => a.s - b.s);
    if (gapS === 140) return out.sort((a, b) => a.s - b.s);
  }
  return [];
}

// 狐火の分かれ道: 本当の道が曲がる側と逆へ、にせの線がのびる
function placeDecoys(st, lv) {
  const out = [], LEN = 150, rowAt = (s) => { const P = st.pts[Math.round(Math.max(0, Math.min(st.L, s)) / STEP)]; return P && P.k !== 'loop'; };
  const lastStop = lv.fox.stops[lv.fox.stops.length - 1][0] * st.L;
  for (const q of lv.decoys) {
    // 望みの位置に近い順に、置ける所を探す
    const tries = []; for (let k = 0; k <= 100; k++) tries.push(q * st.L + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10);
    let placed = false;
    for (const s of tries) {
      if (placed) break;
      if (s < 200 || s > lastStop - 160 || !rowAt(s) || !rowAt(s + 60) || !rowAt(s + 120) || !rowAt(s - 30)) continue;
      if (out.some((d) => Math.abs(d.s0 - s) < 190)) continue;
      const t = tangentAt(st, s), nx = -t.y, ny = t.x, c = pointAt(st, s), ah = pointAt(st, Math.min(st.L, s + 110));
      const bend = (ah.x - c.x) * nx + (ah.y - c.y) * ny, first = bend > 0 ? -1 : 1;
      for (const [side, a0, cv] of [[first, 0.42, 0.0025], [first, 0.6, -0.001], [-first, 0.42, 0.0025], [-first, 0.6, -0.001]]) {
        if (placed) break;
        const pts = [{ x: c.x, y: c.y, d: 0 }]; let ang = Math.atan2(t.y, t.x) + side * a0, x = c.x, y = c.y, ok = true;
        for (let d = STEP; d <= LEN; d += STEP) { ang += side * cv * STEP; x += Math.cos(ang) * STEP; y += Math.sin(ang) * STEP; if (!inBox({ x, y }, st.f, 34, 28)) { ok = false; break; } pts.push({ x, y, d }); }
        if (!ok) continue;
        // にせの線の途中も、本当の道の先とまじわらない
        if (pts.some((p) => clearance(st, p, s, 150) < lv.tol * 0.8)) continue;
        const end = pts[pts.length - 1]; if (clearance(st, end, s, 40) < lv.tol + 16) continue;
        out.push({ s0: s, pts, len: LEN }); placed = true;
      }
    }
  }
  return out.sort((a, b) => a.s0 - b.s0);
}

export function newStage(lv, w, h, opt = {}) {
  const { pts, L, f } = buildPath(lv, w, h);
  const st = {
    lv, w, h, f, pts, L, phase: 'aim', events: [], t: 0, age: 0, reason: null,
    foxS: 120, lastS: 0, mode: 'walk', wait: 0, stop: 0, dashLeft: 0, sP: 0, pen: null, on: true, dist: 0, heat: 1, v: 0, offT: 0, coldT: 0,
    tol: lv.tol, catchR: 34, lightR: 30, decoys: [], lanterns: [], doneT: 0, hint: !!opt.hint,
  };
  st.decoys = placeDecoys(st, lv);
  st.lanterns = placeLanterns(st, lv);
  return st;
}

function fail(st, reason) { st.phase = 'fail'; st.reason = reason; st.events.push({ type: 'fail', reason }); }

export function penDown(st, x, y) {
  if (st.phase !== 'aim') return false;
  const p0 = st.pts[0];
  if (Math.hypot(x - p0.x, y - p0.y) > 46) { st.events.push({ type: 'miss', x, y }); return false; }
  st.phase = 'run'; st.pen = { x, y }; st.sP = 0; st.age = 0; st.mode = 'dash'; st.dashLeft = st.lv.fox.dashLen;
  st.events.push({ type: 'start' });
  return true;
}
export function penMove(st, x, y) { if (st.phase !== 'run') return; st.pen = { x, y }; project(st); }
export function penUp(st) { if (st.phase === 'run') fail(st, 'lift'); }

// 筆が線の上にあるか。あれば火を進める（さかのぼったり、輪を飛びこえたりはできない）
function project(st) {
  const p = st.pen; if (!p) return;
  const r = nearest(st, p, Math.max(0, st.sP - 60), Math.min(st.foxS, st.sP + 130));
  st.dist = r.d;
  const on = r.d <= st.tol;
  if (on !== st.on) { st.on = on; st.events.push({ type: on ? 'back' : 'off' }); }
  if (on && r.s > st.sP) st.sP = Math.min(st.foxS, r.s);
}

// 狐の足: 歩く・駆ける・待つ。筆が近づくと駆けだす。最後の待ち（鳥居の前）だけは逃げない
function foxStep(st, dt) {
  const F = st.lv.fox, stops = F.stops, gap = st.foxS - st.sP, lastStop = st.stop >= stops.length;
  if (st.mode === 'last') { st.wait -= dt; if (st.wait <= 0) { st.mode = 'home'; st.events.push({ type: 'home' }); } return; }
  if (st.mode === 'wait') {
    st.wait -= dt;
    if (gap < F.alarm) { st.mode = 'dash'; st.dashLeft = F.dashLen; st.events.push({ type: 'dash' }); }
    else if (st.wait <= 0) st.mode = 'walk';
    else return;
  }
  if (st.mode === 'walk' && gap < F.alarm && !lastStop) { st.mode = 'dash'; st.dashLeft = F.dashLen; st.events.push({ type: 'dash' }); }
  let ds = (st.mode === 'walk' ? F.walk : F.dash) * dt;
  if (st.mode === 'dash') { st.dashLeft -= ds; if (st.dashLeft <= 0) st.mode = 'walk'; }
  const nx = stops[st.stop];
  if (nx && st.mode !== 'home' && st.foxS + ds >= nx[0] * st.L) {
    ds = Math.max(0, nx[0] * st.L - st.foxS); st.wait = nx[1]; st.stop++;
    st.mode = st.stop >= stops.length ? 'last' : 'wait'; st.events.push({ type: 'wait', last: st.mode === 'last' });
  }
  st.foxS += ds;
}

export function step(st, dt = DT) {
  st.t += dt;
  if (st.phase === 'run') {
    st.age += dt;
    foxStep(st, dt);
    if (st.foxS >= st.L) { st.foxS = st.L; fail(st, 'escaped'); return; }
    project(st);
    const v = (st.sP - st.lastS) / dt; st.lastS = st.sP; st.v = st.v * 0.88 + v * 0.12;
    // 火の勢い: 線の上なら戻る。雨の夜は、速く進んでいないと冷える。外れていると、すぐ弱る
    const rain = st.lv.rain;
    const dh = st.on ? (rain ? 1.2 * Math.min(1, st.v / 300) - rain : 0.9) : -1.05 - rain;
    if (!st.on) st.offT += dt;
    if (st.on && dh < 0) st.coldT += dt;
    st.heat = Math.max(0, Math.min(1, st.heat + dh * dt));
    if (st.heat <= 0) { fail(st, st.on ? 'rain' : 'out'); return; }
    // 提灯
    for (const l of st.lanterns) {
      if (l.lit || l.missed) continue;
      if (st.on && st.pen && Math.hypot(st.pen.x - l.x, st.pen.y - l.y) < st.lightR) { l.lit = true; st.events.push({ type: 'lantern', i: st.lanterns.indexOf(l) }); }
      else if (st.sP > l.s + 70) { l.missed = true; st.events.push({ type: 'lanternMiss', i: st.lanterns.indexOf(l) }); }
    }
    // 尾をつかまえた
    if (st.on && st.sP >= st.foxS - st.catchR) {
      st.phase = 'done'; st.doneT = st.t; st.events.push({ type: 'catch' }); st.events.push({ type: 'done' });
    }
  } else if (st.phase === 'done') {
    // 行列の提灯に、残りの火が順に移る
    const k = Math.floor((st.t - st.doneT) / 0.12);
    const rest = st.lanterns.filter((l) => !l.lit && !l.missed);
    if (rest.length && k >= st.lanterns.filter((l) => l.auto).length) { const l = rest[0]; l.lit = true; l.auto = true; st.events.push({ type: 'lantern', i: st.lanterns.indexOf(l), auto: true }); }
  }
}

export const litCount = (st) => st.lanterns.filter((l) => l.lit).length;
// 星: つかまえたら 1、通りすぎた提灯をひとつも取りこぼさなければ 2、一度も線から外れなければ 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  return 1 + (st.lanterns.every((l) => !l.missed) ? 1 : 0) + (st.offT === 0 ? 1 : 0);
}

// 運転手: 線の少し先をめざして筆を運ぶ。提灯の近くでは、提灯のほうへ寄る
export function bot(st, mem) {
  if (st.phase === 'aim') { const p = st.pts[0]; mem.p = { x: p.x, y: p.y }; mem.s = 0; return { down: [p.x, p.y] }; }
  if (st.phase !== 'run') return null;
  // 自分の目あて mem.s を一定の速さで進める。線を見失ったら、火のいる所からやりなおす
  mem.s = Math.min(st.foxS, mem.s + (mem.v || 8.4)); if (mem.s - st.sP > 70) mem.s = st.sP + 20;
  const sT = mem.s, c = pointAt(st, sT), t = tangentAt(st, sT);
  let ox = 0, oy = 0;
  for (const l of st.lanterns) {
    if (l.lit || l.missed) continue;
    const w = Math.max(0, 1 - Math.abs(sT - l.s) / 85); if (w <= 0) continue;
    ox += -t.y * l.side * st.lv.lat * 0.8 * w; oy += t.x * l.side * st.lv.lat * 0.8 * w;
  }
  const gx = c.x + ox, gy = c.y + oy, dx = gx - mem.p.x, dy = gy - mem.p.y, d = Math.hypot(dx, dy), v = 8.9;
  if (d > v) { mem.p.x += (dx / d) * v; mem.p.y += (dy / d) * v; } else { mem.p.x = gx; mem.p.y = gy; }
  return { move: [mem.p.x, mem.p.y] };
}
