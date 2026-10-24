// 年末調整の計算機（令和8年分）: assets/nencho-2026-core.js の検査（画面と同じファイル・同じ rules.json をそのまま読む）
//   [1] 給与所得控除後の金額: 国税庁の表（令和8年分・令和7年分）の全行と、表の冒頭・末尾の文言、特例の区分
//   [2] 「収入が給与だけの場合の収入金額」の境目（あらまし・年末調整のしかたの表の括弧書き）
//   [3] 国税庁の計算例（所得金額調整控除・速算表・660万円以上の算式）
//   [4] 国税庁の設例 4つ（令和8年分2つ・令和7年分2つ）を途中の金額まで照合
//   [5] 電算機計算の特例（令和8年分）の計算例 3つ
//   [6] 境目: 年収 103万・123万・136万・160万・178万・200万・850万・1,000万・2,000万、配偶者の段階、所得者の段階
//   [7] 手計算の例（data/nencho-2026/hand-calcs.json）
//   [8] rules.json の出典がすべて sources にあること
// 使い方:  node scripts/nencho_2026/test_core.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const N = require(path.join(ROOT, 'assets', 'nencho-2026-core.js'));
const load = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const rules = load('data/nencho-2026/rules.json');
const tables = { r8: load('data/nencho-2026/kyuyo-table-r8.json'), r7: load('data/nencho-2026/kyuyo-table-r7.json') };
const hand = load('data/nencho-2026/hand-calcs.json');

let fails = 0, oks = 0;
function check(cond, msg) {
  if (cond) { oks++; if (!process.env.QUIET) console.log('  ok   ' + msg); }
  else { fails++; console.log('  FAIL ' + msg); }
}
function eq(actual, expected, msg) {
  check(actual === expected, `${msg}: ${fmt(actual)}${actual === expected ? '' : ' （期待値 ' + fmt(expected) + '）'}`);
}
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en-US') : String(v));
const Y = (k) => N.yearRules(rules, k);
const tax = (key, input) => N.computeYear(rules, key, N.normalize(input), { amount: N.normalize(input).socialInsurance || 0, estimated: false });

// ------------------------------------------------------------------ [1]
console.log('[1] 給与所得控除後の給与等の金額 ＝ 国税庁の表の全行');
for (const key of ['r8', 'r7']) {
  const k = Y(key).kyuyo;
  let bad = 0, n = 0;
  for (const [lo, hi, val] of tables[key].rows) {
    for (const a of [lo, hi - 1, Math.floor((lo + hi) / 2)]) {
      n++;
      const v = N.salaryIncome(a, k);
      if (v !== val) { bad++; if (bad <= 5) console.log(`    ${key} ${a}: ${v} ≠ 表 ${val}`); }
    }
  }
  check(bad === 0, `${key}: 表の ${tables[key].rows.length} 行 × 3点（以上・未満−1・中央）＝ ${n} 点がすべて一致`);
  // 表の冒頭・末尾の文言（extract_tables.py が PDF から写したもの）と rules.json の突き合わせ
  for (const h of tables[key].head_rules) {
    if (h.lt !== undefined && h.ge === undefined) {
      eq(N.salaryIncome(h.lt - 1, k), 0, `${key} ${h.text}（${fmt(h.lt - 1)}円）`);
      eq(k.zeroBelow, h.lt, `${key} rules.json の zeroBelow`);
    } else if (h.minus !== undefined) {
      eq(N.salaryIncome(h.ge, k), h.ge - h.minus, `${key} ${h.text}（${fmt(h.ge)}円）`);
      eq(N.salaryIncome(h.lt - 1, k), h.lt - 1 - h.minus, `${key} 同（${fmt(h.lt - 1)}円）`);
    } else if (h.eq !== undefined) {
      eq(N.salaryIncome(h.eq, k), h.value, `${key} ${h.text}`);
    }
  }
  check(N.salaryIncome(20000001, k) === null, `${key}: 2,000万円超は表の範囲外（null）`);
  // 表の最初の行の直前（冒頭の文言の区間）と最初の行がつながる
  const first = tables[key].rows[0];
  check(N.salaryIncome(first[0] - 1, k) <= first[2], `${key}: 文言の区間と表の最初の行の間で金額が減らない`);
}
console.log('    令和8・9年分の特例（あらまし1ページ・年末調整のしかた3ページ ハ）');
const k8 = Y('r8').kyuyo;
[[690999, 0], [691000, 0], [740999, 0], [741000, 1000], [2190999, 1450999], [2191000, 1451000], [2192999, 1451000],
  [2193000, 1453000], [2195999, 1453000], [2196000, 1456000], [2199999, 1456000], [2200000, 1460000]]
  .forEach(([a, v]) => eq(N.salaryIncome(a, k8), v, `r8 給与 ${fmt(a)}円`));
// 給与所得控除の最低保障額: 令和8年分 74万円（190万円以下・220万円以下とも）、令和7年分 65万円
eq(1900000 - N.salaryIncome(1900000, k8), 740000, 'r8 給与190万円の給与所得控除＝74万円');
eq(2199999 - N.salaryIncome(2199999, k8), 743999, 'r8 給与2,199,999円の給与所得控除（表どおり 1,456,000 円になる）');
eq(1899999 - N.salaryIncome(1899999, Y('r7').kyuyo), 650000, 'r7 給与1,899,999円の給与所得控除＝65万円');

// ------------------------------------------------------------------ [2]
console.log('[2] 「収入が給与だけの場合の収入金額」の境目');
const inc8 = (s) => N.salaryIncome(s, k8), inc7 = (s) => N.salaryIncome(s, Y('r7').kyuyo);
// 基礎控除の境目（あらまし1ページの括弧書き）
[[2060000, 1320000, '≦132万'], [4751999, null, '≦336万'], [6655556, 4890000, '＝489万'], [8500000, 6550000, '＝655万'], [25450000, null, '']]
  .forEach(([s, v, t]) => { if (v !== null) eq(inc8(s), v, `r8 給与 ${fmt(s)} → 合計所得 ${t}`); });
check(inc8(4751999) <= 3360000 && inc8(4752000) > 3360000, 'r8 給与 475万1,999円以下 ⇔ 合計所得 336万円以下');
check(inc8(6655556) <= 4890000 && inc8(6655557) > 4890000, 'r8 給与 665万5,556円以下 ⇔ 合計所得 489万円以下');
check(inc7(2003999) <= 1320000 && inc7(2004000) > 1320000, 'r7 給与 200万3,999円以下 ⇔ 合計所得 132万円以下');
check(inc7(4751999) <= 3360000 && inc7(4752000) > 3360000, 'r7 給与 475万1,999円以下 ⇔ 合計所得 336万円以下');
// 扶養親族等の所得要件（あらまし2ページ）
check(inc8(1360000) <= 620000 && inc8(1360001) > 620000, 'r8 扶養: 給与136万円以下 ⇔ 合計所得62万円以下');
check(inc8(1970000) <= 1230000 && inc8(1970001) > 1230000, 'r8 特定親族: 給与197万円以下 ⇔ 123万円以下');
check(inc8(2070000) <= 1330000 && inc8(2070001) > 1330000, 'r8 配偶者特別控除: 給与207万円以下 ⇔ 133万円以下');
check(inc8(1630000) <= 890000 && inc8(1630001) > 890000, 'r8 勤労学生: 給与163万円以下 ⇔ 89万円以下');
check(inc7(1230000) <= 580000 && inc7(1230001) > 580000, 'r7 扶養: 給与123万円以下 ⇔ 58万円以下');
check(inc7(1880000) <= 1230000 && inc7(1880001) > 1230000, 'r7 特定親族: 給与188万円以下 ⇔ 123万円以下');
check(inc7(2015999) <= 1330000 && inc7(2016000) > 1330000, 'r7 配偶者特別控除: 給与201万5,999円以下 ⇔ 133万円以下');
// 配偶者控除額の一覧表（年末調整のしかた55ページ）の右端「配偶者の給与等の収入金額」
[[1360000, 620000], [1690000, 950000], [1740000, 1000000], [1790000, 1050000], [1840000, 1100000], [1890000, 1150000], [1940000, 1200000], [1990000, 1250000], [2040000, 1300000], [2070000, 1330000]]
  .forEach(([s, v]) => check(inc8(s) <= v && inc8(s + 1) > v, `r8 配偶者の給与 ${fmt(s)}円以下 ⇔ 合計所得 ${fmt(v)}円以下`));
// 同表の所得者の括弧書き（1,095万円・1,145万円・1,195万円）
[[10950000, 9000000], [11450000, 9500000], [11950000, 10000000]]
  .forEach(([s, v]) => check(inc8(s) <= v && inc8(s + 1) > v, `r8 所得者の給与 ${fmt(s)}円以下 ⇔ 合計所得 ${fmt(v)}円以下`));
// 寡婦・ひとり親（13ページ注）: 給与 6,777,778円以下で 500万円以下
check(inc8(6777778) <= 5000000 && inc8(6777779) > 5000000, 'r8 給与 6,777,778円以下 ⇔ 合計所得 500万円以下');

// ------------------------------------------------------------------ [3]
console.log('[3] 年末調整のしかたの計算例');
eq(N.salaryIncome(7654321, k8), 5788888, '36ページ: 給与 7,654,321円 → 給与所得控除後 5,788,888円');
eq(N.incomeAdjustment(8765432, true, Y('r8').incomeAdjustment), 26544, '37ページ: 給与 8,765,432円 → 所得金額調整控除 26,544円');
eq(N.incomeAdjustment(12000000, true, Y('r8').incomeAdjustment), 150000, '所得金額調整控除の上限 15万円');
eq(N.incomeAdjustment(9000000, false, Y('r8').incomeAdjustment), 0, '23歳未満の扶養親族などがいなければ 0');
eq(N.rateTax(2696000, Y('r8').rate), 172100, '38ページ: 課税給与所得 2,696,000円 → 算出所得税額 172,100円');

// ------------------------------------------------------------------ [4]
console.log('[4] 国税庁の設例');
function runCase(name, key, input, exp) {
  const inp = N.normalize(input);
  const r = N.computeYear(rules, key, inp, { amount: inp.socialInsurance, estimated: false });
  const ded = Object.fromEntries(r.deductions.map((d) => [d.id, d.amount]));
  for (const [k, v] of Object.entries(exp)) {
    const actual = k in r ? r[k] : k.startsWith('ded.') ? (ded[k.slice(4)] || 0) : undefined;
    eq(actual, v, `${name} ${k}`);
  }
  return r;
}
// 設例1: 年末調整のしかた 令和8年分 57〜59ページ（同 令和7年分 57〜59ページ）
const case1 = (spouseIncome) => ({
  salary: 8970000, socialInsurance: 1386102,
  spouse: { income: spouseIncome },
  dependents: { a23_69: 1, a70cohab: 1, students: [{ income: 0 }, { income: 1000000 }] }, // 一般1・同居老親等1・特定扶養1・特定親族（給与所得100万円）1
  disabled: { familyGeneral: 1 }, // 老人扶養親族が一般の障害者
  quake: { quake: 42000, oldLong: 14800 },
  housing: 76500,
});
const r81 = runCase('R8設例1', 'r8', Object.assign(case1(500000), { life: { genNew: 80000, genOld: 35000, care: 80000, penNew: 30000, penOld: 90000 } }), {
  kyuyo: 7020000, adjustment: 47000, totalIncome: 6973000,
  'ded.si': 1386102, 'ded.life': 120000, 'ded.quake': 50000, 'ded.spouse': 380000, 'ded.tokutei': 410000, 'ded.fuyo': 1860000, 'ded.basic': 620000,
  deductionTotal: 4826102, taxable: 2146000, calcTax: 117100, housing: 76500, nenchoShotoku: 40600, annualTax: 41400,
});
eq(r81.life.general, 60000, 'R8設例1 一般の生命保険料の控除額（23歳未満の扶養親族あり → 新旧合計の上限6万円）');
eq(r81.life.care, 40000, 'R8設例1 介護医療保険料の控除額');
eq(r81.life.pension, 47500, 'R8設例1 個人年金保険料の控除額');
eq(156670 - r81.annualTax, 115270, 'R8設例1 超過額（徴収税額 156,670円 − 年調年税額）');
const r71 = runCase('R7設例1', 'r7', Object.assign(case1(400000), { life: { genNew: 25000, genOld: 80000, care: 80000, penNew: 90000, penOld: 30000 } }), {
  kyuyo: 7020000, adjustment: 47000, totalIncome: 6973000,
  'ded.life': 120000, 'ded.quake': 50000, 'ded.spouse': 380000, 'ded.tokutei': 410000, 'ded.fuyo': 1860000, 'ded.basic': 580000,
  deductionTotal: 4786102, taxable: 2186000, calcTax: 121100, nenchoShotoku: 44600, annualTax: 45500,
});
eq(r71.life.general, 45000, 'R7設例1 一般の生命保険料の控除額（特例なし → 旧の45,000円）');
eq(r71.life.pension, 40000, 'R7設例1 個人年金保険料の控除額（新旧合計の上限4万円）');
eq(200700 - r71.annualTax, 155200, 'R7設例1 超過額（徴収税額 200,700円 − 年調年税額）');
// 設例2: 過不足額の精算の設例（税額計算を省略しない場合）令和8年分・令和7年分 — 同じ入力
const case2 = { salary: 4390000, socialInsurance: 641525, spouse: { income: 0 }, dependents: { a23_69: 1 }, life: { genOld: 50200, penNew: 56000 }, quake: { quake: 45000 } };
const r82 = runCase('R8設例2', 'r8', case2, {
  kyuyo: 3070400, totalIncome: 3070400, 'ded.life': 71550, 'ded.quake': 45000, 'ded.spouse': 380000, 'ded.fuyo': 380000, 'ded.basic': 1040000,
  deductionTotal: 2558075, taxable: 512000, calcTax: 25600, annualTax: 26100,
});
eq(51845 - r82.annualTax, 25745, 'R8設例2 超過額（徴収税額 51,845円 − 年調年税額）');
const r72 = runCase('R7設例2', 'r7', case2, {
  kyuyo: 3070400, 'ded.life': 71550, 'ded.basic': 880000, deductionTotal: 2398075, taxable: 672000, calcTax: 33600, annualTax: 34300,
});
eq(56945 - r72.annualTax, 22645, 'R7設例2 超過額（徴収税額 56,945円 − 年調年税額）');

// ------------------------------------------------------------------ [5]
console.log('[5] 電算機計算の特例（令和8年分）の計算例');
eq(N.withholdingMonthly(175000, 2, rules.withholding), 210, '3ページ 例1: 175,000円・配偶者＋親族1人 → 210円');
eq(N.withholdingMonthly(446000, 8, rules.withholding), 940, '3ページ 例2: 446,000円・配偶者＋親族7人 → 940円');
eq(N.withholdingMonthly(775200, 3, rules.withholding), 59470, '3ページ 例3: 775,200円・配偶者＋親族2人 → 59,470円');
eq(N.withholdingMonthly(80000, 0, rules.withholding), 0, '月8万円・0人 → 0円');
console.log('    賞与に対する源泉徴収税額の算出率の表（令和8年分）');
const bonusFixture = load('data/nencho-2026/bonus-rate-r8.json');
check(JSON.stringify(rules.withholding.bonus.ratesPer100000) === JSON.stringify(bonusFixture.ratesPer100000)
  && JSON.stringify(rules.withholding.bonus.boundsThousandYen) === JSON.stringify(bonusFixture.boundsThousandYen), 'rules.json の算出率の表 ＝ PDF から読み取った表');
const BR = (a, n) => N.bonusRate(a, n, rules.withholding.bonus);
[[142999, 2, 0], [143000, 2, 2042], [275999, 2, 2042], [276000, 2, 4084], [81999, 0, 0], [82000, 0, 2042], [3495000, 0, 45945], [3716999, 7, 41861], [3717000, 9, 45945]]
  .forEach(([a, n, r]) => eq(BR(a, n), r, `前月 ${fmt(a)}円・${n}人 の率（1/100000）`));
// 過不足額の精算の設例（令和8年分）の賞与2回、年末調整のしかた57ページの設例の6月賞与
eq(N.bonusWithholding(255750, 265690, 2, rules.withholding).tax, 5222, '設例2 6月賞与: 255,750円 × 2.042% → 5,222円');
eq(N.bonusWithholding(341000, 262860, 2, rules.withholding).tax, 6963, '設例2 12月賞与: 341,000円 × 2.042% → 6,963円');
eq(N.bonusWithholding(759060, 507546, 6, rules.withholding).tax, 77500, '設例1 6月賞与: 759,060円 × 10.21% → 77,500円');
eq(N.bonusWithholding(1200000, 100000, 0, rules.withholding).method, 'tenfold', '賞与が前月の給与の10倍超 → 月額表の方法');
// 見込みの当たり具合: 設例2（徴収税額の実額 51,845円）を年収・賞与・社会保険料だけから見込む
const est2 = N.compute(rules, Object.assign({}, case2, { bonus: 700000 })).withholding.estimate;
check(Math.abs(est2.annual - 51845) <= 1500, `設例2 の源泉徴収の見込み ${fmt(est2.annual)}円（実額 51,845円との差 ${fmt(est2.annual - 51845)}円、±1,500円以内）`);
const est2nb = N.compute(rules, case2).withholding.estimate;
console.log(`    参考: 賞与を入れないと ${fmt(est2nb.annual)}円（実額との差 ${fmt(est2nb.annual - 51845)}円）`);

// ------------------------------------------------------------------ [6]
console.log('[6] 境目（単身・社会保険料0・ほかの控除なし）');
const single = (s) => ({ salary: s, socialInsurance: 0 });
const T = (key, s) => tax(key, single(s)).annualTax;
const expect8 = [[1030000, 0], [1230000, 0], [1360000, 0], [1600000, 0], [1780000, 0], [1781999, 0], [1782000, 100], [2000000, 11200],
  [8500000, 764200], [8500001, 774400], [10000000, 1095400], [20000000, 4304400]];
const expect7 = [[1030000, 0], [1230000, 0], [1360000, 0], [1600000, 0], [1780000, 9100], [2000000, 18800], [8500000, 772300], [10000000, 1104800], [20000000, 4317900]];
expect8.forEach(([s, v]) => eq(T('r8', s), v, `令和8年分 年収 ${fmt(s)}円の年税額`));
expect7.forEach(([s, v]) => eq(T('r7', s), v, `令和7年分 年収 ${fmt(s)}円の年税額`));
eq(T('r8pre', 1780000), 9100, '改正前の令和8年分 年収178万円 → 9,100円（改正で0円に）');
// 課税最低限: 令和8年分は178万円、令和7年分は160万円（単身・社会保険料0）
check(tax('r8', single(1780000)).taxable === 0 && tax('r8', single(1781000)).taxable > 0, '令和8年分: 給与178万円で課税給与所得0、178万1,000円から課税（178万円の線）');
check(tax('r7', single(1600000)).taxable === 0 && tax('r7', single(1604000)).taxable > 0, '令和7年分: 給与160万円で課税給与所得0（160万円の線）');
check(tax('r8', single(20000000)).eligible === true && tax('r8', single(20000001)).eligible === false, '給与2,000万円は年末調整の対象、2,000万1円は対象外');
// 基礎控除の段階（令和8年分）
[[4890000, 1040000], [4890001, 670000], [6550000, 670000], [6550001, 620000]].forEach(([i, v]) => eq(N.basicDeduction(i, Y('r8').basic), v, `r8 合計所得 ${fmt(i)}円の基礎控除`));
[[1320000, 950000], [1320001, 880000], [3360000, 880000], [3360001, 680000], [4890001, 630000], [6550001, 580000]].forEach(([i, v]) => eq(N.basicDeduction(i, Y('r7').basic), v, `r7 合計所得 ${fmt(i)}円の基礎控除`));
console.log('    配偶者（特別）控除の段階');
const sd = (e, s, old = false, key = 'r8') => N.spouseDeduction(e, s, old, Y(key).spouse).amount;
[[620000, 380000], [620001, 380000], [950000, 380000], [950001, 360000], [1000001, 310000], [1050001, 260000], [1100001, 210000], [1150001, 160000], [1200001, 110000], [1250001, 60000], [1300001, 30000], [1330000, 30000], [1330001, 0]]
  .forEach(([s, v]) => eq(sd(5000000, s), v, `r8 所得者500万円・配偶者の合計所得 ${fmt(s)}円`));
eq(sd(5000000, 620000, true), 480000, 'r8 老人控除対象配偶者（70歳以上）48万円');
eq(sd(5000000, 620001, true), 380000, 'r8 配偶者62万円超は老人でも配偶者特別控除38万円');
eq(sd(5000000, 580001, false, 'r7'), 380000, 'r7 配偶者58万円超 → 配偶者特別控除38万円');
[[9000000, 380000], [9000001, 260000], [9500000, 260000], [9500001, 130000], [10000000, 130000], [10000001, 0]]
  .forEach(([e, v]) => eq(sd(e, 0), v, `r8 所得者の合計所得 ${fmt(e)}円・配偶者0円`));
console.log('    特定親族特別控除・扶養の線');
[[620000, 0], [620001, 630000], [850001, 610000], [1000000, 410000], [1200001, 30000], [1230000, 30000], [1230001, 0]].forEach(([i, v]) => eq(N.tokuteiShinzokuDeduction(i, Y('r8').tokuteiShinzoku), v, `r8 特定親族の合計所得 ${fmt(i)}円`));
const stu = (s, key) => tax(key, { salary: 5000000, socialInsurance: 0, dependents: { students: [{ salary: s }] } });
eq(stu(1360000, 'r8').deductions.find((d) => d.id === 'fuyo').amount, 630000, 'r8 19〜22歳の子 給与136万円 → 特定扶養親族 63万円');
eq(stu(1360001, 'r8').deductions.find((d) => d.id === 'tokutei').amount, 630000, 'r8 同 136万1円 → 特定親族特別控除 63万円');
eq((stu(1970001, 'r8').deductions.find((d) => d.id === 'tokutei') || { amount: 0 }).amount, 0, 'r8 同 197万1円 → 控除なし');
eq(stu(1300000, 'r7').deductions.find((d) => d.id === 'tokutei').amount, 630000, 'r7 同 給与130万円 → 特定親族特別控除 63万円（令和8年分なら扶養控除）');
console.log('    生命保険料・地震保険料');
const L8 = Y('r8').life, L7 = Y('r7').life;
eq(N.lifeDeduction({ genNew: 120000 }, true, L8).general, 60000, 'r8 新生命12万円・23歳未満の扶養親族あり → 6万円');
eq(N.lifeDeduction({ genNew: 120000 }, false, L8).general, 40000, 'r8 新生命12万円・23歳未満なし → 4万円');
eq(N.lifeDeduction({ genNew: 120000 }, true, L7).general, 40000, 'r7 新生命12万円 → 4万円（特例なし）');
eq(N.lifeDeduction({ genNew: 50001 }, true, L8).general, 40001, 'r8 計算式Ⅱ 50,001×1/2＋15,000 = 40,000.5 → 切上げ 40,001');
eq(N.lifeDeduction({ genNew: 200000, care: 200000, penNew: 200000 }, true, L8).total, 120000, 'r8 合計の上限12万円');
eq(N.lifeDeduction({ genOld: 100000 }, true, L8).general, 50000, '旧生命10万円 → 5万円');
eq(N.lifeDeduction({ genOld: 100000, genNew: 1 }, false, L8).general, 50000, '旧6万円超なら旧だけの額（新旧合計は上限4万円）');
eq(N.earthquakeDeduction({ quake: 60000 }, Y('r8').earthquake), 50000, '地震保険料6万円 → 5万円');
eq(N.earthquakeDeduction({ oldLong: 15000 }, Y('r8').earthquake), 12500, '旧長期1.5万円 → 15,000×1/2＋5,000 = 12,500');
eq(N.earthquakeDeduction({ oldLong: 30000 }, Y('r8').earthquake), 15000, '旧長期3万円 → 15,000');
console.log('    住宅ローン控除・寡婦／ひとり親');
const hl = tax('r8', { salary: 4000000, socialInsurance: 600000, housing: 500000 });
eq(hl.nenchoShotoku, 0, '住宅ローン控除が算出所得税額より多い → 年調所得税額0（引ききれない分は切り捨て）');
eq(tax('r8', { salary: 6777778, socialInsurance: 0, selfStatus: 'singleParent' }).deductions.find((d) => d.id === 'fuyo').amount, 350000, 'ひとり親（合計所得500万円以下・14ページ）35万円');
eq(tax('r8', { salary: 6777779, socialInsurance: 0, selfStatus: 'singleParent' }).deductions.find((d) => d.id === 'fuyo').amount, 0, 'ひとり親でも合計所得500万円超は0');
console.log('    監査で足したテスト');
eq(N.lifeDeduction({ genNew: 120000 }, true, Y('r8pre').life).general, 60000, 'r8pre（改正前の令和8年分）にも23歳未満の生命保険料の特例 → 6万円');
const lifeCase = N.compute(rules, { salary: 5000000, socialInsurance: 700000, dependents: { u16: 1 }, life: { genNew: 120000 } });
eq(lifeCase.r8.annualTax, 89800, '年収500万・社保70万・16歳未満1人・新生命12万 → 令和8年分 89,800円（手計算）');
eq(lifeCase.r8pre.annualTax, 116900, '同 改正前の令和8年分 116,900円（基礎控除68万円・生命保険料6万円）');
eq(lifeCase.reformEffect, 27100, '同 改正で軽くなった分 27,100円');
const bl = (key) => tax(key, { salary: 5000000, socialInsurance: 0, dependents: { a23_69: 1, betweenLines: 1 } });
eq((bl('r8').deductions.find((d) => d.id === 'fuyo') || { amount: 0 }).amount, 380000, '給与123万超136万以下の23〜69歳の家族: 令和8年分は扶養控除38万円');
eq((bl('r7').deductions.find((d) => d.id === 'fuyo') || { amount: 0 }).amount, 0, '同 令和7年分は扶養親族にならない');
eq((bl('r8pre').deductions.find((d) => d.id === 'fuyo') || { amount: 0 }).amount, 0, '同 改正前の令和8年分も扶養親族にならない');
eq(N.withholdingDependents(rules, N.normalize({ salary: 5000000, spouse: { income: 0 }, dependents: { students: [{ income: 1000000 }] }, disabled: { self: 'general', familyGeneral: 1 } })).n, 4,
  '毎月の源泉徴収で数える人数: 配偶者1＋特定親族（100万円）1＋本人障害者1＋家族の障害者1 ＝ 4人');
eq(N.withholdingDependents(rules, N.normalize({ salary: 5000000, dependents: { a23_69: 2, betweenLines: 1 } })).n, 1, '11月までの源泉徴収では、去年の線を超える家族は数えない');
eq(N.bonusWithholding(1200000, 100000, 0, rules.withholding).tax, 47460, '10倍超: (月額(100,000＋200,000)−月額(100,000))×6 ＝ (7,910−0)×6 ＝ 47,460円');
eq(tax('r8', { salary: 9000000, socialInsurance: 0, disabled: { self: 'special' } }).adjustment, 50000, '本人が特別障害者だけでも所得金額調整控除（900万円 → 5万円）');
eq(tax('r8', { salary: 9000000, socialInsurance: 0, dependents: { students: [{ salary: 1500000 }] } }).adjustment, 0, '19〜22歳の子が特定親族（扶養親族でない）だけなら所得金額調整控除なし');
eq(tax('r8', { salary: 11150000, socialInsurance: 0, spouse: { income: 0, elderly: true } }).spouse.amount, 320000, '所得者の合計所得920万円（2段目）・老人控除対象配偶者 → 32万円');
eq(tax('r8', { salary: 11650000, socialInsurance: 0, spouse: { income: 0, elderly: true } }).spouse.amount, 160000, '所得者の合計所得970万円（3段目）・老人控除対象配偶者 → 16万円');
console.log('    まとめ（compute）の整合');
const all = N.compute(rules, { salary: 5000000, socialInsurance: 700000 });
eq(all.refund, all.withholding.amount - all.r8.annualTax, '戻る目安 ＝ 源泉徴収の見込み − 令和8年分の年税額');
eq(all.diffFromLastYear, all.r8.annualTax - all.r7.annualTax, '去年との差 ＝ 令和8年分 − 令和7年分');
check(all.withholding.estimated === true, '源泉徴収額の入力がなければ見込みを使う');
const given = N.compute(rules, { salary: 5000000, socialInsurance: 700000, withheld: 120000 });
eq(given.refund, 120000 - given.r8.annualTax, '源泉徴収額の入力があればそれを使う');
const est = N.compute(rules, { salary: 5000000 });
check(est.socialInsurance.estimated && est.socialInsurance.amount > 0, `社会保険料の入力がなければ目安（${fmt(est.socialInsurance.amount)}円）`);
eq(N.estimateSocialInsurance(6000000, rules.socialInsuranceEstimate).total, Math.round(500000 * 0.0915) * 12 + Math.round(500000 * 0.04925) * 12 + 30000, '社会保険料の目安（年収600万円）');
check(N.compute(rules, { salary: 25000000 }).r8.eligible === false, '年収2,500万円は対象外として結果を出さない');
// 単調性: 年収が増えて年税額が減ることはない（単身・社会保険料0、令和8年分は 850万円の基礎控除の段差でも減らない）
let mono = true;
for (let s = 0; s <= 20000000; s += 1000) {
  if (s > 0 && T('r8', s) < T('r8', s - 1000)) { mono = false; console.log('    減った: ' + s); break; }
}
check(mono, '令和8年分: 年収0〜2,000万円を1,000円刻みで、年税額が減るところがない');

// ------------------------------------------------------------------ [7]
console.log('[7] 手計算の例（hand-calcs.json）');
for (const c of hand.cases) {
  if (c.series) {
    for (const s of c.series) {
      eq(tax('r8', Object.assign({}, c.base, { spouse: { salary: s.spouseSalary } })).annualTax, s.r8AnnualTax, `${c.id} 配偶者の給与 ${fmt(s.spouseSalary)}円`);
    }
    continue;
  }
  const out = N.compute(rules, c.input);
  for (const key of ['r8', 'r7']) {
    for (const f of ['totalIncome', 'deductionTotal', 'taxable', 'calcTax', 'annualTax']) eq(out[key][f], c[key][f], `${c.id} ${key} ${f}`);
  }
  if (c.withholding) {
    eq(out.withholding.estimate.monthly, c.withholding.monthly, `${c.id} 毎月の源泉徴収（見込み）`);
    eq(out.withholding.amount, c.withholding.annual, `${c.id} 1年分の源泉徴収（見込み）`);
    eq(out.refund, c.withholding.refund, `${c.id} 戻る目安`);
  }
}

// ------------------------------------------------------------------ [8]
console.log('[8] 出典');
const ids = new Set(Object.keys(rules.sources));
const missing = [];
JSON.stringify(rules, (k, v) => { if (k === 'id' && typeof v === 'string' && !ids.has(v)) missing.push(v); return v; });
check(missing.length === 0, 'rules.json の src の id がすべて sources にある' + (missing.length ? ' 不足: ' + missing.join(',') : ''));
let noSrc = [];
for (const key of ['r8', 'r7']) for (const [k, v] of Object.entries(rules.years[key])) if (v && typeof v === 'object' && !Array.isArray(v) && !v.src) noSrc.push(key + '.' + k);
check(noSrc.length === 0, '各年の規定（給与所得・基礎控除・配偶者…）に src がある' + (noSrc.length ? ' なし: ' + noSrc.join(',') : ''));
for (const t of Object.values(tables)) check(ids.has(t.source), `${t.title} の出典 ${t.source}`);

console.log(`\n${oks} ok, ${fails} fail`);
process.exit(fails ? 1 : 0);
