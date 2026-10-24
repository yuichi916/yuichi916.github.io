// どっちが本物？: assets/honmono-core.js の検査（node scripts/honmono/test_core.mjs）
//   - 1回10問で、同じ作品が二度出ない・同じ作家が続かない（2万回）
//   - 原文が左に来る割合がほぼ半分、各問題がほぼ均等に出る
//   - 共有文の形
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);
const H = require(path.join(root, 'assets', 'honmono-core.js'));
const data = JSON.parse(readFileSync(path.join(root, 'data', 'honmono', 'pairs.json'), 'utf8'));

let fails = 0;
const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } };

// 再現できる乱数（mulberry32）
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = 20000;
const r = rng(12345);
let left = 0, total = 0;
const count = new Map();
for (let k = 0; k < R; k++) {
  const round = H.pickRound(data.pairs, 10, r);
  check(round.length === 10, '10問');
  const ids = new Set(round.map((q) => q.pair.id));
  check(ids.size === 10, '同じ作品が二度出た');
  for (let i = 1; i < round.length; i++) {
    check(round[i].pair.author !== round[i - 1].pair.author, '同じ作家が続いた');
    check(round[i].pair.work_id !== round[i - 1].pair.work_id, '同じ作品が続いた');
  }
  for (const q of round) {
    total++; if (q.originalLeft) left++;
    count.set(q.pair.id, (count.get(q.pair.id) || 0) + 1);
  }
  if (fails > 5) break;
}
const lr = left / total;
check(Math.abs(lr - 0.5) < 0.01, '左右の偏り ' + lr);
const exp = total / data.pairs.length;
const cs = [...count.values()];
check(count.size === data.pairs.length, '出ない問題がある');
check(Math.min(...cs) > exp * 0.9 && Math.max(...cs) < exp * 1.1, '出題の偏り ' + Math.min(...cs) + '〜' + Math.max(...cs) + ' 期待 ' + exp.toFixed(0));

const st = H.shareText([true, false, true, true, true, true, true, true, false, true], 'https://yuichi916.github.io/honmono.html?ref=x');
check(st.includes('10問中8問 正解'), '共有文の点数');
check(st.endsWith('?ref=x'), '共有文の URL');
check(st.split('\n').length === 4, '共有文の行数');

console.log(`回数 ${R} / 原文が左 ${(lr * 100).toFixed(1)}% / 出題回数 ${Math.min(...cs)}〜${Math.max(...cs)}（期待 ${exp.toFixed(0)}）`);
if (fails) { console.log('FAIL', fails); process.exit(1); }
console.log('ALL OK');
