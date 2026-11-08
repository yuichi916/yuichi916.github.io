// 第一章「星の夜」: 星座の一筆書き。ルールは ../stars.js。ここは章の型（ch/README は _dev/hanabi-chapter-contract.md）に合わせる包み
import * as Z from '../stars.js';

export const CHAPTER = { id: 'hoshi', no: 1, ja: '星の夜', sky: 'tanabata', band: 'summer' };
export const LEVELS = Z.LEVELS;
export const FAIL = { caught: '火に追いつかれた', lift: '筆を離した', stuck: '行き止まり。もう進める線がない' };

export function newStage(lv, W, H, opt = {}) { const st = Z.newPuzzle(lv, W, H, opt); st.hintOdd = !!opt.hint; return st; }
export const penDown = Z.penDown, penMove = Z.penMove, penUp = Z.penUp, starsFor = Z.starsFor, solve = Z.solve;
export function step(st, dt) { Z.step(st, dt); }
// 失敗のあと: 鵲の面は 1 度目の失敗で、筆を一度離せるようになる
export function retry(lv, fails, opt) { return { ...opt, magpie: !!(lv.magpie && (opt.magpie || fails >= 1)), hint: fails >= 2 || LEVELS.indexOf(lv) === 0 }; }

export function info(st) {
  if (st.phase === 'aim') return st.hintOdd ? '<em>光る星</em>から描きはじめる' : '星を押して、描きはじめる';
  if (st.phase === 'jump') return '<em>鵲の橋</em> — 次の星を押す';
  return `のこりの線 <em>${Z.remaining(st)}</em>${st.jumpsLeft > 0 ? ' ・ 鵲の橋 ×' + st.jumpsLeft : ''}`;
}

export function draw(st, api) {
  if (st.pts.length > 1) { const gap = st.len - st.fireS; api.ribbon({ pts: st.pts, len: st.len, flameS: st.fireS, heatLv: st.fireOn ? (gap < 90 ? 2 : gap < 180 ? 1 : 0) : 0, flameOn: st.fireOn }); }
  if (st.fireOn && st.phase !== 'done') api.put(st.fx, st.fy - 6, 30, api.HINOKO + (st.len - st.fireS < 90 ? 1 : 0), 0.2, 'shell');
}

let river = null;
export function particles(st, api) {
  const { fx, one, t, dt } = api;
  if (st.lv.river) {
    if (!river) { river = Array.from({ length: 560 }, () => ({ u: Math.random(), w: (Math.random() - 0.5) * (Math.random() - 0.5) * 2, ph: Math.random() * 9, s: 1 + Math.random() * 2 })); }
    const f = st.field, cx = (f.x0 + f.x1) / 2;
    for (const p of river) { const y = f.y0 - 110 + p.u * (f.y1 - f.y0 + 240), x = cx + (y - (f.y0 + f.y1) / 2) * -0.1 + p.w * 110, a = 0.55 + 0.35 * Math.sin(t * 1.7 + p.ph); fx.add(x, y, 0, 0, one, p.s * 1.2, 0, 0, [1.1, 1.25, 2], [1.1, 1.25, 2], a); }
    for (let i = 0; i < 9; i++) { const y = f.y0 - 60 + (i / 8) * (f.y1 - f.y0 + 120), x = cx + (y - (f.y0 + f.y1) / 2) * -0.1; fx.add(x, y, 0, 0, one, 80, 0, 0, [0.25, 0.32, 0.6], [0.25, 0.32, 0.6], 0.16); }
  }
  for (const e of st.edges) {
    if (e.used) continue;
    const a = st.nodes[e.a], b = st.nodes[e.b], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(d / 17);
    for (let i = 1; i < n; i++) { const u = (i + ((t * 0.6) % 1)) / n; fx.add(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0, 0, one, 2.7, 0, 0, [1.3, 1.7, 3], [1.3, 1.7, 3], 1.15); }
  }
  const odd = st.hintOdd && st.phase === 'aim' ? new Set(Z.oddNodes(st)) : null;
  st.nodes.forEach((n, i) => {
    const left = st.edges.some((e) => !e.used && (e.a === i || e.b === i)), tw = 0.8 + 0.2 * Math.sin(t * 3 + i);
    const col = left ? [2.4, 2.7, 3.4] : [1.6, 1.2, 0.6];
    fx.add(n.x, n.y, 0, 0, one, (left ? 9 : 5.5) * tw, 0, 0, col, col, 2);
    fx.add(n.x, n.y, 0, 0, one, 34, 0, 0, [0.5, 0.65, 1.2], [0.5, 0.65, 1.2], left ? 0.5 : 0.15);
    for (const a of [0, Math.PI / 2]) for (const s of [-1, 1]) { const L = (left ? 26 : 12) * tw; for (const k of [0.35, 0.7]) fx.add(n.x + Math.cos(a) * L * s * k, n.y + Math.sin(a) * L * s * k, 0, 0, one, 1.9 - k, 0, 0, col, col, 1.3); }
    if (odd && odd.has(i)) { const r = st.r + 6 + Math.sin(t * 5) * 4; for (let j = 0; j < 22; j++) { const a = (j / 22) * 6.283 + t; fx.add(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r, 0, 0, one, 2.2, 0, 0, [3, 2.2, 0.8], [3, 2.2, 0.8], 1.3); } }
    if ((st.phase === 'draw' || st.phase === 'jump') && i === st.cur) { const r = st.r + 2; for (let j = 0; j < 18; j++) { const a = (j / 18) * 6.283 - t * 2; fx.add(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r, 0, 0, one, 1.8, 0, 0, [3, 1.8, 0.6], [3, 1.8, 0.6], 1.1); } }
  });
  if (st.phase === 'draw' && st.pen) { const a = st.nodes[st.cur], d = Math.hypot(st.pen.x - a.x, st.pen.y - a.y), n = Math.min(16, Math.floor(d / 20)); for (let i = 1; i <= n; i++) { const u = i / n; fx.add(a.x + (st.pen.x - a.x) * u, a.y + (st.pen.y - a.y) * u, 0, 0, one, 1.6, 0, 0, [1.4, 1.1, 0.7], [1.4, 1.1, 0.7], 0.4); } fx.add(st.pen.x, st.pen.y, 0, 0, one, 8, 0, 0, [2.4, 2, 1.2], [2, 1.5, 0.8], 0.8); }
  if (st.fireOn && (st.phase === 'draw' || st.phase === 'jump' || st.phase === 'clear')) {
    const P = st.pts, i = Math.max(1, P.findIndex((p) => p.s >= st.fireS)), a = P[i - 1] || P[0], b = P[i] || a, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    fx.flame(st.fx, st.fy, (b.x - a.x) / l, (b.y - a.y) / l, st.len - st.fireS < 90 ? 2 : 1, dt);
    api.audio.fuse(1, st.len - st.fireS < 90 ? 2 : 1);
  } else api.audio.fuse(0, 0);
}

export function onEvent(ev, st, api) {
  const { fx, audio } = api;
  switch (ev.type) {
    case 'start': audio.scene('burn', 0.3); audio.note(9, { vol: 0.14, dur: 0.3 }); break;
    case 'ignite': audio.note(2, { vol: 0.14, dur: 0.25 }); fx.tick(st.fx, st.fy, [3, 1.8, 0.7], 26, 220); break;
    case 'edge': { const n = st.nodes[ev.n]; audio.note(8 + (st.edges.length - ev.left), { vol: 0.17, dur: 0.4, pan: api.pan(n.x) }); fx.tick(n.x, n.y, [2, 2.4, 3.2], 22, 200); fx.light(n.x, n.y, 0.6, 260, [0.6, 0.8, 1]); break; }
    case 'used': { const n = st.nodes[ev.n]; api.floatText(n.x, n.y - 30, 'もう描いた線', 'mult', 20); audio.note(1, { vol: 0.1, dur: 0.15 }); break; }
    case 'lift': api.banner('鵲の橋<small>次の星を押して、続きから</small>', 44, 1300); audio.note(20, { vol: 0.16, dur: 0.5 }); break;
    case 'jump': { const a = st.nodes[ev.from], b = st.nodes[ev.n]; for (let i = 0; i <= 24; i++) { const u = i / 24; fx.add(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 60, (Math.random() - 0.5) * 60, -30 - Math.random() * 40, 0.9, 2.6, 1.5, 0, [2.4, 2.6, 3], [0.6, 0.7, 1], 1.4); } audio.launch(api.pan(b.x)); break; }
    case 'clear': audio.ui('heat'); break;
    case 'bloom': api.burstShape(st.edges.map((e) => [st.nodes[e.a], st.nodes[e.b]]), st.nodes); break;
    case 'fail': audio.fuse(0, 0); if (ev.reason === 'caught') { api.R.shake += 8; fx.tick(st.fx, st.fy, [1.2, 0.5, 0.2], 40, 200); } break;
    default:
  }
}

// 手本どおりに引く運転手（テストと、ブラウザの通しで使う）
export function bot(st, mem) {
  // 一筆では描けない面（鵲の前）は、離すところまで描いて失敗する。失敗すると鵲が来る
  if (!mem.sol) { mem.sol = Z.solve(st.lv, st.jumpsLeft) || Z.solve(st.lv, st.jumpsLeft + 1); mem.i = 0; }
  const sol = mem.sol;
  if (st.phase === 'aim') { const n = st.nodes[sol[0].n]; mem.p = { x: n.x, y: n.y }; mem.i = 1; return { down: [n.x, n.y] }; }
  if (st.phase === 'jump') { const n = st.nodes[sol[mem.i].n]; mem.p = { x: n.x, y: n.y }; mem.i++; return { down: [n.x, n.y] }; }
  if (st.phase !== 'draw' || mem.i >= sol.length) return null;
  const q = sol[mem.i];
  if (q.jump) return { up: true };
  const t = st.nodes[q.n], d = Math.hypot(t.x - mem.p.x, t.y - mem.p.y), v = 7;
  if (d <= v) { mem.p = { x: t.x, y: t.y }; mem.i++; } else { mem.p.x += ((t.x - mem.p.x) / d) * v; mem.p.y += ((t.y - mem.p.y) / d) * v; }
  return { move: [mem.p.x, mem.p.y] };
}
