// 第2章「灯籠流し」: 線が川の流れになる。ルールは ./toro-rules.js。ここは章の型（_dev/hanabi-chapter-contract.md）に合わせる包みと、見せ方
import * as Z from './toro-rules.js';

export const CHAPTER = { id: 'toro', no: 2, ja: '灯籠流し', sky: 'toro', band: 'summer' };
export const LEVELS = Z.LEVELS;
export const FAIL = { caught: '火に追いつかれた。灯籠が燃えた', burned: '灯籠が燃えてしまった', lift: '筆を離した。灯籠が流れの先で止まった' };

export function newStage(lv, W, H, opt = {}) { return Z.newStage(lv, W, H, opt); }
export const penDown = Z.penDown, penMove = Z.penMove, penUp = Z.penUp, starsFor = Z.starsFor;
export function step(st, dt) { Z.step(st, dt); }
// 2 度しくじったら、社への道すじをうっすら見せる
export function retry(lv, fails, opt) { return { ...opt, hint: fails >= 2 }; }
export function bot(st, mem) { return Z.bot(st, mem); }

const COL = { red: [2.6, 0.7, 0.35], blue: [0.55, 1.3, 2.8], none: [2.6, 1.8, 0.8] };
const colOf = (c) => COL[c || 'none'];
const JA = { red: '赤', blue: '青' };

export function info(st) {
  const colored = st.docks.some((d) => d.col);
  if (st.phase === 'aim') return colored ? '<em>岸</em>を押して、<em>同じ色の社</em>まで線を引く' : '<em>岸の灯籠</em>を押して、<em>社</em>まで線を引く';
  if (st.phase === 'done') return `送れた灯籠 <em>${st.saved}</em> / ${st.total}`;
  const left = st.docks.filter((d) => !d.used).length;
  const head = st.cur ? '社まで、つなぐ' : left ? '<em>次の岸</em>を押す' : '流れていく';
  return `${head} ・ 送った灯籠 <em>${st.saved}</em> / ${st.need}${st.lotus.length ? ` ・ 蓮 ${st.lotus.filter((l) => l.got).length}/${st.lotus.length}` : ''}`;
}

// 岸で待つ灯籠の置き場（流れと逆の向きに並ぶ）
export function dockSlot(st, d, i) {
  const b = { x: -st.flow.x, y: -st.flow.y }, a = { x: -b.y, y: b.x }, row = Math.floor((i + 1) / 2), side = i % 2 ? 1 : -1;
  const back = 2 + row * 20, across = i === 0 ? 0 : side * 18;
  return { x: d.x + b.x * back + a.x * across, y: d.y + b.y * back + a.y * across };
}
const waitList = (d) => d.lanterns.filter((l) => l.st === 'dock');
// 名前のない灯籠は、ほかの灯籠から少し離れて、岸のわきにぽつんと置く
const namelessAt = (st, d) => { const b = { x: -st.flow.x, y: -st.flow.y }, a = { x: -b.y, y: b.x }; return { x: d.x + a.x * 46 + b.x * 6, y: d.y + a.y * 46 + b.y * 6 }; };

export function labels(st) {
  const out = [], land = st.field.land;
  for (const d of st.docks) {
    if (d.col) out.push({ x: d.x + (land ? 0 : 0), y: d.y + (land ? 50 : -62), text: JA[d.col] + 'の岸', cls: d.col });
    if (d.nameless) { const p = namelessAt(st, d); out.push({ x: p.x + (land ? 0 : 20), y: p.y - 34, text: '名前のない灯籠', cls: 'dim' }); }
  }
  for (const s of st.shrines) if (s.col) out.push({ x: s.x, y: s.y + 58, text: JA[s.col] + 'の社', cls: s.col });
  return out;
}

export function draw(st, api) {
  const t = api.t;
  for (const r of st.rocks) api.put(r.x, r.y, r.r / 0.74, 'rock', 0.02);
  for (const l of st.lotus) api.put(l.x, l.y + Math.sin(t * 1.3 + l.x) * 2, l.got ? 26 : 22, 'lotus', l.got ? 0.55 : 0.12, 'story', l.got ? 1 : 0.85);
  for (const s of st.shrines) api.put(s.x, s.y - 4, 46, 'shrine', 0.25);
  for (const k of st.strokes) {
    if (k.pts.length < 2) continue;
    // 川は粒で青く描く。導火線の帯は、燃えたあとと火の頭だけ
    if (!k.fireOn) continue;
    const gap = Math.min(k.len - k.fireS, ...k.lanterns.filter((l) => l.st === 'float').map((l) => l.s - k.fireS));
    const pts = k.pts.filter((p) => p.s <= k.fireS + 20); if (pts.length < 2) continue;
    api.ribbon({ pts, len: k.fireS + 20, flameS: k.fireS, heatLv: gap < 70 ? 2 : gap < 150 ? 1 : 0, flameOn: !k.over, width: 5 });
  }
  for (const d of st.docks) {
    waitList(d).forEach((l, i) => { const p = dockSlot(st, d, i); api.put(p.x, p.y - 2, 22, 'toro_lit', 0.22); });
    // 名前のない灯籠: 灯がともらず、うす暗い。岸を離れない
    if (d.nameless) { const p = namelessAt(st, d); api.put(p.x, p.y - 2 + Math.sin(t * 0.9) * 1.5, 22, 'toro', 0, 'story', 0.5); }
  }
  for (const k of st.strokes) for (const l of k.lanterns) {
    if (l.st !== 'float') continue;
    const p = Z.pointAt(k, l.s), bob = Math.sin(t * 2.4 + l.s * 0.05) * 2;
    api.put(p.x, p.y - 6 + bob, 22, 'toro_lit', 0.32);
  }
  for (const k of st.strokes) if (k.fireOn && !k.over && st.phase !== 'fail') api.put(k.fx, k.fy - 6, 30, api.HINOKO + (k.lanterns.some((l) => l.st === 'float' && l.s - k.fireS < 90) ? 1 : 0), 0.2, 'shell');
  // 山場のあと: 火の子が、名前のない灯籠のそばを離れない
  if (st.phase === 'done') { const d = st.docks.find((q) => q.nameless); if (d) { const p = namelessAt(st, d), u = Math.min(1, (st.t - st.doneT) / 1.2); api.put(p.x + 34 * u, p.y - 8 * u + Math.sin(t * 2) * 3, 26, api.HINOKO, 0.3, 'shell', u); } }
}

let ripple = null;
export function particles(st, api) {
  const { fx, one, t, dt } = api, f = st.field;
  // 水面のさざ波（川になる場所の手がかり）
  if (!ripple) ripple = Array.from({ length: 140 }, () => ({ u: Math.random(), v: Math.random(), ph: Math.random() * 9 }));
  for (const r of ripple) { const p = Z.mapUV(f, (r.u + t * 0.012) % 1, r.v), a = 0.18 + 0.14 * Math.sin(t * 1.4 + r.ph); fx.add(p.x, p.y, 0, 0, one, 1.5, 0, 0, [0.5, 0.8, 1.4], [0.5, 0.8, 1.4], a); }
  // 岸
  for (const d of st.docks) {
    const c = d.col ? colOf(d.col) : [1.6, 1.1, 0.5], on = !d.used && !st.cur && (st.phase === 'aim' || st.phase === 'play');
    fx.add(d.x, d.y, 0, 0, one, 46, 0, 0, [c[0] * 0.25, c[1] * 0.25, c[2] * 0.25], [c[0] * 0.25, c[1] * 0.25, c[2] * 0.25], on ? 0.5 : 0.18);
    if (on) { const r = 36 + Math.sin(t * 4) * 4; for (let j = 0; j < 22; j++) { const a = (j / 22) * 6.283 + t; fx.add(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 0, 0, one, 2, 0, 0, c, c, 1.2); } }
    waitList(d).forEach((l, i) => { const p = dockSlot(st, d, i); fx.add(p.x, p.y, 0, 0, one, 26, 0, 0, [1.4, 0.8, 0.3], [1.4, 0.8, 0.3], 0.28); });
  }
  // 社: つなげる輪
  for (const s of st.shrines) {
    const c = s.col ? colOf(s.col) : [2.6, 1.6, 0.6], r = s.r + Math.sin(t * 3) * 2;
    for (let j = 0; j < 26; j++) { const a = (j / 26) * 6.283 - t * 0.7; fx.add(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 0, 0, one, 1.8, 0, 0, c, c, 1.1); }
    fx.add(s.x, s.y, 0, 0, one, 60, 0, 0, [c[0] * 0.2, c[1] * 0.2, c[2] * 0.2], [c[0] * 0.2, c[1] * 0.2, c[2] * 0.2], 0.4);
  }
  for (const l of st.lotus) { const c = l.got ? [3, 1.6, 2.2] : [1.4, 0.6, 1]; fx.add(l.x, l.y, 0, 0, one, l.got ? 40 : 30, 0, 0, c, c, l.got ? 0.4 : 0.18); }
  // 道すじのヒント（2 度しくじったら）
  if (st.hint && st.phase !== 'done') for (const path of st.lv.bot) {
    let a = st.docks[st.lv.bot.indexOf(path) % st.docks.length];
    for (const q of path) { const b = Z.mapUV(f, q[0], q[1]), n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 22); for (let j = 0; j < n; j++) { const u = (j + (t * 0.8) % 1) / n; fx.add(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0, 0, one, 1.8, 0, 0, [1.4, 1.2, 0.8], [1.4, 1.2, 0.8], 0.45); } a = b; }
  }
  // 線は川: まだ燃えていない所を、青い流れの光が下っていく
  let hot = 0;
  for (const k of st.strokes) {
    if (k.pts.length < 2) continue;
    const vL = st.vL * (k.connected ? Z.CONN : 1), a0 = Math.max(0, k.fireS);
    for (let s = a0; s <= k.len; s += 4) { const p = Z.pointAt(k, s); fx.add(p.x, p.y, 0, 0, one, 4.4, 0, 0, [0.35, 0.75, 1.7], [0.35, 0.75, 1.7], 0.75); }
    for (let s = a0 + ((t * vL) % 22); s < k.len; s += 22) { const p = Z.pointAt(k, s); fx.add(p.x, p.y, 0, 0, one, 2.6, 0, 0, [1.6, 2.4, 3.2], [1.6, 2.4, 3.2], 1.1); }
    for (let s = a0; s < k.len; s += 24) { const p = Z.pointAt(k, s); fx.add(p.x, p.y, 0, 0, one, 20, 0, 0, [0.12, 0.28, 0.6], [0.12, 0.28, 0.6], 0.4); }
    for (const l of k.lanterns) if (l.st === 'float') { const p = Z.pointAt(k, l.s); fx.add(p.x, p.y - 4, 0, 0, one, 34, 0, 0, [1.6, 0.9, 0.3], [1.6, 0.9, 0.3], 0.4); fx.add(p.x, p.y + 10, 0, 0, one, 10, 0, 0, [1.2, 0.7, 0.25], [1.2, 0.7, 0.25], 0.35); }
    if (k.fireOn && !k.over && st.phase === 'play') {
      const i = Math.max(1, k.pts.findIndex((p) => p.s >= k.fireS)), a = k.pts[i - 1] || k.pts[0], b = k.pts[i] || a, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const near = k.lanterns.some((q) => q.st === 'float' && q.s - k.fireS < 90);
      fx.flame(k.fx, k.fy, (b.x - a.x) / l, (b.y - a.y) / l, near ? 2 : 1, dt); hot = Math.max(hot, near ? 2 : 1);
    }
  }
  if (st.cur && st.pen) fx.add(st.pen.x, st.pen.y, 0, 0, one, 8, 0, 0, [2.4, 2, 1.2], [2, 1.5, 0.8], 0.8);
  api.audio.fuse(hot ? 1 : 0, hot);
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  switch (ev.type) {
    case 'start': audio.scene('burn', 0.3); audio.note(9, { vol: 0.14, dur: 0.3 }); break;
    case 'release': { const d = st.docks[ev.dock]; audio.note(5 + (ev.i % 4), { vol: 0.07, dur: 0.25, pan: api.pan(d.x) }); fx.tick(d.x, d.y, [0.8, 1.4, 2.4], 10, 90); break; }
    case 'ignite': { const d = st.docks[ev.dock]; audio.note(2, { vol: 0.14, dur: 0.25 }); fx.tick(d.x, d.y, [3, 1.8, 0.7], 26, 220); break; }
    case 'block': if (ev.what === 'color') api.floatText(ev.x, ev.y - 30, '色の違う社', 'mult', 20); else if (ev.what === 'rock') { fx.tick(ev.x, ev.y, [1.2, 1.3, 1.6], 8, 80); audio.note(1, { vol: 0.06, dur: 0.1 }); } break;
    case 'connect': { const s = st.shrines[ev.shrine]; audio.ui('heat'); fx.tick(s.x, s.y, [2.8, 2.2, 1.2], 40, 260); fx.light(s.x, s.y, 0.8, 300, [1, 0.7, 0.4]); api.floatText(s.x, s.y - 64, 'つながった', 'gold', 24); break; }
    case 'save': {
      const s = st.shrines[ev.shrine];
      audio.note(10 + (ev.n % 8), { vol: 0.16, dur: 0.6, pan: api.pan(s.x) }); audio.boom(0.5, api.pan(s.x));
      fx.burst('mini', s.x + ((ev.n % 3) - 1) * 30, s.y - 90 - (ev.n % 2) * 26, 70, ['kiku', 'koori', 'kin', 'ootama'][ev.n % 4], 0);
      fx.light(s.x, s.y, 0.6, 220, [1, 0.75, 0.4]);
      api.floatText(s.x + (st.field.land ? -52 : 0), s.y - 54, ev.name, 'gold', 20); break;
    }
    case 'lotus': audio.note(17, { vol: 0.12, dur: 0.5 }); fx.tick(ev.x, ev.y, [3, 1.6, 2.4], 30, 160); api.floatText(ev.x, ev.y - 34, '蓮の光', 'mult', 18); break;
    case 'burn': audio.ui('caught'); api.R.shake += 5; fx.tick(ev.x, ev.y, [3, 1.2, 0.3], 46, 230); for (let i = 0; i < 18; i++) fx.add(ev.x, ev.y, (Math.random() - 0.5) * 120, -40 - Math.random() * 90, 0.9 + Math.random() * 0.5, 2.4, 1.6, 60, [3, 1.4, 0.4], [0.6, 0.15, 0.05], 1.3); break;
    case 'lift': audio.note(3, { vol: 0.12, dur: 0.3 }); break;
    case 'done': {
      // 流した線のかたちのまま、空に開く
      const segs = [];
      for (const k of st.strokes) { const P = k.pts, n = Math.max(2, Math.ceil(P.length / 14)); let i = 0; for (; i + n < P.length; i += n) segs.push([P[i], P[i + n]]); if (i < P.length - 1) segs.push([P[i], P[P.length - 1]]); }
      api.burstShape(segs, [...st.shrines, ...st.lotus.filter((l) => l.got)]);
      for (const s of st.shrines) fx.burst('chrys', s.x, s.y - 110, 150, 'kin', 1);
      break;
    }
    case 'fail': audio.fuse(0, 0); api.R.shake += 6; break;
    default:
  }
}
