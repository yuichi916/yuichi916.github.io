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

check('openLabel: OSM の oh で営業中と閉店時刻', () => {
  const now = new Date(2026, 7, 29, 12, 0);   // 土曜 12:00
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, null, now);
  eq(r.state, 'open'); eq(r.text, '営業中 〜21:00'); eq(r.source, 'OpenStreetMap');
});
check('openLabel: 日をまたぐ閉店は「翌」', () => {
  const now = new Date(2026, 7, 29, 23, 30);
  const r = mc.openLabel({ oh: '18:00-02:00' }, null, now);
  eq(r.state, 'open'); eq(r.text, '営業中 〜翌2:00');
});
check('openLabel: 確認済み hours を OSM より優先', () => {
  const now = new Date(2026, 7, 29, 12, 0);
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, { v: '10:00-15:00', official: true }, now);
  eq(r.text, '営業中 〜15:00'); eq(r.source, '公式サイト');
});
check('openLabel: 解釈できない hours は OSM に落ちる', () => {
  const now = new Date(2026, 7, 29, 12, 0);
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, { v: '午前11時から午後9時まで', official: true }, now);
  eq(r.source, 'OpenStreetMap');
});
check('openLabel: 何も無ければ unknown', () => {
  const r = mc.openLabel({}, null, new Date(2026, 7, 29, 12, 0));
  eq(r.state, 'unknown'); eq(r.text, '営業時間は要確認');
});
check('openLabel: 時間外', () => {
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, null, new Date(2026, 7, 29, 22, 0));
  eq(r.state, 'closed'); eq(r.text, '営業時間外');
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('OK: map-core');
