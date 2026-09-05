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

const ENTRY = { checked: '2026-08-08', facts: [
  { k: 'price', v: 600, official: true, conflict: true, src: ['city.kuwana.lg.jp'], urls: ['https://www.city.kuwana.lg.jp/a.pdf'] },
  { k: 'price', v: 150, official: false, conflict: true, src: ['yuru-to.net'], urls: ['https://yuru-to.net/d'] },
  { k: 'hours', v: '10:00-21:00', official: true, conflict: false, src: ['city.kuwana.lg.jp'], urls: ['https://www.city.kuwana.lg.jp/'] },
  { k: 'bring_towel', v: 'rental', official: true, conflict: false, src: ['city.kuwana.lg.jp'], urls: ['https://www.city.kuwana.lg.jp/'] },
  { k: 'solo_ok', v: 'お一人様歓迎と明記', official: true, conflict: false, src: ['x.jp'], urls: ['https://x.jp/'] },
  { k: 'access', v: 'male_only', official: true, conflict: false, src: ['x.jp'], urls: ['https://x.jp/'] },
  { k: 'status', v: 'closed_temporarily', official: false, conflict: false, src: ['zatsu-ke.blog.jp'], urls: ['https://zatsu-ke.blog.jp/p'] },
  { k: 'solo_insight', v: { title: 'T', insight: 'I', quality: 'grounded', policyVersion: 'official-provenance-v2' }, official: true, conflict: false, src: ['x.jp'], urls: [] },
]};

check('summarizeCurated', () => {
  deq(mc.summarizeCurated(ENTRY), { checked: '2026-08-08', nFacts: 8, nOfficial: 6, nDomains: 4, nConflict: 2 });
});
check('groupFacts: 食い違いは両方並ぶ', () => {
  const g = mc.groupFacts(ENTRY, 'bath');
  const price = g.rows.find(r => r.k === 'price');
  eq(price.conflict, true); eq(price.values.length, 2);
  eq(price.values[0].text, '600円'); eq(price.values[0].domain, 'city.kuwana.lg.jp'); eq(price.values[0].official, true);
  eq(price.values[1].text, '150円'); eq(price.values[1].official, false);
  eq(g.rows[0].k, 'hours', 'hours が price より先');
});
check('groupFacts: 飲食ではタオル系を出さない', () => {
  eq(mc.groupFacts(ENTRY, 'bath').rows.some(r => r.k === 'bring_towel'), true);
  eq(mc.groupFacts(ENTRY, 'eat').rows.some(r => r.k === 'bring_towel'), false);
});
check('groupFacts: ひとり基準と警告と insight', () => {
  const g = mc.groupFacts(ENTRY, 'bath');
  eq(g.solo[0].label, '一人利用'); eq(g.solo[0].text, 'お一人様歓迎と明記');
  eq(g.warnings.some(w => w.level === 'danger' && w.text.includes('休業中')), true);
  eq(g.warnings.some(w => w.level === 'warn' && w.text.includes('男性専用')), true);
  deq(g.insight, { title: 'T', insight: 'I' });
  eq(g.rows.some(r => r.k === 'solo_insight'), false);
});
check('groupFacts: 食い違っていても閉業・利用条件は警告に出す（食い違いと断って）', () => {
  const e = { checked: '', facts: [
    { k: 'status', v: 'closed_permanently', official: false, conflict: true, src: ['a.jp'], urls: ['https://a.jp/'] },
    { k: 'access', v: 'members_only', official: true, conflict: true, src: ['b.jp'], urls: ['https://b.jp/'] },
    { k: 'renamed_to', v: 'ほげ湯', official: false, conflict: true, src: ['c.jp'], urls: ['https://c.jp/'] },
  ]};
  const w = mc.groupFacts(e, 'bath').warnings;
  const closed = w.find(x => x.text.includes('閉業'));
  eq(!!closed, true, '閉業の警告が消えている'); eq(closed.level, 'danger');
  eq(closed.text.includes('（出典で食い違い）'), true);
  const acc = w.find(x => x.text.includes('会員制'));
  eq(!!acc, true, '利用条件の警告が消えている'); eq(acc.level, 'warn');
  eq(acc.text.includes('（出典で食い違い）'), true);
  eq(w.some(x => x.text.includes('改称')), false, '改称は食い違っていれば出さない');
});
check('formatFactValue: ロッカー', () => {
  eq(mc.formatFactValue('facilities', 'locker'), 'ロッカーあり');
});
check('groupFacts: 個人訪問記ラベル', () => {
  const g = mc.groupFacts(ENTRY, 'bath');
  eq(g.rows.find(r => r.k === 'status').values[0].personal, true);
});
check('groupFacts: insight は grounded でなければ null', () => {
  const e = { checked: '', facts: [{ k: 'solo_insight', v: { title: 'T', insight: 'I', quality: 'draft', policyVersion: 'official-provenance-v2' }, official: true }] };
  eq(mc.groupFacts(e, 'eat').insight, null);
});
check('formatFactValue', () => {
  eq(mc.formatFactValue('payment_method', 'ticket_machine'), '券売機あり');
  eq(mc.formatFactValue('price', 600), '600円');
  eq(mc.formatFactValue('hours', '10:00-21:00'), '10:00-21:00');
});

const ITEMS = [
  { id: 'a', name: 'A', city: '横浜市', kind: 'ramen', cat: 'eat', chain: 0, hidden: .9, hidden_n: 4, solo: 5, distM: 900, oh: '24/7' },
  { id: 'b', name: 'B', city: '川崎市', kind: 'sento', cat: 'bath', chain: 0, hidden: 0, hidden_n: 2, solo: 4, distM: 100, oh: 'Mo-Su 11:00-21:00' },
  { id: 'c', name: 'C', city: '横浜市', kind: 'gyudon', cat: 'eat', chain: 1, hidden: 0, hidden_n: 9, solo: 5, distM: 5000, oh: '' },
  { id: 'd', name: 'D', city: '鎌倉市', kind: 'museum', cat: 'stay', chain: 0, hidden: 0, hidden_n: 0, solo: 5, distM: 300, oh: 'Tu-Su 09:00-17:00' },
];
const checked = id => id === 'c';
const NOW = new Date(2026, 7, 29, 12, 0); // 土

check('applyFilters: cat は表示カテゴリで判定', () => {
  deq(mc.applyFilters(ITEMS, { cat: 'quiet' }, { checked, now: NOW }).map(i => i.id), ['d']);
  deq(mc.applyFilters(ITEMS, { cat: 'stay' }, { checked, now: NOW }).map(i => i.id), []);
});
check('applyFilters: q は kind 日本語にも当たる', () => {
  deq(mc.applyFilters(ITEMS, { q: 'そば' }, { checked, now: NOW }).map(i => i.id), []);
  deq(mc.applyFilters(ITEMS, { q: 'ラーメン' }, { checked, now: NOW }).map(i => i.id), ['a']);
  deq(mc.applyFilters(ITEMS, { q: '川崎' }, { checked, now: NOW }).map(i => i.id), ['b']);
});
check('applyFilters: verifiedOnly / hideChain / gemOnly / openNow / radius', () => {
  deq(mc.applyFilters(ITEMS, { verifiedOnly: true }, { checked, now: NOW }).map(i => i.id), ['c']);
  deq(mc.applyFilters(ITEMS, { hideChain: true }, { checked, now: NOW }).map(i => i.id), ['a', 'b', 'd']);
  deq(mc.applyFilters(ITEMS, { gemOnly: true }, { checked, now: NOW }).map(i => i.id), ['a']);
  deq(mc.applyFilters(ITEMS, { openNow: true }, { checked, now: NOW }).map(i => i.id), ['a', 'b', 'd']);
  deq(mc.applyFilters(ITEMS, { radiusKm: 1 }, { checked, now: NOW, origin: { lat: 0, lon: 0 } }).map(i => i.id), ['a', 'b', 'd']);
  deq(mc.applyFilters(ITEMS, { kinds: ['museum', 'cinema'] }, { checked, now: NOW }).map(i => i.id), ['d']);
});
check('applyFilters: openNow は確認済みの営業時間を OSM より優先する', () => {
  // OSM の oh では 16:00 は営業時間外。確認済みの hours があれば営業中として残す。
  const it = { id: 'v', name: 'V', city: '横浜市', kind: 'sento', cat: 'bath', chain: 0, hidden: 0, hidden_n: 0, solo: 5, oh: 'Mo-Su 11:00-15:00' };
  const at16 = new Date(2026, 7, 29, 16, 0);
  deq(mc.applyFilters([it], { openNow: true }, { checked, now: at16 }).map(i => i.id), []);
  const hoursOf = id => (id === 'v' ? { k: 'hours', v: '11:00-21:00', official: true } : null);
  deq(mc.applyFilters([it], { openNow: true }, { checked, now: at16, hoursOf }).map(i => i.id), ['v']);
  // 時間が分からないものは、絞り込みが入っている間は出さない（従来どおり）。
  const unknown = { ...it, id: 'u', oh: '' };
  deq(mc.applyFilters([unknown], { openNow: true }, { checked, now: at16, hoursOf: () => null }).map(i => i.id), []);
});
check('rankItems: 確認済みが最上位、あとは距離', () => {
  deq(mc.rankItems(ITEMS, { checked, origin: { lat: 0, lon: 0 } }).map(i => i.id), ['c', 'b', 'd', 'a']);
});
check('rankItems: 起点なしは 穴場→solo→名前', () => {
  deq(mc.rankItems(ITEMS, { checked, origin: null }).map(i => i.id), ['c', 'a', 'd', 'b']);
});
check('expandRadius: 0件なら次の段へ', () => {
  const far = [{ id: 'x', distM: 8000 }];
  const r = mc.expandRadius(far, 1);
  eq(r.radiusKm, 10); eq(r.expanded, true); eq(r.items.length, 1);
  const r2 = mc.expandRadius([{ id: 'y', distM: 500 }], 1);
  eq(r2.radiusKm, 1); eq(r2.expanded, false);
  eq(mc.expandRadius([], 1).radiusKm, Infinity);
});
check('expandRadius: steps に無い半径は先頭段として扱う', () => {
  const r = mc.expandRadius([{ id: 'x', distM: 4000 }], 5);
  eq(r.radiusKm, 5); eq(r.expanded, false); eq(r.items.length, 1);
  const r2 = mc.expandRadius([{ id: 'y', distM: 12000 }], 5);
  eq(r2.radiusKm, Infinity); eq(r2.expanded, true);
});
check('nearestChecked', () => {
  const rows = [{ id: 'p', lat: 35.0, lon: 139.0 }, { id: 'q', lat: 35.1, lon: 139.0 }, { id: 'r', lat: 36.0, lon: 139.0 }];
  const r = mc.nearestChecked(rows, 35.09, 139.0, id => id === 'p' || id === 'r');
  eq(r.item.id, 'p');
  eq(mc.nearestChecked(rows, 35, 139, () => false), null);
});
check('SCENES', () => {
  eq(mc.SCENES.length, 4);
  eq(mc.SCENES.find(s => s.key === 'rain').kinds.includes('library'), true);
  eq(mc.SCENES.find(s => s.key === 'bath_tonight').openNow, true);
});

function memStorage(init) { const m = new Map(Object.entries(init || {})); return {
  getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
const IT = { id: 'n1', name: '浜虎', lat: 35.4, lon: 139.6, kind: 'ramen' };

check('loadSaved: 空・壊れ・throw', () => {
  deq(mc.loadSaved(memStorage()), { want: {}, went: {} });
  deq(mc.loadSaved(memStorage({ 'hitori.saved.v1': '{oops' })), { want: {}, went: {} });
  eq(mc.loadSaved({ getItem() { throw new Error('private'); } }), null);
});
check('toggleWant / setWent / removeWent / savedCount', () => {
  let d = { want: {}, went: {} };
  d = mc.toggleWant(d, IT, 14);
  eq(d.want.n1.pref, 14); eq(d.want.n1.name, '浜虎'); eq(d.want.n1.lat, 35.4);
  eq(mc.savedCount(d), 1);
  d = mc.setWent(d, IT, 14, { date: '2026-08-30', memo: '朝ラー' });
  eq(d.went.n1.memo, '朝ラー'); eq(mc.savedCount(d), 1, '同じ施設は1件と数える');
  d = mc.toggleWant(d, IT, 14);
  eq(d.want.n1, undefined); eq(mc.savedCount(d), 1);
  d = mc.removeWent(d, 'n1');
  eq(mc.savedCount(d), 0);
});
check('saveSaved は失敗を false で返す', () => {
  const s = memStorage();
  eq(mc.saveSaved(s, { want: {}, went: {} }), true);
  eq(mc.saveSaved({ setItem() { throw new Error('full'); } }, {}), false);
  deq(JSON.parse(s.getItem('hitori.saved.v1')), { want: {}, went: {} });
});
check('encode/parse saved param', () => {
  const d = { want: { n1: { pref: 14 }, n2: { pref: 13 } }, went: { n1: { pref: 14 }, n3: { pref: 1 } } };
  eq(mc.encodeSavedParam(d), '14:n1,13:n2,1:n3');
  deq(mc.parseSavedParam('14:n1,13:n2,bad,:x,7:'), [{ pref: 14, id: 'n1' }, { pref: 13, id: 'n2' }]);
  deq(mc.parseSavedParam(''), []);
  // 手動収録の id（英字・数字・ハイフン）も共有URLから戻せること
  deq(mc.parseSavedParam('14:manual-kanagawa-8hotel-fujisawa-water-cave-20260820,14:-x,14:'), [{ pref: 14, id: 'manual-kanagawa-8hotel-fujisawa-water-cave-20260820' }]);
});
check('facilityShareUrl', () => {
  eq(mc.facilityShareUrl('https://x.test/hitori.html', 14, 'n1'), 'https://x.test/hitori.html?pref=14&facility=n1');
});

check('soloCheck: 公式にあるものだけ ● にする', () => {
  const e = { checked: '2026-08-08', facts: [
    { k: 'solo_ok', v: 'おひとり様も大歓迎と案内', official: true, conflict: false, src: ['x.jp'], urls: [] },
    { k: 'payment_method', v: 'ticket_machine', official: true, conflict: false, src: ['x.jp'], urls: [] },
    { k: 'reservation', v: 'none', official: false, conflict: false, src: ['b.jp'], urls: [] },
  ]};
  const r = mc.soloCheck(e, { kind: 'ramen' });
  eq(r.cells.length, 6);
  deq(r.cells.map(c => c.key), ['solo', 'seat', 'pay', 'book', 'quiet', 'cond']);
  eq(r.cells[0].state, 'ok'); eq(r.cells[0].short, '公式に一人利用あり');
  eq(r.cells[2].short, '券売機あり');
  eq(r.cells[3].state, 'weak', '公式でない根拠は ● にしない'); eq(r.cells[3].short, '予約不要');
  eq(r.cells[1].state, 'unknown'); eq(r.cells[1].short, '記載なし');
  eq(r.known, 2);
});

check('soloCheck: 一人で行けない条件は ✕', () => {
  const e = { facts: [{ k: 'access', v: 'male_only', official: true, conflict: false }] };
  const r = mc.soloCheck(e, { kind: 'sento' });
  eq(r.cells[5].state, 'blocked'); eq(r.cells[5].short, '男性専用');
  const e2 = { facts: [{ k: 'access', v: 'public', official: true, conflict: false }] };
  eq(mc.soloCheck(e2, {}).cells[5].state, 'ok');
});

check('soloCheck: 休業・閉業は利用条件を ✕ に上書きする', () => {
  const e = { facts: [{ k: 'status', v: 'closed_permanently', official: true, conflict: false }] };
  const r = mc.soloCheck(e, {});
  eq(r.cells[5].state, 'blocked'); eq(r.cells[5].short, '閉業の情報');
});

check('soloCheck: 席は数字なら N席、カウンターならその旨、個室型は業態で埋める', () => {
  eq(mc.soloCheck({ facts: [{ k: 'seats_total', v: 39, official: true }] }, {}).cells[1].short, '39席');
  eq(mc.soloCheck({ facts: [{ k: 'counter_seats', v: '大テーブルのカウンター席', official: true }] }, {}).cells[1].short, 'カウンター席あり');
  const pr = mc.soloCheck({ facts: [] }, { kind: 'private_sauna' });
  eq(pr.cells[1].state, 'weak'); eq(pr.cells[1].short, '個室型');
});

check('soloCheck: 食い違う事実は使わない／長文は12字で切る', () => {
  const e = { facts: [
    { k: 'solo_ok', v: 'あり', official: true, conflict: true },
    { k: 'silence', v: '黙浴にご協力ください。会話はお控えください。', official: true, conflict: false },
  ]};
  const r = mc.soloCheck(e, {});
  eq(r.cells[0].state, 'unknown', '食い違う事実は信号にしない');
  eq(r.cells[4].short, '黙浴にご協力ください');
  eq(r.cells[4].quote.length > r.cells[4].short.length, true, '全文は quote に残す');
});

check('soloCheck: 事実ゼロでも6項目そろう', () => {
  const r = mc.soloCheck(null, { kind: 'ramen' });
  eq(r.cells.length, 6); eq(r.known, 0);
  eq(r.cells.every(c => c.state === 'unknown'), true);
});

check('soloCheck: access の自由文は利用条件の信号にしない', () => {
  const e = { facts: [{ k: 'access', v: '東京都台東区蔵前4丁目2-3', official: true, conflict: false }] };
  const r = mc.soloCheck(e, {});
  eq(r.cells[5].state, 'unknown'); eq(r.cells[5].short, '記載なし');
});

check('soloCheck: 語彙の値は日本語にして出す（生の posted を見せない）', () => {
  const r = mc.soloCheck({ facts: [{ k: 'silence', v: 'posted', official: true, conflict: false }] }, {});
  eq(r.cells[4].short, '静かにの案内あり');
  eq(mc.soloCheck({ facts: [{ k: 'silence', v: 'observed', official: false }] }, {}).cells[4].short, '静かさに触れた記述');
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('OK: map-core');
