import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'n6785091986';
const [pref, curated, summary] = await Promise.all([
  readFile(`${base}/pref/13.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/curated.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/summary.json`, 'utf8').then(JSON.parse),
]);

const item = pref.items.find(row => row[0] === facilityId);
assert.ok(item, '東京都データに既存OSMレコードが必要です。');
assert.equal(item[1], '蒲田温泉');
assert.equal(item[4], 'bath');
assert.equal(item[14], '大田区');
assert.equal(item[15], '年中無休 10:00〜24:00');
assert.equal(item[17], 'https://kamata-onsen.com/');
assert.equal(item[22], '2026-08-13');

const record = curated[facilityId];
assert.ok(record, '公式根拠が必要です。');
assert.equal(record.checked, '2026-08-13');
assert.equal(record.facts.length, 6);
assert.deepEqual(record.facts.map(fact => fact.k), ['price', 'hours', 'towel', 'payment_method', 'conditions', 'silence']);
assert.ok(record.facts.find(fact => fact.k === 'silence')?.v.includes('会話環境は要確認'));
assert.ok(record.facts.filter(fact => fact.k !== 'silence').every(fact => fact.official));
assert.equal(summary.total, 40580);
assert.equal(summary.checked_count, 764);

console.log(JSON.stringify({ facilityId, factCount: record.facts.length, checkedCount: summary.checked_count }, null, 2));
