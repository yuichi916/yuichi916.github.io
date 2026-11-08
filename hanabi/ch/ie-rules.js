// 一筆花火 物語「灯の家」— 散らばった夏の記憶を、古い順に一筆でつなぐ。DOM に触らない。
// 決まり: 線の始まりから火が追ってくる。筆が札を通ると、順番が合っていれば札に灯がともり、違えば札にひびが入る。
// ひびが許された数を越えると、思い出が割れて失敗。最後の札に灯がともると、残りの線は一気に燃える。
export const DT = 1 / 60;

// 札の年と、灯がともったときに浮かぶ思い出（台本 script.js の「ie」の pre と合わせてある）
export const MEM = {
  5: ['五つの夏', '蚊帳の中で、花火の音を数えた'],
  6: ['六つの夏', '肩車で、尺玉が開くのを見た'],
  7: ['七つの夏', 'じいちゃんの膝で、はじめての線香花火'],
  8: ['八つの夏', '縁側で、スイカの種を飛ばしあった'],
  9: ['九つの夏', 'じいちゃんが、浴衣の帯を結んでくれた'],
  10: ['十の夏', '金魚すくい。じいちゃんは一匹もすくえない'],
  11: ['十一の夏', '花火の筒を、はじめて運ばせてもらった'],
  12: ['十二の夏', '尺玉の火薬に触って、ひどく叱られた'],
  13: ['十三の夏', '秘伝帳を、こっそり読んだ'],
  14: ['十四の夏', '「来年は、おまえが上げろ」'],
  15: ['十五の夏', '送り火の夜。火が、追いかけてきた'],
};

// cards: [u, v, 年, ゆれ幅?]（年 0 は年のない札）。u は 0〜1.6、v は 0〜1 の箱の中の割合。速さは線の長さで数える
// guide: 次の札が光る。hidden: 年は近づくまで見えない。drift: 札がゆっくり漂う。miss: 許されるひびの数
export const LEVELS = [
  { id: 'nanatsu', ja: '七つの夏', cards: [[0.15, 0.62, 5], [0.8, 0.35, 6], [1.45, 0.62, 7]], guide: true, miss: 2, v0: 70, ramp: 6, grace: 1.4 },
  { id: 'kokonotsu', ja: '九つの夏', cards: [[1.3, 0.2, 6], [0.25, 0.25, 7], [0.85, 0.8, 8], [1.45, 0.75, 9]], miss: 2, v0: 100, ramp: 10 },
  { id: 'too', ja: '十の夏', cards: [[0.75, 0.5, 6], [0.2, 0.15, 7], [1.4, 0.18, 8], [0.25, 0.85, 9], [1.35, 0.85, 10]], hidden: true, miss: 2, v0: 105, ramp: 12 },
  { id: 'juichi', ja: '十一の夏', cards: [[0.15, 0.5, 7], [0.55, 0.15, 8], [1.0, 0.55, 9], [1.45, 0.15, 10], [1.45, 0.85, 11], [0.55, 0.85, 0], [1.0, 0.12, 0]], miss: 2, v0: 115, ramp: 14 },
  { id: 'juni', ja: '十二の夏', cards: [[0.2, 0.2, 7], [0.2, 0.8, 8], [0.65, 0.5, 9], [1.05, 0.15, 10], [1.05, 0.85, 11], [1.45, 0.5, 12]], drift: 22, miss: 1, v0: 125, ramp: 16 },
  { id: 'jusan', ja: '十三の夏', cards: [[1.42, 0.5, 8], [0.95, 0.15, 9], [0.5, 0.5, 10], [0.95, 0.85, 11], [0.12, 0.15, 12], [0.12, 0.85, 13], [0.5, 0.1, 0], [0.5, 0.9, 0]], hidden: true, miss: 1, v0: 135, ramp: 20 },
  { id: 'juyon', ja: '十四の夏', cards: [[0.12, 0.25, 8], [0.55, 0.12, 9], [1.0, 0.3, 10], [1.45, 0.12, 11], [1.3, 0.78, 12], [0.8, 0.88, 13], [0.32, 0.75, 14], [0.66, 0.5, 0], [1.48, 0.48, 0]], hidden: true, drift: 18, miss: 1, v0: 145, ramp: 22 },
  // 最後: 十から十四は近くに。十五の夏だけが遠く、間を年のない札がゆれる。火は速い
  { id: 'jugo', ja: '十五の夏', cards: [[0.1, 0.3, 10], [0.36, 0.12, 11], [0.5, 0.55, 12], [0.15, 0.82, 13], [0.48, 0.92, 14], [1.5, 0.5, 15], [1.0, 0.48, 0, 46]], miss: 1, v0: 200, ramp: 100, vmax: 900, grace: 0.8, finale: true },
];

export function fieldFor(w, h) {
  return w >= h ? { land: true, x0: 110, x1: w - 110, y0: 172, y1: h * 0.56, memY: 130 } : { land: false, x0: 76, x1: w - 76, y0: 262, y1: h * 0.64, memY: 182 };
}
const place = (f, u, v) => (f.land ? { x: f.x0 + (u / 1.6) * (f.x1 - f.x0), y: f.y0 + v * (f.y1 - f.y0) } : { x: f.x0 + v * (f.x1 - f.x0), y: f.y0 + (u / 1.6) * (f.y1 - f.y0) });

export function newStage(lv, w, h, opt = {}) {
  const f = fieldFor(w, h);
  const cards = lv.cards.map(([u, v, age, amp], i) => { const p = place(f, u, v); return { i, bx: p.x, by: p.y, x: p.x, y: p.y, age, amp: amp ?? (lv.drift || 0), lit: false, cracked: false, seen: !lv.hidden, inside: false }; });
  const order = cards.filter((c) => c.age).sort((a, b) => a.age - b.age).map((c) => c.i);
  let ideal = 0; for (let j = 1; j < order.length; j++) ideal += Math.hypot(cards[order[j]].x - cards[order[j - 1]].x, cards[order[j]].y - cards[order[j - 1]].y);
  return {
    lv, w, h, field: f, cards, order, next: 0, miss: 0, r: 28, revealR: f.land ? 200 : 180, phase: 'aim', events: [], t: 0,
    pts: [], len: 0, fireS: 0, fireOn: false, fx: 0, fy: 0, age: 0, v: 0, minGap: Infinity, pen: null, reason: null, doneT: 0,
    par: ideal / 320 + 1.2, hint: !!opt.hint, memText: '', memT: -9, memAge: 0,
  };
}

// 札が漂う（面の時刻だけで決まる）
function drift(st) {
  for (const c of st.cards) {
    if (!c.amp) continue;
    if (c.age === 0 && st.lv.finale) { c.x = c.bx; c.y = c.by + c.amp * Math.sin(st.t * 1.6); continue; } // 最後の面の年のない札は、上下にゆれて道をふさぐ
    c.x = c.bx + c.amp * Math.sin(st.t * 0.7 + c.i * 1.7); c.y = c.by + c.amp * 0.8 * Math.cos(st.t * 0.55 + c.i * 2.3);
  }
}

function fail(st, reason) { st.phase = 'fail'; st.reason = reason; st.events.push({ type: 'fail', reason }); }

// 筆の先が (x, y) を通った
function touch(st, x, y) {
  for (const c of st.cards) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < st.revealR && !c.seen) { c.seen = true; st.events.push({ type: 'seen', i: c.i }); }
    if (d >= st.r) { if (d > st.r * 1.3) c.inside = false; continue; }
    if (c.inside) continue;
    c.inside = true;
    if (c.lit) continue;
    if (c.i === st.order[st.next]) {
      c.lit = true; c.seen = true; st.next++;
      st.memText = MEM[c.age][1]; st.memT = st.t; st.memAge = c.age;
      st.events.push({ type: 'lit', i: c.i, n: st.next, last: st.next >= st.order.length });
      if (st.next >= st.order.length) { st.phase = 'clear'; st.events.push({ type: 'clear' }); return; }
    } else if (!c.cracked) {
      c.cracked = true; c.seen = true; st.miss++;
      st.events.push({ type: 'crack', i: c.i, miss: st.miss });
      if (st.miss > st.lv.miss) { fail(st, 'crack'); return; }
    }
  }
}

export function penDown(st, x, y) {
  if (st.phase !== 'aim' || y < 100 || x < 0 || x > st.w || y > st.h) return false;
  st.pts = [{ x, y, s: 0 }]; st.len = 0; st.phase = 'draw'; st.age = 0; st.pen = { x, y }; st.fx = x; st.fy = y;
  st.events.push({ type: 'start' });
  touch(st, x, y);
  return true;
}

export function penMove(st, x, y) {
  if (st.phase !== 'draw') return;
  st.pen = { x, y };
  const last = st.pts[st.pts.length - 1], dx = x - last.x, dy = y - last.y, d = Math.hypot(dx, dy);
  if (d < 2) return;
  const n = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i <= n && st.phase === 'draw'; i++) {
    const px = last.x + (dx * i) / n, py = last.y + (dy * i) / n;
    st.len += d / n; st.pts.push({ x: px, y: py, s: st.len });
    touch(st, px, py);
  }
}

export function penUp(st) {
  if (st.phase !== 'draw') return;
  if (st.len < 12 && st.next === 0 && st.miss === 0) { st.phase = 'aim'; st.pts = []; st.len = 0; st.events.push({ type: 'cancel' }); return; } // 押し間違いは数えない
  fail(st, 'lift');
}

function pointAt(st, s) {
  const P = st.pts; if (P.length < 2) return P[0] || { x: 0, y: 0 };
  let i = 0; while (i < P.length - 2 && P[i + 1].s < s) i++;
  const a = P[i], b = P[i + 1], u = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

export function step(st, dt = DT) {
  st.t += dt;
  drift(st);
  const lv = st.lv, grace = lv.grace || 1.0;
  if (st.phase === 'draw') {
    st.age += dt;
    // 札のほうから筆先へ漂ってきても、通ったことになる
    if (st.pen) touch(st, st.pen.x, st.pen.y);
    if (st.phase === 'draw') {
      if (!st.fireOn && st.age >= grace) { st.fireOn = true; st.events.push({ type: 'ignite' }); }
      if (st.fireOn) {
        st.v = Math.min(lv.vmax || 420, lv.v0 + lv.ramp * (st.age - grace));
        st.fireS += st.v * dt;
        const gap = st.len - st.fireS;
        if (st.len > 0) st.minGap = Math.min(st.minGap, gap);
        if (gap <= 0) { st.fireS = st.len; fail(st, 'caught'); }
      }
    }
  } else if (st.phase === 'clear') {
    st.fireOn = true; st.fireS += Math.max(st.v, 300) * 3 * dt;
    if (st.fireS >= st.len) { st.fireS = st.len; st.phase = 'done'; st.doneT = st.t; st.events.push({ type: 'bloom' }); }
  }
  const p = pointAt(st, Math.min(st.fireS, st.len)); st.fx = p.x; st.fy = p.y;
}

// 星: つなげたら 1、ひびなしで 2、ひびなしで手早いか火をぎりぎりまで引きつけたら 3
export function starsFor(st) {
  if (st.phase !== 'done') return 0;
  const clean = st.miss === 0;
  return 1 + (clean ? 1 : 0) + (clean && (st.age <= st.par || st.minGap < 80) ? 1 : 0);
}

// 運転手: 次の札へ向かい、ほかの札（まだ灯のない札・年のない札）は回りこんでよける。1 コマ 7 まで
export function bot(st, mem) {
  if (st.phase === 'aim') { const c = st.cards[st.order[0]]; mem.p = { x: c.x, y: c.y }; return { down: [c.x, c.y] }; }
  if (st.phase !== 'draw') return null;
  const tgt = st.cards[st.order[st.next]], p = mem.p, clr = st.r + 20;
  let aim = { x: tgt.x, y: tgt.y };
  const dx = tgt.x - p.x, dy = tgt.y - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  let best = null;
  for (const c of st.cards) {
    if (c.lit || c === tgt) continue;
    const t = (c.x - p.x) * ux + (c.y - p.y) * uy, side = (c.x - p.x) * -uy + (c.y - p.y) * ux;
    if (t > -clr && t < L + 4 && Math.abs(side) < clr && (!best || t < best.t)) best = { c, t, side };
  }
  if (best) { const s = best.side >= 0 ? -1 : 1; aim = { x: best.c.x + -uy * s * (clr + 14) + ux * 10, y: best.c.y + ux * s * (clr + 14) + uy * 10 }; }
  const ax = aim.x - p.x, ay = aim.y - p.y, d = Math.hypot(ax, ay), v = 7;
  if (d <= v) { p.x = aim.x; p.y = aim.y; } else { p.x += (ax / d) * v; p.y += (ay / d) * v; }
  return { move: [p.x, p.y] };
}
