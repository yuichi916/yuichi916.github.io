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

check('お守り: 12 個・ID 重複なし・絵文字はカラーで出る・再生リンクの 16bit に収まる', () => {
  eq(K.CHARMS.length, 12);
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

check('目標点: 夜ごとに上がる', () => {
  eq(K.TARGETS.length, K.NIGHTS);
  for (let i = 1; i < K.TARGETS.length; i++) ok(K.TARGETS[i] > K.TARGETS[i - 1]);
});

if (failures) { console.error(`hitofude_core_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_core_test: ALL PASS');
