// 第六章「百鬼夜行」: 太鼓に合わせて一筆。輪がしぼんだ拍の時に、妖怪の面を筆で通りぬける。火は線のはじまりから追ってくる。
// ルールは ./hyakki-rules.js。ここは章の型（_dev/hanabi-chapter-contract.md）に合わせる包みと、絵・音
import * as Y from './hyakki-rules.js';

export const CHAPTER = { id: 'hyakki', no: 6, ja: '百鬼夜行', sky: 'hyakki', band: 'demon' };
export const LEVELS = Y.LEVELS;
export const FAIL = { caught: '火に追いつかれた', miss: '面を外しすぎた', lift: '筆を離した' };

export function newStage(lv, W, H, opt = {}) { return Y.newStage(lv, W, H, opt); }
export const penDown = Y.penDown, penMove = Y.penMove, penUp = Y.penUp, step = Y.step, starsFor = Y.starsFor, bot = Y.bot;
// 二度しくじったら、次の面へ向かう道しるべを出す
export function retry(lv, fails, opt) { return { ...opt, hint: fails >= 2 || LEVELS.indexOf(lv) === 0 }; }

const KAN = ['', '一', '二', '三', '四'];
export function info(st) {
  if (st.phase === 'aim') return '<em>光る輪</em>に筆を置く。太鼓を四つ数えて、面が来る';
  if (st.phase === 'done') return `見事 — ぴったり <em>${st.perfect}</em> / ${st.targets.length}`;
  if (st.phase === 'fail') return '';
  const c = Y.songT(st);
  if (c < Y.COUNT_IN * st.spb) return `あと <em>${Math.max(1, Math.ceil(Y.COUNT_IN - c / st.spb))}</em> 拍 — 筆を止めるな`;
  return `面 <em>${st.hit} / ${st.targets.length}</em> ・ 外し ${st.miss} / ${st.lv.maxMiss}`;
}

export function labels(st) {
  const out = [];
  if (st.phase === 'aim') out.push({ x: st.start.x, y: st.start.y - 62, text: 'ここに筆', cls: 'gold' });
  if (st.phase === 'play') {
    const rel = (Y.songT(st)) / st.spb;
    if (rel >= 0 && rel < Y.COUNT_IN) out.push({ x: st.taiko.x, y: st.taiko.y - 56, text: KAN[Y.COUNT_IN - Math.floor(rel)], cls: 'big gold' });
    else if (st.combo >= 4) out.push({ x: st.taiko.x, y: st.taiko.y - 52, text: `${st.combo} 連`, cls: 'gold' });
  }
  return out;
}

// 拍のうなり（0〜1。拍の瞬間に 1）
const pulse = (st) => { const ph = (st.t / st.spb) % 1; return Math.exp(-ph * 7); };
// 面が見えている間の、出かた（0〜1）
function shown(st, o, c) {
  if (st.phase === 'aim') return 0;
  if (o.state === 'wait') return Math.max(0, Math.min(1, (c - (o.tb - st.appr)) / (st.appr * 0.3)));
  const k = (c - o.at) / 0.35; return Math.max(0, 1 - k);
}

export function draw(st, api) {
  const c = Y.songT(st);
  // 太鼓（拍に合わせて弾む）
  const p = pulse(st);
  api.put(st.taiko.x, st.taiko.y, 34 * (1 + 0.22 * p), 'taiko', 0.15 + 0.5 * p);
  // 引いた線と、追ってくる火
  if (st.pts.length > 1) { const gap = st.len - st.fireS; api.ribbon({ pts: st.pts, len: st.len, flameS: st.fireS, heatLv: st.fireOn ? (gap < 90 ? 2 : gap < 180 ? 1 : 0) : 0, flameOn: st.fireOn }); }
  if (st.fireOn && st.phase !== 'done') api.put(st.fx, st.fy - 6, 30, api.HINOKO + (st.len - st.fireS < 90 ? 1 : 0), 0.2, 'shell');
  // 面
  for (const o of st.targets) {
    const a = shown(st, o, c); if (a <= 0) continue;
    if (o.state === 'hit') api.put(o.x, o.y - (1 - a) * 20, st.r * (0.78 + (1 - a) * 0.5), o.mob, 0.6, 'story', a);
    else if (o.state === 'miss') api.put(o.x, o.y + (1 - a) * 40, st.r * 0.7, o.mob, 0, 'story', a * 0.4);
    else { const near = Math.abs(c - o.tb) < Y.PERFECT; api.put(o.x, o.y, st.r * (near ? 0.86 : 0.78), o.mob, near ? 0.5 : 0.15, 'story', a); }
  }
}

const GOLD = [3, 2.1, 0.7], WHITE = [3.2, 3, 2.6], RED = [2.6, 0.5, 0.3], DIM = [0.9, 0.6, 0.3];
export function particles(st, api) {
  const { fx, one, t, dt } = api;
  const c = Y.songT(st);
  // 太鼓のまわりの輪
  { const p = pulse(st), r = 40 + (1 - p) * 26; for (let j = 0; j < 24; j++) { const a = (j / 24) * 6.283; fx.add(st.taiko.x + Math.cos(a) * r, st.taiko.y + Math.sin(a) * r * 0.8, 0, 0, one, 1.8, 0, 0, GOLD, GOLD, p * 1.2); } fx.add(st.taiko.x, st.taiko.y, 0, 0, one, 70, 0, 0, [1.2, 0.4, 0.2], [1.2, 0.4, 0.2], 0.12 + p * 0.25); }
  // はじまりの印
  if (st.phase === 'aim') { const r = 36 + Math.sin(t * 5) * 5; for (let j = 0; j < 26; j++) { const a = (j / 26) * 6.283 + t; fx.add(st.start.x + Math.cos(a) * r, st.start.y + Math.sin(a) * r, 0, 0, one, 2.3, 0, 0, GOLD, GOLD, 1.3); } }
  if (st.phase !== 'play' && st.phase !== 'done') { api.audio.fuse(0, 0); return; }
  // 面: しぼむ輪（拍の時に面の大きさになる）と、面の当たりの輪
  const up = st.targets.filter((o) => o.state === 'wait' && c >= o.tb - st.appr);
  for (const o of up) {
    const k = Math.max(0, (o.tb - c) / st.appr), R = st.r + st.r * 2.2 * k, near = Math.abs(c - o.tb) < Y.PERFECT, col = near ? WHITE : GOLD, a = Math.min(1, (1 - k) * 2.5);
    const n = 40; for (let j = 0; j < n; j++) { const an = (j / n) * 6.283; fx.add(o.x + Math.cos(an) * R, o.y + Math.sin(an) * R, 0, 0, one, near ? 2.6 : 2.1, 0, 0, col, col, a * 1.3); }
    for (let j = 0; j < 28; j++) { const an = (j / 28) * 6.283 + t * 0.5; fx.add(o.x + Math.cos(an) * st.r, o.y + Math.sin(an) * st.r, 0, 0, one, 1.4, 0, 0, DIM, DIM, a * 0.8); }
    fx.add(o.x, o.y, 0, 0, one, st.r * 1.6, 0, 0, [0.8, 0.25, 0.3], [0.8, 0.25, 0.3], 0.18 * a);
  }
  // 次に通る順を、点線で（はじめの面と、二度しくじったとき）
  const next = st.targets.filter((o) => o.state === 'wait').slice(0, st.hint ? 3 : 2);
  let from = st.pen;
  for (const o of next) {
    if (!from || c < o.tb - st.appr * 1.2) break;
    const d = Math.hypot(o.x - from.x, o.y - from.y), m = Math.min(24, Math.floor(d / 18)), a = st.hint ? 0.7 : 0.35;
    for (let j = 1; j < m; j++) { const u = j / m; fx.add(from.x + (o.x - from.x) * u, from.y + (o.y - from.y) * u, 0, 0, one, 1.6, 0, 0, [1.6, 1.0, 0.5], [1.6, 1.0, 0.5], a); }
    from = o;
  }
  // 筆先
  if (st.pen && st.phase === 'play') fx.add(st.pen.x, st.pen.y, 0, 0, one, 8, 0, 0, [2.4, 2, 1.2], [2, 1.5, 0.8], 0.8);
  // 火
  if (st.fireOn && st.phase === 'play') {
    const P = st.pts, i = Math.max(1, Math.min(P.length - 1, st.fi + 1)), a = P[i - 1] || P[0], b = P[i] || a, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    fx.flame(st.fx, st.fy, (b.x - a.x) / l, (b.y - a.y) / l, st.len - st.fireS < 90 ? 2 : 1, dt);
    api.audio.fuse(1, st.len - st.fireS < 90 ? 2 : 1);
  } else api.audio.fuse(0, 0);
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  switch (ev.type) {
    case 'beat': {
      const pan = api.pan(st.taiko.x);
      if (ev.pre) { audio.note(0, { vol: 0.07, dur: 0.12, pan }); break; } // 筆を置く前は、小さく
      const strong = ev.rel !== null && ev.rel % 2 === 0;
      audio.boom(strong ? 0.5 : 0.32, pan); audio.note(strong ? 0 : 2, { vol: strong ? 0.2 : 0.13, dur: 0.16, pan });
      if (ev.count) { audio.note(15, { vol: 0.12, dur: 0.12 }); fx.tick(st.taiko.x, st.taiko.y, [3, 1.8, 0.7], 10, 120); }
      break;
    }
    case 'start': audio.scene('taiko', 0.6); audio.note(9, { vol: 0.14, dur: 0.3 }); fx.tick(st.start.x, st.start.y, [3, 1.8, 0.7], 26, 220); break; // 祭りの曲は止めて、太鼓だけにする
    case 'miss': api.floatText(ev.x, ev.y - 20, '光る輪から', 'mult', 18); break;
    case 'ignite': audio.note(2, { vol: 0.12, dur: 0.25 }); break;
    case 'hit': {
      const o = st.targets[ev.i], pan = api.pan(o.x);
      audio.note(10 + (st.combo % 10), { vol: ev.perfect ? 0.2 : 0.14, dur: 0.4, pan });
      if (ev.perfect) { fx.burst('mini', o.x, o.y, 70, ['kiku', 'kin', 'ootama', 'oni'][ev.i % 4], 1); api.floatText(o.x, o.y - st.r - 10, 'ぴったり', 'gold', 22); fx.light(o.x, o.y, 0.7, 240, [1, 0.7, 0.4]); }
      else { fx.tick(o.x, o.y, [3, 1.8, 0.6], 22, 200); api.floatText(o.x, o.y - st.r - 10, ev.off < 0 ? 'はやい' : 'おそい', '', 18); }
      break;
    }
    case 'targetMiss': { const o = st.targets[ev.i]; audio.note(1, { vol: 0.12, dur: 0.25 }); api.floatText(o.x, o.y - st.r - 10, '外れ', 'mult', 20); break; }
    case 'done': {
      // 当てた面を線で結んで、空に開く
      const hit = st.targets.filter((o) => o.state === 'hit'), segs = [];
      for (let i = 1; i < hit.length; i++) segs.push([hit[i - 1], hit[i]]);
      api.burstShape(segs.length ? segs : [[st.start, st.start]], hit.map((o) => ({ x: o.x, y: o.y })));
      audio.boom(1.6, 0);
      break;
    }
    case 'fail': audio.fuse(0, 0); if (ev.reason === 'caught') { api.R.shake += 8; fx.tick(st.fx, st.fy, [1.2, 0.5, 0.2], 40, 200); audio.ui('caught'); } break;
    default:
  }
}
