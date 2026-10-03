// 一筆花火の「祭りの外側」（格・解放・腕だめし・札・実績・今日のおつかい・週のおつかい・続けた日数・図鑑）のテスト。DOM も storage も使わない。
// 実行: node tests/hitofude_meta_test.mjs
import * as M from '../assets/hitofude/meta.js';
import * as K from '../assets/hitofude/core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'not ok'); }
const same = (a, b, msg) => eq(JSON.stringify(a), JSON.stringify(b), msg);
// 項目の並びを問わずに比べる
const sorted = (o) => (Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sorted(o[k])])) : o);
const sameObj = (a, b, msg) => same(sorted(a), sorted(b), msg);
function deepFreeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; }
const addDays = (key, n) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
const findDay = (pred, from = '2026-10-01') => { for (let i = 0; i < 2000; i++) { const d = addDays(from, i); const r = pred(d); if (r != null && r !== false) return [d, r]; } throw new Error('その日が無い'); };

// 夜のまとめを作る（pass の夜は ★ 1 つ。o で足す）
function night(i, pass, o = {}) {
  const boss = i === 2 ? (o.boss3 || 'tengu') : i === 5 ? (o.boss6 || 'tanuki') : null;
  const n = {
    night: i, score: pass ? 200 : 50, target: 100, pass, stars: [pass, pass && !!o.star2, pass && !!o.star3], allClear: pass && !!o.star3,
    pops: o.pops ?? 10 + 3 * i, total: o.total ?? 20 + 4 * i, twist: null, boss, wish: { id: M.WISH_ACTIVE[i], met: pass && !!o.wish }, toriAdd: o.tori || 0,
    maxGen: o.gen ?? 3, goldTouched: o.gold ?? 0, lineTouched: o.touch ?? 8,
  };
  if (o.ink !== undefined) n.inkFrac = o.ink; else n.inkFrac = 0.9;
  if (o.held) n.charms = o.held;
  return n;
}
// cleared 夜を越えて、次の夜で散った祭り。o の値に配列を渡すと、その番号の夜だけ
function run(cleared, o = {}) {
  const nights = [];
  for (let i = 0; i < Math.min(8, cleared + 1); i++) {
    const pass = i < cleared, pick = (k) => (Array.isArray(o[k]) ? o[k].includes(i) : !!o[k]);
    const at = (k, def) => (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && k !== 'held' ? (o[k][i] ?? def) : o[k] ?? def);
    nights.push(night(i, pass, {
      star2: pick('star2'), star3: pick('star3'), wish: pick('wish'), tori: i >= 6 ? o.tori || 0 : 0, boss3: o.boss3, boss6: o.boss6, pops: o.pops, total: o.total,
      gen: at('gen', 3), gold: at('gold', 0), touch: at('touch', 8), ink: o.noInk ? undefined : at('ink', 0.9), held: o.held,
    }));
    if (o.noInk) delete nights[i].inkFrac;
  }
  return { mode: 'run', daily: !!o.daily, level: o.level || 0, cleared, total: cleared * 1000, bestPops: 20, nights, charms: o.charms || { kinun: 1, kodou: 1 }, retries: o.retries ?? 1, outfit: null };
}
// まっさらな meta から、いろいろ開いた meta を作る
const rich = (extra = {}) => M.initMeta({ v: 2, xp: 1e7, top: 8, cast: { tengu: [1, 1], tanuki: [1, 1], kitsune: [1, 1], kamaitachi: [1, 1] }, ...extra });

check('共通の ID: お守り 24・はじめの 9（13版）・伝説 4・大一番と妖怪・衣装・ヒノコの色・遊び方・願い', () => {
  eq(M.CHARM_IDS.length, 24); eq(new Set(M.CHARM_IDS).size, 24);
  same(M.CHARM_IDS.slice().sort(), K.CHARM_IDS.slice().sort(), 'core のお守りと同じ');
  same(M.STARTER_CHARMS, ['kinun', 'kodou', 'tairin', 'chouchinshi', 'mashidama', 'amayoke', 'nokorizumi', 'maneki', 'senkou']);
  for (const id of M.STARTER_CHARMS) ok(M.CHARM_IDS.includes(id) && K.charmById(id).rarity !== 'legend', id);
  same(M.LEGEND_CHARMS, ['tengu', 'tanuki', 'kitsune', 'kamaitachi']);
  same(M.TWIST_BOSS, { massugu: 'tengu', kagami: 'tanuki', yamiyo: 'kitsune', isshun: 'kamaitachi' });
  same(M.OUTFIT_IDS.slice().sort(), ['hachimaki', 'kanmuri', 'kanzashi', 'kingyo', 'omen', 'uchiwa']);
  eq(M.COLOR_IDS.length, 8); eq(new Set(M.COLOR_IDS).size, 8);
  for (const c of M.HINOKO_COLORS) { ok(c.ja && c.en, c.id); eq(c.body.length, 4); for (const x of c.body) ok(/^#[0-9a-f]{6}$/.test(x), `${c.id} ${x}`); }
  for (const f of ['daily', 'levels', 'startPick', 'focus']) ok(M.FEATURE_IDS.includes(f), f);
  ok(M.WISH_IDS.includes('w_tori6') && M.WISH_IDS.includes('w_tori8'), '大トリの願いは新旧とも読める');
  for (const w of K.WISHES) ok(M.WISH_IDS.includes(w.id), `core の願い ${w.id}`);
  ok(!M.WISH_ACTIVE.includes('w_tori8') && M.WISH_ACTIVE.includes('w_tori6'), 'w_tori8 は w_tori6 として数える');
  eq(M.WISH_ACTIVE.length, new Set(K.WISHES.filter((w) => !w.legacy).map((w) => (w.id === 'w_tori8' ? 'w_tori6' : w.id))).size, 'いま出る願い（legacy は数えない）');
  same(M.CAST_IDS, ['tengu', 'tanuki', 'kitsune', 'kamaitachi', 'neko']);
  for (const t of M.BUILD_TAGS) ok(K.TAGS.includes(t), t);
});

check('initMeta: どんな壊れた値でも、きれいな meta を返す（型・範囲・知らない ID・__proto__）', () => {
  const fresh = M.initMeta(undefined);
  const keys = Object.keys(fresh).sort().join();
  const evil = JSON.parse('{"v":2,"xp":120,"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}},'
    + '"cast":{"__proto__":[5,5],"tengu":[1,1],"nope":[3,3]},"charms":{"constructor":[1,1,1],"kinun":[2,1,9],"toString":[1]},'
    + '"wish":{"__proto__":3,"w_bloom":2,"w_fake":1},"ach":["__proto__","first_night","first_night","nope"],"shells":["kin","kuro","kin",7],'
    + '"sticker":{"__proto__":3,"kinun":4,"nope":2,"kodou":-1,"tairin":99},"ch":["c_ink","__proto__","c_ink","c_nope"],"chb":{"__proto__":5,"c_gen":6,"c_x":1},'
    + '"keep":["charm:nagafude","charm:kinun","__proto__","feature:daily","charm:nagafude"],"week":{"k":"2026-10-05","p":99}}');
  const garbage = [
    null, undefined, 0, -1, NaN, 'meta', '', [], [1, 2, 3], true, () => 1, Symbol('x'), new Date(), {},
    { xp: NaN }, { xp: -50 }, { xp: Infinity }, { xp: 1e308 }, { xp: '999' }, { xp: [5] }, { runs: -3, top: 99, best: -1, pops: 1e9 },
    { cast: [], charms: 'x', wish: null, ach: 'first_night', shells: { kin: 1 }, streak: [], quest: 5, sticker: [], ch: 'c_ink', chb: [], keep: {}, week: 'x' },
    { cast: { tengu: 'won', tanuki: [NaN, Infinity], neko: [3, 3] }, charms: { kinun: [NaN, -1, 7], maneki: ['a'] } },
    { streak: { last: '2026-13-45', n: 5, best: 9 } }, { streak: { last: '2026-02-30', n: 5 } }, { streak: { last: 20261002, n: 'x', g: 'nope' } },
    { v: 2, quest: { d: '2026-10-02', p: [999, -1, 'x', 4], x: 9 } }, { quest: { d: 'today', p: [1, 1, 1] } }, { v: 1, xp: 1e9, top: 8 }, { v: 1, xp: -5 }, { v: 'x' },
    { week: { k: '2026-10-06', p: 3 } }, { week: { k: '2026-10-05', p: -3 } }, { sticker: { kinun: NaN, kodou: Infinity, tairin: '3' } },
    { a: { b: { c: { d: {} } } }, xp: { valueOf: () => 1e6 } }, evil,
  ];
  for (const g of garbage) {
    const m = M.initMeta(g);
    eq(Object.keys(m).sort().join(), keys, `${String(typeof g)}: 項目`);
    eq(m.v, M.META_VERSION);
    ok(Number.isFinite(m.xp) && m.xp >= 0 && m.xp <= 1e8, `xp ${m.xp}`);
    ok(m.top >= -1 && m.top <= 8, `top ${m.top}`);
    ok(m.pops <= 9999 && m.best >= 0 && m.runs >= 0 && m.qn >= 0 && m.wn >= 0, '数の範囲');
    for (const id of Object.keys(m.cast)) ok(M.CAST_IDS.includes(id), `知らない妖怪 ${id}`);
    for (const id of Object.keys(m.charms)) ok(M.CHARM_IDS.includes(id), `知らないお守り ${id}`);
    for (const [id, e] of Object.entries(m.charms)) ok(e.length === 3 && e.every(Number.isFinite) && e[2] <= 3, `${id}: ${e}`);
    for (const id of Object.keys(m.wish)) ok(M.WISH_IDS.includes(id), `知らない願い ${id}`);
    for (const id of m.ach) ok(M.ACHIEVEMENTS.some((a) => a.id === id), `知らない実績 ${id}`);
    eq(new Set(m.ach).size, m.ach.length, '実績が重なる');
    for (const [id, v] of Object.entries(m.sticker)) ok(M.CHARM_IDS.includes(id) && Number.isInteger(v) && v >= 0 && v <= 8, `札 ${id} ${v}`);
    for (const id of m.ch) ok(M.CHALLENGES.some((c) => c.id === id), `知らない腕だめし ${id}`);
    eq(new Set(m.ch).size, m.ch.length);
    for (const [id, v] of Object.entries(m.chb)) ok(M.CHALLENGES.some((c) => c.id === id) && Number.isInteger(v), `進み ${id} ${v}`);
    for (const k of m.keep) ok(M.UNLOCKS.some((u) => `${u.kind}:${u.id}` === k), `keep ${k}`);
    eq(new Set(m.keep).size, m.keep.length);
    ok(m.streak.last === null || /^\d{4}-\d{2}-\d{2}$/.test(m.streak.last), `streak.last ${m.streak.last}`);
    ok(m.streak.g === null || /^\d{4}-\d{2}-\d{2}$/.test(m.streak.g), `streak.g ${m.streak.g}`);
    eq(m.quest.p.length, 3); ok(m.quest.x >= -1 && m.quest.x <= 2);
    ok(m.week.k === null || M.weekOf(m.week.k) === m.week.k, `week.k ${m.week.k}`);
    same(M.initMeta(JSON.parse(JSON.stringify(m))), m, '読み直すと同じ（JSON で往復できる）');
    same(M.initMeta(m), m, 'もう一度とおしても同じ');
    // 壊れた meta を渡しても、ほかの関数が落ちない
    M.rankOf(g); M.charmPool(g); M.outfits(g); M.colors(g); M.features(g); M.maxLevel(g); M.collection(g); M.noteSeen(g, g); M.upcoming(g, 3);
    M.applyRun(g, g, g); M.xpForRun(g); M.dailyQuests(g); M.dailyQuests(g, g); M.todayQuests(g, g); M.swapQuest(g, g, g); M.weeklyQuest(g, g); M.weekOf(g);
    M.challenges(g); M.legendLv(g, g); M.legendLv(g, 'tengu'); M.charmCaps(g); M.unlockList(g); M.nextGoals(g, g, g); M.nextGoals(g, '2026-10-05'); M.upcoming(g, g);
  }
  eq(({}).polluted, undefined, 'Object.prototype が汚れた');
  const e = M.initMeta(evil);
  eq(e.xp, 120); same(e.cast, { tengu: [1, 1] }); same(e.charms, { kinun: [2, 1, 3] }); same(e.wish, { w_bloom: 2 });
  same(e.ach, ['first_night']); same(e.shells, ['kin']);
  same(e.sticker, { tairin: 8, kinun: 4 }, '札は 0..8、知らないお守りは捨てる'); same(e.ch, ['c_ink']); same(e.chb, { c_gen: 6 });
  same(e.keep, ['feature:daily', 'charm:nagafude'], 'keep は UNLOCKS にあるものだけ（UNLOCKS の並び）'); same(e.week, { k: '2026-10-05', p: M.weeklyQuest(rich(), '2026-10-05').goal }, '週の進みは goal まで');
  eq(Object.getPrototypeOf(e.cast), Object.prototype);
  same(M.initMeta({ v: 2, quest: { d: '2026-10-02', p: [999, -1, 'x'] } }).quest.p, [M.dailyQuests('2026-10-02')[0].goal, 0, 0], 'おつかいの進みは 0..goal');
  eq(M.initMeta({ week: { k: '2026-10-06', p: 3 } }).week.k, null, '週は月曜の日付だけ');
  eq(M.initMeta({ streak: { last: '2026-02-30', n: 5 } }).streak.n, 0, 'ありえない日付の続けた日数は捨てる');
  eq(M.initMeta({ cast: { neko: [3, 3] } }).cast.neko[1], 0, '猫には勝ち負けがない');
  eq(M.initMeta({ xp: 1e308 }).xp, 1e8, 'xp の上限');
});

// 12版の格の式（テストの中で、もう一度書く）
const V1_COST = (lv) => Math.round((40 + 18 * lv + 0.25 * lv * lv) / 10) * 10;
const V1_AT = (() => { const xs = [0]; for (let lv = 1; lv < 30; lv++) xs.push(xs[lv - 1] + V1_COST(lv)); return xs; })();
const v1Rank = (xp) => { let i = 0; while (i + 1 < 30 && V1_AT[i + 1] <= xp) i++; return i + 1; };
const V1_POOL = (lv) => ['nagafude', 'kinun', 'kodou', 'tairin', 'nokoribi', 'chouchinshi', 'mashidama', 'owaridama', 'amayoke',
  ...[[2, 'maneki'], [4, 'hanaikada'], [5, 'nihitsu'], [7, 'renjishi'], [8, 'suminagashi'], [10, 'senkou'], [11, 'osobi'], [13, 'ichibanboshi'], [14, 'nokorizumi'], [15, 'mankai'], [16, 'kazekiri']].filter(([l]) => lv >= l).map(([, id]) => id)];
const V1_OUTFITS = (lv) => [[3, 'hachimaki'], [6, 'kanzashi'], [9, 'omen'], [12, 'uchiwa'], [18, 'kingyo']].filter(([l]) => lv >= l).map(([, id]) => id);

check('12版（meta.v 1）からの読みこみ: XP・格・実績・図鑑を失わず、開いていたものは開いたまま。おつかいは今日から新しく', () => {
  for (let xp = 0; xp <= 12000; xp += 137) {
    const old = { v: 1, xp, runs: 40, nights: 200, stars: 300, wishes: 50, clears: 9, daily: 12, best: 123456, pops: 44, top: 3,
      cast: { tengu: [3, 2], kitsune: [1, 0], neko: [5, 0] }, charms: { kinun: [9, 4, 3], maneki: [2, 1, 1] }, wish: { w_tori8: 1, w_bloom: 2 },
      shells: ['kin', 'shaku'], ach: ['first_night', 'level3', 'tori8'], streak: { last: '2026-10-01', n: 4, best: 6 }, quest: { d: '2026-10-01', p: [2, 1, 0] } };
    const m = M.initMeta(old), lv = v1Rank(xp);
    eq(m.v, 2);
    ok(m.xp >= xp, `${xp}: XP が減った ${m.xp}`);
    ok(M.rankOf(m).lv >= lv, `${xp}: 格 ${lv} → ${M.rankOf(m).lv}`);
    ok(M.rankOf(m).lv <= lv + 1, `${xp}: 格が上がりすぎ ${lv} → ${M.rankOf(m).lv}`);
    same([m.runs, m.nights, m.stars, m.wishes, m.clears, m.daily, m.best, m.pops, m.top], [40, 200, 300, 50, 9, 12, 123456, 44, 3]);
    same(m.ach, M.ACHIEVEMENTS.map((a) => a.id).filter((id) => ['tori8', 'first_night', 'level3'].includes(id)), '実績はそのまま（実績の並び）');
    same(m.cast, { tengu: [3, 2], kitsune: [1, 0], neko: [5, 0] }); same(m.charms, { kinun: [9, 4, 3], maneki: [2, 1, 1] });
    sameObj(m.wish, { w_bloom: 2, w_tori8: 1 }); same(m.shells, ['kin', 'shaku']); same(m.streak, { last: '2026-10-01', n: 4, best: 6, g: null });
    same(m.quest, { d: null, p: [0, 0, 0], x: -1 }, 'おつかいは新しい一覧なので 0 から');
    const pool = new Set(M.charmPool(m));
    for (const id of V1_POOL(lv)) ok(pool.has(id), `${xp}（格 ${lv}）: ${id} が閉じた`);
    for (const id of V1_OUTFITS(lv)) ok(M.outfits(m).includes(id), `${xp}: 衣装 ${id} が閉じた`);
    ok(M.features(m).includes('daily') === lv >= 2, '今夜の一筆');
    ok(M.features(m).includes('levels'), '段位えらびも開いたまま（top 3）');
    same(M.initMeta(JSON.parse(JSON.stringify(m))), m, '2 回読んでも同じ（もう一度は上げない）');
    eq(M.collection(m).wishes.w_tori6, 1, '12版の w_tori8 は w_tori6 として数える');
  }
});

check('initMeta の legacy: 前の版から遊んでいる人には、meta が無いときだけ 1 度おまけ', () => {
  const a = M.initMeta(null, { runs: 12, cleared: true });
  eq(a.runs, 12); eq(a.xp, 600); eq(M.maxLevel(a), 1); ok(M.features(a).includes('levels'));
  eq(M.initMeta(undefined, { runs: 500 }).xp, 1000, '20 回ぶんまで');
  eq(M.initMeta(undefined, { runs: 5, cleared: 'yes' }).top, -1, 'cleared は true だけ');
  const saved = M.initMeta(null);
  eq(M.initMeta(saved, { runs: 50, cleared: true }).xp, 0, 'もう meta があれば、おまけはない');
  for (const g of [null, 5, 'x', [], { runs: NaN }, { runs: -9 }]) eq(M.initMeta(null, g).xp, 0, String(g));
});

check('格: 30 段・XP は増えるだけ・上がるのに要る XP はだんだん増える（後ほどゆっくり）', () => {
  eq(M.RANKS.length, 30); eq(M.MAX_RANK, 30);
  M.RANKS.forEach((r, i) => { eq(r.lv, i + 1); ok(r.ja && r.en, `${r.lv} の名前`); });
  eq(M.RANKS[0].xp, 0);
  ok(M.RANKS[1].xp <= 40, `格 2 は 1 回目の祭りで届く（${M.RANKS[1].xp}）`);
  let prevCost = 0;
  for (let i = 1; i < M.RANKS.length; i++) {
    const cost = M.RANKS[i].xp - M.RANKS[i - 1].xp;
    ok(cost > 0, `格 ${i + 1} の XP が増えていない`);
    ok(cost >= prevCost, `格 ${i + 1}: 要る XP が減った (${prevCost} → ${cost})`);
    prevCost = cost;
  }
  ok(M.RANKS[2].xp - M.RANKS[1].xp < M.RANKS[29].xp - M.RANKS[28].xp, '後の格ほど遠い');
  eq(new Set(M.RANKS.map((r) => r.ja)).size, 30, '格の名前が重なる');
  for (const r of M.RANKS) {
    eq(M.rankOf(r.xp).lv, r.lv, `ちょうど ${r.xp}`);
    if (r.lv > 1) eq(M.rankOf(r.xp - 1).lv, r.lv - 1, `${r.xp} の 1 つ手前`);
  }
  const a = M.rankOf(M.RANKS[4].xp + 10);
  eq(a.lv, 5); eq(a.cur, 10); eq(a.next, M.RANKS[5].xp - M.RANKS[4].xp); eq(a.toNext, a.next - 10); ok(Math.abs(a.frac - 10 / a.next) < 1e-12);
  eq(a.name, M.RANKS[4].ja); eq(a.nameEn, M.RANKS[4].en);
  const top = M.rankOf(1e9);
  eq(top.lv, 30); eq(top.frac, 1); eq(top.next, 0); ok(top.max);
  // 格 30 から先は「名人の星」
  const o = M.rankOf(M.RANKS[29].xp + 2 * M.OVER_XP + 7);
  same([o.lv, o.over, o.overCur], [30, 2, 7]);
  same([M.rankOf(M.RANKS[28].xp).over, M.rankOf(M.RANKS[29].xp).over], [0, 0]);
  const ov = M.applyRun({ v: 2, xp: M.RANKS[29].xp + M.OVER_XP - 10 }, run(8), '2026-10-02');
  eq(ov.overUp, 1, '名人の星がふえた'); eq(M.applyRun(null, run(1), '2026-10-02').overUp, 0);
  for (const bad of [-5, NaN, Infinity, null, undefined, 'x', {}]) eq(M.rankOf(bad).lv, 1, String(bad));
  eq(M.rankOf({ xp: M.RANKS[9].xp }).lv, 10, 'meta を渡してもよい');
});

check('解放: 格 2〜30 はちょうど 1 つずつ・格で開くお守りは 12 まで・ほかのお守りは腕だめし（格でも開く）・伝説と伝説の道・衣装・色・遊び方', () => {
  const rankU = M.UNLOCKS.filter((u) => u.by === 'rank');
  for (let lv = 2; lv <= 30; lv++) eq(rankU.filter((u) => u.lv === lv).length, 1, `格 ${lv} で開くもの`);
  eq(rankU.length, 29);
  eq(new Set(M.UNLOCKS.map((u) => `${u.kind}:${u.id}`)).size, M.UNLOCKS.length, '同じものが 2 回開く');
  for (const id of M.CHARM_IDS) {
    if (M.STARTER_CHARMS.includes(id)) { ok(!M.UNLOCKS.some((u) => u.id === id && u.kind === 'charm'), `${id} ははじめからある`); continue; }
    const u = M.UNLOCKS.filter((x) => x.kind === 'charm' && x.id === id);
    eq(u.length, 1, `${id} が開く所`);
    if (M.LEGEND_CHARMS.includes(id)) { eq(u[0].by, 'boss'); eq(u[0].boss, id); continue; }
    if (u[0].by === 'rank') ok(u[0].lv <= 12, `${id} は格 ${u[0].lv}`);
    else { eq(u[0].by, 'challenge', id); ok(M.CHALLENGES.some((c) => c.id === u[0].ch && c.reward.id === id), `${id} の腕だめし`); ok(u[0].lv >= 13 && u[0].lv <= 30, `${id} は格 ${u[0].lv} でも`); }
  }
  ok(M.UNLOCKS.filter((u) => u.kind === 'charm' && u.by === 'challenge').length >= 4, '腕だめしで開くお守り');
  for (const b of M.BOSSES) {
    const u = M.UNLOCKS.find((x) => x.kind === 'legend' && x.id === b);
    ok(u && u.by === 'challenge' && u.lv == null, `${b} の伝説の道`);
  }
  for (const id of M.OUTFIT_IDS) eq(M.UNLOCKS.filter((x) => x.kind === 'outfit' && x.id === id).length, 1, `衣装 ${id}`);
  for (const id of M.COLOR_IDS) eq(M.UNLOCKS.filter((x) => x.kind === 'color' && x.id === id).length, 1, `色 ${id}`);
  for (const id of M.FEATURE_IDS) eq(M.UNLOCKS.filter((x) => x.kind === 'feature' && x.id === id).length, 1, `遊び方 ${id}`);
  same(M.UNLOCKS.find((u) => u.id === 'kanmuri'), M.UNLOCKS.find((u) => u.by === 'level'), '王冠は段位 8');
  eq(M.UNLOCKS.find((u) => u.id === 'levels').by, 'clear', '段位えらびは八夜を通して開く');
  ok(M.UNLOCKS.find((u) => u.id === 'daily').lv <= 3, '今夜の一筆は早めに');
  const charmMax = Math.max(...rankU.filter((u) => u.kind === 'charm').map((u) => u.lv));
  for (const f of ['startPick', 'focus']) { const u = M.UNLOCKS.find((x) => x.id === f); ok(u.by === 'rank' && u.lv > charmMax && u.lv <= 16, `${f} は格 ${u.lv}（お守りが出そろってから）`); }
  for (const u of M.UNLOCKS) ok(u.ja && u.en && u.how && u.howEn, `${u.id} の文言`);
  for (const u of M.UNLOCKS.filter((x) => ['feature', 'color', 'legend'].includes(x.kind))) ok(u.desc && u.descEn, `${u.kind}:${u.id} の説明`);
  for (let i = 1; i < M.UNLOCKS.length; i++) ok((M.UNLOCKS[i].lv ?? 99) >= (M.UNLOCKS[i - 1].lv ?? 99), '格の順に並んでいない');

  const fresh = M.initMeta(null);
  same(M.charmPool(fresh), M.CHARM_IDS.filter((id) => M.STARTER_CHARMS.includes(id)), 'はじめは 9 個');
  same(M.outfits(fresh), []); same(M.colors(fresh), []); same(M.features(fresh), []); eq(M.maxLevel(fresh), 0);
  const big = M.initMeta({ v: 2, xp: 1e7 });
  eq(M.charmPool(big).length, 20, '格がいちばん上なら、伝説のほかは全部（腕だめしをしなくても）');
  ok(!M.outfits(big).includes('kanmuri') && M.outfits(big).length === 5);
  same(M.colors(big), M.COLOR_IDS);
  same(M.features(big), M.FEATURE_IDS.filter((f) => f !== 'levels'));
  const all = rich();
  same(M.charmPool(all), M.CHARM_IDS); same(M.outfits(all), M.OUTFIT_IDS); same(M.features(all), M.FEATURE_IDS); eq(M.maxLevel(all), 8);
  // 次に開くもの
  const up = M.upcoming(fresh, 2);
  eq(up.length, 2); eq(up[0].lv, 2); eq(up[0].xpLeft, M.RANKS[1].xp); eq(up[1].lv, 3);
  eq(M.upcoming(big, 3).length, 0);
  // 一覧（図鑑）
  const ul = M.unlockList(fresh);
  eq(ul.length, M.UNLOCKS.length); ok(ul.every((u) => !u.got && u.key));
  ok(M.unlockList(all).every((u) => u.got || u.kind === 'legend'), '伝説の道のほかは全部');
});

check('格が上がるたびに、格の解放がちょうど 1 つ（30 回ぶん）', () => {
  let m = null;
  for (let i = 0; i < 80; i++) {
    const r = M.applyRun(m, run(i % 9, { star2: [0, 1] }), addDays('2026-10-01', i));
    const ups = r.rankAfter.lv - r.rankBefore.lv;
    eq(r.unlocked.filter((u) => u.by === 'rank').length, ups, `${i} 回目: 格 ${r.rankBefore.lv} → ${r.rankAfter.lv}`);
    for (const u of r.unlocked) if (u.by === 'rank') ok(u.lv > r.rankBefore.lv && u.lv <= r.rankAfter.lv, `${u.id} は格 ${u.lv}`);
    m = r.meta;
  }
});

check('XP の式: 夜・星・願い（★2 の願いは倍）・大一番・完走・段位のおまけ', () => {
  const r = M.xpForRun(run(3, { star2: [0], wish: [1] }));
  const want = M.XP.play + M.XP.nights[0] + M.XP.nights[1] + M.XP.nights[2] + 4 * M.XP.star + M.XP.wish + M.XP.boss;
  eq(r.total, want);
  same(r.parts.map((p) => p.id), ['play', 'nights', 'stars', 'wishes', 'bosses']);
  eq(r.parts.reduce((a, p) => a + p.xp, 0), r.total);
  const s2 = run(3, { star2: [0], wish: [1] }); s2.nights[1].wish.stars = 2;
  eq(M.xpForRun(s2).total, want + M.XP.wish, '★2 の願い');
  const full = M.xpForRun(run(8));
  ok(full.parts.some((p) => p.id === 'clear' && p.xp === M.XP.clear), '完走');
  const l4 = M.xpForRun(run(8, { level: 4 }));
  eq(l4.total, full.total + Math.round(full.total * M.XP.levelBonus * 4), '段位 4 は +50%');
  eq(M.xpForRun(null).total, M.XP.play, '空のまとめでも、遊んだ分');
  eq(M.xpForRun(run(3, { daily: true })).total, M.xpForRun(run(3)).total, '今夜の一筆も同じだけ XP');
  // core の並び（重なりが Lv）のお守りも読める
  const arr = M.applyRun(null, { ...run(2), charms: ['kinun', 'kinun', 'kinun', 'kodou', 'bogus'] }, '2026-10-02');
  same(arr.meta.charms.kinun, [1, 1, 3]); same(arr.meta.charms.kodou, [1, 1, 1]); ok(arr.achievements.includes('lv3'));
});

check('applyRun: もとの meta とまとめを変えない（純関数）・内訳の合計 = 増えた XP', () => {
  const m0 = deepFreeze(M.initMeta({ v: 2, xp: 500, runs: 3, cast: { tengu: [1, 0] }, charms: { kinun: [1, 0, 0] }, sticker: { kinun: 1 }, chb: { c_gen: 2 } }));
  const s = deepFreeze(run(8, { star2: [0, 1], wish: [0, 3], boss3: 'tengu', boss6: 'kitsune', gen: 7, held: { kinun: 2, maneki: 1 } }));
  const snap = JSON.stringify(m0), snapS = JSON.stringify(s);
  const r = M.applyRun(m0, s, '2026-10-02');
  eq(JSON.stringify(m0), snap); eq(JSON.stringify(s), snapS);
  eq(r.meta.xp - m0.xp, r.xp); eq(r.parts.reduce((a, p) => a + p.xp, 0), r.xp);
  eq(r.rankBefore.lv, M.rankOf(500).lv); eq(r.rankAfter.lv, M.rankOf(r.meta.xp).lv);
  same(r.bossesBeaten, ['tengu', 'kitsune']);
  eq(r.meta.runs, 4); eq(r.meta.nights, 8);
  same(M.applyRun(m0, s, '2026-10-02'), r, '同じ入力なら同じ結果');
});

check('初めてだけ: 妖怪・伝説のお守り・実績・解放は 1 度しか出ない', () => {
  const day = '2026-10-02';
  const a = M.applyRun(null, run(3, { boss3: 'tengu' }), day);
  same(a.bossesBeaten, ['tengu']);
  ok(a.unlocked.some((u) => u.kind === 'charm' && u.id === 'tengu'), '天狗の団扇が開く');
  ok(M.charmPool(a.meta).includes('tengu'));
  ok(a.achievements.includes('first_night') && a.achievements.includes('first_boss') && a.achievements.includes('beat_tengu'), a.achievements.join());
  for (const id of a.achievements) ok(a.parts.some((p) => p.id === `ach:${id}`), `${id} の XP`);
  const b = M.applyRun(a.meta, run(3, { boss3: 'tengu' }), day);
  same(b.bossesBeaten, []);
  ok(!b.unlocked.some((u) => u.id === 'tengu'), '2 回目は開かない');
  ok(!b.achievements.includes('first_night') && !b.achievements.includes('beat_tengu'), b.achievements.join());
  ok(!b.parts.some((p) => p.id === 'ach:first_night'), '実績の XP は 1 回だけ');
  eq(b.meta.cast.tengu[1], 2, '勝った回数は数える');
  // 大一番の妖怪は twist からも分かる・負けた夜は「会った」だけ
  const tw = run(5);
  tw.nights[2].boss = null; tw.nights[2].twist = 'kagami';
  tw.nights[5] = { ...tw.nights[5], boss: null, twist: 'isshun', pass: false };
  const c = M.applyRun(null, tw, day);
  same(c.bossesBeaten, ['tanuki']);
  same(M.collection(c.meta).cast.kamaitachi, { met: 1, beaten: 0 });
  ok(!M.charmPool(c.meta).includes('kamaitachi'));
  // 解放は 1 度だけ
  let m = null; const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const r = M.applyRun(m, run(4 + (i % 5), { gen: i % 9, gold: i % 4, ink: { 5: 0.3 }, star3: [6] }), addDays(day, i));
    for (const u of r.unlocked) { const k = `${u.kind}:${u.id}`; ok(!seen.has(k), `${k} が 2 回`); seen.add(k); }
    m = r.meta;
  }
});

check('段位: 段位 n で八夜を通すと n+1 が開く・段位えらびは初めて通したとき・王冠は段位 8', () => {
  let m = M.initMeta(null);
  const bad = M.applyRun(m, run(7), '2026-10-02');
  eq(M.maxLevel(bad.meta), 0, '七夜では開かない');
  ok(!M.features(bad.meta).includes('levels'));
  const r0 = M.applyRun(m, run(8), '2026-10-02');
  eq(M.maxLevel(r0.meta), 1); eq(r0.levelUp, 1);
  ok(r0.unlocked.some((u) => u.id === 'levels'), '段位えらびが開く');
  ok(r0.achievements.includes('full_clear'));
  // まだ開いていない段位のまとめは、開いているいちばん上として数える
  const jump = M.applyRun(r0.meta, run(8, { level: 6 }), '2026-10-02');
  eq(M.maxLevel(jump.meta), 2, '段位 6 と言われても、開いているのは 1 まで');
  eq(jump.parts.find((p) => p.id === 'level').n, 1);
  m = r0.meta;
  for (let lv = 1; lv <= 8; lv++) {
    const r = M.applyRun(m, run(8, { level: lv }), '2026-10-02');
    eq(M.maxLevel(r.meta), Math.min(8, lv + 1), `段位 ${lv} を通した`);
    if (lv === 3) ok(r.achievements.includes('level3'));
    if (lv === 6) ok(r.achievements.includes('level6'));
    if (lv === 8) { ok(r.achievements.includes('level8')); ok(r.unlocked.some((u) => u.id === 'kanmuri')); ok(M.outfits(r.meta).includes('kanmuri')); eq(r.levelUp, null); }
    else ok(!M.outfits(r.meta).includes('kanmuri'));
    m = r.meta;
  }
  eq(M.maxLevel(M.applyRun(m, run(8), '2026-10-02').meta), 8, '低い段位で通しても、下がらない');
});

check('札: 八夜を通すと、八夜目に持っていたお守りに、その段位の札。上がるだけ・XP・実績・図鑑', () => {
  const day = '2026-10-02';
  let r = M.applyRun(null, run(7, { charms: { kinun: 2 } }), day);
  same(r.stickers, []); same(r.meta.sticker, {}, '七夜では札なし');
  r = M.applyRun(null, run(8, { charms: { kinun: 2, maneki: 1, senkou: 1 }, held: { kinun: 2, senkou: 1 } }), day);
  same(r.meta.sticker, { kinun: 0, senkou: 0 }, '八夜目の持ち物だけ（途中で手放した招き猫は無し）');
  same(r.stickers.map((x) => [x.id, x.level, x.prev]), [['kinun', 0, -1], ['senkou', 0, -1]]);
  ok(r.parts.some((p) => p.id === 'stickers' && p.xp === 2 * M.XP.sticker && p.n === 2), '札の XP');
  // 夜の charms が無い（古いページ）なら、祭りの charms
  const old = M.applyRun(null, run(8, { charms: { kinun: 2, maneki: 1 } }), day);
  same(old.meta.sticker, { kinun: 0, maneki: 0 });
  // 高い段位で上がる・低い段位では下がらない・同じ段位では増えない
  let m = rich();
  r = M.applyRun(m, run(8, { level: 5, held: { kinun: 1, tengu: 2 } }), day);
  same(r.meta.sticker, { kinun: 5, tengu: 5 });
  r = M.applyRun(r.meta, run(8, { level: 3, held: { kinun: 3, kodou: 1 } }), day);
  sameObj(r.meta.sticker, { kinun: 5, kodou: 3, tengu: 5 }); same(r.stickers.map((x) => x.id), ['kodou']);
  r = M.applyRun(r.meta, run(8, { level: 5, held: { kinun: 3 } }), day);
  same(r.stickers, [], '同じ段位では何もない');
  r = M.applyRun(r.meta, run(8, { level: 8, held: { kinun: 3 } }), day);
  same(r.stickers.map((x) => [x.id, x.level, x.prev]), [['kinun', 8, 5]]);
  const c = M.collection(r.meta);
  eq(c.charms.kinun.sticker, 8); eq(c.charms.tairin.sticker, null); eq(c.counts.stickers, 3); eq(c.counts.stickersHigh, 2); eq(c.counts.stickersTotal, 24);
  // 実績: 5 枚・段位 4 から上 8 枚・全部
  m = rich();
  const ids = M.CHARM_IDS;
  let got = new Set();
  for (let k = 0; k < 6; k++) {
    const held = Object.fromEntries(ids.slice(k * 4, k * 4 + 4).map((id) => [id, 1]));
    const x = M.applyRun(m, run(8, { level: 4, held }), day); m = x.meta; x.achievements.forEach((a) => got.add(a));
    if (k === 0) ok(!got.has('sticker5'));
    if (k === 1) ok(got.has('sticker5') && got.has('sticker_hi'));
  }
  ok(got.has('sticker_all'), '24 種類');
});

check('腕だめし: どれも条件どおりに達成・進みを残す・測れない値では進まない・格でも開く・XP は 1 回', () => {
  eq(M.CHALLENGES.length, new Set(M.CHALLENGES.map((c) => c.id)).size);
  for (const c of M.CHALLENGES) ok(c.ja && c.en && c.goal != null && c.xp > 0 && c.reward && c.reward.id, c.id);
  const day = '2026-10-02';
  const hits = {
    c_ink: run(7, { ink: { 5: 0.38 } }), c_gen: run(2, { gen: { 1: 7 } }), c_bloom: run(7, { star3: [6] }), c_tori: run(8, { tori: 7 }), c_gold: run(3, { gold: { 2: 3 } }),
  };
  const miss = {
    c_ink: run(7, { ink: { 4: 0.1, 5: 0.41 } }), c_gen: run(2, { gen: { 2: 9 } }), c_bloom: run(7, { star3: [4] }), c_tori: run(7, { tori: 9 }), c_gold: run(3, { gold: { 1: 2, 3: 5 } }),
  };
  for (const [id, s] of Object.entries(hits)) {
    const c = M.CHALLENGES.find((x) => x.id === id);
    const r = M.applyRun(null, s, day);
    ok(r.challenges.some((x) => x.id === id), `${id} が達成にならない`);
    ok(r.parts.some((p) => p.id === `ch:${id}` && p.xp === c.xp), `${id} の XP`);
    ok(r.unlocked.some((u) => u.kind === 'charm' && u.id === c.reward.id && u.by === 'challenge'), `${id} で ${c.reward.id} が開く`);
    ok(M.charmPool(r.meta).includes(c.reward.id));
    const again = M.applyRun(r.meta, s, day);
    ok(!again.challenges.length && !again.parts.some((p) => p.id.startsWith('ch:')), `${id} の XP は 1 回だけ`);
    const r2 = M.applyRun(null, miss[id], day);
    ok(!r2.challenges.some((x) => x.id === id), `${id} は届いていないのに達成`);
    ok(!M.charmPool(r2.meta).includes(c.reward.id), `${id}: ${c.reward.id} が開いた`);
  }
  // 進み: いちばん良い値だけ残る（下がらない）
  let m = M.applyRun(null, run(3, { gen: 5 }), day).meta;
  eq(m.chb.c_gen, 5);
  m = M.applyRun(m, run(3, { gen: 2 }), day).meta;
  eq(m.chb.c_gen, 5, '下がらない');
  const list = M.challenges(m), g = list.find((x) => x.id === 'c_gen');
  same([g.best, g.goal, g.done, g.reward.id, g.reward.have], [5, M.CHALLENGES.find((x) => x.id === 'c_gen').goal, false, 'renjishi', false]);
  eq(list.find((x) => x.id === 'c_ink').best, null, '六夜目まで行っていない');
  eq(M.challenges(M.applyRun(m, run(7, { ink: { 5: 0.9, 6: 0.55 } }), day).meta).find((x) => x.id === 'c_ink').best, 45, '墨は残した割合（%）');
  // inkFrac の無いページでは、墨の腕だめしは進まない（落ちない）
  const noInk = M.applyRun(null, run(8, { noInk: true }), day);
  ok(!('c_ink' in noInk.meta.chb) && !noInk.challenges.some((x) => x.id === 'c_ink'));
  // 格でも開く（腕だめしをしない人も）
  for (const c of M.CHALLENGES.filter((x) => x.reward.kind === 'charm')) {
    const below = M.initMeta({ v: 2, xp: M.RANKS[c.lv - 2].xp }), at = M.initMeta({ v: 2, xp: M.RANKS[c.lv - 1].xp });
    ok(!M.charmPool(below).includes(c.reward.id) && M.charmPool(at).includes(c.reward.id), `${c.reward.id} は格 ${c.lv} で`);
  }
  // 格で先に開いたあとでも、腕だめしは達成できる（XP と実績のため）。解放はもう出ない
  const hi = M.initMeta({ v: 2, xp: M.RANKS[29].xp });
  const late = M.applyRun(hi, hits.c_gen, day);
  ok(late.challenges.some((x) => x.id === 'c_gen') && !late.unlocked.some((u) => u.id === 'renjishi'));
  // 3 つで実績
  m = null; const got = new Set();
  for (const s of Object.values(hits)) { const x = M.applyRun(m, s, day); m = x.meta; x.achievements.forEach((a) => got.add(a)); }
  ok(got.has('ude3'));
});

check('伝説の道: 妖怪に勝つと Lv2 まで、段位 4 から上で勝つと Lv3 まで（legendLv・charmCaps）', () => {
  const day = '2026-10-02';
  eq(M.legendLv(null, 'tengu'), 0); eq(M.legendLv(null, 'kinun'), 3); eq(M.legendLv(null, 'suminagashi'), 0); eq(M.legendLv(null, 'nope'), 0);
  let r = M.applyRun(rich({ cast: {} }), run(3, { boss3: 'tengu', level: 3 }), day);
  eq(M.legendLv(r.meta, 'tengu'), 2, '段位 3 で勝った');
  same(M.charmCaps(r.meta), { tengu: 2 });
  ok(!r.unlocked.some((u) => u.kind === 'legend'));
  eq(M.challenges(r.meta).find((c) => c.id === 'c_tengu').best, 3);
  r = M.applyRun(r.meta, run(3, { boss3: 'tengu', level: 4 }), day);
  ok(r.unlocked.some((u) => u.kind === 'legend' && u.id === 'tengu'), '伝説の道が開く');
  ok(r.challenges.some((c) => c.id === 'c_tengu'));
  eq(M.legendLv(r.meta, 'tengu'), 3); same(M.charmCaps(r.meta), {});
  // 負けた大一番では進まない
  const lost = run(5, { boss3: 'kitsune', level: 6 }); lost.nights[2].pass = false; lost.cleared = 2; lost.nights.length = 3;
  r = M.applyRun(rich({ cast: {} }), lost, day);
  eq(M.legendLv(r.meta, 'kitsune'), 0); ok(!('c_kitsune' in r.meta.chb));
  const col = M.collection(rich());
  eq(col.charms.tengu.cap, 2); eq(col.charms.kinun.cap, 3);
});

check('実績: 約 35・文言・XP・条件（星 24・願い 8・八夜目の満開・予備なし・大トリ・四十連発・型・Lv3 二つ・願い札あつめ）', () => {
  ok(M.ACHIEVEMENTS.length >= 30 && M.ACHIEVEMENTS.length <= 40, `${M.ACHIEVEMENTS.length} 個`);
  eq(new Set(M.ACHIEVEMENTS.map((a) => a.id)).size, M.ACHIEVEMENTS.length);
  for (const a of M.ACHIEVEMENTS) ok(a.ja && a.en && a.desc && a.descEn && a.xp > 0, a.id);
  ok(M.ACHIEVEMENTS.some((a) => a.hidden), '隠し実績');
  for (const id of ['first_night', 'first_wish', 'daily1', 'star3', 'first_boss', 'half', 'tori8', 'lv3', 'regular', 'full_clear', 'streak5', 'pops40', 'all_yokai', 'level3', 'no_retry', 'zukan', 'wish_all', 'bloom8', 'level6', 'stars24', 'wishes8', 'level8']) ok(M.ACHIEVEMENTS.some((a) => a.id === id), `12版の実績 ${id} が無い`);
  for (const b of M.BOSSES) ok(M.ACHIEVEMENTS.some((a) => a.id === `beat_${b}`), b);
  const day = '2026-10-02';
  const perfect = run(8, { star2: true, star3: true, wish: true, tori: 9, pops: 41, retries: 0 });
  const r = M.applyRun(null, perfect, day);
  for (const id of ['stars24', 'wishes8', 'bloom8', 'no_retry', 'tori8', 'pops40', 'star3', 'full_clear', 'first_wish']) ok(r.achievements.includes(id), `${id} がとれない`);
  ok(!r.achievements.includes('all_yokai'), '妖怪はまだ 2 匹');
  // retries が無いまとめでは「予備いらず」はとれない
  const noInfo = run(8); delete noInfo.retries;
  ok(!M.applyRun(null, noInfo, day).achievements.includes('no_retry'));
  ok(!M.applyRun(null, run(8, { retries: 1 }), day).achievements.includes('no_retry'));
  // 型の花火師・Lv3 二つ
  ok(M.applyRun(null, run(8, { held: { kinun: 1, ichibanboshi: 1, maneki: 2 } }), day).achievements.includes('onetag'), '金 3 つ');
  ok(!M.applyRun(null, run(8, { held: { kinun: 1, maneki: 2, tairin: 3 } }), day).achievements.includes('onetag'));
  ok(M.applyRun(null, run(5, { charms: { kinun: 3, kodou: 3 } }), day).achievements.includes('deep2'));
  // 4 匹の妖怪
  let m = null;
  for (const [b3, b6] of [['tengu', 'tanuki'], ['kitsune', 'kamaitachi']]) m = M.applyRun(m, run(6, { boss3: b3, boss6: b6 }), day).meta;
  ok(m.ach.includes('all_yokai'));
  // 常連（10 回）
  m = null;
  for (let i = 0; i < 10; i++) { const x = M.applyRun(m, run(0), day); if (i < 9) ok(!x.achievements.includes('regular')); else ok(x.achievements.includes('regular')); m = x.meta; }
  // 願い札あつめ（いま出る願いの全部。12版の w_tori8 は w_tori6 の代わりになる）
  const act = M.WISH_ACTIVE;
  m = null;
  for (let k = 0; k * 8 < act.length; k++) {
    const s = run(8, { wish: true });
    s.nights.forEach((n, i) => { const id = act[(k * 8 + i) % act.length]; n.wish.id = id === 'w_tori6' ? 'w_tori8' : id; });
    const x = M.applyRun(m, s, day); m = x.meta;
    eq(x.achievements.includes('wish_all'), (k + 1) * 8 >= act.length, `願い ${k}`);
  }
});

check('今日のおつかい: 日付で決まる 3 つ・同じ日に似たものを並べない・ただ遊ぶだけのものは無い・その日の祭りで足されていく', () => {
  const qs = M.dailyQuests('2026-10-02');
  eq(qs.length, 3); same(qs.map((q) => q.tier), [0, 1, 2]);
  same(M.dailyQuests('2026-10-02'), qs, '同じ日は同じ');
  for (const q of qs) ok(q.ja && q.en && q.goal > 0 && q.xp > 0 && M.QUESTS.some((x) => x.id === q.id), q.id);
  ok(M.QUESTS.length >= 14, `ひな形 ${M.QUESTS.length}`);
  for (const id of ['q_play2', 'q_daily', 'q_nights6', 'q_stars6', 'q_pops', 'q_lv2']) ok(!M.QUESTS.some((q) => q.id === id), `${id}（ただ遊ぶだけ）が残っている`);
  for (const id of ['q_lv3x2', 'q_goldboss', 'q_wish3', 'q_tori6']) ok(M.QUESTS.some((q) => q.id === id), `${id} が無い`);
  const sets = new Set(), used = new Set();
  for (let i = 0; i < 90; i++) {
    const d = addDays('2026-10-01', i), x = M.dailyQuests(d);
    eq(new Set(x.map((q) => q.id)).size, 3, `${d}: 重なり`);
    eq(new Set(x.map((q) => M.QUESTS.find((t) => t.id === q.id).group)).size, 3, `${d}: 似たものが並ぶ`);
    sets.add(x.map((q) => q.id).join()); x.forEach((q) => used.add(q.id));
  }
  ok(sets.size >= 40, `90 日で ${sets.size} 通り`);
  eq(used.size, M.QUESTS.length, '使われないひな形がある');
  eq(M.dailyQuests('garbage').length, 3);
  const dayOf = (id) => findDay((d) => { const k = M.dailyQuests(d).findIndex((q) => q.id === id); return k >= 0 ? k : null; });

  // 「★★ を 3 回」（合計）: 2 回 → 3 回で達成、もう XP なし
  let [d, k] = dayOf('q_star2x3');
  let r = M.applyRun(null, run(4, { star2: [0, 1] }), d);
  same([r.quests[k].p, r.quests[k].done, r.quests[k].justDone], [2, false, false]);
  r = M.applyRun(r.meta, run(2, { star2: [0] }), d);
  same([r.quests[k].p, r.quests[k].done, r.quests[k].justDone], [3, true, true]);
  const qp = r.parts.find((p) => p.id === 'quest:q_star2x3');
  ok(qp && qp.xp === M.dailyQuests(d)[k].xp, 'おつかいの XP');
  eq(r.meta.qn, 1, '果たした数');
  r = M.applyRun(r.meta, run(2, { star2: [0] }), d);
  same([r.quests[k].done, r.quests[k].justDone], [true, false]);
  ok(!r.parts.some((p) => p.id === 'quest:q_star2x3'), '2 回目の XP はない');
  // 次の日は 0 から
  r = M.applyRun(r.meta, run(1), addDays(d, 1));
  eq(r.meta.quest.d, addDays(d, 1));
  ok(r.quests.every((q) => !q.justDone || q.p >= q.goal));
  // 「一回の祭りで願いを 3 つ」（いちばん）: 2 → 1 → 3
  [d, k] = dayOf('q_wish3');
  r = M.applyRun(null, run(3, { wish: [0, 1] }), d); eq(r.quests[k].p, 2);
  r = M.applyRun(r.meta, run(3, { wish: [2] }), d); eq(r.quests[k].p, 2, '合計しない');
  r = M.applyRun(r.meta, run(3, { wish: [0, 1, 2] }), d); ok(r.quests[k].justDone);
  // 「Lv3 を 2 つ持って終える」: 祭りの終わりの持ち物で見る
  [d, k] = dayOf('q_lv3x2');
  r = M.applyRun(null, run(4, { charms: { kinun: 3, kodou: 2 } }), d); eq(r.quests[k].p, 0);
  r = M.applyRun(r.meta, run(4, { charms: { kinun: 3, kodou: 3 } }), d); ok(r.quests[k].justDone);
  // 「金のお守り 2 つで大一番」: 夜の持ち物で見る
  [d, k] = dayOf('q_goldboss');
  r = M.applyRun(null, run(3, { held: { kinun: 1, kodou: 1 } }), d); eq(r.quests[k].p, 0);
  r = M.applyRun(r.meta, run(3, { held: { kinun: 1, maneki: 2 } }), d); ok(r.quests[k].justDone, '金運 + 招き猫');
  // 墨のおつかい: inkFrac が無いページでは進まない
  [d, k] = dayOf('q_ink50');
  r = M.applyRun(null, run(8, { noInk: true }), d); eq(r.quests[k].p, 0);
  r = M.applyRun(r.meta, run(8, { ink: { 5: 0.5 } }), d); ok(r.quests[k].justDone);
  // todayQuests は進みつき
  same(M.todayQuests(r.meta, d).map((q) => q.p), r.quests.map((q) => q.p));
  same(M.todayQuests(r.meta, addDays(d, 1)).map((q) => q.p), [0, 0, 0]);
  // 日付が無い・壊れているときは、おつかいも続けた日数も動かさない（XP は入る）
  const n = M.applyRun(null, run(3), 'nope');
  same(n.quests, []); eq(n.meta.streak.n, 0); ok(n.xp > 0); eq(n.weekly, null);
});

check('おつかいの取りかえ: 開いてから、1 日 1 回、果たしていないものだけ。同じむずかしさの別のものになる', () => {
  const d = '2026-10-02';
  const locked = M.swapQuest(null, d, 1);
  ok(!locked.ok, 'まだ開いていない');
  const m0 = M.initMeta({ v: 2, xp: M.RANKS[29].xp });
  ok(M.features(m0).includes('questSwap'));
  for (let i = 0; i < 40; i++) {
    const day = addDays(d, i), slot = i % 3, before = M.dailyQuests(day);
    const s = M.swapQuest(m0, day, slot);
    ok(s.ok, `${day} ${slot}`);
    const after = M.dailyQuests(day, slot);
    same(s.quests.map((q) => q.id), after.map((q) => q.id));
    ok(after[slot].id !== before[slot].id && after[slot].tier === before[slot].tier, '同じむずかしさの別のもの');
    eq(new Set(after.map((q) => M.QUESTS.find((t) => t.id === q.id).group)).size, 3, '似たものが並ばない');
    same(after.filter((_, j) => j !== slot).map((q) => q.id), before.filter((_, j) => j !== slot).map((q) => q.id), 'ほかは変わらない');
    ok(!M.swapQuest(s.meta, day, (slot + 1) % 3).ok, '1 日 1 回');
    same(M.initMeta(JSON.parse(JSON.stringify(s.meta))).quest, s.meta.quest, '保存して読んでも同じ');
    const r = M.applyRun(s.meta, run(2), day);
    same(r.quests.map((q) => q.id), after.map((q) => q.id), '祭りのあとも、取りかえた一覧');
  }
  for (const bad of [-1, 3, 1.5, 'x', null]) ok(!M.swapQuest(m0, d, bad).ok || bad === 1.5, String(bad));
  ok(!M.swapQuest(m0, 'nope', 0).ok);
  // 果たしたものは取りかえない
  const [day, k] = findDay((x) => { const j = M.dailyQuests(x).findIndex((q) => q.id === 'q_star2x3'); return j >= 0 ? j : null; });
  const done = M.applyRun(m0, run(4, { star2: [0, 1, 2] }), day).meta;
  ok(!M.swapQuest(done, day, k).ok, '果たしたもの');
});

check('週のおつかい: 開いてから・月曜はじまり・その週の祭りで足されて・次の週は新しく・XP は 1 回', () => {
  eq(M.weekOf('2026-10-05'), '2026-10-05', '月曜'); eq(M.weekOf('2026-10-11'), '2026-10-05', '日曜'); eq(M.weekOf('2026-10-12'), '2026-10-12');
  eq(M.weekOf('2026-12-31'), '2026-12-28'); eq(M.weekOf('nope'), null);
  eq(M.weeklyQuest(null, '2026-10-05'), null, 'まだ開いていない');
  ok(M.WEEKLY.length >= 4);
  const m0 = M.initMeta({ v: 2, xp: M.RANKS[29].xp });
  const [mon, w] = findDay((d) => (M.weekOf(d) === d && M.weeklyQuest(m0, d).id === 'wk_star40' ? M.weeklyQuest(m0, d) : null), '2026-10-05');
  eq(w.p, 0); eq(w.goal, 40);
  let m = m0, r;
  for (let i = 0; i < 7; i++) {
    r = M.applyRun(m, run(7, { star2: true }), addDays(mon, i)); m = r.meta;
    eq(r.weekly.id, 'wk_star40'); eq(r.weekly.p, Math.min(40, 14 * (i + 1)));
    eq(r.weekly.justDone, i === 2, `${i} 日目`);
    eq(r.parts.some((p) => p.id === 'weekly:wk_star40'), i === 2);
    if (i === 2) ok(r.achievements.includes('weekly1'));
  }
  eq(m.wn, 1);
  r = M.applyRun(m, run(1), addDays(mon, 7));
  eq(r.weekly.week, addDays(mon, 7)); ok(r.weekly.p <= 2, '次の週は 0 から');
  eq(M.weeklyQuest(r.meta, addDays(mon, 8)).p, r.weekly.p);
  eq(M.weeklyQuest(r.meta, addDays(mon, 14)).p, 0);
});

check('続けた日数: 毎日 +1・同じ日は 1 回・1 日あくと 1 から（休みの札があれば 7 日に 1 度だけ続く）・おまけは 7 日で頭打ち・5 日で実績', () => {
  const d0 = '2026-10-02';
  let r = M.applyRun(null, run(2), d0);
  eq(r.meta.streak.n, 1); eq(r.streak.xp, M.XP.streakStep); ok(r.parts.some((p) => p.id === 'streak'));
  r = M.applyRun(r.meta, run(2), d0);
  eq(r.meta.streak.n, 1); eq(r.streak.xp, 0, '同じ日の 2 回目はおまけなし'); ok(!r.parts.some((p) => p.id === 'streak'));
  for (let i = 1; i <= 9; i++) {
    r = M.applyRun(r.meta, run(2), addDays(d0, i));
    eq(r.meta.streak.n, i + 1);
    eq(r.streak.xp, M.XP.streakStep * Math.min(i + 1, M.XP.streakCap));
    eq(r.achievements.includes('streak5'), i + 1 === 5, `${i + 1} 日目`);
  }
  eq(r.meta.streak.best, 10);
  // 月またぎ・年またぎも続く
  let y = M.applyRun(null, run(1), '2026-12-31'); y = M.applyRun(y.meta, run(1), '2027-01-01'); eq(y.meta.streak.n, 2);
  let f = M.applyRun(null, run(1), '2028-02-28'); f = M.applyRun(f.meta, run(1), '2028-02-29'); eq(f.meta.streak.n, 2, 'うるう日');
  // 1 日あくと 1 から（いちばん長い記録は残る）
  const last = addDays(d0, 9);
  r = M.applyRun(r.meta, run(2), addDays(last, 2));
  eq(r.meta.streak.n, 1); eq(r.meta.streak.best, 10); eq(r.streak.xp, M.XP.streakStep); eq(r.streak.guarded, false);
  // 時計が戻っても、減らさず・おまけもなし
  const back = M.applyRun(r.meta, run(2), addDays(last, -3));
  eq(back.meta.streak.n, 1); eq(back.meta.streak.last, addDays(last, 2)); eq(back.streak.xp, 0);
  // 休みの札
  let g = M.applyRun(M.initMeta({ v: 2, xp: M.RANKS[29].xp }), run(1), d0);
  g = M.applyRun(g.meta, run(1), addDays(d0, 1)); eq(g.meta.streak.n, 2);
  g = M.applyRun(g.meta, run(1), addDays(d0, 3)); eq(g.meta.streak.n, 3, '1 日あいても続く'); ok(g.streak.guarded); eq(g.meta.streak.g, addDays(d0, 3));
  g = M.applyRun(g.meta, run(1), addDays(d0, 5)); eq(g.meta.streak.n, 1, '7 日のうちに 2 度目は無い'); ok(!g.streak.guarded);
  g = M.applyRun(g.meta, run(1), addDays(d0, 6)); g = M.applyRun(g.meta, run(1), addDays(d0, 7));
  g = M.applyRun(g.meta, run(1), addDays(d0, 10)); eq(g.meta.streak.n, 1, '2 日あくと切れる');
  g = M.applyRun(g.meta, run(1), addDays(d0, 12)); eq(g.meta.streak.n, 2, '7 日たてばまた使える'); ok(g.streak.guarded);
});

check('図鑑: 見たお守り・玉・妖怪を書く。知らない ID は捨てる。24 個見たら実績。札・色・腕だめしの数', () => {
  let m = M.noteSeen(null, { charms: ['kinun', 'kinun', 'nope', '__proto__'], shells: ['kin', 'kuro', 'shaku'], cast: ['neko', 'oni'] });
  const c = M.collection(m);
  same(c.charms.kinun, { seen: 2, used: 0, maxLv: 0, sticker: null, open: true, cap: 3 });
  same(c.charms.tengu, { seen: 0, used: 0, maxLv: 0, sticker: null, open: false, cap: 0 });
  eq(Object.keys(c.charms).length, 24); eq(c.counts.charms, 1); eq(c.counts.charmsTotal, 24);
  same(c.cast.neko, { met: 1, beaten: 0 }); eq(c.counts.cast, 1); eq(c.counts.castTotal, 5);
  eq(c.shells.kin, true); eq(c.shells.kiku, false); eq(c.counts.shells, 2);
  eq(Object.keys(c.achievements).length, M.ACHIEVEMENTS.length);
  same(Object.keys(c.wishes), M.WISH_ACTIVE); eq(c.counts.wishesTotal, M.WISH_ACTIVE.length);
  eq(c.counts.challengesTotal, M.CHALLENGES.length); eq(c.counts.colorsTotal, 8); eq(c.counts.colors, 0);
  same(M.noteSeen(m, null), m, '空の知らせでは変わらない');
  same(M.noteSeen(m, 'x'), m);
  // 使ったお守りと Lv
  m = M.applyRun(m, run(3, { charms: { kinun: 2, maneki: 1 } }), '2026-10-02').meta;
  eq(M.collection(m).charms.kinun.maxLv, 2); eq(M.collection(m).charms.kinun.used, 1);
  same(M.collection(m).charms.maneki, { seen: 1, used: 1, maxLv: 1, sticker: null, open: true, cap: 3 });
  // 全部見て、次の祭りで実績
  m = M.noteSeen(m, { charms: M.CHARM_IDS });
  eq(M.collection(m).counts.charms, 24);
  const r = M.applyRun(m, run(1), '2026-10-02');
  ok(r.achievements.includes('zukan'));
  eq(M.collection(r.meta).achievements.zukan, true);
});

check('次の目当て: 近いものから・どれも文言と進みつき・壊れた値でも落ちない', () => {
  const fresh = M.nextGoals(null, '2026-10-05', 3);
  eq(fresh.length, 3); eq(fresh[0].kind, 'rank'); eq(fresh[0].id, 'daily');
  ok(fresh.some((g) => g.kind === 'quest'), '今日のおつかい');
  const m = M.initMeta({ v: 2, xp: 4000, top: 2, chb: { c_gen: 6, c_ink: 30 }, sticker: { kinun: 1, kodou: 2 } });
  const g = M.nextGoals(m, '2026-10-05', 10);
  for (const x of g) ok(x.ja && x.en && x.frac >= 0 && x.frac <= 1 && x.goal > 0, x.kind);
  for (let i = 1; i < g.length; i++) ok(g[i].frac <= g[i - 1].frac, '近い順');
  eq(g[0].kind, 'challenge'); eq(g[0].id, 'c_gen');
  ok(g.some((x) => x.kind === 'level') && g.some((x) => x.kind === 'sticker'));
  eq(M.nextGoals(m, 'nope', 10).filter((x) => x.kind === 'quest' || x.kind === 'weekly').length, 0);
  eq(M.nextGoals(m, '2026-10-05', 0).length, 0);
  ok(M.nextGoals(rich({ ch: M.CHALLENGES.map((c) => c.id), sticker: Object.fromEntries(M.CHARM_IDS.map((id) => [id, 8])) }), '2026-10-05', 9).every((x) => x.kind === 'quest' || x.kind === 'weekly' || (x.kind === 'rank' && x.id === 'over')), '全部すんだら、おつかいと名人の星だけ');
});

check('古いページのまとめ（夜の inkFrac・charms・wish.stars が無い）でも、落ちずに数える', () => {
  const s = run(8, { noInk: true, charms: { kinun: 2, maneki: 3 } });
  for (const n of s.nights) { delete n.maxGen; delete n.goldTouched; delete n.lineTouched; }
  const r = M.applyRun(null, s, '2026-10-02');
  ok(r.xp > 0); same(r.meta.sticker, { kinun: 0, maneki: 0 });
  ok(!r.challenges.length || r.challenges.every((c) => c.id !== 'c_ink'));
});

check('meta は小さい（よく遊んだあとでも 3KB まで）', () => {
  let m = M.noteSeen(null, { charms: M.CHARM_IDS, shells: M.SHELL_TYPES, cast: M.CAST_IDS });
  for (let i = 0; i < 300; i++) {
    const s = run(8, { star2: true, star3: true, wish: true, tori: 9, pops: 41, retries: 0, daily: true, level: 8, boss3: M.BOSSES[i % 4], boss6: M.BOSSES[(i + 1) % 4],
      charms: { [M.CHARM_IDS[i % 24]]: 3, kinun: 3, ...(i === 7 ? { ichibanboshi: 1, maneki: 1 } : {}) }, gen: 9, gold: 4, ink: { 5: 0.2 } });
    s.nights.forEach((n, j) => { n.wish.id = M.WISH_ACTIVE[(i + j) % M.WISH_ACTIVE.length]; });
    m = M.applyRun(m, s, addDays('2026-10-01', i)).meta;
  }
  const size = JSON.stringify(m).length;
  ok(size < 3072, `${size} 文字`);
  eq(m.ach.length, M.ACHIEVEMENTS.length, `全部とれる（無いのは ${M.ACHIEVEMENTS.filter((a) => !m.ach.includes(a.id)).map((a) => a.id)}）`);
  eq(m.ch.length, M.CHALLENGES.length, '腕だめしも全部');
  eq(M.rankOf(m.xp).lv, 30);
});

check('はじめの祭り: 三〜四夜なら格が 1〜3 つ上がる・次のよい祭りで 1〜3 つ', () => {
  for (let i = 0; i < 30; i++) {
    const d = addDays('2026-10-01', i);
    for (const n of [3, 4]) {
      const first = M.applyRun(null, run(n, { star2: [0], wish: [1], charms: { kinun: 1, kodou: 1, tairin: 1 } }), d);
      const ups = first.rankAfter.lv - first.rankBefore.lv;
      ok(ups >= 1 && ups <= 3, `${d}: ${n} 夜で格が ${ups} 上がる (${first.xp} XP)`);
      ok(first.unlocked.length >= 1, '何か開く');
    }
    const first = M.applyRun(null, run(3, { star2: [0], wish: [1] }), d);
    const good = M.applyRun(first.meta, run(6, { star2: [0, 1, 3], wish: [0, 2, 4], boss3: 'tengu', boss6: 'kitsune' }), addDays(d, 1));
    const ups = good.rankAfter.lv - good.rankBefore.lv;
    ok(ups >= 1 && ups <= 3, `${d}: 六夜のよい祭りで格が ${ups} 上がる (${good.xp} XP)`);
  }
});

// ふつうに遊ぶ人: 腕は回を重ねて上がり、八夜を通したら段位を 1 つ上げる。1 日 2〜3 回、ときどき 1 日あく
function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TWISTS = Object.keys(M.TWIST_BOSS);
function typicalRun(rnd, k, level, pool, daily) {
  const skill = Math.min(0.92, 0.70 + 0.012 * k) - 0.04 * level;
  const nights = [], charms = {};
  let cleared = 0, lives = level >= 3 ? 0 : 1, retries = 0;
  for (let i = 0; i < 8; i++) {
    const boss = i === 2 || i === 5;
    const p = Math.max(0.05, Math.min(0.98, skill + (i < 2 ? 0.15 : 0) - (boss ? 0.04 : 0) - 0.012 * i));
    let pass = rnd() < p;
    if (!pass && lives > 0) { lives--; retries++; pass = rnd() < p; }
    const allClear = pass && rnd() < 0.06;
    nights.push({ night: i, pass, stars: [pass, pass && rnd() < 0.3, allClear], allClear, pops: Math.round((16 + 4 * i) * (0.5 + 0.4 * rnd())), total: 16 + 4 * i,
      score: pass ? 120 : 80, target: 100, twist: boss ? TWISTS[Math.floor(rnd() * 4)] : null, boss: null,
      wish: { id: M.WISH_ACTIVE[Math.floor(rnd() * M.WISH_ACTIVE.length)], met: pass && rnd() < 0.3 }, toriAdd: i === 7 && pass ? Math.floor(rnd() * 9) : 0,
      maxGen: Math.floor(rnd() * 7), goldTouched: Math.floor(rnd() * 2.6), lineTouched: 2 + Math.floor(rnd() * 10), inkFrac: 0.3 + 0.7 * rnd(), charms: { ...charms } });
    if (!pass) break;
    cleared++;
    const id = pool[Math.floor(rnd() * pool.length)]; charms[id] = Math.min(3, (charms[id] || 0) + 1);
  }
  return { mode: 'run', daily, level, cleared, total: cleared * 1000, bestPops: 0, nights, charms, retries };
}
function simulate(seed, runs) {
  const rnd = rng32(seed * 7919);
  let meta = M.initMeta(null), day = 0, today = 0;
  const ranks = [0], xps = [0], unl = [0];
  for (let k = 1; k <= runs; k++) {
    if (today >= 2 + (seed % 2)) { day += rnd() < 0.15 ? 2 : 1; today = 0; }
    const daily = today === 0 && M.features(meta).includes('daily');
    today++;
    const level = daily ? 0 : M.maxLevel(meta);
    const s = typicalRun(rnd, k, level, M.charmPool(meta), daily);
    const r = M.applyRun(meta, s, addDays('2026-10-01', day));
    meta = r.meta;
    ranks.push(M.rankOf(meta.xp).lv); xps.push(meta.xp); unl.push(r.unlocked.length);
  }
  return { ranks, xps, unl, meta };
}

check('ふつうに遊ぶ人の 50 回: 格の伸び（1・5・10・20・40 回目）・いちばん上まで 45〜65 回・解放が長く途切れない', () => {
  const seeds = Array.from({ length: 24 }, (_, i) => i + 1), sims = seeds.map((s) => simulate(s, 90));
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const at = (k) => med(sims.map((x) => x.ranks[k]));
  const marks = [1, 5, 10, 20, 40, 50];
  console.log('  ふつうに遊ぶ人（24 人の中央値）: ' + marks.map((k) => `${k} 回目 格 ${at(k)}`).join(' / '));
  const toMax = sims.map((x) => x.ranks.indexOf(30)).map((i) => (i < 0 ? 999 : i));
  const toCharms = sims.map((x) => x.ranks.findIndex((r) => r >= 12));
  const dead = sims.map((x) => x.unl.slice(1, 51).filter((n) => !n).length);
  const gap = sims.map((x) => { let g = 0, b = 0; for (const n of x.unl.slice(1, 51)) { if (n) g = 0; else b = Math.max(b, ++g); } return b; });
  console.log(`  格 30 まで: 中央値 ${med(toMax)} 回（${Math.min(...toMax)}〜${Math.max(...toMax)}）・格で開くお守りが出そろう格 12 まで: 中央値 ${med(toCharms)} 回・50 回のうち何も開かない回 ${med(dead)}・いちばん長く開かない ${med(gap)} 回`);
  ok(at(1) >= 2 && at(1) <= 4, `1 回目 ${at(1)}`);
  ok(at(5) >= 5 && at(5) <= 10, `5 回目 ${at(5)}`);
  ok(at(10) >= 8 && at(10) <= 14, `10 回目 ${at(10)}`);
  ok(at(20) >= 13 && at(20) <= 20, `20 回目 ${at(20)}`);
  ok(at(40) >= 21 && at(40) <= 28, `40 回目 ${at(40)}`);
  ok(med(toMax) >= 45 && med(toMax) <= 65, `格 30 まで ${med(toMax)} 回`);
  ok(med(toCharms) >= 6 && med(toCharms) <= 16, `格 12 まで ${med(toCharms)} 回`);
  ok(med(gap) <= 6, `解放が ${med(gap)} 回つづけて無い`);
  // 格は下がらない・XP は増えるだけ
  for (const x of sims) for (let k = 1; k < x.ranks.length; k++) ok(x.ranks[k] >= x.ranks[k - 1] && x.xps[k] > x.xps[k - 1], '下がった');
});

if (failures) { console.error(`hitofude_meta_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_meta_test: ALL PASS');
