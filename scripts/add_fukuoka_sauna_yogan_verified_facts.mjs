import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "n11917182769";
const checked = "2026-08-13";
const sourceUrl = "https://yogan-sauna-fukuoka-tenjin.jp/price/";
const domain = "yogan-sauna-fukuoka-tenjin.jp";
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
if (!row) throw new Error("福岡県データに既存サウナヨーガン福岡天神がありません。");
if (row[1] !== "サウナヨーガン福岡天神") throw new Error(`対象施設名が想定外です: ${row[1]}`);

row[4] = "bath";
row[5] = "sauna";
row[6] = 5;
row[7] = 4;
row[8] = 3;
row[9] = 2;
row[10] = 0;
row[13] = 0;
row[14] = "福岡市";
row[15] = "07:30-24:00; Thu 13:00-24:00";
row[17] = "https://yogan-sauna-fukuoka-tenjin.jp/";
row[18] = "公式料金ページでプライベートサウナのおひとり様利用、料金、予約、営業時間、日帰り利用条件を確認。";
row[19] = 5;
row[20] = 4;
row[21] = 3;
row[22] = checked;

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [sourceUrl], v: "プライベートサウナはおひとり様〜3名様まで利用可能。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [sourceUrl], v: "プライベートサウナ90分: 平日7,700円・土日祝8,800円。150分: 平日9,900円・土日祝13,200円。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [sourceUrl], v: "プライベートサウナは要予約。パブリックサウナは予約不要。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [sourceUrl], v: "7:30〜24:00（最終受付23:00）。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [sourceUrl], v: "日帰り利用可。複数人は最大3名、同性または家族のみ。" },
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
