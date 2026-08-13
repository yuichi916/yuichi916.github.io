import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'n6712204417';
const [pref, curated, summary] = await Promise.all([
  readFile(`${base}/pref/13.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/curated.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/summary.json`, 'utf8').then(JSON.parse),
]);

const item = pref.items.find(row => row[0] === facilityId);
assert.ok(item, '東京都データにSPA&HOTEL和の既存OSMレコードが必要です。');
assert.equal(item[1], 'SPA&HOTEL 和');
assert.equal(item[4], 'bath');
assert.equal(item[14], '大田区');
assert.equal(item[15], '11:00〜翌9:00（最終受付 翌8:00）');
assert.equal(item[17], 'https://www.spa-nagomi.com/');
assert.equal(item[22], '2026-08-13');

const record = curated[facilityId];
assert.ok(record, '公式根拠が必要です。');
assert.equal(record.checked, '2026-08-13');
assert.equal(record.facts.length, 7);
assert.deepEqual(record.facts.map(fact => fact.k), ['price', 'hours', 'towel', 'payment_method', 'reservation', 'conditions', 'silence']);
assert.ok(record.facts.find(fact => fact.k === 'reservation')?.v.includes('予約不要'));
assert.ok(record.facts.find(fact => fact.k === 'silence')?.v.includes('会話環境は要確認'));
assert.equal(summary.total, 40581);
assert.equal(summary.checked_count, 766);

console.log(JSON.stringify({ facilityId, factCount: record.facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
