// 一筆花火「今夜の一筆」のランキング: 夜ごとに送られてくる 1 夜ぶんを、本物のルールで確かめる（ページとサーバーで同じもの）。
//
// 送るもの（夜を数え終えて記録したとき。散って終わった夜も送る）:
//   { n, events, retries, ad, strokes }
//   n       … この夜の番号（0〜7）。前の夜まで確かめ終えていないと受けない
//   events  … 前の夜のあとの屋台とお守り選びで、したことの順番
//             { t: 'reroll' } 入れかえ ★1 / { t: 'ink' } 墨を足す ★1 / { t: 'life' } 予備の提灯 ★3 / { t: 'pick', id, drop } お守りを取る（枠がいっぱいなら drop を手放す）
//   retries … この夜を予備の提灯でやりなおした回数
//   ad      … この夜を広告でやりなおしたか（祭りで 1 回まで）
//   strokes … この夜の最後の一筆（二筆目があれば 2 本）。st.strokes と同じ、盤の上の点
//
// 点は、送られてきた数字を使わず、ここで線を燃やしなおした点を使う。お守りは候補に出ていたものだけ、
// 星・墨・予備の提灯は、ゲームの屋台と同じ値段と上限で数える（どれかが合わなければ受けない）。
// 願い札は計算が重いので、日ごとの札を前もって作った表から受け取る（ctx.wishOf）。

export const MAX_POINTS = 2400; // 1 本の線の点の数の上限（ふつうは数百）

// 祭りのはじめ（今夜の一筆は段位 0・はじめの星 0・予備の提灯は段位 0 の数）
export function initState(K) {
  return { n: 0, charms: [], bank: 0, wallet: 0, lives: K.levelFx(0).spare, adUsed: false, total: 0, cleared: 0, over: false, prevPass: false };
}

function bad(error) { return { ok: false, error }; }
const isId = (x) => typeof x === 'string' && /^[a-z0-9_]{1,24}$/.test(x);
const lvOf = (charms) => { const o = {}; for (const id of charms) o[id] = (o[id] || 0) + 1; return o; };

// 線の形を確かめて、{x, y} の配列にそろえる（[x, y] でも受ける）
export function cleanStrokes(strokes) {
  if (!Array.isArray(strokes) || strokes.length < 1 || strokes.length > 2) return null;
  const out = [];
  for (const s of strokes) {
    if (!Array.isArray(s) || s.length < 2 || s.length > MAX_POINTS) return null;
    const pts = [];
    for (const p of s) {
      const x = Array.isArray(p) ? p[0] : p && p.x, y = Array.isArray(p) ? p[1] : p && p.y;
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 5000 || Math.abs(y) > 5000) return null;
      pts.push({ x, y });
    }
    out.push(pts);
  }
  return out;
}

// 1 夜ぶんを確かめて、次の状態を返す。ctx = { seed, moon, wishOf(n) → 願い札 | null }
export function applyNight(K, state, payload, ctx) {
  if (!state || state.over) return bad('over');
  if (!payload || typeof payload !== 'object') return bad('payload');
  const n = payload.n;
  if (!Number.isInteger(n) || n !== state.n || n < 0 || n >= K.NIGHTS) return bad('order');
  const s = { ...state, charms: state.charms.slice() };
  const opts = { level: 0 };
  const slots = K.slotsFor(0), cost = (c) => c + (K.levelFx(0).price || 0);

  // 1) 前の夜のあとの屋台とお守り選び（前の夜を越えていて、最後の夜でないときだけ）
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length > 60) return bad('events');
  if (n === 0 || !s.prevPass) { if (events.length) return bad('events'); }
  else {
    const prev = n - 1, more = K.isBoss(prev); // 大一番を越えたら、もう 1 つ選べる
    let round = 0, reroll = 0, done = false;
    for (const e of events) {
      if (!e || typeof e !== 'object' || done) return bad('events');
      if (e.t === 'reroll') { if (s.wallet < cost(1)) return bad('wallet'); s.wallet -= cost(1); reroll++; }
      else if (e.t === 'ink') { if (s.bank >= K.BASE_INK || s.wallet < cost(1)) return bad('wallet'); s.wallet -= cost(1); s.bank = Math.min(K.BASE_INK, s.bank + Math.round(K.BASE_INK / 4)); }
      else if (e.t === 'life') { if (s.lives >= 2 || s.wallet < cost(3)) return bad('wallet'); s.wallet -= cost(3); s.lives++; }
      else if (e.t === 'pick') {
        if (!isId(e.id)) return bad('pick');
        const offer = K.offerCharms(ctx.seed, prev, s.charms, reroll ? 2 + round + 2 * reroll : round, opts);
        if (!offer.includes(e.id)) return bad('offer');
        const lv = lvOf(s.charms);
        if (!lv[e.id] && slots && Object.keys(lv).length >= slots) {
          // 枠がいっぱい: 持っているお守りを 1 つ手放す（Lv の数だけ星が戻る）
          if (!isId(e.drop) || !lv[e.drop]) return bad('drop');
          s.charms = s.charms.filter((x) => x !== e.drop); s.wallet += lv[e.drop];
        } else if (e.drop != null) return bad('drop');
        s.charms.push(e.id);
        if (more && round === 0) { round = 1; reroll = 0; } else done = true;
      } else return bad('events');
    }
  }

  // 2) この夜のやりなおし（予備の提灯の数まで。広告は祭りで 1 回まで）
  const retries = payload.retries == null ? 0 : payload.retries;
  if (!Number.isInteger(retries) || retries < 0 || retries > s.lives) return bad('retries');
  s.lives -= retries;
  if (payload.ad) { if (s.adUsed) return bad('ad'); s.adUsed = true; }

  // 3) 最後の一筆を、本物のルールで燃やしなおす
  const strokes = cleanStrokes(payload.strokes);
  if (!strokes) return bad('strokes');
  const st = K.newRound({ seed: ctx.seed, night: n, charms: s.charms, moon: ctx.moon, bank: s.bank, level: 0 });
  let res;
  try { res = K.runToEnd(st, strokes, { normalized: true }); } catch (e) { return bad('sim'); }
  if (!res || !Number.isFinite(res.score)) return bad('sim');
  const target = st.target, pass = res.score >= target;

  // 4) 星（目標・目標の ★★ 倍・満開・叶った願い札）と、次の夜へ持ちこす墨
  const k2 = K.levelFx(0).star2;
  const stars = (res.score >= target ? 1 : 0) + (res.score >= target * k2 ? 1 : 0) + (res.allClear ? 1 : 0);
  const wish = ctx.wishOf ? ctx.wishOf(n) : null;
  const wishOk = !!(wish && K.wishMet(st, wish, target));
  s.wallet += stars + (wishOk ? (wish.stars || 1) : 0);
  s.bank = pass ? K.inkCarry(st) : 0;
  s.total += Math.round(res.score); s.cleared += pass ? 1 : 0;
  s.n = n + 1; s.prevPass = pass; s.over = !pass || s.n >= K.NIGHTS;
  return { ok: true, state: s, night: { n, score: Math.round(res.score), target, pass, allClear: !!res.allClear, stars, wish: wishOk } };
}
