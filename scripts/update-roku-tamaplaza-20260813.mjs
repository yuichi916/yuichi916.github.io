import { readFile, writeFile } from 'node:fs/promises';

const base = '/home/ubuntu/hitori-source/data/hitori';
const facilityId = 'n10994791642';
const checked = '2026-08-13';
const rootUrl = 'https://rokusauna.com/';
const shopUrl = 'https://rokusauna.com/shop/kantou/kanagawa/tama-plaza/';

const prefPath = `${base}/pref/14.json`;
const curatedPath = `${base}/curated.json`;
const summaryPath = `${base}/summary.json`;

const pref = JSON.parse(await readFile(prefPath, 'utf8'));
const item = pref.items.find(row => row[0] === facilityId);

if (!item) throw new Error(`Facility ${facilityId} was not found in prefecture data.`);
if (item[1] !== 'Roku Sauna') throw new Error(`Unexpected current facility name: ${item[1]}`);

item[1] = 'ROKU SAUNAたまプラーザ店';
item[5] = 'private_sauna';
item[9] = 2;
item[14] = '横浜市青葉区';
item[15] = '月〜金 10:20〜24:40／土・日 8:00〜24:40（最終入室22:40）';
item[17] = shopUrl;
item[18] = '公式に完全個室・完全予約制・1名料金・営業時間・タオル等を確認。会話ルールは公式に確認できないため要確認。料金・予約枠・特別営業は利用前に公式の最新情報を確認。';
item[22] = checked;

const curated = JSON.parse(await readFile(curatedPath, 'utf8'));
if (curated[facilityId]) throw new Error(`Curated entry already exists for ${facilityId}.`);

curated[facilityId] = {
  checked,
  facts: [
    {
      conflict: false,
      k: 'solo_ok',
      n: 1,
      official: true,
      src: ['rokusauna.com'],
      urls: [rootUrl, shopUrl],
      v: '完全個室のプライベートサウナで、公式料金表に1名利用の80分・100分・120分プランを掲載。',
    },
    {
      conflict: false,
      k: 'price',
      n: 1,
      official: true,
      src: ['rokusauna.com'],
      urls: [shopUrl],
      v: '1名料金は80分4,500円、100分5,000円、120分5,500円。',
    },
    {
      conflict: false,
      k: 'reservation',
      n: 1,
      official: true,
      src: ['rokusauna.com'],
      urls: [rootUrl],
      v: '完全予約制。電話予約・直接来店では予約できず、事前予約が必要。',
    },
    {
      conflict: false,
      k: 'hours',
      n: 1,
      official: true,
      src: ['rokusauna.com'],
      urls: [shopUrl],
      v: '月〜金10:20〜24:40、土・日8:00〜24:40。最終入室は22:40。',
    },
    {
      conflict: false,
      k: 'towel',
      n: 1,
      official: true,
      src: ['rokusauna.com'],
      urls: [shopUrl],
      v: '利用料金にバスタオル・フェイスタオル・ヘアブラシ・ヘアゴム・アロマ・アイスキャンディーを含む。',
    },
    {
      conflict: false,
      k: 'silence',
      n: 1,
      official: true,
      src: ['rokusauna.com'],
      urls: [rootUrl],
      v: '完全個室・非対面／非接触の案内あり。会話ルールは公式に確認できないため、会話環境は要確認。',
    },
  ],
  sources: [rootUrl, shopUrl],
};

const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
if (summary.checked_count !== 761) throw new Error(`Unexpected checked_count: ${summary.checked_count}`);
summary.checked_count = 762;
summary.updated = checked;

await Promise.all([
  writeFile(prefPath, `${JSON.stringify(pref)}\n`),
  writeFile(curatedPath, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(summaryPath, `${JSON.stringify(summary)}\n`),
]);

console.log(JSON.stringify({
  facilityId,
  name: item[1],
  checked: item[22],
  factCount: curated[facilityId].facts.length,
  checkedCount: summary.checked_count,
}, null, 2));
