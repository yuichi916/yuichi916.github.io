import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'manual-tokyo-shinagawa-sauna-oimachi-20260813';
const [pref, curated, summary] = await Promise.all([
  readFile(`${base}/pref/13.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/curated.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/summary.json`, 'utf8').then(JSON.parse),
]);

const item = pref.items.find(row => row[0] === facilityId);
assert.ok(item, '東京都データに品川サウナが必要です。');
assert.equal(item[1], '品川サウナ');
assert.equal(item[2], 35.606897);
assert.equal(item[3], 139.733326);
assert.equal(item[4], 'bath');
assert.equal(item[5], 'sauna');
assert.equal(item[14], '品川区');
assert.equal(item[17], 'https://www.shinagawa-sauna.com/');
assert.equal(item[22], '2026-08-13');

const record = curated[facilityId];
assert.ok(record, '公式根拠が必要です。');
assert.equal(record.checked, '2026-08-13');
assert.equal(record.facts.length, 5);
assert.deepEqual(record.facts.map(fact => fact.k), ['hours', 'towel', 'payment_method', 'conditions', 'silence']);
assert.ok(record.facts.find(fact => fact.k === 'silence')?.v.includes('会話環境は要確認'));
assert.ok(record.facts.filter(fact => fact.k !== 'silence').every(fact => fact.official));
assert.equal(summary.total, 40581);
assert.equal(summary.checked_count, 766);

console.log(JSON.stringify({ facilityId, factCount: record.facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
