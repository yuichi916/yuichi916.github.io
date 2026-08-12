import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "n11442937669";
const checked = "2026-08-13";
const homeUrl = "https://www.wellbe.co.jp/fukuoka/";
const faqUrl = "https://tayori.com/faq/95231f800fa41659b65eea3edf9dff4af000f275/";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [
  readHead("data/hitori/pref/40.json").trim(),
  readHead("data/hitori/curated.json").trimEnd(),
  readHead("data/hitori/summary.json").trim(),
];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");

const pref = JSON.parse(prefBase);
const row = pref.items.find(item => item[0] === id);
if (!row) throw new Error("福岡県データに既存ウェルビー福岡がありません。");
if (row[1] !== "ウェルビー福岡") throw new Error(`対象施設名が想定外です: ${row[1]}`);

row[4] = "bath";
row[5] = "sauna";
row[6] = 5;
row[7] = 5;
row[8] = 3;
row[9] = 2;
row[10] = 1;
row[14] = "福岡市";
row[15] = "男性サウナ 5:00-23:00; 女性専用エリア 12:00-22:00";
row[17] = homeUrl;
row[18] = "公式の料金・営業時間・女性専用エリア・予約不要・人数制限を確認。一人利用可否は取得できた公式本文に直接の明示がないため要確認。公式サイトが複数店舗を掲載するためチェーンとして表示。";
row[19] = 5;
row[20] = 5;
row[21] = 3;
row[22] = checked;

const curated = {
  checked,
  facts: [
    { conflict: false, k: "price", n: 1, official: true, src: ["wellbe.co.jp"], urls: [homeUrl], v: "福岡店の入館料2時間: 平日2,000円、土日祝・特定日2,500円。延長1時間500円、最大平日4,000円／土日祝4,500円。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: ["tayori.com"], urls: [faqUrl], v: "女性専用エリアは予約不要。営業時間中に来店（最終入館受付21:00）。混雑・ロッカー空き状況により入館できない場合あり。" },
    { conflict: false, k: "hours", n: 1, official: true, src: ["wellbe.co.jp", "tayori.com"], urls: [homeUrl, faqUrl], v: "男性サウナは5:00〜23:00。女性専用エリアは12:00〜22:00（最終受付21:00）。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: ["tayori.com"], urls: [faqUrl], v: "女性専用エリアと男女共用エリアがある。公式FAQでは一人利用可否を直接確認できていないため、利用前に公式の最新案内を要確認。女性専用エリアは人数制限・混雑時の入館制限あり。" },
  ],
  sources: [],
};

const summary = JSON.parse(summaryBase);
const curatedEntry = ` "${id}": ${JSON.stringify(curated, null, 1).replace(/\n/g, "\n ")}`;
const curatedNext = `${curatedBase.slice(0, -2)},\n${curatedEntry}\n}\n`;
const summaryNext = summaryBase.replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`);

await Promise.all([
  fs.writeFile(path.join(dataRoot, "pref/40.json"), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(dataRoot, "curated.json"), curatedNext),
  fs.writeFile(path.join(dataRoot, "summary.json"), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: "ok", id, checkedCount: summary.checked_count + 1, facility: row.slice(0, 23) }, null, 2));
