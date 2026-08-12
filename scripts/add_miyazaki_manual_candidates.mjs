import fs from 'node:fs/promises';
import path from 'node:path';

const repo = '/home/ubuntu/hitori-source';
const root = path.join(repo, 'data/hitori');
const checked = '2026-08-13';

const facilities = [
  [
    'manual-miyazaki-sauna-parking-20260813',
    'サウナパーキングイオンモール宮崎',
    31.9212082,
    131.4571176,
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
    '宮崎市',
    '09:00〜22:00',
    '050-1720-0137',
    'https://sauna.travel/products/sauna-parking-aeon-mallmiyazaki',
    '公式予約ページでおひとりさまプラン、完全貸切、事前予約、水着必須、バスタオル・鍵付きロッカー付きを確認。利用前に公式予約ページで最新の空き状況を要確認。',
    5,
    4,
    3,
    checked,
  ],
  [
    'manual-miyazaki-kodomonokuni-sauna-park-20260813',
    'Kodomonokuni SAUNA PARK',
    31.8074968,
    131.4586164,
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
    '宮崎市',
    '07:00〜21:00（要事前予約）',
    '050-3690-9137',
    'https://sauna.travel/collections/sauna-booking/products/kodomonokuni-sauna-park',
    '公式予約ページで完全貸切、1名利用可、90分平日1名8,800円〜、セルフロウリュ、水着着用必須、要事前予約を確認。利用前に公式予約ページで最新の空き状況を要確認。',
    5,
    4,
    3,
    checked,
  ],
];

const parkingUrl = 'https://sauna.travel/products/sauna-parking-aeon-mallmiyazaki';
const kodomonokuniUrl = 'https://sauna.travel/collections/sauna-booking/products/kodomonokuni-sauna-park';
const curatedEntries = {
  'manual-miyazaki-sauna-parking-20260813': {
    checked,
    facts: [
      { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['sauna.travel'], urls: [parkingUrl], v: 'yes' },
      { conflict: false, k: 'price', n: 1, official: true, src: ['sauna.travel'], urls: [parkingUrl], v: 'おひとりさまプラン 2,000円' },
      { conflict: false, k: 'reservation', n: 1, official: true, src: ['sauna.travel'], urls: [parkingUrl], v: '事前予約制' },
      { conflict: false, k: 'hours', n: 1, official: true, src: ['sauna.travel'], urls: [parkingUrl], v: '09:00〜22:00' },
      { conflict: false, k: 'bring_towel', n: 1, official: true, src: ['sauna.travel'], urls: [parkingUrl], v: 'included' },
    ],
  },
  'manual-miyazaki-kodomonokuni-sauna-park-20260813': {
    checked,
    facts: [
      { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['sauna.travel'], urls: [kodomonokuniUrl], v: 'yes' },
      { conflict: false, k: 'price', n: 1, official: true, src: ['sauna.travel'], urls: [kodomonokuniUrl], v: '90分平日1名8,800円〜' },
      { conflict: false, k: 'reservation', n: 1, official: true, src: ['sauna.travel'], urls: [kodomonokuniUrl], v: '要事前予約' },
      { conflict: false, k: 'hours', n: 1, official: true, src: ['sauna.travel'], urls: [kodomonokuniUrl], v: '07:00〜21:00（要事前予約）' },
      { conflict: false, k: 'bring_towel', n: 1, official: true, src: ['sauna.travel'], urls: [kodomonokuniUrl], v: 'rental' },
    ],
  },
};

const [prefText, curatedText, summaryText] = await Promise.all([
  fs.readFile(path.join(root, 'pref/45.json'), 'utf8'),
  fs.readFile(path.join(root, 'curated.json'), 'utf8'),
  fs.readFile(path.join(root, 'summary.json'), 'utf8'),
]);

const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const fields = Object.fromEntries(pref.fields.map((field, index) => [field, index]));

for (const facility of facilities) {
  const id = facility[fields.id];
  if (!pref.items.some(row => row[fields.id] === id)) pref.items.push(facility);
  if (!curated[id]) curated[id] = curatedEntries[id];
}

const miyazaki = summary.prefectures.find(prefecture => prefecture.code === 45);
if (!miyazaki) throw new Error('宮崎県の集計が見つかりません。');
const beforeTotal = summary.total;
const beforeChecked = summary.checked_count;
const expectedNewIds = facilities.map(facility => facility[fields.id]);

summary.updated = checked;
summary.total = beforeTotal + expectedNewIds.filter(id => !prefText.includes(`"${id}"`)).length;
summary.checked_count = beforeChecked + expectedNewIds.filter(id => !curatedText.includes(`"${id}"`)).length;

const staticAdded = expectedNewIds.filter(id => !prefText.includes(`"${id}"`)).length;
if (staticAdded > 0) {
  miyazaki.counts.bath += staticAdded;
  miyazaki.counts.all += staticAdded;
  miyazaki.counts_indie.bath += staticAdded;
  miyazaki.counts_indie.all += staticAdded;
  for (const [key, value] of Object.entries(miyazaki.counts)) miyazaki.density[key] = Number((value / miyazaki.pop * 100).toFixed(2));
  for (const [key, value] of Object.entries(miyazaki.counts_indie)) miyazaki.density_indie[key] = Number((value / miyazaki.pop * 100).toFixed(2));
}

await Promise.all([
  fs.writeFile(path.join(root, 'pref/45.json'), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(root, 'curated.json'), `${JSON.stringify(curated, null, 1)}\n`),
  fs.writeFile(path.join(root, 'summary.json'), `${JSON.stringify(summary)}\n`),
]);

console.log(JSON.stringify({
  status: 'ok',
  addedFacilityIds: expectedNewIds,
  total: summary.total,
  checkedCount: summary.checked_count,
  miyazaki: miyazaki.counts,
}, null, 2));
