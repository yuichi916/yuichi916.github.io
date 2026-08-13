import { readFile, writeFile } from 'node:fs/promises';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'manual-tokyo-smart-stay-shizuku-oimachi-20260813';
const checked = '2026-08-13';
const officialUrl = 'https://shizuku-hotel.jp/shinagawa-oimachi/';
const spaUrl = 'https://shizuku-hotel.jp/shinagawa-oimachi/spa.html';
const mapUrl = 'https://www.navitime.co.jp/poi?name=%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%93%81%E5%B7%9D%E5%8C%BA%E6%9D%B1%E5%A4%A7%E4%BA%955%E4%B8%81%E7%9B%AE2-8&address=131090160050000200004';
const fact = (k, v, official = true) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? ['shizuku-hotel.jp'] : ['一人マップ監査'],
  urls: official ? [officialUrl, spaUrl] : [],
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
  throw new Error('Smart Stay SHIZUKU品川大井町は既に静的データへ存在します。二重登録を停止しました。');
}

pref.items.push([
  facilityId, 'Smart Stay SHIZUKU品川大井町', 35.607802, 139.735827, 'bath', 'capsule_hotel_sauna',
  3, 3, 4, 3, 0, 0, 0, 0, '品川区',
  '24時間営業（温浴エリアの個別営業時間は要確認）', '03-6810-4980', officialUrl,
  '公式に一人利用・日帰り料金・会話ルールの個別明示を確認できない範囲は要確認。', 3, 3, 4, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact('conditions', '宿泊者は温浴無料。温浴のみの日帰り入浴も利用可能で、男性・女性それぞれに大浴場とサウナあり。'),
    fact('hours', '施設は24時間営業。温浴エリアの個別営業時間は公式に確認できないため要確認。'),
    fact('towel', '館内着、ボディータオル、フェイスタオル、歯ブラシ、シャンプー等のアメニティ・無料貸出品あり。'),
    fact('payment_method', '現金、クレジットカード、QR決済に対応。'),
    fact('silence', '会話ルールは公式に確認できないため、会話環境は要確認。', false),
  ],
  sources: [officialUrl, spaUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length }, null, 2));
