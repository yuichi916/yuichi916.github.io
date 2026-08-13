import { readFile, writeFile } from 'node:fs/promises';

const base = '/home/ubuntu/hitori-source/data/hitori';
const checked = '2026-08-13';
const curatedPath = `${base}/curated.json`;
const htmlPath = '/home/ubuntu/hitori-source/hitori.html';

const [curatedText, htmlText] = await Promise.all([
  readFile(curatedPath, 'utf8'),
  readFile(htmlPath, 'utf8'),
]);
const curated = JSON.parse(curatedText);
const required = [
  'n3914577849',
  'n13141906067',
  'manual-shimane-private-sauna-dann-20260812',
  'manual-shimane-fumai-sauna-20260812',
  'manual-miyazaki-sauna-parking-20260813',
  'manual-miyazaki-kodomonokuni-sauna-park-20260813',
  'manual-tokyo-roku-sauna-seiseki-20260813',
  'manual-fukuoka-sauna-giraffe-tenjin-20260813',
  'manual-kanagawa-oneperson-kannai-20260813',
];
for (const id of required) if (!curated[id]) throw new Error(`Missing curated record: ${id}`);

const addFact = (id, fact) => {
  const record = curated[id];
  if (!record.facts.some(existing => existing.k === fact.k && existing.v === fact.v)) record.facts.push(fact);
};
const addSources = (id, urls) => {
  const record = curated[id];
  record.sources = [...new Set([...(record.sources ?? []), ...urls])];
};

for (const id of ['n3914577849', 'n13141906067', 'manual-shimane-private-sauna-dann-20260812', 'manual-shimane-fumai-sauna-20260812']) {
  curated[id].checked = checked;
}

addFact('n3914577849', {
  conflict: false,
  k: 'counter_seating',
  n: 1,
  official: false,
  src: ['zatsu-ke.blog.jp'],
  urls: ['https://zatsu-ke.blog.jp/archives/51533511.html'],
  v: 'available',
});
addFact('n13141906067', {
  conflict: false,
  k: 'parking',
  n: 1,
  official: false,
  src: ['sanukiudon-ranking.com'],
  urls: ['https://www.sanukiudon-ranking.com/hyakunenya/'],
  v: '共用駐車場は多くなく、奥に2台分の記載あり',
});

addSources('manual-shimane-private-sauna-dann-20260812', ['https://www.google.com/maps/place/%E3%83%97%E3%83%A9%E3%82%A4%E3%83%99%E3%83%BC%E3%83%88%E3%82%B5%E3%82%A6%E3%83%8ADann/@34.9012749,132.0901052,17z']);
addSources('manual-shimane-fumai-sauna-20260812', ['https://www.google.com/maps/place/FUMAI+SAUNA%26INN/@35.4690243,133.0553447,17z']);
addSources('manual-miyazaki-sauna-parking-20260813', ['https://www.kanko-miyazaki.jp/feature/sauna']);
addSources('manual-miyazaki-kodomonokuni-sauna-park-20260813', ['https://www.kanko-miyazaki.jp/feature/sauna']);
addSources('manual-tokyo-roku-sauna-seiseki-20260813', ['https://rokusauna.com/shop/kantou/tokyo/seisekisakuragaoka/']);
addSources('manual-fukuoka-sauna-giraffe-tenjin-20260813', ['https://maps.app.goo.gl/NHTmQxA1iy4zBFV48']);

const oldFactMap = 'counter_seats:"カウンター席",bring_towel:"タオル",';
const newFactMap = 'counter_seats:"カウンター席",counter_seating:"カウンター席",closed_days:"定休日",bring_towel:"タオル",';
if (!htmlText.includes(oldFactMap)) throw new Error('Expected FACT dictionary anchor was not found.');
const updatedHtml = htmlText.replace(oldFactMap, newFactMap);

const prefectureDocs = await Promise.all(
  Array.from({ length: 47 }, (_, offset) => {
    const code = String(offset + 1).padStart(2, '0');
    return readFile(`${base}/pref/${code}.json`, 'utf8').then(JSON.parse).then(doc => ({ code, doc }));
  }),
);
const dateIds = new Set(['n3914577849', 'n13141906067', 'manual-shimane-private-sauna-dann-20260812', 'manual-shimane-fumai-sauna-20260812']);
let dateRowsUpdated = 0;
for (const { doc } of prefectureDocs) {
  for (const row of doc.items) {
    if (dateIds.has(row[0])) {
      row[22] = checked;
      dateRowsUpdated += 1;
    }
  }
}
if (dateRowsUpdated !== dateIds.size) throw new Error(`Expected ${dateIds.size} static rows, updated ${dateRowsUpdated}.`);

await Promise.all([
  writeFile(curatedPath, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(htmlPath, updatedHtml),
  ...prefectureDocs.map(({ code, doc }) => writeFile(`${base}/pref/${code}.json`, `${JSON.stringify(doc)}\n`)),
]);

console.log(JSON.stringify({ checked, dateRowsUpdated, addedFacts: 2, addedSourceSets: 6 }, null, 2));
