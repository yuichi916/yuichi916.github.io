import fs from 'node:fs/promises';

const root = '/home/ubuntu/hitori-source/data/hitori';
const [prefText, curatedText, summaryText] = await Promise.all([
  fs.readFile(`${root}/pref/32.json`, 'utf8'),
  fs.readFile(`${root}/curated.json`, 'utf8'),
  fs.readFile(`${root}/summary.json`, 'utf8'),
]);

const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const ids = [
  'manual-shimane-private-sauna-dann-20260812',
  'manual-shimane-fumai-sauna-20260812',
];
const fields = Object.fromEntries(pref.fields.map((field, index) => [field, index]));

const rows = ids.map(id => pref.items.find(row => row[fields.id] === id));
if (rows.some(row => !row)) throw new Error('島根県の新規施設行が不足しています。');
if (new Set(rows.map(row => row[fields.id])).size !== ids.length) throw new Error('新規施設IDが重複しています。');
if (rows.some(row => row.length !== pref.fields.length)) throw new Error('新規施設のフィールド数が一致しません。');
if (rows.some(row => row[fields.cat] !== 'bath' || row[fields.kind] !== 'private_sauna')) throw new Error('業態情報が正しくありません。');
if (rows.some(row => !Number.isFinite(row[fields.lat]) || !Number.isFinite(row[fields.lon]))) throw new Error('座標が正しくありません。');

for (const id of ids) {
  const record = curated[id];
  if (!record || record.checked !== '2026-08-12') throw new Error(`確認済み根拠が不足しています: ${id}`);
  if (!record.facts.every(fact => fact.official && fact.urls?.length && fact.src?.length)) throw new Error(`公式根拠URLが不足しています: ${id}`);
}

const shimane = summary.prefectures.find(prefecture => prefecture.code === 32);
if (summary.total !== 40562 || summary.checked_count !== 810 || shimane?.counts?.all !== 279 || shimane?.counts?.bath !== 43) {
  throw new Error('集計値が追加後の期待値と一致しません。');
}

console.log(JSON.stringify({
  status: 'ok',
  total: summary.total,
  checkedCount: summary.checked_count,
  shimaneItems: pref.items.length,
  candidates: rows.map(row => ({ id: row[fields.id], name: row[fields.name], city: row[fields.city], coordinates: [row[fields.lat], row[fields.lon]] })),
}, null, 2));
