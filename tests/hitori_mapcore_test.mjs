// 新マップの純関数テスト。DOM も fetch も使わない。実行: node tests/hitori_mapcore_test.mjs
import * as mc from '../assets/hitori/map-core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function deq(a, b, msg) { eq(JSON.stringify(a), JSON.stringify(b), msg); }

check('displayCat: museum/library は stay ではなく quiet', () => {
  eq(mc.displayCat('museum', 'stay'), 'quiet');
  eq(mc.displayCat('library', 'stay'), 'quiet');
  eq(mc.displayCat('hostel', 'stay'), 'stay');
  eq(mc.displayCat('ramen', 'eat'), 'eat');
  eq(mc.displayCat('private_sauna', 'stay'), 'bath', 'データ側の cat がずれていても kind を信じる');
  eq(mc.displayCat('unknown_kind', 'play'), 'play', '未知 kind は cat のまま');
});

check('kindJa', () => {
  eq(mc.kindJa('soba_udon'), 'そば・うどん');
  eq(mc.kindJa('netcafe'), 'ネットカフェ');
  eq(mc.kindJa('zzz'), 'zzz');
});

check('fitNote', () => {
  eq(mc.fitNote('ramen'), '一人客が普通の業態');
  eq(mc.fitNote('karaoke'), 'ヒトカラ対応は要確認');
  eq(mc.fitNote('zzz'), '');
});

check('DISPLAY_CATS の順', () => {
  deq(mc.DISPLAY_CATS.map(c => c.key), ['eat', 'bath', 'play', 'quiet', 'stay']);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('OK: map-core');
