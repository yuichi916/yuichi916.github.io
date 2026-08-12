import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/home/ubuntu/hitori-source/data/hitori';
const ids = ['manual-tokyo-hitorisauna-plus-ebisu-20260813', 'manual-tokyo-roku-sauna-seiseki-20260813'];
const [prefText, curatedText, summaryText] = await Promise.all([
  fs.readFile(path.join(root, 'pref/13.json'), 'utf8'),
  fs.readFile(path.join(root, 'curated.json'), 'utf8'),
  fs.readFile(path.join(root, 'summary.json'), 'utf8'),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const rows = pref.items.filter(row => ids.includes(row[0]));
if (rows.length !== ids.length) throw new Error(`東京都データの対象件数が不正です: ${rows.length}`);
if (new Set(rows.map(row => row[0])).size !== ids.length) throw new Error('東京都データに対象IDの重複があります。');
const expectedCoordinates = {
  'manual-tokyo-hitorisauna-plus-ebisu-20260813': [35.6438987, 139.7083930],
  'manual-tokyo-roku-sauna-seiseki-20260813': [35.6529385, 139.4481319],
};
for (const row of rows) {
  const [latitude, longitude] = expectedCoordinates[row[0]];
  if (row[2] !== latitude || row[3] !== longitude) throw new Error(`座標が不正です: ${row[0]}`);
  const entry = curated[row[0]];
  if (!entry || !entry.checked || !entry.facts?.every(fact => fact.official && fact.urls?.some(url => url.startsWith('https://')))) throw new Error(`確認済み根拠が不正です: ${row[0]}`);
  if (!entry.sources?.some(url => url.includes('google.com/maps'))) throw new Error(`地図根拠が不正です: ${row[0]}`);
}
const tokyo = summary.prefectures.find(prefecture => prefecture.code === 13);
if (!tokyo || tokyo.counts.bath < 2 || tokyo.counts_indie.bath < 2) throw new Error('東京都の集計が不正です。');
console.log(JSON.stringify({ status: 'ok', ids, total: summary.total, checkedCount: summary.checked_count, tokyo: tokyo.counts }, null, 2));
