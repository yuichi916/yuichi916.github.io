import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const repo = '/home/ubuntu/hitori-source';
const root = path.join(repo, 'data/hitori');
const checked = '2026-08-13';
const candidate = {
  id: 'manual-fukuoka-sauna-giraffe-tenjin-20260813',
  facility: [
    'manual-fukuoka-sauna-giraffe-tenjin-20260813', 'SAUNA Giraff 天神', 33.5881550, 130.4063620,
    'bath', 'private_sauna', 5, 4, 3, 2, 1, 0.0, 0, 0, '福岡市',
    '朝9:30〜翌朝8:30（完全予約制）', null, 'https://sauna-giraffe.com/tenjin/',
    '公式情報で貸切個室・1名料金・完全予約制・営業時間・無人入室・タオル無料を確認。公式サイトは天神店と南天神店の2店舗を案内するためチェーンとして表示。利用前に予約画面で最新の空き状況と条件を要確認。',
    5, 4, 3, checked,
  ],
  curated: {
    checked,
    facts: [
      { conflict: false, k: 'solo_ok', n: 1, official: true, src: ['sauna-giraffe.com'], urls: ['https://sauna-giraffe.com/tenjin/'], v: '1名利用可（120分料金は1名まで）' },
      { conflict: false, k: 'price', n: 1, official: true, src: ['sauna-giraffe.com'], urls: ['https://sauna-giraffe.com/tenjin/'], v: '120分：平日6,600円〜、土日祝7,700円〜。ナイトパックあり' },
      { conflict: false, k: 'reservation', n: 1, official: true, src: ['sauna-giraffe.com'], urls: ['https://sauna-giraffe.com/tenjin/'], v: '完全予約制（予約サイトで受付）' },
      { conflict: false, k: 'hours', n: 1, official: true, src: ['sauna-giraffe.com'], urls: ['https://sauna-giraffe.com/tenjin/'], v: '朝9:30〜翌朝8:30' },
      { conflict: false, k: 'bring_towel', n: 1, official: true, src: ['sauna-giraffe.com'], urls: ['https://sauna-giraffe.com/tenjin/'], v: 'フェイスタオル・バスタオル各1枚無料' },
      { conflict: false, k: 'unmanned', n: 1, official: true, src: ['sauna-giraffe.com'], urls: ['https://sauna-giraffe.com/tenjin/'], v: '無人施設。予約完了後に入室パスコードを送付' },
    ],
    sources: ['https://www.google.com/maps/search/?api=1&query=SAUNA%20Giraffe%20%E5%A4%A9%E7%A5%9E'],
  },
};

const readHead = file => execFileSync('git', ['-C', repo, 'show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const prefBase = readHead('data/hitori/pref/40.json').trim();
const curatedBase = readHead('data/hitori/curated.json').trimEnd();
const summaryBase = readHead('data/hitori/summary.json').trim();

if (prefBase.includes(`"${candidate.id}"`) || curatedBase.includes(`"${candidate.id}"`)) {
  throw new Error(`福岡県データに対象IDが既にあります: ${candidate.id}`);
}
if (!prefBase.endsWith(']}')) throw new Error('福岡県データの末尾形式が想定外です。');
if (!curatedBase.endsWith('\n}')) throw new Error('確認済みデータの末尾形式が想定外です。');

const summary = JSON.parse(summaryBase);
const fukuoka = summary.prefectures.find(prefecture => prefecture.code === 40);
if (!fukuoka) throw new Error('福岡県の集計が見つかりません。');
const oldFukuokaText = JSON.stringify(fukuoka);
const nextFukuoka = structuredClone(fukuoka);
nextFukuoka.counts.bath += 1;
nextFukuoka.counts.all += 1;
for (const [key, value] of Object.entries(nextFukuoka.counts)) {
  nextFukuoka.density[key] = Number((value / nextFukuoka.pop * 100).toFixed(2));
}

const prefNext = `${prefBase.slice(0, -2)},${JSON.stringify(candidate.facility)}]}`;
const curatedEntry = ` "${candidate.id}": ${JSON.stringify(candidate.curated, null, 1).replace(/\n/g, '\n ')}`;
const curatedNext = `${curatedBase.slice(0, -2)},\n${curatedEntry}\n}\n`;
let summaryNext = summaryBase.replace(oldFukuokaText, JSON.stringify(nextFukuoka));
summaryNext = summaryNext.replace(`"total":${summary.total}`, `"total":${summary.total + 1}`);
summaryNext = summaryNext.replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`);

await Promise.all([
  fs.writeFile(path.join(root, 'pref/40.json'), `${prefNext}\n`),
  fs.writeFile(path.join(root, 'curated.json'), curatedNext),
  fs.writeFile(path.join(root, 'summary.json'), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: 'ok', id: candidate.id, total: summary.total + 1, checkedCount: summary.checked_count + 1, fukuoka: nextFukuoka.counts }, null, 2));
