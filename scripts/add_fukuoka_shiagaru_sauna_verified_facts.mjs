import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "n11593067369";
const checked = "2026-08-13";
const homeUrl = "https://shiagaru-sauna.com/";
const faqUrl = "https://shiagaru-sauna.com/faq";
const domain = "shiagaru-sauna.com";
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
if (!row) throw new Error("福岡県データに既存SHIAGARU SAUNAがありません。");
if (row[1] !== "SHIAGARU SAUNA") throw new Error(`対象施設名が想定外です: ${row[1]}`);

row[4] = "bath";
row[5] = "sauna";
row[6] = 5;
row[7] = 5;
row[8] = 3;
row[9] = 2;
row[10] = 1;
row[14] = "福岡市";
row[15] = "Mo-Fr 12:00-24:00; Sa-Su 10:00-23:00";
row[17] = homeUrl;
row[18] = "公式FAQでお一人での来店可、18歳以上の男性専用、タオル料金込み、予約優先制を確認。公式サイトは福岡天神店と神田×秋葉原店の2店舗を掲載。";
row[19] = 5;
row[20] = 5;
row[21] = 3;
row[22] = checked;

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [faqUrl], v: "公式FAQは1人または2人での来店を推奨し、気軽にお一人で来店できると案内。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [homeUrl], v: "60分: 平日1,400円〜、土日祝1,700円〜。入館時間・利用時間により変動。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [homeUrl, faqUrl], v: "予約優先制。公式LINE経由の予約サイトから事前予約可能。予約なしの来店も可能だが待機する場合あり。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [homeUrl, faqUrl], v: "平日12:00〜24:00（最終受付23:00）、土日祝10:00〜23:00（最終受付22:00）。" },
    { conflict: false, k: "towel", n: 1, official: true, src: [domain], urls: [faqUrl], v: "タオル代は利用料金に含まれ、手ぶらで来店可能。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [faqUrl], v: "18歳以上の男性専用施設。不定期のレディースデイは女性のみ利用可能。" },
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
