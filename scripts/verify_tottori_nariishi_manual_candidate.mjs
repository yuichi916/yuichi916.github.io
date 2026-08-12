import fs from 'node:fs/promises';

const root = '/home/ubuntu/hitori-source/data/hitori';
const id = 'manual-tottori-nariishi-sauna-20260813';
const [prefText, curatedText, summaryText] = await Promise.all([
  fs.readFile(`${root}/pref/31.json`, 'utf8'),
  fs.readFile(`${root}/curated.json`, 'utf8'),
  fs.readFile(`${root}/summary.json`, 'utf8'),
]);

const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const fields = Object.fromEntries(pref.fields.map((field, index) => [field, index]));
const row = pref.items.find(item => item[fields.id] === id);

if (!row) throw new Error('鳥取県の新規施設行が不足しています。');
if (pref.items.filter(item => item[fields.id] === id).length !== 1) throw new Error('鳥取県の新規施設IDが重複しています。');
if (row.length !== pref.fields.length || row[fields.cat] !== 'bath' || row[fields.kind] !== 'private_sauna') throw new Error('新規施設の分類またはフィールド数が正しくありません。');
if (!Number.isFinite(row[fields.lat]) || !Number.isFinite(row[fields.lon])) throw new Error('新規施設の座標が正しくありません。');

const record = curated[id];
if (!record || record.checked !== '2026-08-13' || record.facts.length !== 5) throw new Error('確認済み根拠が不足しています。');
if (!record.facts.every(fact => fact.official && fact.urls?.includes('https://nature-sauna.jp/nariishi-sauna/'))) throw new Error('公式根拠URLが不足しています。');

const tottori = summary.prefectures.find(prefecture => prefecture.code === 31);
if (summary.total !== 40565 || summary.checked_count !== 813 || tottori?.counts?.all !== 210 || tottori?.counts?.bath !== 36) throw new Error('集計値が追加後の期待値と一致しません。');

console.log(JSON.stringify({ status: 'ok', total: summary.total, checkedCount: summary.checked_count, tottoriItems: pref.items.length, candidate: { id: row[fields.id], name: row[fields.name], city: row[fields.city], coordinates: [row[fields.lat], row[fields.lon]] } }, null, 2));
