import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/home/ubuntu/hitori-source/data/hitori';
const id = 'manual-fukuoka-sauna-giraffe-tenjin-20260813';
const [prefText, curatedText, summaryText] = await Promise.all([
  fs.readFile(path.join(root, 'pref/40.json'), 'utf8'),
  fs.readFile(path.join(root, 'curated.json'), 'utf8'),
  fs.readFile(path.join(root, 'summary.json'), 'utf8'),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const rows = pref.items.filter(row => row[0] === id);
if (rows.length !== 1) throw new Error(`福岡県データの対象件数が不正です: ${rows.length}`);
const row = rows[0];
if (row[2] !== 33.588155 || row[3] !== 130.406362) throw new Error('座標が不正です。');
if (row[10] !== 1) throw new Error('公式に確認したチェーン判定が反映されていません。');
const entry = curated[id];
if (!entry || entry.checked !== '2026-08-13' || entry.facts?.length !== 6) throw new Error('確認済み情報が不正です。');
if (!entry.facts.every(fact => fact.official && fact.urls?.some(url => url.startsWith('https://sauna-giraffe.com/')))) {
  throw new Error('公式根拠URLが不正です。');
}
if (!entry.sources?.some(url => url.includes('google.com/maps'))) throw new Error('地図根拠が不正です。');
const fukuoka = summary.prefectures.find(prefecture => prefecture.code === 40);
if (
  !fukuoka ||
  summary.total < 40568 ||
  summary.checked_count !== Object.keys(curated).length ||
  fukuoka.counts.bath < 1
) {
  throw new Error('福岡県または全国の集計が不正です。');
}
console.log(JSON.stringify({ status: 'ok', id, total: summary.total, checkedCount: summary.checked_count, fukuoka: fukuoka.counts }, null, 2));
