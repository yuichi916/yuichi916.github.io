import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'n10994791642';

const [pref, curated, summary] = await Promise.all([
  readFile(`${base}/pref/14.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/curated.json`, 'utf8').then(JSON.parse),
  readFile(`${base}/summary.json`, 'utf8').then(JSON.parse),
]);

const item = pref.items.find(row => row[0] === facilityId);
assert.ok(item, 'prefecture data must include the existing OSM record');
assert.equal(item[1], 'ROKU SAUNAたまプラーザ店');
assert.equal(item[5], 'private_sauna');
assert.equal(item[10], 1, 'chain flag must be retained');
assert.equal(item[14], '横浜市青葉区');
assert.equal(item[17], 'https://rokusauna.com/shop/kantou/kanagawa/tama-plaza/');
assert.equal(item[22], '2026-08-13');

const record = curated[facilityId];
assert.ok(record, 'curated evidence must exist for the same OSM external ID');
assert.equal(record.checked, '2026-08-13');
assert.equal(record.facts.length, 6);
assert.deepEqual(record.facts.map(fact => fact.k), ['solo_ok', 'price', 'reservation', 'hours', 'towel', 'silence']);
assert.ok(record.facts.every(fact => fact.official && !fact.conflict));
assert.ok(record.facts.find(fact => fact.k === 'silence')?.v.includes('会話環境は要確認'));
assert.equal(summary.total, 40579);
assert.equal(summary.checked_count, 763);

console.log(JSON.stringify({ facilityId, factCount: record.facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
