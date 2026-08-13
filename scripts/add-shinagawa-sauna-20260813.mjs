import { readFile, writeFile } from 'node:fs/promises';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'manual-tokyo-shinagawa-sauna-oimachi-20260813';
const checked = '2026-08-13';
const officialUrl = 'https://www.shinagawa-sauna.com/';
const mapUrl = 'https://www.navitime.co.jp/poi?spot=02022-10044332';
const fact = (k, v, official = true) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? ['shinagawa-sauna.com'] : ['一人マップ監査'],
  urls: official ? [officialUrl] : [],
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
if (pref.items.some(row => row[0] === facilityId) || curated[facilityId]) {
  throw new Error('品川サウナは既に静的データへ存在します。二重登録を停止しました。');
}

pref.items.push([
  facilityId, '品川サウナ', 35.606897, 139.733326, 'bath', 'sauna',
  3, 3, 4, 3, 0, 0, 0, 0, '品川区',
  '5:30〜深夜2:30（最終受付 深夜1:00、2:30〜5:30は清掃）', '', officialUrl,
  '公式に一人利用・会話ルール・日帰り料金の文字情報を確認できないため要確認。', 3, 3, 4, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact('hours', 'サウナ営業時間5:30〜深夜2:30。最終受付は深夜1:00、2:30〜5:30は清掃・メンテナンスのため温浴エリア利用不可。'),
    fact('towel', '無料アメニティ（化粧水、乳液、洗顔料、シャンプー等）あり。タオルセット・館内着は有料レンタル。'),
    fact('payment_method', '現金、主要クレジットカード、電子マネー、コード決済に対応。'),
    fact('conditions', 'タトゥー・入れ墨は利用不可。サウナ・温浴エリア、脱衣所、トイレは撮影不可。駐輪場・駐車場なし。'),
    fact('silence', '会話ルールは公式に確認できないため、会話環境は要確認。', false),
  ],
  sources: [officialUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length }, null, 2));
