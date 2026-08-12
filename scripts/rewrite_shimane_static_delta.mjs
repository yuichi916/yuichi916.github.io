import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const repo = '/home/ubuntu/hitori-source';
const root = path.join(repo, 'data/hitori');
const readHead = file => execFileSync('git', ['-C', repo, 'show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const checked = '2026-08-12';

const facilities = [
  ['manual-shimane-private-sauna-dann-20260812', 'Private Sauna Dann', 34.9012749, 132.0901052, 'bath', 'private_sauna', 5, 4, 3, 2, 0, 0.0, 0, 0, '浜田市', '10:00〜22:00（最終受付）', '0855-25-6033', 'https://www.private-sauna-dann.com/blank-1', '公式情報で完全個室・セルフロウリュ・プライベート空間で完結を確認。利用前に公式LINEで最新の予約状況を要確認。', 5, 4, 3, checked],
  ['manual-shimane-fumai-sauna-20260812', 'FUMAI SAUNA&INN', 35.4690243, 133.0553447, 'bath', 'private_sauna', 5, 4, 3, 2, 0, 0.0, 0, 0, '松江市', '日帰りプラン 12:30〜15:00 / 20:00〜22:30', '0852-23-0620', 'https://fumaisauna.my.canva.site/', '公式情報で受付なしのPIN入室、1〜2名用の個室、日帰りリフレッシュプランを確認。宿泊予約により日帰り枠が変更される場合があるため要確認。', 5, 4, 3, checked],
];

const curatedEntries = {
  'manual-shimane-private-sauna-dann-20260812': {
    checked,
    facts: [
      { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['private-sauna-dann.com'], urls: ['https://www.private-sauna-dann.com/blank-1'], v: 'yes' },
      { conflict: false, k: 'hours', n: 1, official: true, src: ['private-sauna-dann.com'], urls: ['https://www.private-sauna-dann.com/blank-1'], v: '10:00〜22:00（最終受付）' },
      { conflict: false, k: 'reservation', n: 1, official: true, src: ['private-sauna-dann.com'], urls: ['https://www.private-sauna-dann.com/blank-1'], v: 'LINE予約（最新の受付状況は公式で要確認）' },
    ],
  },
  'manual-shimane-fumai-sauna-20260812': {
    checked,
    facts: [
      { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['fumaisauna.my.canva.site'], urls: ['https://fumaisauna.my.canva.site/'], v: 'yes' },
      { conflict: false, k: 'hours', n: 1, official: true, src: ['fumaisauna.my.canva.site'], urls: ['https://fumaisauna.my.canva.site/'], v: '日帰りプラン 12:30〜15:00 / 20:00〜22:30' },
      { conflict: false, k: 'price', n: 1, official: true, src: ['fumaisauna.my.canva.site'], urls: ['https://fumaisauna.my.canva.site/'], v: '日帰りリフレッシュプラン 1名2,800円〜' },
      { conflict: false, k: 'reservation', n: 1, official: true, src: ['fumaisauna.my.canva.site'], urls: ['https://fumaisauna.my.canva.site/'], v: '事前予約・PINコード入室' },
      { conflict: false, k: 'unstaffed', n: 1, official: true, src: ['fumaisauna.my.canva.site'], urls: ['https://fumaisauna.my.canva.site/'], v: 'yes' },
    ],
  },
};

const prefBase = readHead('data/hitori/pref/32.json').trim();
const curatedBase = readHead('data/hitori/curated.json').trimEnd();
const summaryBase = readHead('data/hitori/summary.json').trim();

if (!prefBase.endsWith(']}')) throw new Error('島根県データの末尾形式が想定外です。');
const appendedRows = facilities.map(row => JSON.stringify(row)).join(',');
const prefNext = `${prefBase.slice(0, -2)},${appendedRows}]}`;

const entryText = Object.entries(curatedEntries)
  .map(([id, value]) => ` "${id}": ${JSON.stringify(value, null, 1).replace(/\n/g, '\n ')}`)
  .join(',\n');
if (!curatedBase.endsWith('\n}')) throw new Error('確認済みデータの末尾形式が想定外です。');
const curatedNext = `${curatedBase.slice(0, -2)},\n${entryText}\n}\n`;

const replacements = [
  ['"updated":"2026-08-12","total":40560', '"updated":"2026-08-12","total":40562'],
  ['"checked_count":808', '"checked_count":810'],
  ['"counts":{"bath":41,"eat":68,"play":16,"stay":152,"all":277}', '"counts":{"bath":43,"eat":68,"play":16,"stay":152,"all":279}'],
  ['"counts_indie":{"bath":41,"eat":52,"play":13,"stay":152,"all":258}', '"counts_indie":{"bath":43,"eat":52,"play":13,"stay":152,"all":260}'],
  ['"density":{"bath":6.17,"eat":10.23,"play":2.41,"stay":22.87,"all":41.68}', '"density":{"bath":6.47,"eat":10.23,"play":2.41,"stay":22.87,"all":41.98}'],
  ['"density_indie":{"bath":6.17,"eat":7.82,"play":1.96,"stay":22.87,"all":38.82}', '"density_indie":{"bath":6.47,"eat":7.82,"play":1.96,"stay":22.87,"all":39.12}'],
];
let summaryNext = summaryBase;
for (const [from, to] of replacements) {
  if (!summaryNext.includes(from)) throw new Error(`集計更新対象が見つかりません: ${from}`);
  summaryNext = summaryNext.replace(from, to);
}

await Promise.all([
  fs.writeFile(path.join(root, 'pref/32.json'), `${prefNext}\n`),
  fs.writeFile(path.join(root, 'curated.json'), curatedNext),
  fs.writeFile(path.join(root, 'summary.json'), `${summaryNext}\n`),
]);

console.log('島根県2施設の差分限定更新を完了しました。');
