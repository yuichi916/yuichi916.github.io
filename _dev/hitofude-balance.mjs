// 一筆花火のバランス測定。8 夜を通しで遊ぶボットで、何夜まで越えられるかの分布を出す。
// 夜を越えたら墨壺（inkCarry）を次の夜へ持ちこす。散ったら予備の提灯（段位 3 からは無い）で 1 度だけひき直す。
// お守りは 5 つの枠（段位 8 は 4）で集め、同じものを取ると Lv が上がる。腕前ごとの通過率・お守りの値打ちは _dev/hitofude-skill.mjs で測る。
// 使い方: N=240 node _dev/hitofude-balance.mjs <月の番号 0-7 か all> <T: 1 夜あたりに試す線の数> [priority|random|archetype] [段位 0-8] [starter|all|legend]
//   priority  値打ちの大きい順（VALUE）に取る。枠がいっぱいなら、いちばん弱いものと入れかえる（得なときだけ）
//   random    でたらめに取る。枠がいっぱいなら、でたらめに 1 つ捨てる
//   archetype 型（金・提灯・連鎖・墨・大トリ）を 1 つ決めて、その型のお守りと Lv 上げを先に取る
import * as K from '../assets/hitofude/core.js';

// はじめから選べる 9 つ（assets/hitofude/meta.js の STARTER_CHARMS と同じ）
export const STARTER = ['nagafude', 'kinun', 'kodou', 'tairin', 'nokoribi', 'chouchinshi', 'mashidama', 'owaridama', 'amayoke'];
export const POOLS = {
  starter: STARTER,
  all: K.CHARM_IDS.filter((id) => K.charmById(id).rarity !== 'legend'),
  legend: K.CHARM_IDS.slice(),
};
// お守りの値打ち（Lv1 を持ったときの、だいたいの点の伸び。_dev/hitofude-skill.mjs charms で測った中央値から）。Lv2・Lv3 は LV_GAIN ずつ足す
export const VALUE = {
  kodou: 1.25, kinun: 1.2, chouchinshi: 1.2, hanaikada: 1.3, maneki: 1.3, renjishi: 1.25, senkou: 1.3, kamaitachi: 1.35, tengu: 1.2,
  osobi: 1.2, ichibanboshi: 1.12, nagafude: 1.15, tairin: 1.15, mashidama: 1.12, nokoribi: 1.12, owaridama: 1.1, nihitsu: 1.12,
  nokorizumi: 1.1, suminagashi: 1.1, mankai: 1.08, amayoke: 1.08, kazekiri: 1.1, tanuki: 1.2, kitsune: 1.15,
};
export const LV_GAIN = 0.6;
export const PRIORITY = Object.keys(VALUE).sort((a, b) => VALUE[b] - VALUE[a]);
const val = (id, lv = 1) => lv ? Math.log(VALUE[id] || 1.05) * (1 + LV_GAIN * (lv - 1)) : 0;
// 型: いちばん値打ちが集まっている型（はじめは null）
const FOCUS = ['gold', 'lantern', 'chain', 'ink', 'finale'];
export function focusOf(held) {
  const lv = K.charmLevels(held), sum = {};
  for (const id in lv) for (const t of K.charmById(id).tags) if (FOCUS.includes(t)) sum[t] = (sum[t] || 0) + val(id, lv[id]);
  let best = null;
  for (const t in sum) if (!best || sum[t] > sum[best]) best = t;
  return best;
}
// 候補から 1 つ選ぶ。返り値 { pick, drop }（pick が null なら取らない。drop は入れかえて捨てるもの）
export function choosePick(policy, offer, held, { slots = K.SLOTS, rng = Math.random, night = 0 } = {}) {
  const lv = K.charmLevels(held), ids = Object.keys(lv);
  if (!offer.length) return { pick: null, drop: null };
  if (policy === 'random') {
    const id = offer[Math.floor(rng() * offer.length)];
    return { pick: id, drop: !lv[id] && ids.length >= slots ? ids[Math.floor(rng() * ids.length)] : null };
  }
  const focus = policy === 'archetype' ? focusOf(held) : null;
  // まだ役に立たない仕掛けのお守り（その仕掛けが出てくる夜までが遠い）は値打ちを下げる
  const soon = (id) => ((K.CHARM_NEEDS[id] || 0) > night + 2 ? 0.5 : 1);
  const w = (id, l) => {
    let v = val(id, l) * soon(id);
    if (policy === 'archetype') { const tags = K.charmById(id).tags; if (focus ? tags.includes(focus) : tags.some((t) => FOCUS.includes(t))) v *= 1.8; }
    return v;
  };
  let best = null;
  for (const id of offer) {
    let g, drop = null;
    if (lv[id]) g = w(id, lv[id] + 1) - w(id, lv[id]);
    else if (ids.length < slots) g = w(id, 1);
    else {
      const weakest = ids.slice().sort((a, b) => w(a, lv[a]) - w(b, lv[b]))[0];
      g = w(id, 1) - w(weakest, lv[weakest]); drop = weakest;
    }
    if (!best || g > best.g) best = { id, g, drop };
  }
  return best.g > 0 ? { pick: best.id, drop: best.drop } : { pick: null, drop: null };
}
export function applyPick(held, { pick, drop }) {
  let h = held.slice();
  if (drop) h = h.filter((x) => x !== drop);
  if (pick) h.push(pick);
  return h;
}

// 近い玉を順につなぐだけの線。提灯があれば提灯から引きはじめ、雲を横切る線は引かない。
// 尺玉のある夜は、尺玉へ行ける墨を残して、最後に尺玉で終える（ヒノコの「尺玉は線の最後に！」に従う）
function greedyStroke(shells, ink, rng, clouds = []) {
  const alive = shells.filter((s) => !s.burst);
  if (!alive.length) return [];
  const lantern = alive.find((s) => s.type === 'chouchin'), shaku = alive.find((s) => s.type === 'shaku');
  let cur = lantern || alive[Math.floor(rng() * alive.length)];
  const pts = [{ x: cur.x, y: cur.y }];
  let used = 0; const seen = new Set([cur.id]);
  if (shaku) seen.add(shaku.id);
  const back = (s) => (shaku ? Math.hypot(s.x - shaku.x, s.y - shaku.y) : 0);
  while (true) {
    const cand = alive.filter((s) => !seen.has(s.id) && !K.crossesCloud(clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(rng() * cand.length)];
    if (used + pick.d + back(pick.s) > ink) break;
    used += pick.d; seen.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  if (shaku && cur !== shaku) pts.push({ x: shaku.x, y: shaku.y });
  return pts;
}
// まっすぐの夜: 玉から玉へ向かう直線（lightStroke が墨の長さで切る）
function straightStroke(shells, ink, rng) {
  const alive = shells.filter((s) => !s.burst);
  if (alive.length < 2) return [];
  const a = alive[Math.floor(rng() * alive.length)];
  const far = alive.filter((s) => Math.hypot(s.x - a.x, s.y - a.y) > 120);
  const b = (far.length ? far : alive)[Math.floor(rng() * (far.length ? far.length : alive.length))];
  return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
}
export const strokeFor = (st, rng) => (st.twist === 'massugu' ? straightStroke(st.shells, st.ink, rng) : greedyStroke(st.shells, st.ink, rng, st.clouds));
// 線を前から frac の長さで切る（墨を残すお守りを持つ人は、短い線も試す）
export function cut(pts, frac) {
  const total = K.pathLength(pts) * frac, out = [pts[0]];
  let used = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (used + d >= total) { const k = (total - used) / d; out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k }); break; }
    used += d; out.push(pts[i]);
  }
  return out;
}
// 考える線: 近い順の線を T 本（墨を残すお守りを持てば、その 7 割・5 割で切った線も。天狗の団扇なら、玉から玉への直線も）
export function candidates(st, rng, T) {
  const lv = K.charmLevels(st.charms), out = [];
  const ink = lv.nokorizumi || lv.suminagashi;
  for (let t = 0; t < T; t++) {
    const s = strokeFor(st, rng);
    out.push(s);
    if (ink && s.length >= 3 && st.twist !== 'massugu') out.push(cut(s, 0.7), cut(s, 0.5));
    if (lv.tengu && st.twist !== 'massugu') out.push(straightStroke(st.shells, st.ink, rng));
  }
  return out;
}
// 1 本を最後まで回す（二筆目は、残った玉の近い順の線）
export function playLine(ctx, s1, rng) {
  const st = K.newRound(ctx);
  if (!K.lightStroke(st, s1)) return null;
  for (let n = 0; n < 3600 && !st.done; n++) {
    if (st.phase === 'draw2') { const s2 = strokeFor(st, rng); if (!(s2.length >= 2 && K.lightStroke(st, s2))) K.finish(st); }
    K.step(st); st.events.length = 0;
  }
  if (!st.done) K.finish(st);
  return st;
}
export function playNight(ctx, T, rng) {
  const st0 = K.newRound(ctx);
  let best = null;
  for (const s1 of candidates(st0, rng, T)) {
    const st = playLine(ctx, s1, rng);
    if (st && (!best || st.result.score > best.result.score)) best = st;
  }
  return best;
}
export function playRun(seed, moon, T, rng, pickPolicy = 'priority', { level = 0, pool = STARTER } = {}) {
  const fx = K.levelFx(level);
  let charms = [], total = 0, cleared = 0, bank = 0, spare = fx.spare, retries = 0, wishes = 0;
  const scores = [], twists = [];
  for (let night = 0; night < K.NIGHTS; night++) {
    const ctx = { seed, night, charms, moon, bank, level };
    let best = playNight(ctx, T, rng);
    const target = K.targetFor(seed, night, moon, level);
    if ((!best || best.result.score < target) && spare > 0) { spare--; retries++; const again = playNight(ctx, T, rng); if (again && (!best || again.result.score > best.result.score)) best = again; }
    const score = best ? best.result.score : 0;
    scores.push(score); twists.push(K.twistFor(seed, night) ? K.twistFor(seed, night).id : '');
    total += score;
    if (score < target) break;
    cleared++;
    if (K.wishMet(best, K.wishFor(seed, night, level), target)) wishes++;
    bank = best.result.carry || 0; // 墨壺: いちばん良かった線の残りの墨の半分を、次の夜へ
    // 大一番を越えたら、お守りを 2 つ
    for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) {
      const offer = K.offerCharms(seed, night, charms, round, { pool, level });
      charms = applyPick(charms, choosePick(pickPolicy, offer, charms, { slots: fx.slots, rng, night }));
    }
  }
  return { cleared, total, scores, charms, twists, retries, wishes };
}
if (process.argv[1].endsWith('hitofude-balance.mjs')) {
  const moonArg = process.argv[2] || 'all', T = +(process.argv[3] || 3), policy = process.argv[4] || 'priority', level = +(process.argv[5] || 0), poolName = process.argv[6] || 'starter';
  const rng = K.rng32(1234);
  const hist = Array(9).fill(0); const perNight = Array(8).fill(null).map(() => []); const byTwist = {};
  const N = +(process.env.N || 80), held = {}, lvSum = {};
  let wishes = 0, nightsPlayed = 0;
  for (let i = 1; i <= N; i++) {
    const moon = moonArg === 'all' ? i % 8 : +moonArg;
    const r = playRun(K.hashStr('seed' + i), moon, T, rng, policy, { level, pool: POOLS[poolName] });
    hist[r.cleared]++; wishes += r.wishes; nightsPlayed += r.cleared;
    for (const [id, l] of Object.entries(K.charmLevels(r.charms))) { held[id] = (held[id] || 0) + 1; lvSum[id] = (lvSum[id] || 0) + l; }
    r.scores.forEach((s, n) => { perNight[n].push(s); if (r.twists[n]) (byTwist[`${n + 1}:${r.twists[n]}`] ||= []).push(s); });
  }
  console.log(`moon ${moonArg} T=${T} ${policy} 段位${level} pool=${poolName} N=${N}: nights cleared hist`, hist.map((c, i) => `${i}:${c}`).join(' '));
  const reach = hist.map((_, i) => hist.slice(i).reduce((a, b) => a + b, 0) / N);
  console.log('P(clear >= n):', reach.slice(1).map((p, i) => `${i + 1}:${(p * 100).toFixed(0)}%`).join(' '));
  // その夜までたどり着いた人のうち、その夜を越えた割合（夜ごとの難しさ）
  console.log('P(clear n | reached n):', reach.slice(1).map((p, i) => `${i + 1}:${reach[i] ? (p / reach[i] * 100).toFixed(0) : '-'}%`).join(' '));
  console.log(`願い札がかなった割合（越えた夜のうち）: ${nightsPlayed ? (wishes / nightsPlayed * 100).toFixed(0) : 0}%`);
  console.log('最後に持っていたお守り（人数・平均 Lv）:', Object.entries(held).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n} Lv${(lvSum[id] / n).toFixed(1)}`).join(', '));
}
