// ehon.html の <script id="ehon2-core"> を抽出して評価し、純関数をテストする
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

const html = readFileSync(new URL('../ehon.html', import.meta.url), 'utf8');
const m = html.match(/<script id="ehon2-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'ehon2-core script block found');
const sandbox = { window: {} };
new Function('window', m[1])(sandbox.window);
const E = sandbox.window.EHON2;
assert.ok(E, 'window.EHON2 defined');

// dailySpotIndex: 決定的・範囲内・日付で変わる
assert.strictEqual(E.dailySpotIndex('2026-07-05', 'turtle', 4), E.dailySpotIndex('2026-07-05', 'turtle', 4), 'deterministic');
for (const d of ['2026-07-05', '2026-07-06', '2026-07-07']) {
  const i = E.dailySpotIndex(d, 'turtle', 4);
  assert.ok(i >= 0 && i < 4, `in range: ${i}`);
}
{ // 30日間で少なくとも2種類の位置を取る (毎日同じ場所にならない)
  const seen = new Set();
  for (let day = 1; day <= 30; day++) seen.add(E.dailySpotIndex(`2026-07-${String(day).padStart(2, '0')}`, 'wolfpup', 4));
  assert.ok(seen.size >= 2, 'position varies across days');
}
// 動物IDでも変わる (同日で全動物が同じindexにならないこと)
{
  const ids = ['turtle', 'wolfpup', 'penguin', 'dingo', 'hare'];
  const set = new Set(ids.map(a => E.dailySpotIndex('2026-07-05', a, 5)));
  assert.ok(set.size >= 2, 'varies across animals');
}

// zukan reducer
let s = { found: {} };
s = E.zukanAdd(s, 'turtle', '2026-07-05');
assert.strictEqual(s.found.turtle, '2026-07-05');
s = E.zukanAdd(s, 'turtle', '2026-07-06');
assert.strictEqual(s.found.turtle, '2026-07-05', 'first-found date is kept');
assert.strictEqual(E.zukanIsComplete(s, ['turtle']), true);
assert.strictEqual(E.zukanIsComplete(s, ['turtle', 'wolfpup']), false);
console.log('ehon2_core_test: ALL PASS');

// ANIMALS と PAGES の整合 (HTML テキストレベルの静的チェック)
const animalIds = [...html.matchAll(/\{id:'([a-z]+)',\s*page:'([a-z\-]+)'/g)].map(m => ({ id: m[1], page: m[2] }));
assert.strictEqual(animalIds.length, 11, '11 animals defined');
const pageIds = [...html.matchAll(/\{id:'([a-z\-]+)', type:'content'/g)].map(m => m[1]);
for (const a of animalIds) assert.ok(pageIds.includes(a.page), `animal ${a.id} page exists: ${a.page}`);
assert.ok(!animalIds.some(a => a.page === 'hollow-tale'), 'hollow-tale has no animal');
console.log('animals/pages consistency: PASS');
