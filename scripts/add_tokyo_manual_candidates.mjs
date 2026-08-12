import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const repo = '/home/ubuntu/hitori-source';
const root = path.join(repo, 'data/hitori');
const checked = '2026-08-13';

const candidates = [
  {
    id: 'manual-tokyo-hitorisauna-plus-ebisu-20260813',
    facility: [
      'manual-tokyo-hitorisauna-plus-ebisu-20260813', 'ひとりサウナプラス 恵比寿', 35.6438987, 139.7083930,
      'bath', 'private_sauna', 5, 4, 3, 2, 0, 0.0, 0, 0, '渋谷区',
      '平日10:20〜23:00、土日祝10:00〜23:00（完全予約制）', null, 'https://1sauna.jp/',
      '公式情報でお一人様用の完全個室サウナ、完全予約制、料金、営業時間、タオル等の用意を確認。利用前に公式予約画面で最新の空き状況と条件を要確認。',
      5, 4, 3, checked,
    ],
    curated: {
      checked,
      facts: [
        { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['1sauna.jp'], urls: ['https://1sauna.jp/'], v: 'yes' },
        { conflict: false, k: 'price', n: 1, official: true, src: ['1sauna.jp'], urls: ['https://1sauna.jp/'], v: '60分3,800円、90分4,300円〜' },
        { conflict: false, k: 'reservation', n: 1, official: true, src: ['1sauna.jp'], urls: ['https://1sauna.jp/'], v: '完全予約制' },
        { conflict: false, k: 'hours', n: 1, official: true, src: ['1sauna.jp'], urls: ['https://1sauna.jp/'], v: '平日10:20〜23:00、土日祝10:00〜23:00' },
        { conflict: false, k: 'bring_towel', n: 1, official: true, src: ['1sauna.jp'], urls: ['https://1sauna.jp/'], v: 'included' },
      ],
      sources: ['https://www.google.com/maps/search/?api=1&query=%E3%81%B2%E3%81%A8%E3%82%8A%E3%82%B5%E3%82%A6%E3%83%8A%E3%83%97%E3%83%A9%E3%82%B9%20%E6%81%B5%E6%AF%94%E5%AF%BF'],
    },
  },
  {
    id: 'manual-tokyo-roku-sauna-seiseki-20260813',
    facility: [
      'manual-tokyo-roku-sauna-seiseki-20260813', 'ROKU SAUNA 聖蹟桜ヶ丘店', 35.6529385, 139.4481319,
      'bath', 'private_sauna', 5, 4, 3, 2, 0, 0.0, 0, 0, '多摩市',
      null, null, 'https://rokusauna.com/shop/kantou/tokyo/seisekisakuragaoka/',
      '公式情報で完全個室・完全予約制・1名料金・タオル等の料金内利用を確認。利用前に公式予約画面で最新の空き状況と条件を要確認。',
      4, 4, 3, checked,
    ],
    curated: {
      checked,
      facts: [
        { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['rokusauna.com'], urls: ['https://rokusauna.com/'], v: 'yes' },
        { conflict: false, k: 'price', n: 1, official: true, src: ['rokusauna.com'], urls: ['https://rokusauna.com/'], v: '80分1名3,960円、100分1名4,510円、120分1名5,000円' },
        { conflict: false, k: 'reservation', n: 1, official: true, src: ['rokusauna.com'], urls: ['https://rokusauna.com/'], v: '完全予約制' },
        { conflict: false, k: 'bring_towel', n: 1, official: true, src: ['rokusauna.com'], urls: ['https://rokusauna.com/'], v: 'included' },
      ],
      sources: ['https://www.google.com/maps/search/?api=1&query=ROKU%20SAUNA%20%E8%81%96%E8%B9%9F%E6%A1%9C%E3%83%B6%E4%B8%98'],
    },
  },
];

const readHead = file => execFileSync('git', ['-C', repo, 'show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const prefBase = readHead('data/hitori/pref/13.json').trim();
const curatedBase = readHead('data/hitori/curated.json').trimEnd();
const summaryBase = readHead('data/hitori/summary.json').trim();

for (const candidate of candidates) {
  if (prefBase.includes(`"${candidate.id}"`)) throw new Error(`東京都データに対象IDが既にあります: ${candidate.id}`);
  if (curatedBase.includes(`"${candidate.id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${candidate.id}`);
}
if (!prefBase.endsWith(']}')) throw new Error('東京都データの末尾形式が想定外です。');
if (!curatedBase.endsWith('\n}')) throw new Error('確認済みデータの末尾形式が想定外です。');

const summary = JSON.parse(summaryBase);
const tokyo = summary.prefectures.find(prefecture => prefecture.code === 13);
if (!tokyo) throw new Error('東京都の集計が見つかりません。');
const oldTokyoText = JSON.stringify(tokyo);
const nextTokyo = structuredClone(tokyo);
for (const counts of [nextTokyo.counts, nextTokyo.counts_indie]) {
  counts.bath += candidates.length;
  counts.all += candidates.length;
}
for (const [key, value] of Object.entries(nextTokyo.counts)) nextTokyo.density[key] = Number((value / nextTokyo.pop * 100).toFixed(2));
for (const [key, value] of Object.entries(nextTokyo.counts_indie)) nextTokyo.density_indie[key] = Number((value / nextTokyo.pop * 100).toFixed(2));

const prefNext = `${prefBase.slice(0, -2)},${candidates.map(candidate => JSON.stringify(candidate.facility)).join(',')}]}`;
const entries = candidates.map(candidate => ` "${candidate.id}": ${JSON.stringify(candidate.curated, null, 1).replace(/\n/g, '\n ')}`).join(',\n');
const curatedNext = `${curatedBase.slice(0, -2)},\n${entries}\n}\n`;
let summaryNext = summaryBase.replace(oldTokyoText, JSON.stringify(nextTokyo));
summaryNext = summaryNext.replace(`"total":${summary.total}`, `"total":${summary.total + candidates.length}`);
summaryNext = summaryNext.replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + candidates.length}`);

await Promise.all([
  fs.writeFile(path.join(root, 'pref/13.json'), `${prefNext}\n`),
  fs.writeFile(path.join(root, 'curated.json'), curatedNext),
  fs.writeFile(path.join(root, 'summary.json'), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: 'ok', ids: candidates.map(candidate => candidate.id), total: summary.total + candidates.length, checkedCount: summary.checked_count + candidates.length, tokyo: nextTokyo.counts }, null, 2));
