import { readFile, writeFile } from 'node:fs/promises';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'n6712204417';
const checked = '2026-08-13';
const officialUrl = 'https://www.spa-nagomi.com/';
const rateUrl = 'https://www.spa-nagomi.com/rate.html';
const fact = (k, v, official = true) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? ['spa-nagomi.com'] : ['一人マップ監査'],
  urls: official ? [officialUrl, rateUrl] : [],
  v,
});

const [prefText, curatedText, summaryText] = await Promise.all([
  readFile(`${base}/pref/13.json`, 'utf8'),
  readFile(`${base}/curated.json`, 'utf8'),
  readFile(`${base}/summary.json`, 'utf8'),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const item = pref.items.find(row => row[0] === facilityId);
if (!item) throw new Error('SPA&HOTEL和の既存OSMレコードが東京都データにありません。');
if (curated[facilityId]) throw new Error('SPA&HOTEL和の確認済みデータが既に存在します。二重更新を停止しました。');

item[1] = 'SPA&HOTEL 和';
item[14] = '大田区';
item[15] = '11:00〜翌9:00（最終受付 翌8:00）';
item[17] = officialUrl;
item[18] = '公式に一人利用・会話ルールの個別明示を確認できない範囲は要確認。';
item[22] = checked;
curated[facilityId] = {
  checked,
  facts: [
    fact('price', '平日大人5時間2,680円・70分1,880円、休日5時間2,980円・70分2,180円。'),
    fact('hours', 'SPA利用時間11:00〜翌9:00、最終受付翌8:00。'),
    fact('towel', '料金にフェイス・バスタオル、館内着、アメニティ利用を含む。'),
    fact('payment_method', '主要クレジットカード、電子マネー、QR決済に対応。'),
    fact('reservation', 'ランチパック、岩盤浴の日、お泊りパックは予約不要。通常SPA利用の予約要否は利用前に要確認。'),
    fact('conditions', '刺青・タトゥー・ペイントシール、暴力団関係者、泥酔者、他の利用者へ迷惑をかける者、暴言・暴力・威嚇行為をする者は入館不可。'),
    fact('silence', '会話ルールは公式に確認できないため、会話環境は要確認。', false),
  ],
  sources: [officialUrl, rateUrl],
};
summary.checked_count += 1;
await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, factCount: curated[facilityId].facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
