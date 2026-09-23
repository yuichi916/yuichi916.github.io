// 気持ちスタンプの置き場所の静的検査。実行: node tests/feel_placement_test.mjs
// 設計書 4 章の表どおりに置かれ、読み込みと計測タグがそろっているかを見る。
import { readFileSync, readdirSync } from 'node:fs';
import { stampsFor, isWorkId } from '../assets/feel/feel-core.js';

const ROOT = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
const SCRIPT = '<script type="module" src="/assets/feel/feel.js"></script>';
const GC = 'gc.zgo.at/count.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// [ファイル, 作品ID, 組, 小型版か]。Task 4〜6 で行を足す
const EXPECTED = [
  ['index.html', 'site', 'site', false],
];

// 置いてはいけないページ（設計書 4 章）
const NEVER = ['cabin.html', 'niwa.html', 'hitori.html', 'stopwatch.html', 'koe.html', 'journal.html',
  'kototsugi/game/index.html'];

for (const [file, work, set, compact] of EXPECTED) {
  check(`${file}: ${work} / ${set}`, () => {
    const html = read(file);
    const tag = `data-feel="${work}" data-feel-set="${set}"${compact ? ' data-feel-mode="compact"' : ''}`;
    ok(html.includes(tag), `置き場所が無い: ${tag}`);
    ok(html.split(SCRIPT).length - 1 === 1, 'feel.js の読み込みがちょうど 1 回ではない');
    ok(html.includes(GC), 'GoatCounter の count.js が無い');
  });
}

for (const file of NEVER) {
  check(`${file} には置かない`, () => ok(!read(file).includes('data-feel'), 'data-feel がある'));
}

// サイト全体: 置いた所はすべて、組が実在し、作品 ID が正しく、feel.js を読み込んでいる
function htmlFiles(dir = '') {
  const out = [];
  for (const e of readdirSync(new URL(dir || './', ROOT), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules') continue;
    const rel = dir + e.name;
    if (e.isDirectory()) out.push(...htmlFiles(rel + '/'));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
for (const file of htmlFiles()) {
  const html = read(file);
  if (!html.includes('data-feel=')) continue;
  check(`${file}: 組と作品 ID と読み込み`, () => {
    for (const m of html.matchAll(/data-feel-set="([^"]*)"/g)) ok(stampsFor(m[1]), `知らない組: ${m[1]}`);
    for (const m of html.matchAll(/data-feel="([^"]*)"/g)) ok(isWorkId(m[1]), `作品 ID が不正: ${m[1]}`);
    ok(html.includes(SCRIPT), 'feel.js を読み込んでいない');
  });
}

check('index: ナビ・節・節番号', () => {
  const html = read('index.html');
  ok(html.includes('<a href="#feelings">気持ち</a>'), 'ナビに「気持ち」が無い');
  ok(html.includes('<section class="section" id="feelings">'), '#feelings の節が無い');
  ok(html.includes('data-feel-board'), 'ボードが無い');
  for (const s of ['№ 05 — みんなの気持ち', '№ 06 — 世界の外の窓', '№ 07 — Agent View', '№ 08 — 立場とプロフィール']) {
    ok(html.includes(s), `節番号が無い: ${s}`);
  }
  ok(!html.includes('№ 05 — 世界の外の窓'), '古い節番号「№ 05 — 世界の外の窓」が残っている');
});

if (failures) { console.error(`feel_placement_test: ${failures} FAILED`); process.exit(1); }
console.log('feel_placement_test: ALL PASS');
