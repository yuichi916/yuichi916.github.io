// 第7章「灯の家」: 夏の記憶の札を、古い順に一筆でつなぐ。ルールは ./ie-rules.js。ここは章の型（_dev/hanabi-chapter-contract.md）に合わせる包み
import * as Z from './ie-rules.js';

export const CHAPTER = { id: 'ie', no: 7, ja: '灯の家', sky: 'ie', band: 'summer' };
export const LEVELS = Z.LEVELS;
export const FAIL = { caught: '火に追いつかれた', lift: '筆を離した', crack: '思い出が、割れてしまった' };

export function newStage(lv, W, H, opt = {}) { return Z.newStage(lv, W, H, opt); }
export const penDown = Z.penDown, penMove = Z.penMove, penUp = Z.penUp, starsFor = Z.starsFor, bot = Z.bot;
export function step(st, dt) { Z.step(st, dt); }
// 失敗のあと: 2 度しくじると、次につなぐ札が光る
export function retry(lv, fails, opt) { return { ...opt, hint: fails >= 2 }; }

const isFinal = (st, c) => st.lv.finale && c.age === 15;
export function info(st) {
  const lv = st.lv;
  if (st.phase === 'aim') {
    if (lv.guide || st.hint) return '<em>光る札</em>から、古い夏の順につなぐ';
    const extra = lv.finale ? '火が<em>速い</em>' : lv.hidden ? '年は<em>近づくと</em>見える' : lv.cards.some((c) => !c[2]) ? '<em>年のない札</em>は避ける' : lv.drift ? '札が<em>漂う</em>' : '';
    return extra ? `<em>古い夏</em>から順に ・ ${extra}` : '<em>古い夏</em>から順に、一筆でつなぐ';
  }
  return `つないだ夏 <em>${st.next}</em> / ${st.order.length} ・ ひび ${st.miss} / ${lv.miss}`;
}

export function labels(st) {
  const out = [];
  for (const c of st.cards) {
    const name = c.age ? Z.MEM[c.age][0] : '……';
    const text = c.seen ? name : '？';
    const cls = isFinal(st, c) ? (c.lit ? 'big gold' : 'gold') : c.lit ? 'gold' : c.cracked ? 'red' : !c.seen || !c.age ? 'dim' : '';
    out.push({ x: c.x, y: c.y + (isFinal(st, c) ? 54 : 44), text, cls });
  }
  const lastLit = st.lv.finale && st.next >= st.order.length;
  if (st.memText && (st.t - st.memT < 4 || lastLit)) out.push({ x: st.w / 2, y: st.field.memY, text: st.memText, cls: 'big gold' });
  return out;
}

export function draw(st, api) {
  for (const c of st.cards) {
    const fin = isFinal(st, c), pulse = fin && !c.lit ? 0.25 + 0.2 * Math.sin(api.t * 3) : 0;
    api.put(c.x, c.y, fin ? 44 : 36, c.lit ? 'memory_lit' : 'memory', c.lit ? 0.55 : 0.08 + pulse, 'story', c.cracked && !c.lit ? 0.7 : 1);
  }
  if (st.pts.length > 1) { const gap = st.len - st.fireS; api.ribbon({ pts: st.pts, len: st.len, flameS: st.fireS, heatLv: st.fireOn && st.phase === 'draw' ? (gap < 90 ? 2 : gap < 180 ? 1 : 0) : 0, flameOn: st.fireOn }); }
  if (st.fireOn && (st.phase === 'draw' || st.phase === 'clear')) api.put(st.fx, st.fy - 6, 30, api.HINOKO + (st.phase === 'draw' && st.len - st.fireS < 90 ? 1 : 0), 0.2, 'shell');
}

export function particles(st, api) {
  const { fx, one, t, dt } = api, f = st.field;
  // 作業場に舞う、あたたかい埃
  for (let i = 0; i < 26; i++) {
    const u = ((i * 0.618 + t * 0.012 * (1 + (i % 3))) % 1), v = ((i * 0.371 + Math.sin(t * 0.3 + i) * 0.04 + 1) % 1);
    const x = f.x0 - 40 + u * (f.x1 - f.x0 + 80), y = f.y0 - 30 + v * (f.y1 - f.y0 + 60), a = 0.4 + 0.3 * Math.sin(t * 1.3 + i * 2.1);
    fx.add(x, y, 0, 0, one, 2.2, 0, 0, [1.4, 0.9, 0.45], [1.4, 0.9, 0.45], a);
  }
  const nextC = st.phase === 'aim' || st.phase === 'draw' ? st.cards[st.order[st.next]] : null, guide = st.lv.guide || st.hint;
  for (const c of st.cards) {
    const fin = isFinal(st, c);
    if (c.lit) {
      fx.add(c.x, c.y, 0, 0, one, fin ? 120 : 62, 0, 0, [1.3, 0.75, 0.3], [1.3, 0.75, 0.3], fin ? 0.5 : 0.32);
      fx.light(c.x, c.y, fin ? 0.9 : 0.35, fin ? 420 : 200, [1, 0.65, 0.3]);
    } else {
      fx.add(c.x, c.y, 0, 0, one, 46, 0, 0, [0.5, 0.42, 0.32], [0.5, 0.42, 0.32], 0.12);
      if (fin) { // 十五の夏: 遠くで、灯を待っている
        const r = 58 + Math.sin(t * 3) * 6;
        fx.add(c.x, c.y, 0, 0, one, 90, 0, 0, [1.2, 0.7, 0.3], [1.2, 0.7, 0.3], 0.22 + 0.12 * Math.sin(t * 3));
        for (let j = 0; j < 30; j++) { const a = (j / 30) * 6.283 + t * 0.6; fx.add(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 1.15, 0, 0, one, 1.8, 0, 0, [2.6, 1.7, 0.6], [2.6, 1.7, 0.6], 0.9); }
      }
    }
    if (c.cracked) { // ひび: 札を斜めに走る赤い線
      for (let j = 0; j <= 10; j++) { const u = j / 10, zx = c.x - 18 + u * 36 + (j % 2 ? 7 : -7), zy = c.y - 34 + u * 68; fx.add(zx, zy, 0, 0, one, 1.9, 0, 0, [2.6, 0.5, 0.3], [2.6, 0.5, 0.3], c.lit ? 0.4 : 1); }
    }
    if (guide && c === nextC) { const r = 52 + Math.sin(t * 5) * 5; for (let j = 0; j < 26; j++) { const a = (j / 26) * 6.283 - t * 1.5; fx.add(c.x + Math.cos(a) * r * 0.85, c.y + Math.sin(a) * r, 0, 0, one, 2, 0, 0, [3, 2.1, 0.8], [3, 2.1, 0.8], 1.2); } }
  }
  if (st.phase === 'draw' && st.pen) fx.add(st.pen.x, st.pen.y, 0, 0, one, 8, 0, 0, [2.4, 2, 1.2], [2, 1.5, 0.8], 0.8);
  if (st.fireOn && (st.phase === 'draw' || st.phase === 'clear')) {
    const P = st.pts, i = Math.max(1, P.findIndex((p) => p.s >= st.fireS)), a = P[i - 1] || P[0], b = P[i] || a, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const hot = st.phase === 'draw' && st.len - st.fireS < 90 ? 2 : 1;
    fx.flame(st.fx, st.fy, (b.x - a.x) / l, (b.y - a.y) / l, hot, dt);
    api.audio.fuse(1, hot);
  } else api.audio.fuse(0, 0);
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  switch (ev.type) {
    case 'start': audio.scene('burn', 0.3); audio.note(9, { vol: 0.14, dur: 0.3 }); break;
    case 'ignite': audio.note(2, { vol: 0.14, dur: 0.25 }); fx.tick(st.fx, st.fy, [3, 1.8, 0.7], 26, 220); break;
    case 'seen': { const c = st.cards[ev.i]; audio.note(16, { vol: 0.05, dur: 0.2, pan: api.pan(c.x) }); break; }
    case 'lit': {
      const c = st.cards[ev.i], fin = isFinal(st, c);
      audio.note(6 + ev.n * 2, { vol: 0.18, dur: 0.6, pan: api.pan(c.x) });
      fx.tick(c.x, c.y, [3, 2.2, 0.9], fin ? 60 : 30, fin ? 320 : 200); fx.light(c.x, c.y, 0.9, 300, [1, 0.7, 0.35]);
      if (fin) { // 十五の夏に灯がともる: 尺玉がひとつ開いて、思い出す
        api.R.flash = Math.max(api.R.flash, 0.22); api.R.shake += 10;
        fx.burst('kamuro', c.x, c.y, 240, 'shaku', 2); audio.boom(2.4, api.pan(c.x));
        api.whisper(Math.min(st.w - 200, Math.max(200, c.x)), Math.max(st.field.memY + 60, c.y - 90), '……思い出した');
      }
      break;
    }
    case 'crack': { const c = st.cards[ev.i]; api.floatText(c.x, c.y - 52, c.age ? 'ひび — まだ早い' : 'ひび — 年のない札', 'mult', 20); audio.note(1, { vol: 0.16, dur: 0.3 }); api.R.shake += 5; fx.tick(c.x, c.y, [2.4, 0.5, 0.3], 24, 160); break; }
    case 'clear': audio.ui('heat'); break;
    case 'bloom': {
      const pts = st.order.map((i) => st.cards[i]), segs = [];
      for (let j = 1; j < pts.length; j++) segs.push([pts[j - 1], pts[j]]);
      api.burstShape(segs, pts);
      break;
    }
    case 'fail': audio.fuse(0, 0); if (ev.reason === 'caught') { api.R.shake += 8; fx.tick(st.fx, st.fy, [1.2, 0.5, 0.2], 40, 200); } break;
    default:
  }
}
