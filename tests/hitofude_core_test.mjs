// 一筆花火の純関数とシミュレーションのテスト。DOM も fetch も使わない。実行: node tests/hitofude_core_test.mjs
import * as K from '../assets/hitofude/core.js';

let failures = 0;
// TIMING=1 で、1 つずつかかった時間も出す
function check(name, fn) {
  const t0 = Date.now();
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
  if (process.env.TIMING) console.error(`${String(Date.now() - t0).padStart(6)}ms ${name}`);
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'not ok'); }
const line = (x0, y0, x1, y1, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }));

check('日付と月: 日本時間の 0 時で切り替わり、公開した夜が #1・満月のころ', () => {
  eq(K.jstDateKey(new Date('2026-09-26T14:59:59Z')), '2026-09-26');
  eq(K.jstDateKey(new Date('2026-09-26T15:00:00Z')), '2026-09-27');
  eq(K.dayNumber('2026-09-26'), 1);
  eq(K.MOONS[K.moonIndex(K.moonPhase('2026-09-26'))].id, 'mangetsu');
  eq(K.MOONS[K.moonIndex(K.moonPhase('2026-10-11'))].id, 'shingetsu', '2026-10-11 は新月のころ');
  eq(K.MOONS.length, 8);
  for (let p = 0; p < 1; p += 0.01) ok(K.moonIndex(p) >= 0 && K.moonIndex(p) < 8);
});

check('お守り: 24 個・ID 重複なし・絵文字はカラーで出る・珍しさ・型・Lv ごとの文言・Lv の数字', () => {
  eq(K.CHARMS.length, 24);
  eq(new Set(K.CHARM_IDS).size, K.CHARMS.length);
  // 前からの 15 個は id も並びも同じ（前の日の記録の名前に使う）
  eq(K.CHARM_IDS.slice(0, 15).join(), 'nagafude,nokorizumi,tairin,kinun,osobi,ichibanboshi,owaridama,kodou,mankai,mashidama,nihitsu,nokoribi,chouchinshi,amayoke,kazekiri');
  for (const id of ['maneki', 'hanaikada', 'renjishi', 'suminagashi', 'senkou', 'tengu', 'tanuki', 'kitsune', 'kamaitachi']) ok(K.CHARM_IDS.includes(id), id);
  for (const c of K.CHARMS) {
    ok(c.ja && c.en && c.desc && c.descEn, `${c.id} の文言`);
    ok(/^\p{Emoji_Presentation}$/u.test(c.emoji) || /️$/.test(c.emoji), `${c.id}: ${c.emoji} は白黒の文字で出る`);
    ok(K.RARITIES.includes(c.rarity), `${c.id} の珍しさ`);
    ok(c.tags.length >= 1 && c.tags.every((t) => K.TAGS.includes(t)), `${c.id} の型 ${c.tags}`);
    ok(['mult', 'reach', 'gimmick'].includes(c.kind), `${c.id} の種類`);
    eq(c.lv.length, K.MAX_LV); eq(c.lvEn.length, K.MAX_LV);
    ok(c.lv.every((t) => t) && c.lvEn.every((t) => t), `${c.id} の Lv の文言`);
    eq(c.desc, c.lv[0]); eq(c.descEn, c.lvEn[0]);
    ok(c.lv3 && c.lv3En, `${c.id} の Lv3 の言葉`);
    ok(K.CHARM_LV[c.id], `${c.id} の Lv の数字`);
    for (const k in K.CHARM_LV[c.id]) eq(K.CHARM_LV[c.id][k].length, K.MAX_LV, `${c.id}.${k}`);
    // Lv3 で変わるふるまい: Lv2 まではふつうの値（0 か 1）で、Lv3 だけ違う数字が、どのお守りにもある
    const brk = Object.entries(K.CHARM_LV[c.id]).filter(([, v]) => [0, 1].includes(v[1]) && v[0] === v[1] && v[2] !== v[1]);
    ok(brk.length >= 1, `${c.id}: Lv3 で変わるふるまいが無い`);
  }
  // 伝説は 4 つ。大一番の妖怪と 1 対 1
  const legends = K.CHARMS.filter((c) => c.rarity === 'legend');
  eq(legends.map((c) => c.id).sort().join(), 'kamaitachi,kitsune,tanuki,tengu');
  for (const tw of K.TWISTS) eq(K.charmById(K.LEGEND_OF[tw.id]).boss, tw.id, tw.id);
  // 型ごとに、組み合わせられるお守りが 2 つ以上ある
  for (const t of ['gold', 'lantern', 'chain', 'ink', 'finale']) ok(K.CHARMS.filter((c) => c.tags.includes(t)).length >= 2, t);
  // 線香花火は墨を使い切るお守り（墨を残す型とは取り合い）なので、墨の型には入れない
  ok(!K.charmById('senkou').tags.includes('ink') && K.charmById('senkou').tags.includes('risk'));
  // 掛け算（×）のお守りが、型ごとにある
  for (const id of ['maneki', 'renjishi', 'senkou', 'mankai', 'tengu', 'kamaitachi']) ok(K.CHARM_LV[id].x, `${id} は掛け算`);
  eq(K.SLOTS, 5); eq(K.MAX_LV, 3);
});

check('お守りの Lv: 重なった数が Lv（Lv3 まで）・知らない id は数えない・並べ直せる', () => {
  eq(JSON.stringify(K.charmLevels(['kinun', 'kinun', 'kodou'])), JSON.stringify({ kinun: 2, kodou: 1 }));
  eq(JSON.stringify(K.charmLevels(['kodou', 'kinun', 'kinun'])), JSON.stringify({ kodou: 1, kinun: 2 }), '並びは関係ない');
  eq(K.charmLevels(['kinun', 'kinun', 'kinun', 'kinun']).kinun, 3, 'Lv3 まで');
  eq(JSON.stringify(K.charmLevels(['futofude', 'nope', null])), '{}');
  eq(K.charmList({ kodou: 1, kinun: 2 }).join(), 'kinun,kinun,kodou');
  eq(K.charmList({ kinun: 9 }).length, 3);
  eq(JSON.stringify(K.charmLevels([])), '{}');
  // 選んだらどうなるか・選んだあとの持ち物
  const five = ['kinun', 'kodou', 'tairin', 'nagafude', 'osobi'];
  eq(K.pickKind(five, 'kinun'), 'up'); eq(K.pickKind(five, 'maneki'), 'swap'); eq(K.pickKind(five.slice(0, 4), 'maneki'), 'new');
  eq(K.pickKind(['kinun', 'kinun', 'kinun'], 'kinun'), 'max'); eq(K.pickKind(five.slice(0, 4), 'maneki', 4), 'swap', '段位 8 は 4 つ');
  eq(K.pickCharm(five, 'kinun').join(), 'nagafude,tairin,kinun,kinun,osobi,kodou');
  eq(K.pickCharm(['kinun', 'kinun', 'kodou'], 'maneki', 'kinun').join(), 'kodou,maneki', '手放すと Lv ごと');
  eq(K.pickCharm(['kinun', 'kinun', 'kinun'], 'kinun').join(), 'kinun,kinun,kinun');
});

check('ルール: お守りと月が合わさる', () => {
  const base = K.rulesFor([], 1);
  eq(base.ink, K.BASE_INK);
  eq(base.decay, K.DECAY); eq(base.bloom, 2); eq(base.chainPulse, 0);
  const r = K.rulesFor(['nagafude', 'tairin', 'kodou', 'mankai'], 4);
  eq(r.ink, Math.round(K.BASE_INK * K.CHARM_LV.nagafude.ink[0]));
  eq(r.decay, K.SOFT_DECAYS[K.CHARM_LV.tairin.soft[0] + K.MOON_SOFT], '大輪と満月で、減衰がもっとゆるい');
  ok(r.decay > K.DECAY_SOFT);
  eq(K.rulesFor(['tairin'], 1).decay, K.SOFT_DECAYS[K.CHARM_LV.tairin.soft[0]]); eq(K.rulesFor([], 4).decay, K.DECAY_SOFT, '満月は 0.95');
  ok(K.rulesFor(['tairin'], 1).decay > K.DECAY && K.rulesFor(['tairin', 'tairin'], 1).decay === K.DECAY_SOFT);
  eq(K.rulesFor([], 4).radius, 1.12, '花火合戦の満月は +12% のまま');
  eq(r.chainPulse, K.KODOU_STEP); eq(r.bloom * r.bloomX, 3, '満開の加護は、全部ひらけば ×3');
  eq(K.rulesFor([], 5).startMult, 1, '寝待月は倍率 +1 から');
  eq(K.rulesFor(['osobi'], 5).startMult, 1 + K.SLOW_MULT, '遅火と寝待月は足し算');
  eq(K.rulesFor(['osobi'], 1).fuseSpeed, K.SLOW_FUSE);
  eq(K.rulesFor(['nokoribi'], 6).afterglow, K.CHARM_LV.nokoribi.p[0] + 0.4, '残り火と下弦は足し算');
  eq(K.rulesFor(['amayoke'], 1).dampHits, 1); eq(K.rulesFor([], 1).dampHits, K.DAMP_HITS);
});

check('夜の並び: 決定的・場の中・重ならない・夜ごとに増える・月で種類が変わる', () => {
  for (let night = 0; night < K.NIGHTS; night++) {
    const a = K.makeLayout(12345, night, K.rulesFor([], 4)), b = K.makeLayout(12345, night, K.rulesFor([], 4));
    eq(JSON.stringify(a), JSON.stringify(b), `night ${night}: 決定的でない`);
    ok(a.length >= K.BASE_COUNTS[night] - 2, `night ${night}: ${a.length} 個`);
    for (const s of a) ok(s.x >= K.FIELD.x0 && s.x <= K.FIELD.x1 && s.y >= K.FIELD.y0 && s.y <= K.FIELD.y1, '場の外');
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= 27, `night ${night}: ${i} と ${j} が近すぎる`);
    }
  }
  const other = K.makeLayout(999, 0, K.rulesFor([], 4));
  ok(JSON.stringify(other) !== JSON.stringify(K.makeLayout(12345, 0, K.rulesFor([], 4))), 'シードで変わらない');
  const golds = (moon, vs = false) => K.makeLayout(7, 3, K.rulesFor([], moon, 0, vs)).filter((s) => s.type === 'kin').length;
  eq(golds(0), golds(4) + 1, '新月は金が 1 つ増える（13版）');
  eq(golds(0, true), golds(4, true) * 2, '花火合戦の新月は、前のまま金が 2 倍');
  eq(K.MOONS[0].rule, '金の玉が 1 つ増える'); ok(K.MOONS[0].ruleVs && K.MOONS[0].ruleVsEn);
  eq(K.makeLayout(7, 3, K.rulesFor(['mashidama'], 4)).length - K.makeLayout(7, 3, K.rulesFor([], 4)).length, K.MASHI_N, '増し玉');
});

check('夜空は固まっている: 増し玉・風切りを持っていても、もとの玉・雲・縄は同じ（増し玉の玉は後ろに足すだけ）', () => {
  let extra = 0;
  for (let seed = 1; seed <= 30; seed++) for (const night of [3, 4, 6, 7]) {
    const moon = seed % 8, a = K.newRound({ seed, night, moon, par: true });
    for (const ch of [['mashidama'], ['kazekiri'], ['mashidama', 'kazekiri', 'nagafude']]) {
      const b = K.newRound({ seed, night, charms: ch, moon, par: true });
      const key = (s) => `${s.id}:${s.type}:${s.x}:${s.y}:${s.hue}`;
      eq(b.shells.slice(0, a.shells.length).map(key).join(), a.shells.map(key).join(), `seed ${seed} night ${night} ${ch}: もとの玉が変わる`);
      eq(b.clouds.map((c) => `${c.x}:${c.y}`).join(), a.clouds.map((c) => `${c.x}:${c.y}`).join(), '雲の場所が変わる');
      eq(JSON.stringify(b.ropes), JSON.stringify(a.ropes), '縄が変わる');
      const added = b.shells.slice(a.shells.length);
      if (ch.includes('mashidama')) { ok(added.length >= K.MASHI_N - 1 && added.every((s) => s.extra && s.type === 'kiku'), '増し玉の玉'); extra += added.length; } else eq(added.length, 0);
      if (ch.includes('kazekiri')) b.clouds.forEach((c, i) => eq(c.r, Math.round(a.clouds[i].r * K.KAZE_SCALE), '風切りの雲'));
      for (const s of added) {
        ok(s.x >= K.FIELD.x0 && s.x <= K.FIELD.x1 && s.y >= K.FIELD.y0 && s.y <= K.FIELD.y1, '場の外');
        for (const t of b.shells) if (t !== s) ok(Math.hypot(t.x - s.x, t.y - s.y) >= 27, '増し玉が近すぎる');
        for (const c of a.clouds) ok(Math.hypot(c.x - s.x, c.y - s.y) >= c.r + 14, '増し玉が雲（元の大きさ）に重なる');
      }
    }
  }
  ok(extra > 0);
  // 目標点も、お守りに関係なく同じ
  eq(K.newRound({ seed: 5, night: 6, charms: ['mashidama', 'kazekiri'], moon: 3 }).target, K.newRound({ seed: 5, night: 6, moon: 3 }).target);
});

check('線: 8 単位ごとの整数点にならし、墨の長さで切る', () => {
  const pts = K.normalizeStroke(line(20, 300, 340, 300, 7), 100);
  ok(pts.length >= 10 && pts.length <= 14, `${pts.length} 点`);
  ok(K.pathLength(pts) <= 100 + 1e-9, `長さ ${K.pathLength(pts)}`);
  for (const p of pts) ok(Number.isInteger(p.x) && Number.isInteger(p.y));
  eq(K.normalizeStroke([{ x: 5, y: 5 }], 100).length, 0, '1 点だけ');
  eq(K.normalizeStroke([{ x: 5, y: 5 }, { x: NaN, y: 3 }], 100).length, 0, 'NaN');
  const out = K.normalizeStroke([{ x: -50, y: -50 }, { x: 900, y: 900 }], 5000);
  for (const p of out) ok(p.x >= 0 && p.x < K.W && p.y >= 0 && p.y < K.H, '画面の外');
  ok(K.normalizeStroke(line(0, 0, 359, 639, 200), 99999).length <= K.STROKE_MAX_POINTS, '点数の上限');
});

// 手で並べた夜で、火の移り方を確かめる
function handRound(shells, charms = [], moon = 1) {
  const st = K.newRound({ seed: 1, night: 0, charms, moon });
  st.shells = shells.map((s, i) => ({ id: i, hue: 0, burst: false, burstAt: -1, ...s }));
  return st;
}
check('導火線: 線の上の玉がひらき、爆発が近くの玉へ連鎖する', () => {
  const st = handRound([
    { type: 'kiku', x: 100, y: 300 },  // 線の上
    { type: 'kiku', x: 140, y: 300 },  // 線の上
    { type: 'kiku', x: 140, y: 340 },  // 線から 40 離れる → 爆発（R=46）で連鎖
    { type: 'kiku', x: 300, y: 100 },  // 遠い → 残る
  ]);
  const res = K.runToEnd(st, [line(80, 300, 160, 300)]);
  eq(res.pops, 3);
  ok(!st.shells[3].burst, '遠い玉がひらいた');
  eq(res.chips, 30);
  eq(res.mult, 1);
  eq(res.score, 30);
  eq(res.allClear, false);
});

check('導火線: 爆発が線の途中に引火すると、そこから両向きに燃える', () => {
  // 線は左から燃える。右の端の近くに大玉があり、別の火（千輪の火花）でひらくと、線の右側が先に燃える
  const st = handRound([{ type: 'kiku', x: 20, y: 300 }]);
  K.lightStroke(st, line(20, 300, 340, 300, 80));
  // 途中に爆発を置く
  st.explosions.push({ x: 300, y: 300, R: 30, t: 0, cause: 'test', hue: 0 });
  let caught = false;
  for (let i = 0; i < 20 && !st.done; i++) { K.step(st); if (st.events.some((e) => e.type === 'catch')) caught = true; st.events.length = 0; }
  ok(caught, '引火しなかった');
  ok(st.heads.length >= 2, `火の数 ${st.heads.length}`);
});

check('千輪: 火花がまっすぐ飛んで、離れた玉をひらく', () => {
  const st = handRound([
    { type: 'senrin', x: 100, y: 300 },
    { type: 'kiku', x: 100, y: 180 },   // 真上に 120（爆発 R=30 では届かないが、火花なら届く）
    { type: 'kiku', x: 220, y: 300 },
  ]);
  const res = K.runToEnd(st, [line(80, 300, 110, 300, 6)]);
  ok(res.pops >= 2, `${res.pops}`);
});

check('金と倍率: 金は倍率 +1、10 個ごとに +1、全部ひらくと ×2（満開の加護なら ×3）・金運は金ひとつ +2', () => {
  const shells = [];
  for (let i = 0; i < 10; i++) shells.push({ type: i === 0 ? 'kin' : 'kiku', x: 30 + i * 30, y: 300 });
  const st = handRound(shells);
  const res = K.runToEnd(st, [line(20, 300, 340, 300, 80)]);
  eq(res.pops, 10); eq(res.allClear, true);
  eq(res.chips, 5 + 9 * 10);
  eq(res.mult, 1 + 1 + 1, '金 +1・10 個 +1');
  eq(res.score, 95 * 3 * 2);
  const st2 = handRound(shells.map((s) => ({ ...s })), ['kinun', 'mankai']);
  const r2 = K.runToEnd(st2, [line(20, 300, 340, 300, 80)]);
  eq(r2.mult, 1 + 2 + 1, '金運 +2');
  eq(r2.score, 95 * 4 * 3, '満開の加護 ×3');
});

// 1 列に並べた菊（間 gap）の端の 1 つにだけ線で触れ、burst の知らせを集める
function rowChain(charms = [], gap = 26, n = 9) {
  const st = handRound(Array.from({ length: n }, (_, i) => ({ type: 'kiku', x: 50 + i * gap, y: 300 })), charms);
  K.lightStroke(st, line(50, 340, 50, 310, 6));
  const bursts = [];
  for (let i = 0; i < 1200 && !st.done; i++) { K.step(st); for (const e of st.events) if (e.type === 'burst') bursts.push(e); st.events.length = 0; }
  return { st, bursts };
}
check('鼓動: 爆発や火花でひらいた玉だけを、KODOU_STEP ごとに数える（線でひらいた玉は数えない）', () => {
  const a = rowChain();
  ok(a.st.chainPops >= K.KODOU_STEP && a.st.chainPops === a.st.pops - 1, `連鎖 ${a.st.chainPops} / ${a.st.pops}`);
  eq(a.st.result.mult, 1 + Math.floor(a.st.pops / 10), 'ふだんは 10 個ごと');
  const b = rowChain(['kodou']);
  eq(b.st.result.mult, 1 + Math.floor(b.st.chainPops / K.KODOU_STEP), '鼓動');
  eq(b.st.chainPops, b.bursts.filter((e) => e.gen > 0).length, '連鎖でひらいた玉 = 代が 1 以上');
  // 線でひらいた玉は数えない: 全部を線でなぞる（玉の間を広くして、線の火が先に届くように）
  const st = handRound(Array.from({ length: 6 }, (_, i) => ({ type: 'kiku', x: 40 + i * 60, y: 300 })), ['kodou']);
  const r = K.runToEnd(st, [line(20, 300, 350, 300, 80)]);
  eq(r.pops, 6); eq(st.chainPops, 0); eq(r.mult, 1);
});

check('連鎖の減衰: 代が進むほど小さくひらく・爆発の大きさと代は burst の知らせに入る・大輪でゆるむ', () => {
  const R = K.rulesFor([], 1), T = K.rulesFor(['tairin'], 1);
  eq(K.sizeAt(R, 0), 1); ok(Math.abs(K.sizeAt(R, 2) - K.DECAY * K.DECAY) < 1e-12);
  eq(K.sizeAt(R, 40), K.DECAY_MIN, '下限');
  ok(K.sizeAt(T, 3) > K.sizeAt(R, 3), '大輪はゆるい');
  eq(K.sizeAt(K.rulesFor([], 4), 5, true), 1.12, '花火合戦は減衰なし（満月 +12%）');
  // 下限の菊の火は、玉どうしの最小の間に届かない（密な群れでも連鎖が終わる）
  ok(K.SHELLS.kiku.R * K.DECAY_MIN + K.SHELLS.kiku.r < 27, '下限が大きすぎる');
  const { st, bursts } = rowChain();
  eq(bursts[0].gen, 0, '線でひらいた玉は 0 代目'); eq(bursts[0].cause, 'fuse'); eq(bursts[0].R, K.SHELLS.kiku.R);
  let prev = 0;
  for (const e of bursts) {
    ok(e.gen >= prev, '代は列にそって増える'); prev = e.gen;
    ok(Math.abs(e.R - K.SHELLS.kiku.R * K.sizeAt(st.rules, e.gen)) < 1e-9, `${e.gen} 代目の大きさ ${e.R}`);
    if (e.gen) eq(e.cause, 'chain');
  }
  ok(prev >= 4, `連鎖が ${prev} 代まで`);
  ok(bursts.length >= 5 && bursts.length < 9, `減衰で連鎖が途中で止まる（${bursts.length} 個）`);
  eq(rowChain(['tairin']).bursts.length, 9, '大輪なら最後まで連鎖する');
});

check('終わり玉: 線の終わりが、ひと息おいて大きく爆ぜる。その火は線の火として尺玉にも届く', () => {
  const st = handRound([{ type: 'kiku', x: 200, y: 380 }], ['owaridama']);
  K.lightStroke(st, line(40, 300, 200, 300));  // 終点から 80 下に玉 → 終わり玉（R=100）で届く
  let endAt = -1, boomAt = -1;
  for (let i = 0; i < 1200 && !st.done; i++) {
    K.step(st);
    for (const e of st.events) { if (e.type === 'fuseEnd') endAt = st.t; if (e.type === 'endBurst') { boomAt = st.t; eq(e.R, K.OWARI_R); } }
    st.events.length = 0;
  }
  eq(st.result.pops, 1);
  ok(endAt > 0 && boomAt - endAt >= K.OWARI_DELAY - 1e-9 && boomAt - endAt < K.OWARI_DELAY + 0.05, `終わりに火が届いて ${endAt} → 爆ぜて ${boomAt}`);
  // 尺玉は爆発ではひらかないが、終わり玉の火ではひらく
  const sh = () => [{ type: 'shaku', x: 200, y: 370 }];
  eq(K.runToEnd(handRound(sh()), [line(40, 300, 200, 300)]).pops, 0, '終わり玉なしでは届かない');
  const r2 = K.runToEnd(handRound(sh(), ['owaridama']), [line(40, 300, 200, 300)]);
  eq(r2.pops, 1, '終わり玉の火で尺玉がひらく');
});

check('二筆目: 6 割ひらいて残りがあれば、もう1本（墨は 1/3）。もらった墨は墨の勘定に入る', () => {
  const shells = [];
  for (let i = 0; i < 26; i++) shells.push({ type: 'kiku', x: 20 + (i % 13) * 26, y: i < 13 ? 200 : 202 });
  shells.push({ type: 'kiku', x: 180, y: 450 });
  const st = handRound(shells, ['nihitsu']);
  eq(K.nihitsuNeed(st), Math.ceil(27 * K.NIHITSU_SHARE));
  K.lightStroke(st, line(10, 201, 350, 201, 90));
  const total1 = st.inkTotal;
  for (let i = 0; i < 3600 && st.phase !== 'draw2' && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.phase, 'draw2');
  eq(st.ink, Math.round(st.rules.ink * K.NIHITSU_INK)); eq(K.NIHITSU_INK, K.CHARM_LV.nihitsu.ink[0]);
  eq(st.inkTotal, total1 + st.ink, '二筆目の墨も、この夜にもらった墨');
  K.lightStroke(st, line(170, 450, 190, 450, 6));
  for (let i = 0; i < 3600 && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.result.allClear, true);
  // ひらいた玉が足りなければ、もう1本は無い
  const few = handRound(shells.map((s) => ({ ...s })), ['nihitsu']);
  K.runToEnd(few, [line(170, 450, 190, 450, 6)]);  // 離れた 1 つだけ
  eq(few.result.pops, 1); eq(few.secondUsed, false);
});

check('決定的: 同じ夜・同じ線なら、同じ点', () => {
  for (let night = 0; night < K.NIGHTS; night++) {
    const mk = () => K.newRound({ seed: 777, night, charms: ['nokoribi', 'osobi', 'owaridama', 'kodou'], moon: 6 });
    const a = mk(), b = mk();
    const stroke = line(30, 150 + night * 30, 330, 420 - night * 20, 60);
    eq(JSON.stringify(K.runToEnd(a, [stroke])), JSON.stringify(K.runToEnd(b, [stroke])), `night ${night}`);
  }
});

check('お守りの候補: 決定的・3 つ・Lv3 のものは出ない・持っているものは Lv 上げとして出る', () => {
  const a = K.offerCharms(5, 2, ['tairin']), b = K.offerCharms(5, 2, ['tairin']);
  eq(a.join(), b.join());
  eq(a.length, 3);
  eq(new Set(a).size, 3);
  let up = 0, n = 0;
  for (let seed = 1; seed < 400; seed++) {
    const held = ['tairin', 'tairin', 'tairin', 'kinun', 'kodou', 'kodou'];
    const o = K.offerCharms(seed, 4, held);
    n++;
    ok(!o.includes('tairin'), 'Lv3 は出ない');
    if (o.includes('kinun') || o.includes('kodou')) up++;
  }
  // 3 種類持っている（大輪は Lv3 でも数える）ので、Lv 上げの枠がいつもある
  eq(up, n, `持っているもの（Lv 上げ）が出る割合 ${up}/${n}`);
  // 2 種類なら、Lv 上げの枠は無い（出るかどうかは重み次第）
  let up2 = 0;
  for (let seed = 1; seed < 400; seed++) if (K.offerCharms(seed, 4, ['kinun', 'kodou']).some((id) => ['kinun', 'kodou'].includes(id))) up2++;
  ok(up2 > 40 && up2 < 380, `2 種類のとき ${up2}/399`);
});

check('お守りの候補（13版）: 3 種類持ったら 1 つは Lv 上げ・型が重なるほど出やすい・並びは引いた順', () => {
  let n = 0, nUp = 0;
  for (let seed = 1; seed < 300; seed++) for (const night of [3, 5]) {
    const held = ['kinun', 'kodou', 'tairin', 'tairin'];
    const o = K.offerCharms(seed, night, held);
    eq(o.length, 3); eq(new Set(o).size, 3); n++;
    ok(o.some((id) => ['kinun', 'kodou', 'tairin'].includes(id)), `seed ${seed}: Lv 上げが無い ${o}`);
    nUp += o.filter((id) => ['kinun', 'kodou', 'tairin'].includes(id)).length;
    eq(o.join(), K.offerCharms(seed, night, held).join(), '決定的');
  }
  ok(nUp < n * 2.2, `Lv 上げばかり ${nUp}/${n}`);
  eq(K.UPGRADE_SLOT_AT, 3);
  // 全部 Lv3 なら、Lv 上げの枠は無い（ふつうの候補）
  const maxed = ['kinun', 'kinun', 'kinun', 'kodou', 'kodou', 'kodou', 'tairin', 'tairin', 'tairin'];
  for (let seed = 1; seed < 50; seed++) { const o = K.offerCharms(seed, 4, maxed); eq(o.length, 3); ok(o.every((id) => !['kinun', 'kodou', 'tairin'].includes(id))); }
  // 型の重み: 金のお守りを持つと、金の型のお守りが出やすい
  const gold = (held) => { let g = 0; for (let seed = 1; seed < 500; seed++) g += K.offerCharms(seed, 4, held).filter((id) => ['ichibanboshi', 'maneki'].includes(id)).length; return g; };
  const withGold = gold(['kinun']), without = gold(['kazekiri']);
  ok(withGold > without * 1.3, `金を持つと金が出やすい ${withGold} / ${without}`);
  // 持っていないお守りは pool の外なら出ないが、持っているお守りの Lv 上げは pool の外でも出る
  const pool = ['kinun', 'kodou', 'tairin'];
  let seenUp = false;
  for (let seed = 1; seed < 80; seed++) { const o = K.offerCharms(seed, 4, ['maneki', 'kinun', 'kodou'], 0, { pool }); ok(o.every((id) => pool.includes(id) || id === 'maneki')); if (o.includes('maneki')) seenUp = true; }
  ok(seenUp, '持っているお守りの Lv 上げは pool の外でも出る');
});

check('お守りの候補（13版）: 型しぼり（opts.focus）は、候補がみんなその型・Lv 上げもその型だけ・選べる型は focusTags', () => {
  for (let seed = 1; seed < 200; seed++) for (const tag of ['gold', 'chain', 'ink', 'finale']) {
    const held = ['kinun', 'nokorizumi', 'kodou', 'osobi'];
    const o = K.offerCharms(seed, 5, held, 0, { focus: tag });
    ok(o.length >= 1 && o.length <= 3, `${tag}: ${o}`);
    ok(o.every((id) => K.charmById(id).tags.includes(tag)), `${tag}: ${o}`);
    eq(new Set(o).size, o.length);
    // その型の持っているお守りは、Lv 上げとして入る（3 種類以上持っているので）
    const mine = held.filter((id) => K.charmById(id).tags.includes(tag));
    if (mine.length) ok(o.some((id) => mine.includes(id)), `${tag}: Lv 上げが無い ${o}`);
    eq(o.join(), K.offerCharms(seed, 5, held, 0, { focus: tag }).join(), '決定的');
  }
  // 型が少なければ数が減る（提灯は 2 つ）。仕掛けが出てくる前の型は選べない
  eq(K.offerCharms(3, 5, [], 0, { focus: 'lantern' }).length, 2);
  eq(K.focusTags(0, []).includes('lantern'), false, '一夜目のあとは、提灯の型は選べない');
  ok(K.focusTags(5, []).includes('lantern'));
  ok(K.focusTags(5, [], { pool: ['kinun'] }).join() === 'gold', 'pool の中だけ');
  // 知らない型は、しぼらない
  eq(K.offerCharms(9, 3, [], 0, { focus: 'nope' }).join(), K.offerCharms(9, 3, []).join());
});

check('お守りの候補（13版）: opts.caps で Lv の上限（伝説の Lv3 を条件つきにする）', () => {
  const pool = K.CHARM_IDS.slice(), held = ['tengu', 'tengu', 'kinun', 'kodou'];
  let up = 0;
  for (let seed = 1; seed < 200; seed++) {
    const o = K.offerCharms(seed, 4, held, 0, { pool, caps: { tengu: 2, kitsune: 0 } });
    eq(o.length, 3);
    ok(!o.includes('tengu'), '上限の Lv2 に届いた天狗は出ない');
    ok(!o.includes('kitsune'), '上限 0 は出ない');
    ok(o.some((id) => ['kinun', 'kodou'].includes(id)), 'Lv 上げの枠は上限の下のものから');
    if (K.offerCharms(seed, 4, held, 0, { pool }).includes('tengu')) up++;
  }
  ok(up > 0, '上限が無ければ天狗の Lv 上げも出る');
  ok(!K.focusTags(4, ['tengu', 'tengu'], { pool: ['tengu'], caps: { tengu: 2 } }).includes('risk'), '型しぼりも上限を守る');
  eq(K.offerCharms(9, 3, [], 0, { caps: {} }).join(), K.offerCharms(9, 3, []).join(), '空の caps は何も変えない');
});

check('はじめのお守り（startOffer）: シードで決まる 3 つ・pool の中・伝説と仕掛けのお守りは出ない・型がなるべく別々', () => {
  const pool = ['kinun', 'kodou', 'tairin', 'chouchinshi', 'mashidama', 'amayoke', 'nokorizumi', 'maneki', 'senkou', 'tengu'];
  const seen = new Set();
  for (let seed = 1; seed < 300; seed++) {
    const o = K.startOffer(seed, pool);
    eq(o.length, 3); eq(new Set(o).size, 3);
    eq(o.join(), K.startOffer(seed, pool).join(), '決定的');
    for (const id of o) { ok(pool.includes(id), id); ok(K.charmById(id).rarity !== 'legend', id); eq(K.charmNeed(id), 0, id); seen.add(id); }
    eq(new Set(o.map((id) => K.charmById(id).tags[0])).size, 3, `型が重なる ${o}`);
  }
  ok(seen.size >= 6, `出るお守り ${[...seen]}`);
  ok(!seen.has('chouchinshi') && !seen.has('amayoke') && !seen.has('tengu'));
  eq(K.startOffer(1).length, 3, 'pool が無ければ、伝説を除いた全部から');
  eq(K.startOffer(1, ['kinun', 'kodou']).length, 2, 'pool が少なければ、あるだけ');
});

check('お守りの候補: 伝説は opts.pool に入れたときだけ・pool の外は出ない・珍しいものほど出にくい・段位 6 から 2 つ', () => {
  const seen = {};
  for (let seed = 1; seed < 600; seed++) for (const night of [3, 5, 6]) {
    const o = K.offerCharms(seed, night, []);
    ok(o.every((id) => K.charmById(id).rarity !== 'legend'), '伝説は、勝つまで出ない');
    for (const id of o) seen[id] = (seen[id] || 0) + 1;
  }
  const avg = (r) => { const ids = K.CHARMS.filter((c) => c.rarity === r && !K.CHARM_NEEDS[c.id]).map((c) => c.id); return ids.reduce((a, id) => a + (seen[id] || 0), 0) / ids.length; };
  ok(avg('rare') < avg('common') * 0.8, `めずらしいものの出やすさ ${avg('rare')} / ふつう ${avg('common')}`);
  const pool = ['kinun', 'kodou', 'tairin', 'tengu', 'kitsune'];
  let leg = 0;
  for (let seed = 1; seed < 300; seed++) {
    const o = K.offerCharms(seed, 3, [], 0, { pool });
    eq(o.length, 3);
    ok(o.every((id) => pool.includes(id)), `pool の外 ${o}`);
    leg += o.filter((id) => K.charmById(id).rarity === 'legend').length;
  }
  ok(leg > 30 && leg < 300 * 3 * 0.4, `伝説の出た数 ${leg}`);
  eq(K.offerCharms(9, 3, [], 0, { level: 6 }).length, 2, '段位 6 は 2 つ');
  eq(K.offerCharms(9, 3, [], 0, { level: 5 }).length, 3);
  eq(K.offerCharms(9, 3, [], 0, { count: 4 }).length, 4);
  eq(K.offerCharms(9, 3, [], 0, { level: 6 }).join(), K.offerCharms(9, 3, [], 0, { count: 2 }).join(), '段位は数だけを変える');
  // 全部 Lv3 なら、候補は出ない
  eq(K.offerCharms(9, 3, ['kinun', 'kinun', 'kinun'], 0, { pool: ['kinun'] }).length, 0);
  // 風切りは、雲が出る夜の前からだけ（段位 4 からは二夜目から雲）
  let early = 0;
  for (let seed = 1; seed < 200; seed++) { ok(!K.offerCharms(seed, 1, []).includes('kazekiri')); if (K.offerCharms(seed, 1, [], 0, { level: 4 }).includes('kazekiri')) early++; }
  ok(early > 0, '段位 4 は風切りが早く出る');
  eq(K.charmNeed('kazekiri', 4), 1); eq(K.charmNeed('kazekiri'), 4); eq(K.charmNeed('kodou'), 0);
});

check('勝負リンク: 戻すと同じ・細工したものは読まない', () => {
  const s = K.encodeDuel(4294967295, 7, 123456);
  eq(JSON.stringify(K.decodeDuel(s)), JSON.stringify({ seed: 4294967295, moon: 7, score: 123456 }));
  eq(K.decodeDuel(K.encodeDuel(12, 3)).score, 0);
  for (const bad of ['', 'x', 'zzzzzzzz.1', 'abc.8', 'abc.1.<b>', null, 'abc.1.1234567890123']) eq(K.decodeDuel(bad), null, String(bad));
});

check('再生リンク: 一筆を戻すと同じ点になる（お守りの Lv・段位・墨壺も入る）・細工したものは読まない', () => {
  const rng = K.rng32(5);
  let banked = 0, leveled = 0, multi = 0;
  for (let i = 0; i < 24; i++) {
    const night = i % K.NIGHTS, moon = i % 8, level = i % 3 === 1 ? Math.floor(rng() * 9) : 0;
    const lv = {};
    for (const id of K.CHARM_IDS) if (rng() < 0.25) lv[id] = 1 + Math.floor(rng() * 3);
    const charms = K.charmList(lv);
    const bank = i % 3 === 0 ? 0 : Math.floor(rng() * (K.BASE_INK + 1));
    const st = K.newRound({ seed: 1000 + i, night, charms, moon, bank, level });
    const used = K.lightStroke(st, line(rng() * 360, 100 + rng() * 400, rng() * 360, 100 + rng() * 400, 50));
    if (!used) continue;
    for (let n = 0; n < 3600 && !st.done; n++) { if (st.phase === 'draw2') K.finish(st); else K.step(st); st.events.length = 0; }
    const code = K.encodeReplay({ seed: 1000 + i, moon, night, charms, strokes: st.strokes, bank, level });
    ok(/^[A-Za-z0-9_-]+$/.test(code) && code.length < 900, `長さ ${code.length}`);
    const back = K.decodeReplay(code);
    ok(back && !back.old, '戻らない');
    eq(JSON.stringify(back.strokes), JSON.stringify(st.strokes));
    eq(back.charms.join(), charms.join());
    eq(back.bank, bank, '墨壺');
    eq(back.level, level, '段位');
    if (bank) banked++;
    if (level) leveled++;
    if (Object.values(lv).some((x) => x > 1)) multi++;
    const again = K.newRound({ seed: back.seed, night: back.night, charms: back.charms, moon: back.moon, bank: back.bank, level: back.level });
    const r2 = K.runToEnd(again, back.strokes, { normalized: true });
    eq(r2.score, st.result.score, '再生で点が変わった');
  }
  ok(banked > 5 && leveled > 3 && multi > 5, `墨壺 ${banked} 段位 ${leveled} Lv2 以上 ${multi}`);
  const s3 = [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]];
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: s3 })).bank, 0, '墨壺を渡さなければ 0');
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: s3 })).level, 0, '段位を渡さなければ 0');
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], bank: 5000, strokes: s3 })).bank, K.BASE_INK, '墨壺は 1 夜ぶんまで');
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: ['kinun', 'kinun', 'kinun', 'kinun'], strokes: s3 })).charms.join(), 'kinun,kinun,kinun', 'Lv3 まで');
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: ['futofude', 'kodou'], strokes: s3 })).charms.join(), 'kodou', '前のお守りは入れない');
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], level: 99, strokes: s3 })).level, K.MAX_LEVEL);
  eq(K.REPLAY_VERSION, 5);
  eq(K.decodeReplay(''), null);
  eq(K.decodeReplay('<script>alert(1)</script>'), null);
  eq(K.decodeReplay('A'.repeat(1000)), null);
  const good = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: s3 });
  eq(K.decodeReplay('A' + good.slice(1)), null, '版が違う');
  eq(K.decodeReplay(good.slice(0, 10)), null, '短い');
  const far = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 400, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  eq(K.decodeReplay(far), null, '画面の外の点');
});

check('共有文: 点と連鎖を言葉で書き、絵文字は見出しの 🎆 だけ・答え（線）は入れない', () => {
  const run = {
    daily: true, key: '2026-09-27', no: 2, moon: 4, total: 123456, bestChain: 58,
    nights: [{ score: 900, target: 80 }, { score: 300, target: 250 }, { score: 100, target: 600 }],
  };
  const ja = K.runShareText(run, 'ja');
  ok(ja.startsWith('🎆一筆花火 #2 9/27 満月\nステージ1 2/8夜 123,456点・最大58連鎖\n'), ja);
  ok(ja.includes(K.HASHTAG), ja);
  const emoji = /\p{Extended_Pictographic}/gu;
  eq((ja.match(emoji) || []).join(''), '🎆', '絵文字は見出しの 1 つだけ');
  const en = K.runShareText({ ...run, daily: false }, 'en');
  ok(en.startsWith('🎆Hitofude Hanabi\nStage 1 · 2/8 nights 123,456 pts · best chain 58\n'), en);
  const all = K.runShareText({ ...run, nights: Array(8).fill({ score: 10, target: 1 }) }, 'ja');
  ok(all.includes('\nステージ1 完走 '), all);
  ok(K.runShareText({ ...run, nights: Array(8).fill({ score: 10, target: 1 }) }, 'en').includes('\nStage 1 clear! '));
});

check('連続記録と上位 %', () => {
  let s = K.nextStreak(null, '2026-09-26');
  s = K.nextStreak(s, '2026-09-27'); eq(s.streak, 2);
  s = K.nextStreak(s, '2026-09-29'); eq(s.streak, 3, '1 日休みを見逃す');
  eq(K.currentStreak(s, '2026-09-30'), 3);
  eq(K.currentStreak(s, '2026-10-05'), 0);
  eq(K.topPercent([1, 1, 1, 1, 1, 0, 0, 0, 0], 2), null, '10 人未満');
  eq(K.topPercent([0, 10, 10, 10, 10, 0, 0, 0, 0], 4), 13);
  eq(K.topPercent([0, 10, 10, 10, 10, 0, 0, 0, 0], 1), 88);
});

check('ならし済みの線: 範囲外・整数でない点は読まない・墨を超えた分は切る', () => {
  const st = K.newRound({ seed: 1, night: 0, moon: 1 });
  eq(K.lightPoints(st, [{ x: 1.5, y: 2 }, { x: 9, y: 2 }, { x: 17, y: 2 }]), null);
  eq(K.lightPoints(K.newRound({ seed: 1, night: 0, moon: 1 }), [{ x: -1, y: 2 }, { x: 9, y: 2 }, { x: 17, y: 2 }]), null);
  const long = Array.from({ length: 120 }, (_, i) => ({ x: (i * 8) % 352, y: 100 + Math.floor((i * 8) / 352) * 20 }));
  const used = K.lightPoints(K.newRound({ seed: 1, night: 0, moon: 1 }), long);
  ok(used && K.pathLength(used) <= K.BASE_INK + 1, `長さ ${used && K.pathLength(used)}`);
});

check('仕掛け: 夜ごとに 1 つずつ増える（一夜目は菊と金だけ）', () => {
  const kinds = (night) => { const st = K.newRound({ seed: 99, night, moon: 1 }); return { types: new Set(st.shells.map((s) => s.type)), clouds: st.clouds.length, ropes: st.ropes.length }; };
  const n0 = kinds(0);
  eq([...n0.types].sort().join(), 'kiku,kin', '一夜目');
  eq(n0.clouds + n0.ropes, 0);
  for (const g of K.GIMMICKS) {
    const before = kinds(g.night - 1), at = kinds(g.night);
    if (g.id === 'kumo') { eq(before.clouds, 0, '雲の前夜'); ok(at.clouds >= 1, '雲が出ない'); continue; }
    if (g.id === 'nawa') { eq(before.ropes, 0, '縄の前夜'); ok(at.ropes >= 1, '縄が出ない'); continue; }
    ok(!before.types.has(g.id), `${g.id} が前の夜に出ている`);
    ok(at.types.has(g.id), `${g.id} が ${g.night} 夜目に出ない`);
  }
  eq(K.gimmickFor(0), null);
  eq(K.gimmickFor(7).id, 'shaku');
  eq(K.newRound({ seed: 99, night: 7, moon: 1 }).shells.filter((s) => s.type === 'shaku').length, 1, '尺玉は 1 つ');
});

check('お守りの候補: 仕掛けが出てくる前の夜には、その仕掛けのお守りを出さない', () => {
  for (let seed = 1; seed < 60; seed++) {
    const o0 = K.offerCharms(seed, 0, []);
    for (const id of ['senrin', 'chouchinshi', 'kazekiri', 'amayoke']) ok(!o0.includes(id), `一夜目の後に ${id}`);
    ok(!K.offerCharms(seed, 3, []).includes('amayoke'), '雨よけは湿った玉の前夜から');
  }
  const later = new Set();
  for (let seed = 1; seed < 200; seed++) K.offerCharms(seed, 6, []).forEach((id) => later.add(id));
  for (const id of ['chouchinshi', 'kazekiri', 'amayoke']) ok(later.has(id), `${id} が一度も出ない`);
});

check('提灯: 灯ったあとにひらいた玉だけ点が 2 倍（線を引く向きで点が変わる）', () => {
  const shells = [{ type: 'chouchin', x: 40, y: 300 }];
  for (let i = 1; i <= 8; i++) shells.push({ type: 'kiku', x: 40 + i * 36, y: 300 });
  const fromLantern = K.runToEnd(handRound(shells.map((x) => ({ ...x }))), [line(30, 300, 340, 300, 80)]);
  const toLantern = K.runToEnd(handRound(shells.map((x) => ({ ...x }))), [line(340, 300, 30, 300, 80)]);
  eq(fromLantern.pops, 9); eq(toLantern.pops, 9);
  ok(fromLantern.chips > toLantern.chips, `提灯から ${fromLantern.chips} / 提灯へ ${toLantern.chips}`);
  eq(fromLantern.chips, 10 + 8 * 10 * 2, '提灯のあとの 8 個が 2 倍');
  const maker = K.runToEnd(handRound(shells.map((x) => ({ ...x })), ['chouchinshi']), [line(30, 300, 340, 300, 80)]);
  eq(maker.chips, 10 + 8 * 10 * (1 + K.MAKER_GAIN), '提灯職人は 2.5 倍');
});

check('湿った玉: 線の火が触れるとひらく。爆発だけなら、別々の火が 2 回いる（同じ火は 1 回と数える）', () => {
  const mk = (charms = []) => { const st = handRound([{ type: 'shime', x: 200, y: 300 }], charms); st.shells[0].hp = st.rules.dampHits; return st; };
  eq(K.runToEnd(mk(), [line(150, 300, 250, 300, 30)]).pops, 1, '線でなぞるとひらく');
  // 線は遠く、爆発だけを当てる
  const boom = (st, list) => {
    K.lightStroke(st, line(20, 600, 60, 600, 10));
    const seen = [];
    for (let i = 0; i < 600 && !st.done; i++) {
      for (const [at, e] of list) if (i === at) st.explosions.push({ t: 0, hue: 0, o: 0, gen: 0, cause: 'test', ...e });
      K.step(st); for (const ev of st.events) seen.push(ev.type); st.events.length = 0;
    }
    return seen;
  };
  const a = mk(), sa = boom(a, [[2, { id: 901, x: 200, y: 330, R: 30 }]]);
  eq(a.result.pops, 0, '爆発 1 回ではひらかない'); ok(sa.includes('dry'), '乾いた知らせ'); eq(a.shells[0].hp, 1);
  const b = mk(); boom(b, [[2, { id: 901, x: 200, y: 330, R: 30 }], [20, { id: 902, x: 230, y: 300, R: 40 }]]);
  eq(b.result.pops, 1, '別々の爆発 2 回でひらく');
  eq(b.shells[0].gen, 1, '爆発でひらいた玉は 1 代目');
  const c = mk(); boom(c, [[2, { id: 901, x: 200, y: 330, R: 30 }], [20, { id: 901, x: 200, y: 330, R: 30 }]]);
  eq(c.result.pops, 0, '同じ火は 2 回と数えない');
  const d = mk(['amayoke']); boom(d, [[2, { id: 901, x: 200, y: 330, R: 30 }]]);
  eq(d.result.pops, 1, '雨よけなら、ふつうの玉と同じ');
});

check('一番星: 線で直接ひらいた金は倍率が上がる（爆発でひらいた金は +1）・遅火: 導火線が遅く、倍率 +2 から', () => {
  const gold = () => [{ type: 'kin', x: 100, y: 300 }, { type: 'kin', x: 100, y: 340 }];
  const a = K.runToEnd(handRound(gold(), ['ichibanboshi']), [line(60, 300, 140, 300, 20)]);
  eq(a.pops, 2); eq(a.mult, 1 + (1 + K.STAR_GOLD) + 1, '線の金 +1 + 一番星・爆発の金 +1');
  const b = K.runToEnd(handRound(gold(), ['ichibanboshi', 'kinun']), [line(60, 300, 140, 300, 20)]);
  eq(b.mult, 1 + (K.KINUN_GOLD + K.STAR_GOLD) + K.KINUN_GOLD, '金運と重なる');
  // 終わり玉の爆発でひらいた金は、線で直接ふれたことにならない（cause は 'end'）
  const e = handRound([{ type: 'kin', x: 200, y: 370 }], ['ichibanboshi', 'owaridama']);
  K.lightStroke(e, line(40, 300, 200, 300));
  let cause = null;
  for (let i = 0; i < 1200 && !e.done; i++) { K.step(e); for (const ev of e.events) if (ev.type === 'burst') cause = ev.cause; e.events.length = 0; }
  eq(cause, 'end'); eq(e.result.mult, 1 + 1);
  // 遅火: 同じ線でも、終わるまでの時間が長い
  const t = (charms) => { const st = handRound([{ type: 'kiku', x: 300, y: 300 }], charms); K.runToEnd(st, [line(20, 300, 300, 300, 70)]); return st; };
  const fast = t([]), slow = t(['osobi']);
  ok(slow.t > fast.t * 1.25, `遅火 ${slow.t.toFixed(2)} 秒 / ふだん ${fast.t.toFixed(2)} 秒`);
  eq(slow.result.mult, 1 + K.SLOW_MULT);
});

check('墨壺と残り墨: bank はその夜の墨に足す・持ちこせるのは残った墨の半分（1 夜ぶんまで）・残り墨は 1 割ごとに倍率 +1', () => {
  const st = K.newRound({ seed: 3, night: 1, moon: 1, bank: 100 });
  eq(st.ink, K.BASE_INK + 100); eq(st.inkTotal, st.ink); eq(st.bank, 100);
  eq(K.newRound({ seed: 3, night: 1, moon: 1, bank: 99999 }).ink, K.BASE_INK * 2, '墨壺は 1 夜ぶんまで');
  eq(K.newRound({ seed: 3, night: 1, moon: 1, bank: -5 }).ink, K.BASE_INK);
  eq(K.newRound({ seed: 3, night: 1, moon: 1, bank: 100 }).target, K.newRound({ seed: 3, night: 1, moon: 1 }).target, '目標点は墨壺に関係しない');
  const mirror = roundWithTwist('kagami', 5);
  eq(K.newRound({ seed: mirror.seed, night: 5, bank: 100 }).ink, Math.round((K.rulesFor([], 4).ink + 100) * K.MIRROR_INK), '鏡の夜は足したあとで 3/4');
  eq(K.inkCarry(st), 0, '線を引く前は持ちこさない');
  const pts = K.lightStroke(st, line(40, 300, 200, 300, 40));
  const used = K.pathLength(pts);
  ok(Math.abs(K.inkUsed(st) - used) < 1e-9);
  eq(K.inkLeft(st), st.inkTotal - used);
  eq(K.inkCarry(st), Math.min(K.BASE_INK, Math.floor(0.5 * (st.inkTotal - used))));
  K.runToEnd(st, []);
  eq(st.result.carry, K.inkCarry(st)); eq(st.result.inkLeft, K.inkLeft(st));
  // 残り墨
  const sp = K.newRound({ seed: 3, night: 1, charms: ['nokorizumi'], moon: 1 });
  eq(K.spareBonus(sp), 0, '線を引く前は数えない');
  const p2 = K.lightStroke(sp, line(40, 300, 140, 300, 20));
  const left = sp.inkTotal - K.pathLength(p2);
  eq(K.spareBonus(sp), Math.floor(left / sp.inkTotal / K.SPARE_STEP + 1e-9));
  ok(K.spareBonus(sp) >= 7, `残り墨 ${K.spareBonus(sp)}`);
  eq(K.multOf(sp), 1 + K.spareBonus(sp) + sp.goldMult + Math.floor(sp.pops / 10));
});

check('雲: 爆発は雲の向こうに届かず、雲の中の線は燃えない', () => {
  const st = handRound([{ type: 'ootama', x: 100, y: 300 }, { type: 'kiku', x: 170, y: 300 }]);
  st.clouds = [{ x: 135, y: 300, r: 20 }];
  const r = K.runToEnd(st, [line(60, 300, 100, 300, 10)]);
  eq(r.pops, 1, '雲の向こうの玉がひらいた');
  const st2 = handRound([{ type: 'kiku', x: 300, y: 300 }]);
  st2.clouds = [{ x: 200, y: 300, r: 30 }];
  eq(K.runToEnd(st2, [line(100, 300, 310, 300, 60)]).pops, 0, '火が雲を抜けた');
  const st3 = handRound([{ type: 'kiku', x: 300, y: 300 }]);
  st3.clouds = [{ x: 100, y: 300, r: 30 }];
  eq(K.runToEnd(st3, [line(100, 300, 310, 300, 60)]).pops, 0, '雲の中から引いた線に火がついた');
});

check('仕掛け縄: 片方の端に火が届くと、縄を走って反対側の玉をひらく', () => {
  const st = K.newRound({ seed: 3, night: 0, moon: 1 });
  st.shells = [{ id: 0, type: 'kiku', x: 60, y: 300, hue: 0, burst: false, burstAt: -1, hp: 1 }, { id: 1, type: 'kiku', x: 300, y: 300, hue: 0, burst: false, burstAt: -1, hp: 1 }];
  const rope = []; for (let x = 60; x <= 300; x += 4) rope.push({ x, y: 300 });
  st.clouds = [];
  // 縄は内部の区間として足す（newRound と同じ道筋）
  const K2 = K.newRound({ seed: 3, night: 6, moon: 1 });
  ok(K2.ropes.length >= 1 && K2.fuse.rope.some((x) => x), '七夜目に縄が無い');
  ok(K2.fuse.pts.every((p) => !K.inCloud(K2.clouds, p.x, p.y)), '縄が雲を通る');
  // 七夜目の縄の端の玉に線で火をつけると、反対の端の玉までひらく
  const r = K2.ropes[0];
  const a = K2.shells.find((s) => s.id === r.a), b = K2.shells.find((s) => s.id === r.b);
  K.lightStroke(K2, line(a.x - 30, a.y, a.x, a.y, 10));
  for (let i = 0; i < 3600 && !K2.done; i++) { if (K2.phase === 'draw2') K.finish(K2); else K.step(K2); K2.events.length = 0; }
  ok(b.burst, '縄の反対側の玉がひらかない');
  void st; void rope;
});

check('大トリ（尺玉）: 線の火でしかひらかない。ひらいた瞬間に、ほかの玉がひらいていた割合の 2 乗で倍率 +1〜+13', () => {
  // 大玉の爆発は尺玉をのみこんでも、ひらかない
  const a = handRound([{ type: 'ootama', x: 140, y: 300 }, { type: 'shaku', x: 200, y: 300 }]);
  const ra = K.runToEnd(a, [line(100, 300, 145, 300, 10)]);
  eq(ra.pops, 1, '爆発では尺玉はひらかない'); eq(a.tori, null);
  // 4 つの菊を先にひらいて、最後に尺玉へ → share 1 → +11
  const row = () => [...[0, 1, 2, 3].map((i) => ({ type: 'kiku', x: 40 + i * 50, y: 300 })), { type: 'shaku', x: 320, y: 300 }];
  const b = handRound(row());
  K.lightStroke(b, line(30, 300, 330, 300, 80));
  let tori = null;
  for (let i = 0; i < 1200 && !b.done; i++) { K.step(b); for (const e of b.events) if (e.type === 'tori') tori = e; b.events.length = 0; }
  ok(tori && tori.share === 1 && tori.add === 1 + K.TORI_BONUS, JSON.stringify(tori && { share: tori.share, add: tori.add }));
  eq(b.result.mult, 1 + 1 + K.TORI_BONUS, '倍率 = 1 + 大トリ');
  eq(b.result.tori.add, tori.add);
  // 尺玉から引きはじめると、まだ何もひらいていない → +1
  const c = handRound(row());
  const rc = K.runToEnd(c, [line(330, 300, 30, 300, 80)]);
  eq(c.tori.share, 0); eq(c.tori.add, 1); eq(rc.mult, 2);
  ok(rc.score < b.result.score / 3, '尺玉を最後にした方が、ずっと高い');
  // 半分ひらいたところで尺玉 → +round(1 + 12 × 0.25) = +4
  const half = handRound([...[0, 1].map((i) => ({ type: 'kiku', x: 40 + i * 50, y: 300 })), { type: 'shaku', x: 200, y: 300 }, ...[0, 1].map((i) => ({ type: 'kiku', x: 300 + i * 0, y: 200 + i * 300 }))]);
  K.runToEnd(half, [line(30, 300, 210, 300, 45)]);
  eq(half.tori.share, 0.5); eq(half.tori.add, Math.round(1 + K.TORI_BONUS * 0.25));
  // 尺玉がひらいても、まわりを一掃しない（ひとりの夜は TORI_R）
  const d = handRound([{ type: 'shaku', x: 200, y: 300 }, { type: 'kiku', x: 200, y: 300 + K.TORI_R + 30 }]);
  eq(K.runToEnd(d, [line(150, 300, 250, 300, 30)]).pops, 1);
});

check('目標点: 目安は夜ごとに上がる・倍率は夜ごとにある', () => {
  eq(K.TARGETS.length, K.NIGHTS);
  for (let i = 1; i < K.TARGETS.length; i++) ok(K.TARGETS[i] > K.TARGETS[i - 1]);
  eq(K.TARGET_RATIO.length, K.NIGHTS);
  // 倍率は七夜目まで上がる（八夜目は、基準点に大トリの倍率が入っているので七夜目より低くてよい）
  for (let i = 1; i < K.NIGHTS - 1; i++) ok(K.TARGET_RATIO[i] > K.TARGET_RATIO[i - 1]);
  for (const r of K.TARGET_RATIO) ok(r > 0);
});

check('目標点: 夜ごとに下がらない（いろいろなシード・月・段位で。大一番でない夜は前の夜の約 1.1 倍以上）', () => {
  let lifted = 0, n = 0;
  for (let seed = 1; seed <= 14; seed++) for (const level of [0, 3, 8]) {
    const moon = (seed * 3 + level) % 8, t = Array.from({ length: K.NIGHTS }, (_, i) => K.targetFor(seed, i, moon, level));
    for (let i = 1; i < K.NIGHTS; i++) {
      n++;
      ok(t[i] >= t[i - 1], `seed ${seed} moon ${moon} 段位 ${level}: ${i} 夜目 ${t[i - 1]} → ${i + 1} 夜目 ${t[i]}`);
      if (!K.isBoss(i)) ok(t[i] >= t[i - 1] * K.TARGET_STEP * 0.95, `seed ${seed} 段位 ${level} night ${i}: ${t[i - 1]} → ${t[i]} は 1.1 倍に足りない`);
      const tw = K.twistFor(seed, i), raw = K.parScore(seed, i, moon, level) * K.TARGET_RATIO[i] * (tw ? tw.target : 1) * K.levelFx(level).target;
      if (t[i] > raw * 1.06 + 10) lifted++;
    }
    eq(K.newRound({ seed, night: 7, moon, level }).target, t[7], 'newRound も同じ目標');
  }
  ok(lifted > 0 && lifted < n * 0.3, `前の夜に合わせて上げた夜 ${lifted}/${n}`);
  eq(K.TARGET_STEP, 1.1);
});

check('目標点: その夜の並びから測る（決定的・上 2 桁に丸める・お守りなしでも届く夜は基準点より下）', () => {
  for (let seed = 1; seed <= 12; seed++) for (let n = 0; n < K.NIGHTS; n++) {
    const moon = seed % 8, par = K.parScore(seed, n, moon), tg = K.targetFor(seed, n, moon);
    ok(par > 0, `seed ${seed} night ${n}: 基準点が 0`);
    eq(K.parScore(seed, n, moon), par, '基準点が決定的でない');
    eq(K.targetFor(seed, n, moon), tg, '目標点が決定的でない');
    eq(K.newRound({ seed, night: n, moon }).target, tg, 'newRound の目標点がずれる');
    ok(tg >= 30, '目標点が小さすぎる');
    ok(String(tg).replace(/0+$/, '').length <= 2, `目標点 ${tg} が上 2 桁に丸まっていない`);
    const tw = K.twistFor(seed, n), f = K.TARGET_RATIO[n] * (tw ? tw.target : 1);
    // 倍率が 1 以下の夜は、お守りなしの手順の線で届く（基準点そのものが、実際に引ける線の点）
    if (f <= 1) ok(tg <= Math.max(30, par * 1.05), `seed ${seed} night ${n}: 目標点 ${tg} が基準点 ${par} を越える`);
  }
  // 月（玉の数）が変われば基準点も変わる
  ok([0, 2, 4, 6].map((m) => K.parScore(7, 7, m)).some((v, i, a) => v !== a[0]), '月で基準点が変わらない');
});

check('夜の景色: 二夜目までは群れ・八夜目は輪・同じ景色は続かない・どの景色でも玉がほぼ全部置ける', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    eq(K.sceneFor(seed, 0).id, 'mure'); eq(K.sceneFor(seed, 1).id, 'mure');
    eq(K.sceneFor(seed, K.NIGHTS - 1).id, 'wa');
    for (let n = 2; n < K.NIGHTS; n++) {
      seen.add(K.sceneFor(seed, n).id);
      if (n > 2) ok(K.sceneFor(seed, n).id !== K.sceneFor(seed, n - 1).id, `seed ${seed} night ${n}: 同じ景色が続く`);
      const rules = K.rulesFor(['mashidama'], 4), a = K.makeLayout(seed, n, rules);
      ok(a.length >= K.BASE_COUNTS[n] + K.MASHI_N - 3, `seed ${seed} night ${n} (${K.sceneFor(seed, n).id}): ${a.length} 個しか置けない`);
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= 27, `seed ${seed} night ${n}: 近すぎる`);
    }
  }
  eq(seen.size, K.SCENES.length, '4 つの景色がどれも出る');
});

check('大一番: 三夜目と六夜目だけ・2 つは別の仕掛け・シードで決まる・目標点は仕掛けに合わせる', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    for (let n = 0; n < K.NIGHTS; n++) eq(!!K.twistFor(seed, n), K.BOSS_NIGHTS.includes(n), `night ${n}`);
    const a = K.twistFor(seed, 2), b = K.twistFor(seed, 5);
    ok(a.id !== b.id, '同じ仕掛けが 2 回');
    eq(K.twistFor(seed, 2).id, a.id, '決定的');
    kinds.add(a.id); kinds.add(b.id);
    // 大一番の目標点は、同じ夜の基準点 × 倍率 × 仕掛けの割り引き（前の夜の目標より下がるときは、前の夜の目標）
    const want = Math.max(K.parScore(seed, 5) * K.TARGET_RATIO[5] * b.target, K.targetFor(seed, 4)), got = K.targetFor(seed, 5);
    ok(Math.abs(got - want) <= want * 0.05 + 5, `seed ${seed}: 大一番の目標点 ${got} ≠ ${want}`);
    eq(K.newRound({ seed, night: 5 }).twist, b.id);
  }
  eq(kinds.size, K.TWISTS.length);
  for (const tw of K.TWISTS) ok(tw.say.length <= 15 && tw.ja && tw.en && tw.desc && tw.descEn, `${tw.id} の文言`);
});

// 仕掛けを指定した夜（シードを探して作る）
function roundWithTwist(id, night = 5) {
  for (let seed = 1; seed < 500; seed++) if (K.twistFor(seed, night) && K.twistFor(seed, night).id === id) return K.newRound({ seed, night });
  throw new Error('見つからない: ' + id);
}
check('大一番「まっすぐ」: ぐねぐね引いても、始まりと指を離した所を結ぶ直線になる（墨の長さまで）', () => {
  const st = roundWithTwist('massugu');
  const zig = [{ x: 40, y: 200 }, { x: 120, y: 320 }, { x: 180, y: 180 }, { x: 260, y: 300 }];
  const pts = K.lightStroke(st, zig);
  ok(pts && pts.length >= 3);
  const a = pts[0], b = pts[pts.length - 1];
  for (const p of pts) { const cross = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y); ok(cross <= 1.5, `直線から ${cross.toFixed(1)} 外れる`); }
  ok(Math.hypot(b.x - 260, b.y - 300) < 12, '指を離した所まで届く');
  const long = K.straighten([{ x: 0, y: 0 }, { x: 5000, y: 0 }], 400);
  eq(Math.round(long[1].x), 400, '墨の長さで切る');
});

check('大一番「鏡」: 墨は 6 割・左右に映した線にも火がつく・再生しても同じ点', () => {
  const st = roundWithTwist('kagami');
  eq(st.ink, Math.round(K.rulesFor([], 4).ink * K.MIRROR_INK));
  K.lightStroke(st, line(40, 150, 120, 150, 20));
  const segs = new Set(st.fuse.seg);
  ok(segs.has(0) && segs.has(20), '映した区間がない');
  const mirrored = st.fuse.pts.filter((_, i) => st.fuse.seg[i] === 20);
  ok(mirrored.every((p) => p.x >= 240), '右側に映っていない');
  ok(st.heads.length >= 2 || st.pops > 0, '両方の端から火がつく');
  const again = roundWithTwist('kagami');
  const r1 = K.runToEnd(again, [st.strokes[0]], { normalized: true });
  const again2 = roundWithTwist('kagami');
  eq(K.runToEnd(again2, [st.strokes[0]], { normalized: true }).score, r1.score, '決定的でない');
});

check('お守りの候補: 同じ種類が 3 つそろわない（倍率・届く玉は 2 つまで、仕掛けへの備えは 1 つまで）', () => {
  for (const c of K.CHARMS) ok(['mult', 'reach', 'gimmick'].includes(c.kind), `${c.id} の種類`);
  let n = 0;
  for (let seed = 1; seed < 300; seed++) for (let night = 0; night < K.NIGHTS - 1; night++) {
    const o = K.offerCharms(seed, night, []);
    eq(o.length, 3); n++;
    const kinds = o.map((id) => K.charmById(id).kind);
    ok(kinds.filter((k) => k === 'gimmick').length <= 1, `seed ${seed} night ${night}: ${o}`);
    ok(new Set(kinds).size >= 2, `seed ${seed} night ${night}: 同じ種類が 3 つ ${o}`);
  }
  ok(n > 1000);
  // 入れかえたお守りは、もう候補に出ずルールにも効かない（前の日の記録を表示するための名前だけ残る）
  for (const id of ['futofude', 'orebi', 'senrin']) {
    ok(!K.CHARM_IDS.includes(id), id);
    const c = K.charmById(id); ok(c && c.legacy && c.ja && c.en, `${id} の名前`);
  }
  eq(JSON.stringify(K.rulesFor(['futofude', 'orebi', 'senrin'], 1)), JSON.stringify(K.rulesFor([], 1)), '前のお守りはルールに効かない');
  eq(K.charmById('nope'), null);
  for (const id of ['nokorizumi', 'ichibanboshi', 'osobi']) ok(K.charmById(id) && !K.charmById(id).legacy, id);
});

check('お守り: 大一番のあとの 2 つ目は、別の並び', () => {
  const a = K.offerCharms(77, 5, ['kodou']), b = K.offerCharms(77, 5, ['kodou', a[0]], 1);
  eq(b.length, 3); eq(new Set(b).size, 3);
  ok(JSON.stringify(a) !== JSON.stringify(K.offerCharms(77, 5, ['kodou'], 1)), '同じ並び');
});

check('筆跡占い: 形で 7 つに分かれる', () => {
  const circle = Array.from({ length: 60 }, (_, i) => ({ x: 180 + Math.cos(i / 59 * Math.PI * 2) * 80, y: 300 + Math.sin(i / 59 * Math.PI * 2) * 80 }));
  const spiral = Array.from({ length: 90 }, (_, i) => { const a = i / 89 * Math.PI * 4.5, r = 20 + i * 1.2; return { x: 180 + Math.cos(a) * r, y: 300 + Math.sin(a) * r }; });
  const zig = Array.from({ length: 50 }, (_, i) => ({ x: 40 + i * 6, y: 300 + ((Math.floor(i / 10) % 2) ? (i % 10) * 12 : 120 - (i % 10) * 12) }));
  const wave = Array.from({ length: 50 }, (_, i) => ({ x: 30 + i * 6, y: 300 + Math.sin(i / 49 * Math.PI * 4) * 30 }));
  const T = (pts, o) => K.strokeType(K.normalizeStroke(pts, 460), o).id;
  eq(T(line(40, 300, 320, 320)), 'massugu');
  eq(T(circle), 'wa');
  eq(T(spiral), 'uzumaki');
  eq(T(zig), 'inazuma');
  eq(T(wave), 'nami');
  eq(T(line(100, 300, 180, 300), { ink: 460, pops: 20, total: 24 }), 'nyuukon');
  eq(K.STROKE_TYPES.length, 7);
});

check('シェア: 筆跡と大一番の結果が 1 行で入る', () => {
  const run = { daily: true, key: '2026-09-27', no: 2, moon: 4, total: 12345, bestChain: 30, type: 'inazuma',
    nights: [{ score: 100, target: 60 }, { score: 300, target: 200 }, { score: 900, target: 600, twist: 'kagami' }, { score: 100, target: 2500 }] };
  const ja = K.runShareText(run, 'ja'), en = K.runShareText(run, 'en');
  ok(ja.includes('\n筆跡「稲妻」・大一番「鏡」成功\n'), ja);
  ok(en.includes('Stroke: Lightning · Boss Mirror cleared'), en);
  eq((ja.match(/\p{Extended_Pictographic}/gu) || []).join(''), '🎆', '筆跡と大一番に絵文字を付けない');
  ok(!K.runShareText({ ...run, type: null, nights: [{ score: 100, target: 60 }] }, 'ja').includes('大一番'));
});

check('再生リンク: 前の版（1・2・3・4）のリンクは「前の版」とわかる', () => {
  const code = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  // 先頭の 1 文字 = 版 4 ビット + シードの上 2 ビット。E は版 1、I は版 2、M は版 3、Q は版 4（12版。お守りの数字が違うので、同じ夜を作れない）
  for (const head of ['E', 'I', 'M', 'Q']) { const d = K.decodeReplay(head + code.slice(1)); ok(d && d.old, `${head}: ${JSON.stringify(d)}`); }
  eq(code[0], 'U', '今の版（5）は U から始まる（シードの上 2 ビットが 0 のとき）');
  ok(!K.decodeReplay(code).old, '今の版は読める');
  eq(K.decodeReplay('Y' + code.slice(1)), null, 'まだ無い版（6）は読まない');
  // 段位は 8 まで（9 以上は細工）。段位は 43 ビット目から 4 ビット
  const bits = [...code].map((ch) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(ch).toString(2).padStart(6, '0')).join('');
  const bad = bits.slice(0, 42) + '1111' + bits.slice(46);
  const enc = bad.match(/.{1,6}/g).map((b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[parseInt(b.padEnd(6, '0'), 2)]).join('');
  eq(K.decodeReplay(enc), null, '段位 15');
});

check('散ったときのヒント: 夜の様子から、効きそうなことを 1 つ選ぶ', () => {
  const H = (shells, stroke, setup) => { const st = handRound(shells); if (setup) setup(st); K.runToEnd(st, [stroke]); return K.failHint(st).id; };
  const far = [{ type: 'kiku', x: 320, y: 80 }, { type: 'kiku', x: 300, y: 90 }];
  // 雲の中から引きはじめた
  eq(H([{ type: 'kiku', x: 150, y: 300 }], line(100, 300, 300, 300), (st) => { st.clouds = [{ x: 100, y: 300, r: 30 }]; }), 'cloudStart');
  // 提灯が灯らなかった
  eq(H([{ type: 'kiku', x: 120, y: 300 }, { type: 'chouchin', x: 330, y: 560 }], line(60, 300, 200, 300)), 'lantern');
  // あと 2 つで満開
  eq(H([{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 150, y: 300 }, { type: 'kiku', x: 240, y: 300 }, ...far], line(40, 300, 400, 300, 60)), 'almost');
  // 墨が余った（短い線）
  eq(H([{ type: 'kiku', x: 60, y: 300 }, ...far, { type: 'kiku', x: 200, y: 500 }, { type: 'kiku', x: 250, y: 500 }], line(40, 300, 90, 300, 8)), 'ink');
  // 大一番は、その夜のコツ
  const st = roundWithTwist('kagami'); K.runToEnd(st, [line(40, 150, 90, 150, 8)]);
  eq(K.failHint(st).id, 'twist_kagami');
  eq(K.failHint(roundWithTwist('massugu')).id, 'twist_massugu');
  // 尺玉が残った／尺玉を先にひらいてしまった
  eq(H([{ type: 'kiku', x: 60, y: 300 }, { type: 'shaku', x: 200, y: 450 }, ...far], line(40, 300, 100, 300)), 'shaku');
  const early = handRound([{ type: 'shaku', x: 60, y: 300 }, ...[1, 2, 3, 4, 5].map((i) => ({ type: 'kiku', x: 60 + i * 50, y: 300 })), ...far]);
  K.runToEnd(early, [line(40, 300, 330, 300, 60)]);
  const h = K.failHint(early);
  eq(h.id, 'toriEarly'); ok(h.share < 0.6 && h.add >= 1, JSON.stringify(h));
  // 「あと少しで満開」は、満開の倍率も返す
  const al = handRound([{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 150, y: 300 }, { type: 'kiku', x: 240, y: 300 }, ...far], ['mankai']);
  K.runToEnd(al, [line(40, 300, 400, 300, 60)]);
  eq(JSON.stringify(K.failHint(al)), JSON.stringify({ id: 'almost', n: 2, bloom: 3 }));
});

check('ステージ: 今は八夜の1ステージだけ遊べて、次のステージは準備中として一覧にある', () => {
  eq(K.STAGES[0].id, 1);
  eq(K.STAGES[0].ja, '川辺の夏祭り');
  eq(K.STAGES[0].nights, 8);
  eq(K.STAGES[0].ready, true);
  eq(K.NIGHTS, K.STAGES[0].nights, '夜の数はステージ1から取る');
  eq(K.STAGE.id, 1, '今遊ぶのはステージ1');
  ok(K.STAGES.length >= 2 && K.STAGES[1].id === 2 && K.STAGES[1].ready === false, 'ステージ2は準備中');
  eq(K.nextStage(1).id, 2);
  eq(K.nextStage(K.STAGES[K.STAGES.length - 1].id), null, '最後のステージの次は無い');
});

check('ステージの完走記録: 初めて完走した日は残し、最高点だけ更新する', () => {
  const a = K.recordStageClear({}, 1, 5000, '2026-09-26');
  eq(JSON.stringify(a), JSON.stringify({ 1: { first: '2026-09-26', best: 5000 } }));
  const b = K.recordStageClear(a, 1, 4000, '2026-09-27');
  eq(JSON.stringify(b), JSON.stringify({ 1: { first: '2026-09-26', best: 5000 } }), '低い点では変えない');
  const c = K.recordStageClear(b, 1, 9000, '2026-09-28');
  eq(JSON.stringify(c), JSON.stringify({ 1: { first: '2026-09-26', best: 9000 } }));
  eq(JSON.stringify(a), JSON.stringify({ 1: { first: '2026-09-26', best: 5000 } }), 'もとの記録は書き換えない');
  eq(JSON.stringify(K.recordStageClear(null, 1, 10, '2026-09-26')), JSON.stringify({ 1: { first: '2026-09-26', best: 10 } }), '記録が無くても作る');
});

// ---------------------------------------------------------------- 12版: お守りの Lv・新しいお守り・点の内訳・段位・願い札
// 手で並べた夜を最後まで回し、知らせも集める
function runHand(shells, charms, stroke, { moon = 1, clouds = null, strokes2 = null } = {}) {
  const st = handRound(shells, charms, moon);
  if (clouds) st.clouds = clouds;
  st.stats = { ...st.stats }; // 手で並べた玉の数は finish で数え直す
  const ev = [];
  K.lightStroke(st, stroke);
  for (let i = 0; i < 3600 && !st.done; i++) {
    if (st.phase === 'draw2') { if (strokes2) K.lightStroke(st, strokes2); else K.finish(st); }
    K.step(st); ev.push(...st.events); st.events.length = 0;
  }
  if (!st.done) K.finish(st);
  return { st, res: st.result, ev };
}
const part = (res, id, kind) => res.parts.find((p) => p.id === id && (!kind || p.kind === kind));
// 点の内訳から点を作り直す（ドキュメントの式そのまま）
function rebuild(parts) {
  let C = 0, M = 0, X = 1;
  for (const p of parts) { if (p.kind === 'chips') C += p.v; else if (p.kind === 'mult') M += p.v; else if (p.kind === 'xmult') X *= p.v; else throw new Error('kind ' + p.kind); }
  return { C, M, X, score: Math.round(C * M * X) };
}

check('点の内訳: chips の合計 × mult の合計 × xmult の積 を丸めると、いつも result.score（いろいろなお守り・Lv・月・段位で）', () => {
  const rng = K.rng32(99);
  let xs = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const night = i % K.NIGHTS, moon = (i * 3) % 8, level = i % 4 === 0 ? 8 : i % 4 === 1 ? 4 : 0;
    const lv = {};
    for (const id of K.CHARM_IDS) if (rng() < 0.3) lv[id] = 1 + Math.floor(rng() * 3);
    const st = K.newRound({ seed: 500 + i, night, charms: K.charmList(lv), moon, level, bank: Math.floor(rng() * 200) });
    const res = K.runToEnd(st, [line(20 + rng() * 320, 100 + rng() * 400, 20 + rng() * 320, 100 + rng() * 400, 40)]);
    if (!res) continue;
    n++;
    const b = rebuild(res.parts);
    eq(b.score, res.score, `seed ${500 + i}: 作り直した点`);
    eq(b.C, res.chips, 'chips'); eq(b.M, res.mult, 'mult'); eq(b.X, res.xmult, 'xmult');
    ok(Number.isInteger(b.C) && Number.isInteger(b.M), '足し算の部分は整数');
    eq(b.M, K.multOf(st), 'multOf は mult の合計');
    eq(JSON.stringify(K.scoreParts(st).parts), JSON.stringify(res.parts), '終わったあとの scoreParts は同じ');
    for (const p of res.parts) {
      ok(p.ja && p.en && p.v && ['chips', 'mult', 'xmult'].includes(p.kind), JSON.stringify(p));
      if (p.kind === 'xmult') eq(Math.round(p.v * 100) / 100, p.v, '掛け算は小数 2 桁');
    }
    eq(res.parts.filter((p) => p.id === 'base').length, 1, '基本の倍率 1 は 1 回');
    // 点の合計（墨流しをのぞく）は、燃えながら数えた chips と同じ
    eq(res.parts.filter((p) => p.kind === 'chips' && p.id !== 'suminagashi').reduce((a, p) => a + p.v, 0), st.chips);
    if (res.parts.some((p) => p.kind === 'xmult')) xs++;
  }
  ok(n > 30 && xs > 10, `夜 ${n}・掛け算 ${xs}`);
  // お守りなしの夜も、内訳は 玉・倍率 1・10 個ごと・金 などに分かれる
  const { res } = runHand(Array.from({ length: 10 }, (_, i) => ({ type: i === 0 ? 'kin' : 'kiku', x: 30 + i * 30, y: 300 })), [], line(20, 300, 340, 300, 80));
  eq(res.parts.map((p) => `${p.id}:${p.kind}:${p.v}`).join(' '), 'shells:chips:95 base:mult:1 gold:mult:1 pulse:mult:1 bloom:xmult:2');
  eq(res.score, 95 * 3 * 2);
});

check('新しいお守り: 招き猫は金の玉ごとに掛け算が重なる（×3 まで。Lv3 は金の玉が増える）', () => {
  const gold = () => [{ type: 'kin', x: 100, y: 300 }, { type: 'kin', x: 160, y: 300 }, { type: 'kiku', x: 300, y: 500 }];
  const { res, ev } = runHand(gold(), ['maneki'], line(80, 300, 180, 300, 30));
  const x2 = Math.round(K.CHARM_LV.maneki.x[0] ** 2 * 100) / 100;
  eq(part(res, 'maneki').v, x2, 'Lv1 × Lv1');
  eq(part(res, 'maneki').kind, 'xmult');
  ok(ev.some((e) => e.type === 'lucky' && e.n === 2 && e.x === x2), '招き猫の知らせ');
  eq(res.score, Math.round(10 * 3 * x2));
  // ×3 まで: 金の玉が 10 個並んでも ×3
  const many = runHand(Array.from({ length: 10 }, (_, i) => ({ type: 'kin', x: 30 + i * 30, y: 300 })), ['maneki', 'maneki', 'maneki'], line(20, 300, 340, 300, 80));
  eq(part(many.res, 'maneki').v, K.MANEKI_CAP); eq(K.MANEKI_CAP, 3);
  ok(many.ev.filter((e) => e.type === 'lucky').every((e) => e.x <= 3), '知らせも ×3 まで');
  eq(K.manekiX(1.2, 2), 1.44); eq(K.manekiX(1.2, 20), 3);
  const n = (charms) => K.newRound({ seed: 8, night: 4, charms, moon: 1 }).shells.filter((s) => s.type === 'kin').length;
  for (let l = 1; l <= 3; l++) eq(n(Array(l).fill('maneki')), n([]) + K.CHARM_LV.maneki.gold[l - 1], `Lv${l} の金の玉`);
  ok(K.CHARM_LV.maneki.gold[2] >= 1, 'Lv3 は金の玉が増える');
  // 足した金の玉は、もとの並び・縄を変えない
  const a = K.newRound({ seed: 8, night: 6, moon: 1 }), b = K.newRound({ seed: 8, night: 6, charms: ['maneki', 'maneki', 'maneki', 'mashidama'], moon: 1 });
  eq(b.shells.slice(0, a.shells.length).map((s) => `${s.type}${s.x},${s.y}`).join(), a.shells.map((s) => `${s.type}${s.x},${s.y}`).join());
  eq(JSON.stringify(b.ropes), JSON.stringify(a.ropes));
  ok(b.shells.slice(a.shells.length).every((s) => s.extra), '足した玉には extra');
});

check('新しいお守り: 花筏は提灯ひとつで倍率が上がる・提灯職人の Lv で提灯の倍率が上がる', () => {
  const shells = () => [{ type: 'chouchin', x: 40, y: 300 }, ...[1, 2, 3, 4].map((i) => ({ type: 'kiku', x: 40 + i * 60, y: 300 }))];
  for (const [l, add] of [[1, K.CHARM_LV.hanaikada.mult[0]], [2, K.CHARM_LV.hanaikada.mult[1]], [3, K.CHARM_LV.hanaikada.mult[2]]]) {
    const { res } = runHand(shells(), Array(l).fill('hanaikada'), line(30, 300, 290, 300, 60));
    eq(part(res, 'hanaikada').v, add, `Lv${l}`);
  }
  for (const [l, f] of [1, 2, 3].map((l) => [l, 1 + K.CHARM_LV.chouchinshi.gain[l - 1]])) {
    const { res } = runHand(shells(), Array(l).fill('chouchinshi'), line(30, 300, 290, 300, 60));
    eq(res.chips, 10 + 4 * 10 * f, `提灯職人 Lv${l}`);
    eq(part(res, 'lantern').v, 40, 'ふだんの提灯の分');
    eq(part(res, 'chouchinshi').v, 4 * 10 * (f - 2), '提灯職人で増えた分');
  }
  // 金の玉（5 点）× 2.5 は丸める
  const { res } = runHand([{ type: 'chouchin', x: 40, y: 300 }, { type: 'kin', x: 100, y: 300 }], ['chouchinshi'], line(30, 300, 110, 300, 20));
  eq(res.chips, 10 + Math.round(5 * 2.5));
});

check('新しいお守り: 連獅子は連鎖の深さ（代）ごとに掛け算・大輪の Lv で連鎖がもっと続く', () => {
  const base = rowChain(['renjishi']);
  const g = base.st.maxGen;
  ok(g >= 3, `深さ ${g}`);
  eq(part(base.st.result, 'renjishi').v, Math.round((1 + K.CHARM_LV.renjishi.x[0] * g) * 100) / 100);
  eq(base.st.result.maxGen, g); eq(base.st.stats.maxGen, g);
  const r3 = rowChain(['renjishi', 'renjishi', 'renjishi']).st;
  eq(part(r3.result, 'renjishi').v, Math.round((1 + K.CHARM_LV.renjishi.x[2] * r3.maxGen) * 100) / 100, 'Lv3');
  eq(K.rulesFor(['tairin', 'tairin'], 1).decay, K.SOFT_DECAYS[K.CHARM_LV.tairin.soft[1]]);
  eq(K.rulesFor(['tairin', 'tairin', 'tairin'], 4).decay, K.SOFT_DECAYS[K.CHARM_LV.tairin.soft[2] + K.MOON_SOFT], '大輪 Lv3 と満月');
  ok(K.rulesFor(['tairin', 'tairin', 'tairin'], 1).decay > K.rulesFor(['tairin'], 1).decay);
  eq(K.rulesFor(['kodou', 'kodou', 'kodou'], 1).chainPulse, K.CHARM_LV.kodou.step[2], '鼓動 Lv3');
  ok(K.CHARM_LV.kodou.step[2] <= K.CHARM_LV.kodou.step[1] && K.CHARM_LV.kodou.step[1] < K.KODOU_STEP);
});

check('新しいお守り: 墨流しは残した墨で点が増え、線香花火は墨が減るかわりに掛け算', () => {
  const shells = () => [{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 90, y: 300 }];
  const { st, res } = runHand(shells(), ['suminagashi'], line(50, 300, 100, 300, 10));
  const steps = K.spareSteps(st);
  ok(steps >= 8, `残した段 ${steps}`);
  eq(part(res, 'suminagashi').v, Math.round(20 * steps * K.CHARM_LV.suminagashi.pct[0]));
  eq(res.chips, 20 + part(res, 'suminagashi').v);
  const r3 = runHand(shells(), ['suminagashi', 'suminagashi', 'suminagashi'], line(50, 300, 100, 300, 10)).res;
  eq(part(r3, 'suminagashi').v, Math.round(20 * steps * K.CHARM_LV.suminagashi.pct[2]), 'Lv3');
  // 残り墨と同じ段で数える
  const both = runHand(shells(), ['suminagashi', 'nokorizumi', 'nokorizumi'], line(50, 300, 100, 300, 10)).res;
  eq(part(both, 'nokorizumi').v, steps * 2, '残り墨 Lv2 は 1 段 +2');
  eq(K.rulesFor(['senkou'], 1).ink, Math.round(K.BASE_INK * 0.7));
  eq(K.rulesFor(['senkou', 'nagafude'], 1).ink, Math.round(K.BASE_INK * K.CHARM_LV.nagafude.ink[0] * 0.7));
  // 線香花火は、その夜の墨を 8 割以上使ったときだけ（短い線では掛け算なし）
  const ink = K.rulesFor(['senkou'], 1).ink, longLine = line(20, 300, 20 + ink * 0.9, 300, 60);
  for (const [l, x] of [1, 2, 3].map((l) => [l, K.CHARM_LV.senkou.x[l - 1]])) {
    eq(part(runHand(shells(), Array(l).fill('senkou'), longLine).res, 'senkou').v, x, `Lv${l}`);
    eq(part(runHand(shells(), Array(l).fill('senkou'), line(50, 300, 100, 300, 10)).res, 'senkou'), undefined, `Lv${l} 短い線`);
  }
  eq(K.SENKOU_USE, 0.8);
  eq(K.rulesFor(['nagafude', 'nagafude', 'nagafude'], 1).ink, Math.round(K.BASE_INK * K.CHARM_LV.nagafude.ink[2]), '長い筆 Lv3');
});

check('伝説: 天狗の団扇はまっすぐな線ほど掛け算（ぐねぐねなら無し）', () => {
  const sh = () => [{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 300, y: 300 }];
  const straight = runHand(sh(), ['tengu'], line(40, 300, 320, 300, 60)).res;
  eq(part(straight, 'tengu').v, K.CHARM_LV.tengu.x[0]);
  const zig = [{ x: 40, y: 300 }, { x: 80, y: 360 }, { x: 120, y: 300 }, { x: 160, y: 360 }, { x: 200, y: 300 }, { x: 240, y: 360 }];
  ok(K.straightness(K.normalizeStroke(zig, 460)) < 0.7);
  eq(part(runHand(sh(), ['tengu'], zig).res, 'tengu'), undefined, 'ぐねぐね');
  eq(part(runHand(sh(), ['tengu', 'tengu', 'tengu'], line(40, 300, 320, 300, 60)).res, 'tengu').v, K.CHARM_LV.tengu.x[2], 'Lv3');
  eq(K.straightness(line(0, 0, 100, 0, 10)), 1);
});

check('伝説: 狸の葉っぱは線の前の部分が左右の反対側に映って燃える（墨はいらない）・鏡の夜は墨が減らない', () => {
  // 左に線、右（映った所）に玉
  const sh = () => [{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 300, y: 300 }];
  const without = runHand(sh(), [], line(40, 300, 140, 300, 25));
  eq(without.res.pops, 1);
  const { st, res } = runHand(sh(), ['tanuki'], line(40, 300, 140, 300, 25));
  eq(res.pops, 2, '映った線が右の玉をひらく');
  ok(st.fuse.seg.includes(30), '写しの区間');
  const n = st.fuse.seg.filter((x) => x === 30).length, main = st.fuse.seg.filter((x) => x === 0).length;
  eq(n, Math.max(2, Math.round(main * K.CHARM_LV.tanuki.part[0])), "前の 6 割");
  ok(Math.abs(K.inkUsed(st) - K.pathLength(st.strokes[0])) < 1e-9, '写しは墨を使わない');
  eq(res.stats.lineTouched, 2, '写しの火も線の火');
  // 鏡の夜: 狸の葉っぱがあると墨は 3/4 にならない
  for (let seed = 1; seed < 500; seed++) if (K.twistFor(seed, 5).id === 'kagami') {
    eq(K.newRound({ seed, night: 5, charms: ['tanuki'] }).ink, K.rulesFor(['tanuki'], 4).ink);
    eq(K.newRound({ seed, night: 5 }).ink, Math.round(K.rulesFor([], 4).ink * K.MIRROR_INK));
    break;
  }
});

check('伝説: 狐火ははじめにひらいた玉から、遠くの群れへ飛んでひらく（Lv で本数が増える）', () => {
  const sh = () => [{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 300, y: 200 }, { type: 'kiku', x: 300, y: 230 }, { type: 'kiku', x: 320, y: 215 }, { type: 'kiku', x: 300, y: 560 }];
  const without = runHand(sh(), [], line(40, 300, 70, 300, 8));
  eq(without.res.pops, 1);
  const { res, ev } = runHand(sh(), ['kitsune'], line(40, 300, 70, 300, 8));
  const fox = ev.filter((e) => e.type === 'fox');
  ok(fox.length >= 1, '狐火が飛ぶ');
  ok([1, 2, 3].includes(fox[0].shell.id), `いちばん混んだ群れへ ${fox[0].shell.id}`);
  ok(ev.some((e) => e.type === 'foxHit'), '届いた');
  ok(res.pops >= 4, `狐火で群れがひらく ${res.pops}`);
  ok(res.chainPops >= 3, '狐火でひらいた玉は連鎖');
  eq(K.rulesFor(['kitsune', 'kitsune', 'kitsune'], 1).foxfire, K.CHARM_LV.kitsune.n[2]);
  // 尺玉には飛ばない
  const t = runHand([{ type: 'kiku', x: 60, y: 300 }, { type: 'shaku', x: 300, y: 300 }], ['kitsune'], line(40, 300, 70, 300, 8));
  ok(!t.ev.some((e) => e.type === 'fox'), '尺玉へは飛ばない'); eq(t.res.pops, 1);
});

check('伝説: 鎌鼬の爪は導火線が速く、連鎖が少し小さく、掛け算', () => {
  const r = K.rulesFor(['kamaitachi'], 1);
  eq(r.fuseSpeed, 1.6); ok(Math.abs(r.decay - (K.DECAY - 0.04)) < 1e-12);
  eq(K.rulesFor(['kamaitachi', 'osobi'], 1).fuseSpeed, K.SLOW_FUSE * 1.6, '遅火と打ち消しあう');
  const t = (charms) => { const st = handRound([{ type: 'kiku', x: 300, y: 300 }], charms); K.runToEnd(st, [line(20, 300, 300, 300, 70)]); return st; };
  ok(t(['kamaitachi']).t < t([]).t, '速い');
  eq(part(t(['kamaitachi', 'kamaitachi']).result, 'kamaitachi').v, K.CHARM_LV.kamaitachi.x[1]);
});

check('お守りの Lv: 終わり玉・遅火・二筆目・残り火・雨よけ・風切り・満開の加護・一番星・金運', () => {
  const OW = K.CHARM_LV.owaridama;
  eq(K.rulesFor(['owaridama'], 1).endR, K.OWARI_R); eq(OW.R[0], K.OWARI_R);
  eq(K.rulesFor(['owaridama', 'owaridama'], 1).endR, OW.R[1]); eq(K.rulesFor(['owaridama', 'owaridama', 'owaridama'], 1).toriPlus, OW.tori[2]);
  // 終わり玉 Lv2 の大トリ +2（尺玉を最後に）
  const row = () => [...[0, 1, 2, 3].map((i) => ({ type: 'kiku', x: 40 + i * 50, y: 300 })), { type: 'shaku', x: 320, y: 300 }];
  const o2 = runHand(row(), ['owaridama', 'owaridama'], line(30, 300, 330, 300, 80));
  eq(o2.st.tori.add, 1 + K.TORI_BONUS + OW.tori[1]); eq(part(o2.res, 'owaridama').v, OW.tori[1]); eq(part(o2.res, 'tori').v, 1 + K.TORI_BONUS);
  eq(o2.res.stats.toriAdd, 1 + K.TORI_BONUS + OW.tori[1]);
  ok(o2.ev.some((e) => e.type === 'endBurst' && e.R === OW.R[1]), '線の終わりが爆発で燃えても、終わり玉は爆ぜる');
  eq(K.rulesFor(['osobi', 'osobi', 'osobi'], 1).startMult, K.CHARM_LV.osobi.mult[2]);
  eq(K.rulesFor(['osobi', 'osobi'], 5).startMult, 1 + K.CHARM_LV.osobi.mult[1], '寝待月と遅火 Lv2');
  const n3 = K.rulesFor(['nihitsu', 'nihitsu', 'nihitsu'], 1); eq(n3.secondShare, K.CHARM_LV.nihitsu.share[2]); eq(n3.secondInk, K.CHARM_LV.nihitsu.ink[2]);
  eq(K.rulesFor(['nokoribi', 'nokoribi', 'nokoribi'], 1).afterglow, K.CHARM_LV.nokoribi.p[2]);
  eq(K.rulesFor(['kinun', 'kinun', 'kinun'], 1).goldBonus, K.CHARM_LV.kinun.gold[2]); eq(K.rulesFor(['ichibanboshi', 'ichibanboshi', 'ichibanboshi'], 1).fuseGold, K.CHARM_LV.ichibanboshi.gold[2]);
  // 雨よけ: 湿った玉の点が Lv ごとに増え、Lv2 から倍率も
  const damp = () => [{ type: 'shime', x: 100, y: 300 }, { type: 'shime', x: 160, y: 300 }];
  const AM = K.CHARM_LV.amayoke;
  for (let l = 1; l <= 3; l++) {
    const r = runHand(damp(), Array(l).fill('amayoke'), line(80, 300, 180, 300, 30)).res;
    eq(r.chips, 2 * Math.round(25 * AM.pts[l - 1]), `雨よけ Lv${l} の点`); eq(part(r, 'amayoke', 'chips').v, 2 * Math.round(25 * (AM.pts[l - 1] - 1)));
    eq(part(r, 'amayoke', 'mult') ? part(r, 'amayoke', 'mult').v : 0, 2 * AM.mult[l - 1], `雨よけ Lv${l} の倍率`);
  }
  // 風切り: 雲の大きさと、雲ひとつの倍率
  const full = K.newRound({ seed: 4, night: 6, moon: 1 }).clouds;
  ok(full.length === 2);
  const k2 = K.newRound({ seed: 4, night: 6, moon: 1, charms: ['kazekiri', 'kazekiri'] });
  k2.clouds.forEach((c, i) => eq(c.r, Math.round(full[i].r * 0.25)));
  eq(K.newRound({ seed: 4, night: 6, moon: 1, charms: ['kazekiri', 'kazekiri', 'kazekiri'] }).clouds.length, 0, 'Lv3 は雲が消える');
  eq(K.multOf(k2), 1 + K.CHARM_LV.kazekiri.mult[1] * 2, '雲 2 つ × Lv2 の倍率');
  // 満開の加護: 9 割で ×1.5（全部でなくても）
  const ten = () => Array.from({ length: 10 }, (_, i) => ({ type: 'kiku', x: 30 + i * 30, y: i === 9 ? 560 : 300 }));
  const m1 = runHand(ten(), ['mankai'], line(20, 300, 300, 300, 70)).res;
  eq(m1.pops, 9); eq(part(m1, 'mankai').v, 1.5); eq(part(m1, 'bloom'), undefined); eq(m1.bloom, 1);
  const two = Array.from({ length: 10 }, (_, i) => ({ type: 'kiku', x: 40 + (i % 5) * 30, y: i < 5 ? 300 : 520 }));
  const m0 = runHand(two, ['mankai'], line(20, 300, 180, 300, 40)).res;
  eq(m0.pops, 5); eq(part(m0, 'mankai'), undefined, '9 割に届かない');
  const all = runHand(ten().slice(0, 9), ['mankai'], line(20, 300, 300, 300, 70)).res;
  eq(all.bloom, 3, '全部なら ×2 × 1.5');
});

// ---------------------------------------------------------------- 13版: Lv3 で変わるふるまい・墨の数え方
const L3 = (id) => [id, id, id], L2 = (id) => [id, id];
const burstOf = (ev, type) => ev.filter((e) => e.type === 'burst' && e.shell.type === type);
// 手で並べた夜を回し、出た火花の数も数える
function runSparks(shells, charms, stroke) {
  const st = handRound(shells, charms); st.stats = { ...st.stats };
  K.lightStroke(st, stroke);
  const ids = new Set(), ev = [];
  for (let i = 0; i < 3600 && !st.done; i++) { if (st.phase === 'draw2') K.finish(st); K.step(st); for (const sp of st.sparks) ids.add(sp.id); ev.push(...st.events); st.events.length = 0; }
  if (!st.done) K.finish(st);
  return { st, res: st.result, sparks: ids.size, ev };
}
// 火花の向き（玉の番号 0 なら、0 度から 45 度ごと）にそろえた 8 つの輪
const ring = (cx, cy, r = 100, n = 8) => Array.from({ length: n }, (_, i) => ({ type: 'kiku', x: Math.round(cx + Math.cos(i / n * Math.PI * 2) * r), y: Math.round(cy + Math.sin(i / n * Math.PI * 2) * r) }));

check('Lv3: 長い筆は線が雲の中でも燃える（届く幅も広い）・残り墨は半分残すと ×1.5・大輪は 3 代目まで小さくならない', () => {
  eq(K.rulesFor(L2('nagafude'), 1).reach, K.BASE_REACH * K.CHARM_LV.nagafude.reach[1]); eq(K.rulesFor(L3('nagafude'), 1).reach, K.BASE_REACH * K.CHARM_LV.nagafude.reach[2]);
  const off = () => [{ type: 'kiku', x: 120, y: 321 }];
  eq(runHand(off(), L2('nagafude'), line(40, 300, 200, 300, 40)).res.pops, 0, 'Lv2 は届かない');
  eq(runHand(off(), L3('nagafude'), line(40, 300, 200, 300, 40)).res.pops, 1, 'Lv3 は線から離れた玉に届く');
  // 雲を横切る線: Lv2 は雲で火が止まり、Lv3 は向こうの玉まで燃える（爆発は雲を越えない）
  const cl = [{ x: 200, y: 300, r: 30 }], far = () => [{ type: 'kiku', x: 300, y: 300 }];
  eq(runHand(far(), L2('nagafude'), line(100, 300, 310, 300, 60), { clouds: cl }).res.pops, 0);
  const c3 = runHand(far(), L3('nagafude'), line(100, 300, 310, 300, 60), { clouds: cl });
  eq(c3.res.pops, 1, '長い筆 Lv3 は雲を通る'); eq(c3.res.stats.cloudTouched, true, '雲にはふれた');
  // 線でじかにふれた玉は大きくひらく（爆発でひらいた玉は、ふつうの大きさ）
  const big = runHand([{ type: 'kiku', x: 100, y: 300 }, { type: 'kiku', x: 140, y: 300 }], L3('nagafude'), line(80, 300, 104, 300, 6));
  const b0 = burstOf(big.ev, 'kiku');
  eq(b0[0].R, K.SHELLS.kiku.R * K.CHARM_LV.nagafude.touchR[2]); eq(b0[0].cause, 'fuse');
  ok(b0[1].cause !== 'fuse' && Math.abs(b0[1].R - K.SHELLS.kiku.R * K.DECAY) < 1e-9, `爆発でひらいた玉 ${b0[1].R}`);
  eq(burstOf(runHand([{ type: 'kiku', x: 100, y: 300 }], L2('nagafude'), line(80, 300, 104, 300, 6)).ev, 'kiku')[0].R, K.SHELLS.kiku.R);
  const row = () => [{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 90, y: 300 }];
  const short = line(50, 300, 100, 300, 10);
  eq(part(runHand(row(), L3('nokorizumi'), short).res, 'nokorizumi', 'xmult').v, K.CHARM_LV.nokorizumi.half[2]);
  eq(part(runHand(row(), L2('nokorizumi'), short).res, 'nokorizumi', 'xmult'), undefined, 'Lv2 は掛け算なし');
  eq(part(runHand(row(), L3('nokorizumi'), line(20, 300, 340, 300, 80)).res, 'nokorizumi', 'xmult'), undefined, '半分より使えば掛け算なし');
  eq(K.SPARE_HALF, 5);
  const T = K.rulesFor(L3('tairin'), 1);
  for (let g = 0; g <= K.CHARM_LV.tairin.keep[2]; g++) eq(K.sizeAt(T, g), T.size, `${g} 代目`);
  ok(Math.abs(K.sizeAt(T, K.CHARM_LV.tairin.keep[2] + 1) - T.size * T.decay) < 1e-12);
  ok(K.sizeAt(K.rulesFor(L2('tairin'), 1), 2) < K.rulesFor(L2('tairin'), 1).size);
});

check('Lv3: 金運の金・雨よけの湿った玉は大きくひらく・遅火は線でふれた玉で倍率・一番星と花筏は火花', () => {
  const R = (charms, type) => burstOf(runHand([{ type, x: 100, y: 300 }], charms, line(80, 300, 120, 300, 10)).ev, type)[0].R;
  eq(R(L2('kinun'), 'kin'), K.SHELLS.kin.R); eq(R(L3('kinun'), 'kin'), K.CHARM_LV.kinun.R[2]);
  eq(R(L2('amayoke'), 'shime'), K.SHELLS.shime.R); eq(R(L3('amayoke'), 'shime'), K.CHARM_LV.amayoke.R[2]);
  const six = () => Array.from({ length: 6 }, (_, i) => ({ type: 'kiku', x: 40 + i * 60, y: 300 }));
  const o3run = runHand(six(), L3('osobi'), line(20, 300, 350, 300, 80)), o3 = o3run.res;
  eq(o3.stats.lineTouched, 6);
  eq(part(o3, 'osobi').v, K.CHARM_LV.osobi.mult[2] + Math.floor(6 / K.CHARM_LV.osobi.touch[2]), '遅火 Lv3 は線でふれた玉ごと');
  eq(part(runHand(six(), L2('osobi'), line(20, 300, 350, 300, 80)).res, 'osobi').v, K.CHARM_LV.osobi.mult[1]);
  eq(o3.mult, K.multOf(o3run.st), 'multOf にも入る');
  // 一番星 Lv3: 線でふれた金から火花が 8 本 → まわりの輪がひらく
  const nStar = K.CHARM_LV.ichibanboshi.sparks[2], gold = () => [{ type: 'kin', x: 100, y: 300 }, ...ring(100, 300, 100, nStar)];
  const s2 = runSparks(gold(), L2('ichibanboshi'), line(60, 300, 108, 300, 12)), s3 = runSparks(gold(), L3('ichibanboshi'), line(60, 300, 108, 300, 12));
  eq(s2.sparks, 0); eq(s3.sparks, nStar);
  ok(s3.res.pops >= s2.res.pops + 3, `一番星 Lv3 ${s3.res.pops} / Lv2 ${s2.res.pops}`);
  // 爆発でひらいた金からは飛ばない
  eq(runSparks([{ type: 'kiku', x: 100, y: 300 }, { type: 'kin', x: 140, y: 300 }], L3('ichibanboshi'), line(80, 300, 104, 300, 6)).sparks, 0);
  // 花筏 Lv3: 灯った提灯から火花
  const lan = () => [{ type: 'chouchin', x: 100, y: 300 }, ...ring(100, 300)];
  const h2 = runSparks(lan(), L2('hanaikada'), line(60, 300, 108, 300, 12)), h3 = runSparks(lan(), L3('hanaikada'), line(60, 300, 108, 300, 12));
  eq(h2.sparks, 0); eq(h3.sparks, K.LV3_SPARKS); ok(h3.res.pops > h2.res.pops);
});

check('Lv3: 終わり玉は始まりも爆ぜる・墨流しは残した墨で線の終わりが爆ぜる・天狗は突風・鎌鼬は両端から', () => {
  const sh = () => [{ type: 'kiku', x: 60, y: 400 }];
  const o2 = runHand(sh(), L2('owaridama'), line(60, 300, 200, 300, 30)), o3 = runHand(sh(), L3('owaridama'), line(60, 300, 200, 300, 30));
  eq(o2.res.pops, 0, 'Lv2 は線の始まりは爆ぜない');
  eq(o3.res.pops, 1, 'Lv3 は始まりも爆ぜる');
  eq(o3.ev.filter((e) => e.type === 'endBurst').length, 2);
  ok(o3.ev.some((e) => e.type === 'endBurst' && e.x === 60 && e.y === 300 && e.R === K.CHARM_LV.owaridama.R[2]));
  // 墨流し Lv3: 残した墨の段ごとに大きさ blast で爆ぜる（その火は線の火）
  const m = runHand([{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 160, y: 300 }], L3('suminagashi'), line(50, 300, 90, 300, 10));
  const steps = K.spareSteps(m.st), blast = m.ev.find((e) => e.type === 'endBurst');
  ok(steps >= 8 && blast && blast.R === steps * K.CHARM_LV.suminagashi.blast[2], `段 ${steps} 爆発 ${blast && blast.R}`);
  eq(m.res.pops, 2, '線の終わりの爆発が離れた玉に届く');
  eq(runHand([{ type: 'kiku', x: 60, y: 300 }], L2('suminagashi'), line(50, 300, 90, 300, 10)).ev.filter((e) => e.type === 'endBurst').length, 0);
  // 終わり玉といっしょなら、大きい方
  const both = runHand([{ type: 'kiku', x: 60, y: 300 }], [...L3('suminagashi'), 'owaridama'], line(50, 300, 90, 300, 10));
  eq(both.ev.find((e) => e.type === 'endBurst').R, Math.max(K.OWARI_R, K.spareSteps(both.st) * K.CHARM_LV.suminagashi.blast[2]));
  // 天狗の団扇 Lv3: 線の終わりから、その向きへ火花
  const far = () => [{ type: 'kiku', x: 40, y: 300 }, { type: 'kiku', x: 330, y: 300 }];
  eq(runHand(far(), L2('tengu'), line(40, 300, 140, 300, 25)).res.pops, 1);
  const t3 = runHand(far(), L3('tengu'), line(40, 300, 140, 300, 25));
  eq(t3.res.pops, 2, '突風が遠くの玉に届く'); ok(t3.ev.some((e) => e.type === 'gust'));
  // 鎌鼬の爪 Lv3: 線の終わりの玉も、はじめからひらく
  const kk = (charms) => { const st = handRound([{ type: 'kiku', x: 40, y: 300 }, { type: 'kiku', x: 320, y: 300 }], charms); K.runToEnd(st, [line(40, 300, 320, 300, 70)]); return st.shells[1].burstAt; };
  ok(kk(L3('kamaitachi')) < 0.05, `Lv3 ${kk(L3('kamaitachi'))}`); ok(kk(L2('kamaitachi')) > 0.3, `Lv2 ${kk(L2('kamaitachi'))}`);
});

check('Lv3: 鼓動は連鎖の玉の点が増える・残り火は連鎖に数えて、もう一度はじける・連獅子は深い玉から火花・満開の加護は残り 2 つで満開', () => {
  const k3 = rowChain(L3('kodou')).st;
  ok(k3.chainPops >= 4);
  const each = Math.round(10 * (K.CHARM_LV.kodou.chips[2] - 1));
  eq(part(k3.result, 'kodou', 'chips').v, each * k3.chainPops, '連鎖でひらいた玉ごと');
  eq(part(k3.result, 'kodou', 'mult').v, Math.floor(k3.chainPops / K.CHARM_LV.kodou.step[2]));
  eq(part(rowChain(L2('kodou')).st.result, 'kodou', 'chips'), undefined);
  // 残り火: はじけた残り火は連鎖に数える
  const nb = (charms) => { const st = handRound(Array.from({ length: 12 }, (_, i) => ({ type: 'kiku', x: 30 + i * 26, y: 300 })), charms); K.lightStroke(st, line(30, 340, 30, 310, 6)); const ev = []; for (let i = 0; i < 3600 && !st.done; i++) { K.step(st); ev.push(...st.events); st.events.length = 0; } return { st, ev }; };
  const n1 = nb(['nokoribi']), embers1 = n1.ev.filter((e) => e.type === 'ember').length;
  ok(embers1 > 0);
  eq(n1.st.chainPops, n1.ev.filter((e) => e.type === 'burst' && e.gen > 0).length + embers1, '残り火は連鎖に数える');
  const count = (ev) => { const at = {}; for (const e of ev.filter((x) => x.type === 'ember')) at[`${e.x},${e.y}`] = (at[`${e.x},${e.y}`] || 0) + 1; return Object.values(at); };
  const c3 = count(nb(L3('nokoribi')).ev);
  ok(c3.some((c) => c === 2), 'Lv3 は、もう一度はじける残り火がある');
  ok(c3.every((c) => c <= 2), '2 度まで');
  ok(count(nb(L2('nokoribi')).ev).every((c) => c === 1), 'Lv2 は 1 度だけ');
  // 連獅子 Lv3: 深い代の玉は火花を飛ばす（菊の列には千輪が無いので、火花は連獅子のものだけ）
  const rowSh = () => Array.from({ length: 9 }, (_, i) => ({ type: 'kiku', x: 50 + i * 26, y: 300 }));
  const r2 = runSparks(rowSh(), L2('renjishi'), line(50, 340, 50, 310, 6)), r3 = runSparks(rowSh(), L3('renjishi'), line(50, 340, 50, 310, 6));
  eq(r2.sparks, 0);
  const deep = r3.ev.filter((e) => e.type === 'burst' && e.gen >= K.CHARM_LV.renjishi.deep[2]).length;
  ok(deep > 0 && r3.sparks === deep * K.DEEP_SPARKS, `深い玉 ${deep} 火花 ${r3.sparks}`);
  // 満開の加護 Lv3: 10 個のうち 8 個（残り 2）なら満開 ×2 も
  const ten = () => Array.from({ length: 10 }, (_, i) => ({ type: 'kiku', x: i >= 8 ? 320 : 30 + i * 30, y: i >= 8 ? 560 - (i - 8) * 70 : 300 }));
  const m3 = runHand(ten(), L3('mankai'), line(20, 300, 260, 300, 60)).res;
  eq(m3.pops, 8); eq(m3.allClear, false); eq(part(m3, 'bloom').v, K.BLOOM); eq(part(m3, 'mankai').v, K.CHARM_LV.mankai.x[2]);
  eq(part(runHand(ten(), L2('mankai'), line(20, 300, 260, 300, 60)).res, 'bloom'), undefined, 'Lv2 は満開にならない');
  const seven = [...ten().slice(0, 7), { type: 'kiku', x: 320, y: 560 }, { type: 'kiku', x: 320, y: 490 }, { type: 'kiku', x: 320, y: 420 }];
  const m3b = runHand(seven, L3('mankai'), line(20, 300, 220, 300, 50)).res;
  ok(m3b.total - m3b.pops > K.CHARM_LV.mankai.near[2] && !part(m3b, 'bloom'), `残りが多ければ満開にならない ${m3b.pops}/${m3b.total}`);
});

check('Lv3: 増し玉は大玉・提灯職人は提灯・招き猫は金・風切りは雲のあとに大玉（どれも、もとの並びは変えない）', () => {
  const base = K.newRound({ seed: 4, night: 6, moon: 1 });
  const extra = (charms) => K.newRound({ seed: 4, night: 6, moon: 1, charms }).shells.slice(base.shells.length);
  const key = (s) => `${s.type}:${s.x}:${s.y}`;
  const m3 = extra(L3('mashidama'));
  eq(m3.filter((s) => s.type === 'kiku').length, K.CHARM_LV.mashidama.n[2]); eq(m3.filter((s) => s.type === 'ootama').length, K.CHARM_LV.mashidama.big[2]);
  ok(m3.every((s) => s.extra && s.src === 'mashidama'));
  eq(extra(L2('mashidama')).filter((s) => s.type === 'ootama').length, 0);
  const c3 = extra(L3('chouchinshi'));
  eq(c3.length, 1); eq(c3[0].type, 'chouchin'); eq(c3[0].src, 'chouchinshi'); eq(extra(L2('chouchinshi')).length, 0);
  const g3 = extra(L3('maneki'));
  eq(g3.length, 1); eq(g3[0].type, 'kin');
  const k3 = K.newRound({ seed: 4, night: 6, moon: 1, charms: L3('kazekiri') });
  eq(k3.clouds.length, 0);
  const big = k3.shells.filter((s) => s.src === 'kazekiri');
  eq(big.length, base.clouds.length); big.forEach((s, i) => { eq(s.type, 'ootama'); eq(s.x, base.clouds[i].x); eq(s.y, base.clouds[i].y); });
  eq(K.newRound({ seed: 4, night: 2, moon: 1, charms: L3('kazekiri') }).shells.filter((s) => s.src === 'kazekiri').length, 0, '雲の無い夜は出ない');
  // もとの玉は同じ・玉は重ならない
  for (const ch of [L3('mashidama'), L3('chouchinshi'), L3('kazekiri'), [...L3('mashidama'), ...L3('maneki'), ...L3('chouchinshi')]]) {
    const st = K.newRound({ seed: 4, night: 6, moon: 1, charms: ch });
    eq(st.shells.slice(0, base.shells.length).map(key).join(), base.shells.map(key).join());
    for (let i = 0; i < st.shells.length; i++) for (let j = i + 1; j < st.shells.length; j++) ok(Math.hypot(st.shells[i].x - st.shells[j].x, st.shells[i].y - st.shells[j].y) >= 27, `${ch}: 近すぎる`);
  }
  // 点の内訳: 増し玉の玉（大玉も）は mashidama、ほかのお守りで増えた玉は「玉」
  const st = K.newRound({ seed: 4, night: 6, moon: 1, charms: L3('mashidama') });
  K.runToEnd(st, [line(20, 120, 340, 480, 80)]);
  const mash = st.shells.filter((s) => s.burst && s.src === 'mashidama').reduce((a, s) => a + K.SHELLS[s.type].pts, 0);
  eq(st.acc.mashi, mash);
});

check('Lv3: 二筆目は残した墨も使える・狸の葉っぱは上下にも映る・線香花火は燃える線から火花・狐火は大きくひらき、もう一度飛ぶ', () => {
  const shells = [];
  for (let i = 0; i < 26; i++) shells.push({ type: 'kiku', x: 20 + (i % 13) * 26, y: i < 13 ? 200 : 202 });
  shells.push({ type: 'kiku', x: 180, y: 450 });
  const st = handRound(shells, L3('nihitsu'));
  K.lightStroke(st, line(10, 201, 350, 201, 90));
  const total1 = st.inkTotal, own1 = st.ownInk;
  for (let i = 0; i < 3600 && st.phase !== 'draw2' && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.phase, 'draw2');
  const grant = Math.round(st.rules.ink * K.CHARM_LV.nihitsu.ink[2]), left = total1 - K.pathLength(st.strokes[0]);
  eq(st.ink, grant + Math.floor(left), '二筆目の墨 = もらう墨 + 残した墨');
  eq(st.inkTotal, total1 + grant); eq(st.ownInk, own1 + grant);
  ok(K.lightStroke(st, line(170, 450, 170 + Math.min(st.ink - 10, 170), 450, 40)), '長い二筆目が引ける');
  // 狸の葉っぱ Lv3
  const tn = runHand([{ type: 'kiku', x: 60, y: 150 }, { type: 'kiku', x: 60, y: K.FIELD.y0 + K.FIELD.y1 - 150 }], L3('tanuki'), line(40, 150, 140, 150, 25));
  eq(tn.res.pops, 2, '上下に映った線が玉をひらく');
  const flip = tn.st.fuse.pts.filter((_, i) => tn.st.fuse.seg[i] === 40);
  ok(flip.length > 0 && flip.every((p) => p.y > 400));
  eq(JSON.stringify(K.flipPoint({ x: 10, y: 150 })), JSON.stringify({ x: 10, y: K.FIELD.y0 + K.FIELD.y1 - 150 }));
  ok(!runHand([{ type: 'kiku', x: 60, y: 150 }], L2('tanuki'), line(40, 150, 140, 150, 25)).st.fuse.seg.includes(40));
  // 線香花火 Lv3: 墨を使い切る線から火花
  const ink = K.rulesFor(['senkou'], 1).ink, ll = line(20, 300, 20 + ink * 0.95, 300, 60);
  eq(runSparks([{ type: 'kiku', x: 20, y: 300 }], L2('senkou'), ll).sparks, 0);
  ok(runSparks([{ type: 'kiku', x: 20, y: 300 }], L3('senkou'), ll).sparks >= 5);
  // 狐火: 狐火でひらいた玉は 0 代目の大きさ。Lv3 は狐火でひらいた玉から、また飛ぶ
  const group = [[40, 290], [70, 290], [100, 290], [40, 320], [70, 320], [100, 320], [55, 350], [85, 350]].map(([x, y]) => ({ type: 'kiku', x, y }));
  // はぐれ玉は 12 個（狐火の数より多い。間は爆発が届かない 70 と 80）
  const singles = [230, 300].flatMap((x) => [110, 190, 270, 350, 430, 500].map((y) => ({ type: 'kiku', x, y })));
  const fx2 = runHand([...group, ...singles], L2('kitsune'), line(16, 290, 45, 290, 8)), fx3 = runHand([...group, ...singles], L3('kitsune'), line(16, 290, 45, 290, 8));
  const foxBursts = fx3.ev.filter((e) => e.type === 'burst' && e.cause === 'fox');
  ok(foxBursts.length > 0 && foxBursts.every((e) => e.gen === 0 && e.R === K.SHELLS[e.shell.type].R * K.FOX_R), '狐火の玉は大きくひらく');
  ok(fx3.ev.filter((e) => e.type === 'fox').length > K.CHARM_LV.kitsune.n[2], `狐火 ${fx3.ev.filter((e) => e.type === 'fox').length}`);
  ok(fx3.res.pops > fx2.res.pops, `Lv3 ${fx3.res.pops} / Lv2 ${fx2.res.pops}`);
});

check('型そろい（13版）: 同じ型のお守りを 3 種類（提灯は 2 種類）で掛け算・多いほど大きい・いちばん良い型 1 つだけ・花火合戦には無い', () => {
  eq(K.setBonus(['kinun', 'maneki']), null, '2 種類では無い');
  eq(JSON.stringify(K.setBonus(['kinun', 'kinun', 'maneki', 'ichibanboshi'])), JSON.stringify({ tag: 'gold', n: 3, need: 3, x: K.SET_X[0] }), 'Lv ではなく種類で数える');
  eq(K.setBonus(['chouchinshi', 'hanaikada']).x, K.SET_X[0], '提灯は 2 種類');
  eq(K.setBonus(['tairin', 'kodou', 'nokoribi', 'renjishi']).x, K.SET_X[1]);
  eq(K.setBonus(['tairin', 'kodou', 'nokoribi', 'renjishi', 'mashidama']).x, K.SET_X[2]);
  eq(K.setBonus(['nagafude', 'tairin', 'owaridama', 'mashidama', 'nihitsu']), null, '届く・仕掛けの型には無い');
  eq(K.setBonus(['tairin', 'kodou', 'nokoribi', 'renjishi', 'chouchinshi', 'hanaikada']).tag, 'chain', 'いちばん良い型');
  ok(K.SET_TAGS.every((t) => K.CHARMS.filter((c) => c.tags.includes(t)).length >= K.SET_NEED[t]), 'どの型もそろえられる');
  // 点の内訳に kata（型そろい）として入る
  const { res } = runHand([{ type: 'kin', x: 60, y: 300 }, { type: 'kiku', x: 90, y: 300 }], ['kinun', 'maneki', 'ichibanboshi'], line(50, 300, 100, 300, 10));
  eq(part(res, 'kata').v, K.SET_X[0]); eq(part(res, 'kata').kind, 'xmult'); eq(part(res, 'kata').ja, '型そろい');
  eq(part(runHand([{ type: 'kiku', x: 60, y: 300 }], ['kinun', 'maneki'], line(50, 300, 100, 300, 10)).res, 'kata'), undefined);
  eq(K.newVsRound({ seed: 1, bout: 0 }).rules.set, null);
});

check('墨の数え方（13版）: 墨壺の墨は、残り墨・墨流し・線香花火・願い札の割合に入らない・段位 2 からは墨壺に持ちこせない', () => {
  const sh = () => [{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 90, y: 300 }];
  const run = (bank, charms, stroke) => { const st = K.newRound({ seed: 3, night: 1, moon: 1, charms, bank }); st.shells = sh().map((s, i) => ({ id: i, hue: 0, burst: false, burstAt: -1, hp: 1, lastSrc: null, ...s })); K.runToEnd(st, [stroke]); return st; };
  const short = line(50, 300, 250, 300, 40);
  const a = run(0, ['nokorizumi', 'suminagashi'], short), b = run(K.BASE_INK, ['nokorizumi', 'suminagashi'], short);
  eq(b.ownInk, a.ownInk); eq(b.inkTotal, a.inkTotal + K.BASE_INK);
  eq(K.spareSteps(b), K.spareSteps(a), '墨壺の墨では段が増えない');
  eq(b.result.score, a.result.score, '同じ線なら同じ点');
  eq(b.result.stats.inkFrac, a.result.stats.inkFrac, '願い札の墨の割合も同じ');
  ok(Math.abs(K.spareFrac(a) - (1 - K.pathLength(a.strokes[0]) / a.ownInk)) < 1e-12);
  // 墨壺の墨まで使えば、その夜の墨は使い切ったことになる
  const long = run(K.BASE_INK, ['senkou'], line(20, 200, 340, 200, 80).concat(line(340, 230, 20, 230, 80)));
  ok(K.inkUsed(long) > long.ownInk); eq(K.inkUsedFrac(long), 1); eq(K.spareSteps(long), 0); eq(part(long.result, 'senkou').v, K.CHARM_LV.senkou.x[0]);
  // 持ちこし: 段位 2 から 0
  for (const [level, has] of [[0, true], [1, true], [2, false], [8, false]]) {
    const st = K.newRound({ seed: 3, night: 1, moon: 1, level });
    K.lightStroke(st, line(40, 300, 100, 300, 10));
    eq(K.inkCarry(st) > 0, has, `段位 ${level}`);
  }
  eq(K.inkCarry(K.newVsRound({ seed: 3, bout: 0 })), 0);
});

check('段位: 9 段・決まりは重なる・目標・雲・減衰・枠・候補の数', () => {
  eq(K.LEVELS.length, 9); eq(K.MAX_LEVEL, 8);
  K.LEVELS.forEach((L, n) => { eq(L.n, n); eq(L.id, `dan${n}`); ok(L.ja && L.en && L.rule && L.ruleEn && L.fx, `段位 ${n}`); });
  eq(JSON.stringify(K.levelFx(0)), JSON.stringify({ target: 1, price: 0, spare: 1, noBank: false, ink: 1, clouds: false, decay: 0, offer: 3, slots: 5, star2: 3 }));
  const f8 = K.levelFx(8);
  ok(Math.abs(f8.target - 1.1 * 1.05 * 1.05 * 1.05) < 1e-12); eq(f8.price, 0); eq(f8.noBank, true); eq(f8.ink, 0.85); eq(f8.spare, 0); eq(f8.clouds, true); eq(f8.decay, 0.04); eq(f8.offer, 2); eq(f8.slots, 4); eq(f8.star2, 4);
  // 段位 2 は墨が 1 割へって、墨壺なし（13版。前の版の「屋台の値段 +1」は、どの段位でも 0 にした）
  eq(K.levelFx(1).noBank, false); eq(K.levelFx(1).ink, 1); eq(K.levelFx(2).noBank, true); eq(K.levelFx(2).ink, 0.85); eq(K.levelFx(2).price, 0); eq(K.levelFx(2).spare, 1); eq(K.levelFx(3).spare, 1); eq(K.levelFx(4).spare, 0); eq(K.levelFx(2).clouds, false); eq(K.levelFx(3).clouds, true);
  eq(K.CLOUD_LEVEL, 3); eq(K.levelFx(6).offer, 2); ok(Math.abs(K.levelFx(3).target / K.levelFx(2).target - 1.05) < 1e-12); eq(K.levelFx(6).target, K.levelFx(5).target);
  ok(K.LEVELS[2].rule.includes('墨壺'));
  eq(K.newRound({ seed: 3, night: 2, moon: 1, level: 2 }).ink, Math.round(K.BASE_INK * 0.85), '段位 2 から墨が 15% へる');
  eq(K.newRound({ seed: 3, night: 2, moon: 1, level: 2, charms: ['nagafude'] }).ownInk, Math.round(Math.round(K.BASE_INK * K.CHARM_LV.nagafude.ink[0]) * 0.85));
  eq(K.parScore(3, 2, 1, 2), K.parScore(3, 2, 1, 0), '基準点は段位の墨の倍率を入れない');
  eq(K.levelFx(5).offer, 3); eq(K.levelFx(6).offer, 2); eq(K.slotsFor(7), 5); eq(K.slotsFor(8), 4);
  eq(K.levelFx(99), K.levelFx(8)); eq(K.levelFx(-3), K.levelFx(0));
  // 目標点
  for (let seed = 1; seed <= 6; seed++) for (const n of [0, 3, 7]) {
    const t0 = K.targetFor(seed, n, 2), t1 = K.targetFor(seed, n, 2, 1), t4 = K.targetFor(seed, n, 2, 4), t7 = K.targetFor(seed, n, 2, 7);
    // 小さい目標点は 10 点きざみに丸めるので、ゆるく比べる
    const near = (a, b, k) => Math.abs(b - a * k) <= a * k * 0.06 + 10;
    ok(near(t0, t1, 1.1), `段位 1 は +10% ${t0} → ${t1}`);
    ok(near(t4, t7, 1.05), `段位 7 は段位 4 より +5% ${t4} → ${t7}`);
    if (n === 0) ok(near(t0, t7, 1.1 * 1.05 * 1.05 * 1.05), `一夜目は並びが同じ: 段位 7 は +27% ${t0} → ${t7}`);
    ok(t1 >= t0 && t7 >= t4, '段位で目標が下がる');
    eq(K.newRound({ seed, night: n, moon: 2, level: 7 }).target, t7);
  }
  // 雲: 段位 3 から二夜目に出る（一夜目は出ない）。並びもその雲をよける
  for (let seed = 1; seed <= 20; seed++) {
    eq(K.newRound({ seed, night: 1, moon: 1, level: 2 }).clouds.length, 0);
    const st = K.newRound({ seed, night: 1, moon: 1, level: 4 });
    eq(st.clouds.length, 1, '段位 4 の二夜目');
    eq(K.newRound({ seed, night: 1, moon: 1, level: 3 }).clouds.length, 1, '段位 3 の二夜目');
    for (const s of st.shells) ok(Math.hypot(s.x - st.clouds[0].x, s.y - st.clouds[0].y) >= st.clouds[0].r + 14, '玉が雲に重なる');
    eq(K.newRound({ seed, night: 0, moon: 1, level: 8 }).clouds.length, 0, '一夜目は雲なし');
    eq(JSON.stringify(K.newRound({ seed, night: 6, moon: 1, level: 8 }).clouds), JSON.stringify(K.newRound({ seed, night: 6, moon: 1 }).clouds), '雲の夜は同じ雲');
    eq(K.newRound({ seed, night: 1, moon: 1, level: 4 }).stats.total, st.shells.length);
  }
  const want = K.parScore(3, 1, 1, 4) * K.TARGET_RATIO[1] * K.levelFx(4).target;
  ok(Math.abs(K.targetFor(3, 1, 1, 4) - want) <= want * 0.05 + 5, '段位 4 の目標点は、基準点 × 倍率');
  eq(K.parScore(3, 1, 1, 8), K.parScore(3, 1, 1, 4), '並びが同じなら基準点も同じ');
  // 13版: 雲のある並びで基準点が下がっても、目標は下がらない（いつもの並びとの高い方）。雲の段位 3 は段位 2 よりやさしくならない
  let higher = 0;
  for (let seed = 1; seed <= 16; seed++) for (const n of [1, 2, 3]) {
    const p2 = K.parScore(seed, n, seed % 8, 2), p3 = K.parScore(seed, n, seed % 8, 3);
    ok(p3 >= p2, `seed ${seed} night ${n}: 段位 3 の基準点 ${p3} < 段位 2 ${p2}`);
    ok(K.targetFor(seed, n, seed % 8, 3) >= K.targetFor(seed, n, seed % 8, 2), `seed ${seed} night ${n}: 段位 3 の目標が下がる`);
    if (p3 > p2) higher++;
  }
  ok(higher > 0, '雲のある並びの方が高い夜もある');
  // 減衰
  ok(Math.abs(K.rulesFor([], 1, 5).decay - (K.DECAY - 0.04)) < 1e-12); eq(K.rulesFor([], 1, 4).decay, K.DECAY);
  ok(Math.abs(K.newRound({ seed: 1, night: 2, level: 6 }).rules.decay - (K.DECAY_SOFT - 0.04)) < 1e-12, '満月の夜も 0.04 強い');
  eq(K.newRound({ seed: 1, night: 2, level: 99 }).level, 8);
  // 花火合戦は段位に関係ない
  eq(K.newVsRound({ seed: 42, bout: 0 }).level, 0);
});

check('夜の記録 st.stats: はじめにひらいた玉・引きはじめの玉・線でふれた数・金・深さ・墨の割合', () => {
  const sh = () => [{ type: 'kin', x: 60, y: 300 }, { type: 'kiku', x: 100, y: 300 }, { type: 'ootama', x: 140, y: 300 }, { type: 'kiku', x: 140, y: 340 }, { type: 'kin', x: 320, y: 560 }];
  const { st, res } = runHand(sh(), [], line(60, 300, 145, 300, 20));
  const S = res.stats;
  eq(S, st.stats);
  eq(S.firstPop, 'kin'); eq(S.startType, 'kin');
  eq(S.lineTouched, 3); eq(S.goldTouched, 1); eq(S.goldTotal, 2); eq(S.goldBurst, 1);
  eq(S.bigTotal, 1); eq(S.bigBurst, 1); eq(S.pops, 4); eq(S.total, 5); eq(S.allClear, false);
  eq(S.maxGen, 1); eq(S.chainPops, 1); eq(S.cloudTouched, false); eq(S.ropesTotal, 0);
  ok(Math.abs(S.inkFrac - K.inkUsed(st) / st.inkTotal) < 1e-12 && S.inkFrac < 0.25, `墨 ${S.inkFrac}`);
  // 雲を通る線
  const c = runHand(sh(), [], line(60, 300, 145, 300, 20), { clouds: [{ x: 120, y: 300, r: 10 }] });
  eq(c.res.stats.cloudTouched, true);
  // 何もない所から引くと、引きはじめの玉は無い
  eq(runHand(sh(), [], line(200, 450, 260, 450, 10)).res.stats.startType, null);
  // 夜の記録は、newRound の時点でも読める（数はその夜の玉）
  const st0 = K.newRound({ seed: 3, night: 6, moon: 1 });
  eq(st0.stats.ropesTotal, st0.ropes.length); eq(st0.stats.dampTotal, st0.shells.filter((s) => s.type === 'shime').length);
});

check('願い札: 14 枚・夜ごとに 1 枚（決定的）・その夜に意味のある札だけ・前の夜と同じ札は出ない・★1 か ★2', () => {
  eq(K.WISHES.map((w) => w.id).join(), 'w_lantern_first,w_all_gold,w_spare30,w_pops,w_touch_few,w_double,w_damp_all,w_tori6,w_rope_all,w_no_cloud,w_gold_first,w_bloom,w_short,w_big_all');
  const seen = new Set(), stars = { 1: 0, 2: 0 };
  for (let seed = 1; seed <= 9; seed++) for (const level of [0, 4]) {
    let prev = null;
    const moon = seed % 8;
    for (let n = 0; n < K.NIGHTS; n++) {
      const w = K.wishFor(seed, n, level, moon);
      eq(JSON.stringify(w), JSON.stringify(K.wishFor(seed, n, level, moon)), '決定的');
      ok(w.ja && w.en && !w.ja.includes('{') && !w.en.includes('{'), JSON.stringify(w));
      ok(w.stars === 1 || w.stars === 2, `★ ${w.stars}`); stars[w.stars]++;
      seen.add(w.id);
      ok(w.id !== prev, `seed ${seed}: 同じ札が続く`); prev = w.id;
      const tw = K.twistFor(seed, n);
      if (w.id === 'w_tori6') eq(n, 7);
      if (w.id === 'w_lantern_first') ok(n >= 3);
      if (w.id === 'w_damp_all') ok(n >= 5);
      if (w.id === 'w_rope_all') ok(n >= 6);
      if (w.id === 'w_big_all') ok(n >= 1);
      if (w.id === 'w_bloom') eq(n, 0, '満開は一夜目だけ');
      if (w.id === 'w_spare30' || w.id === 'w_short') ok(n < 7);
      if (w.id === 'w_no_cloud') ok(n >= (level >= 4 ? 1 : 4), `雲の無い夜に ${n}`);
      if (w.id === 'w_double' && !w.fallback) ok(!tw && n >= 4, '大一番・四夜目までに 2 倍');
      if (w.id === 'w_touch_few') ok(n >= 1 && !(tw && tw.id === 'kagami'));
      if (w.id === 'w_pops') { ok(w.n >= 1); ok(w.ja.includes(String(w.n)) && w.en.includes(String(w.n))); }
      // 手順の線で見きわめた札: ただでかなう札・かなわない札は出ない（どれもだめな夜の「◯個以上」だけは例外で ★2）
      const c = K.wishCheck(seed, n, w.id, level, moon);
      if (w.fallback) { eq(w.stars, 2, '例外の札は ★2'); ok(c && (c.cat === 'impossible' || w.id === 'w_pops' || w.id === 'w_double'), `例外の札 ${w.id} ${c && c.cat}`); }
      else { ok(c.cat === 'trade' || c.cat === 'unchecked', `seed ${seed} night ${n}: ${w.id} は ${c.cat}`); eq(w.stars, c.stars); }
    }
  }
  ok(seen.size >= 10, `出た札 ${[...seen]}`);
  ok(stars[1] > 0 && stars[2] > 0, `★1 ${stars[1]} / ★2 ${stars[2]}`);
  eq(K.wishFor(1, 8), null);
  ok(K.wishById('w_bloom') && !K.wishById('nope'));
  // 前の版の札（大トリ +8）は、名前とかなったかだけ読める（もう出ない）
  const old = K.wishById('w_tori8');
  ok(old && old.legacy && old.ja && old.en); eq(K.wishCheck(1, 7, 'w_tori8'), null);
  ok(!K.WISHES.some((w) => w.id === 'w_tori8'));
  eq(K.WISH_FLOOR, 0.6); eq(K.WISH_COST2, 0.25);
});

check('願い札の見きわめ（wishCheck）: いちばん高い手順の線でかなう札は free・かなう線が無ければ impossible・点を下げてかなうなら trade（下げ幅で ★）', () => {
  const cats = {};
  for (let seed = 1; seed <= 6; seed++) for (const n of [0, 2, 4, 6, 7]) for (const w of K.WISHES) {
    const c = K.wishCheck(seed, n, w.id, 0, 4);
    ok(c && ['free', 'trade', 'impossible', 'unchecked'].includes(c.cat), JSON.stringify(c));
    ok(c.cost >= 0 && c.cost <= 1, JSON.stringify(c));
    if (c.cat === 'trade') { ok(c.cost > 0); eq(c.stars, c.cost >= K.WISH_COST2 ? 2 : 1); }
    if (w.id === 'w_double') eq(c.cat, 'unchecked');
    cats[c.cat] = (cats[c.cat] || 0) + 1;
  }
  ok(cats.free > 0 && cats.trade > 0 && cats.impossible > 0, JSON.stringify(cats));
  // 雲の無い夜に「雲にふれない」は、どの線でもかなう（free）
  eq(K.wishCheck(1, 0, 'w_no_cloud').cat, 'free');
  eq(K.wishCheck(1, 0, 'nope'), null); eq(K.wishCheck(1, 9, 'w_bloom'), null);
});

check('願い札: かなったか（どれも越えたうえで）', () => {
  const W = (id, shells, stroke, target = 0, opts = {}) => { const { st } = runHand(shells, opts.charms || [], stroke, opts); return K.wishMet(st, opts.wish || { id }, target); };
  const row = (types, y = 300) => types.map((type, i) => ({ type, x: 60 + i * 40, y }));
  // 提灯から引きはじめる
  eq(W('w_lantern_first', row(['chouchin', 'kiku', 'kiku']), line(60, 300, 140, 300, 20)), true);
  eq(W('w_lantern_first', row(['kiku', 'kiku', 'chouchin']), line(60, 300, 140, 300, 20)), false);
  // 金の玉を全部
  eq(W('w_all_gold', row(['kin', 'kiku', 'kin']), line(60, 300, 140, 300, 20)), true);
  eq(W('w_all_gold', [...row(['kin', 'kiku']), { type: 'kin', x: 320, y: 560 }], line(60, 300, 100, 300, 20)), false);
  // 墨を 3 割残す・半分以下
  eq(W('w_spare30', row(['kiku', 'kiku']), line(60, 300, 100, 300, 10)), true);
  eq(W('w_spare30', row(['kiku', 'kiku']), line(20, 200, 340, 200, 80).concat(line(340, 210, 20, 210, 80))), false);
  eq(W('w_short', row(['kiku', 'kiku']), line(60, 300, 100, 300, 10)), true);
  eq(W('w_short', row(['kiku', 'kiku']), line(20, 300, 340, 300, 80)), false);
  // ◯個以上
  eq(W('w_pops', row(['kiku', 'kiku', 'kiku']), line(60, 300, 140, 300, 20), 0, { wish: { id: 'w_pops', n: 3 } }), true);
  eq(W('w_pops', row(['kiku', 'kiku', 'kiku']), line(60, 300, 140, 300, 20), 0, { wish: { id: 'w_pops', n: 4 } }), false);
  // 線でじかにふれる玉は 4 つまで
  eq(W('w_touch_few', row(['kiku', 'kiku', 'kiku']), line(60, 300, 140, 300, 20)), true);
  eq(W('w_touch_few', row(['kiku', 'kiku', 'kiku', 'kiku', 'kiku', 'kiku'].map((t) => t)).map((s, i) => ({ ...s, x: 40 + i * 50 })), line(30, 300, 300, 300, 60)), false);
  // 目標の 2 倍
  const { st: d } = runHand(row(['kiku', 'kiku']), [], line(60, 300, 100, 300, 10));
  eq(K.wishMet(d, { id: 'w_double' }, d.result.score / 2), true);
  eq(K.wishMet(d, { id: 'w_double' }, d.result.score * 0.6), false);
  // 湿った玉を全部・大玉を全部
  eq(W('w_damp_all', row(['shime', 'shime']), line(60, 300, 100, 300, 10)), true);
  eq(W('w_damp_all', [...row(['shime']), { type: 'shime', x: 320, y: 560 }], line(50, 300, 70, 300, 6)), false);
  eq(W('w_big_all', row(['ootama', 'kiku']), line(60, 300, 100, 300, 10)), true);
  eq(W('w_big_all', [...row(['kiku']), { type: 'ootama', x: 320, y: 560 }], line(50, 300, 70, 300, 6)), false);
  // 大トリ +6 以上（前の版の +8 も、かなったかは読める）
  const tori = () => [...[0, 1, 2, 3].map((i) => ({ type: 'kiku', x: 40 + i * 50, y: 300 })), { type: 'shaku', x: 320, y: 300 }];
  eq(W('w_tori6', tori(), line(30, 300, 330, 300, 80)), true);
  eq(W('w_tori6', tori(), line(330, 300, 30, 300, 80)), false);
  eq(W('w_tori8', tori(), line(30, 300, 330, 300, 80)), true);
  // 半分ひらいて尺玉 → +4（+6 に届かない）
  const half = [...[0, 1].map((i) => ({ type: 'kiku', x: 40 + i * 50, y: 300 })), { type: 'shaku', x: 200, y: 300 }, ...[0, 1].map((i) => ({ type: 'kiku', x: 300, y: 200 + i * 300 }))];
  eq(W('w_tori6', half, line(30, 300, 210, 300, 45)), false);
  // 雲にふれない
  eq(W('w_no_cloud', row(['kiku', 'kiku']), line(60, 300, 100, 300, 10), 0, { clouds: [{ x: 200, y: 450, r: 20 }] }), true);
  eq(W('w_no_cloud', row(['kiku', 'kiku']), line(60, 300, 100, 300, 10), 0, { clouds: [{ x: 80, y: 300, r: 8 }] }), false);
  // はじめにひらくのは金
  eq(W('w_gold_first', row(['kin', 'kiku']), line(60, 300, 100, 300, 10)), true);
  eq(W('w_gold_first', row(['kiku', 'kin']), line(60, 300, 100, 300, 10)), false);
  // 満開
  eq(W('w_bloom', row(['kiku', 'kiku']), line(60, 300, 100, 300, 10)), true);
  eq(W('w_bloom', [...row(['kiku', 'kiku']), { type: 'kiku', x: 320, y: 560 }], line(60, 300, 100, 300, 10)), false);
  // 仕掛け縄に全部（本物の七夜目）
  const rope = K.newRound({ seed: 3, night: 6, moon: 1, bank: K.BASE_INK });
  ok(rope.ropes.length >= 2);
  const ends = rope.ropes.map((r) => rope.shells.find((s) => s.id === r.a));
  K.runToEnd(rope, [ends.map((s) => ({ x: s.x, y: s.y }))]);
  eq(K.wishMet(rope, { id: 'w_rope_all' }, 0), true);
  eq(rope.result.stats.ropesLit, rope.ropes.length);
  const none = K.newRound({ seed: 3, night: 6, moon: 1 });
  K.runToEnd(none, [line(20, 620, 120, 620, 20)]);
  eq(K.wishMet(none, { id: 'w_rope_all' }, 0), false); eq(none.result.stats.ropesLit, 0);
  // 越えていなければ、かなわない・終わる前はかなわない・id だけでもよい
  eq(W('w_bloom', row(['kiku', 'kiku']), line(60, 300, 100, 300, 10), 1e9), false);
  eq(K.wishMet(K.newRound({ seed: 1, night: 0 }), { id: 'w_bloom' }, 0), false);
  eq(W('w_gold_first', row(['kin', 'kiku']), line(60, 300, 100, 300, 10), 0, { wish: 'w_gold_first' }), true);
  eq(W('nope', row(['kin']), line(60, 300, 100, 300, 10)), false);
});

// ---------------------------------------------------------------- 花火合戦
function vsHand(shells, opts = {}) {
  const st = K.newVsRound({ seed: 1, bout: 0, moon: 1, ...opts });
  st.shells = shells.map((s, i) => ({ id: i, hue: 0, burst: false, burstAt: -1, hp: 1, lastSrc: null, ...s }));
  st.clouds = [];
  return st;
}
check('花火合戦: 盤面は決定的・大一番なし・三番は尺玉の輪', () => {
  for (let bout = 0; bout < K.VS_BOUTS.length; bout++) {
    const a = K.newVsRound({ seed: 42, bout, moon: 3 }), b = K.newVsRound({ seed: 42, bout, moon: 3 });
    eq(JSON.stringify(a.shells), JSON.stringify(b.shells), `bout ${bout}`);
    eq(a.twist, null); eq(a.target, 0); ok(a.vs && a.vs.placed.every((x) => x === null));
  }
  ok(K.newVsRound({ seed: 42, bout: 2 }).shells.some((s) => s.type === 'shaku'), '三番に尺玉');
  eq(K.newVsRound({ seed: 42, bout: 0, ink: [1, 0.5] }).vs.ink[1], Math.round(K.newVsRound({ seed: 42, bout: 0 }).rules.ink * 0.5));
});
check('花火合戦: 自分の火でひらいた玉が自分の点・点は持ち主ごと', () => {
  const st = vsHand([{ type: 'kiku', x: 80, y: 200 }, { type: 'kiku', x: 120, y: 200 }, { type: 'kin', x: 80, y: 450 }, { type: 'kiku', x: 120, y: 450 }, { type: 'kiku', x: 160, y: 450 }]);
  ok(K.vsPlace(st, 1, line(60, 200, 140, 200)), '相手の線');
  ok(K.vsPlace(st, 0, line(60, 450, 180, 450)), 'あなたの線');
  K.vsIgnite(st);
  const r = K.runVs(st);
  eq(r.pops[0], 3); eq(r.pops[1], 2);
  eq(r.mult[0], 2, '金はひらいた人の倍率に入る'); eq(r.mult[1], 1);
  eq(r.score[0], (5 + 10 + 10) * 2); eq(r.score[1], 20);
  eq(r.winner, 0);
  ok(st.shells.every((s) => s.by === (s.y > 300 ? 0 : 1)), '持ち主');
});
check('花火合戦: 後手は先手の線のすぐそば・どちらも尺玉のすぐそばからは引きはじめられない', () => {
  const st = vsHand([{ type: 'kiku', x: 100, y: 300 }, { type: 'shaku', x: 250, y: 150 }]);
  ok(K.vsPlace(st, 1, line(60, 300, 200, 300)));
  eq(K.vsPlace(st, 0, line(100, 310, 100, 450)), null, '相手の線から 10 の所');
  eq(K.vsPlace(st, 0, line(250, 170, 250, 400)), null, '尺玉から 20 の所');
  ok(K.vsPlace(st, 0, line(100, 360, 100, 500)), '60 離れていれば引ける');
  eq(K.vsPlace(st, 0, line(300, 500, 300, 600)), null, '1 番に 1 本だけ');
});
check('花火合戦: 相手の線に先に火が届くと、その先を横取りする', () => {
  // 相手の線は右へ 280。あなたの線は、相手の線の終わり近く（x=260）を上から横切る。あなたの方がずっと早く着く
  const st = vsHand([{ type: 'kiku', x: 300, y: 300 }, { type: 'kiku', x: 60, y: 300 }]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(270, 250, 270, 350, 25));
  K.vsIgnite(st);
  const r = K.runVs(st);
  ok(r.steals[0] >= 1, `横取り ${r.steals}`);
  ok(r.took[0] > 0, '相手の線を燃やした');
  eq(st.shells[0].by, 0, '相手の線の先の玉は、あなたの点');
  eq(st.shells[1].by, 1, '相手の線の始まりの玉は、相手の点');
});
check('花火合戦: お邪魔玉は、線を引いたあと・火をつける前に 1 人 1 つ。玉の上・線の引きはじめのそば・場の外には置けない', () => {
  const st = vsHand([{ type: 'kiku', x: 100, y: 200 }]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(200, 500, 200, 380, 30));
  eq(K.vsOjamaWhy(st, 105, 205), 'shell', '玉と重なる');
  eq(K.vsOjamaWhy(st, 80, 300), 'start', '相手の線の引きはじめから 40');
  eq(K.vsOjamaWhy(st, 200, 470), 'start', 'あなたの線の引きはじめから 30');
  eq(K.vsOjamaWhy(st, 5, 300), 'out', '場の外');
  eq(K.vsOjamaWhy(st, 200, 300), null);
  ok(K.vsPlaceOjama(st, 0, 200, 300), '置ける');
  eq(K.vsPlaceOjama(st, 0, 260, 300), false, '1 人 1 つ');
  eq(K.vsOjamaWhy(st, 205, 300), 'shell', 'お邪魔玉どうしも重ならない');
  ok(K.vsPlaceOjama(st, 1, 260, 300), '相手も 1 つ');
  const k = st.shells.find((s) => s.type === 'kuro' && s.from === 0);
  ok(k && k.hp === 2 && k.crackBy === -1);
  eq(JSON.stringify(st.vs.ojama[0]), JSON.stringify({ x: 200, y: 300, id: k.id }));
  const st2 = vsHand([]);
  K.vsPlace(st2, 1, line(40, 300, 320, 300, 70)); K.vsIgnite(st2);
  eq(K.vsPlaceOjama(st2, 0, 200, 300), false, '火がついたら置けない');
});
check('花火合戦: お邪魔玉に最初に届いた線の火は消え、その線だけが切れる。爆発や火花は素通り', () => {
  const st = vsHand([{ type: 'kiku', x: 60, y: 290 }, { type: 'kiku', x: 300, y: 290 }]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  ok(K.vsPlaceOjama(st, 0, 200, 300));
  K.vsIgnite(st);
  const r = K.runVs(st);
  const k = st.shells.find((s) => s.type === 'kuro');
  ok(!k.burst && k.hp === 1 && k.crackBy === 1, '相手の火で、ひびが入っただけ');
  eq(st.shells[0].by, 1); eq(st.shells[1].burst, false, '相手の火は、黒玉の先へは行けない');
  eq(r.cut[1], 1); eq(r.cut[0], 0); eq(r.kuro[1], 0);
  // 大玉の爆発がお邪魔玉をのみこんでも、何も起きない
  const st2 = vsHand([{ type: 'ootama', x: 200, y: 340 }]);
  K.vsPlace(st2, 0, line(40, 360, 320, 360, 70));
  ok(K.vsPlaceOjama(st2, 1, 200, 300));
  K.vsIgnite(st2); K.runVs(st2);
  ok(st2.shells[0].burst, '大玉はひらいた');
  const k2 = st2.shells.find((s) => s.type === 'kuro');
  ok(!k2.burst && k2.hp === 2, '爆発では、ひびも入らない');
});
check('花火合戦: 2 番目に届いた別の線の火で大爆発。届けた人の点・倍率 +1', () => {
  // 相手の火が先に届いて消え、あとからあなたの線の火が届く
  const st = vsHand([]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(200, 500, 200, 312, 47));
  ok(K.vsPlaceOjama(st, 0, 200, 300));
  K.vsIgnite(st);
  const r = K.runVs(st);
  const k = st.shells.find((s) => s.type === 'kuro');
  ok(k.burst && k.by === 0 && k.crackBy === 1, `あなたの大爆発 ${JSON.stringify(k)}`);
  eq(r.kuro[0], 1); eq(r.back[0], 0, '自分のお邪魔玉'); eq(r.mult[0], 2, '倍率 +1');
  eq(r.score[0], K.SHELLS.kuro.pts * 2);
  // 相手のお邪魔玉を爆発させると「お邪魔返し」
  const st2 = vsHand([]);
  K.vsPlace(st2, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st2, 0, line(200, 500, 200, 312, 47));
  ok(K.vsPlaceOjama(st2, 1, 200, 300));
  K.vsIgnite(st2);
  const r2 = K.runVs(st2);
  eq(r2.kuro[0], 1); eq(r2.back[0], 1);
});
check('花火合戦: 黒玉に消された火は、そこで交わる線にも移らない（横取りにならない）', () => {
  // 相手の火が黒玉に届く所（x=184）が、ちょうどあなたの線（x=190）と交わる所
  const st = vsHand([]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70), { normalized: true });
  K.vsPlace(st, 0, line(190, 500, 190, 250, 50), { normalized: true });
  ok(K.vsPlaceOjama(st, 1, 200, 290));
  K.vsIgnite(st);
  const r = K.runVs(st);
  const k = st.shells.find((s) => s.type === 'kuro');
  eq(k.crackBy, 1, '相手の火が先');
  eq(r.steals[1], 0, 'あなたの線は取られない');
  ok(k.burst && k.by === 0, 'あとから来たあなたの火で大爆発');
});
check('花火合戦: 火をつける前に行く末がわかる（vsForecast は本番と同じ）', () => {
  const opts = { seed: 31, bout: 1, moon: 3 };
  const a = K.vsPlan(() => K.newVsRound(opts), 1, K.RIVALS[1], K.rng32(1));
  const mk1 = () => { const t = K.newVsRound(opts); K.vsPlace(t, 1, a, { normalized: true }); return t; };
  const b = K.vsPlan(mk1, 0, { lines: 3, pick: 1, cut: true }, K.rng32(2));
  const make = () => { const t = mk1(); K.vsPlace(t, 0, b, { normalized: true }); return t; };
  const c = K.vsOjamaPlan(make, 1, K.RIVALS[3], K.rng32(3));
  ok(c && K.vsCanOjama(make(), c.x, c.y), `相手の置き所 ${JSON.stringify(c)}`);
  const mk2 = () => { const t = make(); K.vsPlaceOjama(t, 1, c.x, c.y); return t; };
  const fc = K.vsForecast(mk2());
  const real = mk2(); K.vsIgnite(real); const r = K.runVs(real);
  eq(JSON.stringify(fc.score), JSON.stringify(r.score), '点も同じ');
  const rk = real.shells.find((s) => s.type === 'kuro');
  eq(fc.kuro[0].crack, rk.crackBy); eq(fc.kuro[0].boom, rk.burst ? rk.by : -1);
  // 相手は、置かないときより点差がよくなる所を選ぶ
  const none = make(); K.vsIgnite(none); K.runVs(none);
  ok(c.val >= K.vsScore(none, 1) - K.vsScore(none, 0), '置いた方が得');
  eq(JSON.stringify(K.vsOjamaPlan(make, 1, K.RIVALS[3], K.rng32(3))), JSON.stringify(c), '決定的');
});
check('花火合戦: お邪魔玉の候補は置ける所だけ・交わる所も考える', () => {
  const st = vsHand(Array.from({ length: 10 }, (_, i) => ({ type: 'kiku', x: 60 + i * 26, y: 318 })));
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(200, 500, 200, 150, 90));
  const spots = K.vsOjamaSpots(st, 0, 9, K.rng32(4));
  ok(spots.length >= 6, `候補 ${spots.length}`);
  ok(spots.every((c) => K.vsCanOjama(st, c.x, c.y)), '置ける所だけ');
  ok(spots.some((c) => Math.abs(c.x - 200) < 20 && Math.abs(c.y - 300) < 20), '交わる所');
  eq(K.vsOjamaSpots(st, 0, 1, K.rng32(4)).length, 1, '1 か所でも、玉の間の置ける所を探す');
});
check('花火合戦: 相手は線とお邪魔玉を先に見せる（あなたの線を見ずに決める）・黒玉のすぐそばからは引きはじめられない', () => {
  const opts = { seed: 58, bout: 1, moon: 4, ink: [1, 1], lag: [0, 0.05] };
  const make = () => K.newVsRound(opts);
  for (const rv of K.RIVALS) {
    const a = K.vsFirstPlan(make, 1, rv, K.rng32(9)), b = K.vsFirstPlan(make, 1, rv, K.rng32(9));
    eq(JSON.stringify(a), JSON.stringify(b), `${rv.id}: 決定的`);
    ok(a.pts && a.ojama, `${rv.id}: 線とお邪魔玉 ${JSON.stringify(a.ojama)}`);
    const st = make(); ok(K.vsPlace(st, 1, a.pts, { normalized: true }));
    ok(K.vsPlaceOjama(st, 1, a.ojama.x, a.ojama.y), `${rv.id}: あなたの線が無くても置ける`);
  }
  const st = vsHand([]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  ok(K.vsPlaceOjama(st, 1, 200, 420));
  eq(K.vsCanStart(st, 0, { x: 200, y: 450 }), false, '黒玉から 30');
  ok(K.vsCanStart(st, 0, { x: 200, y: 470 }), '黒玉から 50 なら引ける');
});
check('花火合戦: 火をつけるのが遅い相手（lag）は、その分遅れて火がつく', () => {
  const st = vsHand([{ type: 'kiku', x: 60, y: 300 }], { lag: [0, 0.25] });
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70)); K.vsIgnite(st);
  eq(st.heads.length, 0);
  for (let i = 0; i < Math.round(0.25 / K.DT); i++) K.step(st);
  ok(st.heads.length > 0 || st.shells[0].burst, '遅れて火がつく');
});
check('花火合戦: CPU は置ける線を選ぶ・決定的・番付の順に強くなる設定', () => {
  const opts = { seed: 77, bout: 1, moon: 2, ink: [1, 1] };
  const make = () => K.newVsRound(opts);
  const a = K.vsPlan(make, 1, K.RIVALS[2], K.rng32(5)), b = K.vsPlan(make, 1, K.RIVALS[2], K.rng32(5));
  ok(a && a.length >= 3); eq(JSON.stringify(a), JSON.stringify(b));
  const st = make(); ok(K.vsPlace(st, 1, a, { normalized: true }), '置ける');
  // あなたの返し手も、相手の線から離れて引きはじめる
  const mk2 = () => { const t = make(); K.vsPlace(t, 1, a, { normalized: true }); return t; };
  const reply = K.vsPlan(mk2, 0, { lines: 4, pick: 1, cut: true }, K.rng32(6));
  const t = mk2(); ok(K.vsPlace(t, 0, reply, { normalized: true }), '返し手も置ける');
  for (let i = 1; i < K.RIVALS.length; i++) for (const k of ['probe', 'lines', 'ojama']) ok((K.RIVALS[i][k] || 0) >= (K.RIVALS[i - 1][k] || 0), `番付 ${i} ${k}`);
  for (const rv of K.RIVALS) for (const k of ['start', 'steal', 'stolen', 'ojama', 'boom', 'win', 'lose']) ok(rv.say[k] && rv.sayEn[k], `${rv.id}.${k}`);
});
check('花火合戦: お手本の台本どおりに起きる（横取り → 相手の黒玉があなたの火を止める → あなたの黒玉で相手の火が消え、あなたの大爆発）', () => {
  const D = K.VS_DEMO;
  // ページと同じ順: 相手の線 → 相手のお邪魔玉 → あなたの線 → あなたのお邪魔玉
  const make = () => { const t = K.newVsDemo(4); K.vsPlace(t, 1, D.rival, { normalized: true }); K.vsPlaceOjama(t, 1, D.ojamaRival.x, D.ojamaRival.y); K.vsPlace(t, 0, D.mine, { normalized: true }); return t; };
  const st = make();
  ok(st.vs.placed[0] && st.vs.placed[1] && st.vs.ojama[1], '線と相手のお邪魔玉を置ける');
  eq(K.vsForecast(make()).kuro[0].crack, 0, '相手の黒玉は、あなたの火を止める');
  const tryIt = make(); ok(K.vsPlaceOjama(tryIt, 0, D.ojamaTry.x, D.ojamaTry.y)); eq(K.vsForecast(tryIt).kuro[1].crack, 0, 'はじめに指を置く所は、あなたの火が止まる');
  ok(K.vsPlaceOjama(st, 0, D.ojamaMine.x, D.ojamaMine.y), 'あなたのお邪魔玉');
  const fc = K.vsForecast(make().vs && (() => { const t = make(); K.vsPlaceOjama(t, 0, D.ojamaMine.x, D.ojamaMine.y); return t; })());
  eq(fc.kuro[1].crack, 1); eq(fc.kuro[1].boom, 0, '交わる所: 相手の火を止めて、あなたの大爆発');
  K.vsIgnite(st);
  const seen = [];
  for (let i = 0; i < 1200 && !st.done; i++) { K.step(st); for (const e of st.events) if (['steal', 'crack', 'kuroBoom'].includes(e.type)) seen.push(`${e.type}${e.o}`); st.events.length = 0; }
  const first = (x) => seen.indexOf(x);
  ok(first('steal0') >= 0 && first('steal0') < first('crack0') && first('crack0') <= first('crack1') && first('crack1') < first('kuroBoom0'), seen.join(' '));
  ok(!seen.includes('steal1') && !seen.includes('kuroBoom1'), '相手は横取りも大爆発もしない');
  eq(st.result.winner, 0, 'お手本はあなたの勝ち');
});
check('花火合戦: ひとりの夜のルール変更（減衰・大トリ・湿った玉・お守り・墨壺）の前と、まったく同じ結果になる', () => {
  // 値は、ルール変更の前の core.js で CPU どうしを戦わせて取った（seed 4242・月は (seed + 番) % 8）
  const want = {
    0: { shells: 34, score: [570, 45], pops: [14, 2], steals: [11, 0], kuro: [1, 0] },
    1: { shells: 38, score: [1020, 660], pops: [21, 13], steals: [1, 1], kuro: [0, 0] },
    2: { shells: 46, clouds: [[226, 394, 43], [174, 228, 45]], score: [17270, 300], pops: [39, 6], steals: [7, 5], kuro: [2, 0] },
  };
  const seed = 4242;
  for (let bout = 0; bout < K.VS_BOUTS.length; bout++) {
    const opts = { seed, bout, moon: (seed + bout) % 8 };
    const a = K.vsFirstPlan(() => K.newVsRound(opts), 1, K.RIVALS[2], K.rng32(seed + bout));
    const mk = () => { const t = K.newVsRound(opts); K.vsPlace(t, 1, a.pts, { normalized: true }); if (a.ojama) K.vsPlaceOjama(t, 1, a.ojama.x, a.ojama.y); return t; };
    const b = K.vsPlan(mk, 0, { lines: 3, pick: 1, cut: true }, K.rng32(seed * 3 + bout));
    const mk2 = () => { const t = mk(); K.vsPlace(t, 0, b, { normalized: true }); return t; };
    const c = K.vsOjamaPlan(mk2, 0, K.RIVALS[1], K.rng32(seed * 5 + bout));
    const st = mk2(); if (c) K.vsPlaceOjama(st, 0, c.x, c.y);
    K.vsIgnite(st);
    const r = K.runVs(st), w = want[bout];
    eq(st.shells.length, w.shells, `${bout} 番: 玉の数`);
    if (w.clouds) eq(JSON.stringify(st.clouds.map((q) => [q.x, q.y, q.r])), JSON.stringify(w.clouds), `${bout} 番: 雲`);
    for (const k of ['score', 'pops', 'steals', 'kuro']) eq(JSON.stringify(r[k]), JSON.stringify(w[k]), `${bout} 番: ${k}`);
  }
  // 花火合戦の尺玉は、爆発でもひらき、倍率 +3 のまま
  const st = vsHand([{ type: 'ootama', x: 140, y: 300 }, { type: 'shaku', x: 200, y: 300 }]);
  K.vsPlace(st, 0, line(100, 300, 145, 300, 10)); K.vsIgnite(st);
  const r = K.runVs(st);
  eq(r.pops[0], 2); eq(r.mult[0], 1 + 3);
});

check('花火合戦: 挑戦状のリンクと、シェアの文', () => {
  const code = K.encodeVs(123456789, 3, 'wlw');
  eq(JSON.stringify(K.decodeVs(code)), JSON.stringify({ seed: 123456789, rival: 3, marks: 'wlw' }));
  for (const bad of ['', 'zz', 'abc.9.w', 'abc.1.x', '<script>.1.w']) eq(K.decodeVs(bad), null, bad);
  const res = (w, s0, s1) => ({ winner: w, score: [s0, s1], steals: [2, 0], kuro: [1, 0], back: [0, 0] });
  const ja = K.vsShareText({ rival: 2, winner: 0, results: [res(0, 10, 5), res(1, 1, 5), res(0, 9, 5)] }, 'ja', 'U');
  ok(ja.includes('ドン') && ja.includes('2-1') && ja.includes('🔴🔵🔴') && ja.includes('横取り 6') && ja.includes('大爆発 3'), ja);
  ok(K.vsShareText({ rival: 0, winner: 1, results: [res(1, 1, 5), res(1, 1, 5)] }, 'en', 'U').includes('lost 0-2'));
});

check('世界の花火の日は日付だけで決まり、デイリーの共有文に一行入る', () => {
  eq(K.festivalOf('2026-11-05').id, 'bonfire');
  eq(K.festivalOf('2026-12-31').id, 'nye');
  eq(K.festivalOf('2027-01-01').id, 'newyear');
  eq(K.festivalOf('2026-07-04').id, 'july4');
  eq(K.festivalOf('2026-11-08').id, 'diwali');
  eq(K.festivalOf('2027-11-08'), null, 'ディワリは確かめた年だけ');
  eq(K.festivalOf('2026-09-27'), null);
  const run = { daily: true, key: '2026-11-05', no: 41, moon: 0, total: 1000, bestChain: 9, nights: [{ score: 10, target: 5 }] };
  ok(K.runShareText(run, 'ja').includes('イギリスのガイ・フォークス・ナイトの夜に'));
  ok(K.runShareText(run, 'en').includes('On Bonfire Night'));
  ok(!K.runShareText({ ...run, daily: false }, 'ja').includes('ガイ・フォークス'), 'デイリー以外には出さない');
});

if (failures) { console.error(`hitofude_core_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_core_test: ALL PASS');
