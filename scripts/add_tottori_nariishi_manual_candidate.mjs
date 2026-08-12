import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const repo = '/home/ubuntu/hitori-source';
const root = path.join(repo, 'data/hitori');
const checked = '2026-08-13';
const id = 'manual-tottori-nariishi-sauna-20260813';
const officialUrl = 'https://nature-sauna.jp/nariishi-sauna/';
const googleMapsUrl = 'https://www.google.com/maps/search/?api=1&query=%E9%B3%B4%E3%82%8A%E7%9F%B3%E3%81%AE%E6%B5%9C%E3%82%B5%E3%82%A6%E3%83%8A%20%E9%B3%A5%E5%8F%96%E7%9C%8C%E6%9D%B1%E4%BC%AF%E9%83%A1%E7%90%B4%E6%B5%A6%E7%94%BA%E8%B5%A4%E7%A2%951929-11';

const facility = [
  id,
  '鳴り石の浜サウナ',
  35.5184942,
  133.6303988,
  'bath',
  'private_sauna',
  5,
  4,
  3,
  2,
  0,
  0.0,
  0,
  0,
  '琴浦町',
  '予約制（10:00〜12:30／13:30〜16:00、火・水定休）',
  '070-2161-3315',
  officialUrl,
  '公式情報で一人利用は1名から可能、予約制、1回5,000円（5名まで同額）、火・水定休を確認。利用前に公式予約窓口で最新の空き状況と条件を要確認。',
  5,
  4,
  3,
  checked,
];

const curatedEntry = {
  checked,
  facts: [
    { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['nature-sauna.jp'], urls: [officialUrl], v: 'yes' },
    { conflict: false, k: 'price', n: 1, official: true, src: ['nature-sauna.jp'], urls: [officialUrl], v: '1回5,000円（5名まで同額）' },
    { conflict: false, k: 'reservation', n: 1, official: true, src: ['nature-sauna.jp'], urls: [officialUrl], v: '1週間前までの予約・事前入金' },
    { conflict: false, k: 'hours', n: 1, official: true, src: ['nature-sauna.jp'], urls: [officialUrl], v: '10:00〜12:30／13:30〜16:00（予約制、火・水定休）' },
    { conflict: false, k: 'bring_towel', n: 1, official: true, src: ['nature-sauna.jp'], urls: [officialUrl], v: 'フェイスタオル300円販売、水着300円レンタル' },
  ],
  sources: [googleMapsUrl],
};

const readHead = file => execFileSync('git', ['-C', repo, 'show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const prefBase = readHead('data/hitori/pref/31.json').trim();
const curatedBase = readHead('data/hitori/curated.json').trimEnd();
const summaryBase = readHead('data/hitori/summary.json').trim();

if (prefBase.includes(`"${id}"`)) throw new Error('鳥取県データに対象IDが既にあります。');
if (curatedBase.includes(`"${id}"`)) throw new Error('確認済みデータに対象IDが既にあります。');
if (!prefBase.endsWith(']}')) throw new Error('鳥取県データの末尾形式が想定外です。');
if (!curatedBase.endsWith('\n}')) throw new Error('確認済みデータの末尾形式が想定外です。');

const summary = JSON.parse(summaryBase);
const tottori = summary.prefectures.find(prefecture => prefecture.code === 31);
if (!tottori) throw new Error('鳥取県の集計が見つかりません。');
const oldTottoriText = JSON.stringify(tottori);
const nextTottori = structuredClone(tottori);
for (const counts of [nextTottori.counts, nextTottori.counts_indie]) {
  counts.bath += 1;
  counts.all += 1;
}
for (const [key, value] of Object.entries(nextTottori.counts)) nextTottori.density[key] = Number((value / nextTottori.pop * 100).toFixed(2));
for (const [key, value] of Object.entries(nextTottori.counts_indie)) nextTottori.density_indie[key] = Number((value / nextTottori.pop * 100).toFixed(2));

const prefNext = `${prefBase.slice(0, -2)},${JSON.stringify(facility)}]}`;
const entryText = ` "${id}": ${JSON.stringify(curatedEntry, null, 1).replace(/\n/g, '\n ')}`;
const curatedNext = `${curatedBase.slice(0, -2)},\n${entryText}\n}\n`;
let summaryNext = summaryBase.replace(oldTottoriText, JSON.stringify(nextTottori));
summaryNext = summaryNext.replace(`"total":${summary.total}`, `"total":${summary.total + 1}`);
summaryNext = summaryNext.replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`);

await Promise.all([
  fs.writeFile(path.join(root, 'pref/31.json'), `${prefNext}\n`),
  fs.writeFile(path.join(root, 'curated.json'), curatedNext),
  fs.writeFile(path.join(root, 'summary.json'), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: 'ok', id, total: summary.total + 1, checkedCount: summary.checked_count + 1, tottori: nextTottori.counts }, null, 2));
