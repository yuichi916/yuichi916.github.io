// ステージ1の指紋の基準を作る（ステージ2を入れる前の版の core.js で 1 回だけ回す）。
// 使い方: node _dev/hitofude-stage1-golden.mjs <core.js のパス> <書き出す JSON>
//   例: git show d7540b35:assets/hitofude/core.js > E:/wt/hitofude-s2-out/base/core.js
//       node _dev/hitofude-stage1-golden.mjs E:/wt/hitofude-s2-out/base/core.js tests/hitofude_stage1_golden.json
// いまの core.js と、前の版の core.js をじかに比べるときは: node _dev/hitofude-stage1-golden.mjs <前の core.js> --diff
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fingerprint } from '../tests/hitofude_stage1_cases.mjs';

const [src, dst] = process.argv.slice(2);
const t0 = Date.now();
const old = fingerprint(await import(pathToFileURL(resolve(src)).href));
if (dst === '--diff') {
  const now = fingerprint(await import('../assets/hitofude/core.js'));
  const keys = Object.keys(old), bad = keys.filter((k) => old[k] !== now[k]);
  console.log(`${keys.length} ケース中 ${bad.length} ケースが違う${bad.length ? ': ' + bad.slice(0, 20).join(', ') : ''}（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
  process.exit(bad.length ? 1 : 0);
}
writeFileSync(dst, JSON.stringify({ from: 'd7540b35:assets/hitofude/core.js', made: new Date().toISOString().slice(0, 10), cases: Object.keys(old).length, fp: old }) + '\n');
console.log(`${Object.keys(old).length} ケースの指紋を ${dst} に書いた（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
