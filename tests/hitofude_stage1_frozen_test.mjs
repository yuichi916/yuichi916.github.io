// ステージ1が、ステージ2を入れる前（d7540b35）と一字一句同じかを確かめる。実行: node tests/hitofude_stage1_frozen_test.mjs（1〜2 分）
// 基準 tests/hitofude_stage1_golden.json は、前の版の core.js で _dev/hitofude-stage1-golden.mjs が作った指紋（tests/hitofude_stage1_cases.mjs）。
// 夜の並び・目標点・基準点・大一番・景色・願い札・お守りの候補・900 本の線の点と内訳と記録・160 本のコマごとの出来事・花火合戦・再生リンクを、ケースごとにくらべる
import { readFileSync } from 'node:fs';
import * as K from '../assets/hitofude/core.js';
import { fingerprint } from './hitofude_stage1_cases.mjs';

const golden = JSON.parse(readFileSync(new URL('./hitofude_stage1_golden.json', import.meta.url), 'utf8'));
const t0 = Date.now();
const now = fingerprint(K);
const keys = Object.keys(golden.fp);
const bad = keys.filter((k) => golden.fp[k] !== now[k]);
const extra = Object.keys(now).filter((k) => !(k in golden.fp));
if (keys.length !== golden.cases) { console.error(`基準のケースの数が合わない: ${keys.length} / ${golden.cases}`); process.exit(1); }
if (bad.length || extra.length) {
  console.error(`hitofude_stage1_frozen_test: ${keys.length} ケース中 ${bad.length} ケースが基準（${golden.from}）と違う: ${bad.slice(0, 30).join(', ')}${extra.length ? ` / 基準に無いケース ${extra.length}` : ''}`);
  process.exit(1);
}
console.log(`hitofude_stage1_frozen_test: ${keys.length} ケースすべて基準（${golden.from}）と同じ（${((Date.now() - t0) / 1000).toFixed(1)} 秒） ALL PASS`);
