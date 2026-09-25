// 化けくらべの純関数テスト。DOM も fetch も使わない。実行: node tests/bakekurabe_core_test.mjs
import * as K from '../assets/bakekurabe/core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'not ok'); }

check('色: 64 色以内（挑戦状は 6bit で持つ）・目の色は場面の色と別', () => {
  ok(K.PALETTE.length <= 64, `${K.PALETTE.length} 色`);
  for (const c of K.PALETTE) ok(c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
  ok(!K.PALETTE.some((c) => c.join() === K.EYE_RGB.join()), '目の色が塗れてしまう');
});

check('たぬき: 目は 2 つで、まぶたの色を借りる体の画素がある', () => {
  eq(K.EYES.length, 2);
  for (const e of K.EYES) ok(e.lid >= 0 && K.BODY[e.lid].y === e.y && K.BODY[e.lid].x === e.x - 1, 'まぶたの画素');
  eq(K.NATURAL_PAINT.length, K.BODY.length);
  ok(K.BODY.length > 90 && K.BODY.length < 160, `体の画素 ${K.BODY.length}`);
});

check('場面: 同じシードなら同じ絵、違うシードなら違う絵、番号はすべて色の範囲内', () => {
  for (const kind of K.KINDS) {
    const a = K.makeScene(kind, 12345, 0.5), b = K.makeScene(kind, 12345, 0.5), c = K.makeScene(kind, 999, 0.5);
    eq(a.px.length, K.W * K.H);
    ok(a.px.every((v, i) => v === b.px[i]), `${kind}: 決定的でない`);
    ok(a.px.some((v, i) => v !== c.px[i]), `${kind}: シードで変わらない`);
    ok(a.px.every((v) => v < K.PALETTE.length), `${kind}: 範囲外の色`);
    for (const tw of a.fx.twinkles) ok(tw.x >= 0 && tw.x < K.W && tw.y >= 0 && tw.y < K.H, `${kind}: またたきが外`);
    // 1 色だけの絵にはならない（模様がないと隠れられない）
    ok(new Set(a.px).size >= 12, `${kind}: 色数 ${new Set(a.px).size}`);
  }
});

check('日付: 日本時間の 0 時で切り替わる', () => {
  eq(K.jstDateKey(new Date('2026-09-25T14:59:59Z')), '2026-09-25');
  eq(K.jstDateKey(new Date('2026-09-25T15:00:00Z')), '2026-09-26');
  eq(K.dayNumber('2026-09-26'), 1);
  eq(K.dayNumber('2026-10-01'), 6);
  eq(K.addDays('2026-09-30', 1), '2026-10-01');
  eq(K.weekday('2026-09-26'), 6);
  ok(K.isDateKey('2026-09-26') && !K.isDateKey('2026-9-26') && !K.isDateKey(null));
});

check('月齢: 2026-09-27 01:49 の満月の前夜は、ほぼ満月', () => {
  const p = K.moonPhase('2026-09-26');
  ok(p > 0.48 && p < 0.51, `moonPhase ${p}`);
  const q = K.moonPhase('2026-10-11');
  ok(q < 0.06 || q > 0.94, `2026-10-11 は新月のころ: ${q}`);
});

check('今夜のお題: 決定的・5 匹・場面の中・重ならない・曜日どおりの難しさ', () => {
  for (let d = 0; d < 21; d++) {
    const key = K.addDays('2026-09-26', d);
    const a = K.dailyPuzzle(key), b = K.dailyPuzzle(key);
    eq(a.tanuki.length, K.DAILY_COUNT, key);
    eq(JSON.stringify(a.tanuki), JSON.stringify(b.tanuki), `${key}: 決定的でない`);
    eq(a.tanuki.map((t) => t.level).join(), K.WEEK_LEVELS[K.weekday(key)].join(), `${key}: 難しさ`);
    for (const t of a.tanuki) {
      ok(K.inBounds(t), `${key}: 場面の外`);
      eq(t.paint.length, K.BODY.length);
      ok(t.paint.every((c) => c < K.PALETTE.length));
      ok(t.peek.period > t.peek.open && t.peek.open > 0.3);
    }
    for (let i = 0; i < a.tanuki.length; i++) for (let j = i + 1; j < a.tanuki.length; j++) {
      const p = a.tanuki[i], q = a.tanuki[j];
      const apart = p.x + K.SW <= q.x || q.x + K.SW <= p.x || p.y + K.SH <= q.y || q.y + K.SH <= p.y;
      ok(apart, `${key}: ${i} と ${j} が重なる`);
    }
  }
  eq(K.dailyPuzzle('2026-09-26').no, 1);
  eq(K.dailyPuzzle('2026-09-27').special.ja, '満月');
});

check('化け度: 写しきれば 100、塗らなければ低い、平均では 塗らない < 1 色 < ほぼ写す', () => {
  const rng = K.rng32(7);
  const sums = { 1: 0, 2: 0, 4: 0 };
  let n = 0;
  for (const kind of K.KINDS) {
    const sc = K.makeScene(kind, 42, 0.5);
    for (let i = 0; i < 30; i++) {
      const pos = { x: Math.floor(rng() * (K.W - K.SW)), y: 60 + Math.floor(rng() * (K.H - K.SH - 60)), flip: rng() < 0.5 };
      eq(K.bakeScore(sc.px, pos, K.autoPaint(sc.px, pos, 5, rng)), 100, '写しきった');
      for (const lv of [1, 2, 4]) sums[lv] += K.bakeScore(sc.px, pos, K.autoPaint(sc.px, pos, lv, rng));
      n++;
    }
  }
  const avg = (lv) => sums[lv] / n;
  ok(avg(1) < 35, `塗らない ${avg(1)}`);
  ok(avg(1) < avg(2) && avg(2) < avg(4), `平均 ${avg(1)} / ${avg(2)} / ${avg(4)}`);
  eq(K.rankFor(100).ja, '伝説の化けだぬき');
  eq(K.rankFor(0).ja, 'まる見えだぬき');
});

check('挑戦状: 符号化して戻すと同じ・URL に収まる長さ', () => {
  const rng = K.rng32(3);
  for (let i = 0; i < 40; i++) {
    const ch = {
      kind: K.KINDS[i % K.KINDS.length], seed: Math.floor(rng() * 4294967296) >>> 0,
      x: Math.floor(rng() * (K.W - K.SW + 1)), y: Math.floor(rng() * (K.H - K.SH + 1)), flip: rng() < 0.5,
      phase: Math.round(rng() * 63) / 63, paint: K.BODY.map(() => Math.floor(rng() * K.PALETTE.length)),
    };
    const code = K.encodeChallenge(ch);
    ok(/^[A-Za-z0-9_-]+$/.test(code), 'URL に使えない文字');
    ok(code.length < 200, `長さ ${code.length}`);
    const back = K.decodeChallenge(code);
    ok(back, '戻らない');
    for (const k of ['kind', 'seed', 'x', 'y', 'flip']) eq(back[k], ch[k], k);
    ok(Math.abs(back.phase - ch.phase) < 1e-9, 'phase');
    eq(back.paint.join(), ch.paint.join(), 'paint');
  }
});

check('挑戦状: 壊れた・細工したリンクは読まない', () => {
  const good = K.encodeChallenge({ kind: 'jinja', seed: 1, x: 10, y: 20, flip: false, phase: 0.5, paint: K.NATURAL_PAINT });
  eq(K.decodeChallenge(''), null);
  eq(K.decodeChallenge(null), null);
  eq(K.decodeChallenge('<script>'), null);
  eq(K.decodeChallenge(good.slice(0, 20)), null, '短すぎる');
  eq(K.decodeChallenge('x'.repeat(500)), null, '長すぎる');
  eq(K.decodeChallenge('A' + good.slice(1)), null, '版が違う');
  // 場面の外に置いたたぬき（y = 255）
  const out = K.encodeChallenge({ kind: 'jinja', seed: 1, x: 10, y: 255, flip: false, phase: 0.5, paint: K.NATURAL_PAINT });
  eq(K.decodeChallenge(out), null, '場面の外');
  // 色の番号が範囲外（63）
  const bad = K.encodeChallenge({ kind: 'jinja', seed: 1, x: 10, y: 20, flip: false, phase: 0.5, paint: K.BODY.map(() => 63) });
  eq(K.decodeChallenge(bad), null, '範囲外の色');
});

check('連続記録: 毎日なら伸びる・1 日の休みは 7 日に 1 回まで見逃す', () => {
  let s = K.nextStreak(null, '2026-09-26');
  eq(s.streak, 1);
  eq(K.nextStreak(s, '2026-09-26').streak, 1, '同じ日は数えない');
  s = K.nextStreak(s, '2026-09-27'); eq(s.streak, 2);
  s = K.nextStreak(s, '2026-09-29'); eq(s.streak, 3, '1 日休み（見逃す）');
  eq(s.freezeOn, '2026-09-28');
  const again = K.nextStreak(s, '2026-10-01'); eq(again.streak, 1, '7 日以内の 2 回目の休みは切れる');
  s = K.nextStreak(K.nextStreak(s, '2026-09-30'), '2026-10-01');
  eq(K.nextStreak({ ...s, last: '2026-10-05' }, '2026-10-07').streak, s.streak + 1, '7 日たてば また見逃す');
  eq(K.nextStreak(s, '2026-10-05').streak, 1, '3 日以上の休み');
});

check('今の連続記録: 昨日までなら続いている・空きすぎたら 0', () => {
  const s = { streak: 4, last: '2026-09-29', freezeOn: null };
  eq(K.currentStreak(s, '2026-09-29'), 4);
  eq(K.currentStreak(s, '2026-09-30'), 4);
  eq(K.currentStreak(s, '2026-10-01'), 4, 'まだ 1 日休みを見逃せる');
  eq(K.currentStreak({ ...s, freezeOn: '2026-09-27' }, '2026-10-01'), 0, '見逃しを使ったばかり');
  eq(K.currentStreak(s, '2026-10-02'), 0);
  eq(K.currentStreak(null, '2026-10-02'), 0);
});

check('結果: ネタバレしない共有文（場所・座標を含まない）', () => {
  const r = {
    key: '2026-09-27', no: 2, special: K.SPECIAL_DAYS['2026-09-27'], ms: 38200, misses: 2, hints: 0,
    results: [{ found: true, split: 3 }, { found: true, split: 12 }, { found: true, split: 25 }, { found: true, split: 50 }, { found: false }],
  };
  const ja = K.dailyShareText(r, 'ja');
  ok(ja.startsWith('化けくらべ #2 9/27 🌕満月'), ja);
  ok(ja.includes('🟩🟨🟧🟥⬛ 4/5匹'), ja);
  ok(ja.includes('38.2秒') && ja.includes(K.SITE_URL) && ja.includes(K.HASHTAG), ja);
  ok(!/\bx\b|\by\b|座標/.test(ja), '座標が入っている');
  const en = K.dailyShareText(r, 'en');
  ok(en.startsWith('Bakekurabe #2 9/27 🌕Full moon') && en.includes('38.2s'), en);
  const pr = K.dailyShareText({ ...r, practice: true }, 'ja');
  ok(pr.startsWith('化けくらべ（練習）') && !pr.includes('9/27'), pr);
  eq(K.markFor({ found: true, hinted: true, split: 1 }), '🟥', 'ヒントを使った子');
});

check('みんなの中の位置: 10 人未満は出さない・速い区分ほど上位', () => {
  eq(K.topPercent([1, 2, 3, 0], 0), null);
  eq(K.topPercent([10, 10, 10, 10], 0), 13);
  eq(K.topPercent([10, 10, 10, 10], 3), 88);
  eq(K.timeBucket(29999), 0);
  eq(K.timeBucket(30000), 1);
  eq(K.timeBucket(500000), 3);
});

if (failures) { console.error(`bakekurabe_core_test: ${failures} FAILED`); process.exit(1); }
console.log('bakekurabe_core_test: ALL PASS');
