// 第五章「狐の嫁入り」: こんどは遊ぶ人が火。狐の引く青い線を追って、行列の提灯に火を移し、社の前で狐の尾をつかまえる。
// ルールは ./kitsune-rules.js。ここは章の型（_dev/hanabi-chapter-contract.md）に合わせる包みと、絵・音
import * as K from './kitsune-rules.js';

export const CHAPTER = { id: 'kitsune', no: 5, ja: '狐の嫁入り', sky: 'kitsune', band: 'summer' };
export const LEVELS = K.LEVELS;
export const FAIL = { escaped: '狐は社に入ってしまった', out: '線から外れて、火が消えた', rain: '雨で、火が冷えて消えた', lift: '筆を離して、火が消えた' };

export function newStage(lv, W, H, opt = {}) { return K.newStage(lv, W, H, opt); }
export const penDown = K.penDown, penMove = K.penMove, penUp = K.penUp, step = K.step, starsFor = K.starsFor, bot = K.bot;
// 二度しくじったら、狐の行く先をうっすら見せる
export function retry(lv, fails, opt) { return { ...opt, hint: fails >= 2 }; }

export function info(st) {
  if (st.phase === 'aim') return '<em>青い線のはじまり</em>に筆を置いて、狐を追う';
  if (st.phase === 'done') return '狐の尾を、<em>つかまえた</em>';
  if (st.phase === 'fail') return '';
  if (!st.on) return '<em>線に戻れ</em> — 火が消える';
  if (st.lv.rain && st.heat < 0.5) return '雨で火が冷える — <em>止まるな</em>';
  if (st.mode === 'last') return '鳥居の前で、狐がためらっている — <em>いまだ</em>';
  const n = st.lanterns.length;
  return `提灯 <em>${K.litCount(st)} / ${n}</em> ・ 狐の尾を追え`;
}

export function labels(st) {
  const out = [];
  if (st.phase === 'aim') { const p = st.pts[0]; out.push({ x: p.x, y: p.y - 46, text: 'ここから', cls: 'gold' }); }
  return out;
}

// 狐のいる所（少し上下にはねる）
function foxPos(st, t) {
  const p = K.pointAt(st, st.foxS), run = st.phase === 'run' && (st.mode === 'dash' || st.mode === 'home');
  const hop = st.mode === 'walk' || run ? Math.abs(Math.sin(t * (run ? 16 : 9))) * (run ? 7 : 4) : 0;
  return { x: p.x, y: p.y - 18 - hop };
}
const end = (st) => K.pointAt(st, st.L);

export function draw(st, api) {
  const t = api.t;
  // 社（道の終わり）
  const e = end(st);
  api.put(e.x, e.y - 22, 40, 'shrine', st.mode === 'last' ? 0.5 : 0.25);
  // 提灯
  const cell = api.cellOf({ type: 'chouchin' });
  for (const l of st.lanterns) {
    const sway = Math.sin(t * 2 + l.s * 0.01) * 2;
    api.put(l.x + sway, l.y, l.lit ? 21 : 17, cell, l.lit ? 0.7 : 0, 'shell', l.lit ? 1 : l.missed ? 0.25 : 0.5);
  }
  // 燃えてきた道（火が通った所）
  if (st.phase !== 'aim' && st.sP > 1) {
    const i = Math.min(st.pts.length - 1, Math.floor(st.sP / 5)), pts = st.pts.slice(0, i + 1), q = K.pointAt(st, st.sP);
    pts.push({ x: q.x, y: q.y, s: st.sP });
    api.ribbon({ pts, len: st.sP, flameS: st.sP, heatLv: st.heat > 0.6 ? 2 : st.heat > 0.3 ? 1 : 0, flameOn: true, width: 4.8 });
  }
  // 狐火の分かれ道の、にせの線を引く狐火
  for (const d of st.decoys) {
    const dl = Math.min(d.len, st.foxS - d.s0); if (dl <= 0 || dl >= d.len) continue;
    const p = d.pts[Math.min(d.pts.length - 1, Math.floor(dl / 5))];
    api.put(p.x, p.y - 4, 13, 'kitsunebi', 0.6, 'story', 0.9);
  }
  // 狐（花嫁）と、まわりを回る狐火
  if (!(st.phase === 'fail' && st.reason === 'escaped')) {
    const f = foxPos(st, t), shake = st.mode === 'last' ? Math.sin(t * 30) * 1.5 : 0;
    api.put(f.x + shake, f.y, 30, 'bride', 0.3);
    for (let k = 0; k < 2; k++) { const a = t * 2.6 + k * Math.PI; api.put(f.x + Math.cos(a) * 30, f.y - 6 + Math.sin(a) * 12, 10, 'kitsunebi', 0.6, 'story', 0.85); }
  }
  // 遊ぶ人の火（ヒノコ）。線から外れると、ゆらいで薄くなる
  if (st.phase === 'run' || st.phase === 'done') {
    const q = K.pointAt(st, st.sP), a = st.on ? 1 : 0.35 + 0.35 * Math.abs(Math.sin(t * 22));
    api.put(q.x, q.y - 6, 22 + st.heat * 6, api.HINOKO + (st.heat > 0.7 ? 1 : 0), 0.2, 'shell', a);
  }
}

const BLUE = [1.0, 1.7, 3.4], DECOY = [0.9, 2.3, 2.6], GOLD = [3, 2.2, 0.8];
export function particles(st, api) {
  const { fx, one, t, dt } = api;
  // まだ火の来ていない、狐の線（青く光る）
  const s0 = st.phase === 'aim' ? 0 : st.sP;
  for (let s = s0 + ((t * 40) % 7); s < st.foxS; s += 7) { const p = K.pointAt(st, s); fx.add(p.x, p.y, 0, 0, one, 3.4, 0, 0, BLUE, BLUE, 1.5); }
  for (let s = s0; s < st.foxS; s += 26) { const p = K.pointAt(st, s); fx.add(p.x, p.y, 0, 0, one, 18, 0, 0, [0.3, 0.5, 1.2], [0.3, 0.5, 1.2], 0.3); }
  // 本当の線には足あと（金の点）がある
  for (let s = Math.ceil(s0 / 30) * 30; s < st.foxS - 10; s += 30) { const p = K.pointAt(st, s), tg = K.tangentAt(st, s), side = (Math.round(s / 30) % 2 ? 1 : -1) * 6; fx.add(p.x - tg.y * side, p.y + tg.x * side, 0, 0, one, 2.1, 0, 0, GOLD, GOLD, 1.1); }
  // 二度しくじったら、行く先をうっすら
  if (st.hint) for (let s = st.foxS + 14; s < st.L; s += 16) { const p = K.pointAt(st, s); fx.add(p.x, p.y, 0, 0, one, 1.8, 0, 0, [0.5, 0.7, 1.4], [0.5, 0.7, 1.4], 0.5); }
  // 狐火のにせの線（足あとがない。火が分かれ道を過ぎると消える）
  for (const d of st.decoys) {
    const dl = Math.min(d.len, st.foxS - d.s0); if (dl <= 0) continue;
    const fade = st.sP > d.s0 + 90 ? Math.max(0, 1 - (st.sP - d.s0 - 90) / 140) : 1; if (fade <= 0) continue;
    const fl = 0.75 + 0.25 * Math.sin(t * 11 + d.s0);
    for (let x = (t * 40) % 9; x < dl; x += 9) { const p = d.pts[Math.min(d.pts.length - 1, Math.floor(x / 5))]; fx.add(p.x, p.y, 0, 0, one, 2.5, 0, 0, DECOY, DECOY, 1.2 * fade * fl); }
    if (dl >= d.len && fade > 0.5) { const p = d.pts[d.pts.length - 1]; fx.add(p.x, p.y, 0, 0, one, 18, 0, 0, [0.3, 0.8, 1], [0.3, 0.8, 1], 0.3 * fade); }
  }
  // はじまりの印
  if (st.phase === 'aim') { const p = st.pts[0], r = 30 + Math.sin(t * 5) * 5; for (let j = 0; j < 24; j++) { const a = (j / 24) * 6.283 + t; fx.add(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0, 0, one, 2.2, 0, 0, GOLD, GOLD, 1.3); } }
  // 提灯の灯り
  for (const l of st.lanterns) if (l.lit) { fx.add(l.x, l.y + 2, 0, 0, one, 40, 0, 0, [1.6, 0.8, 0.3], [1.6, 0.8, 0.3], 0.45); fx.light(l.x, l.y, 0.12, 160, [1, 0.6, 0.3]); }
  // 社の灯り
  { const e = end(st); fx.add(e.x, e.y - 20, 0, 0, one, 60, 0, 0, [0.9, 0.3, 0.15], [0.9, 0.3, 0.15], st.mode === 'last' ? 0.4 : 0.2); }
  // 狐のまわりの青い光
  if (!(st.phase === 'fail' && st.reason === 'escaped')) { const f = foxPos(st, t); fx.add(f.x, f.y, 0, 0, one, 46, 0, 0, [0.4, 0.6, 1.4], [0.4, 0.6, 1.4], 0.35); fx.light(f.x, f.y, 0.25, 220, [0.4, 0.6, 1.2]); }
  // 遊ぶ人の火と、火の勢いの輪
  if (st.phase === 'run') {
    const q = K.pointAt(st, st.sP), tg = K.tangentAt(st, st.sP);
    if (st.on) fx.flame(q.x, q.y, tg.x, tg.y, st.heat > 0.5 ? 1 : 0, dt); else if (Math.random() < 0.5) fx.tick(q.x, q.y, [1.4, 0.5, 0.2], 2, 60);
    const n = Math.round(28 * st.heat), col = st.heat > 0.5 ? [3, 1.7, 0.5] : [3, 0.6, 0.3];
    for (let j = 0; j < n; j++) { const a = -Math.PI / 2 + (j / 28) * 6.283; fx.add(q.x + Math.cos(a) * 34, q.y + Math.sin(a) * 34, 0, 0, one, 1.9, 0, 0, col, col, 1.2); }
    // 外れているときは、戻る所を赤い点で示す
    if (!st.on && st.pen) { const d = Math.hypot(st.pen.x - q.x, st.pen.y - q.y), m = Math.min(20, Math.floor(d / 14)); for (let j = 1; j < m; j++) { const u = j / m; fx.add(st.pen.x + (q.x - st.pen.x) * u, st.pen.y + (q.y - st.pen.y) * u, 0, 0, one, 2, 0, 0, [3, 0.5, 0.3], [3, 0.5, 0.3], 1); } }
    api.audio.fuse(1, st.heat > 0.6 ? 2 : 1);
  } else api.audio.fuse(0, 0);
  // 天気雨: 晴れた空から、金色に光る雨
  if (st.lv.rain && st.phase !== 'done') {
    const n = Math.round(st.lv.rain * 18);
    for (let j = 0; j < n; j++) { const x = Math.random() * (api.W + 200) - 100, y = 90 + Math.random() * (api.H * 0.45); fx.add(x, y, -90, 1150, 0.14 + Math.random() * 0.08, 1.1, 0, 0, [1.2, 1.1, 0.8], [0.5, 0.55, 0.7], 0.32, 1); }
  }
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  const at = (s) => K.pointAt(st, s);
  switch (ev.type) {
    case 'start': audio.scene('burn', 0.3); audio.note(9, { vol: 0.14, dur: 0.3 }); fx.tick(st.pts[0].x, st.pts[0].y, [3, 1.8, 0.7], 26, 220); break;
    case 'miss': api.floatText(ev.x, ev.y - 20, '青い線のはじまりへ', 'mult', 18); break;
    case 'dash': { const f = foxPos(st, st.t); api.floatText(f.x, f.y - 34, 'コン', 'gold', 20); audio.note(19, { vol: 0.1, dur: 0.18, pan: api.pan(f.x) }); fx.tick(f.x, f.y, [1, 1.8, 3.2], 12, 160); break; }
    case 'wait': if (ev.last) { const f = foxPos(st, st.t); api.whisper(f.x, f.y - 50, '……'); audio.note(14, { vol: 0.12, dur: 0.6 }); } break;
    case 'off': audio.note(1, { vol: 0.12, dur: 0.2 }); break;
    case 'back': audio.note(7, { vol: 0.1, dur: 0.15 }); break;
    case 'lantern': {
      const l = st.lanterns[ev.i]; audio.note(10 + (ev.i % 8), { vol: ev.auto ? 0.1 : 0.17, dur: 0.45, pan: api.pan(l.x) });
      fx.tick(l.x, l.y, [3, 1.6, 0.5], ev.auto ? 14 : 22, 180); fx.light(l.x, l.y, 0.6, 240, [1, 0.6, 0.3]);
      if (!ev.auto) api.floatText(l.x, l.y - 30, '灯', 'gold', 22);
      break;
    }
    case 'lanternMiss': { const l = st.lanterns[ev.i]; api.floatText(l.x, l.y - 28, '取りこぼし', '', 16); break; }
    case 'catch': {
      const f = foxPos(st, st.t); audio.ui('heat'); api.R.flash = Math.max(api.R.flash, 0.12);
      api.floatText(f.x, f.y - 44, 'つかまえた', 'big', 28);
      fx.burst('kamuro', f.x, f.y - 20, 150, 'koori', 1); audio.boom(1.4, api.pan(f.x));
      break;
    }
    case 'done': {
      // 燃えた道が、そのまま空に開く。提灯ひとつずつにも花火
      const segs = []; for (let s = 0; s < st.sP; s += 60) segs.push([at(s), at(Math.min(st.sP, s + 60))]);
      api.burstShape(segs, st.lanterns.map((l) => ({ x: l.x, y: l.y })));
      break;
    }
    case 'fail': {
      audio.fuse(0, 0);
      if (ev.reason === 'escaped') { const e = end(st); fx.tick(e.x, e.y - 20, [1, 1.6, 3], 40, 220); api.whisper(e.x, e.y - 70, '置いていかれた'); }
      else { const q = at(st.sP); fx.tick(q.x, q.y, [0.8, 0.5, 0.4], 30, 120); api.R.shake += 5; }
      break;
    }
    default:
  }
}
