// まぜる漢字: assets/kanji-core.js の検査（node scripts/kanji/test_core.mjs）
// 判定・点・段位・共有文・問題の生成・和同開珎の一意性を、既知の正解と負例で確かめる。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const K = require('../../assets/kanji-core.js');
const rd = (p) => readFileSync(new URL('../../data/kanji/' + p, import.meta.url), 'utf8');
const W = JSON.parse(rd('words.json'));
const GRADE = JSON.parse(rd('kanji.json'));
const DAILY = JSON.parse(rd('daily.json'));
const EXTRA_TXT = rd('extra.txt');
const EXTRA = new Set(EXTRA_TXT.split('\n'));
const idx = K.makeIndex(W.common, W.proper, GRADE);

let fails = 0, oks = 0;
const ok = (c, m) => { if (c) oks++; else { console.log('FAIL ' + m); fails++; } };
ok(!EXTRA_TXT.includes(String.fromCharCode(13)), 'extra.txt は LF 区切り（CR が混ざるとブラウザの照合が全部外れる）');
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' — got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));

// ---------------- 点と段位
eq([K.points('火山'), K.points('図書館'), K.points('一石二鳥'), K.points('火')], [1, 3, 5, 0], '点: 2字=1 3字=3 4字=5');
eq(K.totalPoints(['火山', '図書館', '一石二鳥']), 9, '合計点');
eq(K.rankThresholds(20), [0, 2, 5, 8, 12, 16, 20], '段位のしきい値（満点20）');
eq(K.rankOf(0, 20).name + K.rankOf(0, 20).next + K.rankOf(0, 20).need, '見習い手習い2', '0点は見習い、次まで2点');
eq(K.rankOf(8, 20).name, '職人', '8/20 は職人（40%）');
eq(K.rankOf(11, 20).need, 1, '11/20 は名人まであと1点');
eq([K.rankOf(20, 20).name, K.rankOf(20, 20).next], ['漢字王', null], '満点は漢字王で次はない');
eq(K.rankOf(19, 20).name, '達人', '19/20 は達人（漢字王は満点だけ）');

// ---------------- 盤の答え（中央の字は必須ではない。質2は答えにしない）
const A = K.answers(idx, '火', '山花大人口水').map((r) => r[0]);
for (const w of ['火山', '花火', '大人', '人口', '火口', '大火']) ok(A.includes(w), `火/山花大人口水 の答えに ${w}`);
ok(!K.answers(idx, '山', '花大人口水金').some((r) => r[0] === '火山'), '火 が盤に無ければ 火山 は答えにならない');
ok(A.every((w) => [...w].every((c) => '火山花大人口水'.includes(c))), '答えは盤の字だけでできている');
ok(K.answers(idx, '火', '山花大人口水').every((r) => r[3] !== 2), '質2の語は答えにしない');

// ---------------- 判定
const ctx = (found = []) => ({ center: '火', letters: '火山花大人口水', answerSet: new Set(A), found: new Set(found),
  isExtra: (w) => idx.byWord.has(w) || EXTRA.has(w) });
eq(K.judge('火山', ctx()).kind, 'ok', '正解');
eq(K.judge(' 火 山 ', ctx()).kind, 'ok', '空白は無視');
eq(K.judge('火山', ctx(['火山'])).kind, 'dup', '見つけ済み');
eq(K.judge('火', ctx()).kind, 'short', '1字は短い');
eq(K.judge('火山大人口', ctx()).kind, 'long', '5字は長い');
eq(K.judge('かざん', ctx()).kind, 'kana', 'ひらがなは変換を促す');
const bc = K.judge('火金', ctx()); eq([bc.kind, bc.bad], ['badchar', '金'], '盤にない字');
// 「辞書にはある言葉」: 日替わりの盤の中から、盤の字だけでできた extra の語を探して判定する
let exDay = null, ex = null;
for (const d of DAILY.days) { ex = [...EXTRA].find((w) => w.length >= 2 && [...w].every((c) => (d.c + d.o).includes(c))); if (ex) { exDay = d; break; } }
ok(!!ex, '盤の字だけでできた「辞書にはある言葉」がある: ' + (exDay && exDay.d) + ' ' + ex);
eq(K.judge(ex, { center: exDay.c, letters: exDay.c + exDay.o, answerSet: new Set(exDay.a), found: new Set(), isExtra: (w) => idx.byWord.has(w) || EXTRA.has(w) }).kind, 'extra', '辞書にはある言葉（' + ex + '）');
ok(!exDay.a.includes(ex), '辞書にはある言葉は答えに入っていない');
const none = ['水大', '口花', '人水', '山口大'].find((w) => !idx.byWord.has(w) && !EXTRA.has(w));
eq(K.judge(none, ctx()).kind, 'none', '辞書にない（' + none + '）');
eq(K.judge('火山', { ...ctx(), answerSet: new Set(), isExtra: () => null }).kind, 'pending', '辞書の読み込み前は保留');
// 負例: 質2の語（common だが答えにしない）は extra 扱い
const q2 = W.common.find((r) => r[3] === 2 && r[0].length === 2);
const q2ctx = { center: q2[0][0], letters: q2[0] + '一二三四五', answerSet: new Set(K.answers(idx, q2[0][0], q2[0][1] + '一二三四五').map((r) => r[0])), found: new Set(), isExtra: (w) => idx.byWord.has(w) || EXTRA.has(w) };
eq(K.judge(q2[0], q2ctx).kind, 'extra', '質2の語 ' + q2[0] + ' は「辞書にはある言葉」');

// ---------------- 共有文とゲージ
eq(K.gauge(0, 10), '⬜'.repeat(9), 'ゲージ 0');
eq(K.gauge(1, 30), '🟩' + '⬜'.repeat(8), '1語でも1マス');
eq(K.gauge(14, 23), '🟩'.repeat(5) + '⬜'.repeat(4), '14/23 は5マス');
eq(K.gauge(29, 30), '🟩'.repeat(8) + '⬜', '全部でなければ8マスまで');
eq(K.gauge(30, 30), '🟩'.repeat(9), '全部で9マス');
eq(K.shareText({ date: '2026-10-25', center: '海', rank: '名人', found: 14, total: 23 }),
  'まぜる漢字 10/25「海」\n名人 ★14語 / 23語\n🟩🟩🟩🟩🟩⬜⬜⬜⬜\n#まぜる漢字\nhttps://yuichi916.github.io/mazeru.html?ref=daily', '共有文（仕様の例と同じ形）');
ok(!K.shareText({ date: '2026-10-25', center: '海', rank: '名人', found: 14, total: 23 }).includes('海水'), '共有文に答えが入らない');

// ---------------- ヒント表
const hg = K.hintGrid(['火山', '火口', '花火', '大人', '人口', '花火大会'.slice(0, 3)], new Set(['火山']));
eq([hg.cells['火'][2], hg.cells['花'][2], hg.cells['花'][3], hg.rest], [[1, 2], [1, 1], [1, 1], 5], 'ヒント表（残り/全部）');

// ---------------- 日付
eq(K.jstDate(Date.UTC(2026, 9, 24, 15, 0, 0)), '2026-10-25', '日本時間の0時で日付が変わる');
eq(K.jstDate(Date.UTC(2026, 9, 24, 14, 59, 59)), '2026-10-24', '日本時間の23:59はまだ前日');
eq(K.msToNextJstMidnight(Date.UTC(2026, 9, 25, 14, 59, 0)), 60000, '次の0時まで');
eq(K.addDays('2026-12-31', 1), '2027-01-01', '年またぎ');
eq(K.daysBetween('2026-10-25', '2027-12-31'), 432, '日数');
eq(K.streak(['2026-10-23', '2026-10-24', '2026-10-25'], '2026-10-25'), 3, '連続3日');
eq(K.streak(['2026-10-23', '2026-10-24'], '2026-10-25'), 2, '今日まだでも昨日まで続いていれば2');
eq(K.streak(['2026-10-22', '2026-10-24'], '2026-10-25'), 1, '1日空くと切れる');

// ---------------- 日替わりの表（Python で作った答えと、JS の答えが全日で一致）
eq(DAILY.days.length, 433, '2026-10-25〜2027-12-31 の433日');
let dmis = 0;
for (const d of DAILY.days) {
  const js = K.answers(idx, d.c, d.o).map((r) => r[0]);
  if (JSON.stringify(js) !== JSON.stringify(d.a)) { dmis++; if (dmis < 3) console.log('  ずれ', d.d, d.c, d.o); }
  ok(GRADE[d.c] <= 6 && [...d.o].every((c) => GRADE[c] <= 8) && new Set(d.c + d.o).size === 7, d.d + ' の盤の字');
  ok(d.a.length >= 12 && d.a.length <= 30, d.d + ' の答えの数 ' + d.a.length);
}
eq(dmis, 0, '全日で JS の答え＝daily.json の答え');
for (let i = 0; i < DAILY.days.length; i++) for (let j = Math.max(0, i - 14); j < i; j++)
  if (DAILY.days[i].c === DAILY.days[j].c) ok(false, '前後14日で中央の字が重なる ' + DAILY.days[i].d);

// ---------------- れんしゅうの問題（学年・答えの数・同じ種なら同じ問題）
const PO = { 2: [6, 20, 10], 4: [6, 20, 12], 6: [6, 20, 13], 8: [6, 20, 14] };
for (const g of [2, 4, 6, 8]) {
  let made = 0;
  for (let s = 0; s < 12; s++) {
    const o = () => ({ maxGrade: g, centerMaxGrade: Math.min(g, 6), min: PO[g][0], max: PO[g][1], target: PO[g][2], needLong: g >= 4, minUse: 1,
      centerShare: 0.35, minCenter: 3, maxQ1: g <= 4 ? 2 : 4, rng: K.rng('p' + g + ':s' + s), tries: 60 });
    const p = K.makePuzzle(idx, o()), p2 = K.makePuzzle(idx, o());
    if (!p) continue;
    made++;
    ok(JSON.stringify(p) === JSON.stringify(p2), `小${g} 種${s}: 同じ種なら同じ問題`);
    ok(p.answers.length >= 6 && p.answers.length <= 20, `小${g}: 答え ${p.answers.length} 語`);
    ok([...(p.center + p.outer)].every((c) => GRADE[c] <= g), `小${g}: 盤の字は学年の範囲`);
    ok(p.answers.every((r) => r[2] <= g && r[3] !== 2), `小${g}: 答えも学年の範囲で質2なし`);
    eq(p.answers.map((r) => r[0]), K.answers(idx, p.center, p.outer).map((r) => r[0]), `小${g}: 答えを作り直して一致`);
  }
  ok(made === 12, `学年 ${g}: 12問すべて作れた（${made}）`);
}

// ---------------- 和同開珎の一意性
const twoAll = K.makeTwoIndex(W.common);
const COMMON2 = new Set(W.common.filter((r) => r[0].length === 2).map((r) => r[0]));
const kanjiAll = Object.keys(GRADE);
// 索引を使わない素朴な検算: 常用漢字を全部当てはめて、4つとも common の2字語になる字を数える
const brute = (p) => kanjiAll.filter((y) => COMMON2.has(p.up + y) && COMMON2.has(p.left + y) && COMMON2.has(y + p.right) && COMMON2.has(y + p.down));
const LV = { low: [2, 1, 0], high: [6, 2, 0], mid: [8, 3, 0], adult: [8, 4, 1] };
let nW = 0;
for (const [name, [mg, minX, mq]] of Object.entries(LV)) {
  const twoOk = K.makeTwoIndex(W.common, (r) => r[2] <= mg && r[3] <= mq);
  for (let s = 0; s < 3; s++) {
    const r = K.rng('t:' + name + s), avoid = new Set();
    for (let i = 0; i < 12; i++) {
      const p = K.makeWadou(idx, twoOk, twoAll, { maxGrade: mg, minXGrade: minX, rng: r, avoid });
      ok(!!p, `${name}: ${i + 1}問目が作れた`);
      if (!p) break;
      avoid.add(p.x); nW++;
      eq(brute(p), [p.x], `${name}: ${p.up}${p.left}□${p.right}${p.down} の答えは ${p.x} だけ（素朴な検算）`);
      ok(p.words.every((w) => COMMON2.has(w) && [...w].every((c) => GRADE[c] <= mg)), `${name}: 4つの語は common で学年の範囲`);
      ok(GRADE[p.x] >= minX, `${name}: □の字の学年が下限以上`);
    }
  }
}
console.log('  和同開珎: ' + nW + ' 問を素朴な検算で一意と確認');
// 既知の例: 大学・入学・学校・学生（大・入 → 学 → 校・生）
const known = { x: '学', up: '大', left: '入', right: '校', down: '生' };
ok(brute(known).includes('学'), '既知の例: 学 は 大□・入□・□校・□生 を満たす');
eq(K.wadouCandidates(twoAll, '大', '入', '校', '生'), brute(known), '既知の例: 候補の一覧が素朴な検算と一致');
// 負例: 答えが2つ以上になる問題をわざと探し、一意ではないと判定されること
let amb = null;
outer: for (const x of ['学', '人', '生', '日', '中', '外', '手', '心', '正', '本']) {
  const pre = [...(twoAll.before.get(x) || [])], post = [...(twoAll.after.get(x) || [])];
  for (let a = 0; a < pre.length; a++) for (let b = a + 1; b < pre.length; b++) for (let c = 0; c < post.length; c++) for (let d = c + 1; d < post.length; d++) {
    const p = { x, up: pre[a], left: pre[b], right: post[c], down: post[d] };
    if (new Set([p.x, p.up, p.left, p.right, p.down]).size < 5) continue;
    if (brute(p).length >= 2) { amb = p; break outer; }
  }
}
ok(!!amb, '一意でない問題の例が見つかる');
if (amb) {
  const cs = brute(amb);
  console.log(`  負例: ${amb.up}・${amb.left} → □ → ${amb.right}・${amb.down} は ${cs.join('・')} の${cs.length}通り`);
  eq(K.wadouUnique(twoAll, amb), false, '負例: 一意でない問題は弾かれる');
  eq(K.wadouCandidates(twoAll, amb.up, amb.left, amb.right, amb.down), cs, '負例: 候補の一覧が素朴な検算と一致');
}
// 負例2: 4つのうち1つが熟語にならない問題（□の字が答えにならない）も弾かれる
eq(K.wadouUnique(twoAll, { x: '学', up: '大', left: '入', right: '校', down: '金' }), brute({ up: '大', left: '入', right: '校', down: '金' }).length === 1 && brute({ up: '大', left: '入', right: '校', down: '金' })[0] === '学', '負例2: 学金 は熟語ではないので 学 は答えにならない');

console.log(`\n${oks} ok, ${fails} fail`);
process.exit(fails ? 1 : 0);
