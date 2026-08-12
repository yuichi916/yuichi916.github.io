import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "n12287841953";
const checked = "2026-08-13";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [
  readHead("data/hitori/pref/40.json").trim(),
  readHead("data/hitori/curated.json").trimEnd(),
  readHead("data/hitori/summary.json").trim(),
];

if (curatedBase.includes(`\"${id}\"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");

const pref = JSON.parse(prefBase);
const row = pref.items.find(item => item[0] === id);
if (!row) throw new Error("福岡県データに既存テンジンサウナがありません。");
if (row[1] !== "テンジンサウナ") throw new Error(`対象施設名が想定外です: ${row[1]}`);

row[4] = "bath";
row[5] = "private_sauna";
row[6] = 5;
row[7] = 4;
row[8] = 3;
row[9] = 2;
row[10] = 0;
row[13] = 0;
row[14] = "福岡市";
row[15] = "08:00-23:30; irregular";
row[17] = "https://www.tenjin-sauna.com/";
row[18] = "公式料金ページで1名利用・部屋定員・料金・営業時間・所在地を確認。公式の複数店舗根拠は未確認のためチェーン判定は要確認。";
row[19] = 5;
row[20] = 4;
row[21] = 3;
row[22] = checked;

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: ["www.tenjin-sauna.com"], urls: ["https://www.tenjin-sauna.com/price/"], v: "スタンダードルーム（1〜2名）・デラックスルーム（1〜4名）。各室で1名利用料金を明示。" },
    { conflict: false, k: "price", n: 1, official: true, src: ["www.tenjin-sauna.com"], urls: ["https://www.tenjin-sauna.com/price/"], v: "スタンダード60分2,090円（税込）〜、デラックス60分3,410円（税込）〜。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: ["www.tenjin-sauna.com"], urls: ["https://www.tenjin-sauna.com/price/"], v: "公式予約ページから予約。" },
    { conflict: false, k: "hours", n: 1, official: true, src: ["www.tenjin-sauna.com"], urls: ["https://www.tenjin-sauna.com/price/"], v: "8:00〜23:30、不定休。" },
    { conflict: false, k: "access", n: 1, official: true, src: ["www.tenjin-sauna.com"], urls: ["https://www.tenjin-sauna.com/price/"], v: "福岡市中央区今泉1丁目9-2、ホテルFUN内3F。福岡天神駅から徒歩約4分。" },
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
