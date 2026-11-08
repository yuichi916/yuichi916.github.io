// 第3章「影絵の宿」: 燃えた線だけが障子に影を落とす。ルールは ./kage-rules.js。ここは章の型（_dev/hanabi-chapter-contract.md）に合わせる包み
import * as Z from './kage-rules.js';

export const CHAPTER = { id: 'kage', no: 3, ja: '影絵の宿', sky: 'yado', band: 'summer' };
export const LEVELS = Z.LEVELS;
export const FAIL = { caught: '火に追いつかれた', short: '影が、お題に足りない', stray: '影が、お題からはみ出しすぎた' };

export function newStage(lv, W, H, opt = {}) { return Z.newStage(lv, W, H, opt); }
export const penDown = Z.penDown, penMove = Z.penMove, penUp = Z.penUp, starsFor = Z.starsFor;
export function step(st, dt) { Z.step(st, dt); }
// 失敗のあと: 2 度しくじると、手元にお題の下書きが出る
export function retry(lv, fails, opt) { return { ...opt, hint: fails >= 2 }; }
export const bot = Z.bot;

const pct = (v) => Math.round(v * 100);
export function info(st) {
  const lv = st.lv;
  if (st.phase === 'aim') {
    const extra = lv.mirror ? '影は<em>左右さかさま</em>' : lv.flicker ? '行灯が<em>またたく</em>' : lv.kAmp && !lv.reveal ? '行灯が<em>ゆれる</em>' : (lv.strokes || 1) > 1 ? '<em>二筆</em>まで描ける' : '';
    return extra ? `<em>手元の枠</em>で描く ・ ${extra}` : '<em>手元の枠</em>で描いて、影を重ねる';
  }
  if (st.phase === 'aim2') return `もう一筆 <em>${Math.max(1, Math.ceil(st.wait))}</em> ・ 重なり ${pct(st.cov)}%`;
  return `重なり <em>${pct(st.cov)}%</em> ・ はみ出し ${pct(st.stray)}%`;
}

const revealU = (st) => (st.lv.reveal ? Math.min(1, st.t / 2.2) : 1);
export function labels(st) {
  const out = [];
  if (revealU(st) >= 1) out.push({ x: st.T.x, y: st.paper.y0 + 16, text: st.lv.ja, cls: 'big' });
  if (st.phase === 'aim' || st.phase === 'aim2') { const b = Z.handBox(st); out.push({ x: (b.x0 + b.x1) / 2, y: b.y1 + 16, text: '手元', cls: 'dim' }); }
  return out;
}

// 燃えた影の点（障子の上だけ）。絵の数に限りがあるので、長い影ほど間を広げる
function shadowDots(st) {
  const p = st.paper, segs = [];
  let total = 0;
  for (const k of st.strokes) for (let i = 0; i < k.burnIdx && i + 1 < k.pts.length; i++) { const a = k.pts[i], b = k.pts[i + 1], l = Math.hypot(b.sx - a.sx, b.sy - a.sy); segs.push([a, b, l]); total += l; }
  const sp = Math.max(7, total / 180), out = [];
  let acc = sp;
  for (const [a, b, l] of segs) {
    while (acc <= l) { const u = acc / l, x = a.sx + (b.sx - a.sx) * u, y = a.sy + (b.sy - a.sy) * u; if (x > p.x0 + 3 && x < p.x1 - 3 && y > p.y0 + 3 && y < p.y1 - 3) out.push([x, y]); acc += sp; }
    acc -= l;
  }
  return { out, size: Math.max(14, sp * 2) };
}
const BLACK = -1 / 2.4; // 絵の光を引いて、真っ黒の影にする

export function draw(st, api) {
  const L = st.L, lit = Z.lampOn(st, st.t);
  api.put(L.x, L.y, 34, 'andon', lit ? 0.45 : 0.05, 'story', lit ? 1 : 0.75);
  const { out, size } = shadowDots(st);
  for (const [x, y] of out) api.put(x, y, size, 'shoji_dot', BLACK, 'story', 0.92);
  st.strokes.forEach((k) => {
    if (k.pts.length < 2) return;
    const live = k === st.cur && st.phase === 'draw', gap = k.len - k.fireS;
    api.ribbon({ pts: k.pts, len: k.len, flameS: k.fireS, heatLv: live && k.fireOn ? (gap < 45 ? 2 : gap < 90 ? 1 : 0) : 0, flameOn: k.fireOn, width: 3.4 });
  });
  // 筆の影（いまの筆先が、障子のどこに映るか）
  if (st.phase === 'draw' && st.pen && lit) { const s = Z.shadowOf(st, st.pen.x, st.pen.y); api.put(s.x, s.y, 9, 'shoji_dot', BLACK, 'story', 0.5); }
  const k = st.cur;
  if (k && k.fireOn && (st.phase === 'draw' || st.phase === 'burn')) api.put(k.fx, k.fy - 5, 24, api.HINOKO + (st.phase === 'draw' && k.len - k.fireS < 45 ? 1 : 0), 0.2, 'shell');
}

const dotted = (fx, one, a, b, sp, size, col, al) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.floor(d / sp)); for (let i = 0; i <= n; i++) { const u = i / n; fx.add(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0, 0, one, size, 0, 0, col, col, al); } };
const rect = (fx, one, r, sp, size, col, al) => { const A = { x: r.x0, y: r.y0 }, B = { x: r.x1, y: r.y0 }, C2 = { x: r.x1, y: r.y1 }, D = { x: r.x0, y: r.y1 }; for (const [a, b] of [[A, B], [B, C2], [C2, D], [D, A]]) dotted(fx, one, a, b, sp, size, col, al); };

export function particles(st, api) {
  const { fx, one, t, dt } = api, L = st.L, P = st.paper, lit = Z.lampOn(st, st.t), lv = st.lv;
  const on = lit ? 1 : 0.28;
  // 障子の紙: 行灯に近いほど明るい
  const far = Math.hypot(P.x1 - L.x, P.y0 - L.y);
  for (let y = P.y0 + 12; y < P.y1 - 6; y += 13) for (let x = P.x0 + 12; x < P.x1 - 6; x += 13) {
    const f = (1 - 0.4 * Math.min(1, Math.hypot(x - L.x, y - L.y) / far)) * on, c = [0.9 * f, 0.62 * f, 0.32 * f];
    fx.add(x, y, 0, 0, one, 30, 0, 0, c, c, 0.13);
  }
  // 組子（桟）と枠
  const nx = Math.max(3, Math.round((P.x1 - P.x0) / 80)), ny = Math.max(3, Math.round((P.y1 - P.y0) / 80));
  const kc = [0.9 * on, 0.55 * on, 0.25 * on];
  for (let i = 1; i < nx; i++) { const x = P.x0 + ((P.x1 - P.x0) * i) / nx; dotted(fx, one, { x, y: P.y0 }, { x, y: P.y1 }, 9, 1.3, kc, 0.5); }
  for (let j = 1; j < ny; j++) { const y = P.y0 + ((P.y1 - P.y0) * j) / ny; dotted(fx, one, { x: P.x0, y }, { x: P.x1, y }, 9, 1.3, kc, 0.5); }
  rect(fx, one, P, 6, 2.6, [1.0, 0.6, 0.28], 0.75);
  // 行灯の光と、光の広がり
  fx.add(L.x, L.y - 4, 0, 0, one, 64, 0, 0, [1.1, 0.62, 0.24], [1.1, 0.62, 0.24], 0.32 * on);
  fx.light(L.x, L.y, 0.45 * on, 320, [1, 0.6, 0.25]);
  const cone = st.land ? [{ x: P.x0, y: P.y0 }, { x: P.x0, y: P.y1 }] : [{ x: P.x0, y: P.y1 }, { x: P.x1, y: P.y1 }];
  for (const c of cone) dotted(fx, one, L, c, 15, 1.2, [0.7 * on, 0.45 * on, 0.2 * on], 0.4);
  // お題の印（燃えた影が重なると金色）
  const ru = revealU(st);
  if (lit) {
    let total = 0; for (const [a, b] of st.tsegs) total += Math.hypot(b.x - a.x, b.y - a.y);
    let acc = 0, head = null;
    for (const [a, b] of st.tsegs) {
      const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.floor(d / 9));
      for (let i = 0; i < n; i++) {
        const s = acc + (d * i) / n; if (s > ru * total) break;
        const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, tw = 0.75 + 0.25 * Math.sin(t * 3 + s * 0.05);
        fx.add(x, y, 0, 0, one, 3, 0, 0, [0.55, 0.85, 2.4], [0.55, 0.85, 2.4], 0.95 * tw);
        head = { x, y };
      }
      acc += d;
    }
    if (ru < 1 && head) fx.add(head.x, head.y, 0, 0, one, 12, 0, 0, [1.6, 1.8, 3], [1.6, 1.8, 3], 1.4);
    for (const c of st.cps) if (c.hit) fx.add(c.x, c.y, 0, 0, one, 3.2, 0, 0, [2.6, 1.7, 0.6], [2.6, 1.7, 0.6], 1.1);
  }
  // 手元の枠と、下書き
  const hb = Z.handBox(st), aim = st.phase === 'aim' || st.phase === 'aim2', pul = aim ? 0.7 + 0.3 * Math.sin(t * 4) : 0.35;
  rect(fx, one, hb, 9, aim ? 2 : 1.5, [1.2, 0.85, 0.45], pul);
  if (lv.ghost || st.hint) for (const [a, b] of st.tsegs) dotted(fx, one, Z.handOf(st, a.x, a.y), Z.handOf(st, b.x, b.y), 5, 1.6, [1.5, 1.15, 0.6], 0.55);
  // 筆先から影までの光の筋
  if (st.phase === 'draw' && st.pen && lit) {
    const s = Z.shadowOf(st, st.pen.x, st.pen.y);
    dotted(fx, one, st.pen, s, 16, 1.2, [1.2, 0.85, 0.45], 0.3);
    for (let j = 0; j < 14; j++) { const a = (j / 14) * 6.283 + t * 2; fx.add(s.x + Math.cos(a) * 12, s.y + Math.sin(a) * 12, 0, 0, one, 1.6, 0, 0, [2.4, 1.6, 0.6], [2.4, 1.6, 0.6], 1); }
    fx.add(st.pen.x, st.pen.y, 0, 0, one, 7, 0, 0, [2.4, 2, 1.2], [2, 1.5, 0.8], 0.8);
  }
  // 越えたあと: 影がきらめく
  if (st.phase === 'done' && st.t - st.doneT < 1.6) { const { out } = shadowDots(st); for (let i = 0; i < 6 && out.length; i++) { const [x, y] = out[Math.floor(Math.random() * out.length)]; fx.add(x, y, (Math.random() - 0.5) * 40, -30 - Math.random() * 40, 0.8, 2.4, 1.5, 0, [3, 2.2, 0.9], [1, 0.5, 0.2], 1.4); } }
  // 火
  const k = st.cur;
  if (k && k.fireOn && (st.phase === 'draw' || st.phase === 'burn')) {
    const Q = k.pts, i = Math.max(1, Q.findIndex((p) => p.s >= k.fireS)), a = Q[i - 1] || Q[0], b = Q[i] || a, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const hot = st.phase === 'draw' && k.len - k.fireS < 45 ? 2 : 1;
    fx.flame(k.fx, k.fy, (b.x - a.x) / l, (b.y - a.y) / l, hot, dt);
    api.audio.fuse(1, hot);
  } else api.audio.fuse(0, 0);
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  switch (ev.type) {
    case 'start': audio.scene('burn', 0.3); audio.note(9, { vol: 0.14, dur: 0.3, pan: api.pan(st.pen.x) }); break;
    case 'ignite': audio.note(2, { vol: 0.14, dur: 0.25 }); fx.tick(st.cur.fx, st.cur.fy, [3, 1.8, 0.7], 22, 180); break;
    case 'miss': api.floatText(ev.x, ev.y - 26, '手元の枠の中から', 'mult', 20); audio.note(1, { vol: 0.1, dur: 0.15 }); break;
    case 'cover': audio.note(6 + ev.pct, { vol: ev.pct >= 7 ? 0.17 : 0.11, dur: 0.35, pan: api.pan(st.T.x) }); if (ev.pct === 7) fx.light(st.T.x, st.T.y, 0.5, 300, [1, 0.7, 0.3]); break;
    case 'lift': audio.ui('heat'); break;
    case 'more': api.banner('もう一筆<small>足りない所に、影を足す</small>', 42, 1400); audio.note(14, { vol: 0.15, dur: 0.5 }); break;
    case 'bloom': {
      const pts = []; for (const R of st.route) for (let i = 0; i < R.length; i += 2) pts.push(R[i]);
      api.burstShape(st.tsegs, pts.slice(0, 12));
      fx.light(st.T.x, st.T.y, 1.1, 420, [1, 0.75, 0.4]);
      if (st.lv.reveal) { fx.burst('willow', st.T.x, st.T.y - st.S * 0.4, 220, 'kin', 2); audio.boom(2, api.pan(st.T.x)); }
      break;
    }
    case 'fail': audio.fuse(0, 0); if (ev.reason === 'caught') { api.R.shake += 8; fx.tick(st.cur.fx, st.cur.fy, [1.2, 0.5, 0.2], 40, 200); } break;
    default:
  }
}
