import { readFile, writeFile } from 'node:fs/promises';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'n6785091986';
const checked = '2026-08-13';
const officialUrl = 'https://kamata-onsen.com/';
const fact = (k, v, official = true) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: ['kamata-onsen.com'],
  urls: [officialUrl],
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
if (!item) throw new Error('蒲田温泉の既存OSMレコードが東京都データにありません。');
if (curated[facilityId]) throw new Error('蒲田温泉の確認済みデータが既に存在します。二重更新を停止しました。');

item[14] = '大田区';
item[15] = '年中無休 10:00〜24:00';
item[17] = officialUrl;
item[22] = checked;

curated[facilityId] = {
  checked,
  facts: [
    fact('price', '大人入浴料600円、サウナ利用料金300円。'),
    fact('hours', '年中無休10:00〜24:00。'),
    fact('towel', '手ぶらセット（入浴料込み）900円。レンタルバスタオル200円、フェイスタオル50円。'),
    fact('payment_method', '支払いは現金のみ。'),
    fact('conditions', '暴力団関係者、泥酔者、皮膚疾患等の伝染のおそれがある者、排泄を自力でコントロールできない者は入店不可。'),
    fact('silence', '会話ルールは公式に確認できないため、会話環境は要確認。', false),
  ],
  sources: [officialUrl],
};

summary.checked_count += 1;
await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);

console.log(JSON.stringify({ facilityId, factCount: curated[facilityId].facts.length, checkedCount: summary.checked_count }, null, 2));
