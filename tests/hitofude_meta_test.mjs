// 一筆花火の「祭りの外側」（格・解放・実績・今日のおつかい・続けた日数・図鑑）のテスト。DOM も storage も使わない。
// 実行: node tests/hitofude_meta_test.mjs
import * as M from '../assets/hitofude/meta.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'not ok'); }
const same = (a, b, msg) => eq(JSON.stringify(a), JSON.stringify(b), msg);
function deepFreeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; }
const addDays = (key, n) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);

// 夜のまとめを作る（pass の夜は ★ 1 つ。opts で足す）
function night(i, pass, o = {}) {
  const boss = i === 2 ? (o.boss3 || 'tengu') : i === 5 ? (o.boss6 || 'tanuki') : null;
  return {
    night: i + 1, score: pass ? 200 : 50, target: 100, pass, stars: [pass, !!o.star2, !!o.star3], allClear: !!o.star3,
    pops: o.pops ?? 10 + 3 * i, total: 20 + 4 * i, twist: null, boss, wish: { id: M.WISH_IDS[i], met: pass && !!o.wish }, toriAdd: o.tori || 0, maxGen: 3,
  };
}
// cleared 夜を越えて、次の夜で散った祭り
function run(cleared, o = {}) {
  const nights = [];
  for (let i = 0; i < Math.min(8, cleared + 1); i++) {
    const pass = i < cleared, pick = (k) => (Array.isArray(o[k]) ? o[k].includes(i) : !!o[k]);
    nights.push(night(i, pass, { star2: pick('star2'), star3: pick('star3'), wish: pick('wish'), tori: i >= 6 ? o.tori || 0 : 0, boss3: o.boss3, boss6: o.boss6, pops: o.pops }));
  }
  return { mode: 'run', daily: !!o.daily, level: o.level || 0, cleared, total: cleared * 1000, bestPops: 20, nights, charms: o.charms || { kinun: 1, kodou: 1 }, retries: o.retries ?? 1, outfit: null };
}

check('共通の ID: お守り 24・はじめの 9・伝説 4・大一番と妖怪の対応・衣装・願い', () => {
  eq(M.CHARM_IDS.length, 24); eq(new Set(M.CHARM_IDS).size, 24);
  eq(M.STARTER_CHARMS.length, 9);
  for (const id of M.STARTER_CHARMS) ok(M.CHARM_IDS.includes(id), id);
  same(M.LEGEND_CHARMS, ['tengu', 'tanuki', 'kitsune', 'kamaitachi']);
  same(M.TWIST_BOSS, { massugu: 'tengu', kagami: 'tanuki', yamiyo: 'kitsune', isshun: 'kamaitachi' });
  same(M.OUTFIT_IDS.slice().sort(), ['hachimaki', 'kanmuri', 'kanzashi', 'kingyo', 'omen', 'uchiwa']);
  eq(M.WISH_IDS.length, 14);
  same(M.CAST_IDS, ['tengu', 'tanuki', 'kitsune', 'kamaitachi', 'neko']);
});

check('initMeta: どんな壊れた値でも、きれいな meta を返す（型・範囲・知らない ID・__proto__）', () => {
  const fresh = M.initMeta(undefined);
  const keys = Object.keys(fresh).sort().join();
  const evil = JSON.parse('{"v":1,"xp":120,"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}},'
    + '"cast":{"__proto__":[5,5],"tengu":[1,1],"nope":[3,3]},"charms":{"constructor":[1,1,1],"kinun":[2,1,9],"toString":[1]},'
    + '"wish":{"__proto__":3,"w_bloom":2,"w_fake":1},"ach":["__proto__","first_night","first_night","nope"],"shells":["kin","kuro","kin",7]}');
  const garbage = [
    null, undefined, 0, -1, NaN, 'meta', '', [], [1, 2, 3], true, () => 1, Symbol('x'), new Date(), {},
    { xp: NaN }, { xp: -50 }, { xp: Infinity }, { xp: 1e308 }, { xp: '999' }, { xp: [5] }, { runs: -3, top: 99, best: -1, pops: 1e9 },
    { cast: [], charms: 'x', wish: null, ach: 'first_night', shells: { kin: 1 }, streak: [], quest: 5 },
    { cast: { tengu: 'won', tanuki: [NaN, Infinity], neko: [3, 3] }, charms: { kinun: [NaN, -1, 7], maneki: ['a'] } },
    { streak: { last: '2026-13-45', n: 5, best: 9 } }, { streak: { last: '2026-02-30', n: 5 } }, { streak: { last: 20261002, n: 'x' } },
    { quest: { d: '2026-10-02', p: [999, -1, 'x', 4] } }, { quest: { d: 'today', p: [1, 1, 1] } },
    { a: { b: { c: { d: {} } } }, xp: { valueOf: () => 1e6 } }, evil,
  ];
  for (const g of garbage) {
    const m = M.initMeta(g);
    eq(Object.keys(m).sort().join(), keys, `${String(typeof g)}: 項目`);
    ok(Number.isFinite(m.xp) && m.xp >= 0 && m.xp <= 1e8, `xp ${m.xp}`);
    ok(m.top >= -1 && m.top <= 8, `top ${m.top}`);
    ok(m.pops <= 9999 && m.best >= 0 && m.runs >= 0, '数の範囲');
    for (const id of Object.keys(m.cast)) ok(M.CAST_IDS.includes(id), `知らない妖怪 ${id}`);
    for (const id of Object.keys(m.charms)) ok(M.CHARM_IDS.includes(id), `知らないお守り ${id}`);
    for (const [id, e] of Object.entries(m.charms)) ok(e.length === 3 && e.every(Number.isFinite) && e[2] <= 3, `${id}: ${e}`);
    for (const id of Object.keys(m.wish)) ok(M.WISH_IDS.includes(id), `知らない願い ${id}`);
    for (const id of m.ach) ok(M.ACHIEVEMENTS.some((a) => a.id === id), `知らない実績 ${id}`);
    eq(new Set(m.ach).size, m.ach.length, '実績が重なる');
    ok(m.streak.last === null || /^\d{4}-\d{2}-\d{2}$/.test(m.streak.last), `streak.last ${m.streak.last}`);
    eq(m.quest.p.length, 3);
    same(M.initMeta(JSON.parse(JSON.stringify(m))), m, '読み直すと同じ（JSON で往復できる）');
    same(M.initMeta(m), m, 'もう一度とおしても同じ');
    // 壊れた meta を渡しても、ほかの関数が落ちない
    M.rankOf(g); M.charmPool(g); M.outfits(g); M.features(g); M.maxLevel(g); M.collection(g); M.noteSeen(g, g); M.upcoming(g, 3);
    M.applyRun(g, g, g); M.xpForRun(g); M.dailyQuests(g);
  }
  eq(({}).polluted, undefined, 'Object.prototype が汚れた');
  const e = M.initMeta(evil);
  eq(e.xp, 120); same(e.cast, { tengu: [1, 1] }); same(e.charms, { kinun: [2, 1, 3] }); same(e.wish, { w_bloom: 2 });
  same(e.ach, ['first_night']); same(e.shells, ['kin']);
  eq(Object.getPrototypeOf(e.cast), Object.prototype);
  same(M.initMeta({ quest: { d: '2026-10-02', p: [999, -1, 'x'] } }).quest.p, [M.dailyQuests('2026-10-02')[0].goal, 0, 0], 'おつかいの進みは 0..goal');
  eq(M.initMeta({ streak: { last: '2026-02-30', n: 5 } }).streak.n, 0, 'ありえない日付の続けた日数は捨てる');
  eq(M.initMeta({ cast: { neko: [3, 3] } }).cast.neko[1], 0, '猫には勝ち負けがない');
  eq(M.initMeta({ xp: 1e308 }).xp, 1e8, 'xp の上限');
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
  for (const bad of [-5, NaN, Infinity, null, undefined, 'x', {}]) eq(M.rankOf(bad).lv, 1, String(bad));
  eq(M.rankOf({ xp: M.RANKS[9].xp }).lv, 10, 'meta を渡してもよい');
});

check('解放: 格 2〜16 は毎回なにか開く・はじめの 9 と伝説以外のお守りは格 16 までに全部・衣装と遊び方もそろう', () => {
  const rankU = M.UNLOCKS.filter((u) => u.by === 'rank');
  for (let lv = 2; lv <= 16; lv++) ok(rankU.some((u) => u.lv === lv), `格 ${lv} で何も開かない`);
  eq(new Set(M.UNLOCKS.map((u) => `${u.kind}:${u.id}`)).size, M.UNLOCKS.length, '同じものが 2 回開く');
  for (const id of M.CHARM_IDS) {
    if (M.STARTER_CHARMS.includes(id)) { ok(!M.UNLOCKS.some((u) => u.id === id && u.kind === 'charm'), `${id} ははじめからある`); continue; }
    const u = M.UNLOCKS.filter((x) => x.kind === 'charm' && x.id === id);
    eq(u.length, 1, `${id} が開く所`);
    if (M.LEGEND_CHARMS.includes(id)) { eq(u[0].by, 'boss'); eq(u[0].boss, id); } else { eq(u[0].by, 'rank'); ok(u[0].lv <= 16, `${id} は格 ${u[0].lv}`); }
  }
  for (const id of M.OUTFIT_IDS) eq(M.UNLOCKS.filter((x) => x.kind === 'outfit' && x.id === id).length, 1, `衣装 ${id}`);
  same(M.UNLOCKS.find((u) => u.id === 'kanmuri'), M.UNLOCKS.find((u) => u.by === 'level'), '王冠は段位 8');
  eq(M.UNLOCKS.find((u) => u.id === 'levels').by, 'clear', '段位えらびは八夜を通して開く');
  ok(M.UNLOCKS.find((u) => u.id === 'daily').lv <= 3, '今夜の一筆は早めに');
  for (const u of M.UNLOCKS) ok(u.ja && u.en && u.how && u.howEn, `${u.id} の文言`);
  // 格の並び（ゆっくり見せる順）
  for (let i = 1; i < rankU.length; i++) ok(rankU[i].lv >= rankU[i - 1].lv, '格の順に並んでいない');

  const fresh = M.initMeta(null);
  same(M.charmPool(fresh), M.CHARM_IDS.filter((id) => M.STARTER_CHARMS.includes(id)), 'はじめは 9 個');
  same(M.outfits(fresh), []); same(M.features(fresh), []); eq(M.maxLevel(fresh), 0);
  const big = M.initMeta({ xp: 1e7 });
  eq(M.charmPool(big).length, 20, '格がいちばん上でも、伝説は妖怪に勝つまで出ない');
  ok(!M.outfits(big).includes('kanmuri') && M.outfits(big).length === 5);
  same(M.features(big), ['daily']);
  const all = M.initMeta({ xp: 1e7, top: 8, cast: { tengu: [1, 1], tanuki: [1, 1], kitsune: [1, 1], kamaitachi: [1, 1] } });
  same(M.charmPool(all), M.CHARM_IDS); same(M.outfits(all), M.OUTFIT_IDS); same(M.features(all), ['daily', 'levels']); eq(M.maxLevel(all), 8);
  // 次に開くもの
  const up = M.upcoming(fresh, 2);
  eq(up.length, 2); eq(up[0].lv, 2); eq(up[0].xpLeft, M.RANKS[1].xp);
  eq(M.upcoming(big, 3).length, 0);
});

check('XP の式: 夜・星・願い・大一番・完走・段位のおまけ', () => {
  const r = M.xpForRun(run(3, { star2: [0], wish: [1] }));
  const want = M.XP.play + M.XP.nights[0] + M.XP.nights[1] + M.XP.nights[2] + 4 * M.XP.star + M.XP.wish + M.XP.boss;
  eq(r.total, want);
  same(r.parts.map((p) => p.id), ['play', 'nights', 'stars', 'wishes', 'bosses']);
  eq(r.parts.reduce((a, p) => a + p.xp, 0), r.total);
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
  const m0 = deepFreeze(M.initMeta({ xp: 500, runs: 3, cast: { tengu: [1, 0] }, charms: { kinun: [1, 0, 0] } }));
  const s = deepFreeze(run(6, { star2: [0, 1], wish: [0, 3], boss3: 'tengu', boss6: 'kitsune' }));
  const snap = JSON.stringify(m0), snapS = JSON.stringify(s);
  const r = M.applyRun(m0, s, '2026-10-02');
  eq(JSON.stringify(m0), snap); eq(JSON.stringify(s), snapS);
  eq(r.meta.xp - m0.xp, r.xp); eq(r.parts.reduce((a, p) => a + p.xp, 0), r.xp);
  eq(r.rankBefore.lv, M.rankOf(500).lv); eq(r.rankAfter.lv, M.rankOf(r.meta.xp).lv);
  same(r.bossesBeaten, ['tengu', 'kitsune']);
  eq(r.meta.runs, 4); eq(r.meta.nights, 6);
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
  // 格の解放も 1 度だけ（同じ格の間は何も開かない）
  let m = null; const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const r = M.applyRun(m, run(4), addDays(day, i));
    for (const u of r.unlocked) { const k = `${u.kind}:${u.id}`; ok(!seen.has(k), `${k} が 2 回`); seen.add(k); }
    for (const u of r.unlocked) if (u.by === 'rank') ok(u.lv > r.rankBefore.lv && u.lv <= r.rankAfter.lv, `${u.id} は格 ${u.lv}`);
    m = r.meta;
  }
});

check('段位: 段位 n で八夜を通すと n+1 が開く・段位えらびは初めて通したとき・王冠は段位 8', () => {
  let m = M.initMeta(null);
  const bad = M.applyRun(m, run(7), '2026-10-02');
  eq(M.maxLevel(bad.meta), 0, '七夜では開かない');
  ok(!M.features(bad.meta).includes('levels'));
  const r0 = M.applyRun(m, run(8), '2026-10-02');
  eq(M.maxLevel(r0.meta), 1);
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
    if (lv === 8) { ok(r.achievements.includes('level8')); ok(r.unlocked.some((u) => u.id === 'kanmuri')); ok(M.outfits(r.meta).includes('kanmuri')); }
    else ok(!M.outfits(r.meta).includes('kanmuri'));
    m = r.meta;
  }
  // 低い段位で通しても、下がらない
  eq(M.maxLevel(M.applyRun(m, run(8), '2026-10-02').meta), 8);
});

check('実績: 約 24・文言・XP・条件（星 24・願い 8・八夜目の満開・予備なし・大トリ・四十連発）', () => {
  ok(M.ACHIEVEMENTS.length >= 22 && M.ACHIEVEMENTS.length <= 28, `${M.ACHIEVEMENTS.length} 個`);
  eq(new Set(M.ACHIEVEMENTS.map((a) => a.id)).size, M.ACHIEVEMENTS.length);
  for (const a of M.ACHIEVEMENTS) ok(a.ja && a.en && a.desc && a.descEn && a.xp > 0, a.id);
  ok(M.ACHIEVEMENTS.some((a) => a.hidden), '隠し実績');
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
  // 4 匹の妖怪
  let m = null;
  for (const [b3, b6] of [['tengu', 'tanuki'], ['kitsune', 'kamaitachi']]) m = M.applyRun(m, run(6, { boss3: b3, boss6: b6 }), day).meta;
  ok(m.ach.includes('all_yokai'));
  // 常連（10 回）
  m = null;
  for (let i = 0; i < 10; i++) { const x = M.applyRun(m, run(0), day); if (i < 9) ok(!x.achievements.includes('regular')); else ok(x.achievements.includes('regular')); m = x.meta; }
  // 願い札あつめ（14 種類）
  m = null;
  for (let k = 0; k < 2; k++) {
    const s = run(8, { wish: true });
    s.nights.forEach((n, i) => { n.wish.id = M.WISH_IDS[(k * 7 + i) % 14]; });
    const x = M.applyRun(m, s, day); m = x.meta;
    eq(x.achievements.includes('wish_all'), k === 1, `願い ${k}`);
  }
});

check('今日のおつかい: 日付で決まる 3 つ・その日の祭りで足されていく・XP は 1 回・日が変わると新しく', () => {
  const qs = M.dailyQuests('2026-10-02');
  eq(qs.length, 3); same(qs.map((q) => q.tier), [0, 1, 2]);
  same(M.dailyQuests('2026-10-02'), qs, '同じ日は同じ');
  for (const q of qs) ok(q.ja && q.en && q.goal > 0 && q.xp > 0 && M.QUESTS.some((x) => x.id === q.id), q.id);
  ok(M.QUESTS.length >= 14, `ひな形 ${M.QUESTS.length}`);
  const sets = new Set(), used = new Set();
  for (let i = 0; i < 60; i++) {
    const d = addDays('2026-10-01', i), x = M.dailyQuests(d);
    eq(new Set(x.map((q) => q.id)).size, 3, `${d}: 重なり`);
    eq(new Set(x.map((q) => M.QUESTS.find((t) => t.id === q.id).group)).size, 3, `${d}: 似たものが並ぶ`);
    sets.add(x.map((q) => q.id).join()); x.forEach((q) => used.add(q.id));
  }
  ok(sets.size >= 30, `60 日で ${sets.size} 通り`);
  eq(used.size, M.QUESTS.length, '使われないひな形がある');
  eq(M.dailyQuests('garbage').length, 3);

  // 「祭りを 2 回」（合計）: 1 回目は 1/2、2 回目で達成、3 回目はもう XP なし
  const findDay = (id) => { for (let i = 0; i < 400; i++) { const d = addDays('2026-10-01', i); const k = M.dailyQuests(d).findIndex((q) => q.id === id); if (k >= 0) return [d, k]; } throw new Error(`${id} の日が無い`); };
  let [d, k] = findDay('q_play2');
  let r = M.applyRun(null, run(1), d);
  same([r.quests[k].p, r.quests[k].done, r.quests[k].justDone], [1, false, false]);
  r = M.applyRun(r.meta, run(1), d);
  same([r.quests[k].p, r.quests[k].done, r.quests[k].justDone], [2, true, true]);
  const qp = r.parts.find((p) => p.id === 'quest:q_play2');
  ok(qp && qp.xp === M.dailyQuests(d)[k].xp, 'おつかいの XP');
  r = M.applyRun(r.meta, run(1), d);
  same([r.quests[k].done, r.quests[k].justDone], [true, false]);
  ok(!r.parts.some((p) => p.id === 'quest:q_play2'), '2 回目の XP はない');
  // 次の日は 0 から
  r = M.applyRun(r.meta, run(1), addDays(d, 1));
  eq(r.meta.quest.d, addDays(d, 1));
  ok(r.quests.every((q) => !q.justDone || q.p >= q.goal));
  // 「一回の祭りで四夜」（いちばん）: 3 夜 → 2 夜 → 4 夜
  [d, k] = findDay('q_run4');
  r = M.applyRun(null, run(3), d); eq(r.quests[k].p, 3);
  r = M.applyRun(r.meta, run(2), d); eq(r.quests[k].p, 3, '合計しない');
  r = M.applyRun(r.meta, run(4), d); ok(r.quests[k].justDone);
  // 「星を合わせて 6 個」（合計）: 3 + 3
  [d, k] = findDay('q_stars6');
  r = M.applyRun(null, run(3), d); eq(r.quests[k].p, 3);
  r = M.applyRun(r.meta, run(3), d); ok(r.quests[k].justDone);
  // 日付が無い・壊れているときは、おつかいも続けた日数も動かさない（XP は入る）
  const n = M.applyRun(null, run(3), 'nope');
  same(n.quests, []); eq(n.meta.streak.n, 0); ok(n.xp > 0);
});

check('続けた日数: 毎日 +1・同じ日は 1 回・1 日あくと 1 から・おまけは 7 日で頭打ち・5 日で実績', () => {
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
  eq(r.meta.streak.n, 1); eq(r.meta.streak.best, 10); eq(r.streak.xp, M.XP.streakStep);
  // 時計が戻っても、減らさず・おまけもなし
  const back = M.applyRun(r.meta, run(2), addDays(last, -3));
  eq(back.meta.streak.n, 1); eq(back.meta.streak.last, addDays(last, 2)); eq(back.streak.xp, 0);
});

check('図鑑: 見たお守り・玉・妖怪を書く。知らない ID は捨てる。24 個見たら実績', () => {
  let m = M.noteSeen(null, { charms: ['kinun', 'kinun', 'nope', '__proto__'], shells: ['kin', 'kuro', 'shaku'], cast: ['neko', 'oni'] });
  const c = M.collection(m);
  same(c.charms.kinun, { seen: 2, used: 0, maxLv: 0 });
  eq(Object.keys(c.charms).length, 24); eq(c.counts.charms, 1); eq(c.counts.charmsTotal, 24);
  same(c.cast.neko, { met: 1, beaten: 0 }); eq(c.counts.cast, 1); eq(c.counts.castTotal, 5);
  eq(c.shells.kin, true); eq(c.shells.kiku, false); eq(c.counts.shells, 2);
  eq(Object.keys(c.achievements).length, M.ACHIEVEMENTS.length);
  same(M.noteSeen(m, null), m, '空の知らせでは変わらない');
  same(M.noteSeen(m, 'x'), m);
  // 使ったお守りと Lv
  m = M.applyRun(m, run(3, { charms: { kinun: 2, maneki: 1 } }), '2026-10-02').meta;
  same(M.collection(m).charms.kinun, { seen: 2, used: 1, maxLv: 2 });
  same(M.collection(m).charms.maneki, { seen: 1, used: 1, maxLv: 1 });
  // 全部見て、次の祭りで実績
  m = M.noteSeen(m, { charms: M.CHARM_IDS });
  eq(M.collection(m).counts.charms, 24);
  const r = M.applyRun(m, run(1), '2026-10-02');
  ok(r.achievements.includes('zukan'));
  eq(M.collection(r.meta).achievements.zukan, true);
});

check('meta は小さい（よく遊んだあとでも 2KB まで）', () => {
  let m = M.noteSeen(null, { charms: M.CHARM_IDS, shells: M.SHELL_TYPES, cast: M.CAST_IDS });
  for (let i = 0; i < 300; i++) {
    const s = run(8, { star2: true, star3: true, wish: true, tori: 9, pops: 41, retries: 0, daily: true, level: 8, boss3: M.BOSSES[i % 4], boss6: M.BOSSES[(i + 1) % 4], charms: { [M.CHARM_IDS[i % 24]]: 3, kinun: 2 } });
    s.nights.forEach((n, j) => { n.wish.id = M.WISH_IDS[(i + j) % 14]; });
    m = M.applyRun(m, s, addDays('2026-10-01', i)).meta;
  }
  const size = JSON.stringify(m).length;
  ok(size < 2048, `${size} 文字`);
  eq(m.ach.length, M.ACHIEVEMENTS.length, '全部とれる');
  eq(M.rankOf(m.xp).lv, 30);
});

check('はじめの祭り: 三〜四夜なら格が 1〜2 つ上がる・次のよい祭りで 2〜3 つ', () => {
  // おつかいは日付で変わるので、30 日ぶん試す
  for (let i = 0; i < 30; i++) {
    const d = addDays('2026-10-01', i);
    for (const n of [3, 4]) {
      const first = M.applyRun(null, run(n, { star2: [0], wish: [1], charms: { kinun: 1, kodou: 1, tairin: 1 } }), d);
      const ups = first.rankAfter.lv - first.rankBefore.lv;
      ok(ups >= 1 && ups <= 2, `${d}: ${n} 夜で格が ${ups} 上がる (${first.xp} XP)`);
      ok(first.unlocked.length >= 1, '何か開く');
    }
    const first = M.applyRun(null, run(3, { star2: [0], wish: [1] }), d);
    const good = M.applyRun(first.meta, run(6, { star2: [0, 1, 3], wish: [0, 2, 4], boss3: 'tengu', boss6: 'kitsune' }), addDays(d, 1));
    const ups = good.rankAfter.lv - good.rankBefore.lv;
    ok(ups >= 2 && ups <= 3, `${d}: 六夜のよい祭りで格が ${ups} 上がる (${good.xp} XP)`);
  }
});

// ふつうに遊ぶ人: 腕は回を重ねて上がり、八夜を通したら段位を 1 つ上げる。1 日 3 回、ときどき 1 日あく
function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TWISTS = Object.keys(M.TWIST_BOSS);
function typicalRun(rnd, k, level, pool) {
  const skill = Math.min(0.92, 0.70 + 0.012 * k) - 0.04 * level;
  const nights = [], charms = {};
  let cleared = 0, lives = 1, retries = 0;
  for (let i = 0; i < 8; i++) {
    const boss = i === 2 || i === 5;
    const p = Math.max(0.05, Math.min(0.98, skill + (i < 2 ? 0.15 : 0) - (boss ? 0.04 : 0) - 0.012 * i));
    let pass = rnd() < p;
    if (!pass && lives > 0) { lives--; retries++; pass = rnd() < p; }
    const allClear = pass && rnd() < 0.12;
    nights.push({ night: i + 1, pass, stars: [pass, pass && rnd() < 0.35, allClear], allClear, pops: Math.round((16 + 4 * i) * (0.5 + 0.4 * rnd())),
      score: pass ? 120 : 80, target: 100, twist: boss ? TWISTS[Math.floor(rnd() * 4)] : null, boss: null,
      wish: { id: M.WISH_IDS[Math.floor(rnd() * 14)], met: pass && rnd() < 0.35 }, toriAdd: i >= 6 && pass ? Math.floor(rnd() * 11) : 0 });
    if (!pass) break;
    cleared++;
    const id = pool[Math.floor(rnd() * pool.length)]; charms[id] = Math.min(3, (charms[id] || 0) + 1);
  }
  return { mode: 'run', daily: rnd() < 0.15, level, cleared, total: cleared * 1000, bestPops: 0, nights, charms, retries };
}
function simulate(seed, runs) {
  const rnd = rng32(seed * 7919);
  let meta = M.initMeta(null), level = 0, day = 0, today = 0;
  const ranks = [0], xps = [0];
  for (let k = 1; k <= runs; k++) {
    if (today >= 3) { day += rnd() < 0.15 ? 2 : 1; today = 0; }
    today++;
    const s = typicalRun(rnd, k, level, M.charmPool(meta));
    meta = M.applyRun(meta, s, addDays('2026-10-01', day)).meta;
    if (s.cleared >= 8) level = Math.min(M.maxLevel(meta), level + 1);
    ranks.push(M.rankOf(meta.xp).lv); xps.push(meta.xp);
  }
  return { ranks, xps, meta };
}

check('ふつうに遊ぶ人の 50 回: 格の伸び（1・5・10・20・40 回目）と、いちばん上まで 40〜60 回', () => {
  const seeds = Array.from({ length: 24 }, (_, i) => i + 1), sims = seeds.map((s) => simulate(s, 70));
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const at = (k) => med(sims.map((x) => x.ranks[k]));
  const marks = [1, 5, 10, 20, 40, 50];
  console.log('  ふつうに遊ぶ人（24 人の中央値）: ' + marks.map((k) => `${k} 回目 格 ${at(k)}`).join(' / '));
  console.log('  1 人目: ' + marks.map((k) => `${k} 回目 格 ${sims[0].ranks[k]}`).join(' / '));
  const toMax = sims.map((x) => x.ranks.indexOf(30)).map((i) => (i < 0 ? 999 : i));
  const toCharms = sims.map((x) => x.ranks.findIndex((r) => r >= 16));
  console.log(`  格 30 まで: 中央値 ${med(toMax)} 回（${Math.min(...toMax)}〜${Math.max(...toMax)}）・お守りが出そろう格 16 まで: 中央値 ${med(toCharms)} 回`);
  ok(at(1) >= 2 && at(1) <= 4, `1 回目 ${at(1)}`);
  ok(at(5) >= 6 && at(5) <= 11, `5 回目 ${at(5)}`);
  ok(at(10) >= 10 && at(10) <= 15, `10 回目 ${at(10)}`);
  ok(at(20) >= 15 && at(20) <= 22, `20 回目 ${at(20)}`);
  ok(at(40) >= 23 && at(40) <= 29, `40 回目 ${at(40)}`);
  ok(med(toMax) >= 40 && med(toMax) <= 60, `格 30 まで ${med(toMax)} 回`);
  ok(med(toCharms) >= 10 && med(toCharms) <= 25, `格 16 まで ${med(toCharms)} 回`);
  // 格は下がらない・XP は増えるだけ
  for (const x of sims) for (let k = 1; k < x.ranks.length; k++) ok(x.ranks[k] >= x.ranks[k - 1] && x.xps[k] > x.xps[k - 1], '下がった');
});

if (failures) { console.error(`hitofude_meta_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_meta_test: ALL PASS');
