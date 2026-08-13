import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'manual-tokyo-smart-stay-shizuku-oimachi-20260813';
const [pref, curated, summary] = await Promise.all([
  readFile(`${base}/pref/13.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/curated.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/summary.json`, 'utf8').then(JSON.parse),
]);

const item = pref.items.find(row => row[0] === facilityId);
assert.ok(item, '東京都データにSmart Stay SHIZUKU品川大井町が必要です。');
assert.equal(item[1], 'Smart Stay SHIZUKU品川大井町');
assert.equal(item[2], 35.607802);
assert.equal(item[3], 139.735827);
assert.equal(item[4], 'bath');
assert.equal(item[5], 'capsule_hotel_sauna');
assert.equal(item[14], '品川区');
assert.equal(item[16], '03-6810-4980');
assert.equal(item[22], '2026-08-13');

const record = curated[facilityId];
assert.ok(record, '公式根拠が必要です。');
assert.equal(record.checked, '2026-08-13');
assert.equal(record.facts.length, 5);
assert.deepEqual(record.facts.map(fact => fact.k), ['conditions', 'hours', 'towel', 'payment_method', 'silence']);
assert.ok(record.facts.find(fact => fact.k === 'conditions')?.v.includes('日帰り入浴も利用可能'));
assert.ok(record.facts.find(fact => fact.k === 'silence')?.v.includes('会話環境は要確認'));
assert.equal(summary.total, 40581);
assert.equal(summary.checked_count, 766);

console.log(JSON.stringify({ facilityId, factCount: record.facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
