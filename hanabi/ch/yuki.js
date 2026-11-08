// 第4章「雪の山里」: 線が凍って、そりの道になる。ルールは ./yuki-rules.js。ここは章の型（_dev/hanabi-chapter-contract.md）に合わせる包みと、見せ方
import * as Z from './yuki-rules.js';

export const CHAPTER = { id: 'yuki', no: 4, ja: '雪の山里', sky: 'yukiyama', band: 'winter' };
export const LEVELS = Z.LEVELS;
export const FAIL = { caught: '火に追いつかれた。氷が筆先まで溶けた', melt: '氷が溶けて、そりが落ちた', fell: 'そりが谷へ落ちた', pine: '雪の松にぶつかった', stuck: 'そりが止まってしまった' };

export function newStage(lv, W, H, opt = {}) { return Z.newStage(lv, W, H, opt); }
export const penDown = Z.penDown, penMove = Z.penMove, penUp = Z.penUp, starsFor = Z.starsFor;
export function step(st, dt) { Z.step(st, dt); }
// 2 度しくじったら、氷の道すじをうっすら見せる
export function retry(lv, fails, opt) { return { ...opt, hint: fails >= 2 }; }
export function bot(st, mem) { return Z.bot(st, mem); }

export function info(st) {
  if (st.phase === 'aim') return '<em>そりの下</em>から、<em>家</em>まで氷の道を引く';
  const n = st.usagi.length, got = st.usagi.filter((u) => u.got).length, u = n ? ` ・ 雪うさぎ <em>${got}</em>/${n}` : '';
  if (st.phase === 'done') return `ただいま${u}`;
  const head = st.cur ? '引いたら、指を離す' : st.sled.mode === 'air' ? '下に氷を引いて受けとめる' : '先へ、氷の道を引く';
  return `${head}${u} ・ ${st.rideT.toFixed(1)} 秒`;
}

export function labels(st) {
  const out = [];
  for (const s of st.steam) out.push({ x: (s.x0 + s.x1) / 2, y: Math.max(s.y0, st.field.by0) + 22, text: '湯けむり', cls: 'dim' });
  return out;
}

// そりの体の位置（氷の上では、線の少し上）
function sledAt(st) {
  const sl = st.sled;
  if (sl.mode === 'ride' || sl.mode === 'hold') { const t = { x: sl.tx, y: sl.ty }, n = t.x >= 0 ? { x: t.y, y: -t.x } : { x: -t.y, y: t.x }; return { x: sl.x + n.x * 14, y: sl.y + n.y * 14 }; }
  if (sl.mode === 'home') { const H = st.house; return { x: H.x - 40, y: H.y + 12 }; }
  return { x: sl.x, y: sl.y - 14 };
}

export function draw(st, api) {
  const t = api.t, H = st.house;
  for (const p of st.pines) api.put(p.x, p.y - 4, 34, 'snowpine', 0.05);
  api.put(H.x, H.y - 4, 44, 'house', 0.3);
  for (const u of st.usagi) if (!u.got) api.put(u.x, u.y + Math.sin(t * 3 + u.x) * 2.5, 20, 'usagi', 0.2);
  for (const k of st.strokes) {
    if (k.pts.length < 2 || (k.gone && st.t - k.goneT > 1.5)) continue;
    // 氷は粒で青白く描く。導火線の帯は、燃えたあと（溶けた所）と火の頭だけ
    if (!k.fireOn) continue;
    const pts = k.pts.filter((p) => p.s <= k.fireS + 20); if (pts.length < 2) continue;
    api.ribbon({ pts, len: k.fireS + 20, flameS: k.fireS, heatLv: 1, flameOn: !k.gone && st.phase !== 'fail', width: 3.4 });
  }
  const b = sledAt(st);
  if (st.phase !== 'fail' || st.reason === 'caught') api.put(b.x, b.y - 3, 30, 'sled', 0.15);
  for (const k of st.strokes) if (k.fireOn && !k.gone && st.phase === 'play') api.put(k.fx, k.fy - 6, 28, api.HINOKO + (Math.hypot(k.fx - st.sled.x, k.fy - st.sled.y) < 110 ? 1 : 0), 0.2, 'shell');
}

let snow = null;
export function particles(st, api) {
  const { fx, one, t, dt } = api, f = st.field;
  // 降る雪（見た目だけ）
  if (!snow) snow = Array.from({ length: 90 }, () => ({ u: Math.random(), v: Math.random(), s: 0.5 + Math.random(), ph: Math.random() * 6 }));
  for (const s of snow) { const y = ((s.v + t * 0.03 * s.s) % 1) * (f.fallY - 100) + 100, x = s.u * st.w + Math.sin(t * 0.7 + s.ph) * 14; fx.add(x, y, 0, 0, one, 1.4 * s.s, 0, 0, [1.2, 1.3, 1.5], [1.2, 1.3, 1.5], 0.35); }
  // 雪の棚
  for (const p of st.ledge.pts) { fx.add(p.x, p.y + 3, 0, 0, one, 5.5, 0, 0, [1.5, 1.6, 1.8], [1.5, 1.6, 1.8], 0.55); fx.add(p.x, p.y + 10, 0, 0, one, 8, 0, 0, [0.5, 0.55, 0.7], [0.5, 0.55, 0.7], 0.3); }
  // 湯けむり: 線が凍らない所。下から白い湯気がのぼる
  for (const s of st.steam) {
    const x0 = Math.max(s.x0, 0), x1 = Math.min(s.x1, st.w), y0 = Math.max(s.y0, f.by0), y1 = Math.min(s.y1, f.by1);
    for (let i = 0; i < (y1 - y0) / 90; i++) { const x = x0 + 8 + Math.random() * (x1 - x0 - 16), y = y0 + 20 + Math.random() * (y1 - y0 - 20); fx.add(x, y, (Math.random() - 0.5) * 8, -30 - Math.random() * 20, 1.2, 9 + Math.random() * 8, 0.1, -4, [0.3, 0.33, 0.38], [0.04, 0.045, 0.05], 0.16); }
    for (let y = y0; y < y1; y += 26) { fx.add(x0, y, 0, 0, one, 1.6, 0, 0, [0.9, 0.95, 1.05], [0.9, 0.95, 1.05], 0.4); fx.add(x1, y, 0, 0, one, 1.6, 0, 0, [0.9, 0.95, 1.05], [0.9, 0.95, 1.05], 0.4); }
  }
  // 家のあかり
  const H = st.house; fx.add(H.x, H.y, 0, 0, one, 80, 0, 0, [0.9, 0.55, 0.2], [0.9, 0.55, 0.2], 0.35);
  if (st.phase === 'aim' || st.phase === 'play') { const r = H.r + Math.sin(t * 3) * 3; for (let j = 0; j < 22; j++) { const a = (j / 22) * 6.283 + t * 0.5; fx.add(H.x + Math.cos(a) * r, H.y + Math.sin(a) * r, 0, 0, one, 1.7, 0, 0, [2.6, 1.8, 0.8], [2.6, 1.8, 0.8], 0.9); } }
  for (const u of st.usagi) if (!u.got) fx.add(u.x, u.y, 0, 0, one, 26, 0, 0, [0.7, 0.9, 1.4], [0.7, 0.9, 1.4], 0.22);
  for (const p of st.pines) fx.add(p.x, p.y, 0, 0, one, 30, 0, 0, [0.5, 0.15, 0.1], [0.5, 0.15, 0.1], 0.18);
  // 道すじのヒント（2 度しくじったら）
  if (st.hint && st.phase !== 'done') for (const b of st.lv.bot) { const P = ((!f.land && b.ptsP) || b.pts).map((q) => Z.mapUV(f, q[0], q[1])); for (let i = 1; i < P.length; i++) { const a = P[i - 1], c = P[i], n = Math.floor(Math.hypot(c.x - a.x, c.y - a.y) / 20); for (let j = 0; j < n; j++) { const u = (j + (t * 0.8) % 1) / n; fx.add(a.x + (c.x - a.x) * u, a.y + (c.y - a.y) * u, 0, 0, one, 1.7, 0, 0, [1, 1.3, 1.8], [1, 1.3, 1.8], 0.45); } } }
  // 氷の道: 燃えていない所だけが、青白く光る
  let hot = 0;
  for (const k of st.strokes) {
    if (k.gone || k.pts.length < 2) continue;
    const a0 = Math.max(0, k.fireS);
    for (let s = a0; s <= k.len; s += 4) { const p = Z.pointAt(k, s); fx.add(p.x, p.y, 0, 0, one, 3.6, 0, 0, [1.3, 1.9, 3], [1.3, 1.9, 3], 0.9); fx.add(p.x, p.y + 2.5, 0, 0, one, 2.2, 0, 0, [0.5, 0.8, 1.5], [0.5, 0.8, 1.5], 0.6); }
    for (let s = a0; s <= k.len; s += 18) { const p = Z.pointAt(k, s); fx.add(p.x, p.y, 0, 0, one, 16, 0, 0, [0.25, 0.42, 0.8], [0.25, 0.42, 0.8], 0.32); }
    if (k.len > 30) { const s = a0 + ((t * 160 + k.id * 37) % Math.max(1, k.len - a0)), p = Z.pointAt(k, s); fx.add(p.x, p.y, 0, 0, one, 4, 0, 0, [3, 3, 3.4], [3, 3, 3.4], 1.2); }
    if (k.fireOn && st.phase === 'play') {
      const i = Math.max(1, k.pts.findIndex((p) => p.s >= k.fireS)), a = k.pts[i - 1] || k.pts[0], b = k.pts[i] || a, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      fx.flame(k.fx, k.fy, (b.x - a.x) / l, (b.y - a.y) / l, 1, dt); hot = 1;
      // 溶けた氷のしずく
      if (Math.random() < 0.5) fx.add(k.fx, k.fy + 2, (Math.random() - 0.5) * 30, 20, 0.7, 2.2, 0.5, 500, [0.8, 1.2, 2], [0.3, 0.5, 1], 0.9);
    }
  }
  // そり: 滑るあいだ、うしろに雪けむり
  const sl = st.sled;
  if (sl.mode === 'ride' && Math.abs(sl.vs) > 80 && st.phase === 'play') fx.add(sl.x - sl.tx * Math.sign(sl.vs) * 14, sl.y - 2, -sl.tx * sl.vs * 0.2 + (Math.random() - 0.5) * 40, -20 - Math.random() * 30, 0.5, 2.6, 2, 80, [1.6, 1.7, 1.9], [0.5, 0.55, 0.7], 0.8);
  if (sl.mode === 'hold' && st.phase === 'aim') { const r = 30 + Math.sin(t * 4) * 3; for (let j = 0; j < 18; j++) { const a = (j / 18) * 6.283 - t; fx.add(sl.x + Math.cos(a) * r, sl.y - 14 + Math.sin(a) * r, 0, 0, one, 1.6, 0, 0, [1.4, 1.8, 2.6], [1.4, 1.8, 2.6], 0.9); } }
  if (st.cur && st.pen) fx.add(st.pen.x, st.pen.y, 0, 0, one, 8, 0, 0, [1.6, 2, 2.6], [1.2, 1.5, 2], 0.8);
  api.audio.fuse(hot, hot);
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  switch (ev.type) {
    case 'start': if (ev.n === 0) audio.scene('burn', 0.3); audio.note(14, { vol: 0.1, dur: 0.25 }); break;
    case 'go': audio.note(10, { vol: 0.12, dur: 0.3 }); fx.tick(st.sled.x, st.sled.y, [1.6, 1.8, 2.2], 16, 120); break;
    case 'ignite': audio.note(2, { vol: 0.12, dur: 0.25, pan: api.pan(ev.x) }); fx.tick(ev.x, ev.y, [3, 1.8, 0.7], 22, 200); break;
    case 'land': if (ev.hard > 60) { audio.note(5, { vol: Math.min(0.16, ev.hard / 2000), dur: 0.2, pan: api.pan(ev.x) }); fx.tick(ev.x, ev.y, [1.6, 1.8, 2.2], 18, 140); } break;
    case 'air': if (ev.why === 'end' || ev.why === 'jump') audio.note(16, { vol: 0.07, dur: 0.2, pan: api.pan(ev.x) }); break;
    case 'usagi': audio.note(15 + ev.n, { vol: 0.15, dur: 0.5, pan: api.pan(ev.x) }); fx.tick(ev.x, ev.y, [2.2, 2.6, 3.2], 34, 180); api.floatText(ev.x, ev.y - 30, '雪うさぎ', 'gold', 20); break;
    case 'block': if (ev.what === 'steam') api.floatText(ev.x, ev.y - 26, '湯気では凍らない', 'mult', 18); else if (ev.what === 'pine') api.floatText(ev.x, ev.y - 26, '松がじゃま', 'mult', 18); break;
    case 'done': {
      const H = st.house, segs = [];
      for (const k of st.strokes) { const P = k.pts, n = Math.max(2, Math.ceil(P.length / 12)); let i = 0; for (; i + n < P.length; i += n) segs.push([P[i], P[i + n]]); if (i < P.length - 1) segs.push([P[i], P[P.length - 1]]); }
      api.burstShape(segs.length ? segs : [[H, H]], [H, ...st.usagi.filter((u) => u.got)]);
      fx.burst('chrys', H.x, H.y - 120, 160, 'koori', 1);
      api.floatText(H.x, H.y - 70, 'ただいま', 'gold', 26);
      break;
    }
    case 'fail': audio.fuse(0, 0); api.R.shake += 7; fx.tick(ev.x, Math.min(ev.y, st.field.fallY - 10), [1.6, 1.8, 2.2], 40, 220); break;
    default:
  }
}
