// 一筆花火の純関数とシミュレーションのテスト。DOM も fetch も使わない。実行: node tests/hitofude_core_test.mjs
import * as K from '../assets/hitofude/core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
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

check('お守り: 15 個・ID 重複なし・絵文字はカラーで出る・再生リンクの 16bit に収まる', () => {
  eq(K.CHARMS.length, 15);
  eq(new Set(K.CHARM_IDS).size, K.CHARMS.length);
  ok(K.CHARMS.length <= 16);
  for (const c of K.CHARMS) {
    ok(c.ja && c.en && c.desc && c.descEn, `${c.id} の文言`);
    ok(/^\p{Emoji_Presentation}$/u.test(c.emoji) || /️$/.test(c.emoji), `${c.id}: ${c.emoji} は白黒の文字で出る`);
  }
});

check('ルール: お守りと月が合わさる', () => {
  const base = K.rulesFor([], 1);
  eq(base.ink, K.BASE_INK);
  const r = K.rulesFor(['nagafude', 'tairin', 'kodou', 'mankai'], 4);
  eq(r.ink, Math.round(K.BASE_INK * 1.4));
  ok(Math.abs(r.radius - 1.3 * 1.12) < 1e-9, 'radius');
  eq(r.pulse, 5); eq(r.bloom, 4);
  eq(K.rulesFor([], 5).startMult, 1, '寝待月は倍率 +1 から');
  eq(K.rulesFor(['nokoribi'], 6).afterglow, 0.25 + 0.4, '残り火と下弦は足し算');
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
  const golds = (moon) => K.makeLayout(7, 3, K.rulesFor([], moon)).filter((s) => s.type === 'kin').length;
  eq(golds(0), golds(4) * 2, '新月は金が 2 倍');
  eq(K.makeLayout(7, 3, K.rulesFor(['mashidama'], 4)).length - K.makeLayout(7, 3, K.rulesFor([], 4)).length >= 5, true, '増し玉');
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

check('金と倍率: 金は倍率 +1、10 連鎖ごとに +1、全部ひらくと ×2', () => {
  const shells = [];
  for (let i = 0; i < 10; i++) shells.push({ type: i === 0 ? 'kin' : 'kiku', x: 30 + i * 30, y: 300 });
  const st = handRound(shells);
  const res = K.runToEnd(st, [line(20, 300, 340, 300, 80)]);
  eq(res.pops, 10); eq(res.allClear, true);
  eq(res.chips, 5 + 9 * 10);
  eq(res.mult, 1 + 1 + 1, '金 +1・10 連鎖 +1');
  eq(res.score, 95 * 3 * 2);
  const st2 = handRound(shells.map((s) => ({ ...s })), ['kinun', 'mankai', 'kodou']);
  const r2 = K.runToEnd(st2, [line(20, 300, 340, 300, 80)]);
  eq(r2.mult, 1 + 2 + 2, '金運 +2・鼓動は 5 連鎖ごと');
  eq(r2.score, 95 * 5 * 4, '満開の加護 ×4');
});

check('終わり玉と折れ火: 線の終わりと鋭い角で爆ぜる', () => {
  const st = handRound([{ type: 'kiku', x: 200, y: 360 }], ['owaridama']);
  const res = K.runToEnd(st, [line(40, 300, 200, 300)]);  // 終点から 60 下に玉 → 終わり玉（R=80）で届く
  eq(res.pops, 1);
  const zig = [{ x: 60, y: 300 }, { x: 160, y: 300 }, { x: 60, y: 310 }];
  const st2 = handRound([{ type: 'kiku', x: 160, y: 340 }], ['orebi']);
  const r2 = K.runToEnd(st2, [[...line(60, 300, 160, 300, 25), ...line(160, 300, 60, 310, 25).slice(1)]]);
  eq(r2.pops, 1, '折れ火で角が爆ぜる');
  void zig;
});

check('二筆目: 25 個ひらいて残りがあれば、もう1本（墨は半分）', () => {
  const shells = [];
  for (let i = 0; i < 26; i++) shells.push({ type: 'kiku', x: 20 + (i % 13) * 26, y: i < 13 ? 200 : 202 });
  shells.push({ type: 'kiku', x: 180, y: 450 });
  const st = handRound(shells, ['nihitsu']);
  K.lightStroke(st, line(10, 201, 350, 201, 90));
  for (let i = 0; i < 3600 && st.phase !== 'draw2' && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.phase, 'draw2');
  eq(st.ink, Math.round(st.rules.ink / 2));
  K.lightStroke(st, line(170, 450, 190, 450, 6));
  for (let i = 0; i < 3600 && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.result.allClear, true);
});

check('決定的: 同じ夜・同じ線なら、同じ点', () => {
  for (let night = 0; night < K.NIGHTS; night++) {
    const mk = () => K.newRound({ seed: 777, night, charms: ['nokoribi', 'senrin'], moon: 6 });
    const a = mk(), b = mk();
    const stroke = line(30, 150 + night * 30, 330, 420 - night * 20, 60);
    eq(JSON.stringify(K.runToEnd(a, [stroke])), JSON.stringify(K.runToEnd(b, [stroke])), `night ${night}`);
  }
});

check('お守りの候補: 決定的・3 つ・持っているものは出ない', () => {
  const a = K.offerCharms(5, 2, ['tairin']), b = K.offerCharms(5, 2, ['tairin']);
  eq(a.join(), b.join());
  eq(a.length, 3);
  ok(!a.includes('tairin'));
  eq(new Set(a).size, 3);
});

check('勝負リンク: 戻すと同じ・細工したものは読まない', () => {
  const s = K.encodeDuel(4294967295, 7, 123456);
  eq(JSON.stringify(K.decodeDuel(s)), JSON.stringify({ seed: 4294967295, moon: 7, score: 123456 }));
  eq(K.decodeDuel(K.encodeDuel(12, 3)).score, 0);
  for (const bad of ['', 'x', 'zzzzzzzz.1', 'abc.8', 'abc.1.<b>', null, 'abc.1.1234567890123']) eq(K.decodeDuel(bad), null, String(bad));
});

check('再生リンク: 一筆を戻すと同じ点になる・細工したものは読まない', () => {
  const rng = K.rng32(5);
  for (let i = 0; i < 20; i++) {
    const night = i % K.NIGHTS, moon = i % 8;
    const charms = K.CHARM_IDS.filter(() => rng() < 0.3);
    const st = K.newRound({ seed: 1000 + i, night, charms, moon });
    const used = K.lightStroke(st, line(rng() * 360, 100 + rng() * 400, rng() * 360, 100 + rng() * 400, 50));
    if (!used) continue;
    for (let n = 0; n < 3600 && !st.done; n++) { if (st.phase === 'draw2') K.finish(st); else K.step(st); st.events.length = 0; }
    const code = K.encodeReplay({ seed: 1000 + i, moon, night, charms, strokes: st.strokes });
    ok(/^[A-Za-z0-9_-]+$/.test(code) && code.length < 700, `長さ ${code.length}`);
    const back = K.decodeReplay(code);
    ok(back, '戻らない');
    eq(JSON.stringify(back.strokes), JSON.stringify(st.strokes));
    eq(back.charms.join(), charms.join());
    const again = K.newRound({ seed: back.seed, night: back.night, charms: back.charms, moon: back.moon });
    const r2 = K.runToEnd(again, back.strokes, { normalized: true });
    eq(r2.score, st.result.score, '再生で点が変わった');
  }
  eq(K.decodeReplay(''), null);
  eq(K.decodeReplay('<script>alert(1)</script>'), null);
  eq(K.decodeReplay('A'.repeat(800)), null);
  const good = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  eq(K.decodeReplay('A' + good.slice(1)), null, '版が違う');
  eq(K.decodeReplay(good.slice(0, 10)), null, '短い');
  const far = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 400, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  eq(K.decodeReplay(far), null, '画面の外の点');
});

check('共有文: 夜ごとの印と点・答え（線）は入れない', () => {
  const run = {
    daily: true, key: '2026-09-27', no: 2, moon: 4, total: 123456, bestChain: 58,
    nights: [{ score: 900, target: 80 }, { score: 300, target: 250 }, { score: 100, target: 600 }],
  };
  const ja = K.runShareText(run, 'ja');
  ok(ja.startsWith('一筆花火 #2 9/27 満月'), ja);
  ok(ja.includes('🎆✨💥🌑🌑🌑🌑🌑'), ja);
  ok(ja.includes('2/8 夜') && ja.includes('123,456点') && ja.includes('最大 58連鎖') && ja.includes(K.HASHTAG), ja);
  const en = K.runShareText({ ...run, daily: false }, 'en');
  ok(en.startsWith('Hitofude Hanabi\n') && en.includes('best chain 58'), en);
  const all = K.runShareText({ ...run, nights: Array(8).fill({ score: 10, target: 1 }) }, 'ja');
  ok(all.includes('八夜 完走'), all);
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
  eq(maker.chips, 10 + 8 * 10 * 3, '提灯職人は 3 倍');
});

check('湿った玉: 同じ火が何度当たってもひらかず、別の火が当たるとひらく', () => {
  const mk = (charms = []) => { const st = handRound([{ type: 'shime', x: 200, y: 300 }], charms); st.shells[0].hp = st.rules.dampHits; return st; };
  const one = K.runToEnd(mk(), [line(150, 300, 250, 300, 30)]);
  eq(one.pops, 0, '1 本の線だけではひらかない');
  const st = mk();
  st.rules.secondStroke = true; st.secondUsed = true;
  K.lightStroke(st, line(150, 300, 250, 300, 30));
  for (let i = 0; i < 600 && !st.done; i++) { if (i === 5) st.explosions.push({ id: 999, x: 200, y: 330, R: 30, t: 0, cause: 'test', hue: 0 }); K.step(st); st.events.length = 0; }
  eq(st.result.pops, 1, '線と爆発の 2 つでひらく');
  eq(K.runToEnd(mk(['amayoke']), [line(150, 300, 250, 300, 30)]).pops, 1, '雨よけなら 1 回');
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

check('尺玉: ひらくと倍率 +3', () => {
  const r = K.runToEnd(handRound([{ type: 'shaku', x: 200, y: 300 }]), [line(150, 300, 250, 300, 30)]);
  eq(r.pops, 1); eq(r.mult, 1 + 3); eq(r.chips, 200);
});

check('目標点: 夜ごとに上がる', () => {
  eq(K.TARGETS.length, K.NIGHTS);
  for (let i = 1; i < K.TARGETS.length; i++) ok(K.TARGETS[i] > K.TARGETS[i - 1]);
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
      ok(a.length >= K.BASE_COUNTS[n] + 6 - 3, `seed ${seed} night ${n} (${K.sceneFor(seed, n).id}): ${a.length} 個しか置けない`);
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
    eq(K.targetFor(seed, 5), Math.round(K.TARGETS[5] * b.target / 10) * 10);
    eq(K.targetFor(seed, 4), K.TARGETS[4]);
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

check('お守り: 大一番のあとの 2 つ目は、別の 3 つ（持っているものは出ない）', () => {
  const a = K.offerCharms(77, 5, ['kodou']), b = K.offerCharms(77, 5, ['kodou', a[0]], 1);
  eq(b.length, 3); ok(!b.includes('kodou') && !b.includes(a[0]));
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
  ok(ja.includes('筆跡 ⚡稲妻') && ja.includes('大一番 鏡⭕'), ja);
  ok(en.includes('Stroke ⚡Lightning') && en.includes('Boss Mirror⭕'), en);
  ok(!K.runShareText({ ...run, type: null, nights: [{ score: 100, target: 60 }] }, 'ja').includes('大一番'));
});

check('再生リンク: 前の版のリンクは「前の版」とわかる', () => {
  const v1 = 'E' + K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] }).slice(1);
  const d = K.decodeReplay(v1);
  ok(d && d.old, JSON.stringify(d));
});

if (failures) { console.error(`hitofude_core_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_core_test: ALL PASS');
