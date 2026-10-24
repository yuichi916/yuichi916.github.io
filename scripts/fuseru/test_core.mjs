// fuseru-core.js のユニットテストと、種類別の適合率・再現率の計算。
//   node scripts/fuseru/test_core.mjs            … テスト＋開発用ケース(dev)とホールドアウト(heldout)の評価
//   node scripts/fuseru/test_core.mjs --write    … 上に加えて data/fuseru/metrics.js（ページに載せる数字）を書き出す
//   node scripts/fuseru/test_core.mjs --show dev … 外したケースを表示
//
// 判定: 予測と正解の種類が同じで、範囲の重なり（IoU）が 0.5 以上なら当たり。
//       正解は本文中の value の全出現。負例（expect が []）で何か出したら誤検出。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
require(path.join(ROOT, 'data/fuseru/places.js'));
require(path.join(ROOT, 'data/fuseru/surnames.js'));
const F = require(path.join(ROOT, 'assets/fuseru-core.js'));

let passed = 0;
function t(name, fn) { fn(); passed++; }

// ---------------------------------------------------------------- 既知の正解で assert
t('Luhn: 公開されているテスト用カード番号は通る', () => {
  for (const n of ['4111111111111111', '5555555555554444', '378282246310005', '4242424242424242',
                   '6011111111111117', '3530111333300000', '5105105105105100', '79927398713'])
    assert.equal(F.luhnValid(n), true, n);
});
t('Luhn: 1桁変えると通らない', () => {
  for (const n of ['4111111111111112', '5555555555554445', '378282246310006', '79927398710', '1234567890123456'])
    assert.equal(F.luhnValid(n), false, n);
});
t('マイナンバー: 123456789018 は正しい（手計算 Σ=212, 212 mod 11=3, 11-3=8）', () => {
  assert.equal(F.myNumberCheckDigit('12345678901'), 8);
  assert.equal(F.myNumberValid('123456789018'), true);
  assert.equal(F.myNumberValid('123456789017'), false);
});
t('マイナンバー: 余りが 0・1 のときは 0', () => {
  // 00000000000 → Σ=0 → 0。 00000000001: P1=1,Q1=2 → Σ=2 → 9。 00000000005: Σ=10 → 1。
  // 余り1: Σ ≡ 1 (mod 11) になる例 00000000006: P1=6,Q1=2 → 12 mod 11 = 1 → 0
  assert.equal(F.myNumberCheckDigit('00000000000'), 0);
  assert.equal(F.myNumberCheckDigit('00000000001'), 9);
  assert.equal(F.myNumberCheckDigit('00000000006'), 0);
  // 7桁目（P5... ではなく P7）の重みは 2: 00001000000 → P7=1, Q7=2 → Σ=2 → 9
  assert.equal(F.myNumberCheckDigit('00001000000'), 9);
  // P11（いちばん左）の重みは 6: 10000000000 → 6 → 5
  assert.equal(F.myNumberCheckDigit('10000000000'), 5);
});
t('正規化は長さを変えない', () => {
  const s = '０９０ー１２３４ー５６７８　ｔｅｓｔ＠ｅｘａｍｐｌｅ．ｊｐ（株）タナカ';
  const n = F.normalize(s);
  assert.equal(n.length, s.length);
  assert.equal(n.slice(0, 13), '090-1234-5678');
  assert.ok(n.includes('test@example.jp(株)タナカ'));
});
t('置き換え: 同じ値は同じ番号、別の値は別の番号', () => {
  const text = '田中様と鈴木様。田中様にもう一度。';
  const sp = F.detect(text);
  const m = F.mask(text, sp);
  assert.equal(m.text, '[人名1]様と[人名2]様。[人名1]様にもう一度。');
  assert.equal(m.table.length, 2);
});
t('戻す: 括弧・全角数字・空白の揺れを許す', () => {
  const text = '担当：山口 健太\nTEL 03-1234-5678';
  const m = F.mask(text, F.detect(text));
  const r = F.restore('【人名１】さん（［電話 1］）に確認、[人名9] は不明', m.table);
  assert.equal(r.text, '山口 健太さん（03-1234-5678）に確認、[人名9] は不明');
  assert.equal(r.count, 2);
  assert.deepEqual(r.missing, ['[人名9]']);
});
t('戻す: 置き換えて戻すと元に戻る（往復）', () => {
  const cases = JSON.parse(readFileSync(path.join(ROOT, 'scripts/fuseru/cases_dev.json'), 'utf8'));
  for (const c of cases) {
    const m = F.mask(c.text, F.detect(c.text, { enabled: { date: true } }));
    assert.equal(F.restore(m.text, m.table).text, c.text, c.id);
  }
});
t('種類のオフ・手での除外・手での追加', () => {
  const text = '田中様 03-1234-5678 社員番号 A-1029';
  let sp = F.detect(text, { enabled: { phone: false } });
  assert.ok(!sp.some(s => s.type === 'phone'));
  sp = F.detect(text, { exclude: [F.keyOf('person', '田中')] });
  assert.ok(!sp.some(s => s.type === 'person'));
  sp = F.detect(text, { include: [{ type: 'person', value: 'A-1029' }] });
  assert.ok(sp.some(s => s.value === 'A-1029'));
});
t('元の文に [人名1] のような書き方があれば気づける', () => {
  assert.equal(F.hasTokenLike('[人名1] と書いてある'), true);
  assert.equal(F.hasTokenLike('ふつうの文'), false);
});
t('通信する API を使っていない（core / app）', () => {
  for (const f of ['assets/fuseru-core.js', 'assets/fuseru-app.js']) {
    let src;
    try { src = readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'import(', 'importScripts', 'RTCPeerConnection', '.src =', 'new Image', 'navigator.serviceWorker', 'postMessage'])
      assert.ok(!code.includes(bad), `${f} に ${bad}`);
  }
});

// ---------------------------------------------------------------- 評価
function occurrences(text, value) {
  const out = []; let i = -1;
  while ((i = text.indexOf(value, i + 1)) >= 0) out.push([i, i + value.length]);
  return out;
}
function iou(a, b) {
  const inter = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  const uni = Math.max(a[1], b[1]) - Math.min(a[0], b[0]);
  return uni ? inter / uni : 0;
}
function evaluate(cases, D = F) {
  const per = {}; const misses = [];
  const get = k => (per[k] ??= { tp: 0, fp: 0, fn: 0, exact: 0 });
  let negCases = 0, negClean = 0;
  for (const c of cases) {
    const gold = [];
    for (const e of c.expect) for (const [k, o] of occurrences(c.text, e.value).entries()) if (!e.at || e.at.includes(k)) gold.push({ type: e.type, span: o, value: e.value, hit: false });
    // 同じ位置の重複を除く
    const uniq = []; for (const g of gold) if (!uniq.some(u => u.type === g.type && u.span[0] === g.span[0] && u.span[1] === g.span[1])) uniq.push(g);
    const pred = D.detect(c.text, { enabled: { date: true } });
    const caseMiss = [];
    for (const p of pred) {
      let best = null, bi = 0;
      for (const g of uniq) { if (g.hit || g.type !== p.type) continue; const v = iou([p.start, p.end], g.span); if (v > bi) { bi = v; best = g; } }
      if (best && bi >= 0.5) { best.hit = true; get(p.type).tp++; if (bi === 1) get(p.type).exact++; }
      else { get(p.type).fp++; caseMiss.push(`  FP ${p.type} ${JSON.stringify(p.value)} (${p.rule})`); }
    }
    for (const g of uniq) if (!g.hit) { get(g.type).fn++; caseMiss.push(`  FN ${g.type} ${JSON.stringify(g.value)}`); }
    if (!c.expect.length) { negCases++; if (!pred.length) negClean++; }
    if (caseMiss.length) misses.push(`${c.id}: ${c.text.replace(/\n/g, '⏎').slice(0, 70)}\n${caseMiss.join('\n')}`);
  }
  const rows = D.TYPES.map(T => {
    const r = per[T.key] || { tp: 0, fp: 0, fn: 0, exact: 0 };
    const P = r.tp + r.fp ? r.tp / (r.tp + r.fp) : null;
    const R = r.tp + r.fn ? r.tp / (r.tp + r.fn) : null;
    return { type: T.key, label: T.label, tp: r.tp, fp: r.fp, fn: r.fn, exact: r.exact, precision: P, recall: R };
  });
  const tot = rows.reduce((a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn }), { tp: 0, fp: 0, fn: 0 });
  return { cases: cases.length, negCases, negClean, rows, total: { ...tot, precision: tot.tp / (tot.tp + tot.fp), recall: tot.tp / (tot.tp + tot.fn) }, misses };
}
const pct = v => v == null ? '  -  ' : (v * 100).toFixed(1).padStart(5) + '%';
function print(name, r) {
  console.log(`\n== ${name}: ${r.cases}件（負例 ${r.negCases}件中 ${r.negClean}件で誤検出ゼロ）`);
  console.log('種類          正解数  当たり 誤検出 見逃し  適合率  再現率');
  for (const x of r.rows) if (x.tp + x.fp + x.fn) console.log(`${x.label.padEnd(8, '　')}  ${String(x.tp + x.fn).padStart(5)} ${String(x.tp).padStart(6)} ${String(x.fp).padStart(6)} ${String(x.fn).padStart(6)}  ${pct(x.precision)}  ${pct(x.recall)}`);
  console.log(`合計          ${String(r.total.tp + r.total.fn).padStart(5)} ${String(r.total.tp).padStart(6)} ${String(r.total.fp).padStart(6)} ${String(r.total.fn).padStart(6)}  ${pct(r.total.precision)}  ${pct(r.total.recall)}`);
}

const load = f => JSON.parse(readFileSync(path.join(ROOT, f), 'utf8'));
const dev = load('scripts/fuseru/cases_dev.json');
const H1 = 'scripts/fuseru/cases_heldout.json', H2 = 'scripts/fuseru/cases_heldout2.json';
const rd = evaluate(dev);
console.log(`unit tests: ${passed} passed`);
print('開発用（dev・作者が書いて検出器の調整に使った）', rd);
let rh = null;
if (!process.argv.includes('--dev-only')) {
  rh = evaluate(load(process.env.HELD || H1));
  print(`ホールドアウト ${process.env.HELD || H1}`, rh);
}
const show = process.argv.indexOf('--show');
if (show >= 0) { const which = process.argv[show + 1] === 'heldout' ? rh : rd; console.log('\n' + which.misses.join('\n')); }

// テストとしての合格線（開発用ケース）: 全体の適合率・再現率 0.9 以上
assert.ok(rd.total.precision >= 0.9 && rd.total.recall >= 0.9, 'dev の全体の適合率・再現率が 0.9 未満');

if (process.argv.includes('--write')) {
  // 凍結版: 2組目のテストを初めて走らせた時点の検出器（_dev/fuseru/fuseru-core.frozen.js）。
  // この値がいちばん「答えを見ていない」数字なので、ページではこれを主に載せる
  const FROZEN = require(path.join(ROOT, '_dev/fuseru/fuseru-core.frozen.js'));
  const strip = r => ({ cases: r.cases, negCases: r.negCases, negClean: r.negClean, rows: r.rows, total: r.total });
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    rule: '種類が同じで範囲の重なり(IoU)が0.5以上を当たりとする',
    frozen: strip(evaluate(load(H2), FROZEN)),
    current2: strip(evaluate(load(H2))),
    current1: strip(evaluate(load(H1))),
    dev: strip(rd)
  };
  print('2組目・凍結版（ページの主な数字）', out.frozen);
  print('2組目・今の版（外れを見て直した後）', out.current2);
  writeFileSync(path.join(ROOT, 'data/fuseru/metrics.js'),
    '/* fuseru: 種類別の適合率・再現率。scripts/fuseru/test_core.mjs --write が生成。手で直さない */\n' +
    '(function(g){g.FUSERU_METRICS=' + JSON.stringify(out) + ';})(typeof globalThis!==\'undefined\'?globalThis:this);\n', 'utf8');
  console.log('\nwrote data/fuseru/metrics.js');
}
